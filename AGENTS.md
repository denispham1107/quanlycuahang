# Quy tắc hồi quy giao diện

- Popup thêm khoản Thu/Chi dùng chung cho desktop, iPhone/iPad và Android. Khi sửa vùng chọn/tạo danh mục, phải kiểm tra độ rộng 320px, 375px, 430px và màn hình ngang; ô nhập phải đọc và gõ được, mọi nút nằm trong popup.
- CSS mobile hiện có quy tắc chung `form button { width: 100%; }`. Mọi nút nằm cạnh `input` hoặc `select` trong popup phải ghi đè `width: auto` và dùng lưới `minmax(0, 1fr) max-content` (hoặc cách bố trí tương đương đã kiểm tra kích thước thực tế). Không dựa riêng vào `flex: 0 0 auto` vì nó vẫn giữ chiều rộng 100%.
- Sau khi tạo danh mục trong popup, giữ nguyên tên khoản, số tiền, ngày; chọn ngay danh mục mới; không đóng popup. Kiểm thử cả Thu lẫn Chi, trường hợp chưa có danh mục và tên trùng.
- Trước khi hoàn tất thay đổi giao diện, chạy `node --test tests/*.test.js` và kiểm tra trực quan ở kích thước mobile, kể cả khi bàn phím mở.
