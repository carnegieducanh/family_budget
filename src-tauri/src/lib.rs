#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // persisted-scope phải đăng ký sau fs, nếu không quyền truy cập thư mục Drive
        // đã chọn sẽ không được khôi phục khi mở lại app.
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        // Cập nhật app (SPEC mục 9): kiểm tra, tải, cài bản mới rồi khởi động lại.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
