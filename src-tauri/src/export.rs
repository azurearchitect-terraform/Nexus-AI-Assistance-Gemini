use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use chrono::Local;

#[tauri::command]
pub async fn export_summary(
    app: AppHandle,
    summary: String,
    title: Option<String>,
) -> Result<String, String> {
    // 1. Get the Documents directory
    let docs_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to get Documents directory: {}", e))?;

    // 2. Create the specific folder for summaries
    let summaries_dir = docs_dir.join("Nexus-Summaries");
    if !summaries_dir.exists() {
        fs::create_dir_all(&summaries_dir)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    // 3. Generate a safe filename using timestamp and optional title
    let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let safe_title = match title {
        Some(t) if !t.is_empty() => {
            // Sanitize title for filename
            t.chars()
                .map(|c| if c.is_alphanumeric() || c == ' ' { c } else { '_' })
                .collect::<String>()
                .replace(" ", "-")
        }
        _ => "Meeting_Summary".to_string(),
    };

    let filename = format!("{}_{}.md", safe_title, timestamp);
    let file_path = summaries_dir.join(filename);

    // 4. Write to file
    fs::write(&file_path, summary).map_err(|e| format!("Failed to write file: {}", e))?;

    // Return the absolute path of the created file
    Ok(file_path.to_string_lossy().to_string())
}
