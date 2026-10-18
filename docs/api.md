# API của bản demo

API dùng JSON, trường dữ liệu viết theo `snake_case`, ngày theo `YYYY-MM-DD` và giờ theo định dạng 24 giờ. Trình duyệt sử dụng phiên đăng nhập của máy chủ.

## Cấu trúc trả về và xác thực

Kết quả thành công đặt trong trường `data`:

```json
{"data": {"authenticated": false, "csrf_token": "..."}}
```

Lỗi có thông điệp để hiển thị trực tiếp:

```json
{"message": "Thông báo lỗi"}
```

Trước khi đăng nhập, gọi `GET /api/auth/session` để lấy `csrf_token`. Các yêu cầu `POST` và `PUT` gửi `Content-Type: application/json`, cookie phiên và header `X-CSRF-TOKEN` chứa token hiện tại. Đăng nhập thành công tạo phiên mới; phải đọc lại phiên để lấy token mới trước thao tác tiếp theo. Sau khi đăng xuất, đọc lại phiên trước khi đăng nhập lần nữa.

Trong trình duyệt cùng nguồn, cookie được gửi tự động. Nếu sử dụng `fetch`, có thể đặt `credentials: "same-origin"`. Không ghi mật khẩu hoặc token vào URL.

| Phương thức | Đường dẫn | Nội dung |
|---|---|---|
| GET | `/api/auth/session` | Trả `authenticated`, `csrf_token` và `user` khi đã đăng nhập. |
| POST | `/api/auth/login` | Đăng nhập bằng `username`, `password`. |
| POST | `/api/auth/logout` | Kết thúc phiên đăng nhập. |

`session.data.user` là `null` khi chưa đăng nhập. Khi đã đăng nhập, đối tượng người dùng gồm `id`, `username`, `display_name`, `role`, `customer_id`. Đăng nhập thành công trả đối tượng người dùng trong `data`; đăng xuất thành công trả `data.message`.

Các API nghiệp vụ yêu cầu đúng quyền ADMIN hoặc CUSTOMER. Riêng GET `/api/customer/config`, `/api/customer/courts` và `/api/customer/availability` được xem công khai. POST đăng ký cũng công khai nhưng cần CSRF. Phiên hết hạn sau 30 phút không hoạt động theo cấu hình mặc định.

Tài khoản chạy demo: `admin` / `admin123`. Mật khẩu trong cơ sở dữ liệu được băm BCrypt.

```json
{"username": "admin", "password": "admin123"}
```

## Cấu hình và tổng quan

| Phương thức | Đường dẫn | Tham số / kết quả chính |
|---|---|---|
| GET | `/api/config` | `today`, `max_booking_date`, `time_slots`. |
| GET | `/api/dashboard?date=2026-10-20` | Tổng quan hoạt động cho ngày được chọn. |
| GET | `/api/availability?date=2026-10-20` | Lịch các sân và trạng thái các ô giờ trong ngày. |

`date` của dashboard có thể bỏ qua, mặc định hôm nay. `date` của availability bắt buộc và nằm trong khoảng được phép đặt.

`time_slots` là danh mục từ 06:00–07:00 đến 22:00–23:00. Dùng `id` nhận từ API, không suy ra ID từ số giờ hiển thị. Giao diện dùng `today` và `max_booking_date` của máy chủ thay vì tự tính bằng múi giờ thiết bị.

`availability.data` gồm `date`, `time_slots` và `courts`. Mỗi sân có các trường danh mục và một mảng `slots`; mỗi ô gồm:

| Trường | Ý nghĩa |
|---|---|
| `time_slot_id`, `start_time`, `end_time` | Định danh và giờ của ô. |
| `available` | `true` nếu có thể chọn đặt tại thời điểm tải lịch. |
| `booking_id` | ID đơn đang giữ ô, hoặc `null`. |
| `reason` | `UNAVAILABLE` khi sân không hoạt động, `PAST` khi giờ đã bắt đầu, `BOOKED` khi có người giữ, hoặc `null` nếu còn trống. |

`dashboard.data` gồm `date`, `booking_count`, `unpaid_total`, `paid_revenue`, `customer_count`, `available_slot_count`, `total_slot_count`, `recent_bookings`, `court_utilization`.

- `booking_count` và `unpaid_total` tính theo ngày chơi; loại trừ đơn hủy.
- `paid_revenue` tính theo ngày nhận tiền.
- `customer_count` là tổng số khách trong hệ thống.
- `recent_bookings` là tối đa sáu đơn mới nhất cho ngày chọn.
- `court_utilization` gồm `id`, `name`, `booked_slots`, `total_slots` cho các sân hoạt động.

## Sân

| Phương thức | Đường dẫn | Nội dung |
|---|---|---|
| GET | `/api/courts` | Danh sách sân. |
| POST | `/api/courts` | Tạo sân. |
| PUT | `/api/courts/{id}` | Cập nhật sân. |

Ví dụ dữ liệu tạo/cập nhật:

```json
{
  "code": "DEMO-A",
  "name": "Sân demo A",
  "description": "Sân dùng cho buổi trình bày",
  "hourly_price": 150000,
  "status": "ACTIVE"
}
```

`code` không được trùng, tối đa 20 ký tự, chỉ gồm chữ Latin, số, `_` hoặc `-`; máy chủ lưu mã in hoa. `hourly_price` là số nguyên từ 1.000 đến 10.000.000 đồng. `status` nhận `ACTIVE`, `MAINTENANCE` hoặc `INACTIVE`. Đổi giá không làm thay đổi giá của các đơn đã đặt.

Danh sách trả mảng sân trong `data`; tạo/cập nhật trả một sân. Không được chuyển sân sang trạng thái khác `ACTIVE` khi còn lịch `CONFIRMED` chưa kết thúc.

## Khách hàng

| Phương thức | Đường dẫn | Nội dung |
|---|---|---|
| GET | `/api/customers?q=Minh` | Danh sách khách hàng; `q` tùy chọn tìm theo tên, điện thoại hoặc email. |
| POST | `/api/customers` | Tạo khách hàng. |
| PUT | `/api/customers/{id}` | Cập nhật khách hàng. |
| GET | `/api/customers/{id}/bookings` | Lịch sử đơn của một khách hàng. |

```json
{
  "full_name": "Nguyễn Minh Demo",
  "phone": "0900000991",
  "email": "minh.demo@example.com"
}
```

Số điện thoại là duy nhất; nhận dạng bắt đầu bằng `0` với tổng cộng 10–11 chữ số hoặc bắt đầu bằng `+84` và có thêm 9–10 chữ số. Email có thể để trống; nếu nhập phải đúng định dạng và tối đa 150 ký tự. Khi tạo đơn, gửi `customer_id` của khách hiện có.

Khách hàng trả các trường `id`, `full_name`, `phone`, `email`, `booking_count`. Số `booking_count` của khách gồm cả đơn đã hủy. Danh sách tìm kiếm giới hạn 500 khách mới nhất. Tạo/cập nhật trả một đối tượng khách hàng.

## Đơn đặt sân

| Phương thức | Đường dẫn | Nội dung |
|---|---|---|
| GET | `/api/bookings?date=2026-10-20&status=CONFIRMED&q=Minh` | Tra cứu; các bộ lọc `date`, `status`, `q` có thể bỏ qua. |
| POST | `/api/bookings` | Tạo đơn và các khung giờ trong cùng giao dịch. |
| GET | `/api/bookings/{id}` | Chi tiết đơn, các khung giờ và thông tin thanh toán. |
| POST | `/api/bookings/{id}/cancel` | Hủy đơn chưa thanh toán và giải phóng ô giờ. |
| POST | `/api/bookings/{id}/pay` | Ghi nhận thanh toán đủ tiền. |
| POST | `/api/bookings/{id}/complete` | Hoàn tất đơn đã thanh toán sau giờ chơi. |

Ví dụ tạo đơn; thay các ID và ngày bằng dữ liệu nhận từ API:

```json
{
  "customer_id": 1,
  "court_id": 1,
  "play_date": "2026-10-20",
  "slot_ids": [13, 14],
  "note": "Chơi hai giờ liên tiếp"
}
```

`slot_ids` phải chứa các ID khác nhau và tương ứng những giờ liên tiếp. Máy chủ kiểm tra sân hoạt động, ngày trong giới hạn, các giờ chưa bắt đầu, ô giờ chưa có người giữ và tự tính giá. Nếu một ô bị trùng, toàn bộ yêu cầu thất bại.

Thanh toán chỉ gửi phương thức:

```json
{"method": "CASH"}
```

`method` nhận `CASH` hoặc `TRANSFER`. Không gửi `amount`: số tiền được tính ở máy chủ từ các chi tiết đã chốt giá. Hủy và hoàn tất không cần dữ liệu nghiệp vụ trong phần thân yêu cầu.

Danh sách đơn trả tối đa 500 kết quả, sắp theo thời điểm tạo mới nhất. `q` tìm trong mã đơn, tên khách và điện thoại. Mỗi đơn tóm tắt có:

`id`, `booking_code`, `customer_id`, `customer_name`, `customer_phone`, `status`, `note`, `created_at`, `cancelled_at`, `play_date`, `court_name`, `total_amount`, `slot_count`, `start_time`, `end_time`, `payment_status`.

`payment_status` nhận `UNPAID` hoặc `PAID`. Chi tiết đơn thêm `items` và `payment`:

- `items`: mảng `id`, `court_id`, `court_name`, `play_date`, `time_slot_id`, `start_time`, `end_time`, `unit_price`, `released_at`.
- `payment`: `null` khi chưa trả tiền; nếu đã trả tiền gồm `amount`, `method`, `paid_at`.

Các thao tác tạo, hủy, thanh toán và hoàn tất trả chi tiết đơn hiện tại để giao diện cập nhật.

## Báo cáo

| Phương thức | Đường dẫn | Nội dung |
|---|---|---|
| GET | `/api/reports?from=2026-10-01&to=2026-10-31` | Báo cáo trong khoảng ngày. |
| GET | `/api/reports/export?from=2026-10-01&to=2026-10-31` | Tải dữ liệu CSV cho cùng khoảng ngày. |

`from` không được sau `to`; khoảng ngày tối đa 93 ngày, gồm cả hai mốc. `/api/reports` cho phép bỏ tham số, mặc định 30 ngày gần nhất kết thúc hôm nay. `/api/reports/export` yêu cầu cả `from` và `to`.

`reports.data` gồm:

| Trường | Nội dung |
|---|---|
| `from`, `to` | Khoảng báo cáo. |
| `booking_count`, `cancelled_count`, `unpaid_total` | Lượt đặt chưa hủy, số đơn hủy và tiền còn chưa thu, theo ngày chơi. |
| `paid_revenue` | Tổng tiền đã thu theo ngày thanh toán. |
| `by_day` | Mỗi ngày có `date`, `booking_count`, `paid_revenue`; có cả ngày không phát sinh. |
| `by_court` | Mỗi sân có `id`, `name`, `booking_count`, `booked_hours`, `paid_revenue`. |
| `by_payment_method` | Mỗi phương thức có `method`, `amount`, `count`. |

Mốc ngày được hiểu theo giờ Việt Nam. `booking_count` và `booked_hours` loại trừ đơn hủy, tính theo `play_date`; `paid_revenue` và `by_payment_method` tính theo `paid_at`. Thu tiền hôm nay cho lịch ngày mai sẽ tăng doanh thu hôm nay và lượt đặt ngày mai.

API xuất CSV trả tệp UTF-8 có BOM, với các cột ngày, lượt đặt không bị hủy và tiền đã thu; không bọc nội dung tệp trong `{data}`.

## Các lỗi cần xử lý ở giao diện

| HTTP | Ý nghĩa |
|---|---|
| 200 | Yêu cầu thành công; đọc `data` hoặc tệp CSV. |
| 201 | Tạo thành công sân, khách hàng hoặc đơn đặt; đọc bản ghi trong `data`. |
| 400 | JSON, ngày, trường đầu vào hoặc ràng buộc dữ liệu không hợp lệ. |
| 401 | Chưa đăng nhập, phiên hết hạn hoặc thông tin đăng nhập sai. |
| 403 | Mã CSRF thiếu hoặc không khớp phiên. |
| 404 | Không tìm thấy bản ghi cần thao tác. |
| 409 | Xung đột giữ chỗ, dữ liệu duy nhất, điều kiện nghiệp vụ hoặc thao tác đồng thời. |
| 429 | Đăng nhập sai quá nhiều lần; chờ một phút rồi thử lại. |
| 503 | Không kết nối được cơ sở dữ liệu. |

- Chưa đăng nhập hoặc phiên hết hạn: đưa người dùng về màn hình đăng nhập.
- CSRF không hợp lệ: đọc lại phiên; không tự lặp các thao tác ghi dữ liệu đã có khả năng thực hiện thành công.
- Dữ liệu nhập sai, số điện thoại/mã sân trùng hoặc ngày ngoài giới hạn: hiển thị `message` và cho người dùng sửa.
- Ô giờ vừa được người khác đặt: hiển thị `message`, tải lại lịch và yêu cầu chọn giờ còn trống.
- Đơn không đủ điều kiện hủy, thanh toán hoặc hoàn tất: tải lại chi tiết để giao diện phản ánh trạng thái hiện tại.

Đối chiếu các đường dẫn trong [ApiController.java](../src/main/java/vn/edu/pickleball/ApiController.java), xác thực trong [AuthController.java](../src/main/java/vn/edu/pickleball/AuthController.java) và cấu trúc dữ liệu trong [BookingService.java](../src/main/java/vn/edu/pickleball/BookingService.java).

## API phía khách hàng

API quản lý ở các mục trên yêu cầu quyền `ADMIN`. Khách có quyền `CUSTOMER` chỉ dùng nhóm bên dưới; gửi trực tiếp URL quản lý vẫn bị chặn403.

| Phương thức | Đường dẫn | Quyền / nội dung |
|---|---|---|
| POST | `/api/auth/register` | Công khai nhưng cần CSRF; tạo hồ sơ và tài khoản CUSTOMER trong một transaction, tự đăng nhập; trả201. |
| GET | `/api/customer/config` | Công khai: ngày máy chủ, ngày tối đa, khung giờ. |
| GET | `/api/customer/courts` | Công khai: sân hiển thị cho khách; bỏ sân ngừng hoạt động. |
| GET | `/api/customer/availability?date=YYYY-MM-DD` | Công khai: trống/bận, không trả `booking_id` hoặc thông tin khách. |
| GET / PUT | `/api/customer/me` | Xem/sửa hồ sơ của chính khách. |
| PUT | `/api/customer/password` | Đổi mật khẩu, kiểm tra mật khẩu hiện tại; xoay session/CSRF và thu hồi các phiên khác. |
| GET | `/api/customer/bookings?status=CONFIRMED` | Đơn của chính khách; status tùy chọn, tối đa500 đơn mới nhất. |
| POST | `/api/customer/bookings` | Đặt sân cho chính khách; trả201. |
| GET | `/api/customer/bookings/{id}` | Chi tiết đơn đúng chủ, gồm `items`, `payment`, `can_cancel`; đơn người khác trả404. |
| POST | `/api/customer/bookings/{id}/cancel` | Hủy đơn của mình: CONFIRMED, chưa thanh toán, trước giờ bắt đầu đầu tiên. |

Khi nhập SQL thủ công, chạy lần lượt `01_schema.sql`, `02_routines.sql`, `03_seed.sql`, `05_customer_portal.sql`, `06_customer_account_rules.sql` (5 file). File `06` chạy sau `05` để cập nhật ràng buộc tên đăng nhập; `04_queries.sql` chỉ là truy vấn minh họa, không phải bước cài đặt.

Đăng ký gửi `{username,password,full_name,phone,email}`. Tên đăng nhập không được để trống, tối đa 50 ký tự và phải duy nhất; cho phép Unicode/tiếng Việt và khoảng trắng bên trong, bỏ khoảng trắng ở hai đầu khi đăng ký hoặc đăng nhập. Mật khẩu khi đăng ký phải có ít nhất 8 ký tự, không vượt 72 byte UTF-8 và có ít nhất một chữ hoa Unicode (`\p{Lu}`), một chữ số Unicode (`\p{Nd}`), một dấu câu hoặc ký hiệu Unicode (`[\p{P}\p{S}]`). Khoảng trắng không tính là ký tự đặc biệt; không bắt buộc chữ thường. Số điện thoại dùng cùng quy tắc hồ sơ khách, email tùy chọn. Không nhận `role` hoặc ID hồ sơ để tự nhận quyền hay chiếm hồ sơ cũ. Số đã có trong hệ thống cần quản lý hỗ trợ, không tự gắn tài khoản.

Phiên `/api/auth/session` và kết quả login/register có `user` gồm `id`, `username`, `display_name`, `role`, `customer_id`. ADMIN có `customer_id=null`. Sau login, register hoặc đổi mật khẩu, gọi lại session lấy CSRF mới trước thao tác ghi tiếp theo. Mật khẩu/hash không được trả về trình duyệt.

PUT hồ sơ gửi `{full_name,phone,email}`. PUT mật khẩu gửi `{current_password,new_password}`. `new_password` dùng cùng quy tắc độ dài và độ phức tạp như khi đăng ký. Không áp dụng quy tắc độ phức tạp mới cho mật khẩu dùng để đăng nhập hoặc `current_password`, để tài khoản hiện có tiếp tục hoạt động. Tạo đơn khách gửi `{court_id,play_date,slot_ids,note}`; Java lấy chủ đơn từ phiên, tự tính giá, không nhận số tiền hay mã khách do trình duyệt quyết định.

Lịch sử/chi tiết thêm `can_cancel` phục vụ hiển thị nút. Khi nhấn hủy, procedure vẫn kiểm tra lại điều kiện và khóa đơn cùng transaction để tránh vừa thanh toán vừa hủy. `BOOKING_ALREADY_STARTED` trả409. Quy tắc thời gian này áp dụng khách; quản lý vẫn xử lý đơn theo quyền nghiệp vụ cũ.
