package vn.edu.pickleball.customer;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

/** Customer requests deliberately have no role, customer_id or payment amount. */
public final class CustomerRequests {
    private CustomerRequests() {}
    public record Register(
        @NotBlank(message="Tên đăng nhập không được để trống.") @Size(max=50,message="Tên đăng nhập tối đa 50 ký tự.") String username,
        @NotBlank @Size(min=8,max=72,message="Mật khẩu cần từ 8 đến 72 ký tự, tối đa 72 byte UTF-8.") String password,
        @NotBlank @Size(min=2,max=100) String full_name,
        @NotBlank @Pattern(regexp="^(0[0-9]{9,10}|\\+84[0-9]{9,10})$",message="Số điện thoại phải có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx.") String phone,
        @Email @Size(max=150) String email) {
        public Register {
            if (username!=null) username=username.strip();
        }
    }
    public record Profile(
        @NotBlank @Size(min=2,max=100) String full_name,
        @NotBlank @Pattern(regexp="^(0[0-9]{9,10}|\\+84[0-9]{9,10})$",message="Số điện thoại phải có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx.") String phone,
        @Email @Size(max=150) String email) {}
    public record Password(
        @NotBlank @Size(max=100) String current_password,
        @NotBlank @Size(min=8,max=72,message="Mật khẩu cần từ 8 đến 72 ký tự, tối đa 72 byte UTF-8.") String new_password) {}
    public record Booking(
        @NotNull @Positive Long court_id,
        @NotNull LocalDate play_date,
        @NotEmpty @Size(max=17) List<@NotNull @Positive Long> slot_ids,
        @Size(max=500) String note) {}
}
