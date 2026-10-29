package com.ct286.invoicing.user;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.server.ResponseStatusException;

class AuthInterceptorTest {
    private final SessionRegistry sessions = mock(SessionRegistry.class);
    private final AuthInterceptor interceptor = new AuthInterceptor(sessions);
    private final HttpServletResponse response = new MockHttpServletResponse();

    @Test
    void adminCannotReadBusinessDataButCanReadConfiguration() throws Exception {
        when(sessions.resolve("admin-token")).thenReturn(new UserData(1, "admin", "Admin", null, null, "hash", "admin", true));
        for (String path : new String[] {"/api/invoices", "/api/invoices/1", "/api/journal-entries", "/api/journal-entries/1", "/api/payments", "/api/reports/debts"}) {
            var error = assertThrows(ResponseStatusException.class, () -> interceptor.preHandle(request(path, "admin-token"), response, new Object()));
            assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        }
        assertTrue(interceptor.preHandle(request("/api/accounting-config", "admin-token"), response, new Object()));
        assertTrue(interceptor.preHandle(request("/api/users", "admin-token"), response, new Object()));
    }

    @Test
    void accountantCanReadBusinessData() throws Exception {
        when(sessions.resolve("accountant-token")).thenReturn(new UserData(2, "accountant", "Kế toán", null, null, "hash", "accountant", true));
        assertTrue(interceptor.preHandle(request("/api/invoices", "accountant-token"), response, new Object()));
        assertTrue(interceptor.preHandle(request("/api/journal-entries", "accountant-token"), response, new Object()));
        assertTrue(interceptor.preHandle(request("/api/payments", "accountant-token"), response, new Object()));
        assertTrue(interceptor.preHandle(request("/api/reports/debts", "accountant-token"), response, new Object()));
    }

    private MockHttpServletRequest request(String path, String token) {
        var request = new MockHttpServletRequest("GET", path);
        request.setServletPath(path);
        request.addHeader("Authorization", "Bearer " + token);
        return request;
    }
}
