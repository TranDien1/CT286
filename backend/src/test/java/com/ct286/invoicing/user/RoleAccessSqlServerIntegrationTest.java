package com.ct286.invoicing.user;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "RUN_SQL_TESTS", matches = "true")
class RoleAccessSqlServerIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired SessionRegistry sessions;

    @Test void adminCannotReadBusinessEndpointsButCanReadManagementData() throws Exception {
        String token = tokenFor("admin");
        try {
            for (String path : new String[] {"/api/invoices?type=out_invoice", "/api/journal-entries", "/api/payments", "/api/payments/1", "/api/payments/1/pdf", "/api/reports/debts"}) {
                mvc.perform(get(path).header("Authorization", "Bearer " + token))
                        .andExpect(status().isForbidden())
                        .andExpect(jsonPath("$.status").value(403));
            }
            mvc.perform(get("/api/accounting-config").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());
            mvc.perform(get("/api/partners").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());
        } finally { sessions.revoke(token); }
    }

    @Test void accountantCanReadBusinessEndpoints() throws Exception {
        String token = tokenFor("accountant");
        try {
            mvc.perform(get("/api/payments").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
            int paymentId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.Payment ORDER BY id",Integer.class);
            mvc.perform(get("/api/payments/{id}",paymentId).header("Authorization","Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(2));
            mvc.perform(get("/api/payments/{id}/pdf",paymentId).header("Authorization","Bearer " + token))
                    .andExpect(status().isOk()).andExpect(content().contentType("application/pdf"));
            mvc.perform(get("/api/payments/{id}",-1).header("Authorization","Bearer " + token))
                    .andExpect(status().isNotFound());
            mvc.perform(get("/api/payments/{id}",paymentId)).andExpect(status().isUnauthorized());
            mvc.perform(get("/api/reports/debts").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        } finally { sessions.revoke(token); }
    }

    private String tokenFor(String role) {
        int id = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.App_User WHERE role=? AND active=1 ORDER BY id", Integer.class, role);
        return sessions.issue(users.byId(id).orElseThrow());
    }
}
