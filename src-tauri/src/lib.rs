use tauri::Emitter;

mod commands;
mod state;

#[cfg(desktop)]
mod platform;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .manage(state::AppState::default())
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

        // Check if a file was passed as a CLI argument (file association / "Open With")
        let args: Vec<String> = std::env::args().collect();
        if let Some(file_path) = args.get(1) {
            let path = std::path::Path::new(file_path);
            if path.exists() && !file_path.starts_with('-') {
                let file_path = file_path.clone();
                let handle = app.handle().clone();
                // Emit after frontend is ready (small delay)
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let _ = handle.emit("open-file", file_path);
                });
            }
        }

        Ok(())
    });

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder = builder.on_window_event(|_window, event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            let _ = api;
        }
    });

    builder
        .run(tauri::generate_context!())
        .expect("error running Inkwell");
}
