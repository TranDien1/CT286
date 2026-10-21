package com.ct286.invoicing.ledger;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/journal-entries")
public class LedgerController {
    record Item(int id, String accountCode, String accountName, String label, String displayType,
                BigDecimal quantity, BigDecimal debit, BigDecimal credit, boolean reconciled) { }
    record Entry(int id, String name, String entryType, String state, LocalDate date,
                 String journalCode, String journalName, Integer partnerId, String partnerName,
                 List<Item> items) { }
    private final JdbcTemplate jdbc;
    public LedgerController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Entry> list() {
        return jdbc.query("""
                SELECT e.id,e.name,e.entry_type,e.state,e.[date],j.code journal_code,j.name journal_name,
                       p.id partner_id,p.name partner_name
                FROM dbo.Journal_Entry e JOIN dbo.Journal j ON j.id=e.journal_id
                LEFT JOIN dbo.Partner p ON p.id=e.partner_id ORDER BY e.[date] DESC,e.id DESC
                """, (rs, row) -> {
            int id = rs.getInt("id");
            int partner = rs.getInt("partner_id"); Integer partnerId = rs.wasNull() ? null : partner;
            return new Entry(id,rs.getString("name"),rs.getString("entry_type"),rs.getString("state"),
                    rs.getObject("date",LocalDate.class),rs.getString("journal_code"),rs.getString("journal_name"),
                    partnerId,rs.getString("partner_name"),jdbc.query("""
                        SELECT i.id,a.code,a.name account_name,i.name label,i.display_type,i.quantity,i.debit,i.credit,i.reconciled
                        FROM dbo.Journal_Item i JOIN dbo.Account a ON a.id=i.account_id
                        WHERE i.entry_id=? ORDER BY i.id
                        """, (item,n) -> new Item(item.getInt("id"),item.getString("code"),item.getString("account_name"),
                        item.getString("label"),item.getString("display_type"),item.getBigDecimal("quantity"),
                        item.getBigDecimal("debit"),item.getBigDecimal("credit"),item.getBoolean("reconciled")),id));
        });
    }
}
