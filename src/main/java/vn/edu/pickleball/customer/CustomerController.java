package vn.edu.pickleball.customer;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.edu.pickleball.*;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/customer")
public class CustomerController {
    private final CustomerService service;
    private final CustomerAccounts accounts;
    private final BookingService bookings;
    public CustomerController(CustomerService service,CustomerAccounts accounts,BookingService bookings) { this.service=service; this.accounts=accounts; this.bookings=bookings; }
    private Map<String,Object> data(Object value) { return Map.of("data",value); }
    @GetMapping("/config") public Map<String,Object> config() {
        LocalDate today=BookingService.today();
        return data(Map.of("today",today.toString(),"max_booking_date",today.plusDays(30).toString(),"time_slots",bookings.slots()));
    }
    @GetMapping("/courts") public Map<String,Object> courts() { return data(service.courts()); }
    @GetMapping("/availability") public Map<String,Object> availability(@RequestParam LocalDate date) { return data(service.availability(date)); }
    @GetMapping("/me") public Map<String,Object> profile(HttpServletRequest request) { return data(accounts.profile(SessionAuth.customerId(request))); }
    @PutMapping("/me") public Map<String,Object> updateProfile(@Valid @RequestBody CustomerRequests.Profile input,HttpServletRequest request) {
        Map<String,Object> profile=accounts.updateProfile(SessionAuth.customerId(request),input);
        Map<String,Object> user=new LinkedHashMap<>(SessionAuth.user(request));
        user.put("display_name",profile.get("full_name")); request.getSession().setAttribute("user",user);
        return data(profile);
    }
    @PutMapping("/password") public Map<String,Object> password(@Valid @RequestBody CustomerRequests.Password input,HttpServletRequest request) {
        long customerId=SessionAuth.customerId(request);
        long userId=((Number) SessionAuth.user(request).get("id")).longValue();
        Map<String,Object> row=accounts.changePassword(userId,customerId,input);
        SessionAuth.establish(request,row);
        return data(Map.of("message","Đã đổi mật khẩu. Các phiên đăng nhập khác đã được đăng xuất."));
    }
    @GetMapping("/bookings") public Map<String,Object> history(@RequestParam(required=false) String status,HttpServletRequest request) { return data(service.history(SessionAuth.customerId(request),status)); }
    @GetMapping("/bookings/{id}") public Map<String,Object> detail(@PathVariable long id,HttpServletRequest request) { return data(service.detail(SessionAuth.customerId(request),id)); }
    @PostMapping("/bookings") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> create(@Valid @RequestBody CustomerRequests.Booking input,HttpServletRequest request) { return data(service.create(SessionAuth.customerId(request),input)); }
    @PostMapping("/bookings/{id}/cancel") public Map<String,Object> cancel(@PathVariable long id,HttpServletRequest request) { return data(service.cancel(SessionAuth.customerId(request),id)); }
}
