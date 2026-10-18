package vn.edu.pickleball.customer;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import vn.edu.pickleball.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class CustomerAccounts {
    private static final Pattern UPPERCASE=Pattern.compile("\\p{Lu}");
    private static final Pattern DIGIT=Pattern.compile("\\p{Nd}");
    private static final Pattern SPECIAL=Pattern.compile("[\\p{P}\\p{S}]");
    private final Database db;
    private final BCryptPasswordEncoder encoder=new BCryptPasswordEncoder();
    public CustomerAccounts(Database db) { this.db=db; }
    private static String clean(String text) { return text==null || text.isBlank() ? null : text.trim(); }
    public static boolean passwordFits(String password) { return password!=null && password.getBytes(StandardCharsets.UTF_8).length<=72; }
    private static void validateName(String name) {
        if (name.trim().length()<2) throw new ApiException(400,"Họ tên cần ít nhất 2 ký tự, không tính khoảng trắng đầu và cuối.");
    }
    private static void validatePassword(String password) {
        if (password==null || password.isBlank() || password.length()<8 || !passwordFits(password)) throw new ApiException(400,"Mật khẩu cần ít nhất 8 ký tự và không quá 72 byte UTF-8.");
        if (!UPPERCASE.matcher(password).find() || !DIGIT.matcher(password).find() || !SPECIAL.matcher(password).find()) {
            throw new ApiException(400,"Mật khẩu phải có ít nhất một chữ hoa, một chữ số và một ký tự đặc biệt (ví dụ !, @, #).");
        }
    }
    @Transactional
    public Map<String,Object> register(CustomerRequests.Register input) {
        validateName(input.full_name()); validatePassword(input.password());
        String username=input.username().strip();
        if (username.isEmpty() || username.length()>50) throw new ApiException(400,"Tên đăng nhập không được để trống và tối đa 50 ký tự.");
        if (!db.rows("SELECT id FROM app_users WHERE username=?",username).isEmpty()) throw new ApiException(409,"Tên đăng nhập đã được sử dụng. Hãy chọn tên khác.");
        if (!db.rows("SELECT id FROM customers WHERE phone=?",input.phone()).isEmpty()) throw new ApiException(409,"Số điện thoại đã có trong hệ thống. Vui lòng dùng số khác hoặc liên hệ quản lý để hỗ trợ.");
        long customerId=db.insert("INSERT INTO customers(full_name,phone,email) VALUES(?,?,?)",input.full_name().trim(),input.phone(),clean(input.email()));
        long userId=db.insert("INSERT INTO app_users(username,password_hash,display_name,role,customer_id) VALUES(?,?,?,'CUSTOMER',?)",username,encoder.encode(input.password()),input.full_name().trim(),customerId);
        return account(userId);
    }
    public Map<String,Object> account(long id) {
        return db.one("SELECT id,username,password_hash,display_name,role,customer_id FROM app_users WHERE id=?",id);
    }
    public Map<String,Object> profile(long customerId) {
        return db.one("SELECT c.id,c.full_name,c.phone,c.email,u.username FROM customers c JOIN app_users u ON u.customer_id=c.id AND u.role='CUSTOMER' WHERE c.id=?",customerId);
    }
    @Transactional
    public Map<String,Object> updateProfile(long customerId,CustomerRequests.Profile input) {
        validateName(input.full_name());
        db.one("SELECT id FROM customers WHERE id=? FOR UPDATE",customerId);
        if (!db.rows("SELECT id FROM customers WHERE phone=? AND id<>?",input.phone(),customerId).isEmpty()) throw new ApiException(409,"Số điện thoại đã được khách hàng khác sử dụng.");
        db.execute("UPDATE customers SET full_name=?,phone=?,email=? WHERE id=?",input.full_name().trim(),input.phone(),clean(input.email()),customerId);
        db.execute("UPDATE app_users SET display_name=? WHERE customer_id=? AND role='CUSTOMER'",input.full_name().trim(),customerId);
        return profile(customerId);
    }
    @Transactional
    public Map<String,Object> changePassword(long userId,long customerId,CustomerRequests.Password input) {
        validatePassword(input.new_password());
        Map<String,Object> row=db.one("SELECT id,username,password_hash,display_name,role,customer_id FROM app_users WHERE id=? AND customer_id=? AND role='CUSTOMER' FOR UPDATE",userId,customerId);
        if (!passwordFits(input.current_password()) || !encoder.matches(input.current_password(),row.get("password_hash").toString())) throw new ApiException(400,"Mật khẩu hiện tại không đúng.");
        if (encoder.matches(input.new_password(),row.get("password_hash").toString())) throw new ApiException(400,"Hãy chọn mật khẩu mới khác mật khẩu hiện tại.");
        String hash=encoder.encode(input.new_password());
        db.execute("UPDATE app_users SET password_hash=? WHERE id=?",hash,userId);
        row.put("password_hash",hash);
        return row;
    }
}
