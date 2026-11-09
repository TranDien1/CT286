package com.ct286.invoicing.invoice;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.ct286.invoicing.user.AuthInterceptor;
import com.ct286.invoicing.user.UserDto;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.http.MediaType;

class InvoicePdfControllerTest {
    @Test void returnsAttachmentWithNoStore() {
        InvoicePdfService service = mock(InvoicePdfService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        UserDto accountant = new UserDto(1, "kt", "Kế toán", null, null, "accountant", true);
        byte[] pdf = "%PDF-test".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        when(service.download(7, accountant))
                .thenReturn(new InvoicePdfService.Download(pdf, "hoa-don-ban-INV-2026-0007.pdf"));
        try (MockedStatic<AuthInterceptor> auth = mockStatic(AuthInterceptor.class)) {
            auth.when(() -> AuthInterceptor.currentUser(request)).thenReturn(accountant);
            var response = new InvoicePdfController(service).download(7, request);
            assertEquals(MediaType.APPLICATION_PDF, response.getHeaders().getContentType());
            assertTrue(response.getHeaders().getFirst("Content-Disposition").contains("hoa-don-ban-INV-2026-0007.pdf"));
            assertTrue(response.getHeaders().getCacheControl().contains("no-store"));
            assertArrayEquals(pdf, response.getBody());
        }
    }
}
