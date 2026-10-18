-- XEM TOAN BO CSDL BAI TAP PICKLEBALL
-- File chi doc du lieu; khong tao lai bang, khong xoa/sua don.
-- Workbench: Ctrl+Shift+Enter chay toan bo file; Ctrl+Enter chay cau tai con tro.
SET NAMES utf8mb4;
USE pickleball_db;

-- Danh sach 7 bang.
SHOW TABLES;

-- 1. Ho so khach hang.
SELECT * FROM customers ORDER BY id;

-- 2. Danh muc san.
SELECT * FROM courts ORDER BY id;

-- 3. Khung gio co dinh.
SELECT * FROM time_slots ORDER BY start_time;

-- 4. Don dat san.
SELECT * FROM bookings ORDER BY id DESC;

-- 5. Tung gio choi va gia luu tai thoi diem dat.
SELECT * FROM booking_items ORDER BY booking_id DESC, play_date, time_slot_id;

-- 6. Tien da thu.
SELECT * FROM payments ORDER BY id DESC;

-- 7. Tai khoan dang nhap; khong hien password_hash trong bang xem nhanh.
SELECT id, username, display_name, role, customer_id FROM app_users ORDER BY id;

-- Cac stored procedure.
SELECT ROUTINE_NAME, ROUTINE_TYPE
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = DATABASE()
ORDER BY ROUTINE_NAME;

-- Cac trigger.
SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME;

-- Cau truc va rang buoc cua bang chong dat trung.
SHOW CREATE TABLE booking_items;
