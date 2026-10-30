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

/// Tô thanh tiêu đề của cửa sổ cùng màu với sidebar (`color` dạng `#rrggbb`, gửi từ
/// state/themeStore.ts mỗi khi đổi theme), để thanh tiêu đề trắng của hệ điều hành không lệch
/// với nền app. Chỉ Windows 11 có API này: Windows 10 bỏ qua, macOS giữ thanh tiêu đề hệ thống.
#[tauri::command]
fn set_title_bar_color(window: tauri::WebviewWindow, color: String) {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Graphics::Dwm::{DWMWA_CAPTION_COLOR, DwmSetWindowAttribute};
        let Some(rgb) = color
            .trim()
            .strip_prefix('#')
            .filter(|hex| hex.len() == 6)
            .and_then(|hex| u32::from_str_radix(hex, 16).ok())
        else {
            return;
        };
        // COLORREF xếp kênh màu ngược: 0x00BBGGRR.
        let colorref = (rgb >> 16) | (rgb & 0xff00) | ((rgb & 0xff) << 16);
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                DwmSetWindowAttribute(
                    hwnd.0,
                    DWMWA_CAPTION_COLOR as u32,
                    (&raw const colorref).cast(),
                    size_of::<u32>() as u32,
                )
            };
        }
    }
    #[cfg(not(windows))]
    let _ = (window, color);
}

/// Thư mục chứa file của các máy trong thư mục Drive (`SYNC_SUBFOLDER` bên JS).
const SYNC_SUBFOLDER: &str = "FamilyBudget";

/// Thư mục gốc của Google Drive for Desktop trên máy này. Windows: ổ đĩa ảo (thường là G:)
/// có thư mục ẩn `.shortcut-targets-by-id` ở gốc; không dựa vào tên "My Drive" vì tên này
/// đổi theo ngôn ngữ. Chỉ xét ổ cố định để không chạm ổ đĩa quang hay thẻ nhớ đang trống.
/// macOS: `~/Library/CloudStorage/GoogleDrive-<email>`.
fn drive_roots() -> Vec<std::path::PathBuf> {
    let mut roots = Vec::new();
    #[cfg(windows)]
    {
        use windows_sys::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives};
        const DRIVE_FIXED: u32 = 3;
        let drives = unsafe { GetLogicalDrives() };
        for (bit, letter) in ('A'..='Z').enumerate() {
            if drives & (1 << bit) == 0 {
                continue;
            }
            let root = format!("{letter}:\\");
            let wide: Vec<u16> = root.encode_utf16().chain([0]).collect();
            if unsafe { GetDriveTypeW(wide.as_ptr()) } != DRIVE_FIXED {
                continue;
            }
            let root = std::path::PathBuf::from(root);
            if root.join(".shortcut-targets-by-id").is_dir() {
                roots.push(root);
            }
        }
    }
    #[cfg(target_os = "macos")]
    if let Some(home) = std::env::var_os("HOME") {
        let cloud = std::path::Path::new(&home).join("Library/CloudStorage");
        if let Ok(entries) = std::fs::read_dir(cloud) {
            roots.extend(
                entries
                    .flatten()
                    .filter(|e| e.file_name().to_string_lossy().starts_with("GoogleDrive-"))
                    .map(|e| e.path()),
            );
        }
    }
    roots
}

/// Thư mục con không ẩn của `dir`, kể cả lối tắt tới thư mục (bỏ `.shortcut-targets-by-id`,
/// `$RECYCLE.BIN`...).
fn visible_dirs(dir: &std::path::Path) -> Vec<std::path::PathBuf> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|e| {
            let name = e.file_name();
            let name = name.to_string_lossy();
            !name.starts_with('.') && !name.starts_with('$')
        })
        .map(|e| e.path())
        .filter(|path| path.is_dir())
        .collect()
}

/// Cùng mẫu với `DEVICE_FILE_RE` bên JS: `device-<id>.json` hoặc `device-<id>.enc.json`.
fn is_device_file(name: &str) -> bool {
    let Some(rest) = name
        .strip_prefix("device-")
        .and_then(|rest| rest.strip_suffix(".json"))
    else {
        return false;
    };
    let id = rest.strip_suffix(".enc").unwrap_or(rest);
    !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn has_device_files(dir: &std::path::Path) -> bool {
    std::fs::read_dir(dir).is_ok_and(|entries| {
        entries
            .flatten()
            .any(|e| is_device_file(&e.file_name().to_string_lossy()))
    })
}

/// Thư mục FamilyBudget có file của ít nhất một máy, nằm trong Drive tối đa 2 cấp:
/// `My Drive/FamilyBudget`, `My Drive/<thư mục>/FamilyBudget` (kể cả lối tắt tới thư mục
/// được chia sẻ), `Shared drives/<ổ>/FamilyBudget`. Không tìm sâu hơn để khỏi duyệt cả Drive.
fn find_data_dirs(roots: &[std::path::PathBuf]) -> Vec<std::path::PathBuf> {
    let mut found = Vec::new();
    for root in roots {
        for top in visible_dirs(root) {
            let children = visible_dirs(&top);
            for dir in std::iter::once(top).chain(children) {
                let data_dir = dir.join(SYNC_SUBFOLDER);
                if has_device_files(&data_dir) && !found.contains(&data_dir) {
                    found.push(data_dir);
                }
            }
        }
    }
    found
}

/// Máy mới cài: tìm sẵn dữ liệu gia đình trong Google Drive để màn thiết lập hiện luôn hai
/// người dùng, khỏi phải tự chọn thư mục. Thư mục tìm được được cấp quyền đọc ghi cho app
/// như khi chọn qua hộp chọn thư mục, và plugin persisted-scope giữ quyền đó khi mở lại app.
#[tauri::command]
async fn find_sync_folders(app: tauri::AppHandle) -> Vec<String> {
    use tauri_plugin_fs::FsExt;
    let dirs = tauri::async_runtime::spawn_blocking(|| find_data_dirs(&drive_roots()))
        .await
        .unwrap_or_default();
    dirs.into_iter()
        .filter(|dir| app.fs_scope().allow_directory(dir, true).is_ok())
        .map(|dir| dir.to_string_lossy().into_owned())
        .collect()
}

/// Cửa sổ chính mở ẩn (tauri.conf.json → "visible": false) để kịp đặt lại kích thước lần trước
/// mà không nháy cỡ mặc định. Cỡ đã lưu có thể lớn hơn màn hình đang dùng (lần trước mở trên
/// màn hình ngoài) nên thu lại cho vừa. Căn giữa trước khi phóng to để lúc thu nhỏ lại, cửa sổ
/// cũng nằm giữa màn hình.
fn show_main_window(app: &tauri::App) -> tauri::Result<()> {
    use tauri::Manager;
    use tauri_plugin_window_state::{StateFlags, WindowExt};
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    window.restore_state(StateFlags::SIZE)?;
    if let Some(monitor) = window.current_monitor()? {
        let area = monitor.work_area().size;
        let inner = window.inner_size()?;
        let outer = window.outer_size()?;
        let width = inner
            .width
            .min(area.width.saturating_sub(outer.width - inner.width));
        let height = inner
            .height
            .min(area.height.saturating_sub(outer.height - inner.height));
        if (width, height) != (inner.width, inner.height) {
            window.set_size(tauri::PhysicalSize::new(width, height))?;
        }
    }
    window.center()?;
    window.restore_state(StateFlags::MAXIMIZED)?;
    window.show()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_window_state::StateFlags;
    tauri::Builder::default()
        // persisted-scope phải đăng ký sau fs, nếu không quyền truy cập thư mục Drive
        // đã chọn sẽ không được khôi phục khi mở lại app.
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        // Cập nhật app (SPEC mục 9): kiểm tra, tải, cài bản mới rồi khởi động lại.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Nhớ kích thước cửa sổ (và trạng thái phóng to) của lần mở trước; vị trí thì không,
        // cửa sổ luôn mở giữa màn hình. Cửa sổ chính được đặt lại trong show_main_window.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::SIZE | StateFlags::MAXIMIZED)
                .skip_initial_state("main")
                .build(),
        )
        .setup(|app| Ok(show_main_window(app)?))
        .invoke_handler(tauri::generate_handler![
            show_emoji_panel,
            set_title_bar_color,
            find_sync_folders
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
