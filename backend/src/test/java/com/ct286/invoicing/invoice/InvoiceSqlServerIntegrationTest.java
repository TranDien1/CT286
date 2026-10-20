package com.ct286.invoicing.invoice;

import static org.junit.jupiter.api.Assertions.*;

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
class InvoiceSqlServerIntegrationTest {
    @Autowired InvoiceService service;
    @Autowired JdbcTemplate jdbc;
    @Test void createsAndReplacesBalancedDraftInSqlServer() {
        Integer userId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.App_User WHERE role='accountant' AND active=1 ORDER BY id",Integer.class);
        Integer partnerId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Partner WHERE is_customer=1 AND active=1 ORDER BY id",Integer.class);
        Integer productId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Product WHERE active=1 ORDER BY id",Integer.class);
        Integer taxId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Tax WHERE type_tax_use='sale' AND account_id IS NOT NULL ORDER BY id",Integer.class);
        UserDto actor = new UserDto(userId,"test","Test",null,null,"accountant",true);
        LocalDate day = LocalDate.of(2026,10,20);
        InvoiceRequest r = new InvoiceRequest(partnerId,day,day,day,"kiểm thử",List.of(new InvoiceRequest.Line(productId,new BigDecimal("2.500"),new BigDecimal("100.00"),taxId)));
        InvoiceDto created = service.create(r,actor);
        assertEquals("draft",created.state()); assertNull(created.name());
        assertEquals(0,created.amountUntaxed().compareTo(new BigDecimal("250")));
        assertEquals(1,created.lines().size());
        assertEquals(0,created.items().stream().map(InvoiceDto.Item::debit).reduce(BigDecimal.ZERO,BigDecimal::add)
                .compareTo(created.items().stream().map(InvoiceDto.Item::credit).reduce(BigDecimal.ZERO,BigDecimal::add)));
        InvoiceRequest edited = new InvoiceRequest(partnerId,day,day,day,"đã sửa",List.of(new InvoiceRequest.Line(productId,BigDecimal.ONE,new BigDecimal("100"),taxId)));
        InvoiceDto updated = service.update(created.id(),edited,actor);
        assertEquals(0,updated.amountUntaxed().compareTo(new BigDecimal("100")));
        assertEquals(1,updated.lines().size());
        assertEquals("đã sửa",updated.notes());
        assertTrue(service.listSales().stream().anyMatch(i -> i.id()==created.id()));
        InvoiceDto posted = service.post(created.id(),actor);
        assertEquals("posted",posted.state());
        assertTrue(posted.name().startsWith("INV/2026/"));
        assertEquals(409,assertThrows(ResponseStatusException.class, () -> service.update(created.id(),edited,actor)).getStatusCode().value());
        InvoiceDto reset = service.reset(created.id(),actor);
        assertEquals("draft",reset.state());
        assertEquals(posted.name(),reset.name());
        InvoiceDto reposted = service.post(created.id(),actor);
        assertEquals(posted.name(),reposted.name());
        InvoiceDto second = service.create(edited,actor);
        assertNotEquals(posted.name(),service.post(second.id(),actor).name());
        service.reset(second.id(),actor);
        assertEquals("cancel",service.cancel(second.id(),actor).state());
        assertEquals(409,assertThrows(ResponseStatusException.class, () -> service.post(second.id(),actor)).getStatusCode().value());
    }
    @Test void purchaseUsesSupplierPurchaseTaxAndCorrectAccountingSides() {
        Integer userId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.App_User WHERE role='accountant' AND active=1 ORDER BY id",Integer.class);
        Integer partnerId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Partner WHERE is_supplier=1 AND active=1 ORDER BY id",Integer.class);
        Integer customerId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Partner WHERE is_customer=1 AND is_supplier=0 AND active=1 ORDER BY id",Integer.class);
        Integer productId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Product WHERE active=1 ORDER BY id",Integer.class);
        Integer taxId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Tax WHERE type_tax_use='purchase' AND account_id IS NOT NULL AND amount > 0 ORDER BY id",Integer.class);
        Integer saleTaxId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Tax WHERE type_tax_use='sale' ORDER BY id",Integer.class);
        String goodsAccount = jdbc.queryForObject("""
                SELECT a.code FROM dbo.Product p JOIN dbo.Product_Category c ON c.id=p.category_id
                JOIN dbo.Journal j ON j.code='BILL' JOIN dbo.Account a ON a.id=COALESCE(c.purchase_account_id,j.default_account_id)
                WHERE p.id=?
                """,String.class,productId);
        String taxAccount = jdbc.queryForObject("SELECT a.code FROM dbo.Tax t JOIN dbo.Account a ON a.id=t.account_id WHERE t.id=?",String.class,taxId);
        UserDto actor = new UserDto(userId,"test","Test",null,null,"accountant",true);
        LocalDate date = LocalDate.of(2026,10,20);
        InvoiceRequest.Line line = new InvoiceRequest.Line(productId,BigDecimal.ONE,new BigDecimal("1000"),taxId);
        InvoiceRequest request = new InvoiceRequest(partnerId,date,date,date,"mua",List.of(line));
        assertEquals(400,assertThrows(ResponseStatusException.class, () -> service.createPurchase(new InvoiceRequest(customerId,date,date,date,null,List.of(line)),actor)).getStatusCode().value());
        assertEquals(400,assertThrows(ResponseStatusException.class, () -> service.createPurchase(new InvoiceRequest(partnerId,date,date,date,null,List.of(new InvoiceRequest.Line(productId,BigDecimal.ONE,BigDecimal.TEN,saleTaxId))),actor)).getStatusCode().value());
        InvoiceDto draft = service.createPurchase(request,actor);
        assertEquals("in_invoice",draft.entryType());
        InvoiceDto.Item goods = draft.items().stream().filter(i -> i.displayType().equals("product")).findFirst().orElseThrow();
        InvoiceDto.Item tax = draft.items().stream().filter(i -> i.displayType().equals("tax")).findFirst().orElseThrow();
        InvoiceDto.Item payable = draft.items().stream().filter(i -> i.displayType().equals("payment_term")).findFirst().orElseThrow();
        assertEquals(goodsAccount,goods.accountCode()); assertTrue(goods.debit().signum() > 0); assertEquals(0,goods.credit().signum());
        assertEquals(taxAccount,tax.accountCode()); assertTrue(tax.debit().signum() > 0); assertEquals(0,tax.credit().signum());
        assertEquals("331",payable.accountCode()); assertTrue(payable.credit().signum() > 0); assertEquals(0,payable.debit().signum());
        assertEquals(0, draft.items().stream().map(InvoiceDto.Item::debit).reduce(BigDecimal.ZERO,BigDecimal::add)
                .compareTo(draft.items().stream().map(InvoiceDto.Item::credit).reduce(BigDecimal.ZERO,BigDecimal::add)));
        InvoiceDto posted = service.post(draft.id(),actor);
        assertTrue(posted.name().startsWith("BILL/2026/"));
        assertEquals(posted.name(),service.post(service.reset(draft.id(),actor).id(),actor).name());
        assertTrue(service.listPurchases().stream().anyMatch(i -> i.id() == draft.id()));
    }
}
