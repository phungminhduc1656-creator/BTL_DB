package vn.edu.pickleball;

import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.*;
import java.util.*;
import java.math.BigDecimal;

@Component
public class DemoData implements CommandLineRunner {
    private static final Logger log=LoggerFactory.getLogger(DemoData.class);
    private final Database db;
    @Value("${app.setup:false}") private boolean setup;
    @Value("${app.seed:false}") private boolean seed;
    @Value("${app.admin-password}") private String adminPassword;
    public DemoData(Database db) { this.db=db; }
    @Override public void run(String... args) throws Exception {
        if (setup) {
            SqlInstaller.install(db);
            log.info("Đã khởi tạo bảng, ràng buộc và dữ liệu tham chiếu MySQL.");
        }
        else { CustomerSchema.install(db); } // Nâng cấp cả DB đang có khi không chạy setup/seed.
        // Tài khoản quản trị cũ được giữ nguyên; DB cần quyền DDL để cài migration cổng khách hàng.
        if (setup || seed) {
            if (adminPassword.length()<8) throw new IllegalArgumentException("ADMIN_PASSWORD must have at least 8 characters");
            db.execute("INSERT IGNORE INTO app_users(username,password_hash,display_name) VALUES(?,?,?)","admin",new BCryptPasswordEncoder().encode(adminPassword),"Quản lý sân");
        }
        if (seed && ((Number)db.one("SELECT COUNT(*) n FROM bookings").get("n")).longValue()==0) {
            LocalDate today=BookingService.today();
            // Lịch sử demo dùng dữ liệu giả. SQL trực tiếp chỉ dùng trong seeder để có lịch sử trước hôm nay.
            for (int day=14;day>=1;day--) {
                long court=1+(day%3),customer=1+(day%8); LocalDate date=today.minusDays(day);
                long id=historyBooking("DEMO-"+date+"-"+court,customer,court,date);
                if (day%6!=0) {
                    BigDecimal total=(BigDecimal)db.one("SELECT SUM(unit_price) n FROM booking_items WHERE booking_id=?",id).get("n");
                    db.execute("INSERT INTO payments(booking_id,amount,method,paid_at) VALUES(?,?,?,?)",id,total,day%2==0 ? "CASH" : "TRANSFER",date.atTime(17,0));
                    db.call("{CALL sp_complete_booking(?)}",id);
                }
            }
            for (int day=0;day<=3;day++) {
                LocalDate date=today.plusDays(day);
                LocalTime now=LocalTime.now(BookingService.ZONE);
                // Bỏ các giờ đã bắt đầu trong ngày chạy; hôm sau luôn có lịch mẫu.
                if (day>0 || now.isBefore(LocalTime.of(17,0))) {
                    Long id=db.call("{CALL sp_create_booking(?,?,?,?,?)}",1+day,1,date,"[12,13]","Lịch mẫu · nhóm chơi buổi chiều");
                    if (day%2==0) db.call("{CALL sp_pay_booking(?,?)}",id,"TRANSFER");
                }
                if (day>0 || now.isBefore(LocalTime.of(19,0))) db.call("{CALL sp_create_booking(?,?,?,?,?)}",5+day,2,date,"[14,15]","Lịch mẫu · khách chưa thanh toán");
            }
            Long canceled=db.call("{CALL sp_create_booking(?,?,?,?,?)}",3,3,today.plusDays(2),"[8]","Đơn mẫu đã hủy, ô giờ được giải phóng");
            db.call("{CALL sp_cancel_booking(?)}",canceled);
            log.info("Đã tạo lịch demo theo ngày hiện tại; chạy lại không nhân đôi dữ liệu.");
        }
        log.info("Application ready");
    }
    private long historyBooking(String code,long customer,long court,LocalDate date) {
        long id=db.insert("INSERT INTO bookings(booking_code,customer_id,note,created_at) VALUES(?,?,?,?)",code,customer,"Dữ liệu lịch sử phục vụ demo",date.atTime(10,0));
        BigDecimal price=(BigDecimal)db.one("SELECT hourly_price FROM courts WHERE id=?",court).get("hourly_price");
        for (long slot:List.of(12L,13L)) db.execute("INSERT INTO booking_items(booking_id,court_id,play_date,time_slot_id,unit_price) VALUES(?,?,?,?,?)",id,court,date,slot,price);
        return id;
    }
}
