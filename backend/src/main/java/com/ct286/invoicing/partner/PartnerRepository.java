package com.ct286.invoicing.partner;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
class PartnerRepository {
    private final JdbcTemplate jdbc;
    PartnerRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    private static final String SELECT = """
            SELECT p.id, p.name, p.is_customer, p.vat, p.email, p.phone, p.address, p.city, p.active,
                   CASE WHEN EXISTS (SELECT 1 FROM dbo.Journal_Entry e WHERE e.partner_id = p.id)
                        THEN 1 ELSE 0 END AS used_in_transactions
            FROM dbo.Partner p
            """;
    private final RowMapper<PartnerDto> mapper = (rs, row) -> new PartnerDto(rs.getInt("id"), rs.getString("name"),
            rs.getBoolean("is_customer") ? "customer" : "supplier", rs.getString("vat"), rs.getString("email"),
            rs.getString("phone"), rs.getString("address"), rs.getString("city"), rs.getBoolean("active"),
            rs.getBoolean("used_in_transactions"));
    List<PartnerDto> list(String type, Boolean active) {
        String sql = SELECT + " WHERE 1=1";
        if ("customer".equals(type)) sql += " AND p.is_customer=1";
        if ("supplier".equals(type)) sql += " AND p.is_supplier=1";
        if (active != null) sql += active ? " AND p.active=1" : " AND p.active=0";
        return jdbc.query(sql + " ORDER BY p.name, p.id", mapper);
    }
    Optional<PartnerDto> find(int id) {
        return jdbc.query(SELECT + " WHERE p.id = ?", mapper, id).stream().findFirst();
    }
    boolean nameExists(String name, String type, int exceptId) {
        String flag = "customer".equals(type) ? "is_customer" : "is_supplier";
        return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Partner WHERE LOWER(name)=LOWER(?) AND " + flag + "=1 AND id<>?",
                Integer.class, name, exceptId) > 0;
    }
    int insert(PartnerRequest p) {
        return jdbc.queryForObject("""
                INSERT INTO dbo.Partner (name, vat, email, phone, address, city, is_customer, is_supplier)
                OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, Integer.class, p.name(), p.vat(), p.email(), p.phone(), p.address(), p.city(),
                p.partnerType().equals("customer"), p.partnerType().equals("supplier"));
    }
    void update(int id, PartnerRequest p) {
        jdbc.update("""
                UPDATE dbo.Partner SET name=?, vat=?, email=?, phone=?, address=?, city=?, is_customer=?, is_supplier=? WHERE id=?
                """, p.name(), p.vat(), p.email(), p.phone(), p.address(), p.city(),
                p.partnerType().equals("customer"), p.partnerType().equals("supplier"), id);
    }
    void setActive(int id, boolean active) { jdbc.update("UPDATE dbo.Partner SET active=? WHERE id=?", active, id); }
    void delete(int id) { jdbc.update("DELETE FROM dbo.Partner WHERE id=?", id); }
}
