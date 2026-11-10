package com.ct286.invoicing.payment;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class PaymentDetailServiceTest {
    private final PaymentRepository repo = mock(PaymentRepository.class);
    private final PaymentService service = new PaymentService(repo);
    private final UserDto accountant = new UserDto(2,"kt","Kế toán",null,null,"accountant",true);
    private final UserDto admin = new UserDto(1,"admin","Admin",null,null,"admin",true);

    @Test void deniesAdminAndReturns404ForMissingPayment() {
        assertEquals(HttpStatus.FORBIDDEN,assertThrows(ResponseStatusException.class,
                () -> service.detail(9,admin)).getStatusCode());
        verifyNoInteractions(repo);
        assertEquals(HttpStatus.NOT_FOUND,assertThrows(ResponseStatusException.class,
                () -> service.detail(9,accountant)).getStatusCode());
    }

    @Test void exposesStoredVoucherAndDerivedReasonWithoutNewColumns() {
        PaymentDto base = new PaymentDto(9,44,17,"CSH/2026/0009","inbound",new BigDecimal("1000000"),
                LocalDate.of(2026,10,29),new PaymentDto.Reference(3,"Tiền mặt","CSH"),
                new PaymentDto.Reference(6,"Công ty Thành Công",null),
                new PaymentDto.Reference(2,"Kế toán",null),"INV/2026/0017","out_invoice");
        var items = List.of(new PaymentDetailDto.Item(1,"111","Tiền mặt","Thu tiền INV/2026/0017",
                        "cash",new BigDecimal("1000000"),BigDecimal.ZERO,false),
                new PaymentDetailDto.Item(2,"131","Phải thu","Tất toán INV/2026/0017",
                        "payment_term",BigDecimal.ZERO,new BigDecimal("1000000"),true));
        when(repo.findDetail(9)).thenReturn(Optional.of(new PaymentRepository.DetailData(base,
                LocalDateTime.of(2026,10,29,14,30),"posted","0312345678",
                "123 Nguyễn Huệ, TP. Hồ Chí Minh",true,items)));
        PaymentDetailDto detail = service.detail(9,accountant);
        assertEquals("Thanh toán đủ hóa đơn INV/2026/0017",detail.reason());
        assertEquals("Một triệu đồng",detail.amountWords());
        assertEquals("0312345678",detail.partnerVat());
        assertEquals("123 Nguyễn Huệ, TP. Hồ Chí Minh",detail.partnerAddress());
        assertEquals("posted",detail.state());
        assertTrue(detail.reconciled());
        assertEquals(items,detail.items());
    }
}
