# Các quyết định phát sinh

Ghi lại những điểm `SPEC.md` chưa nói rõ và phương án đã chọn. Mục mới thêm vào cuối file, nhóm theo ngày; mỗi mục gồm quyết định và lý do.

## 2026-10-23 — Giai đoạn 0

- **Khởi tạo bằng `create-tauri-app` 4.7.5, template `react-ts`.** Phiên bản: Tauri 2, React 19, Vite 8, TypeScript 6.0, Vitest 5, ESLint 10.
  Lý do: template chính thức, cấu hình Vite sẵn cho Tauri (cổng 1420, bỏ theo dõi `src-tauri`).

- **Gỡ `plugin-opener` và lệnh Rust mẫu `greet` của template.** `src-tauri/src/lib.rs` chỉ còn phần khởi động app; Cargo chỉ phụ thuộc `tauri`.
  Lý do: không có trong danh sách thư viện ở mục 3, và nguyên tắc 4 (gần như không viết Rust).

- **Các plugin Tauri chưa cài ở giai đoạn 0**; cài ở giai đoạn đầu tiên cần đến: `fs` ở giai đoạn 1, `dialog` + `persisted-scope` ở giai đoạn 2, `updater` + `process` ở giai đoạn 4.
  Lý do: mỗi plugin kéo theo quyền trong capabilities; `updater` còn cần public key và endpoint mà đến giai đoạn 4 mới có.

- **Cài sẵn `zustand`, `dayjs`, `recharts` ngay từ giai đoạn 0.**
  Lý do: đã chốt trong mục 3; khóa phiên bản sớm để giai đoạn 1 chỉ việc dùng.

- **Thêm các gói dev đi kèm công cụ đã chọn:** `sass` (trình biên dịch SCSS mà Vite cần), `@types/node` (kiểu cho `vite.config.ts`), `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` (bộ luật ESLint cho TS + React, giống template Vite), `eslint-config-prettier` (tắt các luật ESLint trùng với Prettier).
  Lý do: bắt buộc để SCSS Modules, ESLint và Prettier ở mục 3 chạy được; không thêm chức năng mới.

- **ESLint chặn `src/core/**` import** `react`, `react-dom`, `@tauri-apps/*`, `zustand`, `recharts` và các thư mục `storage/`, `sync/`, `state/`, `features/`, `components/`.
  Lý do: bắt buộc nguyên tắc 3 bằng công cụ thay vì chỉ dựa vào quy ước.

- **TypeScript bật `strict` và thêm `noUncheckedIndexedAccess`.**
  Lý do: code merge và tính toán làm việc nhiều với mảng và map; truy cập phần tử có thể `undefined` sẽ bị bắt lúc biên dịch.

- **Prettier: `singleQuote: true`, `printWidth: 100`**, còn lại theo mặc định. Không format `docs/SPEC.md`.
  Lý do: quy ước phổ biến cho TS. `SPEC.md` là tài liệu gốc, giữ nguyên định dạng.

- **Test đặt cạnh file nguồn, tên `*.test.ts`** (ví dụ `src/core/money.test.ts`). Vitest chỉ tìm test trong `src/`, môi trường `node`.
  Lý do: dễ tìm test của từng module; `core/` không cần DOM.

- **Biến giao diện trong `styles/tokens.scss` là CSS custom properties** (`--color-*`, `--space-*`...), đổi giá trị trong `@media (prefers-color-scheme: dark)`. `styles/global.scss` nạp tokens một lần trong `main.tsx`.
  Lý do: dark mode theo hệ thống mà component không cần biết; SCSS Modules chỉ dùng `var(--...)`.

- **Thêm `core/money.ts` với `formatYen()`** dùng `Intl.NumberFormat('en-US', { currency: 'JPY' })`: `¥12,500`, số âm `-¥42,500`.
  Lý do: mọi màn hình cần cùng một cách hiển thị tiền (nguyên tắc 5); đồng thời là test đầu tiên để kiểm tra Vitest.

- **Cửa sổ mặc định 1200 × 800, tối thiểu 1024 × 700** (mục 8), mở giữa màn hình. `productName` = "Family Budget".
  Lý do: khớp tên app trong lệnh `xattr` ở mục 9.

- **Cấu hình sẵn `bundle.macOS.signingIdentity: "-"`** (ad-hoc signing).
  Lý do: mục 9 yêu cầu; không ảnh hưởng `tauri dev`.

- **Giữ `security.csp: null` như template.**
  Lý do: chưa tải tài nguyên ngoài nào; xem lại khi phát hành ở giai đoạn 4.

- **Thư mục gốc của repo là `family_budget`** (cây ở mục 3 ghi `family-budget/`); tên package npm và crate Rust là `family-budget`.
  Lý do: thư mục đã có sẵn trên máy; tên thư mục gốc không ảnh hưởng build.

- **Giai đoạn 0 được kiểm tra `npm run tauri dev` trên Windows 11** (máy đang phát triển). Trên macOS M1 cần chạy lại theo `docs/INSTALL.md` mục 1.2.
  Lý do: máy khởi tạo project là Windows; chưa có máy Mac để chạy thử.

## 2026-10-23 — Giai đoạn 1

- **Cài `plugin-fs` (bằng `npm run tauri add fs`) và cấp thêm quyền `fs:allow-appdata-write-recursive`.** Quyền ghi chỉ trong thư mục app data; quyền đọc đã có sẵn trong `fs:default`.
  Lý do: `localStore` cần ghi `data.json`, `settings.json` và file tạm; không cấp ghi ra ngoài thư mục app.

- **Ghi nguyên tử bằng file tạm `.data.json.tmp` / `.settings.json.tmp` rồi `rename` đè lên file đích.** Mọi lần ghi đi qua một hàng đợi nên không có 2 lần ghi chồng nhau.
  Lý do: SPEC mục 5. Trên Windows, `rename` của plugin-fs dùng `MoveFileExW` với `REPLACE_EXISTING`, nên đè được file đích.

- **`data.json` hỏng hoặc sai cấu trúc khi mở app → màn hình lỗi, app không ghi gì.** Không tự tạo dữ liệu mới, không tự khôi phục.
  Lý do: nguyên tắc 7, không bao giờ ghi đè dữ liệu người dùng. Khôi phục từ backup làm ở giai đoạn 2–3.

- **Thêm các module thuần ngoài danh sách ở mục 3:** `core/month.ts` (ngày, tháng), `core/records.ts` (tạo, sửa, xóa mềm bản ghi), `core/transactions.ts` (kiểm tra và thao tác khoản chi), `core/queries.ts` (lọc, sắp xếp, tổng hợp), `core/dataFile.ts` (đọc và kiểm tra cấu trúc JSON), `core/errors.ts`, `core/testing.ts` (dữ liệu mẫu cho test).
  Lý do: nguyên tắc 3, mọi logic nghiệp vụ là hàm thuần có test; danh sách ở mục 3 chỉ là các file chính.

- **`isLocked(month, now, monthRecord)` nhận `now: Date` thay cho `today`.**
  Lý do: cần cả tháng local (để biết tháng đã qua) lẫn thời điểm tuyệt đối (để so với `manualUnlockUntil` dạng UTC).

- **Tháng tương lai không bị khóa**; thêm được khoản có ngày ở tháng sau (ví dụ trả trước tiền nhà).
  Lý do: SPEC chỉ khóa tháng đã qua.

- **Mở khóa tạm chỉ áp dụng cho tháng đã qua. "Khóa lại" xóa trường `manualUnlockUntil` khỏi bản ghi tháng**, không đặt về quá khứ.
  Lý do: tháng hiện tại vốn không khóa. Bỏ trường thì bản ghi gọn và nghĩa rõ ràng.

- **Nút mở khóa tạm và khóa lại nằm ở thanh chọn tháng, dùng chung cho mọi màn hình.** Chỉ admin thấy; store cũng kiểm tra vai trò admin. _(Đã thay: bỏ khóa tháng, xem mục "2026-10-26 — Thành viên quản lý Ngân sách, Danh mục, Định kỳ; bỏ khóa tháng".)_
  Lý do: SPEC không chỉ chỗ đặt nút. Đặt cạnh biểu tượng khóa là dễ thấy nhất.

- **Phân quyền đầy đủ (người dùng thường chỉ sửa khoản mình nhập) chưa áp dụng ở giai đoạn 1.** Giai đoạn này chỉ kiểm tra quyền admin cho mở khóa tạm.
  Lý do: `core/permissions.ts` thuộc giai đoạn 3 theo mục 10.

- **"Đã thanh toán" hiện cho mọi tháng đã qua** (kể cả khi admin đang mở khóa tạm), khi số tiền bù lớn hơn 0. Nếu số tiền hoặc người trả bù đổi sau khi tất toán thì hiện cảnh báo kèm nút "Xác nhận lại đã thanh toán".
  Lý do: mở khóa tạm chỉ để sửa dữ liệu, tháng vẫn là tháng đã kết thúc. Cảnh báo xét cả trường hợp đổi chiều trả bù dù số tiền giữ nguyên.

- **`sharePerPerson` giữ phần lẻ 0.5 yên, `formatYen` hiện tối đa 1 chữ số thập phân** (¥500.5 như ví dụ ở mục 6). Số tiền nhập và lưu luôn là số nguyên.
  Lý do: hiện đúng bảng ví dụ của SPEC mà không làm tròn sai phần mỗi người chịu.

- **Ngưỡng màu ngân sách: trên 80% là cảnh báo, trên 100% là vượt; dùng đúng 100% vẫn chỉ là cảnh báo.** Đã có `core/budget.ts` để đọc ngân sách (mức của tháng, nếu không có thì mức mặc định); màn hình đặt ngân sách làm ở giai đoạn 3.
  Lý do: "vượt" nghĩa là lớn hơn hẳn. Tổng quan cần đọc ngân sách ngay từ giai đoạn 1.

- **Biểu đồ tròn của Tổng quan là dạng donut, tối đa 6 lát: 5 danh mục lớn nhất có màu riêng, phần còn lại gộp thành lát xám.** Bên cạnh luôn có bảng liệt kê mọi danh mục kèm số tiền và %. Màu lấy từ bảng màu đã kiểm bằng validator (đạt kiểm tra mù màu ở cả nền sáng và tối) và gán theo thứ hạng trong tháng. _(Đã thay: còn tối đa 5 lát, xem mục "2026-10-25 — Bảng màu theo app ゆうちょ銀行".)_
  Lý do: SPEC yêu cầu biểu đồ tròn; donut quá 6 lát khó đọc. 12 danh mục nhiều hơn số màu phân biệt được, nên không gán cố định một màu cho mỗi danh mục; tên danh mục luôn hiện cạnh màu.

- **Thiết lập lần đầu rút gọn: "Tên của bạn (admin)" và "Tên người còn lại".** Màu mặc định `#4F7DF3` cho người tạo, `#E8618C` cho người kia. Nếu máy đã có `data.json` mà chưa có `userId` thì chỉ cho chọn "Tôi là ...", không tạo dữ liệu mới đè lên.
  Lý do: đây là cách đơn giản nhất để vừa nhập tên 2 người vừa chọn mình là ai, và tránh mất dữ liệu nếu lần thiết lập trước bị ngắt giữa chừng.

- **Thêm `state/uiStore.ts` (màn hình đang mở, tháng đang chọn, trạng thái modal)** bên cạnh store dữ liệu.
  Lý do: tháng đang chọn và modal thêm khoản chi được dùng chung ở nhiều màn hình và phím tắt Ctrl/Cmd+N; không lưu xuống file.

- **Form khoản chi: danh mục để trống, bắt người dùng chọn**; sau khi lưu, app chuyển sang tháng của khoản vừa lưu. Danh mục ẩn không hiện trong danh sách chọn, trừ khi khoản đang sửa đang dùng nó.
  Lý do: tránh lưu nhầm vào một danh mục mặc định; chuyển tháng để người dùng thấy ngay khoản vừa thêm.

- **Tìm theo ghi chú không phân biệt dấu và hoa thường** ("dien" tìm ra "Điện").
  Lý do: gõ không dấu nhanh hơn.

- **Ô chọn ngày hiển thị theo ngôn ngữ của hệ điều hành** (WebView2 trên Windows tiếng Anh hiện `10/23/2026`). Giá trị lưu luôn là `YYYY-MM-DD`; các chỗ khác trong app hiện `dd/mm/yyyy`.
  Lý do: đổi định dạng của ô ngày gốc cần thêm tham số trình duyệt cho WebView2; chưa cần ở MVP.

## 2026-10-23 — Giai đoạn 2

- **Cài `plugin-dialog` (chỉ cấp quyền `dialog:allow-open`) và `plugin-persisted-scope`. Đăng ký plugin theo thứ tự fs → dialog → persisted-scope.**
  Lý do: chỉ cần hộp chọn thư mục. `tauri add` đặt persisted-scope trước fs, nhưng persisted-scope phải đăng ký sau fs thì mới khôi phục được quyền vào thư mục Drive khi mở lại app.

- **Thêm `serde_json` vào `Cargo.toml`.**
  Lý do: khi `tauri.conf.json` có mục `plugins`, `generate_context!` sinh code dùng `serde_json`. Crate này đã có sẵn trong cây phụ thuộc của tauri nên không tải thêm gì.

- **`plugins.fs.requireLiteralLeadingDot: false` trong `tauri.conf.json`.**
  Lý do: trên macOS, mặc định mẫu quyền `**` không khớp file bắt đầu bằng dấu chấm, nên không ghi được file tạm `.data.json.tmp` (lỗi tiềm ẩn từ giai đoạn 1, chưa lộ vì mới chạy trên Windows) và `.device-<id>.json.tmp` trên Drive.

- **Hộp chọn thư mục cấp quyền đọc ghi cho thư mục đã chọn và mọi thư mục con (`recursive: true`).** Không cấp quyền fs nào khác ngoài thư mục app data.
  Lý do: app cần tạo và ghi trong `<thư mục>/FamilyBudget/`.

- **File đồng bộ nằm trong `<thư mục đã chọn>/FamilyBudget/`; nếu người dùng chọn thẳng một thư mục tên `FamilyBudget` thì dùng luôn thư mục đó.**
  Lý do: khi dùng 2 tài khoản Google, người kia có thể thêm lối tắt tới chính thư mục `FamilyBudget`; tránh tạo `FamilyBudget/FamilyBudget` khiến hai máy không thấy nhau.

- **Chỉ đọc file khớp `device-<id>.json` / `device-<id>.enc.json` với id chỉ gồm chữ, số, dấu gạch.**
  Lý do: bỏ qua file tạm và bản sao `device-<id> (1).json` mà Google Drive có thể tạo khi xung đột.

- **Kết quả merge sắp xếp mỗi collection theo `id`; phần đầu file (`deviceId`, `writtenAt`) giữ của máy local.** `householdUsers` không còn dựa vào thứ tự trong mảng: admin trước, rồi theo `createdAt`, rồi `id`.
  Lý do: `merge(a, b)` và `merge(b, a)` ra đúng cùng một mảng. Hai người dùng được tạo cùng một thời điểm nên phải có quy tắc thứ tự rõ ràng.

- **So sánh chuỗi theo mã ký tự, không dùng `localeCompare`. Nếu `updatedAt` và `updatedBy` đều bằng nhau (rất hiếm) thì so nội dung bản ghi.**
  Lý do: hai máy luôn chọn cùng một bản, dù ngôn ngữ hệ thống khác nhau.

- **File của gia đình khác (tập người dùng khác) bị bỏ qua khi sync; kết nối thư mục như vậy trong Cài đặt bị từ chối.**
  Lý do: gộp hai bộ dữ liệu khác nhau sẽ ra 4 người dùng. Giới hạn: máy đã tự tạo dữ liệu riêng không tham gia được thư mục của máy kia; chưa có chức năng bỏ dữ liệu riêng để tham gia.

- **Máy thứ hai tham gia bằng cách gộp mọi file `device-*.json` của máy khác trong thư mục** (không chỉ file của máy admin). File hỏng được liệt kê, file có `schemaVersion` cao hơn thì báo cần cập nhật app.
  Lý do: cùng một luật với lượt sync thường; thư mục có thể còn file của máy cũ đã cài lại.

- **Thiết lập lần đầu (tạo mới) bắt buộc chọn thư mục Drive; thư mục được kiểm tra lúc chọn và kiểm tra lại ngay trước khi tạo.** Máy đã có dữ liệu từ trước (giai đoạn 1) chọn thư mục trong Cài đặt, không phải thiết lập lại.
  Lý do: SPEC mục 5 và 8; không bao giờ tạo bộ dữ liệu thứ hai trong cùng thư mục.

- **Sau thay đổi local, hết 10 giây debounce thì chạy cả một lượt sync** (đọc file máy kia, gộp, rồi ghi file của mình), không chỉ ghi.
  Lý do: chỉ có một đường đi qua khóa chống chạy song song; đọc thêm một file nhỏ gần như không tốn gì.

- **Focus lại cửa sổ (sự kiện focus của Tauri) chỉ sync nếu lượt trước đã xong hơn 30 giây.**
  Lý do: chuyển qua lại giữa các cửa sổ liên tục không tạo nhiều lượt ghi lên Drive.

- **Tắt app trong vòng 10 giây sau khi sửa thì file Drive chưa được ghi; lượt sync khi mở app lần sau sẽ ghi.** Không chặn việc đóng cửa sổ để ghi.
  Lý do: đơn giản; `data.json` đã được lưu ngay.

- **Backup trước khi gộp là snapshot dữ liệu trong bộ nhớ** (bằng nội dung `data.json`), tên theo giờ local, trùng giây thì thêm `-2`, `-3`. Backup lỗi thì không áp dụng kết quả gộp và lượt sync báo lỗi. Nếu người dùng sửa trong lúc đang ghi backup, kết quả được gộp lại vào bản mới nhất trước khi lưu. "12 tháng gần nhất" gồm tháng hiện tại và 11 tháng trước.
  Lý do: SPEC mục 9; không mất thay đổi nào của người dùng.

- **Lệch giờ: kiểm tra `writtenAt` của file máy kia, ngoài `updatedAt` của từng bản ghi.**
  Lý do: phát hiện ngay ở lượt sync đầu, không phải chờ máy kia sửa một bản ghi.

- **File máy kia đã mã hóa (`.enc.json`): giai đoạn 2 bỏ qua kèm cảnh báo.** Giai đoạn 4 thêm giải mã.

- **Ổ Drive chưa mount (Google Drive chưa chạy) được báo là "Lỗi: không tìm thấy thư mục Drive".**
  Lý do: khi ổ không tồn tại, plugin-fs báo lỗi quyền thay vì trả về `false`.

- **Cách hiện trạng thái sync:** góc sidebar luôn có trạng thái và nút "Sync ngay". "Chưa thấy dữ liệu từ máy kia" khi chưa đọc được file hợp lệ nào của máy khác. File lỗi → dòng cảnh báo nhẹ ở sidebar, chi tiết trong Cài đặt. Máy kia dùng bản mới hơn và lệch giờ → thêm banner ở đầu vùng nội dung. Lần sync thành công cuối quá 1 giờ → màu cảnh báo, kể cả khi máy vừa ngủ dậy chưa tới lượt sync định kỳ. `lastSyncAt` được lưu vào `settings.json` sau mỗi lượt thành công.
  Lý do: lỗi cần người dùng xử lý thì phải dễ thấy; cảnh báo nhẹ thì không làm phiền.

- **Màn hình Cài đặt ở giai đoạn 2 chỉ có phần Đồng bộ và thông tin máy.** Đồng bộ gồm: thư mục Drive, chu kỳ sync (1–60 phút), trạng thái, thời điểm máy kia ghi file, danh sách file bị bỏ qua, "Sync ngay", và thêm nút "Ngắt kết nối" (SPEC không có). Thông tin máy gồm: mã máy, đường dẫn `data.json`, thư mục backup.
  Lý do: các phần còn lại thuộc giai đoạn 3–4. "Ngắt kết nối" giúp tắt sync khi thư mục hỏng mà không phải sửa file cài đặt.

- **Thử thật trên một máy Windows 11 với 2 instance app (identifier `com.familybudget.testa`/`testb`, mỗi instance có app data riêng) và một thư mục local đóng vai thư mục Google Drive.** Chưa thử với Google Drive for Desktop thật (máy phát triển chưa cài) và chưa thử trên macOS.
  Lý do: chỉ có một máy; phần đồng bộ file giữa 2 máy do Google Drive đảm nhận, app chỉ đọc ghi file trong thư mục.

- **Giai đoạn 2 được chấp nhận khi chưa thử trên macOS và chưa thử với Google Drive for Desktop thật trên 2 máy.** Tiêu chí "Thử thật trên 2 máy" (SPEC mục 10) còn treo, sẽ kiểm chứng khi có máy Mac.
  Lý do: hiện chỉ có một máy Windows; người dùng quyết định chuyển sang giai đoạn 3.

## 2026-10-23 — Giai đoạn 3

- **Phân quyền là một hàm `can(user, action, record?)` trong `core/permissions.ts`**, dùng chung cho UI và store; mọi thao tác dữ liệu trong store đều gọi `assertCan`. Màn hình Ngân sách, Danh mục, Định kỳ ẩn khỏi menu với thành viên. Nếu đang ở màn hình admin mà mất quyền (chuyển quyền, hoặc nhận thay đổi vai trò từ máy kia) thì app quay về Tổng quan. _(Đã thay: thành viên cũng mở được ba màn này, xem mục "2026-10-26 — Thành viên quản lý Ngân sách, Danh mục, Định kỳ; bỏ khóa tháng".)_
  Lý do: SPEC mục 7; một chỗ duy nhất quyết định quyền nên UI và store không lệch nhau.

- **Khoản chi người khác nhập: thành viên vẫn mở được nhưng chỉ xem** (nút "Xem" thay cho "Sửa / Xóa", form bị khóa kèm dòng "Khoản này do … nhập, bạn chỉ xem được").
  Lý do: vẫn xem được ghi chú và người nhập mà không sửa nhầm.

- **Khoản sinh từ chi tiêu định kỳ ghi người nhập (và người sửa) là người sửa mẫu gần nhất** (luôn là admin), ghi chú là tên mẫu.
  Lý do: hai máy sinh ra cùng một nội dung; thành viên không sửa nhầm khoản định kỳ.

- **Ngoài lúc mở app và sau mỗi lượt sync, khoản định kỳ còn được sinh ngay khi admin lưu mẫu.** Sửa mẫu không đổi khoản đã sinh của tháng này; xóa mẫu không xóa các khoản đã sinh.
  Lý do: thấy kết quả ngay sau khi thêm mẫu; khoản đã sinh là dữ liệu thật, sửa riêng trong màn hình Khoản chi nếu cần.

- **Ngân sách phải lớn hơn 0; để trống ô là bỏ mức đó (xóa mềm), đặt lại thì dùng lại bản ghi cũ (id cố định).** Mức riêng của tháng đã khóa không sửa được (trừ khi admin mở khóa tạm). Đổi mức mặc định thì các tháng đã khóa đang dùng mức mặc định cũng thấy mức mới. _(Đã thay: bỏ khóa tháng, xem mục "2026-10-26 — Thành viên quản lý Ngân sách, Danh mục, Định kỳ; bỏ khóa tháng".)_
  Lý do: SPEC mục 6 chỉ chặn sửa ngân sách _của_ tháng đã khóa; giữ mức mặc định đơn giản, không chép mức cũ vào từng tháng.

- **Tên danh mục không được trùng (không phân biệt hoa thường, bỏ khoảng trắng thừa).**
  Lý do: import CSV khớp danh mục theo tên, nên tên phải không nhập nhằng.

- **Danh mục chưa từng dùng thì xóa được (xóa mềm); đã có khoản chi (kể cả khoản đã xóa) hoặc mẫu định kỳ dùng thì chỉ ẩn được.** Danh mục mới dùng id UUID.
  Lý do: SPEC mục 4 ("danh mục đã dùng chỉ được ẩn"). Chỉ admin tạo danh mục nên không cần id cố định.

- **Sắp xếp danh mục bằng kéo thả HTML5 (kéo biểu tượng ⠿), kèm nút lên/xuống cho bàn phím. Tắt `dragDropEnabled` của cửa sổ Tauri.**
  Lý do: trên Windows, xử lý thả file của Tauri chặn kéo thả HTML5 trong trang. App không cần nhận file thả vào cửa sổ (CSV mở bằng hộp chọn file); tắt đi cũng tránh việc file thả vào được cấp quyền đọc.

- **Người dùng: admin đổi được tên, màu và chuyển quyền admin cho người kia** (người cũ thành thành viên, luôn còn đúng một admin). Màu chỉ lưu khi đóng bảng chọn màu.
  Lý do: SPEC mục 7; không ghi dữ liệu liên tục khi đang kéo chọn màu.

- **Export CSV:** UTF-8 có BOM, xuống dòng CRLF, ô chứa `,` `;` `"` hoặc xuống dòng được đặt trong ngoặc kép. Ô bắt đầu bằng `=` `+` `-` `@` được thêm dấu `'` phía trước để Excel không chạy như công thức; import thì bỏ dấu này. Khoản chi xếp cũ nhất trước. Có ở cả màn Báo cáo và Cài đặt. Hộp lưu file mặc định mở ở thư mục Tải xuống.
  Lý do: Excel mở đúng tiếng Việt và không chạy công thức lạ từ ghi chú; export rồi import lại ra đúng dữ liệu.

- **Import CSV:** tên cột không phân biệt hoa thường, thứ tự tùy ý; bắt buộc `date, amount, category, paidBy`; `createdBy` để trống thì là người đang import. Nhận ngày `YYYY-MM-DD` hoặc `YYYY/M/D`, số tiền có `¥`, dấu phẩy hoặc `円`, dấu phân cách `,` `;` hoặc tab. File không phải UTF-8 bị từ chối kèm hướng dẫn lưu "CSV UTF-8" trong Excel. Dòng thuộc tháng đã khóa là dòng lỗi. Dòng trùng so với khoản đã có và với dòng trước đó trong file. Khi bấm nhập, file được kiểm tra lại trên dữ liệu mới nhất (sau khi tạo backup), người sửa của khoản mới là người import.
  Lý do: Excel ở máy Nhật/Việt lưu ngày và số theo cài đặt vùng; không nhập trùng hay nhập vào tháng đã khóa.

- **Khôi phục backup bỏ qua luật khóa tháng** (ghi lại cả bản ghi của tháng đã khóa) và từ chối bản backup của gia đình khác. Trước khi xác nhận hiện số khoản chi, khoảng ngày, và số bản ghi sẽ ghi lại / xóa.
  Lý do: khôi phục là công cụ cứu dữ liệu nên phải đưa được mọi thứ về đúng bản backup; chỉ admin làm được.

- **Backup JSON:** "Lưu file backup" (ai cũng làm được, như export CSV) ghi nội dung `data.json` hiện tại; "Khôi phục từ file backup" (admin) dùng đúng cách khôi phục ở SPEC mục 9 như với bản backup tự động.
  Lý do: cùng một luồng khôi phục, không có đường ghi đè dữ liệu thứ hai.

- **Báo cáo:** biểu đồ cột tổng chi 12 tháng kết thúc ở tháng đang chọn, bấm vào cột để chuyển tháng, có bảng số liệu mở ra được. Một chuỗi số liệu dùng một màu (màu slot 1 đã kiểm ở giai đoạn 1), không có chú thích; cột rộng tối đa 24px, đầu bo 4px, lưới ngang mảnh. Bảng "chi theo danh mục so với ngân sách" có thanh tiến độ cùng quy ước màu với Tổng quan, cảnh báo luôn kèm icon và chữ.
  Lý do: làm theo skill dataviz (một chuỗi không cần chú thích, giá trị luôn đọc được không cần tooltip).

- **Cài đặt giai đoạn 3:** thứ tự Người dùng và vai trò → Đồng bộ → Backup → Import/export CSV → Máy này. Mã hóa và cập nhật app thêm ở giai đoạn 4.
  Lý do: theo thứ tự ở SPEC mục 8, màn hình 9.

- **Thêm quyền `dialog:allow-save`** (lưu CSV, lưu backup JSON). Hộp mở/lưu file chỉ cấp quyền cho đúng file được chọn.

## 2026-10-23 — Giai đoạn 4

### Mã hóa file trên Drive

- **Hai máy dùng chung một salt: admin tạo salt ngẫu nhiên 16 byte khi đặt mật khẩu; máy kia lấy salt từ file `.enc.json` của máy admin rồi dẫn xuất lại khóa từ mật khẩu nhập vào. `Settings.encryption` thêm trường `saltB64` cạnh `keyB64`.**
  Lý do: SPEC chỉ cho lưu khóa đã dẫn xuất, không lưu mật khẩu. Nếu mỗi máy dùng salt riêng thì hai máy ra hai khóa khác nhau và không đọc được file của nhau. Settings không đồng bộ nên thêm trường không cần tăng `schemaVersion`.

- **File mã hóa phải đúng `v: 1`, `alg: "AES-GCM"`, `kdf: "PBKDF2-SHA256"`, `iter: 600000`, salt 16 byte, IV 12 byte; khác đi là "File mã hóa sai cấu trúc" và file bị bỏ qua như file hỏng.**
  Lý do: khóa lưu trên máy không kèm số vòng, nên mọi máy phải dẫn xuất với cùng số vòng; cũng chặn file lạ đòi số vòng rất lớn làm treo app.

- **Mật khẩu ít nhất 8 ký tự, nhập hai lần khi đặt mới.** Đặt hoặc đổi mật khẩu luôn tạo salt mới.
  Lý do: SPEC không nói; đây là mức tối thiểu phổ biến. Nhập hai lần tránh gõ nhầm mật khẩu mà máy kia phải nhập lại đúng.

- **Bật mã hóa: máy ghi `device-<id>.enc.json`, ghi xong thì xóa `device-<id>.json` của chính máy đó (tắt mã hóa thì ngược lại).** Lỗi khi xóa làm lượt sync báo lỗi và thử lại ở lượt sau.
  Lý do: để file dạng thường nằm lại trên Drive thì bật mã hóa không có tác dụng, và máy kia vẫn đọc bản cũ. Đây là bản sao để đồng bộ do chính máy này ghi, không phải dữ liệu người dùng: nội dung đã có đủ trong `data.json` và file vừa ghi, nên không trái nguyên tắc 7. Google Drive còn giữ file đã xóa trong Thùng rác 30 ngày.

- **Mã hóa là cài đặt của từng máy (`settings.json`). Admin bật, đổi mật khẩu, tắt (quyền mới `encryption:manage`). Mọi máy đều nhập được mật khẩu chung khi không đọc được file mã hóa của máy kia (chưa có khóa, hoặc khóa không giải mã được); nhập đúng thì máy đó cũng ghi file mã hóa. Thành viên không tắt được mã hóa.**
  Lý do: SPEC mục 7 chỉ cho admin quản lý mật khẩu, mục 9 cho máy thứ hai nhập cùng mật khẩu. Nhập mật khẩu được kiểm tra bằng chính file của máy kia nên không đặt được mật khẩu mới.

- **Tắt mã hóa vẫn giữ khóa trên máy (`enabled: false`, còn `keyB64`, `saltB64`).**
  Lý do: máy kia vẫn đang ghi file mã hóa; giữ khóa thì máy admin vẫn đọc được, đồng bộ không bị gián đoạn.

- **Máy chưa nhập mật khẩu vẫn ghi file dạng thường và vẫn đồng bộ một chiều (máy admin đọc được file của nó). Máy đó hiện banner "Máy kia đã mã hóa dữ liệu trên Drive..." kèm nút "Mở Cài đặt"; thẻ Mã hóa trên máy admin báo "File của máy kia trên Drive chưa mã hóa".**
  Lý do: dừng hẳn đồng bộ khi chưa có mật khẩu thì máy admin cũng mất dữ liệu của máy kia. Khoảng thời gian chưa nhập mật khẩu thường ngắn và cả hai máy đều được báo.

- **Thiết lập lần đầu (tham gia) mà thư mục có file mã hóa: bắt buộc nhập mật khẩu trước khi chọn "Tôi là ...", kể cả khi thư mục còn file dạng thường. App thử mọi file mã hóa trong thư mục (mỗi salt dẫn xuất một lần).**
  Lý do: máy mới cũng phải ghi file mã hóa ngay. Thư mục có thể còn file của máy cũ đã cài lại với mật khẩu khác.

- **Giải mã nằm ở `sync/syncService.ts` (`openRemoteFiles`, giữa bước đọc file và bước gộp), `core/sync.ts` chỉ nhận nội dung JSON đã giải mã. Lý do bỏ qua file có thêm `encrypted` (chưa có mật khẩu) và `decrypt-failed` (sai mật khẩu, thông báo đúng câu của SPEC). Sidebar có dòng riêng cho hai lý do này, không tính vào "Bỏ qua N file lỗi".**
  Lý do: Web Crypto là bất đồng bộ, còn `mergeRemoteFiles` là hàm thuần đồng bộ. `storage/crypto.ts` chỉ dùng Web Crypto nên test được bằng Vitest trong Node.

- **Thư mục, khóa đọc và khóa ghi lấy cùng lúc từ một bản settings (`SyncEnv.target()`), adapter được tạo theo chế độ mã hóa của bản settings đó. Khóa trong settings hỏng thì lượt sync báo lỗi, không ghi file dạng thường thay thế.**
  Lý do: tên file (`.enc.json` hay `.json`) luôn khớp với nội dung; không bao giờ vô tình ghi dữ liệu không mã hóa khi người dùng đã bật mã hóa.

### Cập nhật app và phát hành

- **Endpoint cập nhật: `https://github.com/carnegieducanh/family_budget/releases/latest/download/latest.json`, tức repo public `carnegieducanh/family_budget`.** Chưa làm phương án repo private + repo public chỉ chứa releases; INSTALL.md mục 3.1 ghi các chỗ cần sửa nếu chọn phương án đó.
  Lý do: repo do người dùng tạo sẵn, tên `family_budget` (gạch dưới, khác tên package `family-budget`); GitHub coi hai tên này là hai repo khác nhau. Repo public là phương án đơn giản nhất SPEC nêu. Đổi tên repo phải sửa endpoint trước bản phát hành đầu tiên.

- **Khóa ký bản cập nhật không đặt mật khẩu, lưu ở `~/.tauri/family-budget.key` (ngoài repo); public key ở `plugins.updater.pubkey`. Workflow đọc secret `TAURI_SIGNING_PRIVATE_KEY` (và `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` nếu sau này có).**
  Lý do: giống các dự án khác trên máy này (`atomic`, `daytask`). Private key không vào repo theo SPEC mục 9.

- **Giữ `requireSignedVersion: true` (do `tauri add updater` bật).**
  Lý do: chống hạ cấp: chữ ký phải ghi đúng số phiên bản mà `latest.json` công bố. App chưa có bản phát hành cũ nào thiếu thông tin này; CLI hiện tại ghi `version:x.y.z` vào chữ ký (đã kiểm tra).

- **Chỉ build NSIS trên Windows (`bundle.targets: ["nsis", "app", "dmg"]`, không có MSI); cài cho người dùng hiện tại; cập nhật chạy trình cài ở chế độ `passive` (hiện tiến trình, không cần bấm).**
  Lý do: SPEC mục 9 chỉ cần NSIS `.exe`. Cài cho người dùng hiện tại không cần quyền quản trị.

- **Phiên bản app chỉ lấy từ `package.json` (`tauri.conf.json` → `"version": "../package.json"`); tăng bằng `npm version X.Y.Z`. Số trong `Cargo.toml` không dùng.**
  Lý do: một nguồn duy nhất, `npm version` tạo luôn commit và tag `vX.Y.Z` mà workflow cần.

- **Ghi chú phát hành lấy từ mục `## X.Y.Z` trong `docs/CHANGELOG.md` (thêm file này). Workflow dừng nếu thiếu mục đó, hoặc tag khác `version` trong `package.json`.**
  Lý do: banner cập nhật cần ghi chú thay đổi (SPEC mục 9), và `latest.json` được tạo lúc build nên ghi chú phải có trước khi build.

- **Workflow `.github/workflows/release.yml` chạy khi đẩy tag `v*.*.*`: kiểm tra code (typecheck, lint, format, test) → tạo release nháp → build Windows (`windows-latest`) và macOS (`macos-latest`, `--target aarch64-apple-darwin`) song song bằng `tauri-action` → bỏ nháp. macOS dùng ad-hoc signing có sẵn trong cấu hình.**
  Lý do: release chỉ hiện khi cả hai bản đã lên, nên `latest.json` không bao giờ thiếu một nền tảng; build lỗi thì người dùng không thấy gì.

- **Id của release nháp lấy từ phản hồi của lệnh tạo (`gh api` POST), không tìm lại trong danh sách releases. Trước khi bỏ nháp, workflow tải `latest.json` về và dừng nếu thiếu file hoặc thiếu bản Windows/macOS.**
  Lý do: lần chạy đầu (v0.1.0, 2026-10-24) mọi bước đều xanh nhưng release được đăng mà không có file nào: `tauri-action` không nhận được `releaseId` nên build xong rồi bỏ qua bước tải lên, không báo lỗi. Kiểm tra ở bước đăng bắt được cả những nguyên nhân khác khiến release thiếu file.

- **Kiểm tra cập nhật khi mở app (cả ở màn hình thiết lập lần đầu) và mỗi 24 giờ. Lỗi kiểm tra lúc mở app không hiện banner, chỉ ghi ở thẻ "Phiên bản app" trong Cài đặt. Banner có thêm nút "Để sau" (ẩn đến lần mở app sau; bấm "Kiểm tra cập nhật" thì hiện lại).**
  Lý do: máy mới cài bản cũ có thể cần cập nhật mới tham gia được thư mục của máy kia. Mất mạng không phải lỗi người dùng cần xử lý.

- **Bấm "Cập nhật": tải (có tiến trình), chờ các lần ghi `data.json` đang xếp hàng xong (`flushWrites`), rồi cài và khởi động lại (`plugin-process`, chỉ cấp quyền `process:allow-restart`). Không chạy thêm lượt sync trước khi cài.**
  Lý do: trên Windows plugin thoát app ngay khi mở trình cài. Lượt sync khi mở lại app sẽ ghi file Drive.

- **Thêm `src/update/appUpdate.ts` (gọi plugin) và `state/updateStore.ts` (trạng thái hiển thị), ngoài cây thư mục ở SPEC mục 3.**
  Lý do: giống cách `sync/appSync.ts` nối lịch sync với store; không trộn lệnh Tauri vào store dữ liệu.

- **Bật CSP cho bản build: `default-src 'self' ipc: http://ipc.localhost; img-src 'self' data:; style-src 'self' 'unsafe-inline'`; `devCsp: null`.**
  Lý do: app không tải gì từ ngoài, CSP chặn thêm một lớp nếu có nội dung lạ được chèn vào trang. Tắt ở chế độ dev vì Vite chèn style và HMR. Đã kiểm tra trên bản release: không có vi phạm CSP, CSS và biểu đồ hiển thị đúng.

- **Gộp quyền của updater vào `capabilities/default.json` (bỏ file `desktop.json` mà `tauri add` tạo); đăng ký updater và process sau persisted-scope.**
  Lý do: app chỉ chạy desktop; một file capability dễ xem hơn. Giữ đúng thứ tự fs → dialog → persisted-scope của giai đoạn 2.

### Kiểm chứng

- **Đã thử thật trên Windows 11 (một máy):** mã hóa với 3 instance app và một thư mục local đóng vai Drive (bật, nhập sai và đúng mật khẩu, dữ liệu đi hai chiều qua file mã hóa, đổi mật khẩu, máy mới tham gia thư mục đã mã hóa, tắt mã hóa); cập nhật thật từ bản release 0.1.0 lên 0.1.1 qua `latest.json` trên server local (banner kèm ghi chú, chữ ký sai bị từ chối, cài passive, app tự mở lại ở 0.1.1, dữ liệu còn nguyên); `npm run tauri build` ra file NSIS và `.sig` có ghi phiên bản.
- **Chưa kiểm chứng:** workflow GitHub Actions (repo chưa có trên GitHub, máy không có `gh`), bản build macOS và các bước Gatekeeper, cập nhật trên macOS, Google Drive for Desktop thật.

## 2026-10-25 — Làm mới giao diện, thêm theme sáng

- **Theme có 3 lựa chọn: Sáng, Tối, Theo hệ thống (mặc định). Chọn nhanh bằng 3 icon ở sidebar, hoặc ở Cài đặt → Giao diện. Đây là lựa chọn của từng máy, không đồng bộ.**
  Lý do: trước đây app chỉ theo hệ thống, nên máy để Windows ở chế độ tối thì không xem được bản sáng. Mỗi người có thể thích một theme khác nhau.

- **Lựa chọn lưu trong `localStorage` của WebView (khóa `family-budget.theme`), không lưu trong `settings.json`. `index.html` có một đoạn script nhỏ đặt `data-theme` từ khóa này trước khi vẽ lần đầu.**
  Lý do: `settings.json` chỉ đọc được bất đồng bộ qua plugin fs, nên app sẽ vẽ theme hệ thống trước rồi mới đổi, gây nháy màu lúc mở app. Mất lựa chọn (ví dụ xóa dữ liệu WebView) chỉ làm theme quay về "Theo hệ thống". Đoạn script nằm trong HTML nên Tauri tự thêm hash của nó vào CSP khi build.

- **CSS: `<html data-theme="light|dark">` khi người dùng chọn Sáng/Tối; không có thuộc tính thì đi theo `prefers-color-scheme`. Bộ màu tối viết một lần trong mixin `dark-tokens` và dùng cho cả hai trường hợp. JS (màu biểu đồ) đọc theme đang áp dụng qua `useColorScheme()`.**
  Lý do: chỉ một nguồn sự thật cho màu, đổi theme không phải tải lại.

- **Gọi `getCurrentWindow().setTheme()` để thanh tiêu đề của hệ điều hành đổi theo (`null` = theo hệ thống); thêm quyền `core:window:allow-set-theme`.**
  Lý do: nếu không gọi, chọn Sáng khi Windows đang tối thì thanh tiêu đề vẫn đen, trông như lỗi.

- **Thêm `lucide-react` cho icon giao diện (menu, nút, trạng thái), thay emoji và ký tự ⚠ ⛔ ✓ ⟳. Emoji của danh mục giữ nguyên vì là dữ liệu người dùng tự chọn.**
  Lý do: emoji hiển thị khác nhau giữa Windows và macOS, không cùng nét với chữ. Lucide chỉ đóng gói những icon được import (28 icon).

- **Thêm font Inter (`@fontsource-variable/inter`), đóng gói trong app.**
  Lý do: Windows (Segoe UI) và macOS (SF) trông giống nhau; Inter có bộ chữ tiếng Việt và chữ số cùng độ rộng cho cột tiền. Không tải font qua mạng, vì CSP chỉ cho phép `'self'` và app phải chạy được khi không có mạng.

- **Các mẫu style lặp ở nhiều màn hình (bảng số liệu, ô nhập có nhãn, nhóm nút chọn, nhãn trạng thái, hộp thông báo, dòng "chưa có dữ liệu") gom vào `styles/_mixins.scss`. Tên class trong từng component giữ nguyên.**
  Lý do: trước đây mỗi màn hình chép lại các khối CSS này, sửa một chỗ dễ lệch chỗ khác. Giữ tên class để không phải sửa JSX.

- **Nền card ở theme tối đổi từ `#1e232a` sang `#171b21`. Đã chạy lại validator của skill dataviz: bảng màu biểu đồ (5 slot tối) vẫn đạt mọi cổng với các cặp kề nhau và đều ≥ 3:1 so với nền mới, nên giữ nguyên. Nền card sáng vẫn là `#ffffff`.**
  Lý do: bảng màu chỉ đúng với nền đã kiểm.

- **Nội dung chính rộng tối đa 1180 px, căn giữa; hộp thoại có nút Đóng (X) ngoài phím Esc và bấm ra ngoài.**
  Lý do: trên màn hình rộng, bảng và thẻ không bị kéo quá dài; nút Đóng là cách quen thuộc với người không biết phím tắt.

## 2026-10-25 — Bảng màu theo app ゆうちょ銀行

- **Theme sáng lấy màu của app ゆうちょ通帳アプリ, đo trên ảnh chụp màn hình chính thức (App Store) và CSS của jp-bank.japanpost.jp: xanh chủ đạo `#009900` (số dư, nút gạt, tab đang chọn; website cũng dùng đúng màu này), gradient phần đầu màn hình `#75c667 → #a6d570`, nền xanh nhạt của khung thoại `#dff1d3`, chữ `#39414a`, chữ phụ `#667366`; nền trang `#f6f7ef`, viền `#e4e6d9` / `#cdceca` lấy từ website. Logo dùng gradient của icon app (`#40b340` → `#a0d04e` theo đường chéo).**
  Lý do: người dùng muốn màu chủ đạo và gradient giống hệt app ゆうちょ.

- **Chữ trắng trên `#009900` chỉ đạt 3.8:1 (dưới mức 4.5:1 của WCAG AA cho chữ thường). Nút vẫn dùng đúng `#009900` như app gốc; chữ xanh cỡ nhỏ (menu đang chọn, nhãn) dùng `--color-primary-strong` `#007a00` (≥ 4.5:1 trên nền trắng và nền `#dff1d3`). Số tiền lớn dùng `--color-primary-large`.**
  Lý do: giữ đúng màu thương hiệu ở chỗ dễ thấy, nhưng chữ nhỏ vẫn đọc được.

- **App ゆうちょ không có theme tối, nên theme tối tự dựng: nền tối ngả xanh lá (`#0f130f`, card `#171d17`), nút vẫn `#009900`, chữ xanh `#75c667` (màu đầu của gradient sáng), gradient cùng hướng và sắc nhưng tối (`#1e4d1d → #3a5419`).**
  Lý do: giữ nhận diện xanh ゆうちょ ở cả hai theme; chữ sáng đọc được trên gradient tối.

- **Gradient đặt thành dải cao 280 px ở đầu vùng nội dung (mixin `brand-band`), nhạt dần về màu nền, cuộn theo nội dung; card nằm đè lên phần nhạt dần như card số dư trong app. Nút "Về tháng này" ở tiêu đề đổi từ ghost sang secondary, lỗi ở tiêu đề có nền riêng.**
  Lý do: chữ xám và chữ đỏ không có nền riêng không đủ tương phản trên nền xanh.

- **Biểu đồ: slot 1 là `#009900`. Donut còn tối đa 4 danh mục có màu riêng (xanh lá, xanh dương, hồng, tím), phần còn lại gộp thành lát xám (≤ 5 lát, trước đây 6). Biểu đồ cột theo tháng dùng `#009900` ở cả hai theme. Đã chạy validator của skill dataviz trên nền card mới (sáng `#ffffff`, tối `#171d17`): với mọi số lát 2–4, mọi cặp kề nhau trên vòng tròn, kể cả cặp nối vòng lát cuối ↔ slot 1, đạt cổng CVD và normal-vision.**
  Lý do: lát lớn nhất luôn ở slot 1 nên luôn kề với mọi lát khác qua cặp nối vòng. Cam và đỏ lẫn với `#009900` khi mù màu đỏ-lục (ΔE < 5), vàng tối trùng độ sáng với xanh (ΔE 0.1), xanh ngọc quá gần xanh lá với mắt thường; không tìm được cách xếp 5 màu nào đạt cả hai theme. Thay cho quyết định "tối đa 6 lát" ở mục Giai đoạn 1.

## 2026-10-25 — Bảng vừa cửa sổ hẹp

- **Bảng Khoản chi: cột Ngày chỉ ghi `25/10` (tháng đã có ở bộ chọn tháng), Sửa / Xóa / Xem thành nút icon có tooltip, tên danh mục không xuống dòng (dài quá 160 px thì cắt "…"), Ghi chú nhận phần bề rộng còn lại và là cột co lại khi cửa sổ hẹp (cắt "…", tooltip có đủ ghi chú). Nhãn "định kỳ" đứng trước ghi chú.**
  Lý do: ở bề rộng tối thiểu 1024 px, 7 cột không xuống dòng rộng hơn card khoảng 40 px nên bảng tràn ra ngoài, nút Xóa sát mép, danh mục bị bẻ 3 dòng.

- **Bảng Ngân sách: tiêu đề cột được xuống dòng, ô nhập 120 px (trước 140 px).**
  Lý do: cùng lỗi, nặng hơn: bảng tràn khỏi cửa sổ, cột Đã chi bị che.

- **Mọi bảng số liệu dùng lề ô 8 px khi cửa sổ hẹp hơn 1200 px (mixin `data-table`). Bảng Khoản chi và Ngân sách được bọc trong khung cuộn ngang (mixin `table-scroll`).**
  Lý do: khung cuộn là lớp dự phòng khi dữ liệu cực dài (tên người, số tiền hàng triệu): bảng cuộn trong card thay vì tràn ra ngoài và làm cả màn hình cuộn ngang.

## 2026-10-25 — Bớt ô, cột và nút thừa

- **Modal Thêm/Sửa khoản chi không còn nhóm nút "Người trả". Khoản mới luôn có người trả là người đang dùng app (máy đó); sửa khoản cũ thì giữ người trả đã lưu. Khi sửa, nếu người trả khác người nhập thì dòng cuối modal ghi thêm "· người trả …".**
  Lý do: mỗi người nhập khoản mình trả trên máy của mình, form gọn hơn; giữ người trả cũ để admin sửa khoản của người kia không làm lệch số tiền bù. Mẫu định kỳ và import CSV vẫn chọn được người trả như trước.

- **Bảng Khoản chi bỏ cột "Người nhập" (chấm màu). Ai nhập vẫn xem được ở dòng cuối modal Sửa/Xem ("Nhập bởi …").**
  Lý do: người nhập nay gần như luôn là người trả nên cột này lặp lại cột Người trả; bảng gọn hơn ở cửa sổ hẹp.

- **Màn Danh mục bỏ nút mũi tên lên/xuống; chỉ sắp xếp bằng kéo biểu tượng ⠿.**
  Lý do: user chỉ dùng kéo thả, hai nút làm mỗi dòng chật. Đổi lại không còn cách sắp xếp bằng bàn phím.

## 2026-10-25 — Ngân sách danh mục có khoản định kỳ lấy từ Định kỳ

- **Danh mục có khoản định kỳ đang bật lấy ngân sách (mức chung mọi tháng) bằng đúng tổng các khoản đó. Ở màn Ngân sách, ô của danh mục này chỉ hiện số kèm nhãn "định kỳ", không nhập tay được (`setManualBudget` từ chối); muốn đổi thì sửa mẫu ở màn Định kỳ. Mỗi lần admin thêm, sửa, bật, tắt hay xóa mẫu, app đặt lại ngân sách của các danh mục liên quan bằng tổng mới (`applyRecurringToBudgets` trong `core/budget.ts`), cùng lúc lưu mẫu; danh mục hết khoản định kỳ đang bật thì bỏ mức và quay về nhập tay. Danh mục khác và ngân sách tổng vẫn nhập tay. Thêm mẫu vào danh mục đang có ngân sách nhập tay thì mức đó bị thay; form mẫu có dòng báo trước. Tháng bắt đầu của mẫu không xét.**
  Lý do: user chỉ có tiền nhà và internet là cố định, còn lại biến động. Hai cách làm trước trong cùng ngày bị bỏ: nút "Gợi ý ¥X" (user không muốn bấm gợi ý) và cộng phần chênh lệch vào mức nhập tay (một ô vừa có phần nhập tay vừa có phần định kỳ nên số không khớp với màn Định kỳ, khó hiểu). Mỗi danh mục giờ chỉ có một nguồn: định kỳ hoặc nhập tay. Đổi lại, một danh mục không thể vừa có khoản cố định vừa có ngân sách cho khoản biến động (ví dụ "Internet / Điện thoại" mà tiền điện thoại biến động): khi đó nên tách khoản biến động sang danh mục khác. Chỉ máy admin ghi, vào lúc sửa mẫu. Bản A/B lúc đổi chưa có mẫu định kỳ nào nên không cần chuyển dữ liệu.

## 2026-10-25 — Màn Ngân sách chỉ còn 2 cột

- **Bảng Ngân sách chỉ còn cột "Đang áp dụng" (ô nhập, hoặc số lấy từ Định kỳ) và "Đã chi". Số nhập vào là mức chung cho mọi tháng (bản ghi `budget-default-…`). Bỏ cột "Mặc định hàng tháng" và cột mức riêng của tháng đang xem, nên không còn đặt ngân sách riêng cho từng tháng từ giao diện; bỏ luôn dòng ghi chú "tháng đã khóa nên không sửa được mức riêng".** Khác SPEC mục 8 màn hình 6 ("mức mặc định hàng tháng và ghi đè cho từng tháng").
  Lý do: user thấy 2 cột là đủ, 4 cột rối. Dữ liệu và `core/budget.ts` vẫn hiểu mức riêng của tháng (`getBudgetAmount` ưu tiên mức riêng nếu có), để bản cũ v0.1.0 lỡ tạo mức riêng thì vẫn đọc đúng; lúc đổi, dữ liệu bản A/B không có mức riêng nào.

## 2026-10-26 — Ảnh đại diện

- **Mỗi người có ảnh đại diện (`User.avatar`, không bắt buộc trong dữ liệu): ảnh chọn từ máy, hoặc một trong 24 emoji gợi ý. Ảnh được cắt vuông lấy phần giữa, thu nhỏ còn 128 × 128 px, lưu thẳng trong bản ghi người dùng dạng data URL JPEG (thường 2–10 KB), nên đi theo file sync và backup như mọi trường khác. Chưa đặt thì vẫn hiện chữ cái đầu trên nền màu như trước.**
  Lý do: app không có server hay thư mục ảnh riêng; một file ảnh riêng cạnh `device-*.json` sẽ phải sync, backup, khôi phục riêng. Ảnh 128 px đủ nét cho ô 64 px trên màn hình 2x. Không có bước kéo chọn vùng ảnh: cắt phần giữa đủ cho ảnh chân dung, đổi lại form đơn giản.

- **Ảnh đại diện thay chữ cái đầu ở mọi chỗ trước đây hiện chữ cái (góc dưới sidebar, thẻ "Mỗi người đã trả" ở Tổng quan) và hiện ở Cài đặt → Người dùng. Chấm màu cạnh tên trong các bảng (Khoản chi, Tất toán, Định kỳ...) giữ nguyên.**
  Lý do: user yêu cầu thay chỗ hiện chữ cái đầu; chấm màu trong bảng nhỏ hơn mức ảnh còn nhận ra được.
  (Cùng ngày đổi: tên trong bảng và câu cũng thay bằng ảnh, xem mục "Ảnh đại diện thay tên người".)

- **Đổi ảnh: mỗi người tự đổi ảnh của mình, admin đổi được của cả hai (`canEditAvatar`).** Khác bảng phân quyền SPEC mục 7 ban đầu ("cài đặt người dùng" chỉ admin); tên, màu, vai trò vẫn chỉ admin đổi.
  Lý do: ảnh là thứ riêng của mỗi người, người dùng thường cũng phải đặt được ảnh của mình lúc tham gia.

- **Thiết lập lần đầu bắt buộc chọn ảnh: admin chọn ảnh của mình ngay trong form "Tạo dữ liệu mới"; máy thứ hai và máy chọn lại "Tôi là ..." có thêm bước chọn ảnh sau khi chọn người (đã có ảnh thì chọn sẵn, bấm Hoàn tất). Người đã thiết lập từ trước (dữ liệu v0.1.0) không bị hỏi lại, đặt ở Cài đặt khi muốn.**
  Lý do: user yêu cầu khi khởi tạo tài khoản phải thiết lập ảnh; mỗi người chỉ chọn ảnh của chính mình, nên admin không chọn hộ người còn lại.

- **Không tăng `schemaVersion`.** `avatar` là trường thêm, không bắt buộc; bản v0.1.0 không kiểm tra trường lạ và khi sửa người dùng vẫn giữ nguyên các trường khác của bản ghi, nên đọc và ghi lại dữ liệu có ảnh mà không làm mất ảnh (chỉ không hiện ảnh). Giá trị ảnh đọc từ máy kia chỉ được đưa vào `<img>` khi đúng dạng `data:image/jpeg|png|webp;base64,...` và không quá 150.000 ký tự; giá trị khác hiện như chưa có ảnh.

## 2026-10-26 — Ảnh đại diện thay tên người

- **Ở Tổng quan, Khoản chi, Tất toán, Định kỳ và hai form Sửa khoản chi, Sửa khoản định kỳ, chỗ nào trước đây hiện tên người (kèm chấm màu) nay chỉ hiện ảnh đại diện (`UserFace`). Câu tất toán thành "[ảnh] trả [ảnh] ¥x", lịch sử thành "[ảnh] → [ảnh]", dòng đã thanh toán thành "... · [ảnh] xác nhận". Di chuột lên ảnh thì hiện tên; trình đọc màn hình đọc tên (`role="img"` + `aria-label`).**
  Lý do: user yêu cầu thay tên bằng ảnh đại diện của người tương ứng. App chỉ có hai người, ai cũng nhận ra ảnh của mình và của người kia. Người chưa có ảnh vẫn hiện chữ cái đầu trên nền màu.

- **Giữ tên ở: bộ lọc "Clazuze trả" trong Khoản chi (ô chọn native không hiện được ảnh), màn thiết lập lần đầu (đang chọn "Tôi là ..." nên cần tên), Cài đặt → Người dùng và góc dưới sidebar (đã có ảnh cạnh tên).**

## 2026-10-26 — Chọn cỡ chữ

- **Cài đặt → Giao diện có dòng "Cỡ chữ" với 4 mức: Nhỏ (cỡ chữ ban đầu, thân bài 14 px, là mặc định), Vừa (16 px), Lớn (18 px), Rất lớn (20 px). Mọi cỡ chữ khác (tiêu đề, số tiền lớn, chữ nhỏ) đổi cùng tỉ lệ. Đây là lựa chọn của từng máy, không đồng bộ.**
  Lý do: user thấy chữ hơi nhỏ, khó nhìn, và muốn chọn được vài cỡ; cỡ nhỏ nhất là cỡ hiện tại. Mỗi máy (màn hình, mắt người dùng) cần một cỡ khác nhau.

- **Lưu và áp dụng giống theme: `localStorage` khóa `family-budget.font-size` (mức Nhỏ thì xóa khóa), `index.html` đặt `<html data-font-size="md|lg|xl">` trước khi vẽ lần đầu, `tokens.scss` đổi `--font-scale` theo thuộc tính này và mọi `--font-size-*` = cỡ gốc × `--font-scale`.**
  Lý do: cùng lý do với theme (không nháy lúc mở app). Mọi cỡ chữ của app đã đi qua token nên chỉ cần một hệ số; vài cỡ còn viết cứng px (tên app ở sidebar, nhãn nhóm menu) nhân thêm `--font-scale`.

- **Phóng chữ, không phóng cả giao diện (zoom WebView). Đi kèm chữ: chiều cao nút và ô nhập (`--control-height` = cỡ chữ thân bài + 22 px, lề trên dưới giữ nguyên), icon lucide (`zoom: var(--font-scale)` ở `global.scss`), bề rộng hộp thoại. Giữ nguyên: bề rộng sidebar, khoảng cách giữa các khối, ảnh đại diện, biểu đồ.**
  Lý do: user hỏi cỡ chữ. Zoom cả trang làm vùng nội dung hẹp đi (cửa sổ 1024 px ở 140% chỉ còn ~730 px CSS) nên các bảng đã chỉnh cho vừa 1024 px sẽ tràn. Icon và nút không lớn theo thì trông lệch tỉ lệ với chữ bên cạnh; hộp thoại không rộng theo thì ô chọn bị cắt chữ.

- **Sửa đi kèm để mức Rất lớn không vỡ bố cục: hàng người dùng ở Cài đặt cho xuống dòng (ô màu không bị bóp, nút chuyển quyền admin xuống dòng dưới); trục số tiền của biểu đồ Báo cáo tự đo bề rộng (`width="auto"`) thay vì 56 px; lề trái ô tìm kiếm Khoản chi tính theo icon kính lúp; bảng Định kỳ có khung cuộn ngang như bảng Khoản chi và Ngân sách; chú thích dưới thanh ngân sách ở Tổng quan xuống dòng khi chật.**
  Đã xem trên bản dev mức Rất lớn ở mọi màn (cửa sổ 1280 px và bề rộng tối thiểu 1024 px), mức Lớn ở Cài đặt, mức Nhỏ ở Tổng quan; mức Vừa nằm giữa nên chưa xem riêng. Mọi màn đọc được; ở 1024 px + Rất lớn, bảng Định kỳ cuộn ngang trong card và cột Ghi chú của Khoản chi bị cắt ngắn ("..."). Mức Nhỏ trông y như trước.

## 2026-10-26 — Bỏ chọn màu người dùng

- **Cài đặt → Người dùng và vai trò không còn ô chọn màu; admin chỉ đổi được tên (và chuyển quyền admin). `updateUser` chỉ nhận tên, không đổi màu. Hàng của người dùng không phải admin cũng bỏ chấm màu cạnh tên.** Thay quyết định "admin đổi được tên, màu" ở Giai đoạn 2.
  Lý do: user thấy chọn màu không cần thiết. Từ khi có ảnh đại diện, màu chỉ còn làm nền cho ảnh chữ cái đầu (người chưa chọn ảnh) và chấm màu ở màn thiết lập lần đầu.

- **Trường `color` vẫn giữ trong dữ liệu, không tăng `schemaVersion`.** Người dùng mới nhận màu mặc định lúc thiết lập (`USER_COLORS`); màu đã chọn trước đây giữ nguyên. Bản v0.1.0 trên máy kia vẫn đổi được màu, và màu đó vẫn đồng bộ sang như trước.

## 2026-10-26 — Bấm "Chưa kết nối thư mục Drive" để chọn thư mục

- **Ở góc dưới sidebar, khi trạng thái là "Chưa kết nối thư mục Drive", dòng chữ này có gạch chân và bấm được: mở ngay hộp chọn thư mục Google Drive, chọn xong thì kiểm tra thư mục, kết nối và sync như nút "Chọn thư mục..." trong Cài đặt. Thư mục không dùng được (dữ liệu của gia đình khác) thì báo lỗi ngay dưới dòng đó. Các trạng thái khác không bấm được.**
  Lý do: user muốn kết nối Drive thẳng từ thông báo, không phải vào Cài đặt. Bước kiểm tra và kết nối gom vào `connectSyncFolder` (sync/appSync.ts), Cài đặt và sidebar dùng chung.

## 2026-10-26 — Tên cạnh ảnh đại diện ở Tổng quan và Tất toán

- **Ở Tổng quan và Tất toán, ảnh đại diện có thêm tên ngay bên cạnh (`UserFace withName`): "Mỗi người đã trả", câu tất toán ("[ảnh] Queen trả [ảnh] Clazuze ¥x", cả trong hộp xác nhận), 5 khoản gần nhất, bảng chia 50/50, cột "Ai trả ai" của lịch sử và dòng "... xác nhận". Khoản chi, Định kỳ và hai form sửa vẫn chỉ hiện ảnh.** Thay một phần quyết định "Ảnh đại diện thay tên người".
  Lý do: user thấy hai màn này còn chỗ trống cạnh ảnh và muốn hiện tên. Ở "5 khoản gần nhất", cột người trả rộng tối thiểu 8em để ảnh thẳng cột giữa các dòng.

- **Nút "Xem tất toán →" ở thẻ "Mỗi người đã trả" (Tổng quan) chuyển lên góc phải tiêu đề thẻ, giống "Xem tất cả" của thẻ "5 khoản gần nhất". Dòng tất toán cuối thẻ chỉ còn câu và nhãn "Tạm tính".**
  Lý do: câu tất toán có thêm tên nên dài ra; cửa sổ hẹp thì nút bị đẩy xuống một dòng riêng, trông lệch (user báo). Ở bề rộng tối thiểu 1024 px, nhãn "Tạm tính" vẫn xuống dòng dưới câu.

## 2026-10-26 — Số tiền trả bù màu xanh

- **Trong câu tất toán "[ảnh] Queen trả [ảnh] Clazuze ¥49,150" (Tổng quan, hộp kết quả ở Tất toán, hộp xác nhận "Đã thanh toán"), số tiền có màu xanh chủ đạo `--color-primary-strong`.**
  Lý do: user muốn số tiền phải trả nổi bật bằng màu khác. Xanh là màu của các số tiền chính trong app (tổng chi tháng ở Tổng quan, như số dư trong app ゆうちょ) và không mang nghĩa cảnh báo như vàng/đỏ. Ở theme sáng, màu này đạt ≥ 4.5:1 trên nền card trắng và trên nền xanh nhạt của hộp kết quả.

## 2026-10-26 — Câu tất toán: số tiền lớn hơn, các phần cách xa hơn

- **Trong câu tất toán, số tiền lớn hơn chữ của câu 1,3 lần; các phần (người trả, "trả", người nhận, số tiền) cách nhau rộng hơn. Số tiền và nhãn "Tạm tính" (Tổng quan) luôn cùng một dòng: cửa sổ hẹp thì cả cụm xuống dòng dưới tên (`suffix` của `SettlementSentence`).**
  Lý do: user thấy dòng còn khoảng trống và muốn số tiền to, nội dung thoáng cho dễ nhìn. Cỡ và khoảng cách tính theo `em` nên hộp kết quả ở Tất toán (chữ lớn) và hộp xác nhận cùng tỉ lệ.

- **Bảng ở Tất toán: ô không ngắt dòng, bảng có khung cuộn ngang trong card; cột Tháng của lịch sử ghi "10/2026" (`formatMonthShort`) vì tiêu đề cột đã là "Tháng". Dạng "Queen → Clazuze" giữ khoảng cách hẹp.**
  Lý do: từ khi có tên cạnh ảnh, ở bề rộng 1024 px "Tháng 10/2026", "Đã thanh toán" và "Queen → Clazuze" bị ngắt thành 2 dòng; bỏ chữ "Tháng" trong ô là đủ để bảng vừa card.

## 2026-10-26 — Hiệu ứng khi chuyển màn hình

- **Bấm sang mục khác ở sidebar: nội dung màn mới hiện dần và trượt lên 8 px trong 0,26 giây (`.screen` ở `App.module.scss`, có `key` theo màn hình nên chạy lại mỗi lần đổi). Màn cũ biến mất ngay, không có hiệu ứng ra. Thanh thông báo (cập nhật, lỗi lưu, sync) và dải gradient xanh đứng yên. Đổi tháng trong cùng một màn không có hiệu ứng.**
  Lý do: user muốn chuyển mục mượt hơn. Chỉ có hiệu ứng vào để bấm qua lại liên tục vẫn không bị trễ. Hiệu ứng không giữ trạng thái cuối, vì còn `transform` thì các hộp thoại nằm trong màn hình (`position: fixed`, không qua portal) sẽ canh theo khối nội dung thay vì cửa sổ.

- **Đổi màn hình thì vùng nội dung cuộn về đầu trang.** Trước đây màn mới giữ vị trí cuộn của màn cũ, nên có thể mở ra ở giữa trang.

- **App luôn chạy hiệu ứng, kể cả khi Windows/macOS tắt hiệu ứng (`prefers-reduced-motion: reduce`). Bỏ quy tắc chung trong `global.scss` từng tắt mọi animation/transition trong trường hợp đó.**
  Lý do: máy user tắt "Hiệu ứng hoạt hình" của Windows nên WebView2 báo `reduce`; nếu app làm theo thì user không thấy hiệu ứng nào. User chọn "luôn chạy đủ hiệu ứng" (thay vì làm theo Windows, hoặc chỉ hiện dần không trượt). Vì vậy trên máy này hiệu ứng bật lên của hộp thoại và đổi màu khi rê chuột cũng chạy lại.

## 2026-10-26 — Mở Cài đặt từ khối người dùng ở cuối sidebar

- **Sidebar không còn mục "Cài đặt". Khối người đang dùng ở cuối sidebar (ảnh đại diện, tên, vai trò) là một nút: bấm vào mở màn Cài đặt. Nút có nền đổi màu khi rê chuột, tooltip "Cài đặt" và icon bánh răng mờ bên phải; khi đang ở màn Cài đặt thì sáng lên như mục đang chọn. Bấm là vào thẳng màn Cài đặt, không bật menu.**
  Lý do: user thấy góc dưới sidebar chồng nhiều thứ (mục Cài đặt, trạng thái sync, theme, người dùng) và muốn gọn hơn; bấm vào ảnh/tên để vào cài đặt là kiểu quen thuộc. Icon bánh răng giữ cho người chưa biết vẫn tìm được Cài đặt. Không làm menu vì app không có đăng xuất hay đổi tài khoản, menu chỉ có một mục thì tốn thêm một cú bấm. Nút "Mở Cài đặt" trong cảnh báo mã hóa vẫn như cũ.

- **Rê chuột trên sidebar (các mục điều hướng và khối người dùng) dùng màu riêng `--color-sidebar-hover`: theme sáng là xanh nhạt `#e9f5e1`, nhạt hơn nền xanh của mục đang chọn; theme tối giữ như cũ.**
  Lý do: ở theme sáng, nền rê chuột cũ `--color-surface-hover` (`#f6f7ef`) gần như trùng nền sidebar `#fcfcfc` nên khó thấy (user báo).

## 2026-10-26 — Popup "Khoản chi mới" của người kia

- **Mở app: sau lượt sync đầu tiên, nếu người kia đã thêm khoản chi từ lần báo trước thì hiện popup "Khoản chi mới": "[ảnh] Queen đã thêm N khoản chi.", danh sách từng khoản (icon và tên danh mục, ghi chú, ngày, số tiền; ngày mới nhất trước), dòng tổng tiền và nút "Đã xem". Đóng bằng cách nào (nút, Esc, dấu X, bấm ra ngoài) cũng tính là đã xem. Khoản người kia nhập với người trả khác (bản v0.1.0 ở máy kia vẫn chọn được người trả) thì dòng phụ ghi thêm "Bạn trả"/"<tên> trả".**
  Lý do: user muốn mỗi khi một người thêm khoản chi thì người kia mở app sẽ thấy popup các khoản mới.

- **Chỉ báo một lần mỗi lần mở app, ngay khi lượt sync đầu tiên xong — kể cả khi chưa kết nối Drive hoặc sync lỗi, khi đó báo những khoản đã có trên máy. Khoản đến trong lúc app đang mở (sync định kỳ, focus lại cửa sổ) không bật popup giữa chừng mà để lần mở app sau.**
  Lý do: user nói "khi mở app"; popup bật lên giữa lúc đang nhập khoản chi sẽ làm mất mạch. Chờ lượt sync đầu để báo được cả khoản vừa nhận từ Drive.

- **Mỗi máy nhớ một mốc trong `settings.json` (`newTransactionsSeenUntil`, không đồng bộ, không đổi `schemaVersion`): `createdAt` của khoản mới nhất đã báo. Khoản mới = người kia nhập, `createdAt` sau mốc. Mốc so với `createdAt` do máy kia ghi chứ không với giờ máy này, nên giờ hai máy lệch nhau không làm sót khoản.** Logic ở `core/newTransactions.ts`.
  Lý do: "đã xem" là chuyện của từng máy, không phải dữ liệu chung. Một mốc thời gian đủ dùng vì file Drive của máy kia luôn chứa toàn bộ dữ liệu: đã thấy khoản nhập lúc T thì cũng đã có mọi khoản nhập trước T.

- **Không báo: khoản của mình, khoản đã xóa, khoản sinh từ định kỳ (app tự tạo mỗi tháng), khoản mà người sửa sau cùng khác người nhập (máy này đã sửa nó, hoặc admin nhập CSV thay người kia). Cũng không báo khi người kia sửa hay xóa khoản cũ.**
  Lý do: user hỏi về khoản "mới thêm". Khoản định kỳ thì cả hai đã biết trước; khoản mình đã sửa hoặc tự nhập từ CSV thì không còn là tin mới.

- **Máy chưa có mốc (vừa thiết lập, hoặc vừa cập nhật lên bản có popup này): khi mở màn hình chính, trước lượt sync đầu tiên, đặt mốc = khoản mới nhất của người kia đang có trên máy.** Không báo lại cả lịch sử, nhưng khoản mà lượt sync đầu tiên đó mang về vẫn được báo.

## 2026-10-26 — Bộ chọn tháng đứng yên khi đổi tháng

- **Nhãn "Đã khóa" / "Mở khóa tạm đến …" và nút "Mở khóa 24 giờ" / "Khóa lại" chuyển từ bên phải bộ chọn tháng sang ngay sau tiêu đề màn hình. Bộ chọn tháng luôn sát mép phải, "Về tháng này" vẫn đứng bên trái nó.** Áp dụng cho cả 5 màn dùng chung tiêu đề có bộ chọn tháng (Tổng quan, Khoản chi, Tất toán, Báo cáo, Ngân sách). _(Đã thay: bỏ khóa tháng, xem mục "2026-10-26 — Thành viên quản lý Ngân sách, Danh mục, Định kỳ; bỏ khóa tháng".)_
  Lý do: user thấy ở Báo cáo, bấm qua lại giữa tháng này và tháng đã khóa thì nhãn và nút khóa hiện/ẩn bên phải, đẩy bộ chọn tháng qua lại nên bấm mũi tên liên tục bị trượt.

- **Ô tên tháng rộng tối thiểu theo cỡ chữ (`132px × --font-scale`), để "Tháng 9/2026" và "Tháng 10/2026" rộng như nhau và mũi tên trái không nhích ở cỡ chữ Vừa trở lên. Cửa sổ hẹp làm nhãn khóa xuống dòng thì nội dung bên dưới lùi xuống, còn bộ chọn tháng giữ nguyên chỗ (tiêu đề neo theo mép trên).**

## 2026-10-26 — Bấm ô icon danh mục để mở bảng emoji của hệ điều hành

- **Ở màn Danh mục, bấm vào ô icon (cả dòng "Thêm danh mục" lẫn các danh mục có sẵn) là mở bảng emoji của hệ điều hành: Windows là bảng "Emoji and more" như khi bấm Win + . ; macOS là cửa sổ Emoji & Symbols. Bỏ dòng gợi ý "Gõ emoji: Win + . (Windows) hoặc Ctrl + Cmd + Space (macOS)".** Lệnh Rust `show_emoji_panel` (src-tauri/src/lib.rs); ô là `EmojiInput` (components/EmojiInput.tsx).
  Lý do: user không muốn người dùng phải tự nhớ phím tắt. Dùng bảng của hệ điều hành chứ không tự làm bảng emoji trong app vì user muốn đúng bảng như trên Windows/macOS: đủ emoji, có ô tìm kiếm, emoji gần đây, không phải thêm thư viện hay danh sách emoji.

- **Windows không có API mở bảng emoji cho app Win32, nên lệnh giả lập phím Win + . (`SendInput`), giống cách Chromium/Electron làm. macOS gọi `NSApp.orderFrontCharacterPalette`.** Bảng chèn emoji vào ô đang focus, nên ô icon vẫn là ô nhập (không đổi thành nút), trỏ chuột hình bàn tay, không hiện con trỏ nhập chữ nhấp nháy trong ô (user thấy thừa khi ô dùng như nút); vẫn tự gõ hoặc dán được.

- **Emoji chọn được thay emoji cũ, kể cả khi chọn tiếp nhiều emoji lúc bảng còn mở: bấm vào ô thì ô được chọn hết, sau mỗi lần bảng chèn emoji ô lại được chọn hết. Tự gõ phím trong ô thì thôi việc đó, ô gõ như thường.** Bấm đúp không mở rồi đóng bảng ngay (lần bấm thứ hai bị bỏ qua). Với danh mục có sẵn, emoji mới vẫn lưu khi rời ô hoặc bấm Enter; Esc (sau khi bảng đã đóng) trả lại icon cũ như trước.
  Lý do: mỗi danh mục chỉ có một emoji; bảng của Windows và macOS không tự đóng sau khi chọn, nếu không thay thì chọn nhầm rồi chọn lại sẽ thành hai emoji nối nhau.

- Đã thử trên Windows 11 (bản dev): bảng mở, chọn liên tiếp 👍 → ⏰ → 🎧 thì ô chỉ còn emoji cuối; dòng có sẵn chọn xong bấm Esc hai lần thì về icon cũ, không lưu. Bảng hiện ở chỗ Windows tự chọn (có khi ở màn hình khác với cửa sổ app khi dùng nhiều màn hình). Phần macOS mới kiểm là biên dịch được (`cargo check --target aarch64-apple-darwin` cho đoạn code AppKit), chưa chạy trên máy Mac.

## 2026-10-26 — Icon app: sổ tiết kiệm gập kiểu ゆうちょ

- **Icon app thay logo mặc định của Tauri bằng sổ tiết kiệm gập (có nhà và đồng ¥) trên ô vuông bo góc xanh, ảnh user tạo bằng ChatGPT theo phong cách app ゆうちょ銀行. Ảnh gốc, bản đã làm sạch và các bản master nằm ở `src-tauri/icons/_source/`. Logo trong app (`BrandMark`: đầu sidebar và màn thiết lập lần đầu) cũng đổi sang cùng hình, là ảnh PNG cắt sát ô xanh (`src/assets/brand-mark-64.png`, `-128.png`) thay cho SVG mái nhà + đồng xu.**
  Lý do: user muốn logo trong app giống icon app. Dùng ảnh cắt từ cùng nguồn chứ không vẽ lại bằng SVG để hai chỗ giống hệt nhau; có bản 128 px cho màn tỉ lệ cao.

- **(2026-10-27) Quyển sổ được phóng to trong ô xanh: cắt ô vuông sát quanh quyển sổ để sổ (cả nếp gập) chiếm 95% bề ngang ô, rồi bo góc lại với bán kính cũ (21,7% cạnh ô). Bản ô đã phóng là `_source/family-budget-icon-tile.png`; icon Windows, icon macOS và `BrandMark` đều làm từ bản này.**
  Lý do: user thấy icon trên taskbar và desktop nhỏ, muốn nhìn rõ quyển sổ và hình bên trong. Ô xanh đã chiếm 94% icon nên cách duy nhất làm sổ to lên mà giữ nguyên hình là bớt phần nền xanh quanh sổ (sổ to hơn khoảng 21%). User chọn mức này (sổ lớn nhất) thay vì mức 90% sau khi xem ảnh thử ở cỡ thật. Không bỏ ô xanh: sổ trắng trên taskbar sáng sẽ lẫn vào nền mà sổ chỉ to thêm khoảng 5%.

- **Windows: ô xanh chiếm 98% ô icon (ban đầu 94%, kéo thành vuông tuyệt đối vì ảnh gốc rộng hơn cao khoảng 2,5%; bản phóng ngày 2026-10-27 cắt vuông nên không còn kéo). `icon.ico` có đủ 10 cỡ 16–256 px dạng PNG-in-ICO.**
  Lý do: thiếu cỡ 20/24/40 px thì ở màn 125/150% Windows phải tự co giãn nên icon mờ. Ảnh ChatGPT có ô xanh chỉ đục khoảng 98% (alpha 246–254) và lấm tấm điểm gần trong suốt quanh mép, nên alpha được làm sạch trước (≤ 16 thành 0, ≥ 240 thành 255).

- **macOS (`icon.icns`) và các file `Square*Logo.png`, `StoreLogo.png`: ô xanh chiếm khoảng 80% khung theo lưới icon của Apple.**
  Lý do: icon macOS có lề trong suốt quanh ô; dùng bản 94% thì icon trên Dock to hơn các app khác. Chưa xem trên máy Mac.

- Ở 16–24 px (khay hệ thống, thanh tiêu đề, taskbar) chỉ còn nhận ra tờ sổ trắng có vạch xanh; nhà và đồng ¥ chỉ rõ từ 32–40 px. Bản cài A/B (v0.1.0) vẫn icon cũ đến bản phát hành sau; bản sổ phóng to chỉ tới máy đã cài từ bản phát hành sau v0.2.0.

## 2026-10-26 — Máy mới tự tìm dữ liệu gia đình, chọn tài khoản bằng thẻ

- **Mở app lần đầu, trước khi hiện "Tạo dữ liệu mới / Tham gia", app tìm thư mục `FamilyBudget` đã có file `device-*.json` trong Google Drive for Desktop của máy. Thấy đúng một thư mục thì vào thẳng "Chọn tài khoản của bạn để bắt đầu" với hai thẻ người dùng; không thấy, thấy nhiều hơn một, hoặc tìm quá 8 giây thì hiện màn "Chưa tìm thấy" (mục dưới).** Lệnh Rust `find_sync_folders` (src-tauri/src/lib.rs).
  Lý do: user thấy màn chào mừng của máy thứ hai không thân thiện, vì admin đã tạo sẵn hai tài khoản mà máy mới vẫn phải tự hiểu "Tham gia" và tự tìm thư mục. Thấy nhiều thư mục thì để người dùng chọn, vì app không biết thư mục nào đúng.

- **Cách tìm: ổ Google Drive là ổ cố định có thư mục ẩn `.shortcut-targets-by-id` ở gốc (Windows), hoặc `~/Library/CloudStorage/GoogleDrive-*` (macOS); chỉ xét 2 cấp: `<My Drive hoặc Shared drives>/FamilyBudget` và `<…>/<thư mục>/FamilyBudget`, kể cả lối tắt tới thư mục được chia sẻ.** Không dựa vào tên "My Drive" vì tên này đổi theo ngôn ngữ; không tìm sâu hơn để khỏi duyệt cả Drive. Thư mục tìm được được cấp quyền đọc ghi như khi chọn qua hộp chọn thư mục (plugin persisted-scope giữ lại), và được lưu làm thư mục đồng bộ sau khi chọn tài khoản. Đã thử trên Windows (bản dev mới, tìm thấy `G:\My Drive\Family Budget\FamilyBudget`); macOS chưa thử, có thể macOS hỏi quyền truy cập file của Google Drive lần đầu.

- **Người dùng hiện thành hai thẻ (ảnh đại diện 72 px, tên, vai trò Admin / Thành viên) thay cho nút "Tôi là …", ở cả ba chỗ: tự tìm thấy, tham gia sau khi chọn thư mục, máy đã có data.json nhưng chưa biết là của ai.** Bấm thẻ vẫn qua bước chọn ảnh đại diện (đã có ảnh thì chọn sẵn), nên bấm nhầm thẻ còn "Quay lại" được.

- **Logo ở màn thiết lập to lên 80 px (trước 44 px)**, thêm bản `brand-mark-256.png` cho màn tỉ lệ cao.
  Lý do: user muốn nhìn rõ hình sổ, nhà và đồng ¥ bên trong.

- **Bỏ màn hai lựa chọn ngang nhau "Tạo dữ liệu mới (admin)" / "Tham gia (máy thứ hai)". Không tìm thấy dữ liệu thì hiện "Chưa tìm thấy dữ liệu gia đình trên Google Drive của máy này" kèm hướng dẫn 3 bước cho máy người nhà (cài và đăng nhập Google Drive for Desktop; dùng tài khoản khác thì nhờ người tạo chia sẻ thư mục, mở link và bấm "Thêm lối tắt vào Drive"; chờ Drive tải xong), nút chính "Tìm lại" và nút "Tự chọn thư mục...". "Tạo dữ liệu mới" chỉ còn là dòng phụ cuối màn ("Bạn là người đầu tiên dùng app trong gia đình?"), form tạo mới có cảnh báo chỉ làm trên máy đầu tiên.**
  Lý do: user muốn máy thứ hai không bấm nhầm "Tạo dữ liệu mới" rồi tạo bộ dữ liệu thứ hai, và muốn bớt lựa chọn cho máy đó. Máy đầu tiên vẫn cần tạo mới và lúc đó cũng chưa có dữ liệu nào để tìm, nên app không phân biệt được hai máy; chỉ đẩy tạo mới xuống thành đường phụ.

- **Không làm "chờ admin duyệt" hay ô nhập link Google Drive** (user gợi ý). App không có máy chủ, chỉ đọc thư mục Drive qua ổ đĩa Google Drive for Desktop tạo trên máy, nên không có kênh để admin duyệt, và link Drive dán vào app cũng không cho app quyền đọc thư mục. Bước "duyệt" thật chính là admin chia sẻ thư mục trên Google Drive; link dùng trong trình duyệt để thêm lối tắt. Hướng dẫn trên màn hình nói đúng hai việc đó.

- **Thêm hai chốt chặn tạo bộ dữ liệu thứ hai:** đã tìm thấy dữ liệu gia đình thì màn chọn tài khoản không có nút "Quay lại" về bước tạo mới; bấm "Tạo dữ liệu" mà Google Drive của máy đã có thư mục gia đình ở chỗ khác thì báo lỗi kèm đường dẫn và không tạo. "Quay lại" ở các bước khác giờ tìm lại từ đầu.

- **Màn chọn tài khoản (khi đã tìm thấy dữ liệu) chỉ còn câu "Chọn tài khoản của bạn để bắt đầu" và hai thẻ: bỏ dòng "Đã tìm thấy dữ liệu của gia đình trong <đường dẫn>. Chọn thư mục khác".**
  Lý do: user thấy không cần thiết. Muốn dùng thư mục khác thì hiếm, và gia đình chỉ có một thư mục dữ liệu.

## 2026-10-26 — Thành viên tự đổi được tên của mình

- **Tên người dùng theo cùng quy tắc với ảnh đại diện: mỗi người tự đổi tên của mình ở Cài đặt → Người dùng và vai trò, admin đổi được tên của cả hai. Chuyển quyền admin vẫn chỉ admin làm.** `canEditProfile` (thay cho `canEditAvatar`) dùng chung cho tên và ảnh, ở cả UI lẫn store.
  Lý do: user muốn máy thứ hai (thành viên) cũng đổi được tên. Chỉ cho đổi tên của chính mình, không đổi tên người kia, giống cách đã làm với ảnh đại diện. Vẫn giữ kiểm tra tên 2 người phải khác nhau.

## 2026-10-26 — Popup báo cập nhật thay cho banner

- **Có bản mới thì hiện popup giữa màn hình "Có bản cập nhật mới" (thay banner trên cùng): một câu "Family Budget x.y.z đã sẵn sàng để cài.", liên kết "Xem chi tiết" (bấm mới hiện ghi chú thay đổi, bấm lại "Ẩn chi tiết"), dòng nhắc app tự khởi động lại và dữ liệu không bị ảnh hưởng, nút "Để sau" và "Cập nhật".** Đóng popup bằng nút X, Esc hay bấm ra ngoài cũng như "Để sau": ẩn đến lần mở app sau. Đang tải, cài thì popup không đóng được, không có nút. Popup dùng ở cả màn chính lẫn màn thiết lập lần đầu. `UpdateDialog` (đổi tên từ `UpdateBanner`).
  Lý do: user muốn thông báo cập nhật nổi bật và gọn; nội dung cập nhật chỉ hiện khi người dùng muốn xem.

- **Cài đặt → Phiên bản app: "Xem nội dung bản này" dưới phiên bản đang dùng, và "Xem nội dung cập nhật" dưới "Có phiên bản x.y.z", đều ẩn đến khi bấm.** Ghi chú của bản đang dùng lấy từ docs/CHANGELOG.md đóng gói trong app (`?raw`, hàm `changelogSection` trong core/changelog.ts, cùng cách đọc với workflow phát hành), nên sau khi cập nhật vẫn xem lại được bản vừa cài có gì mới; ghi chú của bản mới lấy từ plugin-updater như trước.
  Lý do: user muốn bấm "Để sau" hoặc bỏ qua chi tiết lúc đầu thì vẫn vào Cài đặt xem lại được nội dung cập nhật.

## 2026-10-26 — "Máy khác" gọi theo tên người dùng

- **Cài đặt → Đồng bộ qua Google Drive → Máy khác hiện "Máy Queen ghi dữ liệu lúc …" thay cho "Máy 8bab748d …". Mỗi máy ghi thêm `writtenBy` (userId của máy đó, lấy từ settings.json) vào đầu file `device-*.json`.** File của bản app cũ chưa có trường này thì vẫn gọi theo 8 ký tự đầu mã máy; hai máy của cùng một người (cài lại app, như bản B cũ `8bab748d` và bản B mới `934dbd87` đều là Queen) thì thành "Máy Queen (8bab748d)", "Máy Queen (934dbd87)".
  Lý do: user muốn biết máy nào của ai. File cũ chỉ có mã máy, không có gì nói máy đó của ai (settings.json không sync), nên phải ghi thêm. Trường không bắt buộc, không tăng `schemaVersion`: bản 0.1.0, 0.2.0 đọc file không loại trường lạ ở đầu file, và phần đầu file khi gộp luôn giữ của máy mình (`merge`, `dataForJoin` bắt đầu từ dữ liệu rỗng), nên máy bản cũ không chép nhầm `writtenBy` của máy kia vào file của mình.

## 2026-10-26 — Thành viên quản lý Ngân sách, Danh mục, Định kỳ; bỏ khóa tháng

- **Ngân sách, Danh mục, Định kỳ hiện trong nhóm "Quản lý" ở sidebar của cả hai người; thành viên thêm, sửa, xóa được ở cả ba màn như admin.** `categories:manage`, `budgets:manage`, `recurring:manage` chuyển vào `MEMBER_ACTIONS`. `navigation.ts` bỏ trường `action` và hàm `canOpen` vì không còn màn hình nào ẩn theo vai trò; App bỏ bước quay về Tổng quan khi mất quyền admin.
  Lý do: user muốn máy B (thành viên) cũng quản lý được ba mục này. Vẫn chỉ admin làm: sửa, xóa khoản người kia nhập; import CSV; khôi phục backup; chuyển quyền admin; mật khẩu mã hóa. Khoản sinh từ mẫu định kỳ ghi người nhập là người sửa mẫu gần nhất, nên khoản sinh ra sau khi thành viên sửa mẫu thì thành viên sửa, xóa được.

- **Bỏ hẳn khóa tháng: không còn nhãn "Đã khóa" / "Mở khóa tạm đến …", nút "Mở khóa 24 giờ" / "Khóa lại" và hộp xác nhận mở khóa. Tháng đã qua thêm, sửa, xóa khoản chi và đặt ngân sách được như tháng hiện tại; thành viên vẫn chỉ sửa, xóa khoản mình nhập.** Xóa `core/monthLock.ts`: `isPastMonth` chuyển sang `core/month.ts`, `findMonthRecord` và `monthRecordId` sang `core/settlement.ts`; `MonthRecord` bỏ trường `manualUnlockUntil`; quyền `month:unlock` bị bỏ. Thay các quyết định về khóa tháng ở Giai đoạn 1, Giai đoạn 3 và mục "Bộ chọn tháng đứng yên khi đổi tháng".
  Lý do: user thấy không cần khóa tháng nữa khi cả hai người cùng quản lý, và muốn code gọn. Tất toán giữ nguyên: "Đã thanh toán" chỉ có ở tháng đã qua; sửa khoản của tháng đã tất toán làm số tiền bù đổi thì màn Tất toán vẫn cảnh báo "Số tiền đã thay đổi sau khi tất toán" kèm nút xác nhận lại.

- **Dữ liệu cũ không cần chuyển, không tăng `schemaVersion`.** Bản ghi tháng do bản 0.2.0 trở về trước ghi có thể còn `manualUnlockUntil`: bản mới không đọc trường này nhưng vẫn giữ (đọc file không loại trường lạ; đánh dấu đã thanh toán giữ các trường khác của bản ghi tháng). Máy còn chạy bản 0.2.0 vẫn khóa tháng trên máy đó cho đến khi cập nhật.

- Đánh đổi đã biết: hai người cùng tạo danh mục trùng tên trước khi kịp đồng bộ thì sau khi gộp có hai danh mục cùng tên (id UUID khác nhau), phải ẩn hoặc xóa bớt một cái bằng tay. Trước đây chỉ admin tạo danh mục nên không xảy ra (xem Giai đoạn 3). Với gia đình hai người, việc này hiếm nên không thêm cơ chế chống trùng.

## 2026-10-27 — Tất toán cần người kia đồng ý

- **Tất toán thành hai bước: một người bấm "Tất toán" là gửi yêu cầu; người kia nhận popup "Yêu cầu tất toán" (nút "Đồng ý", "Để sau") và chỉ khi người kia đồng ý tháng mới được đánh dấu "Đã thanh toán". Người gửi thấy "đang chờ … đồng ý" và hủy được yêu cầu.** Thay cho nút "Đã thanh toán" một người bấm là xong. Yêu cầu là 4 trường `settleRequested*` trong `MonthRecord`, đi qua sync như dữ liệu khác; đồng ý hoặc hủy thì bỏ cả 4 trường, nên trạng thái "đang chờ" không phải so thời điểm giữa hai máy (giờ hai máy có thể lệch). `settledBy` giờ là người đồng ý; màn hình vẫn ghi "<người> xác nhận" cho cả bản ghi cũ lẫn mới.
  Lý do: user muốn cả hai người cùng chốt số tiền bù cuối tháng.

- **Nút "Tất toán" có từ ngày cuối tháng (giờ local) trở đi, không chỉ đúng ngày cuối tháng; trước đó màn Tất toán có dòng nhắc "Nút “Tất toán” sẽ hiện vào ngày cuối tháng, DD/MM/YYYY."** Trước đây phải sang tháng sau mới đánh dấu được. Tháng đã qua mà chưa tất toán vẫn bấm được, nếu không thì lỡ ngày cuối tháng là không tất toán được nữa. Nhãn "Tạm tính" (màn Tất toán, Tổng quan) giờ mất khi tháng đã tất toán, kể cả tất toán ngay ngày cuối tháng.
  Lý do: user muốn tất toán vào cuối tháng và cần dòng nhắc để biết khi nào nút xuất hiện.

- **Hai người phải đồng ý cùng một con số: số tiền bù hoặc người trả bù đổi sau khi gửi (ví dụ có khoản chi thêm vào ngày cuối tháng) thì yêu cầu thành cũ — không còn popup, không đồng ý được, màn hình báo "Số tiền đã thay đổi sau khi gửi yêu cầu tất toán" kèm "Gửi lại yêu cầu".** "Xác nhận lại đã thanh toán" khi số tiền đổi sau tất toán cũng thành "Tất toán lại", đi qua bước yêu cầu và đồng ý. Không có nút "Từ chối": không đồng ý thì hai người nói với nhau, sửa khoản chi (yêu cầu tự thành cũ) hoặc người gửi hủy yêu cầu. Gửi yêu cầu không có hộp xác nhận vì hủy được (giống phạm vi ConfirmDialog chỉ cho nút Xóa).

- **Popup "Yêu cầu tất toán" chỉ mở sau lượt sync đầu tiên khi mở app, và chờ đến khi không còn modal nào khác đang mở** (popup "Khoản chi mới", form khoản chi…): `modalStack` có thêm `useOpenModalCount` để popup biết khi nào tới lượt. Chờ sync để không hiện yêu cầu mà máy kia đã hủy. Có nhiều yêu cầu thì hiện tháng cũ trước, từng cái một.

- **Không tăng `schemaVersion`.** Các trường mới đều không bắt buộc; bản 0.2.0 trở về trước đọc file không loại trường lạ. Máy còn chạy bản cũ không thấy popup và vẫn bấm "Đã thanh toán" một bước được; bấm như vậy thì yêu cầu (nếu có) vẫn nằm trong bản ghi. Hai máy nên cập nhật cùng lúc.

## 2026-10-30 — Cửa sổ co được tới 640 × 480

- **Cửa sổ tối thiểu 640 × 480 thay cho 1024 × 700; cửa sổ mặc định 1200 × 800 tự thu cho vừa vùng làm việc của màn hình lúc mở (`preventOverflow` của Tauri).** Thay quyết định "tối thiểu 1024 × 700" ở Giai đoạn 0.
  Lý do: user báo trên màn 14" không co app nhỏ hơn được. Laptop 14" scale 150–200% chỉ còn 1280 × 670–770 px CSS trên taskbar: 700 px cao gần hết màn, 1024 px rộng thì không đặt được cạnh cửa sổ khác. 640 px là nửa màn 1280 (Windows Snap). `preventOverflow` là tùy chọn có sẵn của Tauri nên không cần viết Rust.

- **Từ 1024 px trở lên giao diện giữ y như cũ. Dưới 1024 px (mixin `narrow`, hook `useNarrowWindow`): sidebar chỉ còn cột icon** — tên mục ở tooltip, nhóm "Quản lý" tách bằng đường kẻ thay cho nhãn, khối sync thành một nút "Sync ngay" có chấm trạng thái (chấm lấy màu của dòng nặng nhất, nội dung ở tooltip; chưa kết nối thì bấm để chọn thư mục), bỏ ô chọn theme (đã có ở Cài đặt → Giao diện), khối người dùng chỉ còn ảnh. Lề vùng nội dung hẹp lại.
  Lý do: sidebar 240 px chiếm gần nửa cửa sổ 640 px. Cột icon khoảng 60 px; ở cửa sổ 840 px vùng nội dung vẫn rộng bằng lúc cửa sổ 1024 px có sidebar đầy đủ, nên các bảng đã chỉnh cho 1024 px vẫn vừa.

- **Dưới 840 px (mixin `compact`): lưới 2 cột ở Tổng quan thành 1 cột; lề trong card và vùng nội dung nhỏ thêm; tiêu đề cột bảng được xuống dòng ("Người trả" trên cột chỉ có ảnh); tên danh mục ở bảng Khoản chi cắt ở 120 px thay vì 160 px; bảng Báo cáo đưa nhãn "Trên 80%" / "Vượt" xuống dòng dưới thanh.** Không dùng container query theo bề rộng vùng nội dung: container query bật layout containment, các modal (`position: fixed`, không qua portal) sẽ canh theo vùng nội dung thay vì cửa sổ.

- **Thẻ "Chi theo danh mục" ở Tổng quan: bảng chú thích xuống dưới biểu đồ khi bên cạnh còn dưới 20em; tên danh mục dài cắt bằng "…" thay vì giữ bảng rộng ra (`max-width: 0` trên ô tên).** Trục tháng của biểu đồ Báo cáo bỏ bớt nhãn cách đều khi chật (`equidistantPreserveEnd`, luôn giữ tháng đang chọn ở cuối); nhãn tháng mang class `recharts-cartesian-axis-tick-value` để recharts đo đúng cỡ chữ, nên ở 1024 px vẫn hiện đủ 12 nhãn như trước. Bảng Báo cáo có khung cuộn ngang trong card như các bảng khác.

- Đã xem trên bản UI dev B ở 640, 720, 800, 900, 1024 px, cỡ chữ Nhỏ và Lớn, theme tối; đo phần tử tràn qua cổng debug của WebView2. Còn lại: ở 640–~680 px, bảng lịch sử Tất toán và bảng Định kỳ (7 cột có nút) cuộn ngang trong card khoảng 30–60 px; từ 720 px mọi bảng vừa card ở cỡ Nhỏ. Cửa sổ cao 480 px với cỡ chữ Lớn trở lên thì cột icon dài hơn cửa sổ, cuộn bằng con lăn (ẩn thanh cuộn để khỏi bóp cột). macOS chưa xem.

## 2026-10-30 — Tắt kiểm tra chính tả

- **`spellcheck="false"` trên thẻ `<html>` (index.html): mọi ô nhập và ô nhiều dòng, kể cả trong popup, không còn gạch đỏ dưới chữ.** Thuộc tính này được kế thừa nên không phải đặt từng ô; ô nào cần bật lại thì đặt `spellCheck` riêng.
  Lý do: user thấy gạch đỏ khó chịu. Tên người, tên danh mục, ghi chú tiếng Việt lẫn tên tiếng Nhật (Gyomu Super, Kawaguchiko…) đều bị trình kiểm tra chính tả của WebView báo sai, nên chỉ gây nhiễu.

## 2026-10-30 — Bỏ viền tối quanh biểu đồ khi bấm

- **`.recharts-surface:focus { outline: none }` trong global.scss: bấm vào biểu đồ Báo cáo (hay biểu đồ tròn ở Tổng quan) không còn hiện khung viền tối quanh cả biểu đồ.** Recharts 3 cho vùng vẽ `tabindex=0` (để xem tooltip bằng phím mũi tên), nên bấm chuột là nó nhận focus và WebView vẽ viền dù không phải `:focus-visible`. Giữ `tabindex`, chỉ bỏ viền.
  Lý do: user thấy khung viền đen quanh biểu đồ ở màn Báo cáo.

## 2026-10-30 — Cuộn mượt bằng Lenis

- **Cuộn bằng con lăn chuột / touchpad mượt ở mọi vùng cuộn dọc của app: vùng nội dung, sidebar, thân popup, màn thiết lập lần đầu, danh sách ghi chú phiên bản, bảng xem trước CSV.** Dùng Lenis 1.3.27, cài bằng npm (gói `lenis`, import `lenis/dist/lenis.css` ở main.tsx), không qua CDN: CSP của app chỉ cho script `'self'`, và app desktop không nên tải code từ mạng. Hook `components/useSmoothScroll.ts` trả về callback ref (gắn được cả vùng hiện ra sau, như bảng CSV) và instance.
  Lý do: user muốn cuộn mượt cho toàn app.

- **Mỗi vùng cuộn một instance Lenis (`wrapper` là chính vùng đó), không phải một instance cho cả trang:** app không cuộn `window` mà cuộn từng vùng `overflow: auto`. Vùng lồng nhau (ghi chú phiên bản trong popup) cuộn hết thì Lenis chuyền phần còn lại ra vùng ngoài, như cuộn gốc. `naiveDimensions: true` để đo chiều cao nội dung mỗi lần cần, vì nội dung đổi liên tục và không có một khối con cố định để Lenis theo dõi.

- **Thông số: `duration: 0.7`, easing ease-out cubic `1 - (1 - t)^3`, `wheelMultiplier: 0.6` (mỗi nấc lăn 60 px; cuộn gốc 100 px), `respectReducedMotion: false`.** Máy user tắt "Hiệu ứng hoạt hình" của Windows nên WebView báo `prefers-reduced-motion: reduce`; Lenis mặc định tắt cuộn mượt lúc đó, giống lý do hiệu ứng chuyển màn hình luôn chạy.
  Bản đầu dùng expo-out và `wheelMultiplier: 0.9`: mỗi nấc 90 px, đi nửa quãng trong 80 ms đầu (tốc độ lúc bắt đầu gấp ~7 lần tốc độ trung bình), 5 nấc liên tiếp đi 450 px trong khoảng 0,3 giây; user thấy hơi nhanh, chóng mặt. Bản hiện tại đo được: một nấc sau ~80 ms mới đi 21 px (trước 57 px), 5 nấc đi 300 px, vẫn dừng hẳn trong 0,7 giây. Không kéo dài `duration` vì trang trôi lâu sau khi thôi lăn cũng gây chóng mặt.

- **Popup không qua portal nên nằm trong vùng nội dung: lớp nền popup có `data-lenis-prevent` để lăn chuột trên popup không cuộn trang phía sau** (trước đây cuộn gốc cũng không cuộn trang phía sau). Thân popup có Lenis riêng.

- **Vẫn là cuộn gốc: bàn phím, kéo thanh cuộn, lăn ngang bằng touchpad, Shift + lăn chuột** (`virtualScroll` bỏ qua sự kiện có Shift để bảng rộng hơn card cuộn ngang như cũ). Đổi màn hình gọi `lenis.scrollTo(0, { immediate: true })` thay cho `scrollTo` gốc, nếu không đoạn cuộn mượt đang chạy dở sẽ kéo trang mới xuống.

- Không có link neo `#...` nào trong app nên không cần xử lý link neo. Đã thử trên bản UI dev B qua cổng debug WebView2: lăn 600 px thì trang tăng dần qua nhiều khung hình, dừng ở 540 px sau khoảng 0,5 giây (kể cả khi giả lập reduced motion; số đo với thông số bản đầu); đổi màn hình giữa lúc cuộn thì về 0 ngay; lăn trên popup không cuộn trang; thân popup và sidebar (cửa sổ thấp) cuộn mượt riêng; lăn ngang trên bảng Định kỳ vẫn cuộn bảng. Shift + lăn chuột không giả lập được qua CDP (Windows đổi thành lăn ngang trước khi tới WebView), chưa thử bằng chuột thật. macOS chưa thử.

## 2026-10-30 — Bấm logo ở sidebar để về Tổng quan

- **Khối logo + tên app ở đầu sidebar là một nút: bấm vào thì về màn Tổng quan, tooltip "Tổng quan", nền đổi màu khi rê chuột như khối người dùng ở cuối sidebar. Cột icon (cửa sổ hẹp) cũng vậy.** Khoảng cách từ logo tới menu chuyển từ padding sang margin để vùng bấm chỉ vừa khối logo.
  Lý do: user muốn bấm logo để về Tổng quan, như logo về trang chủ trên web.

## 2026-10-30 — Theme sáng bỏ màu trắng, dùng giấy ngà ấm

- **Theme sáng không còn mảng trắng: card, ô nhập, popup `#ebe8e1` (giấy ngà ấm); nền trang và sidebar `#e2ded5`, sẫm hơn card một bậc để card vẫn nổi; nền phụ `#dcd8ce`, nền rê chuột trên card `#e5e2da`, viền `#d3cdc1` / `#bcb5a7`. Chữ phụ đậm lên từ `#667366` thành `#556155`.** Màu xanh ゆうちょ, gradient phần đầu màn hình, nền rê chuột xanh ở sidebar và chữ chính giữ nguyên; theme tối không đổi.
  Lý do: user thấy theme sáng chói, muốn màu ấm dịu như `#f9decc` hoặc `#f3f1ec`. Bản đầu chỉ đổi nền trang và sidebar sang `#f3f1ec`, card còn `#fcfbf8`; user báo nội dung chính giữa vẫn chói, vì card chiếm gần hết màn hình. Bản thứ hai card dùng chính `#f3f1ec`, nền sau `#ebe7df`; user muốn thử hạ thêm một bậc nữa (mỗi kênh màu khoảng −8) và chọn bản này. Chọn `#f3f1ec` thay vì màu đào `#f9decc`: màu đào đặt cạnh gradient xanh và mục đang chọn xanh nhạt thì lệch tông, và nền vàng/đỏ nhạt của trạng thái cảnh báo/lỗi gần như lẫn vào nền. Chữ phụ đậm lên để đạt ≥ 4.5:1 trên nền trang (4.85:1), card (5.3:1) và nền phụ (4.6:1). Chữ xanh cỡ nhỏ `#007a00` đạt 4.5:1 trên card và trên nền mục đang chọn, chỉ 4.1:1 trên nền trang, nhưng không có chỗ nào đặt chữ xanh thẳng trên nền trang (chỉ trong card, mục sidebar đang chọn, và lúc rê chuột lên link). Bảng màu biểu đồ kiểm lại bằng validator của skill dataviz với card `#ebe8e1`: kết quả các cổng như với `#ffffff` (màu hồng vốn dưới 3:1, nay 2.2:1, vẫn có danh sách số liệu bên cạnh), nên giữ nguyên.

## 2026-10-30 — Thanh tiêu đề cửa sổ cùng màu sidebar

- **Thanh tiêu đề của cửa sổ (thanh ngang trên cùng do hệ điều hành vẽ) tô cùng màu `--color-sidebar` của theme đang áp dụng: sáng `#e2ded5`, tối `#131813`.** themeStore đọc màu từ CSS mỗi lần đổi theme (và khi hệ điều hành đổi sáng/tối lúc đang chọn "Theo hệ thống") rồi gọi lệnh Rust `set_title_bar_color`, lệnh này đặt `DWMWA_CAPTION_COLOR` qua `DwmSetWindowAttribute`. Màu chữ tiêu đề vẫn do `setTheme` quyết định như trước.
  Lý do: sau khi bỏ màu trắng ở theme sáng, thanh tiêu đề trắng của Windows lệch hẳn với nền ngà của app (user báo). Không tự vẽ thanh tiêu đề (`decorations: false`) vì sẽ mất các tính năng của nút phóng to trên Windows 11 (Snap layouts), kéo cửa sổ và nút hệ thống phải tự làm lại.
  Chỉ Windows 11 có thuộc tính này; Windows 10 bỏ qua (thanh tiêu đề như cũ). macOS chưa làm: thanh tiêu đề vẫn của hệ thống (muốn đổi phải dùng `titleBarStyle: Transparent` + màu nền cửa sổ, chưa thử được vì không có máy Mac ở đây). Lúc vừa mở app, trước khi trang web chạy xong, thanh tiêu đề còn màu mặc định trong chốc lát. Đã thử trên bản UI dev B: Sáng, Tối, Theo hệ thống đều cho màu thanh tiêu đề trùng điểm ảnh với sidebar.

## 2026-10-30 — Đổi theme có hiệu ứng mờ dần

- **Chọn Sáng / Tối / Theo hệ thống thì cả màn hình mờ dần sang theme mới trong 0.8 giây, bằng View Transitions API (`document.startViewTransition` trong `themeStore`, thời gian đặt ở `global.scss`).** WebView chụp màn hình trước và sau khi đổi rồi chuyển dần giữa hai ảnh, nên nền, chữ và biểu đồ (tô màu bằng JS) đổi cùng lúc. Trong 0.8 giây đó màn hình là ảnh chụp, không bấm hay cuộn được. Chạy cả khi Windows/macOS tắt hiệu ứng, như hiệu ứng chuyển màn hình.
  Lý do: user muốn lúc đổi theme có chuyển mượt (theo skill theme-toggle-transition). Không dùng `transition` màu cho mọi phần tử: cách đó đè lên transition rê chuột có sẵn của nút, và biểu đồ vẽ bằng JS vẫn đổi màu tức thì. Thanh tiêu đề cửa sổ do hệ điều hành vẽ, không nằm trong ảnh chụp, nên đổi màu ngay lúc bắt đầu. Hệ điều hành tự đổi sáng/tối lúc đang chọn "Theo hệ thống" thì đổi ngay, không có hiệu ứng. macOS cần WKWebView của Safari 18 trở lên; máy cũ hơn đổi theme ngay như trước.
