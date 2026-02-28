use tauri::{WebviewWindow, Manager, Emitter};
use std::env;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn clear_cache_and_reload(window: WebviewWindow) {
    let _ = window.clear_all_browsing_data();
    let _ = window.reload();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Handle initial arguments
            let args: Vec<String> = env::args().collect();
            if args.len() > 1 {
                let path = args[1].clone();
                if std::path::Path::new(&path).exists() {
                    let app_handle = app.handle().clone();
                    // Small delay to ensure frontend is ready to listen
                    tauri::async_runtime::spawn(async move {
                        std::thread::sleep(std::time::Duration::from_millis(1000));
                        let _ = app_handle.emit("open-file", path);
                    });
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, clear_cache_and_reload])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
