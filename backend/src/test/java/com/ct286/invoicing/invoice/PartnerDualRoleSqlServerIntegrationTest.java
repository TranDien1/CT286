package com.ct286.invoicing.invoice;

import static org.junit.jupiter.api.Assertions.*;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
@EnabledIfEnvironmentVariable(named = "RUN_SQL_TESTS", matches = "true")
class PartnerDualRoleSqlServerIntegrationTest {
    @Autowired InvoiceService invoices;
    @Autowired JdbcTemplate jdbc;

    @Test void samePartnerCanBeUsedForSalesAndPurchases() {
        int partnerId = jdbc.queryForObject("""
                INSERT INTO dbo.Partner (name,is_customer,is_supplier)
                OUTPUT INSERTED.id VALUES (?,1,1)
                """, Integer.class, "TEST-DUAL-" + UUID.randomUUID());
        int productId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Product WHERE active=1 ORDER BY id", Integer.class);
        int saleTax = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Tax WHERE type_tax_use='sale' AND amount=10 AND account_id IS NOT NULL ORDER BY id", Integer.class);
        int purchaseTax = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Tax WHERE type_tax_use='purchase' AND amount=10 AND account_id IS NOT NULL ORDER BY id", Integer.class);
        int userId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.App_User WHERE role='accountant' AND active=1 ORDER BY id", Integer.class);
        UserDto actor = new UserDto(userId, "test", "Kiểm thử", null, null, "accountant", true);
        LocalDate day = LocalDate.of(2026, 10, 28);
        InvoiceRequest sale = new InvoiceRequest(partnerId, day, day.plusDays(30), day, null,
                List.of(new InvoiceRequest.Line(productId, BigDecimal.ONE, new BigDecimal("1000"), saleTax)));
        InvoiceRequest purchase = new InvoiceRequest(partnerId, day, day.plusDays(30), day, null,
                List.of(new InvoiceRequest.Line(productId, BigDecimal.ONE, new BigDecimal("800"), purchaseTax)));
        InvoiceDto saleDraft = invoices.create(sale, actor);
        InvoiceDto purchaseDraft = invoices.createPurchase(purchase, actor);
        assertEquals(partnerId, saleDraft.partner().id());
        assertEquals(partnerId, purchaseDraft.partner().id());
        assertTrue(saleDraft.items().stream().anyMatch(i -> "131".equals(i.accountCode())));
        assertTrue(purchaseDraft.items().stream().anyMatch(i -> "331".equals(i.accountCode())));
    }
}
