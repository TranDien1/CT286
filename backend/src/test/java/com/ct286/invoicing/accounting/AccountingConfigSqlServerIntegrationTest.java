package com.ct286.invoicing.accounting;

import static org.junit.jupiter.api.Assertions.*;

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
class AccountingConfigSqlServerIntegrationTest {
    @Autowired AccountingService service;
    @Autowired JdbcTemplate jdbc;

    @Test void adminCanRenameAccountAndJournalWithoutChangingCodes() {
        int cashId = jdbc.queryForObject("SELECT id FROM dbo.Account WHERE code='111'", Integer.class);
        int journalId = jdbc.queryForObject("SELECT id FROM dbo.Journal WHERE code='CSH'", Integer.class);
        service.updateAccount(cashId, new AccountUpdateRequest("Tiền mặt kiểm thử"), "admin");
        service.updateJournal(journalId, new JournalUpdateRequest("Sổ tiền mặt kiểm thử", cashId), "admin");
        assertEquals("Tiền mặt kiểm thử", jdbc.queryForObject("SELECT name FROM dbo.Account WHERE id=?", String.class, cashId));
        assertEquals("Sổ tiền mặt kiểm thử", jdbc.queryForObject("SELECT name FROM dbo.Journal WHERE id=?", String.class, journalId));
        assertEquals("111", jdbc.queryForObject("SELECT code FROM dbo.Account WHERE id=?", String.class, cashId));
        assertEquals("CSH", jdbc.queryForObject("SELECT code FROM dbo.Journal WHERE id=?", String.class, journalId));
    }

    @Test void accountantCannotEditConfigAndCashJournalNeedsAccount111() {
        int cashId = jdbc.queryForObject("SELECT id FROM dbo.Account WHERE code='111'", Integer.class);
        int salesId = jdbc.queryForObject("SELECT id FROM dbo.Account WHERE code='511'", Integer.class);
        int journalId = jdbc.queryForObject("SELECT id FROM dbo.Journal WHERE code='CSH'", Integer.class);
        assertEquals(403, assertThrows(ResponseStatusException.class,
                () -> service.updateAccount(cashId, new AccountUpdateRequest("Tên khác"), "accountant")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.updateJournal(journalId, new JournalUpdateRequest("Sổ tiền mặt", salesId), "admin")).getStatusCode().value());
    }
}
