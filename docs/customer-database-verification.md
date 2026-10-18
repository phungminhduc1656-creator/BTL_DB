# Kiểm chứng migration cổng khách hàng

Kiểm tra ngày 15/10/2026 trên MySQL 8.0.46, sử dụng database tạm có tên ngẫu nhiên riêng và dữ liệu giả. Database chính và tiến trình ứng dụng đang chạy được giữ nguyên. Các quyền cấp tạm cho `pickleball_app` được thu hồi và database tạm được dọn sau kiểm tra.

Các migration là [05_customer_portal.sql](../database/05_customer_portal.sql) và [06_customer_account_rules.sql](../database/06_customer_account_rules.sql). Lớp [CustomerSchema.java](../src/main/java/vn/edu/pickleball/CustomerSchema.java) kiểm tra từng phần trước khi gọi migration còn thiếu. `SqlInstaller` nạp script 05 rồi 06 khi cài mới; `DemoData` kiểm tra migration cả khi `app.setup=false`. Cài migration không tạo lại đơn mẫu.

Các kiểm tra chạy bằng MySQL client và một Java harness tạm, biên dịch trực tiếp `CustomerSchema` cùng `SqlInstaller` và dùng JDBC thật. Kiểm tra Java tách biệt với việc đóng gói ứng dụng. Bảng `app_users` của database tạm được đưa về cấu trúc cũ để kiểm tra nâng cấp dữ liệu đang có; snapshot trước/sau gồm ID, tên, password hash của tài khoản giả và toàn bộ số lượng đơn/chi tiết/thanh toán.

**Kết quả: 23/23 kiểm tra đạt.**

| # | Nội dung kiểm chứng |
|---|---|
| 1 | Cài schema mới tạo đủ `role` và `customer_id`. |
| 2 | `CustomerSchema.install` nâng cấp cấu trúc cũ qua JDBC; gọi lại không thực thi DDL. |
| 3 | Tài khoản quản trị giả và toàn bộ dữ liệu đơn/chi tiết/thanh toán cũ giữ nguyên sau nâng cấp. |
| 4 | Tài khoản cũ nhận `role=ADMIN`, `customer_id=NULL`, giữ nguyên danh tính. |
| 5 | Chạy lại file SQL 05 không làm thay đổi snapshot dữ liệu. |
| 6 | Sau migration vẫn chỉ có 7 bảng nghiệp vụ. |
| 7 | Sau khi thu hồi `ALTER`, `CREATE ROUTINE`, `ALTER ROUTINE` của tài khoản chạy thử trên DB tạm, `CustomerSchema.install` vẫn bỏ qua DDL và chạy thành công trên schema đã đủ. |
| 8 | Tạo tài khoản `CUSTOMER` gắn một hồ sơ khách hợp lệ. |
| 9 | CHECK từ chối `CUSTOMER` không có hồ sơ. |
| 10 | CHECK từ chối `ADMIN` gắn hồ sơ khách. |
| 11 | UNIQUE từ chối tài khoản thứ hai cho cùng hồ sơ khách. |
| 12 | FK từ chối hồ sơ khách không tồn tại. |
| 13 | Khách gọi hủy đơn người khác nhận `BOOKING_NOT_FOUND`. |
| 14 | Đơn không tồn tại cũng trả `BOOKING_NOT_FOUND`. |
| 15 | Kiểm tra sở hữu thất bại giữ nguyên trạng thái đơn. |
| 16 | Chủ đơn hủy được đơn tương lai chưa trả tiền; chi tiết vẫn còn và toàn bộ slot được giải phóng. |
| 17 | Các slot vừa được khách hủy có thể được đặt lại. |
| 18 | Đơn đã hủy không thể được khách hủy lần nữa. |
| 19 | Khách không được hủy đơn đã thanh toán. |
| 20 | Khách không được hủy đơn đã bắt đầu. |
| 21 | Yêu cầu hủy muộn bị từ chối giữ nguyên trạng thái `CONFIRMED`. |
| 22 | Thanh toán và khách hủy đồng thời chỉ có một thao tác thành công. |
| 23 | Tranh chấp trên không tạo đơn vừa `CANCELLED` vừa có thanh toán. |

## Hợp đồng procedure

`CALL sp_cancel_customer_booking(p_booking_id, p_customer_id)` tự quản lý transaction, đặt múi giờ `+07:00` và không trả result set. Mã khách phải được backend lấy từ session đã đăng nhập. Procedure khóa dòng đơn trước, kiểm tra sở hữu, trạng thái, thanh toán và giờ bắt đầu sớm nhất, rồi chuyển `CANCELLED`; trigger cũ giải phóng các slot.

Lỗi nghiệp vụ có SQLSTATE `45000`: `BOOKING_NOT_FOUND`, `INVALID_TRANSITION`, `PAID_BOOKING_CANNOT_CANCEL`, `BOOKING_ALREADY_STARTED`. Hai trường hợp không tồn tại và không sở hữu dùng chung mã để không tiết lộ đơn của khách khác. `sp_cancel_booking` tiếp tục phục vụ thao tác quản trị.

## Quyền cài đặt và quyền chạy

Lần cài/nâng cấp cần quyền DDL/routine trong database dự án; launcher hiện cấp quyền trong `pickleball_db` cho tài khoản ứng dụng. Với cách cấp quyền hạn chế, quản trị viên nhập các script 01, 02, 03, 05, 06 trước, rồi cấp quyền dữ liệu và `EXECUTE` phù hợp cho tài khoản chạy ứng dụng. Khi schema đã đủ, `CustomerSchema` chỉ đọc metadata để xác nhận và không nạp lại DDL.

## Kiểm chứng migration 06: tên đăng nhập không giới hạn chữ Latin

Cập nhật ngày 15/10/2026: [06_customer_account_rules.sql](../database/06_customer_account_rules.sql) thay CHECK cũ `ck_app_users_username` (tối thiểu 3 ký tự) bằng `ck_app_users_username_nonblank` với `CHAR_LENGTH(TRIM(username)) BETWEEN 1 AND 50`. Chấp nhận tên tiếng Việt và khoảng trắng bên trong. UNIQUE hiện có cùng collation của DB được giữ nguyên. Migration không sửa tên, mật khẩu, vai trò hay hồ sơ của tài khoản đã có.

`CustomerSchema.install` kiểm tra độc lập hai bước:

1. Nếu thiếu cột/ràng buộc cổng khách hàng hoặc `sp_cancel_customer_booking`, chạy migration 05.
2. Nếu thiếu CHECK `ck_app_users_username_nonblank` hoặc vẫn còn CHECK cũ, chạy migration 06.

Nhờ đó DB đã có cổng khách hàng vẫn được cập nhật quy tắc mới khi `app.setup=false`; DB trước khi có cổng khách hàng nhận 05 trước 06. Khi cả hai phần đầy đủ, ứng dụng không thực thi DDL. File 06 dùng một lệnh `ALTER TABLE` để thay CHECK cũ bằng CHECK mới; chạy lại file không đổi dữ liệu.

**17/17 kiểm tra bổ sung đạt** trên hai database tạm riêng. Dùng Java harness tạm biên dịch bản hiện tại của `CustomerSchema` và `SqlInstaller`, kết nối MySQL thật bằng JDBC; snapshot dữ liệu giả trước/sau và thu hồi quyền DDL chỉ áp dụng trong database tạm. Sau kiểm tra đã thu hồi quyền cấp tạm và dọn cả hai DB; database chính và các tiến trình đang chạy được giữ nguyên.

| # | Nội dung kiểm chứng |
|---|---|
| 1 | Cài mới bằng `SqlInstaller` nạp 06; kiểm tra readiness sau đó không chạy DDL. |
| 2 | Fixture trước nâng cấp xác nhận CHECK cũ thực sự từ chối tên một ký tự. |
| 3 | DB đã có cổng khách hàng chỉ chạy migration 06, không nạp lại 05; gọi lại không chạy DDL. |
| 4 | Admin, khách, username, hash, role, liên kết hồ sơ và số lượng đơn/chi tiết/thanh toán giữ nguyên sau nâng cấp. |
| 5 | CHECK cũ `ck_app_users_username` được bỏ. |
| 6 | CHECK mới `ck_app_users_username_nonblank` được cài. |
| 7 | Chấp nhận tên `Q`, `Ớ`, `Tên khách Việt` và tên dài đúng 50 ký tự. |
| 8 | Khoảng trắng bên trong tên được giữ nguyên. |
| 9 | Từ chối tên rỗng. |
| 10 | Từ chối tên chỉ có dấu cách. |
| 11 | Từ chối tên 51 ký tự. |
| 12 | UNIQUE tiếp tục từ chối tên đã tồn tại. |
| 13 | Chạy lại file SQL 06 giữ nguyên toàn bộ snapshot tài khoản/dữ liệu. |
| 14 | Sau khi thu hồi `ALTER`, `CREATE ROUTINE`, `ALTER ROUTINE` trên DB tạm, schema đã đủ vẫn khởi tạo migration checker thành công mà không chạy DDL. |
| 15 | DB cấu trúc cũ trước cổng khách hàng được nâng cấp bằng 05 trước 06; lần sau không chạy DDL. |
| 16 | Tài khoản quản trị cũ giữ nguyên username/hash và nhận đúng `ADMIN`, hồ sơ khách NULL. |
| 17 | Mô hình vẫn giữ 7 bảng, không thêm bảng theo dõi migration. |
