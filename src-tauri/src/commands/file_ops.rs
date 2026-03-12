use std::fs;

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub async fn get_file_size(path: String) -> Result<u64, String> {
    fs::metadata(&path)
        .map(|m| m.len())
        .map_err(|e| format!("Failed to get file size: {}", e))
}

/// Returns the file path passed as a CLI argument (for file associations), if any.
#[tauri::command]
pub async fn get_open_file_arg() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    args.get(1).and_then(|arg| {
        let path = std::path::Path::new(arg);
        if path.exists() && !arg.starts_with('-') {
            Some(arg.clone())
        } else {
            None
        }
    })
}
