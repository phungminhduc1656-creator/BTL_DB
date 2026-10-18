package vn.edu.pickleball;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** DELIMITER thuộc mysql client, vì vậy JDBC cần tách script trước khi gửi SQL. */
public final class SqlInstaller {
    private SqlInstaller() {}
    public static List<String> statements(Path file) throws IOException {
        List<String> statements=new ArrayList<>(); String delimiter=";"; StringBuilder buffer=new StringBuilder();
        for (String raw:Files.readAllLines(file,StandardCharsets.UTF_8)) {
            String line=raw.replace("\uFEFF",""); String trimmed=line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("--")) continue;
            if (trimmed.toUpperCase(Locale.ROOT).startsWith("DELIMITER ")) {
                if (!buffer.toString().isBlank()) throw new IOException("Unexpected SQL before DELIMITER in "+file);
                delimiter=trimmed.substring(10).trim(); continue;
            }
            buffer.append(line).append('\n'); String text=buffer.toString().trim();
            if (text.endsWith(delimiter)) {
                statements.add(text.substring(0,text.length()-delimiter.length())); buffer.setLength(0);
            }
        }
        if (!buffer.toString().isBlank()) throw new IOException("Unterminated SQL in "+file);
        return statements;
    }
    public static void install(Database db) throws IOException {
        for (String file:List.of("01_schema.sql","02_routines.sql","03_seed.sql","05_customer_portal.sql","06_customer_account_rules.sql")) {
            for (String sql:statements(Path.of("database",file))) db.executeStatement(sql);
        }
    }
}
