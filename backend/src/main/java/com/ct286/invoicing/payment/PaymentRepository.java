package com.ct286.invoicing.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class PaymentRepository {
    record Invoice(int id, String name, String type, String state, String paymentState, Integer partnerId, BigDecimal total) { }
    record CashJournal(int id, Integer accountId) { }
    record DebtItem(int id, int accountId, BigDecimal debit, BigDecimal credit, boolean reconciled) { }
    private final JdbcTemplate jdbc;
    PaymentRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    Optional<Invoice> lockInvoice(int id) {
        return jdbc.query("""
                SELECT id,name,entry_type,state,payment_state,partner_id,amount_total
                FROM dbo.Journal_Entry WITH (UPDLOCK,HOLDLOCK) WHERE id=? AND entry_type IN ('out_invoice','in_invoice')
                """, (r,n) -> { int partner = r.getInt("partner_id"); Integer partnerId = r.wasNull() ? null : partner;
                    return new Invoice(r.getInt("id"),r.getString("name"),r.getString("entry_type"),r.getString("state"),
                            r.getString("payment_state"),partnerId,r.getBigDecimal("amount_total")); },id).stream().findFirst();
    }
    Optional<CashJournal> cashJournal() {
        return jdbc.query("SELECT id,default_account_id FROM dbo.Journal WITH (UPDLOCK,HOLDLOCK) WHERE code='CSH' AND type='cash'",
                (r,n) -> { int account = r.getInt("default_account_id"); Integer accountId = r.wasNull() ? null : account;
                    return new CashJournal(r.getInt("id"),accountId); }).stream().findFirst();
    }
    List<DebtItem> debtItems(int invoiceId, String accountCode) {
        return jdbc.query("""
                SELECT i.id,i.account_id,i.debit,i.credit,i.reconciled FROM dbo.Journal_Item i
                JOIN dbo.Account a ON a.id=i.account_id
                WHERE i.entry_id=? AND i.display_type='payment_term' AND a.code=? AND a.reconcile=1
                """,(r,n) -> new DebtItem(r.getInt("id"),r.getInt("account_id"),r.getBigDecimal("debit"),r.getBigDecimal("credit"),r.getBoolean("reconciled")),invoiceId,accountCode);
    }
    boolean paymentExists(int invoiceId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Payment WHERE payment_for_invoice=?",Integer.class,invoiceId) > 0;
    }
    String nextName(int journalId, int year) {
        String prefix = "CSH/" + year + "/";
        List<String> names = jdbc.query("SELECT name FROM dbo.Journal_Entry WHERE journal_id=? AND name LIKE ?",
                (r,n) -> r.getString(1),journalId,prefix + "%");
        long max = 0;
        for (String name : names) {
            String suffix = name.substring(prefix.length());
            if (suffix.matches("[0-9]{4,16}")) max = Math.max(max,Long.parseLong(suffix));
        }
        return prefix + String.format(java.util.Locale.ROOT,"%04d",max + 1);
    }
    int createEntry(String name, int journalId, int partnerId, int userId, LocalDate date) {
        return jdbc.queryForObject("""
                INSERT INTO dbo.Journal_Entry (name,entry_type,state,journal_id,partner_id,created_by,[date])
                OUTPUT INSERTED.id VALUES (?,'entry','posted',?,?,?,?)
                """,Integer.class,name,journalId,partnerId,userId,date);
    }
    void item(int entryId, int accountId, String label, String type, BigDecimal debit, BigDecimal credit, boolean reconciled) {
        jdbc.update("INSERT INTO dbo.Journal_Item (entry_id,account_id,name,display_type,debit,credit,reconciled) VALUES (?,?,?,?,?,?,?)",
                entryId,accountId,label,type,debit,credit,reconciled);
    }
    int createPayment(int entryId, int invoiceId, String type, BigDecimal amount, LocalDate date) {
        return jdbc.queryForObject("INSERT INTO dbo.Payment (entry_id,payment_for_invoice,payment_type,amount,payment_date) OUTPUT INSERTED.id VALUES (?,?,?,?,?)",
                Integer.class,entryId,invoiceId,type,amount,date);
    }
    void reconcile(int itemId) { jdbc.update("UPDATE dbo.Journal_Item SET reconciled=1 WHERE id=?",itemId); }
    void markPaid(int invoiceId) { jdbc.update("UPDATE dbo.Journal_Entry SET payment_state='paid' WHERE id=?",invoiceId); }
    private static final String SELECT = """
            SELECT p.id,p.entry_id,p.payment_for_invoice,p.payment_type,p.amount,p.payment_date,
                   e.name,e.partner_id,j.id AS journal_id,j.code AS journal_code,j.name AS journal_name,
                   partner.name AS partner_name,u.id AS user_id,u.full_name,u.user_name,
                   inv.name AS invoice_name,inv.entry_type AS invoice_type
            FROM dbo.Payment p JOIN dbo.Journal_Entry e ON e.id=p.entry_id
            JOIN dbo.Journal j ON j.id=e.journal_id JOIN dbo.Partner partner ON partner.id=e.partner_id
            JOIN dbo.App_User u ON u.id=e.created_by
            JOIN dbo.Journal_Entry inv ON inv.id=p.payment_for_invoice
            """;
    private PaymentDto map(java.sql.ResultSet r, int n) throws java.sql.SQLException {
        return new PaymentDto(r.getInt("id"),r.getInt("entry_id"),r.getInt("payment_for_invoice"),r.getString("name"),
                r.getString("payment_type"),r.getBigDecimal("amount"),r.getObject("payment_date",LocalDate.class),
                new PaymentDto.Reference(r.getInt("journal_id"),r.getString("journal_name"),r.getString("journal_code")),
                new PaymentDto.Reference(r.getInt("partner_id"),r.getString("partner_name"),null),
                new PaymentDto.Reference(r.getInt("user_id"),r.getString("full_name"),r.getString("user_name")),
                r.getString("invoice_name"),r.getString("invoice_type"));
    }
    List<PaymentDto> list() { return jdbc.query(SELECT + " ORDER BY p.id DESC",this::map); }
    Optional<PaymentDto> find(int id) { return jdbc.query(SELECT + " WHERE p.id=?",this::map,id).stream().findFirst(); }
}
