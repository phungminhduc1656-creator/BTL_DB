package vn.edu.pickleball;

import jakarta.servlet.http.*;
import java.util.*;

/** Shared session helpers. Only the public user fields are returned to the browser. */
public final class SessionAuth {
    private SessionAuth() {}
    public static String token(HttpSession session) {
        if (session.getAttribute("csrf_token") == null) session.setAttribute("csrf_token",UUID.randomUUID().toString());
        return (String) session.getAttribute("csrf_token");
    }
    public static Map<String,Object> publicUser(Map<String,Object> row) {
        Map<String,Object> user=new LinkedHashMap<>();
        for (String key:List.of("id","username","display_name","role","customer_id")) user.put(key,row.get(key));
        return user;
    }
    public static Map<String,Object> establish(HttpServletRequest request,Map<String,Object> row) {
        HttpSession old=request.getSession(false);
        if (old!=null) old.invalidate();
        HttpSession session=request.getSession(true);
        Map<String,Object> user=publicUser(row);
        session.setAttribute("user",user);
        // Kept exclusively on the server: changing the hash revokes other sessions.
        session.setAttribute("credential_stamp",row.get("password_hash"));
        token(session);
        return user;
    }
    @SuppressWarnings("unchecked")
    public static Map<String,Object> user(HttpServletRequest request) {
        HttpSession session=request.getSession(false);
        if (session==null || !(session.getAttribute("user") instanceof Map)) throw new ApiException(401,"Vui lòng đăng nhập để tiếp tục.");
        return (Map<String,Object>) session.getAttribute("user");
    }
    public static long customerId(HttpServletRequest request) {
        Map<String,Object> user=user(request);
        if (!"CUSTOMER".equals(user.get("role")) || !(user.get("customer_id") instanceof Number id)) throw new ApiException(403,"Chức năng này dành cho tài khoản khách hàng.");
        return id.longValue();
    }
}
