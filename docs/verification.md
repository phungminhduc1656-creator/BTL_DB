# Kết quả kiểm tra bản hiện tại

Kiểm tra ngày15/10/2026 trên Windows, Java25.0.4 và MySQL8.0.46. Mã Java biên dịch với mục tiêu Java17. Ứng dụng gồm hai phía `/khach-hang/` và `/quan-ly/`, dùng chung MySQL.

## Các kiểm tra đã thực thi

| Nhóm | Kết quả |
|---|---|
| SQL nghiệp vụ trên MySQL thật | 33/33 đạt, gồm giao dịch và tranh chấp đặt/hủy/thu tiền. |
| Migration và DB phía khách | 23/23 cổng khách và17/17 quy tắc tên đăng nhập đạt; nâng cấp cấu trúc cũ, chạy lặp, giữ dữ liệu, Unicode và ràng buộc tài khoản. Xem customer-database-verification.md. |
| Java/HTTP trên MySQL thật | 20/20 đạt: 8 test nghiệp vụ cũ +12 test phía khách; không lỗi, thất bại hoặc bỏ qua khi bật cờ tích hợp. |
| Trình duyệt phía khách | Desktop1440px và mobile390px đều đạt toàn bộ hành trình; không lỗi JavaScript. |
| Trình duyệt phía quản lý | Chạy lại smoke test cũ đạt: đăng nhập, 6 màn hình, đặt/hủy/thu tiền, khách, sân, CSV và mobile. Không lỗi JavaScript. |
| Giao diện | Đã xem ảnh Chrome desktop/mobile và hộp đăng ký; trang không tràn ngang. Danh sách sân cuộn trong vùng riêng trên điện thoại. |
| Khởi động Windows | Hai BAT mở khách/quản lý đã chạy bằng Windows PowerShell5, chọn đúng đường dẫn và tái sử dụng tiến trình. |
| Nâng cấp DB chính | Trước/sau đều8 khách,4 sân,21 đơn,13 thanh toán, tổng thu4.400.000đ; admin cũ nhận ADMIN và giữ mật khẩu. |

## Luồng phía khách đã chạy trên trình duyệt

Xem lịch công khai → chọn giờ → đăng ký/đăng nhập → đặt hai giờ liền nhau → xem chi tiết → hủy và đặt lại → lọc lịch sử → sửa hồ sơ → đổi mật khẩu → mật khẩu cũ thất bại/mới thành công → quản lý thấy và thu tiền đúng đơn → khách thấy PAID và không có nút tự hủy.

Các test HTTP còn kiểm tra khách không đọc/hủy được đơn người khác, không gọi API quản lý, không tự gán role/customer_id, không thấy mã đơn hoặc dữ liệu cá nhân trên lịch công khai, đăng ký trùng rollback, CSRF cũ bị chặn sau đổi mật khẩu, các phiên khác bị thu hồi và mật khẩu Unicode đúng giới hạn BCrypt. Đường dẫn API có biến thể dot/encoded/matrix không vượt ranh giới phân quyền.

## Môi trường và bằng chứng

- Java: `src/test/java/vn/edu/pickleball/BookingIntegrationTest.java`, `CustomerIntegrationTest.java`; kết quả XML tại `target/surefire-reports/`.
- SQL nghiệp vụ: `database/tests/verify-mysql.ps1`, tự tạo và dọn DB tạm.
- Migration: [23 kiểm tra và hợp đồng SQL](customer-database-verification.md).
- Trình duyệt: `scripts/customer-browser-smoke.cjs`, `scripts/browser-smoke.cjs`.
- Ảnh khách nằm ở `.local/screenshots/customer/` và `.local/screenshots/customer-visual-*.png`; ảnh quản lý ở `.local/screenshots/`.
- Browser QA chạy trên cổng8081 với DB riêng `pickleball_customer_qa_20261015100903`. Java test dùng `pickleball_integration_test`. Không tạo tài khoản/đơn QA trong DB chính `pickleball_db`.
- Trước khi nâng cấp đã sao lưu DB chính bằng mysqldump vào `.local/backups/`. Sao lưu và credential MySQL không nằm trong ZIP phát hành.

Docker Compose là cấu hình thay thế, chưa chạy kiểm thử vì Docker daemon trên máy không hoạt động. Bản này chạy cục bộ, chưa triển khai hosting, không kết nối cổng thanh toán.

Lệnh và vị trí mã nguồn: [README](../README.md), [hướng dẫn hai phía](khach-hang.md), [demo cho nhóm](demo-guide.md).

## Cập nhật quy tắc đăng ký ngày15/10/2026

Tên đăng nhập cho phép tiếng Việt, khoảng trắng bên trong, 1–50 ký tự sau khi bỏ khoảng trắng hai đầu; giữ UNIQUE. Migration06 thay CHECK cũ mà không sửa dữ liệu. Tên50 ký tự có khoảng trắng hai đầu đăng ký/đăng nhập thành công. Tên trống, quá dài và trùng bị từ chối.

Mật khẩu đăng ký/đổi bắt buộc có chữ hoa Unicode, chữ số Unicode và dấu câu/ký hiệu Unicode, tối thiểu8 ký tự và tối đa72 byte UTF-8. HTTP tests kiểm tra từng nhóm bị thiếu, khoảng trắng không được tính là ký tự đặc biệt, chữ hoa tiếng Việt, chữ số Arabic, emoji ký hiệu, không bắt buộc chữ thường, ranh giới72/73byte, và tài khoản mật khẩu cũ vẫn đăng nhập/đổi được.


Kiểm thử trình duyệt sau cập nhật quy tắc đăng ký: desktop1440px/mobile390px đều đăng ký và đăng nhập được với tên tiếng Việt có khoảng trắng; giao diện chặn bốn dạng mật khẩu không đủ điều kiện tại cả đăng ký và đổi mật khẩu. Toàn bộ luồng đặt/hủy/đặt lại, hồ sơ và quản lý ghi nhận thu tiền vẫn đạt; không lỗi JavaScript. Chạy trên QA8081 và DB riêng, không tạo tài khoản thử trong DB chính.

Đã kiểm tra đổi mật khẩu MySQL ứng dụng trên máy: mật khẩu lưu bằng User environment `DB_PASSWORD`, không ghi giá trị mới vào mã nguồn/ZIP. Script `start.ps1` và `test.ps1` đọc biến User khi process cũ chưa có biến tương ứng, đồng thời giữ quyền ưu tiên cho giá trị process được chỉ định rõ. Windows PowerShell5 từ parent không có `DB_PASSWORD` vẫn chạy đủ20/20 integration test đạt. Kết nối MySQL bằng mật khẩu mới, đăng nhập quản lý, đọc dashboard và trang khách đều thành công; số lượng khách/đơn/thanh toán và tổng thu không đổi qua thao tác đổi mật khẩu.

## Kiểm tra trước khi đưa lên GitHub ngày 18/10/2026

- Chạy lại `scripts/test.ps1 -IncludeSqlChecks`: **33/33 kiểm tra SQL** và **20/20 kiểm thử Java/HTTP trên MySQL thật** đạt, không lỗi và không bỏ qua test tích hợp. Dữ liệu kiểm thử nằm trong DB tạm/DB tích hợp riêng.
- Chuẩn bị README cho người tải mã nguồn lần đầu: yêu cầu JDK/MySQL, clone hoặc Download ZIP, chạy bằng BAT, ảnh minh họa và giới hạn thanh toán hiện tại.
- Bỏ đường dẫn runtime máy cá nhân trong hai smoke script. Cả hai đạt `node --check`; phần thay đổi cấu hình công cụ chưa chạy lại toàn bộ hành trình trình duyệt trong lần chuẩn bị GitHub này. Kết quả hành trình trình duyệt ở các mục trước thuộc lần kiểm tra ngày 15/10/2026.
- Repository chỉ gồm mã nguồn, SQL/dữ liệu mẫu, tài liệu và ảnh demo đã chọn. Không đưa `.local/`, `.tools/`, `target/`, file `.env` hoặc `.env.*` riêng lên Git; giữ `.env.example` để hướng dẫn cấu hình. Mật khẩu MySQL đã đổi trên máy không được ghi vào mã nguồn.

## Khắc phục máy mới thiếu MySQL Server ngày 21/10/2026

- Phân biệt MySQL Workbench và MySQL Server trong README; thêm liên kết bộ cài Community Server và hướng dẫn cài máy mới.
- Các script chạy/dừng/kiểm thử dùng chung bộ tìm công cụ MySQL. Hỗ trợ tham số, MYSQL_BASE, đường dẫn đã lưu, bộ cài chuẩn, PATH và dịch vụ; kiểm tra đủ server/client/admin cùng bộ cài.
- Thêm CAU_HINH_MYSQL.bat để nhập thư mục Server và lưu cấu hình riêng trong .local/mysql-base.txt. Đường dẫn có khoảng trắng được giữ đúng; bộ cài đã dùng được ghi nhớ, dữ liệu cũ không tự đổi sang phiên bản khác khi mất đường dẫn.
- Chạy lại 33/33 kiểm tra SQL và 20/20 kiểm thử Java/MySQL đạt trên MySQL 8.0.46. Dữ liệu khách/đơn/thanh toán của DB chính giữ nguyên.
- Windows PowerShell 5.1 cấu hình thư mục và tái sử dụng MySQL đang chạy thành công. Hai trang khách/quản lý HTTP 200, API cấu hình khách trả 17 khung giờ.
- Bộ kiểm tra đường dẫn đạt **28/28 ca, 84 assertions** trên Windows PowerShell 5.1: thư mục Unicode/khoảng trắng, ưu tiên cấu hình, thiếu Server/client/admin, PID rỗng, pin dữ liệu cũ và tự tìm bộ cài. Các ca này không chạy MySQL thật.
- Kiểm tra tìm thư mục MySQL 8.4 dùng bộ cài giả trong thư mục kiểm thử riêng; chưa chạy server MySQL 8.4 thật trong lần này. Bản sửa không cài thay MySQL Server trên máy khác.
