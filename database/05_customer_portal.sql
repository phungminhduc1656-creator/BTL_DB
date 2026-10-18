-- MỞ RỘNG CỔNG KHÁCH HÀNG — chạy sau các script 01, 02, 03.
-- Dùng được cả trên DB cũ: chỉ bổ sung cột/ràng buộc còn thiếu, không xóa dữ liệu.
-- Chạy lại an toàn; tài khoản cũ nhận role ADMIN mặc định, mật khẩu và ID giữ nguyên.
-- Tài khoản cài đặt cần ALTER, CREATE ROUTINE, ALTER ROUTINE, EXECUTE, REFERENCES
-- trên database hiện tại. scripts/start-mysql.ps1 đã cấp quyền trong DB dự án.
-- Procedure nâng cấp tạm được xóa sau khi chạy; không tạo thêm bảng migration.

SET NAMES utf8mb4;
SET time_zone = '+07:00';

DROP PROCEDURE IF EXISTS sp_upgrade_customer_portal_schema;

DELIMITER $$

CREATE PROCEDURE sp_upgrade_customer_portal_schema()
SQL SECURITY INVOKER
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'app_users' AND column_name = 'role'
    ) THEN
        ALTER TABLE app_users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'ADMIN';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'app_users' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE app_users ADD COLUMN customer_id BIGINT NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE() AND table_name = 'app_users'
            AND constraint_name = 'uq_app_users_customer' AND constraint_type = 'UNIQUE'
    ) THEN
        ALTER TABLE app_users ADD CONSTRAINT uq_app_users_customer UNIQUE (customer_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE() AND table_name = 'app_users'
            AND constraint_name = 'fk_app_users_customer' AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE app_users ADD CONSTRAINT fk_app_users_customer
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE() AND table_name = 'app_users'
            AND constraint_name = 'ck_app_users_role_customer' AND constraint_type = 'CHECK'
    ) THEN
        ALTER TABLE app_users ADD CONSTRAINT ck_app_users_role_customer CHECK (
            (role = 'ADMIN' AND customer_id IS NULL)
            OR (role = 'CUSTOMER' AND customer_id IS NOT NULL)
        );
    END IF;
END$$

DELIMITER ;

CALL sp_upgrade_customer_portal_schema();
DROP PROCEDURE sp_upgrade_customer_portal_schema;
DROP PROCEDURE IF EXISTS sp_cancel_customer_booking;

DELIMITER $$

CREATE PROCEDURE sp_cancel_customer_booking(IN p_booking_id BIGINT, IN p_customer_id BIGINT)
SQL SECURITY INVOKER
BEGIN
    DECLARE v_owner_id BIGINT DEFAULT NULL;
    DECLARE v_status VARCHAR(16) DEFAULT NULL;
    DECLARE v_payment_id BIGINT DEFAULT NULL;
    DECLARE v_first_start DATETIME DEFAULT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    SET time_zone = '+07:00';
    START TRANSACTION;
    -- Cùng thứ tự khóa với sp_pay_booking/sp_cancel_booking để không vừa hủy vừa trả tiền.
    SELECT customer_id, status INTO v_owner_id, v_status
    FROM bookings WHERE id = p_booking_id FOR UPDATE;
    -- Đơn không thuộc người gọi cũng trả NOT_FOUND, tránh tiết lộ đơn của khách khác.
    IF v_owner_id IS NULL OR p_customer_id IS NULL OR v_owner_id <> p_customer_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_NOT_FOUND: Booking does not exist';
    END IF;
    IF v_status <> 'CONFIRMED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_TRANSITION: Only confirmed bookings can be cancelled';
    END IF;
    SELECT id INTO v_payment_id FROM payments WHERE booking_id = p_booking_id FOR UPDATE;
    IF v_payment_id IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAID_BOOKING_CANNOT_CANCEL: Paid bookings cannot be cancelled';
    END IF;
    SELECT MIN(TIMESTAMP(bi.play_date, ts.start_time)) INTO v_first_start
    FROM booking_items bi JOIN time_slots ts ON ts.id = bi.time_slot_id
    WHERE bi.booking_id = p_booking_id AND bi.released_at IS NULL;
    -- SYSDATE đọc giờ thực sau khi chờ khóa; cho hủy chỉ trước khi bắt đầu slot đầu tiên.
    IF v_first_start IS NULL OR v_first_start <= SYSDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BOOKING_ALREADY_STARTED: Customer cancellation must be before the first slot starts';
    END IF;
    -- Trigger hiện có giải phóng tất cả slot và giữ nguyên lịch sử chi tiết.
    UPDATE bookings SET status = 'CANCELLED', cancelled_at = SYSDATE() WHERE id = p_booking_id;
    COMMIT;
END$$

DELIMITER ;
