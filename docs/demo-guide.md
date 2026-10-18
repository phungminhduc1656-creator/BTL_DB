# Kịch bản demo cho nhóm 5 người

Mục tiêu buổi demo là chứng minh hệ thống đặt sân đúng theo khung giờ một giờ, giữ lịch sử khi hủy và bảo vệ tiền đã thanh toán. Chạy dự án theo README, đăng nhập bằng `admin` / `admin123` và dùng dữ liệu mẫu trong cơ sở dữ liệu.

## Chuẩn bị trước buổi trình bày

1. Kiểm tra MySQL và ứng dụng đang chạy; mở giao diện trên máy trình bày.
2. Chuẩn bị một sân đang hoạt động và hai khách có số điện thoại khác nhau. Có thể tạo sân mã `DEMO-A`, giá 150.000 đồng/giờ, cùng khách Minh và Lan.
3. Chọn ngày mai theo ngày mà ứng dụng hiển thị; chọn các ô 18:00–19:00 và 19:00–20:00 còn trống. Nếu dữ liệu mẫu đã giữ hai ô này, chọn một sân hoặc ngày khác.
4. Mở hai tab nếu muốn minh họa một lịch vừa bị người khác đặt. Hai tab vẫn dùng cùng phiên đăng nhập, nhưng có thể gửi hai yêu cầu đặt riêng biệt.
5. Chuẩn bị công cụ xem dữ liệu MySQL để kiểm tra các bảng `bookings`, `booking_items`, `payments`. Chỉ dùng truy vấn đọc trong demo; không sửa bảng để làm cho tình huống thành công.

## Người 1: Giới thiệu phạm vi và mô hình — khoảng 2 phút

Trình bày một cơ sở, nhiều sân, giờ mở cửa 06:00–23:00 và đơn gồm các giờ liên tiếp. Mở [sơ đồ dữ liệu](erd.md) để chỉ quan hệ khách → đơn → chi tiết và đơn → thanh toán.

Giải thích bằng ví dụ: sân A ngày mai lúc 18:00–19:00 là một ô đặt; cùng giờ ở sân B là một ô khác. Một khách chơi hai giờ thì một đơn có hai chi tiết.

## Người 2: Quản lý sân và khách hàng — khoảng 2 phút

1. Tạo hoặc mở sân `DEMO-A`, giá 150.000 đồng/giờ, trạng thái hoạt động.
2. Tạo khách Minh và Lan hoặc chọn bản ghi đã có.
3. Thử tạo khách có số điện thoại đã tồn tại; hệ thống phải báo lỗi.
4. Chọn một sân không có lịch `CONFIRMED` chưa kết thúc, chuyển sang bảo trì và chỉ ra sân đó không nhận đơn mới. Có thể tạo sân `DEMO-B` riêng cho tình huống này. Khôi phục trạng thái nếu dùng sân này cho các bước tiếp theo.

Kết nối màn hình với `customers`, `courts` và các ràng buộc duy nhất.

## Người 3: Đặt hai giờ và chống trùng — khoảng 3 phút

1. Đặt sân `DEMO-A` cho Minh từ 18:00–20:00 ngày đã chọn. Kết quả là một đơn `CONFIRMED`, hai chi tiết và tổng tiền 300.000 đồng.
2. Mở lịch: hai ô vừa đặt phải chuyển sang bận.
3. Thử đặt cùng sân, ngày và một trong hai giờ cho Lan. Hệ thống không được tạo đơn trùng; nếu giao diện khóa ô bận, minh họa bằng tab đã mở lịch trước khi Minh đặt hoặc yêu cầu API được chuẩn bị trước.
4. Chỉ ra Lan vẫn đặt được cùng giờ ở một sân khác hoặc giờ kế tiếp tại sân A.
5. Thử chuyển sân `DEMO-A` sang bảo trì khi còn đơn tương lai của Minh; hệ thống phải từ chối để bảo vệ lịch khách đã đặt.

Trong DB, mở `booking_items` và giải thích khóa duy nhất của `court_id`, `play_date`, `time_slot_id`, `active_guard`. Lịch ở giao diện hỗ trợ chọn giờ; ràng buộc DB vẫn bảo vệ khi lịch chưa được tải lại.

## Người 4: Hủy, đặt lại và thanh toán — khoảng 3 phút

1. Hủy đơn của Minh khi chưa thanh toán. Lịch phải giải phóng cả hai ô.
2. Mở dữ liệu: đơn cũ vẫn còn với trạng thái `CANCELLED`; chi tiết có `released_at` và `active_guard = NULL`.
3. Đặt lại cùng hai giờ cho Lan. Yêu cầu phải thành công; tổng tiền vẫn là 300.000 đồng nếu giá sân chưa thay đổi.
4. Ghi nhận thanh toán tiền mặt hoặc chuyển khoản. Kiểm tra có đúng một bản ghi thanh toán với đủ số tiền.
5. Thử hủy đơn đã thanh toán; thao tác phải bị từ chối. Thử thanh toán lần hai; không được tạo khoản thu thứ hai.
6. Thử hoàn tất đơn của ngày mai; thao tác phải bị từ chối vì chưa hết giờ chơi.

Để minh họa hoàn tất thành công, dùng một đơn đã thanh toán có giờ kết thúc trong quá khứ từ dữ liệu mẫu nếu có. Không đổi giờ máy hoặc sửa dữ liệu để vượt qua quy tắc.

## Người 5: Báo cáo, kiểm thử và kết nối kết quả — khoảng 2 phút

1. Mở báo cáo với khoảng ngày bao gồm ngày thanh toán vừa ghi nhận. Doanh thu đã thu phải phản ánh khoản 300.000 đồng vừa tạo.
2. Xuất CSV và mở tệp để kiểm tra dữ liệu đọc được.
3. Tóm tắt các tình huống đã kiểm tra: đặt nhiều giờ, chống trùng, hủy rồi đặt lại, không hủy đơn đã thanh toán, không thanh toán hai lần và không hoàn tất trước giờ kết thúc.
4. Chỉ ra giá ở chi tiết là giá lưu tại thời điểm đặt: chỉnh giá sân, mở lại đơn cũ và xác nhận tổng tiền cũ giữ nguyên.

Số liệu tổng trong báo cáo có thể gồm dữ liệu mẫu. So sánh mức tăng trước/sau thao tác thay vì mặc định báo cáo phải có đúng 300.000 đồng.

## Bảng kiểm kết quả

| Tình huống | Kết quả mong đợi |
|---|---|
| Hai giờ liên tiếp còn trống | Một đơn, hai chi tiết, tổng tiền đúng. |
| Hai giờ không liên tiếp | Từ chối tạo đơn. |
| Đặt vào sân bảo trì | Từ chối tạo đơn. |
| Chuyển sân còn đơn chưa hết giờ sang bảo trì | Từ chối đổi trạng thái. |
| Hai yêu cầu cùng sân/ngày/giờ | Tối đa một yêu cầu giữ chỗ thành công. |
| Một ô trong đơn nhiều giờ bị bận | Toàn bộ đơn thất bại, không giữ những ô còn lại. |
| Hủy đơn chưa thanh toán | Giữ lịch sử, giải phóng tất cả ô. |
| Đặt lại ô đã được giải phóng | Thành công nếu ngày còn hợp lệ. |
| Thanh toán đủ tiền | Tạo một khoản thu đúng tổng giá đã chốt. |
| Hủy sau thanh toán hoặc thanh toán lại | Từ chối. |
| Hoàn tất trước khi hết giờ | Từ chối. |
| Hoàn tất sau khi hết giờ, đã thanh toán | Chuyển thành `COMPLETED`. |
| Đổi giá sân sau khi có đơn | Đơn cũ giữ nguyên tổng tiền. |
| Ngày ngoài khoảng từ hôm nay đến +30 ngày | Từ chối. |
| Đặt khung giờ đã bắt đầu trong hôm nay | Từ chối. |

Mỗi thành viên nên biết luồng đặt → thanh toán → hoàn tất và luồng đặt → hủy. Khi được hỏi về một màn hình, giải thích dữ liệu được đọc/ghi vào bảng nào và ràng buộc nào bảo vệ thao tác đó.

## Truy vấn đọc để minh họa lịch sử

Sau khi hủy rồi đặt lại, có thể dùng truy vấn sau để thấy hai đơn riêng và ô giờ chỉ được giữ bởi đơn mới:

```sql
SET time_zone = '+07:00';

SELECT b.booking_code, b.status, c.code AS court_code,
       bi.play_date, ts.start_time, ts.end_time,
       bi.unit_price, bi.released_at, bi.active_guard
FROM bookings b
JOIN booking_items bi ON bi.booking_id = b.id
JOIN courts c ON c.id = bi.court_id
JOIN time_slots ts ON ts.id = bi.time_slot_id
WHERE c.code = 'DEMO-A'
  AND bi.play_date = CURRENT_DATE + INTERVAL 1 DAY
ORDER BY b.id, ts.start_time;
```

Thay mã sân hoặc ngày nếu nhóm chọn tình huống khác. Đơn hủy có `active_guard = NULL`; đơn mới có `active_guard = 1`. Các bản ghi cùng sân/ngày/giờ được phép tồn tại trong lịch sử, nhưng chỉ một bản ghi được giữ chỗ.

Tệp [04_queries.sql](../database/04_queries.sql) chứa các truy vấn học phần để minh họa `JOIN`, `GROUP BY`, `HAVING`, truy vấn con và CTE. Khi tính doanh thu, tránh cộng lại cùng một khoản thanh toán nhiều lần sau khi nối với các chi tiết nhiều giờ.

## Demo luồng khách hàng và quản lý cùng một đơn

Dùng cửa sổ thường cho khách và cửa sổ ẩn danh cho quản lý, vì hai trang cùng trình duyệt dùng chung phiên.

1. Mở `MO_KHACH_HANG.bat`, đăng ký tài khoản mới bằng số điện thoại chưa có.
2. Chọn một ngày tương lai, một sân và hai giờ liên tiếp; kiểm tra tiền, xác nhận và ghi lại mã đơn.
3. Vào **Đơn của tôi** xem mã đơn và trạng thái thanh toán tại sân.
4. Trong cửa sổ ẩn danh mở `/quan-ly/`, đăng nhập admin, tìm đúng mã đơn trong **Đơn đặt sân**. Chỉ ra hồ sơ khách và số tiền trùng phía khách.
5. Ghi nhận thu tiền mặt/chuyển khoản sau khi giả lập đã nhận tiền; quay lại phía khách tải lại chi tiết để thấy **Đã thanh toán**.
6. Đặt một đơn khác chưa thanh toán, dùng phía khách hủy; phía quản lý vẫn thấy lịch sử hủy và ô giờ lại trống.
7. Mở **Tài khoản** đổi tên hoặc mật khẩu; chỉ ra khách không có quyền quản lý sân, thu tiền hoặc xem đơn người khác.

Có thể phân vai demo: một bạn thiết kế DB/ràng buộc, một bạn procedure/giao dịch, một bạn Java tài khoản/phân quyền, một bạn phía khách, một bạn phía quản lý/kiểm thử. Xem chi tiết thư mục trong `docs/khach-hang.md`.
