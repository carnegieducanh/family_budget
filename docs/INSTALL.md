# Cài đặt Family Budget

Tài liệu gồm hai phần: cài môi trường để phát triển và build app, và cài app cho người dùng trên 2 máy (phần file cài đặt bổ sung ở giai đoạn 4).

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

Hai máy đồng bộ với nhau qua một thư mục Google Drive: mỗi máy ghi một file của riêng mình vào thư mục đó và đọc file của máy kia. App không đăng nhập Google; việc đưa file lên mạng và tải về máy kia do app Google Drive for Desktop đảm nhận.

Phần file cài đặt và cảnh báo Gatekeeper (macOS), SmartScreen (Windows) sẽ bổ sung ở giai đoạn 4.

### 2.1. Chuẩn bị thư mục Google Drive

1. **Cài Google Drive for Desktop trên cả 2 máy** (tải tại [google.com/drive/download](https://www.google.com/drive/download/)) và đăng nhập tài khoản Google.

   Sau khi cài, Google Drive hiện như một ổ đĩa:

   - Windows: ổ ảo, thường là `G:\My Drive` (`G:\Drive của tôi` nếu Google Drive dùng tiếng Việt; chữ ổ có thể khác).
   - macOS: mục **Google Drive** ở thanh bên trái của Finder, nằm tại `~/Library/CloudStorage/GoogleDrive-<email>/My Drive`.

2. **Tạo thư mục dùng chung** (làm trên máy admin), ví dụ `Family Budget` trong "My Drive".

   - **Hai người dùng chung một tài khoản Google:** không cần làm gì thêm, cả hai máy đều thấy thư mục này.
   - **Hai tài khoản Google khác nhau:** trên [drive.google.com](https://drive.google.com), admin chia sẻ thư mục `Family Budget` cho tài khoản của người kia với quyền **Người chỉnh sửa**. Người kia mở mục **Được chia sẻ với tôi**, chuột phải vào thư mục, chọn **Sắp xếp → Thêm lối tắt** (hoặc "Thêm lối tắt vào Drive"), rồi đặt lối tắt trong "Drive của tôi". Lối tắt hiện ra như một thư mục bình thường trong ổ Google Drive trên máy.

3. **Bật "Có sẵn ngoại tuyến" cho thư mục này trên cả 2 máy:** trong File Explorer (Windows) hoặc Finder (macOS), chuột phải vào thư mục → mục Google Drive → **Có sẵn ngoại tuyến** (Available offline). Nhờ vậy app đọc ghi được ngay cả khi mất mạng; Google Drive sẽ đồng bộ khi có mạng lại.

Không tự sửa, đổi tên hay xóa các file trong thư mục `FamilyBudget` mà app tạo ra.

### 2.2. Thiết lập lần đầu

1. **Máy admin:** mở app → **Tạo dữ liệu mới (admin)** → nhập tên của mình và tên người còn lại → **Chọn thư mục...** và chọn thư mục `Family Budget` ở bước 2.1 → **Tạo dữ liệu**.

   App tạo thư mục con `FamilyBudget` bên trong và ghi file `device-<mã máy>.json`. Góc dưới bên trái hiện "Chưa thấy dữ liệu từ máy kia" là bình thường ở bước này.

2. Chờ Google Drive tải file lên (biểu tượng Google Drive trên khay hệ thống / thanh menu báo đã đồng bộ xong).

3. **Máy thứ hai:** mở app → **Tham gia (máy thứ hai)** → **Chọn thư mục...** và chọn đúng thư mục đó (hoặc lối tắt, nếu dùng 2 tài khoản) → chọn **Tôi là ...**.

   Nếu app báo "Chưa thấy dữ liệu trong thư mục này", Google Drive trên máy này chưa tải file của máy admin về: chờ một lúc rồi chọn lại thư mục.

App không cho tạo dữ liệu mới trong thư mục đã có dữ liệu Family Budget, để tránh hai bộ dữ liệu song song.

Máy đã dùng app từ trước khi có đồng bộ (dữ liệu chỉ nằm trên máy): vào **Cài đặt → Đồng bộ qua Google Drive → Chọn thư mục...**, không cần thiết lập lại.

### 2.3. Đồng bộ hoạt động thế nào

App đồng bộ khi mở app, định kỳ mỗi 5 phút (đổi trong Cài đặt), khi quay lại cửa sổ app, và 10 giây sau mỗi lần thêm, sửa, xóa. Cộng thêm thời gian Google Drive chuyển file giữa 2 máy (thường vài giây đến vài phút), một khoản thêm ở máy này sẽ hiện ở máy kia sau vài phút. Bấm **Sync ngay** ở góc dưới bên trái để đồng bộ ngay.

Khi hai máy cùng sửa một khoản, bản sửa sau cùng được giữ. Khoản đã xóa ở một máy cũng biến mất ở máy kia. Trước mỗi lần nhận dữ liệu từ máy kia làm thay đổi dữ liệu, app tự lưu một bản backup trên máy (đường dẫn ở **Cài đặt → Máy này**).

### 2.4. Xử lý sự cố đồng bộ

| Thông báo                                       | Nguyên nhân thường gặp                                                 | Cách xử lý                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Chưa kết nối thư mục Drive                      | Máy này chưa chọn thư mục                                              | Cài đặt → Chọn thư mục...                                                                                                    |
| Lỗi: không tìm thấy thư mục Drive               | Google Drive for Desktop chưa chạy, hoặc thư mục bị đổi tên, di chuyển | Mở Google Drive for Desktop; nếu thư mục đã đổi chỗ, chọn lại trong Cài đặt                                                  |
| Chưa thấy dữ liệu từ máy kia                    | Máy kia chưa mở app, hoặc Google Drive chưa tải file của máy kia về    | Mở app ở máy kia; xem mục "Máy khác" trong Cài đặt để biết lần cuối máy kia ghi dữ liệu                                      |
| Bỏ qua 1 file lỗi                               | Thường do Google Drive đang tải dở file của máy kia                    | Tự hết ở lượt đồng bộ sau; dữ liệu trên máy không bị ảnh hưởng                                                               |
| Máy kia đang dùng bản mới hơn, hãy cập nhật app | Máy kia đã cập nhật app, dữ liệu có cấu trúc mới                       | Cập nhật app trên máy này; đồng bộ tạm dừng đến khi cập nhật                                                                 |
| Giờ trên hai máy lệch nhau                      | Đồng hồ một máy chạy sai hơn 5 phút                                    | Bật đặt giờ tự động trên cả hai máy (Windows: Cài đặt → Thời gian và ngôn ngữ; macOS: Cài đặt hệ thống → Chung → Ngày & Giờ) |
| Lần sync thành công cuối: … (màu vàng)          | Đã hơn 1 giờ chưa đồng bộ được                                         | Xem thông báo lỗi đi kèm, hoặc bấm Sync ngay                                                                                 |
