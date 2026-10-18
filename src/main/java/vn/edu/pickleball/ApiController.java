package vn.edu.pickleball;

import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final BookingService service;
    public ApiController(BookingService service) { this.service=service; }
    private Map<String,Object> data(Object result) { return Map.of("data",result); }
    @GetMapping("/config") public Map<String,Object> config() { return data(Map.of("today",BookingService.today().toString(),"max_booking_date",BookingService.today().plusDays(30).toString(),"time_slots",service.slots())); }
    @GetMapping("/dashboard") public Map<String,Object> dashboard(@RequestParam(required=false) LocalDate date) { return data(service.dashboard(date==null ? BookingService.today() : date)); }
    @GetMapping("/courts") public Map<String,Object> courts() { return data(service.courts()); }
    @PostMapping("/courts") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> createCourt(@Valid @RequestBody Requests.Court input) { return data(service.createCourt(input)); }
    @PutMapping("/courts/{id}") public Map<String,Object> updateCourt(@PathVariable long id,@Valid @RequestBody Requests.Court input) { return data(service.updateCourt(id,input)); }
    @GetMapping("/customers") public Map<String,Object> customers(@RequestParam(required=false) String q) { return data(service.customers(q)); }
    @PostMapping("/customers") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> createCustomer(@Valid @RequestBody Requests.Customer input) { return data(service.createCustomer(input)); }
    @PutMapping("/customers/{id}") public Map<String,Object> updateCustomer(@PathVariable long id,@Valid @RequestBody Requests.Customer input) { return data(service.updateCustomer(id,input)); }
    @GetMapping("/customers/{id}/bookings") public Map<String,Object> customerBookings(@PathVariable long id) { return data(service.bookings(null,null,null,id)); }
    @GetMapping("/availability") public Map<String,Object> availability(@RequestParam LocalDate date) { return data(service.availability(date)); }
    @GetMapping("/bookings") public Map<String,Object> bookings(@RequestParam(required=false) LocalDate date,@RequestParam(required=false) String status,@RequestParam(required=false) String q) { return data(service.bookings(date,status,q,null)); }
    @GetMapping("/bookings/{id}") public Map<String,Object> booking(@PathVariable long id) { return data(service.booking(id)); }
    @PostMapping("/bookings") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> createBooking(@Valid @RequestBody Requests.Booking input) { return data(service.createBooking(input)); }
    @PostMapping("/bookings/{id}/cancel") public Map<String,Object> cancel(@PathVariable long id) { return data(service.cancel(id)); }
    @PostMapping("/bookings/{id}/pay") public Map<String,Object> pay(@PathVariable long id,@Valid @RequestBody Requests.Payment input) { return data(service.pay(id,input)); }
    @PostMapping("/bookings/{id}/complete") public Map<String,Object> complete(@PathVariable long id) { return data(service.complete(id)); }
    @GetMapping("/reports") public Map<String,Object> reports(@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to) { return data(service.reports(from==null ? BookingService.today().minusDays(29) : from,to==null ? BookingService.today() : to)); }
    @SuppressWarnings("unchecked")
    @GetMapping("/reports/export") public ResponseEntity<byte[]> export(@RequestParam LocalDate from,@RequestParam LocalDate to) {
        Map<String,Object> report=service.reports(from,to);
        StringBuilder csv=new StringBuilder("\uFEFFNgày,Lượt đặt không bị hủy,Tiền đã thu (VND)\r\n");
        for (Map<String,Object> day:(List<Map<String,Object>>)report.get("by_day")) csv.append(day.get("date")).append(',').append(day.get("booking_count")).append(',').append(day.get("paid_revenue")).append("\r\n");
        return ResponseEntity.ok().header("Content-Disposition","attachment; filename=thong-ke-"+from+"-"+to+".csv").contentType(new MediaType("text","csv",StandardCharsets.UTF_8)).body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }
}
