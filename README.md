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

Nếu website chỉ dùng nội bộ nhưng chưa có đăng nhập, không nên để database mở vĩnh viễn. Cách tốt hơn là thêm Firebase Authentication ở bước tiếp theo.

Tạm thời để kiểm thử, có thể dùng rules có hạn ngày:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /quanlycuahang/{document} {
      allow read, write: if request.time < timestamp.date(2026, 12, 31);
    }
  }
}
```

Sau khi kiểm thử xong, nên chuyển sang đăng nhập email/password và rules theo user được phép.

## Deploy lên GitHub Pages

1. Commit các file đã sửa:

```bash
git add index.html styles.css app.js firebase-config.js firebase-config.example.js README.md
git commit -m "Use Firebase Firestore for shared cloud storage"
git push origin main
```

2. Mở lại GitHub Pages sau khi GitHub deploy xong.

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
