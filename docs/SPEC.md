# Family Budget — Tài liệu thiết kế & prompt cho Claude Code

Oct 23, 2026 · @Duc Anh Huy

## 1. Hướng dẫn cho Claude Code

Bạn sẽ xây dựng app desktop **Family Budget** (tên tạm, có thể đổi) chạy trên Windows 11 và macOS (Apple Silicon M1) theo đúng tài liệu này. Tài liệu là nguồn sự thật duy nhất; hãy lưu nó vào repo tại `docs/SPEC.md`.

Nguyên tắc làm việc:

1. Làm theo từng giai đoạn ở mục 10. Xong mỗi giai đoạn: chạy test, tóm tắt những gì đã làm, rồi dừng lại chờ xác nhận trước khi sang giai đoạn tiếp theo.
2. Ưu tiên đơn giản và ít phụ thuộc. Chỉ dùng thư viện ở mục 3; nếu cần thêm thư viện khác, giải thích lý do trước khi cài.
3. Toàn bộ logic nghiệp vụ (merge sync, tất toán, chi tiêu định kỳ, CSV) viết thành hàm thuần trong `src/core/`, không phụ thuộc Tauri hay React, có unit test bằng Vitest.
4. Không viết Rust trừ khi plugin chính thức của Tauri không đáp ứng được. Nếu bắt buộc, giữ phần Rust tối thiểu và giải thích.
5. Giao diện tiếng Việt. Tiền tệ JPY, số nguyên, không có phần thập phân, hiển thị dạng ¥12,500.
6. Điểm nào tài liệu chưa nói rõ: chọn phương án đơn giản nhất, ghi lại vào `docs/decisions.md` (ngày, quyết định, lý do).
7. Không bao giờ xóa vĩnh viễn dữ liệu người dùng; mọi thao tác xóa là xóa mềm (mục 4, mục 5).

## 2. Tổng quan và phạm vi MVP

App ghi các khoản chi chung hàng tháng của 2 người trong gia đình, chia đều 50/50 và cho biết cuối tháng ai phải trả bù cho ai bao nhiêu.

- **Người dùng:** 2 người, mỗi người một máy (Windows 11 và macOS M1), dùng chung wifi nhà. 1 admin, 1 người dùng thường.
- **Lưu trữ:** dữ liệu lưu local dạng JSON trên từng máy, đồng bộ qua một thư mục Google Drive (app Google Drive for Desktop). Không có server, không cần đăng nhập Google trong app.
- **Quy mô dữ liệu:** vài nghìn khoản mỗi năm; toàn bộ dữ liệu được nạp vào bộ nhớ khi mở app.

**Trong phạm vi MVP:**

- Thêm, sửa, xóa khoản chi chung: ngày, số tiền, danh mục, ghi chú, người trả. App tự ghi lại ai nhập.
- Bộ danh mục mặc định và quản lý danh mục.
- Ngân sách tháng: tổng và theo danh mục.
- Chi tiêu định kỳ (tiền nhà, internet...) tự tạo khoản mỗi tháng.
- Báo cáo và biểu đồ theo tháng, theo danh mục.
- Tất toán cuối tháng chia 50/50.
- Export và import CSV (UTF-8 có BOM để Excel mở đúng tiếng Việt).
- Sync tự động, backup tự động, thông báo khi có bản cập nhật.

**Ngoài phạm vi MVP:** khoản thu (thu nhập), ảnh hóa đơn, nhiều loại tiền, khoản chi riêng hoặc tỉ lệ khác 50/50, bản mobile, khóa app bằng mật khẩu, sync qua LAN, server riêng.

## 3. Công nghệ và cấu trúc project

Stack: Tauri 2 + React + TypeScript + Vite, gần như không viết Rust, file cài đặt khoảng 10 MB.

| Hạng mục | Lựa chọn | Ghi chú |
| --- | --- | --- |
| Desktop shell | Tauri 2.x | Win 11 có sẵn WebView2; Mac build bản aarch64 |
| UI | React + TypeScript (strict) + Vite | Không cần router, chuyển màn hình bằng state |
| State | Zustand | Một store cho dữ liệu, một store cho trạng thái sync |
| Style | SCSS Modules | Biến màu trong `styles/tokens.scss`, theme Sáng / Tối / Theo hệ thống; mẫu dùng chung trong `styles/_mixins.scss` |
| Icon, font | lucide-react, Inter (`@fontsource-variable/inter`) | Font đóng gói trong app, có bộ chữ tiếng Việt, không cần mạng |
| Biểu đồ | Recharts | Chỉ dùng cột và tròn |
| Ngày tháng | dayjs | Ngày lưu dạng `YYYY-MM-DD` theo giờ local |
| ID | `crypto.randomUUID()` | Có sẵn trong WebView |
| Mã hóa | Web Crypto API | AES-GCM + PBKDF2, không cần thư viện |
| Plugin Tauri | `plugin-fs`, `plugin-dialog`, `plugin-persisted-scope`, `plugin-updater`, `plugin-process` | fs: đọc ghi file; dialog: chọn thư mục Drive và file CSV; updater + process: cập nhật và khởi động lại |
| Test | Vitest | Test cho toàn bộ `src/core/` |
| Lint | ESLint + Prettier |  |
| Package manager | npm |  |

Cấu trúc thư mục:

```
family-budget/
├── docs/
│   ├── SPEC.md            # tài liệu này
│   ├── decisions.md       # các quyết định phát sinh
│   └── INSTALL.md         # hướng dẫn cài cho 2 máy
├── src/
│   ├── core/              # logic thuần, có test
│   │   ├── types.ts
│   │   ├── merge.ts       # gộp dữ liệu 2 máy (LWW + tombstone)
│   │   ├── settlement.ts  # tính tiền bù 50/50
│   │   ├── recurring.ts   # sinh khoản định kỳ
│   │   ├── budget.ts
│   │   ├── permissions.ts
│   │   ├── csv.ts
│   │   ├── migrations.ts  # nâng cấp schemaVersion
│   │   └── defaults.ts    # danh mục mặc định
│   ├── storage/
│   │   ├── SyncAdapter.ts        # interface, để sau này đổi sang Supabase/LAN
│   │   ├── driveFolderAdapter.ts # cài đặt cho thư mục Google Drive
│   │   ├── localStore.ts         # data.json, settings.json, ghi nguyên tử
│   │   ├── backup.ts
│   │   └── crypto.ts
│   ├── sync/syncService.ts       # lịch sync, khóa chống chạy song song
│   ├── state/                    # Zustand stores
│   ├── features/                 # mỗi màn hình một thư mục
│   ├── components/               # UI dùng chung
│   └── styles/
└── src-tauri/                    # tauri.conf.json, capabilities, icons
```

Quyền truy cập file: capabilities của Tauri cấp quyền fs cho thư mục app data; thư mục Drive do người dùng chọn qua `plugin-dialog` và được giữ quyền sau khi khởi động lại bằng `plugin-persisted-scope`. Lưu ý vị trí Drive khác nhau: trên Windows thường là ổ ảo `G:\My Drive\...`, trên Mac nằm trong `~/Library/CloudStorage/GoogleDrive-<email>/...`. Bundle identifier: `com.familybudget.desktop`.

## 4. Data model

Mọi bản ghi đồng bộ đều có chung các trường `id`, `createdAt`, `updatedAt`, `updatedBy`, `deleted`; đây là nền tảng để merge và xóa mềm hoạt động.

Quy ước:

- `id`: UUID v4. Riêng các bản ghi mà cả 2 máy có thể tự sinh ra thì dùng id cố định (deterministic) để không bị trùng khi merge: khoản định kỳ, ngân sách, bản ghi tháng (xem từng type).
- `createdAt`, `updatedAt`, `deletedAt`: ISO 8601 UTC, ví dụ `2026-10-23T05:15:00.000Z`. Mỗi lần sửa phải cập nhật `updatedAt` và `updatedBy`.
- `date` của khoản chi: `YYYY-MM-DD` theo giờ local. `month`: `YYYY-MM`.
- `amount`: số nguyên yên, lớn hơn 0.
- Xóa = `deleted: true` + `deletedAt` + cập nhật `updatedAt`. Không xóa tombstone ở MVP (dữ liệu rất nhỏ).
- Mọi màn hình và phép tính đều bỏ qua bản ghi có `deleted: true`.

```ts
interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;   // userId
  deleted: boolean;
  deletedAt?: string;
}

interface User extends BaseRecord {
  name: string;
  role: 'admin' | 'member';
  color: string;       // màu hiển thị, ví dụ '#4F7DF3'
  avatar?: string;     // ảnh đại diện: ảnh vuông 128 px dạng data URL JPEG, hoặc 1 emoji; không có thì hiện chữ cái đầu
}

interface Category extends BaseRecord {
  name: string;
  icon: string;        // emoji
  order: number;
  hidden: boolean;     // danh mục đã dùng chỉ được ẩn, không xóa
}

interface Transaction extends BaseRecord {
  date: string;        // YYYY-MM-DD, ngày thanh toán, quyết định tháng
  amount: number;      // yên, số nguyên > 0
  categoryId: string;
  note: string;
  paidBy: string;      // userId người trả tiền
  createdBy: string;   // userId người nhập
  recurringId?: string;
  // id của khoản sinh từ định kỳ: `rec-${recurringId}-${YYYY-MM}`
}

interface Budget extends BaseRecord {
  month: string;             // 'YYYY-MM' hoặc 'default' (áp dụng mọi tháng)
  categoryId: string | null; // null = ngân sách tổng
  amount: number;
  // id: `budget-${month}-${categoryId ?? 'total'}`
}

interface RecurringTemplate extends BaseRecord {
  name: string;
  amount: number;
  categoryId: string;
  paidBy: string;
  dayOfMonth: number;  // 1–28
  startMonth: string;  // YYYY-MM
  active: boolean;
}

interface MonthRecord extends BaseRecord {
  month: string;             // id: `month-${YYYY-MM}`
  settledAt?: string;
  settledBy?: string;
  settledAmount?: number;    // số tiền bù lúc bấm tất toán
  settledPayer?: string;     // userId người trả bù
}

interface DataFile {
  schemaVersion: 1;
  deviceId: string;
  writtenAt: string;
  writtenBy?: string;        // userId của người dùng máy ghi file device-*.json (bản app cũ không ghi)
  users: User[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringTemplate[];
  months: MonthRecord[];
}

// Chỉ lưu local, KHÔNG sync
interface Settings {
  deviceId: string;          // UUID tạo lần chạy đầu
  userId: string | null;     // máy này là của ai
  syncFolder: string | null; // đường dẫn thư mục Drive
  syncIntervalMin: number;   // mặc định 5
  encryption: { enabled: boolean; keyB64?: string };
  lastSyncAt?: string;
  newTransactionsSeenUntil?: string; // createdAt của khoản mới nhất người kia nhập đã báo trong popup "Khoản chi mới"
}
```

Vị trí file:

| File | Vị trí | Nội dung |
| --- | --- | --- |
| `data.json` | thư mục app data (`appDataDir`) | toàn bộ dữ liệu đã merge của máy này |
| `settings.json` | thư mục app data | `Settings`, không sync |
| `backups/data-YYYYMMDD-HHmmss.json` | thư mục app data | snapshot (mục 9) |
| `device-<deviceId>.json` | `<thư mục Drive>/FamilyBudget/` | bản sao `DataFile` máy này ghi ra để máy kia đọc |

`schemaVersion` bắt đầu từ 1. Khi đổi cấu trúc dữ liệu, tăng version và viết hàm nâng cấp trong `core/migrations.ts`; app phải đọc được mọi version cũ hơn.

Danh mục mặc định (tạo khi admin thiết lập lần đầu, id cố định `cat-<slug>` để 2 máy không tạo trùng):

| Thứ tự | Icon | Tên | id |
| --- | --- | --- | --- |
| 1 | 🛒 | Siêu thị / Thực phẩm | cat-grocery |
| 2 | 🍜 | Ăn ngoài | cat-dining |
| 3 | 🏠 | Tiền nhà | cat-rent |
| 4 | 💡 | Điện / Nước / Gas | cat-utilities |
| 5 | 📶 | Internet / Điện thoại | cat-telecom |
| 6 | 🚃 | Đi lại | cat-transport |
| 7 | 🧴 | Đồ dùng gia đình | cat-household |
| 8 | 🏥 | Y tế / Thuốc | cat-health |
| 9 | 👕 | Quần áo | cat-clothing |
| 10 | 🎉 | Giải trí / Du lịch | cat-leisure |
| 11 | 🎁 | Quà / Hiếu hỉ | cat-gifts |
| 12 | 📦 | Khác | cat-other |

## 5. Luồng sync qua Google Drive

Mỗi máy chỉ ghi file của chính mình trong thư mục Drive và chỉ đọc file của máy kia; dữ liệu được gộp theo `id`, bản có `updatedAt` mới hơn thắng. Không bao giờ có 2 máy cùng ghi một file, nên Google Drive không tạo file trùng kiểu `device (1).json`.

&#91;embedded content: luồng sync · 2 máy, 1 thư mục Drive\]

Máy A ghi `device-A.json` và đọc `device-B.json`; máy B làm ngược lại, nên không có file nào bị hai máy cùng ghi.

**Khi nào sync:**

- Khi mở app.
- Định kỳ mỗi `syncIntervalMin` phút (mặc định 5).
- Khi cửa sổ app được focus lại.
- Khi người dùng bấm "Sync ngay".
- Sau mỗi thay đổi local: lưu `data.json` ngay, rồi ghi file Drive của mình sau 10 giây không có thay đổi mới (debounce).

Chỉ một lượt sync chạy tại một thời điểm (mutex trong `syncService`); lượt đến sau khi đang chạy thì gộp thành một lượt chạy tiếp theo.

**Một lượt sync (`syncOnce`):**

1. Chưa cấu hình `syncFolder`, hoặc thư mục không tồn tại → dừng, trạng thái "Chưa kết nối thư mục Drive".
2. Liệt kê các file `device-*.json` (và `device-*.enc.json`) trong `<syncFolder>/FamilyBudget/`, bỏ qua file của chính máy này và mọi file tạm.
3. Đọc từng file: giải mã nếu cần (mục 9), parse JSON, kiểm tra cấu trúc. Lỗi parse hoặc sai cấu trúc → bỏ qua file đó trong lượt này, ghi log, hiện cảnh báo nhẹ. Tuyệt đối không ghi đè dữ liệu local bằng dữ liệu hỏng.
4. File có `schemaVersion` lớn hơn version app hỗ trợ → dừng sync, hiện "Máy kia đang dùng bản mới hơn, hãy cập nhật app". File có version nhỏ hơn → chạy migrations trước khi merge.
5. Chạy `merge(local, remote)` (luật bên dưới). Nếu kết quả khác dữ liệu local → tạo backup snapshot trước, rồi lưu `data.json` mới.
6. Ghi `DataFile` hiện tại ra `device-<deviceId>.json` trên Drive.
7. Cập nhật `lastSyncAt` và trạng thái UI.

**Luật merge (`core/merge.ts`, hàm thuần):**

- Làm riêng cho từng collection: `users`, `categories`, `transactions`, `budgets`, `recurring`, `months`.
- Hợp tất cả `id` của hai bên. Id chỉ có ở một bên → giữ nguyên bản đó.
- Id có ở cả hai bên → giữ bản có `updatedAt` lớn hơn (last write wins, so sánh cả bản ghi, không gộp từng trường).
- `updatedAt` bằng nhau → giữ bản có `updatedBy` đứng trước theo thứ tự chữ cái, để hai máy luôn ra cùng một kết quả.
- Bản ghi đã xóa mềm cũng tham gia merge như bản ghi thường; đây là lý do khoản đã xóa ở máy A không "sống lại" từ máy B.
- Merge không áp luật nghiệp vụ (phân quyền); các luật này được kiểm tra lúc người dùng thao tác.

**Ghi file an toàn (ghi nguyên tử):** ghi nội dung ra file tạm cùng thư mục, tên không khớp mẫu đọc (ví dụ `.device-<id>.json.tmp`), rồi rename đè lên file đích. Áp dụng cho cả `data.json`, `settings.json` và file trên Drive.

**Lệch đồng hồ:** nếu một bản ghi remote có `updatedAt` lớn hơn giờ hiện tại quá 5 phút, hiện cảnh báo "Giờ trên hai máy lệch nhau" (vẫn merge bình thường).

**Trạng thái sync hiển thị ở góc màn hình:** "Đã sync lúc 14:05", "Đang sync...", "Chưa thấy dữ liệu từ máy kia", "Lỗi: không tìm thấy thư mục Drive", "Lần sync thành công cuối: 2 giờ trước" (đổi màu cảnh báo nếu quá 1 giờ).

**Thiết lập lần đầu:**

1. Máy admin: app báo chưa thấy dữ liệu gia đình, bấm "Tạo dữ liệu mới" ở dòng cuối, nhập tên 2 người, chọn ảnh đại diện của mình (bắt buộc), chọn thư mục Drive. App tạo danh mục mặc định và ghi `device-<id>.json`.
2. Máy thứ hai: mở app lần đầu, app tự tìm thư mục `FamilyBudget` đã có dữ liệu trong Google Drive for Desktop của máy (tối đa 2 cấp dưới My Drive / Shared drives, kể cả lối tắt) và cấp quyền đọc ghi thư mục đó. Thấy đúng một thư mục thì hiện luôn hai người dùng dạng thẻ có ảnh đại diện; không thấy (hoặc thấy nhiều hơn một) thì hiện hướng dẫn cho máy thứ hai (cài Google Drive for Desktop, thêm lối tắt tới thư mục được chia sẻ, chờ Drive tải xong) với nút "Tìm lại" và "Tự chọn thư mục...". Sau đó chọn tài khoản của mình, chọn ảnh đại diện (bắt buộc), rồi merge và ghi file của mình.
3. Không cho tạo dữ liệu mới nếu thư mục đã có file `device-*.json`, hoặc nếu Google Drive của máy đã có thư mục gia đình ở chỗ khác (tránh hai bộ dữ liệu song song). Đã tìm thấy dữ liệu gia đình thì màn chọn tài khoản không có đường quay về bước tạo mới.

**Chuẩn bị Google Drive (ghi vào `docs/INSTALL.md`):** cài Google Drive for Desktop trên cả 2 máy. Nếu dùng 2 tài khoản Google khác nhau: admin tạo thư mục, chia sẻ quyền chỉnh sửa cho người kia; người kia chọn "Thêm lối tắt vào Drive". Bật "Có sẵn ngoại tuyến" cho thư mục này.

**Interface để thay backend sau này:**

```ts
interface SyncAdapter {
  isReady(): Promise<boolean>;
  listRemote(): Promise<{ name: string; deviceId: string }[]>;
  readRemote(name: string): Promise<string>;   // nội dung thô (có thể đã mã hóa)
  writeOwn(content: string): Promise<void>;     // ghi nguyên tử file của máy này
}
```

`syncService` chỉ làm việc qua interface này, nên sau này có thể thêm `supabaseAdapter` hoặc `lanAdapter` mà không phải sửa UI hay `core/`.

## 6. Tất toán và chi tiêu định kỳ

Khoản chi tính vào tháng theo `date` (ngày thanh toán). Ví dụ: tiền điện tháng 10 trả ngày 5/11 thì thuộc tháng 11. Một tháng là "đã qua" từ ngày 1 của tháng sau (theo giờ local, `isPastMonth` trong `core/month.ts`). Tháng đã qua không bị khóa: vẫn thêm, sửa, xóa khoản chi và đặt ngân sách được như tháng hiện tại (bỏ khóa tháng từ sau bản 0.2.0, xem decisions.md).

**Tất toán 50/50 (`core/settlement.ts`):**

Gọi `P_A`, `P_B` là tổng tiền mỗi người đã trả trong tháng (bỏ qua khoản đã xóa). Người trả ít hơn phải bù cho người trả nhiều hơn:

```latex
\text{Số tiền bù} = \left\lfloor \frac{|P_A - P_B|}{2} \right\rfloor
```

Làm tròn xuống đến 1 yên (chênh lệch tối đa ¥0.5 bỏ qua). Hàm trả về `{ total, paidByUser, sharePerPerson, payer, receiver, amount }`; nếu `amount = 0` thì hiện "Hai người đã trả bằng nhau".

Ví dụ để viết test:

| A đã trả | B đã trả | Tổng | Mỗi người chịu | Kết quả |
| --- | --- | --- | --- | --- |
| ¥180,000 | ¥95,000 | ¥275,000 | ¥137,500 | B trả A ¥42,500 |
| ¥50,000 | ¥50,000 | ¥100,000 | ¥50,000 | Không ai trả bù |
| ¥1,001 | ¥0 | ¥1,001 | ¥500.5 | B trả A ¥500 |

**Đánh dấu đã thanh toán:** với tháng đã qua, màn hình Tất toán có nút "Đã thanh toán" (cả hai người đều bấm được). Bấm vào sẽ lưu `settledAt`, `settledBy`, `settledAmount`, `settledPayer` vào `MonthRecord`. Nếu sau đó khoản chi của tháng bị sửa và số tiền bù tính lại khác `settledAmount`, hiện cảnh báo "Số tiền đã thay đổi sau khi tất toán: ¥X → ¥Y". Tháng hiện tại chỉ hiện số tạm tính.

**Sinh khoản định kỳ (`core/recurring.ts`):**

- Khi mở app và sau mỗi lượt sync, với mỗi `RecurringTemplate` đang `active`, nếu tháng hiện tại ≥ `startMonth` và chưa có khoản id `rec-${templateId}-${YYYY-MM}` (kể cả đã xóa mềm), tạo khoản đó với `date` = ngày `dayOfMonth` của tháng hiện tại.
- Vì id cố định, nếu cả hai máy cùng sinh thì sau merge vẫn chỉ còn một khoản. Nếu người dùng xóa khoản định kỳ của tháng này, nó không bị sinh lại.
- Chỉ sinh cho tháng hiện tại, không sinh bù các tháng trước.

## 7. Phân quyền

Admin có thể sửa mọi dữ liệu. Người dùng thường quản lý được danh mục, ngân sách và chi tiêu định kỳ như admin, nhưng chỉ sửa được khoản chi do chính mình nhập. Mục đích là tránh sửa nhầm, không phải bảo mật thật (ai có quyền vào thư mục Drive vẫn sửa được file).

| Thao tác | Admin | Người dùng |
| --- | --- | --- |
| Thêm khoản chi | Có | Có |
| Sửa, xóa khoản do mình nhập | Có | Có |
| Sửa, xóa khoản người kia nhập | Có | Không |
| Đánh dấu tháng đã thanh toán | Có | Có |
| Quản lý danh mục, ngân sách, chi tiêu định kỳ | Có | Có |
| Import CSV, khôi phục backup | Có | Không |
| Export CSV, xem báo cáo, xem tất toán | Có | Có |
| Chuyển vai trò, mật khẩu mã hóa | Có | Không |
| Đổi tên, ảnh đại diện | Của cả hai người | Của mình |
| Cài đặt thư mục sync, chu kỳ sync của máy mình | Có | Có |

Viết các hàm `can(user, action, record?)` trong `core/permissions.ts`, dùng chung cho UI (ẩn hoặc vô hiệu nút) và store (chặn thao tác). Vai trò được đặt khi thiết lập lần đầu; admin có thể chuyển vai trò trong Cài đặt, nhưng luôn phải còn đúng một admin.

## 8. Danh sách màn hình

App có 9 màn hình, bố cục sidebar trái + vùng nội dung; màn hình chính là Tổng quan tháng.

Bố cục chung: cửa sổ tối thiểu 1024 × 700, sidebar điều hướng bên trái, trạng thái sync ở góc dưới sidebar, popup giữa màn hình khi có bản cập nhật mới. Theme Sáng / Tối / Theo hệ thống (mặc định), chọn ở sidebar hoặc Cài đặt → Giao diện, lưu riêng từng máy. Các màn hình có chọn tháng dùng chung một bộ chọn `‹ Tháng 10/2026 ›`.

1. **Thiết lập lần đầu** (chỉ hiện khi chưa có `userId`)
   - Tìm sẵn dữ liệu gia đình trong Google Drive (mục 5). Thấy thì hiện ngay "Chọn tài khoản của bạn để bắt đầu" với hai thẻ người dùng (ảnh đại diện, tên, vai trò), không kèm gì khác; không có nút quay về bước tạo mới.
   - Không thấy: "Chưa tìm thấy dữ liệu gia đình trên Google Drive của máy này", hướng dẫn 3 bước cho máy người nhà, nút "Tự chọn thư mục..." và "Tìm lại" (chính). "Tạo dữ liệu mới" chỉ là dòng phụ cuối màn: "Bạn là người đầu tiên dùng app trong gia đình?".
   - Tạo mới: cảnh báo chỉ làm trên máy đầu tiên, nhập tên 2 người, chọn ảnh đại diện của mình, chọn thư mục Drive.
   - Tự chọn thư mục: chọn thư mục Drive, chọn tài khoản của mình từ hai thẻ, rồi chọn ảnh đại diện của mình.
   - Kiểm tra thư mục hợp lệ trước khi cho tiếp tục (mục 5).
2. **Tổng quan tháng** (màn hình chính)
   - Tổng chi tháng, ngân sách còn lại dạng thanh tiến độ (đổi màu khi vượt 80% và 100%).
   - Mỗi người đã trả bao nhiêu, số tiền bù tạm tính.
   - Biểu đồ tròn chi theo danh mục.
   - 5 khoản gần nhất, nút "+ Thêm khoản chi".
3. **Khoản chi**
   - Bảng khoản chi của tháng: ngày, danh mục, ghi chú, số tiền, người trả, người nhập (chấm màu), nhãn "định kỳ".
   - Lọc theo danh mục, người trả; tìm theo ghi chú; sắp xếp theo ngày hoặc số tiền.
   - Thêm và sửa trong modal: ngày (mặc định hôm nay), số tiền (ô số, Enter để lưu), danh mục, người trả (mặc định là mình), ghi chú. Xóa có hộp xác nhận.
   - Phím tắt: Ctrl/Cmd + N thêm mới, Esc đóng modal.
   - Khi mở app, nếu người kia đã thêm khoản chi từ lần báo trước: popup "Khoản chi mới" liệt kê các khoản đó (danh mục, ghi chú, ngày, số tiền) và tổng tiền, nút "Đã xem". Đóng là tính đã xem.
4. **Tất toán**
   - Tháng đang chọn: bảng mỗi người đã trả, mỗi người chịu, kết quả "B trả A ¥X".
   - Nút "Đã thanh toán" cho tháng đã qua; cảnh báo nếu số tiền thay đổi sau tất toán.
   - Lịch sử các tháng: tháng, số tiền bù, ai trả, trạng thái đã thanh toán.
5. **Báo cáo**
   - Biểu đồ cột tổng chi 12 tháng gần nhất.
   - Chi theo danh mục của tháng chọn, so với ngân sách.
   - Nút export CSV cho khoảng tháng chọn.
6. **Ngân sách**
   - Ngân sách tổng và theo danh mục, mức mặc định hàng tháng và ghi đè cho từng tháng.
7. **Danh mục**
   - Thêm, đổi tên, đổi icon, kéo thả sắp xếp, ẩn hoặc hiện.
   - Icon là một emoji: bấm vào ô icon thì mở bảng emoji của hệ điều hành (Windows: như Win + . ; macOS: Emoji & Symbols), emoji chọn được thay emoji cũ.
8. **Chi tiêu định kỳ**
   - Danh sách mẫu: tên, số tiền, danh mục, người trả, ngày trong tháng, bật/tắt.
9. **Cài đặt** (mở bằng cách bấm vào người đang dùng ở cuối sidebar; sidebar không có mục Cài đặt riêng)
   - Người dùng và vai trò (chuyển vai trò: admin). Tên: sửa trong ô, lưu khi rời ô hoặc bấm Enter. Ảnh đại diện: bấm vào ảnh để đổi (ảnh trên máy hoặc emoji). Mỗi người đổi được tên và ảnh của mình, admin đổi được của cả hai.
   - Sync: thư mục Drive, chu kỳ sync, trạng thái chi tiết, nút "Sync ngay". Mục "Máy khác" gọi mỗi máy theo người dùng của máy đó ("Máy Queen"); file của bản app cũ chưa ghi người dùng thì gọi theo 8 ký tự đầu mã máy, hai máy của cùng một người thì kèm mã máy.
   - Mã hóa (admin, giai đoạn 4).
   - Backup: danh sách snapshot, khôi phục (admin), export/import backup JSON.
   - Import/export CSV.
   - Phiên bản app, nút "Kiểm tra cập nhật".

Định dạng CSV (export và import): `date,amount,category,note,paidBy,createdBy`, tên danh mục và tên người thay cho id, UTF-8 có BOM. Import: hiện bản xem trước, báo dòng lỗi, bỏ qua dòng trùng (cùng ngày, số tiền, danh mục, ghi chú), tạo backup trước khi ghi.

## 9. Backup, mã hóa, cập nhật và cài đặt

Backup tự động trên từng máy, mã hóa chỉ áp dụng cho file trên Drive, cập nhật qua plugin updater của Tauri với nút "Cập nhật" do người dùng bấm.

**Backup (`storage/backup.ts`):**

- Tạo snapshot `data.json` vào `<appData>/backups/` trước mỗi lần merge làm thay đổi dữ liệu, trước import CSV và trước khi khôi phục.
- Giữ 30 snapshot gần nhất, cộng thêm snapshot đầu tiên của mỗi tháng trong 12 tháng gần nhất; xóa các bản cũ hơn.
- Khôi phục (admin): chọn snapshot, xem trước số khoản chi và khoảng ngày, xác nhận. Quan trọng: khôi phục không chỉ ghi đè file local, vì lượt sync sau sẽ kéo dữ liệu mới hơn từ máy kia về và làm mất tác dụng. Cách đúng: với mỗi bản ghi khác giữa snapshot và hiện tại, ghi lại bản trong snapshot với `updatedAt = now`; bản ghi có ở hiện tại nhưng không có trong snapshot thì xóa mềm với `updatedAt = now`. Nhờ vậy bản khôi phục thắng khi merge ở máy kia.

**Mã hóa (giai đoạn 4, `storage/crypto.ts`):**

- Chỉ mã hóa file `device-*.json` trên Drive; dữ liệu local giữ dạng thường.
- AES-GCM 256 bit. Khóa dẫn xuất từ mật khẩu chung bằng PBKDF2-SHA256, 600,000 vòng, salt ngẫu nhiên 16 byte. IV ngẫu nhiên 12 byte cho mỗi lần ghi.
- File mã hóa tên `device-<deviceId>.enc.json`, dạng: `{ "v": 1, "alg": "AES-GCM", "kdf": "PBKDF2-SHA256", "iter": 600000, "salt": "<base64>", "iv": "<base64>", "data": "<base64>" }`.
- Khóa đã dẫn xuất lưu trong `settings.json` local (dữ liệu local vốn không mã hóa nên không làm giảm bảo mật), để không phải nhập mật khẩu mỗi lần mở app.
- App đọc được cả file thường lẫn file mã hóa. Sai mật khẩu → báo rõ "Không giải mã được dữ liệu từ máy kia, kiểm tra mật khẩu" và không merge file đó.
- Bật mã hóa: admin đặt mật khẩu, máy thứ hai nhập cùng mật khẩu. Cảnh báo người dùng: quên mật khẩu thì file trên Drive không đọc được, nhưng dữ liệu local vẫn còn.

**Cập nhật app:**

- Dùng `plugin-updater`. Kiểm tra khi mở app và mỗi 24 giờ. Có bản mới → popup giữa màn hình "Có bản cập nhật mới": một câu báo phiên bản, ghi chú thay đổi ẩn sau "Xem chi tiết", nút "Để sau" (ẩn đến lần mở app sau) và "Cập nhật". Cài đặt → Phiên bản app xem lại được ghi chú của bản mới và của bản đang dùng (docs/CHANGELOG.md đóng gói trong app), cũng ẩn sau liên kết. Bấm → tải, cài, khởi động lại bằng `plugin-process`. Không tự cập nhật khi người dùng chưa bấm.
- File cập nhật được ký bằng khóa của Tauri (`tauri signer generate`, miễn phí, khác với ký app của Apple). Private key không commit vào repo; lưu trong GitHub Secrets.
- Endpoint `latest.json` đặt trên GitHub Releases. Updater cần endpoint công khai: dùng repo public, hoặc giữ code ở repo private và đẩy bản phát hành sang một repo public riêng chỉ chứa releases.
- GitHub Actions dùng `tauri-action` để build: Windows (NSIS `.exe`) và macOS aarch64 (`.dmg` + `.app.tar.gz` cho updater).

**Cài đặt khi không ký app (ghi vào `docs/INSTALL.md`):**

- macOS: cấu hình ad-hoc signing (`bundle.macOS.signingIdentity: "-"`). Lần đầu mở: chuột phải vào app → Open; nếu báo "app bị hỏng", chạy `xattr -cr "/Applications/Family Budget.app"` một lần.
- Windows: SmartScreen có thể cảnh báo; chọn "More info" → "Run anyway".

## 10. Lộ trình triển khai và tiêu chí hoàn thành

Làm theo 5 giai đoạn, mỗi giai đoạn phải đạt hết tiêu chí rồi dừng lại chờ xác nhận.

**Giai đoạn 0 — Khởi tạo project**

- [ ] Tạo project Tauri 2 + React + TypeScript + Vite, cấu hình ESLint, Prettier, Vitest, SCSS Modules.
- [ ] Tạo cây thư mục như mục 3; lưu tài liệu này vào `docs/SPEC.md`, tạo `docs/decisions.md`.
- [ ] `npm run tauri dev` chạy được trên macOS M1; ghi các bước cài môi trường cho Windows 11 (Rust, MSVC Build Tools) vào `docs/INSTALL.md`.

**Giai đoạn 1 — Lưu local và tính năng lõi**

- [ ] `core/types.ts`, `core/defaults.ts`, `storage/localStore.ts` với ghi nguyên tử.
- [ ] Thiết lập lần đầu dạng rút gọn (tạo 2 người, chọn mình là ai, chưa cần thư mục Drive).
- [ ] Màn hình Khoản chi (thêm, sửa, xóa mềm, lọc), Tổng quan tháng, Tất toán.
- [ ] `core/settlement.ts` và `core/monthLock.ts` có test, gồm 3 ví dụ ở mục 6 và các trường hợp biên của khóa tháng (ngày cuối tháng, ngày 1, mở khóa tạm hết hạn).
- [ ] Tắt và mở lại app, dữ liệu còn nguyên.

**Giai đoạn 2 — Sync qua Google Drive**

- [ ] `SyncAdapter`, `driveFolderAdapter`, `syncService`, `core/merge.ts`, `storage/backup.ts`.
- [ ] Thiết lập lần đầu đầy đủ (tạo mới và tham gia), trạng thái sync, nút "Sync ngay".
- [ ] Test cho `merge`:
  - [ ] Bản ghi chỉ có ở một bên được giữ.
  - [ ] Cùng bản ghi sửa ở hai bên → bản `updatedAt` mới hơn thắng.
  - [ ] Xóa ở A sau khi B sửa → kết quả là đã xóa; B sửa sau khi A xóa → bản của B thắng.
  - [ ] `updatedAt` bằng nhau → hai máy ra cùng kết quả.
  - [ ] Khoản định kỳ sinh ở cả hai máy → chỉ còn một.
  - [ ] merge(a, b) và merge(b, a) cho cùng kết quả; merge hai lần không đổi kết quả.
- [ ] File remote JSON hỏng → bỏ qua, dữ liệu local không đổi. File có `schemaVersion` cao hơn → dừng sync và báo.
- [ ] Thử thật trên 2 máy: thêm ở A thấy ở B sau một chu kỳ sync (cộng thời gian Drive đồng bộ); xóa ở A thì B cũng mất; tắt mạng một máy, sửa, bật mạng lại vẫn gộp đúng.

**Giai đoạn 3 — Đủ tính năng MVP**

- [ ] Ngân sách, Danh mục, Chi tiêu định kỳ, Báo cáo.
- [ ] Phân quyền theo mục 7 (`core/permissions.ts` có test).
- [ ] Export và import CSV có xem trước; khôi phục backup theo đúng cách ở mục 9.

**Giai đoạn 4 — Mã hóa, cập nhật và phát hành**

- [ ] Mã hóa file Drive (test: mã hóa rồi giải mã ra đúng dữ liệu; sai mật khẩu báo lỗi).
- [ ] `plugin-updater` với banner và nút "Cập nhật"; GitHub Actions build bản Windows và macOS aarch64.
- [ ] `docs/INSTALL.md` hoàn chỉnh: cài app trên 2 máy, chuẩn bị thư mục Google Drive, thiết lập lần đầu, xử lý cảnh báo Gatekeeper và SmartScreen.
