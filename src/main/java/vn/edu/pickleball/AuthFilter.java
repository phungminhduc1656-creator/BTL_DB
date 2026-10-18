package vn.edu.pickleball;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Shared login; strict server-side separation between admin and customer APIs. */
@Component
public class AuthFilter extends OncePerRequestFilter {
    private final ObjectMapper json;
    private final Database db;
    public AuthFilter(ObjectMapper json,Database db) { this.json=json; this.db=db; }
    @Override
    protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws IOException,ServletException {
        response.setHeader("X-Content-Type-Options","nosniff");
        response.setHeader("X-Frame-Options","SAMEORIGIN");
        response.setHeader("Referrer-Policy","same-origin");
        response.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
        String path=request.getServletPath();
        String rawPath=request.getRequestURI();
        if ((path.startsWith("/api/") || rawPath.startsWith("/api/")) && (rawPath.contains("%") || rawPath.contains(";") || rawPath.contains("//") || rawPath.contains("\\") || Arrays.stream(rawPath.split("/")).anyMatch(s -> s.equals(".") || s.equals("..")))) {
            reject(response,400,"Đường dẫn API không hợp lệ."); return;
        }
        if (!path.startsWith("/api/")) { chain.doFilter(request,response); return; }
        response.setHeader("Cache-Control","no-store");
        HttpSession session=request.getSession(false);
        Map<String,Object> user=null;
        if (session!=null && session.getAttribute("user") instanceof Map<?,?> stored) {
            try {
                List<Map<String,Object>> rows=db.rows("SELECT id,username,password_hash,display_name,role,customer_id FROM app_users WHERE id=?",stored.get("id"));
                if (rows.isEmpty() || !Objects.equals(session.getAttribute("credential_stamp"),rows.get(0).get("password_hash"))) {
                    session.invalidate(); session=null;
                } else {
                    user=SessionAuth.publicUser(rows.get(0));
                    session.setAttribute("user",user);
                }
            } catch (DataAccessException e) { reject(response,503,"Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại sau."); return; }
        }
        boolean read=request.getMethod().equals("GET") || request.getMethod().equals("HEAD");
        boolean publicAuth=Set.of("/api/auth/session","/api/auth/login","/api/auth/register").contains(path);
        boolean publicBrowse=read && Set.of("/api/customer/config","/api/customer/courts","/api/customer/availability").contains(path);
        if (!publicAuth && !publicBrowse) {
            if (user==null) { reject(response,401,"Vui lòng đăng nhập để tiếp tục."); return; }
            if (!path.equals("/api/auth/logout")) {
                boolean customerApi=path.startsWith("/api/customer/");
                String needed=customerApi ? "CUSTOMER" : "ADMIN";
                if (!needed.equals(user.get("role"))) { reject(response,403,customerApi ? "Chức năng này dành cho tài khoản khách hàng." : "Bạn không có quyền truy cập chức năng quản lý."); return; }
            }
        }
        if (!read) {
            String expected=session==null ? null : (String) session.getAttribute("csrf_token");
            String actual=request.getHeader("X-CSRF-TOKEN");
            if (expected==null || actual==null || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),actual.getBytes(StandardCharsets.UTF_8))) {
                reject(response,403,"Phiên không hợp lệ. Tải lại trang rồi thử lại."); return;
            }
        }
        chain.doFilter(request,response);
    }
    private void reject(HttpServletResponse response,int status,String message) throws IOException {
        response.setStatus(status); response.setContentType("application/json;charset=UTF-8");
        json.writeValue(response.getOutputStream(),Map.of("message",message));
    }
}
