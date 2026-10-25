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

- **Nút mở khóa tạm và khóa lại nằm ở thanh chọn tháng, dùng chung cho mọi màn hình.** Chỉ admin thấy; store cũng kiểm tra vai trò admin.
  Lý do: SPEC không chỉ chỗ đặt nút. Đặt cạnh biểu tượng khóa là dễ thấy nhất.

- **Phân quyền đầy đủ (người dùng thường chỉ sửa khoản mình nhập) chưa áp dụng ở giai đoạn 1.** Giai đoạn này chỉ kiểm tra quyền admin cho mở khóa tạm.
  Lý do: `core/permissions.ts` thuộc giai đoạn 3 theo mục 10.

- **"Đã thanh toán" hiện cho mọi tháng đã qua** (kể cả khi admin đang mở khóa tạm), khi số tiền bù lớn hơn 0. Nếu số tiền hoặc người trả bù đổi sau khi tất toán thì hiện cảnh báo kèm nút "Xác nhận lại đã thanh toán".
  Lý do: mở khóa tạm chỉ để sửa dữ liệu, tháng vẫn là tháng đã kết thúc. Cảnh báo xét cả trường hợp đổi chiều trả bù dù số tiền giữ nguyên.

- **`sharePerPerson` giữ phần lẻ 0.5 yên, `formatYen` hiện tối đa 1 chữ số thập phân** (¥500.5 như ví dụ ở mục 6). Số tiền nhập và lưu luôn là số nguyên.
  Lý do: hiện đúng bảng ví dụ của SPEC mà không làm tròn sai phần mỗi người chịu.

- **Ngưỡng màu ngân sách: trên 80% là cảnh báo, trên 100% là vượt; dùng đúng 100% vẫn chỉ là cảnh báo.** Đã có `core/budget.ts` để đọc ngân sách (mức của tháng, nếu không có thì mức mặc định); màn hình đặt ngân sách làm ở giai đoạn 3.
  Lý do: "vượt" nghĩa là lớn hơn hẳn. Tổng quan cần đọc ngân sách ngay từ giai đoạn 1.

- **Biểu đồ tròn của Tổng quan là dạng donut, tối đa 6 lát: 5 danh mục lớn nhất có màu riêng, phần còn lại gộp thành lát xám.** Bên cạnh luôn có bảng liệt kê mọi danh mục kèm số tiền và %. Màu lấy từ bảng màu đã kiểm bằng validator (đạt kiểm tra mù màu ở cả nền sáng và tối) và gán theo thứ hạng trong tháng.
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

- **Phân quyền là một hàm `can(user, action, record?)` trong `core/permissions.ts`**, dùng chung cho UI và store; mọi thao tác dữ liệu trong store đều gọi `assertCan`. Màn hình Ngân sách, Danh mục, Định kỳ ẩn khỏi menu với thành viên. Nếu đang ở màn hình admin mà mất quyền (chuyển quyền, hoặc nhận thay đổi vai trò từ máy kia) thì app quay về Tổng quan.
  Lý do: SPEC mục 7; một chỗ duy nhất quyết định quyền nên UI và store không lệch nhau.

- **Khoản chi người khác nhập: thành viên vẫn mở được nhưng chỉ xem** (nút "Xem" thay cho "Sửa / Xóa", form bị khóa kèm dòng "Khoản này do … nhập, bạn chỉ xem được").
  Lý do: vẫn xem được ghi chú và người nhập mà không sửa nhầm.

- **Khoản sinh từ chi tiêu định kỳ ghi người nhập (và người sửa) là người sửa mẫu gần nhất** (luôn là admin), ghi chú là tên mẫu.
  Lý do: hai máy sinh ra cùng một nội dung; thành viên không sửa nhầm khoản định kỳ.

- **Ngoài lúc mở app và sau mỗi lượt sync, khoản định kỳ còn được sinh ngay khi admin lưu mẫu.** Sửa mẫu không đổi khoản đã sinh của tháng này; xóa mẫu không xóa các khoản đã sinh.
  Lý do: thấy kết quả ngay sau khi thêm mẫu; khoản đã sinh là dữ liệu thật, sửa riêng trong màn hình Khoản chi nếu cần.

- **Ngân sách phải lớn hơn 0; để trống ô là bỏ mức đó (xóa mềm), đặt lại thì dùng lại bản ghi cũ (id cố định).** Mức riêng của tháng đã khóa không sửa được (trừ khi admin mở khóa tạm). Đổi mức mặc định thì các tháng đã khóa đang dùng mức mặc định cũng thấy mức mới.
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
