package com.ct286.invoicing.payment;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.ct286.invoicing.user.AuthInterceptor;
import com.ct286.invoicing.user.UserDto;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.http.MediaType;

class PaymentControllerTest {
    @Test void returnsDetailAndPdfAttachmentWithNoStore() {
        PaymentService payments = mock(PaymentService.class);
        PaymentPdfService pdfs = mock(PaymentPdfService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        UserDto accountant = new UserDto(2,"kt","Kế toán",null,null,"accountant",true);
        PaymentDetailDto detail = PaymentPdfServiceTest.detail("inbound","posted",
                new java.math.BigDecimal("1000000"));
        byte[] pdf = "%PDF-test".getBytes(StandardCharsets.US_ASCII);
        when(payments.detail(7,accountant)).thenReturn(detail);
        when(pdfs.download(7,accountant)).thenReturn(new PaymentPdfService.Download(pdf,"phieu-thu-CSH-2026-0007.pdf"));
        try (MockedStatic<AuthInterceptor> auth = mockStatic(AuthInterceptor.class)) {
            auth.when(() -> AuthInterceptor.currentUser(request)).thenReturn(accountant);
            PaymentController controller = new PaymentController(payments,pdfs);
            assertSame(detail,controller.detail(7,request));
            var response = controller.download(7,request);
            assertEquals(MediaType.APPLICATION_PDF,response.getHeaders().getContentType());
            assertTrue(response.getHeaders().getFirst("Content-Disposition").contains("phieu-thu-CSH-2026-0007.pdf"));
            assertTrue(response.getHeaders().getCacheControl().contains("no-store"));
            assertArrayEquals(pdf,response.getBody());
        }
    }
}
