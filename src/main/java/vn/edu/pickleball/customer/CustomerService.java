package vn.edu.pickleball.customer;

import org.springframework.stereotype.Service;
import vn.edu.pickleball.*;
import java.time.*;
import java.util.*;

/** Customer identity always comes from the authenticated session, never request JSON. */
@Service
public class CustomerService {
    private final Database db;
    private final BookingService bookings;
    public CustomerService(Database db,BookingService bookings) { this.db=db; this.bookings=bookings; }
    public List<Map<String,Object>> courts() {
        return bookings.courts().stream().filter(c -> !"INACTIVE".equals(c.get("status"))).toList();
    }
    @SuppressWarnings("unchecked")
    public Map<String,Object> availability(LocalDate date) {
        Map<String,Object> result=bookings.availability(date);
        List<Map<String,Object>> courts=(List<Map<String,Object>>) result.get("courts");
        courts.removeIf(c -> "INACTIVE".equals(c.get("status")));
        for (Map<String,Object> court:courts) {
            for (Map<String,Object> slot:(List<Map<String,Object>>) court.get("slots")) slot.remove("booking_id");
        }
        return result;
    }
    private Map<String,Object> cancellationFlag(Map<String,Object> row) {
        LocalDateTime starts=LocalDateTime.of(LocalDate.parse(row.get("play_date").toString()),LocalTime.parse(row.get("start_time").toString()));
        row.put("can_cancel","CONFIRMED".equals(row.get("status")) && "UNPAID".equals(row.get("payment_status")) && starts.isAfter(LocalDateTime.now(BookingService.ZONE)));
        return row;
    }
    public List<Map<String,Object>> history(long customerId,String status) {
        return bookings.bookings(null,status,null,customerId).stream().map(this::cancellationFlag).toList();
    }
    public Map<String,Object> detail(long customerId,long id) {
        if (db.rows("SELECT id FROM bookings WHERE id=? AND customer_id=?",id,customerId).isEmpty()) throw new ApiException(404,"Không tìm thấy đơn đặt sân của bạn.");
        return cancellationFlag(bookings.booking(id));
    }
    public Map<String,Object> create(long customerId,CustomerRequests.Booking input) {
        Map<String,Object> row=bookings.createBooking(new Requests.Booking(customerId,input.court_id(),input.play_date(),input.slot_ids(),input.note()));
        return cancellationFlag(row);
    }
    public Map<String,Object> cancel(long customerId,long id) {
        // Procedure locks the order and checks owner, status, payment and start time atomically.
        db.call("{CALL sp_cancel_customer_booking(?,?)}",id,customerId);
        return detail(customerId,id);
    }
}
