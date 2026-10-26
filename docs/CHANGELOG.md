# Ghi chú phát hành

Mỗi phiên bản một mục `## x.y.z`, mới nhất ở trên. Nội dung của mục là ghi chú hiện khi bấm "Xem chi tiết" trong popup cập nhật của app và ở Cài đặt → Phiên bản app (app đóng gói sẵn file này), nên viết ngắn, bằng lời của người dùng. Khi đẩy tag `vx.y.z`, GitHub Actions lấy đúng mục này làm ghi chú phát hành; thiếu mục thì không phát hành.

## 0.2.0

- Giao diện mới theo màu app ゆうちょ: theme Sáng/Tối, chọn cỡ chữ, icon app mới.
- Ảnh đại diện cho từng người, hiện thay tên trong các màn hình.
- Mở app sẽ báo các khoản chi người kia mới thêm.
- Ngân sách danh mục có khoản định kỳ tự lấy theo tổng các khoản đó.
- Bấm ô icon ở màn Danh mục để chọn emoji.

## 0.1.0

- Bản đầu tiên: ghi khoản chi chung, tất toán 50/50 và khóa tháng.
- Ngân sách, danh mục, chi tiêu định kỳ, báo cáo, import/export CSV.
- Đồng bộ hai máy qua thư mục Google Drive, backup tự động, mã hóa file trên Drive.
- Tự kiểm tra bản cập nhật.
