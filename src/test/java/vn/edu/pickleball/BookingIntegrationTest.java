package vn.edu.pickleball;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataAccessException;

import java.math.BigDecimal;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Real MySQL only. Each test creates independent data; immutable history is retained. */
@EnabledIfEnvironmentVariable(named = "RUN_MYSQL_TESTS", matches = "true")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:mysql://127.0.0.1:3307/pickleball_integration_test?connectionTimeZone=%2B07:00&forceConnectionTimeZoneToSession=true&useSSL=false&allowPublicKeyRetrieval=true",
    "app.setup=true", "app.seed=false", "app.admin-password=admin123"
})
class BookingIntegrationTest {
    private static final BigDecimal PRICE = new BigDecimal("150000");

    @Autowired BookingService service;
    @Autowired Database db;
    @Autowired ObjectMapper json;
    @LocalServerPort int port;

    private record Fixture(long customerId, long courtId, String courtCode,
                           LocalDate date, List<Long> slots) {}
    private record Attempt(Long bookingId, RuntimeException failure) {}
    private record Response(int status, JsonNode body) {}
    private record Session(HttpClient client, String csrf) {}

    @Test
    void simultaneousBookingsHaveOneWinnerAndNoDuplicateReservation() throws Exception {
        Fixture fixture = fixture();
        Requests.Booking input = request(fixture, fixture.slots().get(12));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Attempt> first = executor.submit(() -> attempt(input, ready, start));
            Future<Attempt> second = executor.submit(() -> attempt(input, ready, start));
            assertTrue(ready.await(5, TimeUnit.SECONDS), "Both booking requests must be ready");
            start.countDown();
            List<Attempt> results = List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
            assertEquals(1, results.stream().filter(result -> result.bookingId() != null).count());
            Attempt loser = results.stream().filter(result -> result.failure() != null).findFirst().orElseThrow();
            assertSqlRule(assertInstanceOf(DataAccessException.class, loser.failure()), "BOOKING_CONFLICT");
            assertEquals(1, count("SELECT COUNT(*) n FROM bookings WHERE customer_id=?", fixture.customerId()));
            assertEquals(1, count("SELECT COUNT(*) n FROM booking_items WHERE court_id=? AND play_date=? AND time_slot_id=? AND released_at IS NULL",
                fixture.courtId(), fixture.date(), fixture.slots().get(12)));
        } finally {
            start.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
        }
    }

    @Test
    void cancellationKeepsHistoryAndAllowsTheSameSlotsToBeBookedAgain() {
        Fixture fixture = fixture();
        Requests.Booking input = request(fixture, fixture.slots().get(12), fixture.slots().get(13));
        Map<String, Object> original = service.createBooking(input);
        long originalId = id(original);
        List<Long> originalItemIds = items(original).stream().map(BookingIntegrationTest::id).toList();

        Map<String, Object> cancelled = service.cancel(originalId);
        assertEquals("CANCELLED", cancelled.get("status"));
        assertNotNull(cancelled.get("cancelled_at"));
        assertEquals(originalItemIds, items(cancelled).stream().map(BookingIntegrationTest::id).toList());
        assertEquals(2, count("SELECT COUNT(*) n FROM booking_items WHERE booking_id=? AND released_at IS NOT NULL AND active_guard IS NULL", originalId));

        Map<String, Object> replacement = service.createBooking(input);
        assertNotEquals(originalId, id(replacement));
        assertEquals("CONFIRMED", replacement.get("status"));
        assertEquals(2, count("SELECT COUNT(*) n FROM bookings WHERE customer_id=?", fixture.customerId()));
        assertEquals(4, count("SELECT COUNT(*) n FROM booking_items WHERE court_id=? AND play_date=?", fixture.courtId(), fixture.date()));
        assertEquals(2, count("SELECT COUNT(*) n FROM booking_items WHERE court_id=? AND play_date=? AND released_at IS NULL", fixture.courtId(), fixture.date()));
        assertEquals("CANCELLED", service.booking(originalId).get("status"));
    }

    @Test
    void aConflictInTheSecondSlotRollsBackTheHeaderAndTheFirstSlot() {
        Fixture fixture = fixture();
        service.createBooking(request(fixture, fixture.slots().get(13)));
        DataAccessException failure = assertThrows(DataAccessException.class,
            () -> service.createBooking(request(fixture, fixture.slots().get(12), fixture.slots().get(13))));
        assertSqlRule(failure, "BOOKING_CONFLICT");
        assertEquals(1, count("SELECT COUNT(*) n FROM bookings WHERE customer_id=?", fixture.customerId()));
        assertEquals(1, count("SELECT COUNT(*) n FROM booking_items WHERE court_id=? AND play_date=?", fixture.courtId(), fixture.date()));
        assertEquals(0, count("SELECT COUNT(*) n FROM booking_items WHERE court_id=? AND play_date=? AND time_slot_id=?", fixture.courtId(), fixture.date(), fixture.slots().get(12)));

        assertEquals("CONFIRMED", service.createBooking(request(fixture, fixture.slots().get(12))).get("status"));
    }

    @Test
    void paidBookingsCannotBeCancelledOrPaidTwiceThroughTheApi() throws Exception {
        Fixture fixture = fixture();
        long bookingId = id(service.createBooking(request(fixture, fixture.slots().get(12), fixture.slots().get(13))));
        Session session = login(client());

        Response paid = send(session.client(), "POST", "/api/bookings/" + bookingId + "/pay", Map.of("method", "CASH"), session.csrf());
        assertEquals(200, paid.status());
        assertEquals("PAID", paid.body().path("data").path("payment_status").asText());
        assertMoney("300000", paid.body().path("data").path("payment").path("amount").decimalValue());
        assertApiError(send(session.client(), "POST", "/api/bookings/" + bookingId + "/cancel", null, session.csrf()), 409);
        assertApiError(send(session.client(), "POST", "/api/bookings/" + bookingId + "/pay", Map.of("method", "TRANSFER"), session.csrf()), 409);

        assertEquals(1, count("SELECT COUNT(*) n FROM payments WHERE booking_id=?", bookingId));
        assertEquals("CONFIRMED", service.booking(bookingId).get("status"));
        assertEquals(2, count("SELECT COUNT(*) n FROM booking_items WHERE booking_id=? AND released_at IS NULL", bookingId));
    }

    @Test
    void changingTheCourtPricePreservesTheBookedPriceAndPaymentTotal() {
        Fixture fixture = fixture();
        long bookingId = id(service.createBooking(request(fixture, fixture.slots().get(12), fixture.slots().get(13))));
        service.updateCourt(fixture.courtId(), court(fixture.courtCode(), new BigDecimal("250000"), "ACTIVE"));

        Map<String, Object> booking = service.booking(bookingId);
        assertMoney("300000", booking.get("total_amount"));
        for (Map<String, Object> item : items(booking)) assertMoney("150000", item.get("unit_price"));
        assertMoney("250000", service.court(fixture.courtId()).get("hourly_price"));

        Map<String, Object> paid = service.pay(bookingId, new Requests.Payment("TRANSFER"));
        assertMoney("300000", payment(paid).get("amount"));
    }

    @Test
    void maintenanceAndNonConsecutiveSlotsAreRejectedWithoutCreatingHeaders() {
        Fixture fixture = fixture();
        service.updateCourt(fixture.courtId(), court(fixture.courtCode(), PRICE, "MAINTENANCE"));
        assertSqlRule(assertThrows(DataAccessException.class,
            () -> service.createBooking(request(fixture, fixture.slots().get(12)))), "COURT_UNAVAILABLE");

        service.updateCourt(fixture.courtId(), court(fixture.courtCode(), PRICE, "ACTIVE"));
        assertSqlRule(assertThrows(DataAccessException.class,
            () -> service.createBooking(request(fixture, fixture.slots().get(12), fixture.slots().get(14)))), "NON_CONTIGUOUS_SLOTS");
        assertEquals(0, count("SELECT COUNT(*) n FROM bookings WHERE customer_id=?", fixture.customerId()));
        assertEquals(0, count("SELECT COUNT(*) n FROM booking_items WHERE court_id=?", fixture.courtId()));

        service.createBooking(request(fixture, fixture.slots().get(12)));
        ApiException failure = assertThrows(ApiException.class,
            () -> service.updateCourt(fixture.courtId(), court(fixture.courtCode(), PRICE, "MAINTENANCE")));
        assertEquals(409, failure.status());
        assertEquals("ACTIVE", service.court(fixture.courtId()).get("status"));
    }

    @Test
    void reportsSeparateReceiptDayFromPlayDayAndDoNotDoubleCountTwoHours() {
        Fixture fixture = fixture();
        LocalDate receiptDate = BookingService.today();
        BigDecimal revenueBefore = money(service.reports(receiptDate, receiptDate).get("paid_revenue"));
        long playDayBookingsBefore = ((Number) service.reports(fixture.date(), fixture.date()).get("booking_count")).longValue();
        long bookingId = id(service.createBooking(request(fixture, fixture.slots().get(12), fixture.slots().get(13))));
        service.pay(bookingId, new Requests.Payment("CASH"));

        Map<String, Object> receipts = service.reports(receiptDate, receiptDate);
        assertMoney("300000", money(receipts.get("paid_revenue")).subtract(revenueBefore));
        Map<String, Object> playDay = service.reports(fixture.date(), fixture.date());
        assertEquals(playDayBookingsBefore + 1, ((Number) playDay.get("booking_count")).longValue());
        Map<String, Object> courtReceipts = rows(receipts.get("by_court")).stream().filter(row -> id(row) == fixture.courtId()).findFirst().orElseThrow();
        assertMoney("300000", courtReceipts.get("paid_revenue"));
        assertEquals(0, ((Number) courtReceipts.get("booking_count")).longValue());
        Map<String, Object> courtPlay = rows(playDay.get("by_court")).stream().filter(row -> id(row) == fixture.courtId()).findFirst().orElseThrow();
        assertEquals(1, ((Number) courtPlay.get("booking_count")).longValue());
        assertEquals(2, ((Number) courtPlay.get("booked_hours")).longValue());
        assertMoney("0", courtPlay.get("paid_revenue"));
    }

    @Test
    void apiEnforcesAuthenticationCsrfAndInputValidation() throws Exception {
        HttpClient client = client();
        assertApiError(send(client, "GET", "/api/courts", null, null), 401);
        assertEquals(200, send(client, "GET", "/api/auth/session", null, null).status());
        assertApiError(send(client, "POST", "/api/auth/login", Map.of("username", "admin", "password", "admin123"), null), 403);
        Session session = login(client);
        assertApiError(send(client, "POST", "/api/customers", Map.of("full_name", "Minh", "phone", "0900000991"), "invalid-token"), 403);
        assertApiError(send(client, "POST", "/api/customers", Map.of("full_name", "", "phone", "invalid"), session.csrf()), 400);
        assertApiError(send(client, "POST", "/api/bookings", Map.of(), session.csrf()), 400);
        assertApiError(send(client, "GET", "/api/availability", null, null), 400);
        assertApiError(send(client, "GET", "/api/reports/export", null, null), 400);

        Fixture fixture = fixture();
        assertApiError(send(client, "POST", "/api/bookings", Map.of(
            "customer_id", fixture.customerId(), "court_id", fixture.courtId(),
            "play_date", fixture.date().toString(), "slot_ids", List.of(fixture.slots().get(12) + 0.5)
        ), session.csrf()), 400);
        assertEquals(0, count("SELECT COUNT(*) n FROM bookings WHERE customer_id=?", fixture.customerId()));
    }

    private Fixture fixture() {
        String tag = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String phone;
        do {
            phone = "0" + String.format(java.util.Locale.ROOT, "%09d", ThreadLocalRandom.current().nextLong(1_000_000_000L));
        } while (!db.rows("SELECT id FROM customers WHERE phone=?", phone).isEmpty());
        long customerId = id(service.createCustomer(new Requests.Customer("Khách kiểm thử " + tag, phone, null)));
        String code = "T" + tag;
        long courtId = id(service.createCourt(court(code, PRICE, "ACTIVE")));
        List<Long> slots = service.slots().stream().map(BookingIntegrationTest::id).toList();
        assertEquals(17, slots.size(), "The reference schedule must have all seventeen one-hour slots");
        return new Fixture(customerId, courtId, code, BookingService.today().plusDays(20), slots);
    }

    private static Requests.Court court(String code, BigDecimal price, String status) {
        return new Requests.Court(code, "Sân kiểm thử " + code, "Dữ liệu integration test", price, status);
    }

    private static Requests.Booking request(Fixture fixture, Long... slots) {
        return new Requests.Booking(fixture.customerId(), fixture.courtId(), fixture.date(), List.of(slots), "Integration test");
    }

    private Attempt attempt(Requests.Booking input, CountDownLatch ready, CountDownLatch start) throws InterruptedException {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Booking start barrier timed out");
        try {
            return new Attempt(id(service.createBooking(input)), null);
        } catch (RuntimeException failure) {
            return new Attempt(null, failure);
        }
    }

    private Session login(HttpClient client) throws Exception {
        Response before = send(client, "GET", "/api/auth/session", null, null);
        assertEquals(200, before.status());
        String oldToken = before.body().path("data").path("csrf_token").asText();
        assertFalse(oldToken.isBlank());
        Response login = send(client, "POST", "/api/auth/login", Map.of("username", "admin", "password", "admin123"), oldToken);
        assertEquals(200, login.status());
        Response after = send(client, "GET", "/api/auth/session", null, null);
        assertTrue(after.body().path("data").path("authenticated").asBoolean());
        String token = after.body().path("data").path("csrf_token").asText();
        assertFalse(token.isBlank());
        assertNotEquals(oldToken, token, "Successful login must rotate the session and CSRF token");
        return new Session(client, token);
    }

    private static HttpClient client() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
            .connectTimeout(Duration.ofSeconds(5)).build();
    }

    private Response send(HttpClient client, String method, String path, Object body, String csrf) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).timeout(Duration.ofSeconds(10));
        if (csrf != null) request.header("X-CSRF-TOKEN", csrf);
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        HttpResponse<String> response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
        return new Response(response.statusCode(), json.readTree(response.body()));
    }

    private static void assertApiError(Response response, int status) {
        assertEquals(status, response.status());
        assertTrue(response.body().has("message"));
        assertFalse(response.body().path("message").asText().isBlank());
    }

    private static void assertSqlRule(DataAccessException failure, String rule) {
        SQLException sql = assertInstanceOf(SQLException.class, failure.getMostSpecificCause());
        assertEquals("45000", sql.getSQLState());
        assertTrue(sql.getMessage().startsWith(rule + ":"), "The database must reject the expected business rule");
    }

    private long count(String sql, Object... args) { return ((Number) db.one(sql, args).get("n")).longValue(); }
    private static long id(Map<String, Object> row) { return ((Number) row.get("id")).longValue(); }
    private static BigDecimal money(Object value) { return new BigDecimal(value.toString()); }
    private static void assertMoney(String expected, Object actual) { assertEquals(0, new BigDecimal(expected).compareTo(money(actual))); }
    private static List<Map<String, Object>> items(Map<String, Object> booking) { return rows(booking.get("items")); }
    @SuppressWarnings("unchecked") private static List<Map<String, Object>> rows(Object value) { return (List<Map<String, Object>>) value; }
    @SuppressWarnings("unchecked") private static Map<String, Object> payment(Map<String, Object> booking) { return (Map<String, Object>) booking.get("payment"); }
}
