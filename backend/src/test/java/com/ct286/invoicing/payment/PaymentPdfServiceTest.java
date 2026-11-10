package com.ct286.invoicing.payment;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class PaymentPdfServiceTest {
    private final PaymentService payments = mock(PaymentService.class);
    private final PaymentPdfRenderer renderer = mock(PaymentPdfRenderer.class);
    private final PaymentPdfService service = new PaymentPdfService(payments,renderer);
    private final UserDto accountant = new UserDto(2,"kt","Kế toán",null,null,"accountant",true);
    private static final BigDecimal AMOUNT = new BigDecimal("1000000");

    @Test void downloadsPostedReceiptAndDisbursementWithStoredAccounts() {
        when(renderer.render(any())).thenReturn("%PDF-test".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        when(payments.detail(7,accountant)).thenReturn(detail("inbound","posted",AMOUNT));
        when(payments.detail(8,accountant)).thenReturn(detail("outbound","posted",AMOUNT));
        assertEquals("phieu-thu-CSH-2026-0007.pdf",service.download(7,accountant).filename());
        assertEquals("phieu-chi-CSH-2026-0007.pdf",service.download(8,accountant).filename());
        verify(renderer,times(2)).render(any());
    }

    @Test void rejectsUnpostedOrUnbalancedVoucher() {
        when(payments.detail(7,accountant)).thenReturn(detail("inbound","draft",AMOUNT));
        assertEquals(HttpStatus.CONFLICT,assertThrows(ResponseStatusException.class,
                () -> service.download(7,accountant)).getStatusCode());
        PaymentDetailDto wrong = detail("outbound","posted",new BigDecimal("900000"));
        when(payments.detail(8,accountant)).thenReturn(wrong);
        assertEquals(HttpStatus.CONFLICT,assertThrows(ResponseStatusException.class,
                () -> service.download(8,accountant)).getStatusCode());
        verifyNoInteractions(renderer);
    }

    static PaymentDetailDto detail(String type, String state, BigDecimal amount) {
        boolean inbound = "inbound".equals(type);
        String invoiceName = inbound ? "INV/2026/0017" : "BILL/2026/0017";
        List<PaymentDetailDto.Item> items = List.of(
                new PaymentDetailDto.Item(1,"111","Tiền mặt",(inbound ? "Thu tiền " : "Chi tiền ") + invoiceName,
                        "cash",inbound ? AMOUNT : BigDecimal.ZERO,inbound ? BigDecimal.ZERO : AMOUNT,false),
                new PaymentDetailDto.Item(2,inbound ? "131" : "331",inbound ? "Phải thu khách hàng" : "Phải trả nhà cung cấp",
                        "Tất toán " + invoiceName,"payment_term",inbound ? BigDecimal.ZERO : AMOUNT,
                        inbound ? AMOUNT : BigDecimal.ZERO,true));
        return new PaymentDetailDto(7,44,17,"CSH/2026/0007",type,amount,LocalDate.of(2026,10,29),
                new PaymentDto.Reference(3,"Tiền mặt","CSH"),
                new PaymentDto.Reference(6,"Công ty TNHH Công nghệ Thành Công",null),
                new PaymentDto.Reference(2,"Kế toán",null),invoiceName,inbound ? "out_invoice" : "in_invoice",
                LocalDateTime.of(2026,10,29,14,30),state,"Thanh toán đủ hóa đơn " + invoiceName,
                "Một triệu đồng","0312345678","123 Nguyễn Huệ, TP. Hồ Chí Minh",true,items);
    }
}
