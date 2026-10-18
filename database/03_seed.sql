-- Dữ liệu tham chiếu để demo, không chứa thông tin của người thật.
-- Chạy sau schema và routines. Không ghi đè dữ liệu đã có khi chạy lại.
-- Đơn đặt sân được Java tạo theo ngày chạy demo để lịch luôn có dữ liệu phù hợp.
-- Tài khoản ứng dụng được Java tạo với password_hash; không lưu mật khẩu trong SQL.

SET NAMES utf8mb4;
SET time_zone = '+07:00';

INSERT INTO customers (id, full_name, phone, email) VALUES
    (1, 'Nguyễn Minh Anh', '0901000001', 'minhanh@example.com'),
    (2, 'Trần Quốc Bảo', '0901000002', 'quocbao@example.com'),
    (3, 'Lê Hoàng Nam', '0901000003', 'hoangnam@example.com'),
    (4, 'Phạm Thùy Linh', '0901000004', 'thuylinh@example.com'),
    (5, 'Võ Gia Huy', '0901000005', NULL),
    (6, 'Đặng Khánh Vy', '0901000006', 'khanhvy@example.com'),
    (7, 'Bùi Đức Minh', '0901000007', NULL),
    (8, 'Đỗ Ngọc Hà', '0901000008', 'ngocha@example.com')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO courts (id, code, name, description, hourly_price, status) VALUES
    (1, 'SAN-01', 'Sân 01 — Ngoài trời', 'Sân tiêu chuẩn, có đèn chiếu sáng buổi tối.', 150000, 'ACTIVE'),
    (2, 'SAN-02', 'Sân 02 — Ngoài trời', 'Sân tiêu chuẩn, gần khu vực nghỉ và gửi xe.', 150000, 'ACTIVE'),
    (3, 'SAN-03', 'Sân 03 — Có mái che', 'Sân có mái che, phù hợp cả khi thời tiết thay đổi.', 200000, 'ACTIVE'),
    (4, 'SAN-04', 'Sân 04 — Đang bảo trì', 'Đang sửa mặt sân; không nhận đơn đặt mới.', 180000, 'MAINTENANCE')
ON DUPLICATE KEY UPDATE id = id;

-- Mỗi slot đúng 60 phút, gồm 17 slot từ 06:00 đến 23:00.
INSERT INTO time_slots (id, start_time, end_time) VALUES
    (1, '06:00:00', '07:00:00'),
    (2, '07:00:00', '08:00:00'),
    (3, '08:00:00', '09:00:00'),
    (4, '09:00:00', '10:00:00'),
    (5, '10:00:00', '11:00:00'),
    (6, '11:00:00', '12:00:00'),
    (7, '12:00:00', '13:00:00'),
    (8, '13:00:00', '14:00:00'),
    (9, '14:00:00', '15:00:00'),
    (10, '15:00:00', '16:00:00'),
    (11, '16:00:00', '17:00:00'),
    (12, '17:00:00', '18:00:00'),
    (13, '18:00:00', '19:00:00'),
    (14, '19:00:00', '20:00:00'),
    (15, '20:00:00', '21:00:00'),
    (16, '21:00:00', '22:00:00'),
    (17, '22:00:00', '23:00:00')
ON DUPLICATE KEY UPDATE id = id;
