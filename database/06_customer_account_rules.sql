-- CẬP NHẬT QUY TẮC TÊN ĐĂNG NHẬP — chạy sau 05_customer_portal.sql.
-- Cho phép tên từ 1 đến 50 ký tự sau TRIM, gồm tiếng Việt và khoảng trắng bên trong.
-- UNIQUE uq_app_users_username hiện có vẫn bảo vệ tên không trùng theo collation của DB.
-- Không đổi tên, vai trò, liên kết khách, mật khẩu hoặc dữ liệu của bất kỳ tài khoản nào.
-- Có thể chạy lại; CHECK mới là dấu hiệu nhận biết migration đã hoàn thành.

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS sp_upgrade_customer_account_rules;

DELIMITER $$

CREATE PROCEDURE sp_upgrade_customer_account_rules()
SQL SECURITY INVOKER
BEGIN
    DECLARE v_old_check INT DEFAULT 0;
    DECLARE v_new_check INT DEFAULT 0;
    SELECT COUNT(*) INTO v_old_check
    FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE() AND table_name = 'app_users'
        AND constraint_name = 'ck_app_users_username' AND constraint_type = 'CHECK';
    SELECT COUNT(*) INTO v_new_check
    FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE() AND table_name = 'app_users'
        AND constraint_name = 'ck_app_users_username_nonblank' AND constraint_type = 'CHECK';

    IF v_old_check > 0 AND v_new_check = 0 THEN
        -- Thay ràng buộc trong một ALTER, không có khoảng trống kiểm tra giữa hai lệnh.
        ALTER TABLE app_users
            DROP CHECK ck_app_users_username,
            ADD CONSTRAINT ck_app_users_username_nonblank CHECK (CHAR_LENGTH(TRIM(username)) BETWEEN 1 AND 50);
    ELSEIF v_old_check > 0 THEN
        ALTER TABLE app_users DROP CHECK ck_app_users_username;
    ELSEIF v_new_check = 0 THEN
        ALTER TABLE app_users ADD CONSTRAINT ck_app_users_username_nonblank
            CHECK (CHAR_LENGTH(TRIM(username)) BETWEEN 1 AND 50);
    END IF;
END$$

DELIMITER ;

CALL sp_upgrade_customer_account_rules();
DROP PROCEDURE sp_upgrade_customer_account_rules;
