# Cài đặt Family Budget

Tài liệu gồm ba phần: cài môi trường để phát triển và build app (mục 1), cài app cho người dùng trên 2 máy (mục 2), và phát hành bản mới qua GitHub (mục 3). Người dùng chỉ cần đọc mục 2.

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

Làm lần lượt: cài app trên cả 2 máy (2.1), chuẩn bị thư mục Google Drive (2.2), rồi thiết lập lần đầu, máy admin trước, máy thứ hai sau (2.3). Mã hóa (2.4) là tùy chọn.

### 2.1. Tải và cài app

File cài đặt nằm ở trang [github.com/carnegieducanh/family_budget/releases/latest](https://github.com/carnegieducanh/family_budget/releases/latest), mục **Assets**. App chưa được ký bằng chứng chỉ của Microsoft hay Apple (tốn phí hằng năm), nên lần cài đầu Windows và macOS sẽ cảnh báo; làm theo các bước dưới đây. Các lần cập nhật sau (mục 2.6) không bị cảnh báo nữa.

**Windows 11**

1. Tải file có đuôi `_x64-setup.exe`, mở file đó.
2. Nếu hiện màn hình xanh **"Windows đã bảo vệ PC của bạn"** (Windows protected your PC): bấm **Thông tin thêm** (More info) → **Vẫn chạy** (Run anyway).
3. Trình cài đặt chỉ cài cho tài khoản Windows đang dùng, không cần quyền quản trị. Cài xong, mở **Family Budget** từ Start Menu.

Nếu Windows báo **"Smart App Control đã chặn"** và không có nút "Vẫn chạy": máy đang bật Smart App Control, tính năng này chặn mọi app chưa ký. Chỉ tắt được trong **Bảo mật Windows → Kiểm soát ứng dụng và trình duyệt → Cài đặt Smart App Control → Tắt**, và đã tắt thì không bật lại được nếu không cài lại Windows; cân nhắc trước khi tắt.

**macOS (Apple Silicon M1 trở lên)**

1. Tải file có đuôi `_aarch64.dmg`, mở file, kéo **Family Budget** vào thư mục **Applications**.
2. Lần đầu mở: trong Finder, vào Applications, **chuột phải (hoặc Control + bấm) vào Family Budget → Mở → Mở**.

   Trên macOS 15 (Sequoia) trở lên, menu này không còn nút "Mở": bấm **Xong**, rồi vào **Cài đặt hệ thống → Quyền riêng tư & Bảo mật**, kéo xuống mục **Bảo mật**, bấm **Vẫn mở** (Open Anyway) cạnh dòng nói về Family Budget, nhập mật khẩu máy và bấm **Mở**.

3. Nếu macOS báo **"Family Budget bị hỏng và không thể mở được"** (is damaged and can't be opened): đây là dấu "tải từ Internet" của macOS chặn app chưa đăng ký với Apple, không phải file hỏng. Mở **Terminal** (Ứng dụng → Tiện ích) và chạy một lần:

   ```bash
   xattr -cr "/Applications/Family Budget.app"
   ```

   rồi mở lại app.

**Gỡ app:** Windows: Cài đặt → Ứng dụng → Family Budget → Gỡ cài đặt. Trong hộp gỡ cài đặt, **không tích ô "Delete the application data"** nếu muốn giữ dữ liệu trên máy (data.json và các bản backup). macOS: kéo app từ Applications vào Thùng rác; dữ liệu vẫn nằm ở `~/Library/Application Support/com.familybudget.desktop`.

### 2.2. Chuẩn bị thư mục Google Drive

1. **Cài Google Drive for Desktop trên cả 2 máy** (tải tại [google.com/drive/download](https://www.google.com/drive/download/)) và đăng nhập tài khoản Google.

   Sau khi cài, Google Drive hiện như một ổ đĩa:

   - Windows: ổ ảo, thường là `G:\My Drive` (`G:\Drive của tôi` nếu Google Drive dùng tiếng Việt; chữ ổ có thể khác).
   - macOS: mục **Google Drive** ở thanh bên trái của Finder, nằm tại `~/Library/CloudStorage/GoogleDrive-<email>/My Drive`.

2. **Tạo thư mục dùng chung** (làm trên máy admin), ví dụ `Family Budget` trong "My Drive".

   - **Hai người dùng chung một tài khoản Google:** không cần làm gì thêm, cả hai máy đều thấy thư mục này.
   - **Hai tài khoản Google khác nhau:** trên [drive.google.com](https://drive.google.com), admin chia sẻ thư mục `Family Budget` cho tài khoản của người kia với quyền **Người chỉnh sửa**. Người kia mở mục **Được chia sẻ với tôi**, chuột phải vào thư mục, chọn **Sắp xếp → Thêm lối tắt** (hoặc "Thêm lối tắt vào Drive"), rồi đặt lối tắt trong "Drive của tôi". Lối tắt hiện ra như một thư mục bình thường trong ổ Google Drive trên máy.

3. **Bật "Có sẵn ngoại tuyến" cho thư mục này trên cả 2 máy:** trong File Explorer (Windows) hoặc Finder (macOS), chuột phải vào thư mục → mục Google Drive → **Có sẵn ngoại tuyến** (Available offline). Nhờ vậy app đọc ghi được ngay cả khi mất mạng; Google Drive sẽ đồng bộ khi có mạng lại.

Không tự sửa, đổi tên hay xóa các file trong thư mục `FamilyBudget` mà app tạo ra.

macOS có thể hỏi "Family Budget muốn truy cập tệp trong Google Drive" ở lần đầu chọn thư mục: bấm **Cho phép**.

### 2.3. Thiết lập lần đầu

1. **Máy admin:** mở app → **Tạo dữ liệu mới (admin)** → nhập tên của mình và tên người còn lại → chọn ảnh đại diện (**Chọn ảnh từ máy...** hoặc một emoji) → **Chọn thư mục...** và chọn thư mục `Family Budget` ở bước 2.2 → **Tạo dữ liệu**.

   App tạo thư mục con `FamilyBudget` bên trong và ghi file `device-<mã máy>.json`. Góc dưới bên trái hiện "Chưa thấy dữ liệu từ máy kia" là bình thường ở bước này.

2. Chờ Google Drive tải file lên (biểu tượng Google Drive trên khay hệ thống / thanh menu báo đã đồng bộ xong).

3. **Máy thứ hai:** mở app → **Tham gia (máy thứ hai)** → **Chọn thư mục...** và chọn đúng thư mục đó (hoặc lối tắt, nếu dùng 2 tài khoản) → chọn **Tôi là ...** → chọn ảnh đại diện → **Hoàn tất**.

   Nếu admin đã bật mã hóa (mục 2.4), app hỏi **Mật khẩu mã hóa** trước: nhập mật khẩu admin đã đặt → **Mở khóa dữ liệu**.

   Nếu app báo "Chưa thấy dữ liệu trong thư mục này", Google Drive trên máy này chưa tải file của máy admin về: chờ một lúc rồi chọn lại thư mục.

App không cho tạo dữ liệu mới trong thư mục đã có dữ liệu Family Budget, để tránh hai bộ dữ liệu song song.

Máy đã dùng app từ trước khi có đồng bộ (dữ liệu chỉ nằm trên máy): vào **Cài đặt → Đồng bộ qua Google Drive → Chọn thư mục...**, không cần thiết lập lại.

### 2.4. Mã hóa dữ liệu trên Drive (tùy chọn)

Khi bật, file của mỗi máy trên Google Drive được mã hóa (AES-GCM 256 bit) bằng một mật khẩu chung: ai mở được thư mục Drive cũng không đọc được nội dung. Dữ liệu trên từng máy (data.json, backup) vẫn ở dạng thường.

1. **Máy admin:** **Cài đặt → Mã hóa dữ liệu trên Drive → Bật mã hóa...** → đặt mật khẩu (ít nhất 8 ký tự), nhập lại → **Bật mã hóa**. App mất vài giây để tạo khóa, rồi ghi lại file của máy admin thành `device-<mã máy>.enc.json` và xóa file dạng thường cũ.
2. **Máy thứ hai:** khi Google Drive đã tải file mới của máy admin về, app hiện "Máy kia đã mã hóa dữ liệu trên Drive..." → **Mở Cài đặt → Nhập mật khẩu chung...** → nhập đúng mật khẩu đó → **Lưu mật khẩu**. Từ đây file của máy thứ hai cũng được mã hóa.

   Trong lúc máy thứ hai chưa nhập mật khẩu, máy admin vẫn nhận dữ liệu của máy thứ hai, nhưng máy thứ hai không nhận được dữ liệu của máy admin, và file của máy thứ hai trên Drive vẫn chưa mã hóa (thẻ Mã hóa trên máy admin có báo).

Mỗi máy chỉ lưu khóa tạo ra từ mật khẩu (trong `settings.json` trên máy), không lưu mật khẩu, và không hỏi lại mật khẩu khi mở app.

- **Quên mật khẩu:** hai máy vẫn đồng bộ bình thường vì đã lưu khóa. Chỉ khi cài lại app hoặc thêm máy mới mới cần mật khẩu; lúc đó admin bấm **Đổi mật khẩu...** để đặt mật khẩu mới, rồi nhập mật khẩu mới ở máy kia. Nếu máy admin cũng mất khóa (cài lại app) thì file trên Drive không đọc được nữa, nhưng dữ liệu trên máy vẫn còn: admin đặt mật khẩu mới là đồng bộ lại được.
- **Đổi mật khẩu:** máy kia báo "Không giải mã được dữ liệu từ máy kia, kiểm tra mật khẩu" cho tới khi nhập mật khẩu mới.
- **Tắt mã hóa:** máy admin ghi lại file của mình ở dạng thường. Máy thứ hai vẫn ghi file mã hóa; máy admin vẫn đọc được vì còn giữ khóa.
- File dạng thường cũ bị xóa nằm trong **Thùng rác** của Google Drive 30 ngày; muốn xóa hẳn ngay thì dọn Thùng rác trên [drive.google.com](https://drive.google.com).

### 2.5. Đồng bộ hoạt động thế nào

App đồng bộ khi mở app, định kỳ mỗi 5 phút (đổi trong Cài đặt), khi quay lại cửa sổ app, và 10 giây sau mỗi lần thêm, sửa, xóa. Cộng thêm thời gian Google Drive chuyển file giữa 2 máy (thường vài giây đến vài phút), một khoản thêm ở máy này sẽ hiện ở máy kia sau vài phút. Bấm **Sync ngay** ở góc dưới bên trái để đồng bộ ngay.

Khi hai máy cùng sửa một khoản, bản sửa sau cùng được giữ. Khoản đã xóa ở một máy cũng biến mất ở máy kia. Trước mỗi lần nhận dữ liệu từ máy kia làm thay đổi dữ liệu, app tự lưu một bản backup trên máy (đường dẫn ở **Cài đặt → Máy này**).

### 2.6. Cập nhật app

App tự kiểm tra bản mới khi mở và mỗi 24 giờ. Có bản mới thì hiện banner **"Có phiên bản x.y.z"** ở trên cùng, kèm ghi chú thay đổi. App không tự cài: bấm **Cập nhật** để tải, cài và khởi động lại (Windows hiện cửa sổ tiến trình cài đặt, không cần bấm gì thêm), hoặc **Để sau** để ẩn banner đến lần mở app sau. Kiểm tra ngay: **Cài đặt → Phiên bản app → Kiểm tra cập nhật**.

Dữ liệu trên máy không bị ảnh hưởng khi cập nhật. Nên cập nhật cả 2 máy cùng lúc: nếu bản mới đổi cấu trúc dữ liệu, máy chưa cập nhật sẽ tạm dừng đồng bộ và báo "Máy kia đang dùng bản mới hơn, hãy cập nhật app".

### 2.7. Xử lý sự cố

| Thông báo                                                | Nguyên nhân thường gặp                                                 | Cách xử lý                                                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Chưa kết nối thư mục Drive                               | Máy này chưa chọn thư mục                                              | Cài đặt → Chọn thư mục...                                                                                                    |
| Lỗi: không tìm thấy thư mục Drive                        | Google Drive for Desktop chưa chạy, hoặc thư mục bị đổi tên, di chuyển | Mở Google Drive for Desktop; nếu thư mục đã đổi chỗ, chọn lại trong Cài đặt                                                  |
| Chưa thấy dữ liệu từ máy kia                             | Máy kia chưa mở app, hoặc Google Drive chưa tải file của máy kia về    | Mở app ở máy kia; xem mục "Máy khác" trong Cài đặt để biết lần cuối máy kia ghi dữ liệu                                      |
| Bỏ qua 1 file lỗi                                        | Thường do Google Drive đang tải dở file của máy kia                    | Tự hết ở lượt đồng bộ sau; dữ liệu trên máy không bị ảnh hưởng                                                               |
| Máy kia đã mã hóa dữ liệu, cần nhập mật khẩu             | Admin đã bật mã hóa, máy này chưa nhập mật khẩu                        | Cài đặt → Mã hóa → Nhập mật khẩu chung... (mục 2.4)                                                                          |
| Không giải mã được dữ liệu từ máy kia, kiểm tra mật khẩu | Nhập sai mật khẩu, hoặc admin vừa đổi mật khẩu                         | Hỏi admin mật khẩu hiện tại rồi nhập lại ở Cài đặt → Mã hóa                                                                  |
| Máy kia đang dùng bản mới hơn, hãy cập nhật app          | Máy kia đã cập nhật app, dữ liệu có cấu trúc mới                       | Cập nhật app trên máy này (mục 2.6); đồng bộ tạm dừng đến khi cập nhật                                                       |
| Giờ trên hai máy lệch nhau                               | Đồng hồ một máy chạy sai hơn 5 phút                                    | Bật đặt giờ tự động trên cả hai máy (Windows: Cài đặt → Thời gian và ngôn ngữ; macOS: Cài đặt hệ thống → Chung → Ngày & Giờ) |
| Lần sync thành công cuối: … (màu vàng)                   | Đã hơn 1 giờ chưa đồng bộ được                                         | Xem thông báo lỗi đi kèm, hoặc bấm Sync ngay                                                                                 |
| Không kiểm tra được cập nhật                             | Mất mạng                                                               | Thử lại khi có mạng; app vẫn dùng bình thường                                                                                |
| Không cập nhật được: …                                   | Mất mạng giữa chừng, hoặc file tải về không đúng chữ ký                | Bấm Thử lại. Nếu vẫn lỗi, tải file cài mới nhất ở trang Releases (mục 2.1) và cài đè lên, dữ liệu vẫn giữ nguyên             |

## 3. Phát hành bản mới (cho người phát triển)

Bản phát hành do GitHub Actions build (`.github/workflows/release.yml`) khi đẩy tag `vX.Y.Z`: bản Windows (NSIS `-setup.exe`) và macOS Apple Silicon (`.dmg`, cộng `.app.tar.gz` cho cập nhật), file cập nhật được ký bằng khóa của Tauri, rồi đăng lên GitHub Releases kèm `latest.json`. App đọc `latest.json` tại `https://github.com/carnegieducanh/family_budget/releases/latest/download/latest.json` (khai báo ở `src-tauri/tauri.conf.json`, mục `plugins.updater.endpoints`).

### 3.1. Chuẩn bị (một lần)

1. **Repo GitHub public** tên `family_budget` trong tài khoản `carnegieducanh`, push code lên nhánh `main`. Plugin cập nhật cần tải `latest.json` không qua đăng nhập, nên trang Releases phải công khai. Nếu đặt tên repo khác, sửa endpoint trong `tauri.conf.json` trước bản phát hành đầu tiên: các bản đã cài chỉ biết endpoint lúc chúng được build.

   Muốn giữ code ở repo private: tạo thêm một repo public chỉ chứa releases, đổi endpoint sang repo đó, và sửa workflow cho các bước `gh release` dùng `GH_REPO` là repo public, `tauri-action` thêm `owner`/`repo`, mọi bước dùng một Personal Access Token có quyền ghi Contents vào repo public (lưu làm secret) thay cho `GITHUB_TOKEN`.

2. **Khóa ký bản cập nhật** đã được tạo bằng `npx tauri signer generate --ci -w ~/.tauri/family-budget.key` (không đặt mật khẩu, giống các dự án khác trên máy này):

   - Private key: `C:\Users\huydu\.tauri\family-budget.key`. **Không commit vào repo.** Sao lưu file này ra nơi an toàn (trình quản lý mật khẩu, USB): mất khóa thì không phát hành được bản cập nhật cho các máy đã cài, phải gỡ app và cài lại bằng tay bản dùng khóa mới.
   - Public key: `family-budget.key.pub`, đã chép vào `tauri.conf.json` (`plugins.updater.pubkey`).

3. **Secret của repo:** GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**:

   - `TAURI_SIGNING_PRIVATE_KEY`: toàn bộ nội dung file `family-budget.key` (một dòng base64).
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: chỉ cần nếu sau này tạo lại khóa có mật khẩu.

### 3.2. Mỗi lần phát hành

1. Thêm mục `## X.Y.Z` vào đầu `docs/CHANGELOG.md`: vài dòng ngắn cho người dùng, đây là ghi chú hiện trong banner cập nhật. Commit.
2. Tăng phiên bản: `npm version X.Y.Z` (ví dụ `npm version 0.2.0`). Lệnh này sửa `package.json`, `package-lock.json`, tạo commit và tag `vX.Y.Z`. Phiên bản app chỉ lấy từ `package.json` (`tauri.conf.json` trỏ tới file này); số trong `Cargo.toml` không dùng.
3. `git push --follow-tags`.
4. Theo dõi ở tab **Actions** của repo (khoảng 15–20 phút). Workflow chạy lần lượt: kiểm tra code (typecheck, lint, format, test) → tạo release nháp → build Windows và macOS song song → bỏ trạng thái nháp. Release chỉ được đăng khi cả hai bản build xong và `latest.json` có đủ hai nền tảng (workflow kiểm tra trước khi đăng).
5. Xong: app trên 2 máy thấy banner khi mở lại, hoặc trong vòng 24 giờ.

Workflow dừng sớm và báo lỗi nếu tag không khớp `version` trong `package.json`, hoặc `docs/CHANGELOG.md` chưa có mục cho phiên bản đó. Nếu một bước build lỗi, release vẫn là nháp (người dùng không thấy). Sửa lỗi, xóa release nháp trên GitHub và xóa tag (`git push --delete origin vX.Y.Z`, `git tag -d vX.Y.Z`), rồi tạo lại tag ở commit đã sửa.

### 3.3. Build thử trên máy

Không bắt buộc. Vì đã bật `createUpdaterArtifacts`, `tauri build` cần khóa ký, nếu không sẽ báo thiếu private key:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "$HOME\.tauri\family-budget.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npm run tauri build
```

File cài nằm ở `src-tauri/target/release/bundle/nsis/` (Windows) hoặc `src-tauri/target/release/bundle/dmg/` (macOS).
