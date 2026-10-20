package com.ct286.invoicing.accounting;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.sql.ResultSet;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class AccountingRepositoryTest {
    @Test
    void mapsJournalWithAccountsAndHandlesMissingAccounts() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet configured = mock(ResultSet.class);
        when(configured.getInt("id")).thenReturn(1);
        when(configured.getString("code")).thenReturn("INV");
        when(configured.getString("name")).thenReturn("Sổ bán");
        when(configured.getString("type")).thenReturn("sale");
        when(configured.getInt("default_id")).thenReturn(4);
        when(configured.getString("default_code")).thenReturn("511");
        when(configured.getInt("counterpart_id")).thenReturn(2);
        when(configured.getString("counterpart_code")).thenReturn("131");
        when(configured.wasNull()).thenReturn(false);

        ResultSet missing = mock(ResultSet.class);
        when(missing.getInt("id")).thenReturn(2);
        when(missing.getString("type")).thenReturn("general");
        when(missing.wasNull()).thenReturn(true);
        doAnswer(invocation -> {
            RowMapper<JournalDto> mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(configured, 0), mapper.mapRow(missing, 1));
        }).when(jdbc).query(anyString(), org.mockito.ArgumentMatchers.<RowMapper<JournalDto>>any());

        List<JournalDto> journals = new AccountingRepository(jdbc).journals();
        assertEquals("511", journals.get(0).defaultAccount().code());
        assertEquals("131", journals.get(0).counterpartAccount().code());
        assertNull(journals.get(1).defaultAccount());
        assertNull(journals.get(1).counterpartAccount());
    }
}
