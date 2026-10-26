/// Mở bảng emoji của hệ điều hành; emoji chọn được chèn vào ô nhập đang có focus
/// (ô icon ở màn Danh mục). Windows: như bấm Win + . ; macOS: cửa sổ Emoji & Symbols.
#[tauri::command]
fn show_emoji_panel(app: tauri::AppHandle) {
    #[cfg(windows)]
    {
        // Không có API mở bảng emoji cho app Win32: giả lập phím Win + . như Chromium.
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, SendInput, VK_LWIN,
            VK_OEM_PERIOD,
        };
        let _ = app;
        let key = |vk, flags| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        let inputs = [
            key(VK_LWIN, 0),
            key(VK_OEM_PERIOD, 0),
            key(VK_OEM_PERIOD, KEYEVENTF_KEYUP),
            key(VK_LWIN, KEYEVENTF_KEYUP),
        ];
        unsafe {
            SendInput(
                inputs.len() as u32,
                inputs.as_ptr(),
                size_of::<INPUT>() as i32,
            )
        };
    }
    #[cfg(target_os = "macos")]
    {
        // AppKit chỉ gọi được trên main thread.
        let _ = app.run_on_main_thread(|| {
            if let Some(mtm) = objc2::MainThreadMarker::new() {
                objc2_app_kit::NSApplication::sharedApplication(mtm)
                    .orderFrontCharacterPalette(None);
            }
        });
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    let _ = app;
}

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
        .invoke_handler(tauri::generate_handler![show_emoji_panel])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
