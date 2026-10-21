package com.ct286.invoicing.accounting;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class AccountingRepository {
    private final JdbcTemplate jdbc;

    AccountingRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    List<AccountDto> accounts() {
        return jdbc.query("""
                SELECT id, code, name, account_type, reconcile
                FROM dbo.Account ORDER BY code
                """, (rs, row) -> account(rs, ""));
    }

    List<JournalDto> journals() {
        return jdbc.query("""
                SELECT j.id, j.code, j.name, j.type,
                       d.id AS default_id, d.code AS default_code, d.name AS default_name,
                       d.account_type AS default_account_type, d.reconcile AS default_reconcile,
                       c.id AS counterpart_id, c.code AS counterpart_code, c.name AS counterpart_name,
                       c.account_type AS counterpart_account_type, c.reconcile AS counterpart_reconcile
                FROM dbo.Journal j
                LEFT JOIN dbo.Account d ON d.id = j.default_account_id
                LEFT JOIN dbo.Account c ON c.code = CASE j.type
                    WHEN 'sale' THEN '131' WHEN 'purchase' THEN '331' ELSE NULL END
                ORDER BY j.code
                """, (rs, row) -> new JournalDto(rs.getInt("id"), rs.getString("code"),
                rs.getString("name"), rs.getString("type"), account(rs, "default_"), account(rs, "counterpart_")));
    }

    private AccountDto account(ResultSet rs, String prefix) throws SQLException {
        int id = rs.getInt(prefix + "id");
        if (rs.wasNull()) return null;
        return new AccountDto(id, rs.getString(prefix + "code"), rs.getString(prefix + "name"),
                rs.getString(prefix + "account_type"), rs.getBoolean(prefix + "reconcile"));
    }
}
