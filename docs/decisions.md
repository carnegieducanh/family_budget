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
