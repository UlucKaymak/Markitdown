use tauri::{WebviewWindow, Manager, Emitter};
use std::env;
use std::sync::Mutex;

struct PendingFile(Mutex<Option<String>>);

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

#[tauri::command]
fn get_pending_file(state: tauri::State<'_, PendingFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PendingFile(Mutex::new(None)))
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.len() > 1 {
                let path = args[1].clone();
                if std::path::Path::new(&path).exists() {
                    let _ = app.emit("open-file", path);
                }
            }
            let _ = app
                .get_webview_window("main")
                .map(|w| {
                    let _ = w.show();
                    let _ = w.set_focus();
                });
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Handle initial arguments
            let args: Vec<String> = env::args().collect();
            println!("App started with args: {:?}", args);
            
            if args.len() > 1 {
                let path = args[1].clone();
                if std::path::Path::new(&path).exists() {
                    // Store for the get_pending_file command
                    let state = app.state::<PendingFile>();
                    *state.0.lock().unwrap() = Some(path.clone());
                    
                    // Also try emitting just in case the frontend is already listening
                    let app_handle = app.handle().clone();
                    tauri::async_runtime::spawn(async move {
                        std::thread::sleep(std::time::Duration::from_millis(1500));
                        let _ = app_handle.emit("open-file", path);
                    });
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, clear_cache_and_reload, get_pending_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
