package vn.edu.pickleball;

import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import java.sql.SQLException;
import java.util.Map;

@RestControllerAdvice
public class ApiErrors {
    private ResponseEntity<Map<String,String>> response(int status,String message) { return ResponseEntity.status(status).body(Map.of("message",message)); }
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String,String>> business(ApiException e) { return response(e.status(),e.getMessage()); }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String,String>> invalid(MethodArgumentNotValidException e) {
        var error=e.getBindingResult().getFieldErrors().get(0);
        return response(400,"Dữ liệu không hợp lệ: " + error.getField() + ". " + error.getDefaultMessage());
    }
    @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class,MissingServletRequestParameterException.class})
    public ResponseEntity<Map<String,String>> malformed(Exception e) { return response(400,"Dữ liệu hoặc định dạng ngày không hợp lệ."); }
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String,String>> sql(DataAccessException e) {
        Throwable cause=e.getMostSpecificCause();
        if (cause instanceof SQLException sql) {
            if ("45000".equals(sql.getSQLState())) {
                String code=sql.getMessage().split(":",2)[0];
                String message=switch(code) {
                    case "BOOKING_CONFLICT" -> "Khung giờ vừa được đặt bởi người khác. Hãy tải lại lịch và chọn khung giờ khác.";
                    case "INVALID_SLOTS" -> "Danh sách khung giờ không hợp lệ hoặc bị trùng.";
                    case "NON_CONTIGUOUS_SLOTS" -> "Các khung giờ trong một đơn phải liên tiếp nhau.";
                    case "COURT_NOT_FOUND" -> "Không tìm thấy sân.";
                    case "COURT_UNAVAILABLE" -> "Sân đang bảo trì hoặc ngừng hoạt động.";
                    case "CUSTOMER_NOT_FOUND" -> "Không tìm thấy khách hàng.";
                    case "INVALID_DATE" -> "Chỉ đặt sân từ hôm nay đến 30 ngày tiếp theo.";
                    case "BOOKING_ALREADY_STARTED" -> "Đơn đã bắt đầu giờ chơi, bạn không thể tự hủy. Vui lòng liên hệ quản lý.";
                    case "SLOT_IN_PAST" -> "Khung giờ đã bắt đầu. Vui lòng chọn giờ khác.";
                    case "BOOKING_NOT_FOUND" -> "Không tìm thấy đơn đặt sân.";
                    case "PAID_BOOKING_CANNOT_CANCEL" -> "Đơn đã thanh toán không thể hủy. Bản này chưa hỗ trợ hoàn tiền.";
                    case "ALREADY_PAID" -> "Đơn này đã được thanh toán.";
                    case "INVALID_PAYMENT_METHOD" -> "Chọn thanh toán bằng tiền mặt hoặc chuyển khoản.";
                    case "INVALID_PAYMENT_AMOUNT" -> "Số tiền phải bằng toàn bộ giá trị đơn.";
                    case "PAYMENT_REQUIRED" -> "Cần thanh toán đầy đủ trước khi hoàn tất đơn.";
                    case "BOOKING_NOT_FINISHED" -> "Chỉ hoàn tất đơn sau khi khung giờ cuối đã kết thúc.";
                    case "BOOKING_IMMUTABLE","PAYMENT_IMMUTABLE" -> "Lịch sử đặt sân và thanh toán không được thay đổi.";
                    default -> "Thao tác không phù hợp với trạng thái hiện tại của đơn.";
                };
                int status=code.endsWith("NOT_FOUND") ? 404 : 409;
                return response(status,message);
            }
            if (sql.getErrorCode()==1062) return response(409,"Dữ liệu đã tồn tại hoặc khung giờ vừa được đặt. Hãy tải lại và chọn chỗ khác.");
            if (sql.getErrorCode()==1452 || sql.getErrorCode()==3819 || sql.getErrorCode()==1406) return response(400,"Dữ liệu không thỏa mãn ràng buộc cơ sở dữ liệu.");
            if (sql.getErrorCode()==1213 || sql.getErrorCode()==1205) return response(409,"Có thao tác đồng thời. Hãy thử lại.");
        }
        return response(503,"Chưa kết nối được cơ sở dữ liệu. Kiểm tra MySQL và cấu hình kết nối.");
    }
}
