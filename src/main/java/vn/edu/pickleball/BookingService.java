package vn.edu.pickleball;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
public class BookingService {
    public static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    private final Database db;
    private final ObjectMapper json;
    public BookingService(Database db,ObjectMapper json) { this.db=db; this.json=json; }
    public static LocalDate today() { return LocalDate.now(ZONE); }
    private static String clean(String value) { return value==null || value.isBlank() ? null : value.trim(); }
    private static String search(String value) { return "%"+(value==null ? "" : value.trim().replace("\\","\\\\").replace("%","\\%").replace("_","\\_"))+"%"; }
    public List<Map<String,Object>> slots() { return db.rows("SELECT id,TIME_FORMAT(start_time,'%H:%i:%s') start_time,TIME_FORMAT(end_time,'%H:%i:%s') end_time FROM time_slots ORDER BY start_time"); }
    public List<Map<String,Object>> courts() { return db.rows("SELECT id,code,name,description,hourly_price,status FROM courts ORDER BY id"); }
    public Map<String,Object> court(long id) { return db.one("SELECT id,code,name,description,hourly_price,status FROM courts WHERE id=?",id); }
    public Map<String,Object> createCourt(Requests.Court input) {
        long id=db.insert("INSERT INTO courts(code,name,description,hourly_price,status) VALUES(?,?,?,?,?)",input.code().trim().toUpperCase(Locale.ROOT),input.name().trim(),clean(input.description()),input.hourly_price(),input.status());
        return court(id);
    }
    @Transactional
    public Map<String,Object> updateCourt(long id,Requests.Court input) {
        db.one("SELECT id FROM courts WHERE id=? FOR UPDATE",id);
        if (!input.status().equals("ACTIVE")) {
            long booked=((Number)db.one("SELECT COUNT(*) n FROM booking_items i JOIN bookings b ON b.id=i.booking_id JOIN time_slots t ON t.id=i.time_slot_id WHERE i.court_id=? AND i.released_at IS NULL AND b.status='CONFIRMED' AND TIMESTAMP(i.play_date,t.end_time)>NOW()",id).get("n")).longValue();
            if (booked>0) throw new ApiException(409,"Sân còn lịch đặt chưa kết thúc. Xử lý các đơn đó trước khi ngừng hoạt động hoặc bảo trì.");
        }
        db.execute("UPDATE courts SET code=?,name=?,description=?,hourly_price=?,status=? WHERE id=?",input.code().trim().toUpperCase(Locale.ROOT),input.name().trim(),clean(input.description()),input.hourly_price(),input.status(),id);
        return court(id);
    }
    public List<Map<String,Object>> customers(String q) {
        String pattern=search(q);
        return db.rows("SELECT c.id,c.full_name,c.phone,c.email,(SELECT COUNT(*) FROM bookings b WHERE b.customer_id=c.id) booking_count FROM customers c WHERE c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? ORDER BY c.id DESC LIMIT 500",pattern,pattern,pattern);
    }
    public Map<String,Object> customer(long id) {
        return db.one("SELECT c.id,c.full_name,c.phone,c.email,(SELECT COUNT(*) FROM bookings b WHERE b.customer_id=c.id) booking_count FROM customers c WHERE c.id=?",id);
    }
    public Map<String,Object> createCustomer(Requests.Customer input) {
        long id=db.insert("INSERT INTO customers(full_name,phone,email) VALUES(?,?,?)",input.full_name().trim(),input.phone().trim(),clean(input.email()));
        return customer(id);
    }
    @Transactional
    public Map<String,Object> updateCustomer(long id,Requests.Customer input) {
        customer(id);
        db.execute("UPDATE customers SET full_name=?,phone=?,email=? WHERE id=?",input.full_name().trim(),input.phone().trim(),clean(input.email()),id);
        db.execute("UPDATE app_users SET display_name=? WHERE customer_id=? AND role='CUSTOMER'",input.full_name().trim(),id);
        return customer(id);
    }
    private static final String SUMMARY="""
        SELECT b.id,b.booking_code,b.customer_id,c.full_name customer_name,c.phone customer_phone,
               b.status,b.note,b.created_at,b.cancelled_at,x.play_date,x.court_name,x.total_amount,
               x.slot_count,TIME_FORMAT(x.start_time,'%H:%i:%s') start_time,TIME_FORMAT(x.end_time,'%H:%i:%s') end_time,
               IF(p.id IS NULL,'UNPAID','PAID') payment_status
        FROM bookings b JOIN customers c ON c.id=b.customer_id
        JOIN (SELECT i.booking_id,MIN(i.play_date) play_date,SUM(i.unit_price) total_amount,
                     COUNT(*) slot_count,MIN(t.start_time) start_time,MAX(t.end_time) end_time,
                     GROUP_CONCAT(DISTINCT co.name ORDER BY co.id SEPARATOR ', ') court_name
              FROM booking_items i JOIN time_slots t ON t.id=i.time_slot_id JOIN courts co ON co.id=i.court_id
              GROUP BY i.booking_id) x ON x.booking_id=b.id
        LEFT JOIN payments p ON p.booking_id=b.id
        """;
    public List<Map<String,Object>> bookings(LocalDate date,String status,String q,Long customerId) {
        StringBuilder sql=new StringBuilder(SUMMARY).append(" WHERE 1=1 "); List<Object> args=new ArrayList<>();
        if (date!=null) { sql.append(" AND x.play_date=? "); args.add(date); }
        if (status!=null && !status.isBlank()) {
            if (!Set.of("CONFIRMED","CANCELLED","COMPLETED").contains(status)) throw new ApiException(400,"Trạng thái đơn không hợp lệ.");
            sql.append(" AND b.status=? "); args.add(status);
        }
        if (q!=null && !q.isBlank()) { sql.append(" AND (b.booking_code LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ?) "); for (int i=0;i<3;i++) args.add(search(q)); }
        if (customerId!=null) { customer(customerId); sql.append(" AND b.customer_id=? "); args.add(customerId); }
        sql.append(" ORDER BY b.created_at DESC,b.id DESC LIMIT 500");
        return db.rows(sql.toString(),args.toArray());
    }
    public Map<String,Object> booking(long id) {
        Map<String,Object> result=new LinkedHashMap<>(db.one(SUMMARY+" WHERE b.id=?",id));
        result.put("items",db.rows("SELECT i.id,i.court_id,c.name court_name,i.play_date,i.time_slot_id,TIME_FORMAT(t.start_time,'%H:%i:%s') start_time,TIME_FORMAT(t.end_time,'%H:%i:%s') end_time,i.unit_price,i.released_at FROM booking_items i JOIN courts c ON c.id=i.court_id JOIN time_slots t ON t.id=i.time_slot_id WHERE i.booking_id=? ORDER BY i.play_date,t.start_time",id));
        List<Map<String,Object>> payment=db.rows("SELECT amount,method,paid_at FROM payments WHERE booking_id=?",id);
        result.put("payment",payment.isEmpty() ? null : payment.get(0));
        return result;
    }
    public Map<String,Object> createBooking(Requests.Booking input) {
        checkBookingDate(input.play_date());
        if (new HashSet<>(input.slot_ids()).size()!=input.slot_ids().size()) throw new ApiException(400,"Không chọn cùng một khung giờ hai lần.");
        try {
            Long id=db.call("{CALL sp_create_booking(?,?,?,?,?)}",input.customer_id(),input.court_id(),input.play_date(),json.writeValueAsString(input.slot_ids()),clean(input.note()));
            if (id==null) throw new IllegalStateException("Procedure did not return booking id");
            return booking(id);
        } catch (JsonProcessingException e) { throw new IllegalArgumentException(e); }
    }
    public Map<String,Object> cancel(long id) { db.call("{CALL sp_cancel_booking(?)}",id); return booking(id); }
    public Map<String,Object> pay(long id,Requests.Payment input) { db.call("{CALL sp_pay_booking(?,?)}",id,input.method()); return booking(id); }
    public Map<String,Object> complete(long id) { db.call("{CALL sp_complete_booking(?)}",id); return booking(id); }
    public static void checkBookingDate(LocalDate date) {
        if (date.isBefore(today()) || date.isAfter(today().plusDays(30))) throw new ApiException(400,"Chỉ đặt sân từ hôm nay đến 30 ngày tiếp theo.");
    }
    @SuppressWarnings("unchecked")
    public Map<String,Object> availability(LocalDate date) {
        checkBookingDate(date);
        List<Map<String,Object>> times=slots();
        List<Map<String,Object>> resultCourts=new ArrayList<>();
        Map<String,Object> occupied=new HashMap<>();
        for (Map<String,Object> item:db.rows("SELECT court_id,time_slot_id,booking_id FROM booking_items WHERE play_date=? AND released_at IS NULL",date)) occupied.put(item.get("court_id")+":"+item.get("time_slot_id"),item.get("booking_id"));
        LocalDateTime now=LocalDateTime.now(ZONE);
        for (Map<String,Object> original:courts()) {
            Map<String,Object> court=new LinkedHashMap<>(original); List<Map<String,Object>> grid=new ArrayList<>();
            for (Map<String,Object> time:times) {
                Map<String,Object> slot=new LinkedHashMap<>();
                Object bookingId=occupied.get(court.get("id")+":"+time.get("id"));
                boolean past=!LocalDateTime.of(date,LocalTime.parse(time.get("start_time").toString())).isAfter(now);
                String reason=!court.get("status").equals("ACTIVE") ? "UNAVAILABLE" : past ? "PAST" : bookingId!=null ? "BOOKED" : null;
                slot.put("time_slot_id",time.get("id")); slot.put("start_time",time.get("start_time")); slot.put("end_time",time.get("end_time"));
                slot.put("available",reason==null); slot.put("booking_id",bookingId); slot.put("reason",reason); grid.add(slot);
            }
            court.put("slots",grid); resultCourts.add(court);
        }
        Map<String,Object> result=new LinkedHashMap<>(); result.put("date",date.toString()); result.put("time_slots",times); result.put("courts",resultCourts); return result;
    }
    @SuppressWarnings("unchecked")
    public Map<String,Object> dashboard(LocalDate date) {
        Map<String,Object> result=new LinkedHashMap<>(); result.put("date",date.toString());
        result.putAll(db.one("SELECT COUNT(DISTINCT b.id) booking_count,COALESCE(SUM(IF(p.id IS NULL AND b.status='CONFIRMED',i.unit_price,0)),0) unpaid_total FROM bookings b JOIN booking_items i ON i.booking_id=b.id LEFT JOIN payments p ON p.booking_id=b.id WHERE i.play_date=? AND b.status<>'CANCELLED'",date));
        result.put("paid_revenue",db.one("SELECT COALESCE(SUM(amount),0) n FROM payments WHERE DATE(paid_at)=?",date).get("n"));
        result.put("customer_count",db.one("SELECT COUNT(*) n FROM customers").get("n"));
        long available=0,total=0;
        if (!date.isBefore(today()) && !date.isAfter(today().plusDays(30))) {
            for (Map<String,Object> court:(List<Map<String,Object>>)availability(date).get("courts")) {
                if (court.get("status").equals("ACTIVE")) {
                    for (Map<String,Object> slot:(List<Map<String,Object>>)court.get("slots")) { total++; if (Boolean.TRUE.equals(slot.get("available"))) available++; }
                }
            }
        }
        result.put("available_slot_count",available); result.put("total_slot_count",total);
        result.put("recent_bookings",db.rows(SUMMARY+" WHERE x.play_date=? ORDER BY b.created_at DESC,b.id DESC LIMIT 6",date));
        result.put("court_utilization",db.rows("SELECT c.id,c.name,(SELECT COUNT(*) FROM booking_items i WHERE i.court_id=c.id AND i.play_date=? AND i.released_at IS NULL) booked_slots,(SELECT COUNT(*) FROM time_slots) total_slots FROM courts c WHERE c.status='ACTIVE' ORDER BY c.id",date));
        return result;
    }
    public Map<String,Object> reports(LocalDate from,LocalDate to) {
        if (to.isBefore(from) || to.isAfter(from.plusDays(92))) throw new ApiException(400,"Chọn khoảng thống kê hợp lệ, tối đa 93 ngày.");
        Map<String,Object> result=new LinkedHashMap<>(); result.put("from",from.toString()); result.put("to",to.toString());
        result.putAll(db.one("SELECT COUNT(DISTINCT IF(b.status<>'CANCELLED',b.id,NULL)) booking_count,COUNT(DISTINCT IF(b.status='CANCELLED',b.id,NULL)) cancelled_count,COALESCE(SUM(IF(b.status='CONFIRMED' AND p.id IS NULL,i.unit_price,0)),0) unpaid_total FROM bookings b JOIN booking_items i ON i.booking_id=b.id LEFT JOIN payments p ON p.booking_id=b.id WHERE i.play_date BETWEEN ? AND ?",from,to));
        result.put("paid_revenue",db.one("SELECT COALESCE(SUM(amount),0) n FROM payments WHERE paid_at>=? AND paid_at<?",from,to.plusDays(1)).get("n"));
        Map<String,Map<String,Object>> days=new LinkedHashMap<>();
        for (LocalDate date=from;!date.isAfter(to);date=date.plusDays(1)) {
            Map<String,Object> row=new LinkedHashMap<>(); row.put("date",date.toString()); row.put("booking_count",0); row.put("paid_revenue",BigDecimal.ZERO); days.put(date.toString(),row);
        }
        for (Map<String,Object> row:db.rows("SELECT i.play_date date,COUNT(DISTINCT b.id) booking_count FROM bookings b JOIN booking_items i ON i.booking_id=b.id WHERE b.status<>'CANCELLED' AND i.play_date BETWEEN ? AND ? GROUP BY i.play_date",from,to)) days.get(row.get("date").toString()).put("booking_count",row.get("booking_count"));
        for (Map<String,Object> row:db.rows("SELECT DATE(paid_at) date,SUM(amount) paid_revenue FROM payments WHERE paid_at>=? AND paid_at<? GROUP BY DATE(paid_at)",from,to.plusDays(1))) days.get(row.get("date").toString()).put("paid_revenue",row.get("paid_revenue"));
        result.put("by_day",new ArrayList<>(days.values()));
        result.put("by_court",db.rows("""
            SELECT c.id,c.name,COALESCE(x.booking_count,0) booking_count,COALESCE(x.booked_hours,0) booked_hours,COALESCE(y.paid_revenue,0) paid_revenue
            FROM courts c LEFT JOIN
            (SELECT i.court_id,COUNT(DISTINCT b.id) booking_count,COUNT(*) booked_hours FROM booking_items i JOIN bookings b ON b.id=i.booking_id
             WHERE b.status<>'CANCELLED' AND i.play_date BETWEEN ? AND ? GROUP BY i.court_id) x ON x.court_id=c.id
            LEFT JOIN (SELECT i.court_id,SUM(i.unit_price) paid_revenue FROM booking_items i JOIN payments p ON p.booking_id=i.booking_id
                       WHERE p.paid_at>=? AND p.paid_at<? GROUP BY i.court_id) y ON y.court_id=c.id ORDER BY c.id
            """,from,to,from,to.plusDays(1)));
        result.put("by_payment_method",db.rows("SELECT method,SUM(amount) amount,COUNT(*) count FROM payments WHERE paid_at>=? AND paid_at<? GROUP BY method ORDER BY method",from,to.plusDays(1)));
        return result;
    }
}
