package com.ct286.invoicing.tax;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

// Opt-in: requires the configured SQL Server. Spring rolls the test transaction back.
@SpringBootTest
@Transactional
@EnabledIfEnvironmentVariable(named = "RUN_SQL_TESTS", matches = "true")
class TaxSqlServerIntegrationTest {
    @Autowired TaxService service;
    @Autowired JdbcTemplate jdbc;

    @Test void readsAndWritesTaxAgainstSqlServer() {
        Integer accountId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Account ORDER BY id", Integer.class);
        assertNotNull(accountId);
        String name = "TEST-" + UUID.randomUUID();
        TaxDto created = service.create(new TaxRequest(name, new BigDecimal("5.1250"), "sale", accountId), "accountant");
        assertTrue(service.list("sale").stream().anyMatch(t -> t.id() == created.id()));
        assertFalse(created.usedInTransactions());
        assertFalse(created.defaultForProduct());
        TaxDto updated = service.update(created.id(), new TaxRequest(name + "-updated", BigDecimal.TEN, "sale", accountId), "accountant");
        assertEquals(name + "-updated", updated.name());
        service.delete(created.id(), "accountant");
        assertFalse(service.list(null).stream().anyMatch(t -> t.id() == created.id()));
    }
}
