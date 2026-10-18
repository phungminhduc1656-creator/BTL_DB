package vn.edu.pickleball;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import vn.edu.pickleball.customer.*;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final Database db;
    private final CustomerAccounts accounts;
    private final BCryptPasswordEncoder encoder=new BCryptPasswordEncoder();
    // A real comparison even for an unknown username reduces login timing differences.
    private final String dummyHash=encoder.encode(UUID.randomUUID().toString());
    public AuthController(Database db,CustomerAccounts accounts) { this.db=db; this.accounts=accounts; }
    @GetMapping("/session")
    public Map<String,Object> session(HttpServletRequest request) {
        HttpSession session=request.getSession(true);
        Map<String,Object> data=new LinkedHashMap<>();
        data.put("authenticated",session.getAttribute("user")!=null);
        data.put("user",session.getAttribute("user"));
        data.put("csrf_token",SessionAuth.token(session));
        return Map.of("data",data);
    }
    @PostMapping("/login")
    public Map<String,Object> login(@Valid @RequestBody Requests.Login input,HttpServletRequest request) {
        HttpSession old=request.getSession(true);
        Long blocked=(Long) old.getAttribute("blocked_until");
        if (blocked!=null && blocked>System.currentTimeMillis()) throw new ApiException(429,"Bạn đã thử quá nhiều lần. Chờ một phút rồi thử lại.");
        List<Map<String,Object>> users=db.rows("SELECT id,username,password_hash,display_name,role,customer_id FROM app_users WHERE username=?",input.username().strip());
        String hash=users.isEmpty() ? dummyHash : users.get(0).get("password_hash").toString();
        boolean matches=CustomerAccounts.passwordFits(input.password()) && encoder.matches(input.password(),hash);
        if (users.isEmpty() || !matches) {
            Integer failures=(Integer) old.getAttribute("login_failures");
            int count=failures==null ? 1 : failures+1;
            old.setAttribute("login_failures",count);
            if (count>=5) { old.setAttribute("blocked_until",System.currentTimeMillis()+60_000); old.setAttribute("login_failures",0); }
            throw new ApiException(401,"Tên đăng nhập hoặc mật khẩu không đúng.");
        }
        return Map.of("data",SessionAuth.establish(request,users.get(0)));
    }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> register(@Valid @RequestBody CustomerRequests.Register input,HttpServletRequest request) {
        return Map.of("data",SessionAuth.establish(request,accounts.register(input)));
    }
    @PostMapping("/logout")
    public Map<String,Object> logout(HttpServletRequest request) {
        HttpSession session=request.getSession(false); if (session!=null) session.invalidate();
        return Map.of("data",Map.of("message","Đã đăng xuất."));
    }
}
