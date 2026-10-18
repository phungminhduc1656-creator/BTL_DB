package vn.edu.pickleball;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class Requests {
    private Requests() {}
    public record Login(@NotBlank @Size(max=50) String username, @NotBlank @Size(max=100) String password) {
        public Login {
            if (username!=null) username=username.strip();
        }
    }
    public record Customer(
        @NotBlank @Size(max=100) String full_name,
        @NotBlank @Pattern(regexp="^(0[0-9]{9,10}|\\+84[0-9]{9,10})$", message="Số điện thoại phải có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx.") String phone,
        @Email @Size(max=150) String email) {}
    public record Court(
        @NotBlank @Size(max=20) @Pattern(regexp="[A-Za-z0-9_-]+", message="Mã sân chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới.") String code,
        @NotBlank @Size(max=100) String name,
        @Size(max=500) String description,
        @NotNull @DecimalMin("1000") @DecimalMax("10000000") @Digits(integer=8, fraction=0) BigDecimal hourly_price,
        @NotBlank @Pattern(regexp="ACTIVE|MAINTENANCE|INACTIVE") String status) {}
    public record Booking(
        @NotNull @Positive Long customer_id, @NotNull @Positive Long court_id,
        @NotNull LocalDate play_date, @NotEmpty @Size(max=17) List<@NotNull @Positive Long> slot_ids,
        @Size(max=500) String note) {}
    public record Payment(@NotBlank @Pattern(regexp="CASH|TRANSFER",message="Chọn tiền mặt hoặc chuyển khoản.") String method) {}
}
