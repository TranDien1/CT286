package com.ct286.invoicing.payment;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class PaymentServiceTest {
    private final PaymentRepository repo = mock(PaymentRepository.class);
    private final PaymentService service = new PaymentService(repo);
    private final UserDto accountant = new UserDto(1,"a","A",null,null,"accountant",true);
    @Test void rejectsAdminAndDraft() {
        var request = new PaymentRequest(1,LocalDate.now());
        assertEquals(403,assertThrows(ResponseStatusException.class, () -> service.create(request,new UserDto(2,"b","B",null,null,"admin",true))).getStatusCode().value());
        when(repo.lockInvoice(1)).thenReturn(Optional.of(new PaymentRepository.Invoice(1,null,"out_invoice","draft","not_paid",1,BigDecimal.TEN)));
        assertEquals(409,assertThrows(ResponseStatusException.class, () -> service.create(request,accountant)).getStatusCode().value());
        verify(repo,never()).createEntry(anyString(),anyInt(),anyInt(),anyInt(),any());
    }
    @Test void rejectsInconsistentDebt() {
        when(repo.lockInvoice(1)).thenReturn(Optional.of(new PaymentRepository.Invoice(1,"INV/2026/0001","out_invoice","posted","not_paid",1,BigDecimal.TEN)));
        when(repo.debtItems(1,"131")).thenReturn(List.of(new PaymentRepository.DebtItem(3,2,BigDecimal.ONE,BigDecimal.ZERO,false)));
        assertEquals(409,assertThrows(ResponseStatusException.class, () -> service.create(new PaymentRequest(1,LocalDate.now()),accountant)).getStatusCode().value());
        verify(repo,never()).createEntry(anyString(),anyInt(),anyInt(),anyInt(),any());
    }
}
