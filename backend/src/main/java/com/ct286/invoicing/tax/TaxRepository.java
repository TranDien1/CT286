package com.ct286.invoicing.tax;

import com.ct286.invoicing.accounting.AccountDto;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
class TaxRepository {
    private final JdbcTemplate jdbc;
    TaxRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final String SELECT = """
            SELECT t.id, t.name, t.amount, t.type_tax_use,
                   a.id AS account_id, a.code AS account_code, a.name AS account_name,
                   a.account_type, a.reconcile,
                   CASE WHEN EXISTS (SELECT 1 FROM dbo.Journal_Item i
                       WHERE i.tax_id = t.id OR i.tax_line_id = t.id) THEN 1 ELSE 0 END AS used_in_transactions,
                   CASE WHEN EXISTS (SELECT 1 FROM dbo.Product p
                       WHERE p.sale_tax_id = t.id OR p.purchase_tax_id = t.id) THEN 1 ELSE 0 END AS default_for_product
            FROM dbo.Tax t LEFT JOIN dbo.Account a ON a.id = t.account_id
            """;
    private final RowMapper<TaxDto> mapper = (rs, row) -> {
        int accountId = rs.getInt("account_id");
        AccountDto account = rs.wasNull() ? null : new AccountDto(accountId, rs.getString("account_code"),
                rs.getString("account_name"), rs.getString("account_type"), rs.getBoolean("reconcile"));
        return new TaxDto(rs.getInt("id"), rs.getString("name"), rs.getBigDecimal("amount"),
                rs.getString("type_tax_use"), account, rs.getBoolean("used_in_transactions"),
                rs.getBoolean("default_for_product"));
    };

    List<TaxDto> list(String use) {
        return use == null ? jdbc.query(SELECT + " ORDER BY t.name, t.id", mapper)
                : jdbc.query(SELECT + " WHERE t.type_tax_use = ? ORDER BY t.name, t.id", mapper, use);
    }
    Optional<TaxDto> find(int id) {
        return jdbc.query(SELECT + " WHERE t.id = ?", mapper, id).stream().findFirst();
    }
    boolean nameExists(String name, int exceptId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Tax WHERE LOWER(name) = LOWER(?) AND id <> ?",
                Integer.class, name, exceptId) > 0;
    }
    boolean accountExists(int id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Account WHERE id = ?", Integer.class, id) > 0;
    }
    boolean incompatibleProductDefault(int id, String use) {
        return jdbc.queryForObject("""
                SELECT COUNT(*) FROM dbo.Product
                WHERE (sale_tax_id = ? AND ? <> 'sale') OR (purchase_tax_id = ? AND ? <> 'purchase')
                """, Integer.class, id, use, id, use) > 0;
    }
    int insert(TaxRequest request) {
        return jdbc.queryForObject("INSERT INTO dbo.Tax (name, amount, type_tax_use, account_id) OUTPUT INSERTED.id VALUES (?, ?, ?, ?)",
                Integer.class, request.name(), request.amount(), request.typeTaxUse(), request.accountId());
    }
    void update(int id, TaxRequest request) {
        jdbc.update("UPDATE dbo.Tax SET name = ?, amount = ?, type_tax_use = ?, account_id = ? WHERE id = ?",
                request.name(), request.amount(), request.typeTaxUse(), request.accountId(), id);
    }
    void delete(int id) { jdbc.update("DELETE FROM dbo.Tax WHERE id = ?", id); }
}
