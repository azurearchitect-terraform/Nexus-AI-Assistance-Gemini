use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MemoryResult {
    pub source: String, // "document" or "meeting"
    pub title: String,
    pub content: String,
}

fn get_db_path(app: &AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap().join("nexus-ai.db")
}

#[tauri::command]
pub fn upload_document(app: AppHandle, title: String, content: String) -> Result<String, String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO knowledge_base (id, title, content) VALUES (?1, ?2, ?3)",
        [&id, &title, &content],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub fn get_documents(app: AppHandle) -> Result<Vec<Document>, String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, title, content, created_at FROM knowledge_base ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let doc_iter = stmt
        .query_map([], |row| {
            Ok(Document {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut docs = Vec::new();
    for doc in doc_iter {
        if let Ok(d) = doc {
            docs.push(d);
        }
    }

    Ok(docs)
}

#[tauri::command]
pub fn delete_document(app: AppHandle, id: String) -> Result<(), String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM knowledge_base WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn search_memory(app: AppHandle, query: String) -> Result<Vec<MemoryResult>, String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    // 1. Search knowledge base
    if let Ok(mut stmt) = conn.prepare(
        "SELECT title, content FROM knowledge_base_fts WHERE knowledge_base_fts MATCH ?1 ORDER BY rank LIMIT 3"
    ) {
        if let Ok(rows) = stmt.query_map([&query], |row| {
            Ok(MemoryResult {
                source: "document".to_string(),
                title: row.get(0)?,
                content: row.get(1)?,
            })
        }) {
            for row in rows.flatten() {
                results.push(row);
            }
        }
    }

    // 2. Search past meetings
    if let Ok(mut stmt) = conn.prepare(
        "SELECT meeting_id, summary FROM meeting_summaries_fts WHERE meeting_summaries_fts MATCH ?1 ORDER BY rank LIMIT 3"
    ) {
        if let Ok(rows) = stmt.query_map([&query], |row| {
            Ok(MemoryResult {
                source: "meeting".to_string(),
                title: format!("Past Meeting ({})", row.get::<_, String>(0)?),
                content: row.get(1)?,
            })
        }) {
            for row in rows.flatten() {
                results.push(row);
            }
        }
    }

    Ok(results)
}
