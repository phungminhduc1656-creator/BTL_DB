package vn.edu.pickleball;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.*;
import java.util.*;

/** SQL luôn dùng tham số, không nối dữ liệu người dùng vào câu truy vấn. */
@Repository
public class Database {
    private final JdbcTemplate jdbc;
    public Database(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Map<String, Object>> rows(String sql, Object... args) {
        return jdbc.query(sql, (rs, index) -> {
            Map<String,Object> row = new LinkedHashMap<>();
            ResultSetMetaData meta = rs.getMetaData();
            for (int i = 1; i <= meta.getColumnCount(); i++) {
                Object value = rs.getObject(i);
                if (value instanceof Timestamp v) value = v.toLocalDateTime().toString();
                else if (value instanceof java.sql.Date v) value = v.toLocalDate().toString();
                else if (value instanceof Time v) value = v.toLocalTime().toString();
                else if (value instanceof java.time.LocalDateTime v) value = v.toString();
                else if (value instanceof java.time.LocalDate v) value = v.toString();
                row.put(meta.getColumnLabel(i), value);
            }
            return row;
        }, args);
    }
    public Map<String,Object> one(String sql, Object... args) {
        List<Map<String,Object>> result = rows(sql, args);
        if (result.isEmpty()) throw new ApiException(404, "Không tìm thấy dữ liệu.");
        return result.get(0);
    }
    public int execute(String sql, Object... args) { return jdbc.update(sql, args); }
    public void executeStatement(String sql) { jdbc.execute(sql); }
    public long insert(String sql, Object... args) {
        org.springframework.jdbc.support.GeneratedKeyHolder key = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < args.length; i++) statement.setObject(i + 1, args[i]);
            return statement;
        }, key);
        return Objects.requireNonNull(key.getKey()).longValue();
    }
    /** Stored procedures tự quản lý giao dịch; không bọc bằng @Transactional. */
    public Long call(String sql, Object... args) {
        return jdbc.execute((java.sql.Connection connection) -> {
            Long id = null;
            try (CallableStatement statement = connection.prepareCall(sql)) {
                for (int i = 0; i < args.length; i++) statement.setObject(i + 1, args[i]);
                boolean result = statement.execute();
                while (true) {
                    if (result) {
                        try (ResultSet rs = statement.getResultSet()) {
                            if (rs.next()) id = rs.getLong(1);
                        }
                    } else if (statement.getUpdateCount() == -1) break;
                    result = statement.getMoreResults();
                }
            }
            return id;
        });
    }
}
