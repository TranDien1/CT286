package com.ct286.invoicing.partner;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

// Chỉ chạy khi được bật; giao dịch kiểm thử được hoàn tác sau khi kết thúc.
@SpringBootTest
@Transactional
@EnabledIfEnvironmentVariable(named = "RUN_SQL_TESTS", matches = "true")
class PartnerSqlServerIntegrationTest {
    @Autowired PartnerService service;
    @Autowired JdbcTemplate jdbc;

    @Test void createUpdateDeactivateAndDeletePartner() {
        String name = "TEST-" + UUID.randomUUID();
        PartnerDto created = service.create(new PartnerRequest(name, "customer", "0123456789", null, null, null, null), "accountant");
        assertTrue(created.active());
        assertFalse(created.usedInTransactions());
        assertTrue(service.list("customer", true).stream().anyMatch(p -> p.id() == created.id()));
        PartnerDto updated = service.update(created.id(), new PartnerRequest(name, "supplier", "0123456789", "test@example.com", null, null, "Hà Nội"), "accountant");
        assertEquals("supplier", updated.partnerType());
        assertEquals("Hà Nội", updated.city());
        assertFalse(service.setActive(created.id(), false, "accountant").active());
        assertTrue(service.list("supplier", false).stream().anyMatch(p -> p.id() == created.id()));
        service.delete(created.id(), "accountant");
        assertFalse(service.list(null, null).stream().anyMatch(p -> p.id() == created.id()));
    }

    @Test void dualRolePartnerAppearsInBothListsAndStoresBothFlags() {
        String name = "TEST-DUAL-" + UUID.randomUUID();
        PartnerDto created = service.create(new PartnerRequest(name, "customer", null, null, null, null, null), "admin");
        PartnerDto dual = service.update(created.id(), new PartnerRequest(name, "both", null, null, null, null, null), "admin");
        assertEquals("both", dual.partnerType());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Partner WHERE id=? AND is_customer=1 AND is_supplier=1", Integer.class, dual.id()));
        assertTrue(service.list("customer", true).stream().anyMatch(p -> p.id() == dual.id()));
        assertTrue(service.list("supplier", true).stream().anyMatch(p -> p.id() == dual.id()));
        service.delete(dual.id(), "admin");
    }

    @Test void customerWithInvoiceCanGainSupplierRoleWithoutLosingHistory() {
        String name = "TEST-EXISTING-" + UUID.randomUUID();
        PartnerDto customer = service.create(new PartnerRequest(name, "customer", null, null, null, null, null), "accountant");
        int journal = jdbc.queryForObject("SELECT id FROM dbo.Journal WHERE code='INV'", Integer.class);
        int user = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.App_User WHERE role='accountant' ORDER BY id", Integer.class);
        int invoice = jdbc.queryForObject("""
                INSERT INTO dbo.Journal_Entry (name, entry_type, state, journal_id, partner_id, created_by, [date])
                OUTPUT INSERTED.id VALUES (?, 'out_invoice', 'draft', ?, ?, ?, CAST(GETDATE() AS DATE))
                """, Integer.class, "TEST-ROLE-" + UUID.randomUUID(), journal, customer.id(), user);
        assertTrue(service.list("customer", true).stream()
                .anyMatch(p -> p.id() == customer.id() && p.usedInTransactions()));

        PartnerDto dual = service.update(customer.id(),
                new PartnerRequest(name, "both", null, null, null, null, null), "accountant");
        assertEquals("both", dual.partnerType());
        assertEquals(customer.id(), jdbc.queryForObject(
                "SELECT partner_id FROM dbo.Journal_Entry WHERE id=?", Integer.class, invoice));
        assertTrue(service.list("supplier", true).stream().anyMatch(p -> p.id() == customer.id()));

        var error = assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.update(customer.id(),
                        new PartnerRequest(name, "supplier", null, null, null, null, null), "accountant"));
        assertEquals(org.springframework.http.HttpStatus.CONFLICT, error.getStatusCode());
    }
}
