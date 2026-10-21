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
class PaymentSqlServerIntegrationTest {
    @Autowired InvoiceService invoices;
    @Autowired PaymentService payments;
    @Autowired JdbcTemplate jdbc;
    @Test void fullCashPaymentForSalesAndPurchase() {
        int userId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.App_User WHERE role='accountant' AND active=1 ORDER BY id",Integer.class);
        int productId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Product WHERE active=1 ORDER BY id",Integer.class);
        UserDto actor = new UserDto(userId,"test","Test",null,null,"accountant",true);
        LocalDate date = LocalDate.of(2026,10,20);
        int cashAccount = jdbc.queryForObject("SELECT default_account_id FROM dbo.Journal WHERE code='CSH'",Integer.class);
        assertEquals("111",jdbc.queryForObject("SELECT code FROM dbo.Account WHERE id=?",String.class,cashAccount));
        for (boolean purchase : List.of(false,true)) {
            int partnerId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Partner WHERE " + (purchase ? "is_supplier" : "is_customer") + "=1 AND active=1 ORDER BY id",Integer.class);
            int taxId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Tax WHERE type_tax_use=? ORDER BY id",Integer.class,purchase ? "purchase" : "sale");
            InvoiceRequest input = new InvoiceRequest(partnerId,date,date,date,null,List.of(new InvoiceRequest.Line(productId,BigDecimal.ONE,new BigDecimal("1000"),taxId)));
            InvoiceDto draft = purchase ? invoices.createPurchase(input,actor) : invoices.create(input,actor);
            InvoiceDto posted = invoices.post(draft.id(),actor);
            PaymentDto payment = payments.create(new PaymentRequest(posted.id(),date),actor);
            assertEquals(purchase ? "outbound" : "inbound",payment.paymentType());
            assertEquals(0,posted.amountTotal().compareTo(payment.amount()));
            assertTrue(payment.name().startsWith("CSH/2026/"));
            assertEquals("paid",invoices.get(posted.id()).paymentState());
            assertTrue(invoices.get(posted.id()).items().stream().filter(i -> i.displayType().equals("payment_term")).allMatch(InvoiceDto.Item::reconciled));
            var rows = jdbc.queryForList("SELECT account_id,display_type,debit,credit,reconciled FROM dbo.Journal_Item WHERE entry_id=?",payment.entryId());
            assertEquals(2,rows.size());
            var cash = rows.stream().filter(r -> r.get("display_type").equals("cash")).findFirst().orElseThrow();
            var debt = rows.stream().filter(r -> r.get("display_type").equals("payment_term")).findFirst().orElseThrow();
            assertEquals(cashAccount,cash.get("account_id"));
            assertEquals(purchase ? "331" : "131",jdbc.queryForObject("SELECT code FROM dbo.Account WHERE id=?",String.class,debt.get("account_id")));
            assertEquals(0,((BigDecimal) cash.get(purchase ? "credit" : "debit")).compareTo(posted.amountTotal()));
            assertEquals(0,((BigDecimal) debt.get(purchase ? "debit" : "credit")).compareTo(posted.amountTotal()));
            assertEquals(Boolean.TRUE,debt.get("reconciled"));
            assertEquals(409,assertThrows(ResponseStatusException.class, () -> payments.create(new PaymentRequest(posted.id(),date),actor)).getStatusCode().value());
            assertEquals(409,assertThrows(ResponseStatusException.class, () -> invoices.reset(posted.id(),actor)).getStatusCode().value());
        }
    }
}
