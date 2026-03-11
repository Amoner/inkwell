mod commands;
mod menu;
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
            #[cfg(desktop)]
            platform::desktop::watch_file,
            #[cfg(desktop)]
            platform::desktop::unwatch_file,
        ]);

    builder = builder.setup(|app| {
        #[cfg(desktop)]
        {
            menu::setup_menu(app)?;
            platform::desktop::setup_file_watcher(app)?;
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
