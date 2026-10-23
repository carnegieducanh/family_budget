# Cài đặt Family Budget

Tài liệu gồm hai phần: cài môi trường để phát triển và build app (giai đoạn 0), và cài app cho người dùng trên 2 máy (bổ sung ở giai đoạn 2 và 4).

## 1. Môi trường phát triển

Phiên bản đã dùng khi khởi tạo project (10/2026): Node.js 22, Rust 1.96 stable, Tauri 2, Vite 8.

Yêu cầu chung:

- **Node.js** 20.19 trở lên hoặc 22.12 trở lên (Vite 8 yêu cầu). Khuyên dùng bản LTS.
- **Rust** stable, cài qua `rustup`.
- **Git**.

### 1.1. Windows 11

1. **Microsoft C++ Build Tools (MSVC)**

   Tải [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), khi cài chọn workload **"Desktop development with C++"** (đã gồm MSVC và Windows 11 SDK). Nếu máy đã có Visual Studio 2022 với workload này thì bỏ qua.

   Hoặc cài bằng `winget` trong PowerShell:

   ```powershell
   winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
   ```

2. **WebView2**: Windows 11 có sẵn, không cần cài. Nếu từng gỡ đi, tải "Evergreen Bootstrapper" tại trang [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

3. **Rust**

   ```powershell
   winget install --id Rustlang.Rustup
   ```

   Mở terminal mới rồi đặt toolchain MSVC làm mặc định:

   ```powershell
   rustup default stable-msvc
   rustc -V
   cargo -V
   ```

4. **Node.js và Git**

   ```powershell
   winget install --id OpenJS.NodeJS.LTS
   winget install --id Git.Git
   ```

5. **Chạy project**

   ```powershell
   git clone <url-repo> family-budget
   cd family-budget
   npm install
   npm run tauri dev
   ```

   Lần chạy đầu Cargo phải biên dịch toàn bộ thư viện Rust nên mất vài phút; các lần sau chỉ vài giây.

### 1.2. macOS (Apple Silicon M1)

1. **Xcode Command Line Tools**

   ```bash
   xcode-select --install
   ```

2. **Rust** (tự nhận host `aarch64-apple-darwin`)

   ```bash
   curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
   source "$HOME/.cargo/env"
   rustc -V
   ```

3. **Node.js**: cài bản LTS từ [nodejs.org](https://nodejs.org/) hoặc `brew install node@22`.

4. **Chạy project**

   ```bash
   git clone <url-repo> family-budget
   cd family-budget
   npm install
   npm run tauri dev
   ```

### 1.3. Lỗi thường gặp

- **`Port 1420 is already in use`**: còn một tiến trình `vite` cũ đang chạy. Tắt nó (hoặc tắt terminal cũ) rồi chạy lại. Tauri cần đúng cổng 1420 nên Vite không tự đổi cổng.
- **Windows: `linker 'link.exe' not found`**: chưa cài workload "Desktop development with C++" (bước 1.1.1), hoặc toolchain Rust không phải bản `msvc`. Kiểm tra bằng `rustup show`.
- **macOS: `xcrun: error: invalid active developer path`**: chưa cài Xcode Command Line Tools (bước 1.2.1).

## 2. Cài app cho người dùng

Sẽ bổ sung ở giai đoạn 2 (chuẩn bị thư mục Google Drive, thiết lập lần đầu) và giai đoạn 4 (file cài đặt, xử lý cảnh báo Gatekeeper trên macOS và SmartScreen trên Windows).
