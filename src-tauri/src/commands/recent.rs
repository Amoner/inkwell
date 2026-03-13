use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
}

const STORE_KEY: &str = "recent_files";
const MAX_RECENT: usize = 20;

#[tauri::command]
pub async fn get_recent_files(app: tauri::AppHandle) -> Result<Vec<RecentFile>, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let files: Vec<RecentFile> = store
        .get(STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    Ok(files)
}

#[tauri::command]
pub async fn add_recent_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    let name = std::path::Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let mut files: Vec<RecentFile> = store
        .get(STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    // Remove duplicate if exists
    files.retain(|f| f.path != path);

    // Add to front
    files.insert(0, RecentFile { path, name });

    // Trim to max
    files.truncate(MAX_RECENT);

    store.set(
        STORE_KEY,
        serde_json::to_value(&files).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn clear_recent_files(app: tauri::AppHandle) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set(
        STORE_KEY,
        serde_json::to_value::<Vec<RecentFile>>(vec![]).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
