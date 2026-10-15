# Chốt sổ trong tệp JSON xuất dữ liệu

Từ phiên bản PWA 175, nút **Xuất dữ liệu** và tệp tự gửi khi mở **Trợ lý AI** dùng cùng một JSON đầy đủ cho mọi cửa hàng, không phụ thuộc cửa hàng, ngày hoặc tháng đang xem.

- `stores[].closingMonths`: dữ liệu gốc đã lưu, giữ nguyên tất cả tháng, ngày, ca và metadata để khôi phục bằng Nhập dữ liệu.
- `stores[].closingBookReport`: báo cáo bổ sung chỉ được tạo trên bản sao xuất, không ghi vào cloud/cache cửa hàng. Khi nhập, báo cáo này được bỏ qua; lần xuất sau luôn tính lại từ dữ liệu gốc.

## Nội dung báo cáo bổ sung

- `labels`: tên tiếng Việt của các trường tiền, kết quả tính và ghi chú; `currency` là VND.
- `monthCount`, `savedDays`, `shiftCount`: số tháng, ngày đã lưu và ca của cửa hàng.
- `months[].days[]`: ngày sổ, lần lưu cuối và đầy đủ các ca theo thứ tự gốc.
- `shifts[].values`: tiền đầu ca, POS, bill VCB/Momo/Zalop/tiền mặt, VCB/Momo/Zalop thực tế và tiền đếm cuối ca.
- `shifts[].payments`: Trong sổ, Thực tế và Chênh lệch của từng POS/VCB/Momo/Zalop.
- `shifts[].totals`: tổng Thu/Chi, POS thực tế, tiền két theo sổ sách và toàn bộ chênh lệch; dùng đúng `ClosingBookCore.calculate` như màn hình.
- `shifts[].details.income/expense`: tổng tiền, số khoản, số khoản đã chuyển, mọi dòng ghi chú/số tiền/ID/thời điểm/Mục, tên Mục, trạng thái đã chuyển và bản ghi Thu/Chi liên kết nếu còn tồn tại. Bản ghi hủy vẫn giữ trạng thái hủy; không bị loại khỏi dữ liệu gốc.
- `shifts[].posTransfer`: metadata chuyển POS, tên Mục và khoản Thu liên kết nếu có.
- `shifts[].result/recheck`: Kết quả chốt két và Các bill đã hủy.
- `months[].audit.shortage/surplus`: đầy đủ năm nhóm kiểm kê POS/VCB/Momo/Zalop/Tiền két, mỗi nhóm có tổng, tổng có dấu, số ngày đã lưu, ngày Dư/Thiếu và chênh lệch từng ca. Cộng các ca theo ngày trước khi lọc dấu, không cộng chéo các nhóm.

Chỉ dữ liệu **đã lưu** được xuất (`savedDataOnly: true`); thao tác xuất không tự lưu, thay đổi hay hủy bản nháp đang nhập. Dữ liệu gốc lịch sử không bị chuẩn hóa lại chỉ để xuất. Nếu dữ liệu cũ có lỗi hoặc tổng vượt số nguyên an toàn, dữ liệu gốc vẫn được giữ; báo cáo ghi `complete: false` và vị trí/lý do trong `errors` thay vì giả định giá trị 0 hoặc âm thầm bỏ ca.
