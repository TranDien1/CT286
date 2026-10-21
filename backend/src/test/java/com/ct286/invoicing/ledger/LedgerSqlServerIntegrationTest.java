package com.ct286.invoicing.ledger;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
@EnabledIfEnvironmentVariable(named = "RUN_SQL_TESTS", matches = "true")
class LedgerSqlServerIntegrationTest {
    @Autowired LedgerController controller;
    @Autowired DebtReportController reports;
    @Autowired JdbcTemplate jdbc;

    @Test void entriesAndLinesMatchDatabaseIncludingPayments() {
        var entries = controller.list();
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Journal_Entry", Integer.class);
        assertEquals(count, entries.size());
        for (var entry : entries) {
            Integer lines = jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Journal_Item WHERE entry_id=?", Integer.class, entry.id());
            assertEquals(lines, entry.items().size());
        }
        var paymentIds = jdbc.queryForList("SELECT entry_id FROM dbo.Payment", Integer.class);
        for (int id : paymentIds) assertTrue(entries.stream().anyMatch(e -> e.id() == id));
    }
    @Test void debtTotalsMatchUnreconciledPostedLines() {
        var debts = reports.debts();
        for (String code : java.util.List.of("131", "331")) {
            var expected = jdbc.queryForObject("""
                    SELECT COALESCE(SUM(CASE WHEN a.code='131' THEN i.debit-i.credit ELSE i.credit-i.debit END),0)
                    FROM dbo.Journal_Item i JOIN dbo.Journal_Entry e ON e.id=i.entry_id
                    JOIN dbo.Account a ON a.id=i.account_id
                    WHERE e.state='posted' AND i.reconciled=0 AND a.code=?
                    """, java.math.BigDecimal.class, code);
            var actual = debts.stream().filter(d -> d.accountCode().equals(code)).map(DebtReportController.Debt::balance)
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            assertEquals(0, expected.compareTo(actual));
        }
    }
    @Test void reconcilingAnInvoiceRemovesItsOpenDebt() {
        int partner = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Partner WHERE is_customer=1 ORDER BY id", Integer.class);
        int journal = jdbc.queryForObject("SELECT id FROM dbo.Journal WHERE code='INV'", Integer.class);
        int user = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.App_User WHERE role='accountant' ORDER BY id", Integer.class);
        int account = jdbc.queryForObject("SELECT id FROM dbo.Account WHERE code='131'", Integer.class);
        var before = reports.debts().stream().filter(d -> d.accountCode().equals("131") && java.util.Objects.equals(d.partnerId(),partner))
                .map(DebtReportController.Debt::balance).findFirst().orElse(java.math.BigDecimal.ZERO);
        int entry = jdbc.queryForObject("""
                INSERT INTO dbo.Journal_Entry (name,entry_type,state,journal_id,partner_id,created_by,[date])
                OUTPUT INSERTED.id VALUES ('TEST-REPORT','out_invoice','posted',?,?,?,?)
                """,Integer.class,journal,partner,user,java.time.LocalDate.now());
        jdbc.update("INSERT INTO dbo.Journal_Item(entry_id,account_id,name,display_type,debit,credit,reconciled) VALUES (?,?,'TEST','payment_term',100,0,0)", entry,account);
        var during = reports.debts().stream().filter(d -> d.accountCode().equals("131") && java.util.Objects.equals(d.partnerId(),partner)).findFirst().orElseThrow();
        assertEquals(0, before.add(new java.math.BigDecimal("100")).compareTo(during.balance()));
        assertTrue(during.entries().contains("TEST-REPORT"));
        jdbc.update("UPDATE dbo.Journal_Item SET reconciled=1 WHERE entry_id=?",entry);
        var after = reports.debts().stream().filter(d -> d.accountCode().equals("131") && java.util.Objects.equals(d.partnerId(),partner))
                .map(DebtReportController.Debt::balance).findFirst().orElse(java.math.BigDecimal.ZERO);
        assertEquals(0,before.compareTo(after));
    }
    @Test void asOfDebtUsesPaymentDateNotCurrentReconciledFlag() {
        int partner = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Partner WHERE is_customer=1 ORDER BY id", Integer.class);
        int journal = jdbc.queryForObject("SELECT id FROM dbo.Journal WHERE code='INV'", Integer.class);
        int cash = jdbc.queryForObject("SELECT id FROM dbo.Journal WHERE code='CSH'", Integer.class);
        int user = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.App_User WHERE role='accountant' ORDER BY id", Integer.class);
        int account = jdbc.queryForObject("SELECT id FROM dbo.Account WHERE code='131'", Integer.class);
        String name = "TEST-" + java.util.UUID.randomUUID();
        int invoice = jdbc.queryForObject("""
                INSERT INTO dbo.Journal_Entry (name,entry_type,state,journal_id,partner_id,created_by,[date])
                OUTPUT INSERTED.id VALUES (?,'out_invoice','posted',?,?,?,'2026-01-15')
                """,Integer.class,name,journal,partner,user);
        jdbc.update("INSERT INTO dbo.Journal_Item(entry_id,account_id,name,display_type,debit,credit,reconciled) VALUES (?,?,'TEST','payment_term',100,0,1)",invoice,account);
        int paymentEntry = jdbc.queryForObject("""
                INSERT INTO dbo.Journal_Entry (entry_type,state,journal_id,partner_id,created_by,[date])
                OUTPUT INSERTED.id VALUES ('entry','posted',?,?,?,'2026-02-01')
                """,Integer.class,cash,partner,user);
        jdbc.update("INSERT INTO dbo.Payment(entry_id,payment_for_invoice,payment_type,amount,payment_date) VALUES (?,?,'inbound',100,'2026-02-01')",paymentEntry,invoice);
        var january = reports.debts(java.time.LocalDate.of(2026,1,31));
        assertTrue(january.stream().anyMatch(d -> d.accountCode().equals("131") && d.entries().contains(name)));
        var february = reports.debts(java.time.LocalDate.of(2026,2,1));
        assertFalse(february.stream().anyMatch(d -> d.entries().contains(name)));
        var beforeInvoice = reports.debts(java.time.LocalDate.of(2026,1,14));
        assertFalse(beforeInvoice.stream().anyMatch(d -> d.entries().contains(name)));
    }
}
