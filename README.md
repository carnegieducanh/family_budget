# Family Budget

App desktop ghi các khoản chi chung hàng tháng của 2 người, chia đều 50/50 và tính ai phải trả bù cho ai. Chạy trên Windows 11 và macOS (Apple Silicon), đồng bộ qua một thư mục Google Drive.

- Thiết kế và lộ trình: [docs/SPEC.md](docs/SPEC.md)
- Các quyết định phát sinh: [docs/decisions.md](docs/decisions.md)
- Cài môi trường phát triển và cài app: [docs/INSTALL.md](docs/INSTALL.md)

## Lệnh thường dùng

| Lệnh                   | Việc làm                                  |
| ---------------------- | ----------------------------------------- |
| `npm install`          | Cài thư viện                              |
| `npm run tauri dev`    | Chạy app ở chế độ phát triển (hot reload) |
| `npm run tauri build`  | Build file cài đặt                        |
| `npm test`             | Chạy unit test (Vitest)                   |
| `npm run test:watch`   | Chạy test ở chế độ theo dõi               |
| `npm run typecheck`    | Kiểm tra kiểu TypeScript                  |
| `npm run lint`         | ESLint                                    |
| `npm run format`       | Định dạng code bằng Prettier              |
| `npm run format:check` | Kiểm tra định dạng (không sửa)            |
