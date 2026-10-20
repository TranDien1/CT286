package com.ct286.invoicing.invoice;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class InvoiceRepository {
    record Journal(int id, Integer defaultAccountId) { }
    record Partner(int id, boolean customer, boolean supplier, boolean active) {
        Partner(int id, boolean customer, boolean active) { this(id, customer, false, active); }
    }
    record Product(int id, String name, boolean active, Integer salesAccountId, Integer purchaseAccountId) {
        Product(int id, String name, boolean active, Integer salesAccountId) { this(id, name, active, salesAccountId, null); }
    }
    record Tax(int id, String name, BigDecimal rate, String type, Integer accountId) { }
    private final JdbcTemplate jdbc;
    InvoiceRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    private static Integer nullable(ResultSet rs, String col) throws SQLException {
        int n = rs.getInt(col); return rs.wasNull() ? null : n;
    }
    Optional<Journal> salesJournal() {
        return jdbc.query("SELECT id, default_account_id FROM dbo.Journal WHERE code='INV' AND type='sale'",
                (r,n) -> new Journal(r.getInt("id"),nullable(r,"default_account_id"))).stream().findFirst();
    }
    Optional<Journal> purchaseJournal() {
        return jdbc.query("SELECT id, default_account_id FROM dbo.Journal WHERE code='BILL' AND type='purchase'",
                (r,n) -> new Journal(r.getInt("id"),nullable(r,"default_account_id"))).stream().findFirst();
    }
    Optional<Partner> partner(int id) {
        return jdbc.query("SELECT id,is_customer,is_supplier,active FROM dbo.Partner WHERE id=?",
                (r,n) -> new Partner(r.getInt("id"),r.getBoolean("is_customer"),r.getBoolean("is_supplier"),r.getBoolean("active")),id).stream().findFirst();
    }
    Optional<Product> product(int id) {
        return jdbc.query("""
                SELECT p.id,p.name,p.active,c.sales_account_id,c.purchase_account_id FROM dbo.Product p
                JOIN dbo.Product_Category c ON c.id=p.category_id WHERE p.id=?
                """, (r,n) -> new Product(r.getInt("id"),r.getString("name"),r.getBoolean("active"),nullable(r,"sales_account_id"),nullable(r,"purchase_account_id")),id).stream().findFirst();
    }
    Optional<Tax> tax(int id) {
        return jdbc.query("SELECT id,name,amount,type_tax_use,account_id FROM dbo.Tax WHERE id=?",
                (r,n) -> new Tax(r.getInt("id"),r.getString("name"),r.getBigDecimal("amount"),r.getString("type_tax_use"),nullable(r,"account_id")),id).stream().findFirst();
    }
    Integer receivableAccount() {
        return jdbc.query("SELECT id FROM dbo.Account WHERE code='131' AND reconcile=1",
                (r,n) -> r.getInt("id")).stream().findFirst().orElse(null);
    }
    Integer payableAccount() {
        return jdbc.query("SELECT id FROM dbo.Account WHERE code='331' AND reconcile=1", (r,n) -> r.getInt("id")).stream().findFirst().orElse(null);
    }
    private static final String HEADER = """
            SELECT e.*, j.code AS journal_code, j.name AS journal_name, p.name AS partner_name,
                   u.user_name, u.full_name FROM dbo.Journal_Entry e
            JOIN dbo.Journal j ON j.id=e.journal_id
            LEFT JOIN dbo.Partner p ON p.id=e.partner_id JOIN dbo.App_User u ON u.id=e.created_by
            """;
    List<Integer> salesIds() {
        return jdbc.query("SELECT id FROM dbo.Journal_Entry WHERE entry_type='out_invoice' ORDER BY id DESC", (r,n) -> r.getInt(1));
    }
    List<Integer> purchaseIds() {
        return jdbc.query("SELECT id FROM dbo.Journal_Entry WHERE entry_type='in_invoice' ORDER BY id DESC", (r,n) -> r.getInt(1));
    }
    Optional<InvoiceDto> find(int id) {
        return jdbc.query(HEADER + " WHERE e.id=? AND e.entry_type IN ('out_invoice','in_invoice')", (r,n) -> {
            int partnerId = r.getInt("partner_id");
            InvoiceDto.Reference partner = r.wasNull() ? null : new InvoiceDto.Reference(partnerId,r.getString("partner_name"),null);
            return new InvoiceDto(r.getInt("id"),r.getString("name"),r.getString("entry_type"),r.getString("state"),
                    new InvoiceDto.Reference(r.getInt("journal_id"),r.getString("journal_name"),r.getString("journal_code")),
                    partner,new InvoiceDto.Reference(r.getInt("created_by"),r.getString("full_name"),r.getString("user_name")),
                    r.getObject("invoice_date",LocalDate.class),r.getObject("invoice_date_due",LocalDate.class),
                    r.getObject("date",LocalDate.class),r.getBigDecimal("amount_untaxed"),r.getBigDecimal("amount_tax"),
                    r.getBigDecimal("amount_total"),r.getString("payment_state"),r.getString("notes"),
                    r.getTimestamp("created_at").toLocalDateTime(), List.of(),List.of());
        },id).stream().findFirst().map(header -> {
            List<InvoiceDto.Item> items = jdbc.query("""
                    SELECT i.*, a.code AS account_code FROM dbo.Journal_Item i
                    JOIN dbo.Account a ON a.id=i.account_id WHERE i.entry_id=? ORDER BY i.id
                    """, (r,n) -> new InvoiceDto.Item(r.getInt("id"),r.getString("display_type"),r.getInt("account_id"),
                    r.getString("account_code"),r.getString("name"),nullable(r,"product_id"),nullable(r,"tax_id"),
                    nullable(r,"tax_line_id"),r.getBigDecimal("quantity"),r.getBigDecimal("price_unit"),
                    r.getBigDecimal("debit"),r.getBigDecimal("credit"),r.getBoolean("reconciled")), id);
            List<InvoiceDto.Line> lines = items.stream().filter(i -> "product".equals(i.displayType())).map(i ->
                    new InvoiceDto.Line(i.id(),i.productId(),i.quantity(),i.priceUnit(),i.taxId())).toList();
            return new InvoiceDto(header.id(),header.name(),header.entryType(),header.state(),header.journal(),header.partner(),
                    header.createdBy(),header.invoiceDate(),header.invoiceDateDue(),header.accountingDate(),header.amountUntaxed(),
                    header.amountTax(),header.amountTotal(),header.paymentState(),header.notes(),header.createdAt(),lines,items);
        });
    }
    int insertHeader(InvoiceRequest r, int journalId, int userId, BigDecimal untaxed, BigDecimal tax, BigDecimal total) {
        return insertHeader(r,journalId,userId,untaxed,tax,total,"out_invoice");
    }
    int insertHeader(InvoiceRequest r, int journalId, int userId, BigDecimal untaxed, BigDecimal tax, BigDecimal total, String type) {
        return jdbc.queryForObject("""
                INSERT INTO dbo.Journal_Entry (entry_type,state,journal_id,partner_id,created_by,invoice_date,invoice_date_due,[date],notes,amount_untaxed,amount_tax,amount_total)
                OUTPUT INSERTED.id VALUES (?,'draft',?,?,?,?,?,?,?,?,?,?)
                """, Integer.class,type,journalId,r.partnerId(),userId,r.invoiceDate(),r.invoiceDateDue(),r.accountingDate(),r.notes(),untaxed,tax,total);
    }
    void updateHeader(int id, InvoiceRequest r, BigDecimal untaxed, BigDecimal tax, BigDecimal total) {
        jdbc.update("UPDATE dbo.Journal_Entry SET partner_id=?,invoice_date=?,invoice_date_due=?,[date]=?,notes=?,amount_untaxed=?,amount_tax=?,amount_total=? WHERE id=?",
                r.partnerId(),r.invoiceDate(),r.invoiceDateDue(),r.accountingDate(),r.notes(),untaxed,tax,total,id);
    }
    void deleteItems(int id) { jdbc.update("DELETE FROM dbo.Journal_Item WHERE entry_id=?",id); }
    boolean hasPayment(int id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Payment WHERE payment_for_invoice=?",Integer.class,id) > 0;
    }
    String nextSalesNumber(int journalId, int year) {
        return nextNumber(journalId,year,"INV");
    }
    String nextNumber(int journalId, int year, String journalCode) {
        jdbc.queryForObject("SELECT id FROM dbo.Journal WITH (UPDLOCK,HOLDLOCK) WHERE id=?",Integer.class,journalId);
        String prefix = journalCode + "/" + year + "/";
        List<String> names = jdbc.query("SELECT name FROM dbo.Journal_Entry WHERE journal_id=? AND name LIKE ?",
                (r,n) -> r.getString(1),journalId,prefix + "%");
        long max = 0;
        for (String name : names) {
            String suffix = name.substring(prefix.length());
            if (!suffix.matches("[0-9]{4,16}")) continue;
            try { max = Math.max(max, Long.parseLong(suffix)); }
            catch (NumberFormatException ex) { throw new IllegalStateException("Số hóa đơn vượt giới hạn.",ex); }
        }
        return prefix + String.format(java.util.Locale.ROOT,"%04d",max + 1);
    }
    void setState(int id, String state, String name) {
        jdbc.update("UPDATE dbo.Journal_Entry SET state=?,name=? WHERE id=?",state,name,id);
    }
    void item(int entryId, int accountId, Integer productId, Integer taxId, String name, String type,
              BigDecimal quantity, BigDecimal unit, BigDecimal debit, BigDecimal credit, Integer taxLineId) {
        jdbc.update("""
                INSERT INTO dbo.Journal_Item (entry_id,account_id,product_id,tax_id,name,display_type,quantity,price_unit,debit,credit,tax_line_id)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """,entryId,accountId,productId,taxId,name,type,quantity,unit,debit,credit,taxLineId);
    }
}
