package com.ct286.invoicing.ledger;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class DebtReportController {
    record Partner(Integer id, String name) { }
    record Debt(String accountCode, Integer partnerId, Partner partner, List<String> entries, BigDecimal balance) { }
    private final JdbcTemplate jdbc;
    public DebtReportController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/debts")
    @Transactional(readOnly = true)
    public List<Debt> debts(@RequestParam(required = false) LocalDate asOf) {
        record Row(String code, Integer partnerId, String partnerName, String entry, BigDecimal debit, BigDecimal credit) { }
        String base = """
                SELECT a.code,p.id partner_id,p.name partner_name,e.name entry_name,i.debit,i.credit
                FROM dbo.Journal_Item i JOIN dbo.Journal_Entry e ON e.id=i.entry_id
                JOIN dbo.Account a ON a.id=i.account_id LEFT JOIN dbo.Partner p ON p.id=e.partner_id
                WHERE e.state='posted' AND a.code IN ('131','331')
                """;
        var mapper = (org.springframework.jdbc.core.RowMapper<Row>) (r,n) -> { int partner = r.getInt("partner_id"); Integer id = r.wasNull() ? null : partner;
            return new Row(r.getString("code"),id,r.getString("partner_name"),r.getString("entry_name"),r.getBigDecimal("debit"),r.getBigDecimal("credit")); };
        var rows = asOf == null
            ? jdbc.query(base + " AND i.reconciled=0 ORDER BY a.code,p.id,e.id,i.id", mapper)
            : jdbc.query(base + """
                AND e.entry_type IN ('out_invoice','in_invoice') AND i.display_type='payment_term' AND e.[date]<=?
                AND NOT EXISTS (SELECT 1 FROM dbo.Payment payment WHERE payment.payment_for_invoice=e.id AND payment.payment_date<=?)
                ORDER BY a.code,p.id,e.id,i.id
                """, mapper, asOf, asOf);
        record Key(String code, Integer partnerId) { }
        Map<Key,Debt> result = new LinkedHashMap<>();
        for (var row : rows) {
            var key = new Key(row.code(),row.partnerId());
            var previous = result.get(key);
            var entries = previous == null ? new ArrayList<String>() : new ArrayList<>(previous.entries());
            if (row.entry() != null && !entries.contains(row.entry())) entries.add(row.entry());
            BigDecimal amount = row.code().equals("131") ? row.debit().subtract(row.credit()) : row.credit().subtract(row.debit());
            result.put(key, new Debt(row.code(),row.partnerId(),new Partner(row.partnerId(),row.partnerName()),entries,
                    previous == null ? amount : previous.balance().add(amount)));
        }
        return List.copyOf(result.values());
    }

    List<Debt> debts() { return debts(null); }
}
