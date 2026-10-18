-- Chạy sau 01_schema.sql trong database pickleball_db đã chọn.
-- DELIMITER là lệnh của mysql client/Workbench, không phải câu SQL gửi qua JDBC.
-- Bootstrap Java của dự án tách script theo DELIMITER trước khi thực thi.
-- Các procedure tự quản lý transaction: gọi bằng kết nối auto-commit,
-- không bọc CALL trong một transaction khác của ứng dụng.
-- Lỗi nghiệp vụ dùng SQLSTATE 45000; tiền tố thông báo là mã để Java dịch ra tiếng Việt.

SET NAMES utf8mb4;
SET time_zone = '+07:00';

DROP TRIGGER IF EXISTS trg_bookings_before_insert;
DROP TRIGGER IF EXISTS trg_bookings_before_update;
DROP TRIGGER IF EXISTS trg_bookings_after_cancel;
DROP TRIGGER IF EXISTS trg_booking_items_before_insert;
DROP TRIGGER IF EXISTS trg_booking_items_before_update;
DROP TRIGGER IF EXISTS trg_booking_items_before_delete;
DROP TRIGGER IF EXISTS trg_payments_before_insert;
DROP TRIGGER IF EXISTS trg_payments_before_update;
DROP TRIGGER IF EXISTS trg_payments_before_delete;
DROP PROCEDURE IF EXISTS sp_create_booking;
DROP PROCEDURE IF EXISTS sp_cancel_booking;
DROP PROCEDURE IF EXISTS sp_pay_booking;
DROP PROCEDURE IF EXISTS sp_complete_booking;

DELIMITER $$

CREATE TRIGGER trg_bookings_before_insert
BEFORE INSERT ON bookings
FOR EACH ROW
BEGIN
    IF NEW.status <> 'CONFIRMED' OR NEW.cancelled_at IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TRANSITION: New bookings must be confirmed';
    END IF;
END$$

CREATE TRIGGER trg_bookings_before_update
BEFORE UPDATE ON bookings
FOR EACH ROW
BEGIN
    DECLARE v_payment_id BIGINT DEFAULT NULL;
    DECLARE v_payment_amount DECIMAL(12, 0) DEFAULT NULL;
    DECLARE v_total DECIMAL(20, 0) DEFAULT 0;
    DECLARE v_last_end DATETIME DEFAULT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_payment_id = NULL;

    IF NEW.id <> OLD.id OR NEW.booking_code <> OLD.booking_code
        OR NEW.customer_id <> OLD.customer_id OR NEW.created_at <> OLD.created_at THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_IMMUTABLE: Booking identity cannot be changed';
    END IF;
    IF OLD.status <> 'CONFIRMED' AND NEW.status <> OLD.status THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TRANSITION: Final booking state cannot change';
    END IF;
    IF OLD.status = 'CONFIRMED' AND NEW.status = 'CANCELLED' THEN
        -- Current locking read: không dùng snapshot cũ khi có thao tác thanh toán đồng thời.
        SELECT id INTO v_payment_id FROM payments WHERE booking_id = OLD.id FOR UPDATE;
        IF v_payment_id IS NOT NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAID_BOOKING_CANNOT_CANCEL: Paid bookings cannot be cancelled';
        END IF;
        SET NEW.cancelled_at = COALESCE(NEW.cancelled_at, SYSDATE());
    ELSEIF OLD.status = 'CONFIRMED' AND NEW.status = 'COMPLETED' THEN
        SELECT id, amount INTO v_payment_id, v_payment_amount
        FROM payments WHERE booking_id = OLD.id FOR UPDATE;
        SELECT COALESCE(SUM(bi.unit_price), 0), MAX(TIMESTAMP(bi.play_date, ts.end_time))
        INTO v_total, v_last_end
        FROM booking_items bi JOIN time_slots ts ON ts.id = bi.time_slot_id
        WHERE bi.booking_id = OLD.id AND bi.released_at IS NULL;
        IF v_payment_id IS NULL OR v_payment_amount <> v_total OR v_total <= 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAYMENT_REQUIRED: Full payment is required before completion';
        END IF;
        IF v_last_end IS NULL OR v_last_end > SYSDATE() THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_NOT_FINISHED: The final time slot has not ended';
        END IF;
    END IF;
    IF NEW.status <> 'CANCELLED' THEN
        SET NEW.cancelled_at = NULL;
    ELSEIF OLD.status = 'CANCELLED' AND NOT (NEW.cancelled_at <=> OLD.cancelled_at) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_IMMUTABLE: Cancellation time cannot be changed';
    END IF;
END$$

CREATE TRIGGER trg_bookings_after_cancel
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
    IF OLD.status <> 'CANCELLED' AND NEW.status = 'CANCELLED' THEN
        UPDATE booking_items
        SET released_at = NEW.cancelled_at
        WHERE booking_id = NEW.id AND released_at IS NULL;
    END IF;
END$$

CREATE TRIGGER trg_booking_items_before_insert
BEFORE INSERT ON booking_items
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(16) DEFAULT NULL;
    DECLARE v_payment_id BIGINT DEFAULT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

    -- Chung thứ tự khóa booking với thanh toán/hủy để ngăn thay đổi chi tiết giữa chừng.
    SELECT status INTO v_status FROM bookings WHERE id = NEW.booking_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_NOT_FOUND: Booking does not exist';
    END IF;
    IF v_status <> 'CONFIRMED' OR NEW.released_at IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TRANSITION: Items require an unpaid confirmed booking';
    END IF;
    SELECT id INTO v_payment_id FROM payments WHERE booking_id = NEW.booking_id FOR UPDATE;
    IF v_payment_id IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAYMENT_IMMUTABLE: Cannot add items after payment';
    END IF;
END$$

CREATE TRIGGER trg_booking_items_before_update
BEFORE UPDATE ON booking_items
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(16) DEFAULT NULL;
    IF NEW.id <> OLD.id OR NEW.booking_id <> OLD.booking_id OR NEW.court_id <> OLD.court_id
        OR NEW.play_date <> OLD.play_date OR NEW.time_slot_id <> OLD.time_slot_id
        OR NEW.unit_price <> OLD.unit_price THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_IMMUTABLE: Booked slots and historical prices cannot change';
    END IF;
    IF NOT (NEW.released_at <=> OLD.released_at) THEN
        SELECT status INTO v_status FROM bookings WHERE id = OLD.booking_id;
        IF OLD.released_at IS NOT NULL OR NEW.released_at IS NULL OR v_status <> 'CANCELLED' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TRANSITION: Only cancellation can release a slot';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_booking_items_before_delete
BEFORE DELETE ON booking_items
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_IMMUTABLE: Cancel the booking instead of deleting its history';
END$$

CREATE TRIGGER trg_payments_before_insert
BEFORE INSERT ON payments
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(16) DEFAULT NULL;
    DECLARE v_total DECIMAL(20, 0) DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_status = NULL;

    SELECT status INTO v_status FROM bookings WHERE id = NEW.booking_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_NOT_FOUND: Booking does not exist';
    END IF;
    IF v_status <> 'CONFIRMED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TRANSITION: Only confirmed bookings can be paid';
    END IF;
    SELECT COALESCE(SUM(unit_price), 0) INTO v_total
    FROM booking_items WHERE booking_id = NEW.booking_id AND released_at IS NULL;
    IF v_total <= 0 OR NEW.amount <> v_total THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_PAYMENT_AMOUNT: Payment must equal the complete booking total';
    END IF;
END$$

CREATE TRIGGER trg_payments_before_update
BEFORE UPDATE ON payments
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAYMENT_IMMUTABLE: Recorded payments cannot be edited';
END$$

CREATE TRIGGER trg_payments_before_delete
BEFORE DELETE ON payments
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAYMENT_IMMUTABLE: Recorded payments cannot be deleted';
END$$

CREATE PROCEDURE sp_create_booking(
    IN p_customer_id BIGINT,
    IN p_court_id BIGINT,
    IN p_play_date DATE,
    IN p_slot_ids JSON,
    IN p_note VARCHAR(500)
)
BEGIN
    DECLARE v_booking_id BIGINT;
    DECLARE v_customer_id BIGINT DEFAULT NULL;
    DECLARE v_price DECIMAL(12, 0) DEFAULT NULL;
    DECLARE v_court_status VARCHAR(16) DEFAULT NULL;
    DECLARE v_requested INT DEFAULT 0;
    DECLARE v_valid INT DEFAULT 0;
    DECLARE v_distinct INT DEFAULT 0;
    DECLARE v_index INT DEFAULT 0;
    DECLARE v_json_value JSON;
    DECLARE v_start TIME DEFAULT NULL;
    DECLARE v_end TIME DEFAULT NULL;
    DECLARE v_now DATETIME;
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
    DECLARE EXIT HANDLER FOR 1062
    BEGIN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_CONFLICT: One or more selected slots are already reserved';
    END;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET time_zone = '+07:00';
    START TRANSACTION;
    IF p_slot_ids IS NULL OR JSON_TYPE(p_slot_ids) <> 'ARRAY' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_SLOTS: Slot ids must be a JSON array';
    END IF;
    SET v_requested = JSON_LENGTH(p_slot_ids);
    IF v_requested < 1 OR v_requested > 17 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_SLOTS: Select between 1 and 17 consecutive slots';
    END IF;
    WHILE v_index < v_requested DO
        SET v_json_value = JSON_EXTRACT(p_slot_ids, CONCAT('$[', v_index, ']'));
        IF JSON_TYPE(v_json_value) <> 'INTEGER' OR CAST(JSON_UNQUOTE(v_json_value) AS SIGNED) <= 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_SLOTS: Every slot id must be a positive integer';
        END IF;
        SET v_index = v_index + 1;
    END WHILE;

    -- Khóa sân đến COMMIT: thay giá/trạng thái sân sẽ đợi thao tác đặt hiện tại kết thúc.
    SELECT hourly_price, status INTO v_price, v_court_status
    FROM courts WHERE id = p_court_id FOR UPDATE;
    IF v_court_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'COURT_NOT_FOUND: Court does not exist';
    END IF;
    IF v_court_status <> 'ACTIVE' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'COURT_UNAVAILABLE: Court is inactive or under maintenance';
    END IF;
    SELECT id INTO v_customer_id FROM customers WHERE id = p_customer_id FOR SHARE;
    IF v_customer_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CUSTOMER_NOT_FOUND: Customer does not exist';
    END IF;

    SELECT COUNT(*), COUNT(DISTINCT ts.id), MIN(ts.start_time), MAX(ts.end_time)
    INTO v_valid, v_distinct, v_start, v_end
    FROM JSON_TABLE(p_slot_ids, '$[*]' COLUMNS (slot_id BIGINT PATH '$' ERROR ON ERROR)) requested
    JOIN time_slots ts ON ts.id = requested.slot_id;
    IF v_valid <> v_requested OR v_distinct <> v_requested THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_SLOTS: Slot ids must exist and cannot be repeated';
    END IF;
    IF TIME_TO_SEC(v_end) - TIME_TO_SEC(v_start) <> v_requested * 3600 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NON_CONTIGUOUS_SLOTS: Selected slots must be consecutive';
    END IF;
    -- SYSDATE lấy thời điểm thật sau khi chờ khóa, tránh dùng NOW cố định từ đầu CALL.
    SET v_now = SYSDATE();
    IF p_play_date IS NULL OR p_play_date < DATE(v_now)
        OR p_play_date > DATE_ADD(DATE(v_now), INTERVAL 30 DAY) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_DATE: Booking date must be within the next 30 days';
    END IF;
    IF TIMESTAMP(p_play_date, v_start) <= v_now THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SLOT_IN_PAST: Every selected slot must start in the future';
    END IF;

    INSERT INTO bookings (booking_code, customer_id, note, created_at)
    VALUES (CONCAT('PB-', UPPER(REPLACE(UUID(), '-', ''))), p_customer_id, NULLIF(TRIM(p_note), ''), v_now);
    SET v_booking_id = LAST_INSERT_ID();
    INSERT INTO booking_items (booking_id, court_id, play_date, time_slot_id, unit_price)
    SELECT v_booking_id, p_court_id, p_play_date, ts.id, v_price
    FROM JSON_TABLE(p_slot_ids, '$[*]' COLUMNS (slot_id BIGINT PATH '$' ERROR ON ERROR)) requested
    JOIN time_slots ts ON ts.id = requested.slot_id
    ORDER BY ts.start_time;
    -- Nếu bất kỳ slot nào bị trùng, handler ROLLBACK cả header và toàn bộ chi tiết.
    COMMIT;
    SELECT v_booking_id AS id;
END$$

CREATE PROCEDURE sp_cancel_booking(IN p_id BIGINT)
BEGIN
    DECLARE v_status VARCHAR(16) DEFAULT NULL;
    DECLARE v_payment_id BIGINT DEFAULT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    SET time_zone = '+07:00';
    START TRANSACTION;
    SELECT status INTO v_status FROM bookings WHERE id = p_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_NOT_FOUND: Booking does not exist';
    END IF;
    IF v_status <> 'CONFIRMED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TRANSITION: Only confirmed bookings can be cancelled';
    END IF;
    SELECT id INTO v_payment_id FROM payments WHERE booking_id = p_id FOR UPDATE;
    IF v_payment_id IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAID_BOOKING_CANNOT_CANCEL: Paid bookings cannot be cancelled';
    END IF;
    UPDATE bookings SET status = 'CANCELLED', cancelled_at = SYSDATE() WHERE id = p_id;
    COMMIT;
END$$

CREATE PROCEDURE sp_pay_booking(IN p_id BIGINT, IN p_method VARCHAR(16))
BEGIN
    DECLARE v_status VARCHAR(16) DEFAULT NULL;
    DECLARE v_payment_id BIGINT DEFAULT NULL;
    DECLARE v_total DECIMAL(20, 0) DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
    DECLARE EXIT HANDLER FOR 1062
    BEGIN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ALREADY_PAID: Booking already has a payment';
    END;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    SET time_zone = '+07:00';
    START TRANSACTION;
    SELECT status INTO v_status FROM bookings WHERE id = p_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_NOT_FOUND: Booking does not exist';
    END IF;
    IF v_status <> 'CONFIRMED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TRANSITION: Only confirmed bookings can be paid';
    END IF;
    IF p_method IS NULL OR p_method NOT IN ('CASH', 'TRANSFER') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_PAYMENT_METHOD: Choose CASH or TRANSFER';
    END IF;
    SELECT id INTO v_payment_id FROM payments WHERE booking_id = p_id FOR UPDATE;
    IF v_payment_id IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ALREADY_PAID: Booking already has a payment';
    END IF;
    SELECT COALESCE(SUM(unit_price), 0) INTO v_total
    FROM booking_items WHERE booking_id = p_id AND released_at IS NULL;
    IF v_total <= 0 OR v_total > 999999999999 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_PAYMENT_AMOUNT: Booking total is empty or exceeds the money limit';
    END IF;
    INSERT INTO payments (booking_id, amount, method, paid_at)
    VALUES (p_id, v_total, p_method, SYSDATE());
    COMMIT;
END$$

CREATE PROCEDURE sp_complete_booking(IN p_id BIGINT)
BEGIN
    DECLARE v_status VARCHAR(16) DEFAULT NULL;
    DECLARE v_payment_id BIGINT DEFAULT NULL;
    DECLARE v_payment_amount DECIMAL(12, 0) DEFAULT NULL;
    DECLARE v_total DECIMAL(20, 0) DEFAULT 0;
    DECLARE v_last_end DATETIME DEFAULT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    SET time_zone = '+07:00';
    START TRANSACTION;
    SELECT status INTO v_status FROM bookings WHERE id = p_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_NOT_FOUND: Booking does not exist';
    END IF;
    IF v_status <> 'CONFIRMED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TRANSITION: Only confirmed bookings can be completed';
    END IF;
    SELECT id, amount INTO v_payment_id, v_payment_amount
    FROM payments WHERE booking_id = p_id FOR UPDATE;
    SELECT COALESCE(SUM(bi.unit_price), 0), MAX(TIMESTAMP(bi.play_date, ts.end_time))
    INTO v_total, v_last_end
    FROM booking_items bi JOIN time_slots ts ON ts.id = bi.time_slot_id
    WHERE bi.booking_id = p_id AND bi.released_at IS NULL;
    IF v_payment_id IS NULL OR v_total <= 0 OR v_payment_amount <> v_total THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAYMENT_REQUIRED: Full payment is required before completion';
    END IF;
    IF v_last_end IS NULL OR v_last_end > SYSDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_NOT_FINISHED: The final time slot has not ended';
    END IF;
    UPDATE bookings SET status = 'COMPLETED' WHERE id = p_id;
    COMMIT;
END$$

DELIMITER ;
