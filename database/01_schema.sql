-- HỆ THỐNG QUẢN LÝ ĐẶT SÂN PICKLEBALL
-- MySQL 8.0.16 trở lên (CHECK được thực thi từ phiên bản này).
-- Chọn database riêng, ví dụ pickleball_db, trước khi chạy các script 01 -> 03.
-- Script không DROP DATABASE/TABLE và không xóa dữ liệu đã có.
-- DATETIME được lưu theo giờ Việt Nam. JDBC cũng phải đặt time_zone = '+07:00'.

SET NAMES utf8mb4;
SET time_zone = '+07:00';

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(254) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_customers_phone UNIQUE (phone),
    CONSTRAINT ck_customers_name CHECK (CHAR_LENGTH(TRIM(full_name)) BETWEEN 2 AND 100),
    CONSTRAINT ck_customers_phone CHECK (CHAR_LENGTH(TRIM(phone)) BETWEEN 8 AND 20),
    CONSTRAINT ck_customers_email CHECK (email IS NULL OR CHAR_LENGTH(TRIM(email)) > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS courts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    hourly_price DECIMAL(12, 0) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    PRIMARY KEY (id),
    CONSTRAINT uq_courts_code UNIQUE (code),
    CONSTRAINT ck_courts_code CHECK (CHAR_LENGTH(TRIM(code)) BETWEEN 1 AND 20),
    CONSTRAINT ck_courts_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 2 AND 100),
    CONSTRAINT ck_courts_price CHECK (hourly_price > 0),
    CONSTRAINT ck_courts_status CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE')),
    INDEX ix_courts_status (status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS time_slots (
    id BIGINT NOT NULL AUTO_INCREMENT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_time_slots_hours UNIQUE (start_time, end_time),
    CONSTRAINT ck_time_slots_range CHECK (
        start_time >= '06:00:00' AND end_time <= '23:00:00'
        AND TIME_TO_SEC(end_time) - TIME_TO_SEC(start_time) = 3600
        AND MINUTE(start_time) = 0 AND SECOND(start_time) = 0
        AND MINUTE(end_time) = 0 AND SECOND(end_time) = 0
    )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    booking_code VARCHAR(50) NOT NULL,
    customer_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'CONFIRMED',
    note VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at DATETIME NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_bookings_code UNIQUE (booking_code),
    CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_bookings_status CHECK (status IN ('CONFIRMED', 'CANCELLED', 'COMPLETED')),
    CONSTRAINT ck_bookings_cancel_time CHECK (
        (status = 'CANCELLED' AND cancelled_at IS NOT NULL)
        OR (status <> 'CANCELLED' AND cancelled_at IS NULL)
    ),
    INDEX ix_bookings_customer_created (customer_id, created_at),
    INDEX ix_bookings_status_created (status, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS booking_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    booking_id BIGINT NOT NULL,
    court_id BIGINT NOT NULL,
    play_date DATE NOT NULL,
    time_slot_id BIGINT NOT NULL,
    -- Giá tại thời điểm đặt; thay giá sân không thay tổng tiền của đơn cũ.
    unit_price DECIMAL(12, 0) NOT NULL,
    -- Hủy đơn chỉ giải phóng chỗ, giữ nguyên lịch sử chi tiết.
    released_at DATETIME NULL,
    active_guard TINYINT GENERATED ALWAYS AS (IF(released_at IS NULL, 1, NULL)) STORED,
    PRIMARY KEY (id),
    CONSTRAINT fk_booking_items_booking FOREIGN KEY (booking_id) REFERENCES bookings (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_booking_items_court FOREIGN KEY (court_id) REFERENCES courts (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_booking_items_slot FOREIGN KEY (time_slot_id) REFERENCES time_slots (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_booking_items_price CHECK (unit_price > 0),
    -- UNIQUE là hàng rào cuối cùng chống đặt trùng, kể cả khi hai người đặt đồng thời.
    -- MySQL cho phép nhiều NULL trong UNIQUE: các dòng đã hủy không giữ chỗ nữa.
    CONSTRAINT uq_booking_items_active UNIQUE (court_id, play_date, time_slot_id, active_guard),
    CONSTRAINT uq_booking_items_in_order UNIQUE (booking_id, court_id, play_date, time_slot_id),
    INDEX ix_booking_items_date (play_date, released_at),
    INDEX ix_booking_items_booking (booking_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    booking_id BIGINT NOT NULL,
    amount DECIMAL(12, 0) NOT NULL,
    method VARCHAR(16) NOT NULL,
    paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uq_payments_booking UNIQUE (booking_id),
    CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_payments_amount CHECK (amount > 0),
    CONSTRAINT ck_payments_method CHECK (method IN ('CASH', 'TRANSFER')),
    INDEX ix_payments_paid_at (paid_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS app_users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'ADMIN',
    customer_id BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_app_users_username UNIQUE (username),
    CONSTRAINT uq_app_users_customer UNIQUE (customer_id),
    CONSTRAINT fk_app_users_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_app_users_role_customer CHECK (
        (role = 'ADMIN' AND customer_id IS NULL)
        OR (role = 'CUSTOMER' AND customer_id IS NOT NULL)
    ),
    CONSTRAINT ck_app_users_username_nonblank CHECK (CHAR_LENGTH(TRIM(username)) BETWEEN 1 AND 50),
    CONSTRAINT ck_app_users_display_name CHECK (CHAR_LENGTH(TRIM(display_name)) BETWEEN 2 AND 100),
    CONSTRAINT ck_app_users_hash CHECK (CHAR_LENGTH(password_hash) >= 50)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
