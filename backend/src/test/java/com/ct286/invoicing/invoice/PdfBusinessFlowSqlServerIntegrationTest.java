package com.ct286.invoicing.invoice;

import static org.junit.jupiter.api.Assertions.*;

import com.ct286.invoicing.payment.PaymentDto;
import com.ct286.invoicing.payment.PaymentRequest;
import com.ct286.invoicing.payment.PaymentService;
import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@Transactional
@EnabledIfEnvironmentVariable(named = "RUN_SQL_TESTS", matches = "true")
class PdfBusinessFlowSqlServerIntegrationTest {
    @Autowired InvoiceService invoices;
    @Autowired PaymentService payments;
    @Autowired JdbcTemplate jdbc;

    @Test void salesExampleFromPdf() { checkFlow(false); }
    @Test void purchaseExampleFromPdf() { checkFlow(true); }

    private void checkFlow(boolean purchase) {
        int userId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.App_User WHERE role='accountant' AND active=1 ORDER BY id", Integer.class);
        int partner = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Partner WHERE active=1 AND " + (purchase ? "is_supplier" : "is_customer") + "=1 ORDER BY id", Integer.class);
        List<Integer> products = jdbc.queryForList("SELECT TOP 2 id FROM dbo.Product WHERE active=1 ORDER BY id", Integer.class);
        assertEquals(2, products.size());
        int tax = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Tax WHERE type_tax_use=? AND amount=10 AND account_id IS NOT NULL ORDER BY id", Integer.class, purchase ? "purchase" : "sale");
        UserDto actor = new UserDto(userId,"test","Kiểm thử",null,null,"accountant",true);
        LocalDate day = LocalDate.of(2026, 10, purchase ? 3 : 2);
        LocalDate due = purchase ? LocalDate.of(2026, 10, 18) : LocalDate.of(2026, 11, 1);
        LocalDate payDate = purchase ? LocalDate.of(2026, 10, 10) : day;
        var lines = purchase
            ? List.of(new InvoiceRequest.Line(products.get(0),new BigDecimal("10"),new BigDecimal("350000"),tax), new InvoiceRequest.Line(products.get(1),new BigDecimal("20"),new BigDecimal("200000"),tax))
            : List.of(new InvoiceRequest.Line(products.get(0),new BigDecimal("2"),new BigDecimal("500000"),tax), new InvoiceRequest.Line(products.get(1),new BigDecimal("3"),new BigDecimal("300000"),tax));
        InvoiceRequest input = new InvoiceRequest(partner,day,due,day,"Kiểm thử theo PDF",lines);
        InvoiceDto draft = purchase ? invoices.createPurchase(input,actor) : invoices.create(input,actor);
        BigDecimal untaxed = new BigDecimal(purchase ? "7500000" : "1900000");
        BigDecimal vat = new BigDecimal(purchase ? "750000" : "190000");
        BigDecimal total = untaxed.add(vat);
        assertEquals("draft",draft.state()); assertNull(draft.name());
        assertMoney(untaxed,draft.amountUntaxed()); assertMoney(vat,draft.amountTax()); assertMoney(total,draft.amountTotal());
        assertEquals(4,draft.items().size());
        List<InvoiceDto.Item> goods = draft.items().stream().filter(i -> i.displayType().equals("product")).toList();
        assertEquals(2,goods.size());
        assertEquals(purchase ? "156" : "511",goods.get(0).accountCode());
        assertEquals(purchase ? "156" : "511",goods.get(1).accountCode());
        assertMoney(new BigDecimal(purchase ? "3500000" : "1000000"),purchase ? goods.get(0).debit() : goods.get(0).credit());
        assertMoney(new BigDecimal(purchase ? "4000000" : "900000"),purchase ? goods.get(1).debit() : goods.get(1).credit());
        var vatItem = draft.items().stream().filter(i -> i.displayType().equals("tax")).findFirst().orElseThrow();
        assertEquals(purchase ? "1331" : "3331",vatItem.accountCode());
        assertMoney(vat,purchase ? vatItem.debit() : vatItem.credit());
        var debt = draft.items().stream().filter(i -> i.displayType().equals("payment_term")).findFirst().orElseThrow();
        assertEquals(purchase ? "331" : "131",debt.accountCode());
        assertMoney(total,purchase ? debt.credit() : debt.debit());
        assertEquals(409,assertThrows(ResponseStatusException.class,() -> payments.create(new PaymentRequest(draft.id(),payDate),actor)).getStatusCode().value());
        InvoiceDto posted = invoices.post(draft.id(),actor);
        assertEquals("posted",posted.state()); assertTrue(posted.name().startsWith(purchase ? "BILL/2026/" : "INV/2026/"));
        assertEquals(409,assertThrows(ResponseStatusException.class,() -> invoices.update(posted.id(),input,actor)).getStatusCode().value());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Journal_Item WHERE entry_id=? AND display_type='payment_term' AND reconciled=0",Integer.class,posted.id()));
        PaymentDto payment = payments.create(new PaymentRequest(posted.id(),payDate),actor);
        assertEquals(purchase ? "outbound" : "inbound",payment.paymentType()); assertMoney(total,payment.amount());
        assertEquals(partner,payment.partner().id()); assertEquals("CSH",payment.journal().code());
        assertEquals("paid",invoices.get(posted.id()).paymentState());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Journal_Item WHERE entry_id=? AND display_type='payment_term' AND reconciled=0",Integer.class,posted.id()));
        var paymentRows = jdbc.queryForList("SELECT a.code,i.display_type,i.debit,i.credit,i.reconciled FROM dbo.Journal_Item i JOIN dbo.Account a ON a.id=i.account_id WHERE i.entry_id=?",payment.entryId());
        assertEquals(2,paymentRows.size());
        var cash = paymentRows.stream().filter(r -> r.get("display_type").equals("cash")).findFirst().orElseThrow();
        var paidDebt = paymentRows.stream().filter(r -> r.get("display_type").equals("payment_term")).findFirst().orElseThrow();
        assertEquals("111",cash.get("code")); assertEquals(purchase ? "331" : "131",paidDebt.get("code"));
        assertMoney(total,(BigDecimal) cash.get(purchase ? "credit" : "debit"));
        assertMoney(total,(BigDecimal) paidDebt.get(purchase ? "debit" : "credit"));
        assertEquals(Boolean.TRUE,paidDebt.get("reconciled"));
        assertEquals(409,assertThrows(ResponseStatusException.class,() -> payments.create(new PaymentRequest(posted.id(),payDate),actor)).getStatusCode().value());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Payment WHERE payment_for_invoice=?",Integer.class,posted.id()));
    }

    private static void assertMoney(BigDecimal expected, BigDecimal actual) { assertEquals(0,expected.compareTo(actual)); }
}
