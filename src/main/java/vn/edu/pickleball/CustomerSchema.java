package vn.edu.pickleball;

import java.io.IOException;
import java.nio.file.Path;

/** Nâng cấp DB tại chỗ, giữ tài khoản/khách hàng/đơn cũ khi bật cổng khách hàng. */
public final class CustomerSchema {
    private CustomerSchema() {}

    /** DB đã nhập đủ migration chỉ cần quyền đọc metadata/EXECUTE khi chạy ứng dụng. */
    public static void install(Database db) throws IOException {
        Number ready = (Number) db.one("""
            SELECT CAST((
                (SELECT COUNT(*) FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='app_users'
                   AND column_name IN ('role','customer_id')) = 2
                AND
                (SELECT COUNT(*) FROM information_schema.table_constraints
                 WHERE constraint_schema=DATABASE() AND table_name='app_users'
                   AND ((constraint_name='uq_app_users_customer' AND constraint_type='UNIQUE')
                     OR (constraint_name='fk_app_users_customer' AND constraint_type='FOREIGN KEY')
                     OR (constraint_name='ck_app_users_role_customer' AND constraint_type='CHECK'))) = 3
                AND EXISTS (
                    SELECT 1 FROM information_schema.routines
                    WHERE routine_schema=DATABASE() AND routine_name='sp_cancel_customer_booking'
                      AND routine_type='PROCEDURE'
                )
            ) AS UNSIGNED) AS ready
            """).get("ready");
        if (ready.intValue() != 1) apply(db, "05_customer_portal.sql");
        Number accountRulesReady = (Number) db.one("""
            SELECT CAST((
                EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_schema=DATABASE() AND table_name='app_users'
                      AND constraint_name='ck_app_users_username_nonblank' AND constraint_type='CHECK'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_schema=DATABASE() AND table_name='app_users'
                      AND constraint_name='ck_app_users_username' AND constraint_type='CHECK'
                )
            ) AS UNSIGNED) AS ready
            """).get("ready");
        if (accountRulesReady.intValue() != 1) apply(db, "06_customer_account_rules.sql");
    }

    private static void apply(Database db, String file) throws IOException {
        for (String sql : SqlInstaller.statements(Path.of("database", file))) {
            db.executeStatement(sql);
        }
    }
}
