package com.ct286.invoicing.user;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
class UserRepository {
    private final JdbcTemplate jdbc;
    private static final String COLUMNS = "id, user_name, full_name, email, phone, password_hash, role, active";
    private final RowMapper<UserData> mapper = (rs, row) -> new UserData(rs.getInt("id"), rs.getString("user_name"),
            rs.getString("full_name"), rs.getString("email"), rs.getString("phone"), rs.getString("password_hash"),
            rs.getString("role"), rs.getBoolean("active"));

    UserRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    Optional<UserData> byId(int id) { return jdbc.query("SELECT " + COLUMNS + " FROM dbo.App_User WHERE id = ?", mapper, id).stream().findFirst(); }
    Optional<UserData> byName(String name) { return jdbc.query("SELECT " + COLUMNS + " FROM dbo.App_User WHERE LOWER(user_name) = LOWER(?)", mapper, name).stream().findFirst(); }
    List<UserData> byEmail(String email) { return jdbc.query("SELECT " + COLUMNS + " FROM dbo.App_User WHERE LOWER(email) = LOWER(?)", mapper, email); }
    List<UserData> all() { return jdbc.query("SELECT " + COLUMNS + " FROM dbo.App_User ORDER BY id", mapper); }
    void insert(String name, String fullName, String email, String hash, String role) {
        jdbc.update("INSERT INTO dbo.App_User (user_name, full_name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?, 1)", name, fullName, email, hash, role);
    }
    void setActive(int id, boolean active) { jdbc.update("UPDATE dbo.App_User SET active = ? WHERE id = ?", active, id); }
    void updateDetails(int id, String fullName, String email) { jdbc.update("UPDATE dbo.App_User SET full_name=?, email=? WHERE id=?", fullName, email, id); }
    void setPassword(int id, String hash) { jdbc.update("UPDATE dbo.App_User SET password_hash = ? WHERE id = ?", hash, id); }
}
