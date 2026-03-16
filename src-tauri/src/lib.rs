mod commands;

#[cfg(desktop)]
mod platform;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

/// Stores file paths received via macOS Apple Events (RunEvent::Opened)
/// before the frontend is ready to handle them.
pub struct PendingOpenFiles(pub Mutex<Vec<String>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(PendingOpenFiles(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            commands::file_ops::read_file,
            commands::file_ops::write_file,
            commands::file_ops::get_file_size,
            commands::dialog::pick_open_file,
            commands::dialog::pick_save_file,
            commands::dialog::confirm_discard,
            commands::recent::get_recent_files,
            commands::recent::add_recent_file,
            commands::recent::clear_recent_files,
            commands::file_ops::get_open_file_arg,
            commands::file_ops::get_pending_open_file,
            #[cfg(desktop)]
            platform::desktop::watch_file,
            #[cfg(desktop)]
            platform::desktop::unwatch_file,
        ]);

    builder = builder.setup(|app| {
        #[cfg(desktop)]
        {
            platform::desktop::setup_file_watcher(app)?;
        }

        Ok(())
    });

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder
        .build(tauri::generate_context!())
        .expect("error building Inkwell")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter_map(|p| p.to_str().map(String::from))
                    .collect();

                if paths.is_empty() {
                    return;
                }

                // Try to emit to frontend (works when app is already running).
                // Also store in state for cold-launch (frontend polls on init).
                let state = app_handle.state::<PendingOpenFiles>();
                let mut pending = state.0.lock().unwrap();
                for path in &paths {
                    pending.push(path.clone());
                    let _ = app_handle.emit("open-file-requested", path.clone());
                }
            }
        });
}
