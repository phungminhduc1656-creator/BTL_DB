package vn.edu.pickleball;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.math.BigDecimal;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises the customer portal over real HTTP and MySQL; opt in explicitly. */
@EnabledIfEnvironmentVariable(named = "RUN_MYSQL_TESTS", matches = "true")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:mysql://127.0.0.1:3307/pickleball_integration_test?connectionTimeZone=%2B07:00&forceConnectionTimeZoneToSession=true&useSSL=false&allowPublicKeyRetrieval=true",
    "app.setup=true", "app.seed=false", "app.admin-password=admin123"
})
class CustomerIntegrationTest {
    private static final String PASSWORD = "PortalTest123!";
    @Autowired BookingService service;
    @Autowired Database db;
    @Autowired ObjectMapper json;
    @LocalServerPort int port;

    private record Response(int status, JsonNode body) { JsonNode data() { return body.path("data"); } }
    private record Session(HttpClient client, String csrf, JsonNode user) {}
    private record Account(Session session, String username, String phone, long customerId) {}
    private record Court(long id, LocalDate date, List<Long> slots) {}

    @Test
    void registrationBookingHistoryCancellationAndAdminVisibilityUseTheSameDatabase() throws Exception {
        Account account = register();
        assertEquals("CUSTOMER", account.session().user().path("role").asText());
        assertTrue(account.customerId() > 0);
        Response profile = get(account.session().client(), "/api/customer/me");
        assertEquals(200, profile.status());
        assertEquals(account.phone(), profile.data().path("phone").asText());
        assertNoFields(profile.body(), "password_hash", "credential_stamp");

        Court court = court("ACTIVE");
        JsonNode booking = book(account.session(), court, Map.of());
        long bookingId = booking.path("id").asLong();
        assertEquals(account.customerId(), booking.path("customer_id").asLong());
        assertEquals(2, booking.path("slot_count").asInt());
        assertEquals(new BigDecimal("300000"), booking.path("total_amount").decimalValue());
        assertTrue(booking.path("can_cancel").asBoolean());

        Response history = get(account.session().client(), "/api/customer/bookings?status=CONFIRMED");
        assertEquals(200, history.status());
        assertEquals(1, history.data().size());
        assertEquals(bookingId, history.data().get(0).path("id").asLong());
        assertTrue(history.data().get(0).path("can_cancel").asBoolean());

        Session admin = login("admin", "admin123");
        Response adminDetail = get(admin.client(), "/api/bookings/" + bookingId);
        assertEquals(200, adminDetail.status());
        assertEquals(booking.path("booking_code").asText(), adminDetail.data().path("booking_code").asText());
        assertEquals(account.customerId(), adminDetail.data().path("customer_id").asLong());

        Response cancelled = mutate(account.session(), "POST", "/api/customer/bookings/" + bookingId + "/cancel", null);
        assertEquals(200, cancelled.status());
        assertEquals("CANCELLED", cancelled.data().path("status").asText());
        assertFalse(cancelled.data().path("can_cancel").asBoolean());
        assertEquals(2, count("SELECT COUNT(*) n FROM booking_items WHERE booking_id=? AND released_at IS NOT NULL", bookingId));
        assertNotEquals(bookingId, book(account.session(), court, Map.of()).path("id").asLong());
        assertEquals(2, get(account.session().client(), "/api/customer/bookings").data().size());
    }

    @Test
    void forgedRoleAndCustomerIdsCannotEscalatePrivilegesOrTakeOverProfiles() throws Exception {
        Account victim = register();
        Account attacker = register(Map.of("role", "ADMIN", "customer_id", victim.customerId()));
        assertNotEquals(victim.customerId(), attacker.customerId());
        assertEquals("CUSTOMER", attacker.session().user().path("role").asText());
        Court court = court("ACTIVE");
        JsonNode booking = book(attacker.session(), court, Map.of("customer_id", victim.customerId(), "role", "ADMIN"));
        assertEquals(attacker.customerId(), booking.path("customer_id").asLong());
        assertEquals(0, count("SELECT COUNT(*) n FROM bookings WHERE customer_id=?", victim.customerId()));

        Response edited = mutate(attacker.session(), "PUT", "/api/customer/me", Map.of(
            "full_name", "Tên của chủ phiên hiện tại", "phone", attacker.phone(), "email", "owner@example.com",
            "id", victim.customerId(), "customer_id", victim.customerId(), "role", "ADMIN", "username", victim.username()));
        assertEquals(200, edited.status());
        assertEquals("Tên của chủ phiên hiện tại", get(attacker.session().client(), "/api/customer/me").data().path("full_name").asText());
        assertEquals(victim.phone(), get(victim.session().client(), "/api/customer/me").data().path("phone").asText());
        Map<String, Object> storedUser = db.one("SELECT role,customer_id FROM app_users WHERE username=?", attacker.username());
        assertEquals("CUSTOMER", storedUser.get("role"));
        assertEquals(attacker.customerId(), ((Number) storedUser.get("customer_id")).longValue());
        assertEquals(attacker.username(), refresh(attacker.session().client()).user().path("username").asText());
        error(get(attacker.session().client(), "/api/customers"), 403);
    }

    @Test
    void customersCannotReadOrCancelOtherBookingsOrUseStaffApis() throws Exception {
        Account owner = register();
        Account outsider = register();
        long bookingId = book(owner.session(), court("ACTIVE"), Map.of()).path("id").asLong();
        error(get(outsider.session().client(), "/api/customer/bookings/" + bookingId), 404);
        error(mutate(outsider.session(), "POST", "/api/customer/bookings/" + bookingId + "/cancel", null), 404);
        Response history = get(outsider.session().client(), "/api/customer/bookings?customer_id=" + owner.customerId());
        assertEquals(200, history.status());
        assertEquals(0, history.data().size());

        for (String route : List.of("/api/config", "/api/courts", "/api/customers", "/api/bookings", "/api/dashboard", "/api/reports", "/api/bookings/" + bookingId))
            error(get(outsider.session().client(), route), 403);
        error(mutate(owner.session(), "POST", "/api/bookings/" + bookingId + "/pay", Map.of("method", "CASH")), 403);
        error(mutate(owner.session(), "POST", "/api/bookings/" + bookingId + "/complete", null), 403);
        assertEquals("CONFIRMED", service.booking(bookingId).get("status"));
        assertEquals(0, count("SELECT COUNT(*) n FROM payments WHERE booking_id=?", bookingId));
    }

    @Test
    void normalizedPathsCannotCrossTheCustomerAndStaffAuthorizationBoundary() throws Exception {
        Account customer = register();
        for (HttpClient client : List.of(customer.session().client(), client())) {
            for (String path : List.of("/api/customer/../customers", "/api/customer/%2e%2e/customers", "/api/customer/..;/reports")) {
                HttpResponse<String> response = client.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).timeout(Duration.ofSeconds(10)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
                assertTrue(Set.of(400, 401, 403, 404).contains(response.statusCode()), "Alternative paths must not expose staff APIs: " + path);
                assertFalse(response.body().contains("customer_phone"));
                assertFalse(response.body().contains("paid_revenue"));
            }
        }
    }

    @Test
    void publicScheduleRedactsBookingIdentityAndPrivateEndpointsRequireASession() throws Exception {
        Account owner = register();
        Court court = court("ACTIVE");
        long bookingId = book(owner.session(), court, Map.of()).path("id").asLong();
        Court maintenance = court("MAINTENANCE");
        Court inactive = court("INACTIVE");
        HttpClient anonymous = client();
        Response config = get(anonymous, "/api/customer/config");
        assertEquals(200, config.status());
        assertEquals(17, config.data().path("time_slots").size());
        Response courts = get(anonymous, "/api/customer/courts");
        assertEquals(200, courts.status());
        assertTrue(containsId(courts.data(), court.id()));
        assertTrue(containsId(courts.data(), maintenance.id()));
        assertFalse(containsId(courts.data(), inactive.id()));

        Response schedule = get(anonymous, "/api/customer/availability?date=" + court.date());
        assertEquals(200, schedule.status());
        assertNoFields(schedule.body(), "booking_id", "booking_code", "customer_id", "customer_name", "customer_phone", "full_name", "phone", "password_hash", "credential_stamp");
        JsonNode publicCourt = findId(schedule.data().path("courts"), court.id());
        assertFalse(findSlot(publicCourt.path("slots"), court.slots().get(12)).path("available").asBoolean());
        assertEquals("BOOKED", findSlot(publicCourt.path("slots"), court.slots().get(12)).path("reason").asText());
        assertFalse(containsId(schedule.data().path("courts"), inactive.id()));

        for (String route : List.of("/api/customer/me", "/api/customer/bookings", "/api/customer/bookings/" + bookingId))
            error(get(anonymous, route), 401);
        error(send(anonymous, "POST", "/api/auth/register", registration("user_" + tag(), phone(), PASSWORD, "Không được lưu"), null), 403);
    }

    @Test
    void duplicateRegistrationRollsBackBothTheCustomerAndTheUser() throws Exception {
        Account existing = register();
        HttpClient anonymous = client();
        Session pending = refresh(anonymous);
        String orphanName = "Không được tạo " + tag();
        String unusedPhone = phone();
        Response usernameConflict = mutate(pending, "POST", "/api/auth/register",
            registration(existing.username(), unusedPhone, PASSWORD, orphanName));
        error(usernameConflict, 409);
        assertEquals(0, count("SELECT COUNT(*) n FROM customers WHERE phone=? OR full_name=?", unusedPhone, orphanName));
        assertEquals(1, count("SELECT COUNT(*) n FROM app_users WHERE username=?", existing.username()));
        assertFalse(get(anonymous, "/api/auth/session").data().path("authenticated").asBoolean());

        String unusedUsername = "user_" + tag();
        Response phoneConflict = mutate(pending, "POST", "/api/auth/register",
            registration(unusedUsername, existing.phone(), PASSWORD, orphanName));
        error(phoneConflict, 409);
        assertEquals(0, count("SELECT COUNT(*) n FROM app_users WHERE username=?", unusedUsername));
        assertEquals(0, count("SELECT COUNT(*) n FROM customers WHERE full_name=?", orphanName));
        assertEquals(existing.phone(), get(existing.session().client(), "/api/customer/me").data().path("phone").asText());
    }

    @Test
    void passwordChangeChecksTheCurrentPasswordRotatesTheSessionAndRevokesOtherSessions() throws Exception {
        Account owner = register();
        Session otherDevice = login(owner.username(), PASSWORD);
        String oldSessionId = sessionId(owner.session().client());
        String oldHash = db.one("SELECT password_hash FROM app_users WHERE username=?", owner.username()).get("password_hash").toString();
        Response wrongCurrent = mutate(owner.session(), "PUT", "/api/customer/password",
            Map.of("current_password", "WrongPassword!", "new_password", "ChangedPassword123!"));
        assertTrue(Set.of(400, 401, 409).contains(wrongCurrent.status()));
        assertFalse(wrongCurrent.body().path("message").asText().isBlank());
        error(mutate(owner.session(), "PUT", "/api/customer/password", Map.of("current_password", PASSWORD, "new_password", "Ab1!xyz")), 400);
        error(mutate(owner.session(), "PUT", "/api/customer/password", Map.of("current_password", PASSWORD, "new_password", exact72BytePassword() + "b")), 400);
        assertEquals(oldHash, db.one("SELECT password_hash FROM app_users WHERE username=?", owner.username()).get("password_hash"));

        String replacement = "ChangedPassword123!";
        Response changed = mutate(owner.session(), "PUT", "/api/customer/password", Map.of("current_password", PASSWORD, "new_password", replacement));
        assertEquals(200, changed.status());
        assertFalse(changed.data().path("message").asText().isBlank());
        Session refreshed = refresh(owner.session().client());
        assertEquals("CUSTOMER", refreshed.user().path("role").asText());
        assertNotEquals(owner.session().csrf(), refreshed.csrf());
        assertNotEquals(oldSessionId, sessionId(refreshed.client()));
        error(send(refreshed.client(), "PUT", "/api/customer/me", profile("CSRF cũ", owner.phone()), owner.session().csrf()), 403);
        error(get(otherDevice.client(), "/api/customer/me"), 401);

        Session anonymous = refresh(client());
        error(mutate(anonymous, "POST", "/api/auth/login", Map.of("username", owner.username(), "password", PASSWORD)), 401);
        assertEquals(owner.customerId(), login(owner.username(), replacement).user().path("customer_id").asLong());
    }

    @Test
    void aCustomerCannotCancelPaidOrAlreadyStartedBookings() throws Exception {
        Account account = register();
        Court court = court("ACTIVE");
        long paidId = book(account.session(), court, Map.of()).path("id").asLong();
        service.pay(paidId, new Requests.Payment("CASH"));
        assertFalse(get(account.session().client(), "/api/customer/bookings/" + paidId).data().path("can_cancel").asBoolean());
        error(mutate(account.session(), "POST", "/api/customer/bookings/" + paidId + "/cancel", null), 409);

        // Seed a genuine past reservation without changing the system clock or weakening the booking procedure.
        long pastId = db.insert("INSERT INTO bookings(booking_code,customer_id,note) VALUES(?,?,?)", "PAST-" + tag(), account.customerId(), "Lịch sử kiểm thử");
        db.execute("INSERT INTO booking_items(booking_id,court_id,play_date,time_slot_id,unit_price) VALUES(?,?,?,?,?)",
            pastId, court.id(), BookingService.today().minusDays(1), court.slots().get(0), new BigDecimal("150000"));
        Response past = get(account.session().client(), "/api/customer/bookings/" + pastId);
        assertEquals(200, past.status());
        assertFalse(past.data().path("can_cancel").asBoolean());
        error(mutate(account.session(), "POST", "/api/customer/bookings/" + pastId + "/cancel", null), 409);
        assertEquals("CONFIRMED", service.booking(pastId).get("status"));
        assertEquals(1, count("SELECT COUNT(*) n FROM booking_items WHERE booking_id=? AND released_at IS NULL", pastId));
    }

    @Test
    void profilePhoneConflictsAndUtf8PasswordBoundariesDoNotCreateOrTakeOverAccounts() throws Exception {
        Account first = register();
        Account second = register();
        error(mutate(first.session(), "PUT", "/api/customer/me", profile("Không được đổi chủ", second.phone())), 409);
        assertEquals(first.phone(), get(first.session().client(), "/api/customer/me").data().path("phone").asText());
        assertEquals(second.phone(), get(second.session().client(), "/api/customer/me").data().path("phone").asText());

        String rejectedUsername = "user_" + tag();
        String rejectedPhone = phone();
        Session pending = refresh(client());
        error(mutate(pending, "POST", "/api/auth/register", registration(rejectedUsername, rejectedPhone, exact72BytePassword() + "b", "Mật khẩu quá dài")), 400);
        assertEquals(0, count("SELECT COUNT(*) n FROM app_users WHERE username=?", rejectedUsername));
        assertEquals(0, count("SELECT COUNT(*) n FROM customers WHERE phone=?", rejectedPhone));
        String acceptedUsername = "user_" + tag();
        Response accepted = mutate(pending, "POST", "/api/auth/register", registration(acceptedUsername, phone(), exact72BytePassword(), "Mật khẩu đúng 72 byte"));
        assertEquals(201, accepted.status());
        assertEquals("CUSTOMER", login(acceptedUsername, exact72BytePassword()).user().path("role").asText());
    }

    @Test
    void newPasswordsNeedUnicodeUppercaseDigitAndPunctuationOrSymbolWithoutRequiringLowercase() throws Exception {
        Account owner = register();
        String originalHash = db.one("SELECT password_hash FROM app_users WHERE username=?", owner.username()).get("password_hash").toString();
        Session pending = refresh(client());
        for (String rejected : List.of("password1!", "Password!!", "Password12", "Password1 ", "Ⅰpassword1!", "Password²!")) {
            String username = "user_" + tag();
            String phone = phone();
            error(mutate(pending, "POST", "/api/auth/register", registration(username, phone, rejected, "Không được tạo " + tag())), 400);
            assertEquals(0, count("SELECT COUNT(*) n FROM app_users WHERE username=?", username));
            assertEquals(0, count("SELECT COUNT(*) n FROM customers WHERE phone=?", phone));
            error(mutate(owner.session(), "PUT", "/api/customer/password", Map.of("current_password", PASSWORD, "new_password", rejected)), 400);
            assertEquals(originalHash, db.one("SELECT password_hash FROM app_users WHERE username=?", owner.username()).get("password_hash"));
        }

        Account uppercaseOnly = register("user_" + tag(), "ALLUPPER1!");
        assertEquals(uppercaseOnly.customerId(), login(uppercaseOnly.username(), "ALLUPPER1!").user().path("customer_id").asLong());
        // Arabic-Indic ١ is Nd; 😀 is So. Neither depends on an ASCII-only character class.
        Account unicodeCategories = register("user_" + tag(), "ĐẶTSÂN١😀");
        assertEquals(unicodeCategories.customerId(), login(unicodeCategories.username(), "ĐẶTSÂN١😀").user().path("customer_id").asLong());
        Response changed = mutate(owner.session(), "PUT", "/api/customer/password", Map.of("current_password", PASSWORD, "new_password", "ALLUPPER1!"));
        assertEquals(200, changed.status());
        assertEquals(owner.customerId(), login(owner.username(), "ALLUPPER1!").user().path("customer_id").asLong());
    }

    @Test
    void usernamesAllowOneCharacterVietnameseInternalSpacesAndFiftyCharacters() throws Exception {
        String singleCharacter = availableSingleCharacterUsername();
        Account single = register(singleCharacter, PASSWORD);
        assertEquals(1, single.username().length());
        assertEquals(single.customerId(), login(singleCharacter, PASSWORD).user().path("customer_id").asLong());

        String normalized = "Khách hàng " + tag();
        Account spaced = register(" \t" + normalized + "  ", PASSWORD);
        assertEquals(normalized, spaced.username());
        assertEquals(spaced.customerId(), login("  " + normalized + "\t", PASSWORD).user().path("customer_id").asLong());
        Session pending = refresh(client());
        String duplicatePhone = phone();
        error(mutate(pending, "POST", "/api/auth/register", registration("  " + normalized + " ", duplicatePhone, PASSWORD, "Không được nhân đôi")), 409);
        assertEquals(0, count("SELECT COUNT(*) n FROM customers WHERE phone=?", duplicatePhone));

        String alphabet = "ĂÂBCDĐEGHIKLMNOP";
        String suffix = tag().chars().mapToObj(c -> String.valueOf(alphabet.charAt(Character.digit(c, 16)))).collect(java.util.stream.Collectors.joining());
        String fiftyCharacters = "Đ".repeat(34) + suffix;
        assertEquals(50, fiftyCharacters.length());
        Account maximum = register(" \t" + fiftyCharacters + "\u2003", PASSWORD);
        assertEquals(fiftyCharacters, maximum.username());
        assertEquals(maximum.customerId(), login("\u2003" + fiftyCharacters + "  ", PASSWORD).user().path("customer_id").asLong());

        for (String rejected : List.of("", "   ", "\u2003", fiftyCharacters + "Đ")) {
            String unusedPhone = phone();
            error(mutate(pending, "POST", "/api/auth/register", registration(rejected, unusedPhone, PASSWORD, "Tên đăng nhập không hợp lệ")), 400);
            assertEquals(0, count("SELECT COUNT(*) n FROM customers WHERE phone=?", unusedPhone));
        }
    }

    @Test
    void existingWeakPasswordsStillLogInAndCanBeChangedToTheNewPolicy() throws Exception {
        String username = "legacy_" + tag();
        String phone = phone();
        long customerId = ((Number) service.createCustomer(new Requests.Customer("Khách cũ " + tag(), phone, null)).get("id")).longValue();
        db.insert("INSERT INTO app_users(username,password_hash,display_name,role,customer_id) VALUES(?,?,?,'CUSTOMER',?)",
            username, new BCryptPasswordEncoder().encode("weak"), "Tài khoản kiểm thử có sẵn", customerId);
        Session legacy = login(username, "weak");
        assertEquals(customerId, legacy.user().path("customer_id").asLong());
        assertEquals(200, mutate(legacy, "PUT", "/api/customer/password", Map.of("current_password", "weak", "new_password", PASSWORD)).status());
        assertEquals(customerId, login(username, PASSWORD).user().path("customer_id").asLong());
    }

    private Account register() throws Exception { return register(Map.of()); }
    private Account register(Map<String, Object> extras) throws Exception {
        return register("user_" + tag(), PASSWORD, extras);
    }
    private Account register(String username, String password) throws Exception { return register(username, password, Map.of()); }
    private Account register(String username, String password, Map<String, Object> extras) throws Exception {
        String phone = phone();
        Session pending = refresh(client());
        Map<String, Object> body = registration(username, phone, password, "Khách portal " + tag());
        body.putAll(extras);
        assertEquals(201, mutate(pending, "POST", "/api/auth/register", body).status());
        Session registered = refresh(pending.client());
        assertEquals("CUSTOMER", registered.user().path("role").asText());
        assertNotEquals(pending.csrf(), registered.csrf());
        assertNoFields(registered.user(), "password_hash", "credential_stamp");
        assertEquals(username.strip(), registered.user().path("username").asText());
        return new Account(registered, username.strip(), phone, registered.user().path("customer_id").asLong());
    }

    private Court court(String status) {
        String code = "C" + tag();
        long id = ((Number) service.createCourt(new Requests.Court(code, "Sân portal " + code, "Integration test", new BigDecimal("150000"), status)).get("id")).longValue();
        List<Long> slots = service.slots().stream().map(slot -> ((Number) slot.get("id")).longValue()).toList();
        return new Court(id, BookingService.today().plusDays(19), slots);
    }

    private JsonNode book(Session session, Court court, Map<String, Object> extras) throws Exception {
        Map<String, Object> input = new LinkedHashMap<>(Map.of("court_id", court.id(), "play_date", court.date().toString(),
            "slot_ids", List.of(court.slots().get(12), court.slots().get(13)), "note", "Khách tự đặt " + tag()));
        input.putAll(extras);
        Response response = mutate(session, "POST", "/api/customer/bookings", input);
        assertEquals(201, response.status());
        return response.data();
    }

    private Session login(String username, String password) throws Exception {
        Session pending = refresh(client());
        assertEquals(200, mutate(pending, "POST", "/api/auth/login", Map.of("username", username, "password", password)).status());
        return refresh(pending.client());
    }

    private Session refresh(HttpClient client) throws Exception {
        Response response = get(client, "/api/auth/session");
        assertEquals(200, response.status());
        String csrf = response.data().path("csrf_token").asText();
        assertFalse(csrf.isBlank());
        return new Session(client, csrf, response.data().path("user"));
    }

    private static Map<String, Object> registration(String username, String phone, String password, String name) {
        return new LinkedHashMap<>(Map.of("username", username, "password", password, "full_name", name, "phone", phone, "email", "portal." + tag() + "@example.com"));
    }
    private static Map<String, Object> profile(String name, String phone) { return Map.of("full_name", name, "phone", phone, "email", "profile@example.com"); }
    private static HttpClient client() { return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).connectTimeout(Duration.ofSeconds(5)).build(); }
    private Response get(HttpClient client, String path) throws Exception { return send(client, "GET", path, null, null); }
    private Response mutate(Session session, String method, String path, Object body) throws Exception { return send(session.client(), method, path, body, session.csrf()); }
    private Response send(HttpClient client, String method, String path, Object body, String csrf) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).timeout(Duration.ofSeconds(10));
        if (csrf != null) request.header("X-CSRF-TOKEN", csrf);
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        HttpResponse<String> response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
        return new Response(response.statusCode(), json.readTree(response.body()));
    }

    private static void error(Response response, int status) { assertEquals(status, response.status()); assertFalse(response.body().path("message").asText().isBlank()); }
    private static void assertNoFields(JsonNode body, String... names) { for (String name : names) assertNull(body.findValue(name), "Response must not expose " + name); }
    private static boolean containsId(JsonNode rows, long id) { for (JsonNode row : rows) if (row.path("id").asLong() == id) return true; return false; }
    private static JsonNode findId(JsonNode rows, long id) { for (JsonNode row : rows) if (row.path("id").asLong() == id) return row; throw new AssertionError("Missing expected court"); }
    private static JsonNode findSlot(JsonNode rows, long id) { for (JsonNode row : rows) if (row.path("time_slot_id").asLong() == id) return row; throw new AssertionError("Missing expected slot"); }
    private static String sessionId(HttpClient client) { return ((CookieManager) client.cookieHandler().orElseThrow()).getCookieStore().getCookies().stream().filter(cookie -> cookie.getName().equals("JSESSIONID")).findFirst().orElseThrow().getValue(); }
    private long count(String sql, Object... args) { return ((Number) db.one(sql, args).get("n")).longValue(); }
    private static String tag() { return UUID.randomUUID().toString().replace("-", "").substring(0, 16); }
    private static String exact72BytePassword() { return "A1!" + "é".repeat(34) + "b"; }
    private String availableSingleCharacterUsername() {
        // A large CJK pool stays repeatable even with accent-insensitive MySQL collation.
        int start = ThreadLocalRandom.current().nextInt(20000);
        for (int i = 0; i < 512; i++) {
            String candidate = String.valueOf((char) (0x4E00 + (start + i) % 20000));
            if (db.rows("SELECT id FROM app_users WHERE username=?", candidate).isEmpty()) return candidate;
        }
        throw new AssertionError("No unused one-character Unicode username in the dedicated integration database");
    }
    private String phone() { String value; do { value = "0" + String.format(Locale.ROOT, "%09d", ThreadLocalRandom.current().nextLong(1_000_000_000L)); } while (!db.rows("SELECT id FROM customers WHERE phone=?", value).isEmpty()); return value; }
}
