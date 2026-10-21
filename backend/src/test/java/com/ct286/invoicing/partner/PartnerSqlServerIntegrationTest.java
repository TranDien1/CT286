package com.ct286.invoicing.partner;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

// Chỉ chạy khi được bật; giao dịch kiểm thử được hoàn tác sau khi kết thúc.
@SpringBootTest
@Transactional
@EnabledIfEnvironmentVariable(named = "RUN_SQL_TESTS", matches = "true")
class PartnerSqlServerIntegrationTest {
    @Autowired PartnerService service;

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
}
