use tauri::WebviewWindow;

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
        .invoke_handler(tauri::generate_handler![greet, clear_cache_and_reload])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
