-- 12 truy vấn học phần: SELECT, JOIN, GROUP BY, HAVING, subquery, CTE.
-- Chạy trong database pickleball_db; kết nối dùng time_zone '+07:00'.
-- Các truy vấn chỉ đọc dữ liệu. Thay id = 1 hoặc CURRENT_DATE theo tình huống demo.

-- 1. Tìm khách hàng theo tên hoặc số điện thoại.
SELECT id, full_name, phone, email
FROM customers
WHERE full_name LIKE '%Minh%' OR phone LIKE '%0001%'
ORDER BY full_name;

-- 2. Danh sách sân đang hoạt động, sắp xếp theo giá thuê.
SELECT id, code, name, hourly_price, status
FROM courts
WHERE status = 'ACTIVE'
ORDER BY hourly_price, code;

-- 3. Lịch trống ngày mai: CROSS JOIN tạo đủ ô sân/khung giờ, LEFT JOIN tìm chỗ đã giữ.
SELECT c.id AS court_id, c.code, c.name, ts.id AS time_slot_id,
       ts.start_time, ts.end_time, c.hourly_price,
       CASE WHEN bi.id IS NULL THEN 'AVAILABLE' ELSE 'BOOKED' END AS slot_status
FROM courts c
CROSS JOIN time_slots ts
LEFT JOIN booking_items bi
    ON bi.court_id = c.id
    AND bi.play_date = CURRENT_DATE + INTERVAL 1 DAY
    AND bi.time_slot_id = ts.id AND bi.released_at IS NULL
WHERE c.status = 'ACTIVE'
ORDER BY c.code, ts.start_time;

-- 4. Chi tiết một đơn: có thể nhiều dòng nếu khách chọn nhiều giờ liên tiếp.
SELECT b.booking_code, cu.full_name, cu.phone, b.status,
       c.code AS court_code, bi.play_date, ts.start_time, ts.end_time,
       bi.unit_price, bi.released_at, p.method, p.paid_at
FROM bookings b
JOIN customers cu ON cu.id = b.customer_id
JOIN booking_items bi ON bi.booking_id = b.id
JOIN courts c ON c.id = bi.court_id
JOIN time_slots ts ON ts.id = bi.time_slot_id
LEFT JOIN payments p ON p.booking_id = b.id
WHERE b.id = 1
ORDER BY bi.play_date, ts.start_time;

-- 5. Tổng tiền từng đơn được suy ra từ chi tiết, không lưu trùng trong header.
SELECT b.id, b.booking_code, cu.full_name, b.status,
       totals.slot_count, totals.total_amount,
       CASE WHEN p.id IS NULL THEN 'UNPAID' ELSE 'PAID' END AS payment_status
FROM bookings b
JOIN customers cu ON cu.id = b.customer_id
JOIN (
    SELECT booking_id, COUNT(*) AS slot_count, SUM(unit_price) AS total_amount
    FROM booking_items GROUP BY booking_id
) totals ON totals.booking_id = b.id
LEFT JOIN payments p ON p.booking_id = b.id
ORDER BY b.created_at DESC, b.id DESC;

-- 6. Khách có ít nhất hai đơn chưa hủy (GROUP BY và HAVING).
SELECT cu.id, cu.full_name, cu.phone, COUNT(b.id) AS booking_count
FROM customers cu
JOIN bookings b ON b.customer_id = cu.id AND b.status <> 'CANCELLED'
GROUP BY cu.id, cu.full_name, cu.phone
HAVING COUNT(b.id) >= 2
ORDER BY booking_count DESC, cu.id;

-- 7. Doanh thu thực thu theo ngày thanh toán; không JOIN chi tiết để tránh nhân đôi tiền.
SELECT DATE(paid_at) AS payment_date, COUNT(*) AS paid_bookings,
       SUM(amount) AS revenue
FROM payments
WHERE paid_at >= CURRENT_DATE - INTERVAL 29 DAY
  AND paid_at < CURRENT_DATE + INTERVAL 1 DAY
GROUP BY DATE(paid_at)
ORDER BY payment_date;

-- 8. Số giờ đã đặt theo sân trong 30 ngày gần nhất (giữ cả sân chưa có lượt đặt).
SELECT c.id, c.code, c.name, COUNT(bi.id) AS booked_hours,
       COALESCE(SUM(bi.unit_price), 0) AS booked_value
FROM courts c
LEFT JOIN booking_items bi ON bi.court_id = c.id AND bi.released_at IS NULL
    AND bi.play_date BETWEEN CURRENT_DATE - INTERVAL 29 DAY AND CURRENT_DATE
GROUP BY c.id, c.code, c.name
ORDER BY booked_hours DESC, c.code;

-- 9. CTE tổng hợp chi tiêu khách hàng: mỗi payment chỉ được cộng một lần.
WITH customer_payments AS (
    SELECT b.customer_id, COUNT(p.id) AS paid_bookings, SUM(p.amount) AS total_spent
    FROM bookings b JOIN payments p ON p.booking_id = b.id
    GROUP BY b.customer_id
)
SELECT cu.full_name, cu.phone, cp.paid_bookings, cp.total_spent
FROM customer_payments cp JOIN customers cu ON cu.id = cp.customer_id
ORDER BY cp.total_spent DESC
LIMIT 5;

-- 10. Đơn CONFIRMED đã hết giờ, đã thanh toán và có thể đánh dấu COMPLETED.
SELECT b.id, b.booking_code, cu.full_name, MAX(TIMESTAMP(bi.play_date, ts.end_time)) AS final_end
FROM bookings b
JOIN customers cu ON cu.id = b.customer_id
JOIN payments p ON p.booking_id = b.id
JOIN booking_items bi ON bi.booking_id = b.id AND bi.released_at IS NULL
JOIN time_slots ts ON ts.id = bi.time_slot_id
WHERE b.status = 'CONFIRMED'
GROUP BY b.id, b.booking_code, cu.full_name
HAVING MAX(TIMESTAMP(bi.play_date, ts.end_time)) <= CURRENT_TIMESTAMP
ORDER BY final_end;

-- 11. NOT EXISTS tìm khách hàng chưa từng đặt sân.
SELECT cu.id, cu.full_name, cu.phone
FROM customers cu
WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = cu.id)
ORDER BY cu.id;

-- 12. Tỷ lệ lấp đầy theo sân hôm nay: mẫu số là số slot mở bán, không gồm lịch đã hủy.
WITH occupied AS (
    SELECT court_id, COUNT(*) AS reserved_slots
    FROM booking_items
    WHERE play_date = CURRENT_DATE AND released_at IS NULL
    GROUP BY court_id
), capacity AS (
    SELECT COUNT(*) AS total_slots FROM time_slots
)
SELECT c.code, c.name, COALESCE(o.reserved_slots, 0) AS reserved_slots,
       cap.total_slots,
       ROUND(100.0 * COALESCE(o.reserved_slots, 0) / NULLIF(cap.total_slots, 0), 2) AS occupancy_percent
FROM courts c CROSS JOIN capacity cap
LEFT JOIN occupied o ON o.court_id = c.id
WHERE c.status = 'ACTIVE'
ORDER BY occupancy_percent DESC, c.code;
