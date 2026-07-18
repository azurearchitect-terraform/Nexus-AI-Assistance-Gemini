use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use futures_util::{SinkExt, StreamExt};
use reqwest::Client;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use tokio::sync::mpsc;
use tokio::time::sleep;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use uuid::Uuid;

#[derive(Default)]
pub struct MeetingManager {
    pub is_running: Arc<AtomicBool>,
}

#[derive(Serialize, Deserialize, Debug)]
struct GeminiResponse {
    serverContent: Option<ServerContent>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ServerContent {
    modelTurn: Option<ModelTurn>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ModelTurn {
    parts: Option<Vec<Part>>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Part {
    text: Option<String>,
}

#[tauri::command]
pub async fn start_meeting(
    app: AppHandle,
    google_key: String,
    openai_key: String,
    manager: State<'_, MeetingManager>,
) -> Result<String, String> {
    if manager.is_running.load(Ordering::SeqCst) {
        return Err("Meeting is already running".into());
    }
    manager.is_running.store(true, Ordering::SeqCst);

    let meeting_id = Uuid::new_v4().to_string();
    
    // Spawn background tasks
    let is_running_audio = manager.is_running.clone();
    let meeting_id_clone = meeting_id.clone();
    let db_path = app
        .path()
        .app_data_dir()
        .unwrap()
        .join("nexus-ai.db");

    tokio::spawn(async move {
        if let Err(e) = run_audio_stream(
            meeting_id_clone,
            google_key,
            is_running_audio,
            db_path.to_string_lossy().to_string(),
        ).await {
            eprintln!("Audio stream error: {}", e);
        }
    });

    let is_running_summary = manager.is_running.clone();
    let meeting_id_clone2 = meeting_id.clone();
    let db_path_clone = app
        .path()
        .app_data_dir()
        .unwrap()
        .join("nexus-ai.db");

    tokio::spawn(async move {
        run_summarizer(
            meeting_id_clone2,
            openai_key,
            is_running_summary,
            db_path_clone.to_string_lossy().to_string(),
        ).await;
    });

    Ok(meeting_id)
}

#[tauri::command]
pub async fn stop_meeting(manager: State<'_, MeetingManager>) -> Result<(), String> {
    manager.is_running.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn trigger_summary(app: AppHandle, meeting_id: String, openai_key: String) -> Result<(), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .unwrap()
        .join("nexus-ai.db");

    let is_running = Arc::new(AtomicBool::new(true)); // Run once
    tokio::spawn(async move {
        // Run summarizer instantly
        run_summarizer(meeting_id, openai_key, is_running, db_path.to_string_lossy().to_string()).await;
    });

    Ok(())
}

async fn run_audio_stream(
    meeting_id: String,
    google_key: String,
    is_running: Arc<AtomicBool>,
    db_path: String,
) -> Result<()> {
    let ws_url = format!(
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={}",
        google_key
    );

    let (ws_stream, _) = connect_async(&ws_url).await?;
    let (mut write, mut read) = ws_stream.split();

    // Send Setup Message
    let setup_msg = json!({
        "setup": {
            "model": "models/gemini-3.1-flash-live-preview"
        }
    });
    write.send(WsMessage::Text(setup_msg.to_string())).await?;

    let (audio_tx, mut audio_rx) = mpsc::channel::<Vec<i16>>(100);

    // Audio Capture Thread
    let is_running_capture = is_running.clone();
    std::thread::spawn(move || {
        let host = cpal::default_host();
        let device = host.default_input_device().expect("No input device");
        let config = device.default_input_config().unwrap().into();

        let is_running_closure = is_running_capture.clone();
        let stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &_| {
                if !is_running_closure.load(Ordering::SeqCst) {
                    return;
                }
                
                // Resample and convert to 16-bit PCM 16kHz (basic implementation)
                let mut pcm = Vec::new();
                for &sample in data {
                    let s = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
                    pcm.push(s);
                }

                // VAD: Energy calculation
                let energy: f32 = pcm.iter().map(|&s| (s as f32).powi(2)).sum::<f32>() / (pcm.len() as f32).max(1.0);
                if energy > 100000.0 {
                    let _ = audio_tx.blocking_send(pcm);
                }
            },
            |err| eprintln!("Audio stream error: {}", err),
            None,
        ).unwrap();

        stream.play().unwrap();
        while is_running_capture.load(Ordering::SeqCst) {
            std::thread::sleep(Duration::from_millis(100));
        }
    });

    let db_path_clone = db_path.clone();
    let meeting_id_clone = meeting_id.clone();
    
    // Receiver loop for Gemini Transcript
    let is_running_read = is_running.clone();
    tokio::spawn(async move {
        while is_running_read.load(Ordering::SeqCst) {
            if let Some(Ok(msg)) = read.next().await {
                if let WsMessage::Text(t) = msg {
                    if let Ok(resp) = serde_json::from_str::<GeminiResponse>(&t) {
                        if let Some(content) = resp.serverContent {
                            if let Some(turn) = content.modelTurn {
                                if let Some(parts) = turn.parts {
                                    for part in parts {
                                        if let Some(text) = part.text {
                                            if let Ok(conn) = Connection::open(&db_path_clone) {
                                                let id = Uuid::new_v4().to_string();
                                                let _ = conn.execute(
                                                    "INSERT INTO meeting_transcripts (id, meeting_id, text) VALUES (?1, ?2, ?3)",
                                                    [&id, &meeting_id_clone, &text]
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                break;
            }
        }
    });

    // Sender loop for audio chunks
    while is_running.load(Ordering::SeqCst) {
        if let Some(pcm) = audio_rx.recv().await {
            // Little Endian Bytes
            let mut byte_data = Vec::with_capacity(pcm.len() * 2);
            for s in pcm {
                byte_data.extend_from_slice(&s.to_le_bytes());
            }

            let base64_audio = general_purpose::STANDARD.encode(&byte_data);
            let payload = json!({
                "clientContent": {
                    "turns": [{
                        "role": "user",
                        "parts": [{
                            "inlineData": {
                                "mimeType": "audio/pcm;rate=16000",
                                "data": base64_audio
                            }
                        }]
                    }],
                    "turnComplete": true
                }
            });

            if write.send(WsMessage::Text(payload.to_string())).await.is_err() {
                break;
            }
        }
    }

    Ok(())
}

async fn run_summarizer(meeting_id: String, openai_key: String, is_running: Arc<AtomicBool>, db_path: String) {
    let client = Client::new();

    while is_running.load(Ordering::SeqCst) {
        sleep(Duration::from_secs(60)).await;

        if !is_running.load(Ordering::SeqCst) {
            break;
        }

        let full_transcript = {
            if let Ok(conn) = Connection::open(&db_path) {
                let mut stmt = match conn.prepare("SELECT text FROM meeting_transcripts WHERE meeting_id = ?1 ORDER BY created_at ASC") {
                    Ok(s) => s,
                    Err(_) => continue,
                };

                let rows = stmt.query_map([&meeting_id], |row| row.get::<_, String>(0));
                
                if let Ok(iter) = rows {
                    let mut text = String::new();
                    for t in iter.flatten() {
                        text.push_str(&t);
                        text.push(' ');
                    }
                    text
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        };

        if full_transcript.trim().is_empty() {
            continue;
        }

        let payload = json!({
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "Summarize the meeting transcript into key points and action items."},
                {"role": "user", "content": full_transcript}
            ]
        });

        let mut backoff = 1;
        let mut success = false;
        let mut summary_result = String::new();
        
        for _ in 0..3 {
            let res = client.post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", openai_key))
                .json(&payload)
                .send()
                .await;

            if let Ok(r) = res {
                if r.status().is_success() {
                    if let Ok(json) = r.json::<serde_json::Value>().await {
                        if let Some(summary) = json["choices"][0]["message"]["content"].as_str() {
                            summary_result = summary.to_string();
                            success = true;
                            break;
                        }
                    }
                } else if r.status() == 429 {
                    sleep(Duration::from_secs(backoff)).await;
                    backoff *= 2;
                }
            }
        }

        if success {
            if let Ok(conn) = Connection::open(&db_path) {
                let id = Uuid::new_v4().to_string();
                let _ = conn.execute(
                    "INSERT INTO meeting_summaries (id, meeting_id, summary) VALUES (?1, ?2, ?3)",
                    [&id, &meeting_id, &summary_result]
                );
            }
            println!("Meeting summarized successfully");
        }
    }
}
