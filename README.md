# Quản lý cửa hàng

Website tĩnh chạy trên GitHub Pages. Dữ liệu chính được lưu trên Firebase Firestore để nhiều máy tính, trình duyệt và điện thoại dùng chung một bộ dữ liệu.

## Cấu hình Firebase Firestore

1. Vào https://console.firebase.google.com/ và tạo một project mới.
2. Trong project, chọn **Build > Firestore Database**.
3. Bấm **Create database**, chọn khu vực gần bạn, rồi tạo database.
4. Vào **Project settings > General > Your apps**.
5. Tạo app loại **Web**.
6. Sao chép đoạn `firebaseConfig`.
7. Mở file `firebase-config.js` và thay toàn bộ giá trị `PASTE_YOUR_FIREBASE_CONFIG_HERE` bằng config thật.

Ví dụ:

```js
window.firebaseAppConfig = {
  apiKey: "...",
  authDomain: "ten-project.firebaseapp.com",
  projectId: "ten-project",
  storageBucket: "ten-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

## Firestore rules dùng nội bộ

Dự án sử dụng Firebase Authentication và file `firestore.rules` để phân quyền. Không thay thế rules hiện tại bằng rules mở theo ngày, vì cách đó sẽ bỏ qua toàn bộ bảo vệ tài khoản admin/nhân viên.

## Thiết lập đăng nhập và phân quyền

1. Trong Firebase Console, mở **Authentication > Sign-in method** và bật **Email/Password**.
2. Trong **Authentication > Settings > Authorized domains**, thêm `denispham1107.github.io`.
3. Tạo tài khoản admin đầu tiên trong **Authentication > Users**.
4. Lấy `UID` của tài khoản admin rồi tạo document `users/{UID}` trong Firestore.

Tài khoản quản trị:

```json
{
  "displayName": "Quản trị viên",
  "role": "admin",
  "active": true
}
```

Sau khi đăng nhập bằng admin, mở **Cài đặt > Nhân viên** để tạo và quản lý tài khoản nhân viên ngay trên website. Admin có thể chọn cửa hàng, bật/tắt tài khoản và tick từng quyền:

- Xem tab Nhập hàng.
- Tạo mới trong Nhập hàng.
- Xem tab Bán hàng.
- Tạo mới trong Bán hàng.
- Xem lịch sử hoạt động của chính nhân viên đó.

Quyền tạo mới tự động yêu cầu quyền xem tương ứng. Nhân viên luôn bị khóa quyền sửa và xóa ở phía giao diện lẫn Cloud Functions. Mật khẩu tạm thời chỉ được gửi qua HTTPS đến Firebase Authentication khi tạo tài khoản, không được lưu trong Firestore.

Hồ sơ nhân viên được hệ thống tự tạo theo cấu trúc:

```json
{
  "displayName": "Tên nhân viên",
  "role": "employee",
  "active": true,
  "storeId": "ID_CUA_HANG",
  "permissions": {
    "purchase": { "view": true, "create": true },
    "sales": { "view": true, "create": true },
    "history": { "viewOwn": true }
  }
}
```

Tài khoản nhân viên cũ chưa có field `permissions` tiếp tục nhận bộ quyền mặc định cũ để không làm gián đoạn sử dụng. Chức năng này dùng ba Cloud Functions: `manageEmployeeAccounts`, `getEmployeeState` và `saveEmployeeMutation`.

## Deploy lên GitHub Pages

1. Commit các file đã sửa:

```bash
git add index.html styles.css app.js service-worker.js firebase-config.js firebase-config.example.js firestore.rules functions/index.js README.md
git commit -m "Add Firebase login and role permissions"
git push origin main
```

2. Mở lại GitHub Pages sau khi GitHub deploy xong.

## Cài đặt website như một ứng dụng

Website đã được cấu hình dưới dạng Progressive Web App (PWA). Tính năng cài đặt chỉ hoạt động khi website được mở qua HTTPS; GitHub Pages đã đáp ứng yêu cầu này.

### iPhone và iPad

1. Mở website bằng Safari.
2. Nhấn nút **Chia sẻ**.
3. Chọn **Thêm vào Màn hình chính**.
4. Nhấn **Thêm**.

### Điện thoại và máy tính bảng Android

1. Mở website bằng Chrome.
2. Chọn **Cài đặt ứng dụng** hoặc **Thêm vào Màn hình chính** trong menu trình duyệt.
3. Xác nhận cài đặt.

Sau khi cài, ứng dụng mở trong cửa sổ riêng và sử dụng biểu tượng Quản lý cửa hàng. Dữ liệu vẫn được đồng bộ qua Firestore như trước.

## Quy trình kiểm tra

1. Mở website trên máy A.
2. Tạo cửa hàng, mục thu/chi và khoản thu/chi.
3. Tải lại trang trên máy A, dữ liệu vẫn còn.
4. Mở website trên máy B hoặc trình duyệt khác, dữ liệu từ máy A phải xuất hiện.
5. Sửa hoặc xóa dữ liệu trên máy B.
6. Quay lại máy A và tải lại trang, dữ liệu mới phải xuất hiện.

## Ghi chú kỹ thuật

- `localStorage` chỉ còn là cache tạm để mở nhanh hoặc xem lại khi mất mạng.
- Dữ liệu chính nằm trong Firestore document `quanlycuahang/shared-state`.
- Mọi thao tác thêm, sửa, xóa đều gọi lưu lên Firestore.
