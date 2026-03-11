use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

#[tauri::command]
pub async fn pick_open_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "mdown", "mkd", "mkdn", "txt"])
        .blocking_pick_file();

    Ok(file.map(|f| f.to_string()))
}

#[tauri::command]
pub async fn pick_save_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown"])
        .set_file_name("untitled.md")
        .blocking_save_file();

    Ok(file.map(|f| f.to_string()))
}

#[tauri::command]
pub async fn confirm_discard(app: tauri::AppHandle) -> Result<bool, String> {
    let confirmed = app
        .dialog()
        .message("You have unsaved changes. Do you want to discard them?")
        .title("Unsaved Changes")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Discard".to_string(),
            "Cancel".to_string(),
        ))
        .blocking_show();

    Ok(confirmed)
}
