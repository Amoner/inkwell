use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc::channel;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager};

pub struct FileWatcher {
    watcher: Mutex<Option<RecommendedWatcher>>,
    watched_path: Mutex<Option<String>>,
}

impl Default for FileWatcher {
    fn default() -> Self {
        Self {
            watcher: Mutex::new(None),
            watched_path: Mutex::new(None),
        }
    }
}

pub fn setup_file_watcher(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(FileWatcher::default());
    Ok(())
}

#[tauri::command]
pub async fn watch_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let fw = app.state::<FileWatcher>();

    // Stop existing watcher
    *fw.watcher.lock().unwrap() = None;
    *fw.watched_path.lock().unwrap() = None;

    let watch_path = path.clone();
    let app_handle = app.clone();

    let (tx, rx) = channel();

    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<notify::Event>| {
            if let Ok(event) = res {
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) => {
                        let _ = tx.send(());
                    }
                    _ => {}
                }
            }
        },
        notify::Config::default().with_poll_interval(Duration::from_secs(2)),
    )
    .map_err(|e| e.to_string())?;

    watcher
        .watch(
            std::path::Path::new(&watch_path),
            RecursiveMode::NonRecursive,
        )
        .map_err(|e| e.to_string())?;

    *fw.watcher.lock().unwrap() = Some(watcher);
    *fw.watched_path.lock().unwrap() = Some(path);

    // Spawn a thread to debounce and emit events
    std::thread::spawn(move || {
        loop {
            match rx.recv_timeout(Duration::from_secs(60)) {
                Ok(()) => {
                    // Debounce: drain any queued events within 500ms
                    std::thread::sleep(Duration::from_millis(500));
                    while rx.try_recv().is_ok() {}
                    let _ = app_handle.emit("file-changed-externally", ());
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn unwatch_file(app: tauri::AppHandle) -> Result<(), String> {
    let fw = app.state::<FileWatcher>();
    *fw.watcher.lock().unwrap() = None;
    *fw.watched_path.lock().unwrap() = None;
    Ok(())
}
