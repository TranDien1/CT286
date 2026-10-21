package com.ct286.invoicing.invoice;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class InvoiceServiceTest {
    private final InvoiceRepository repo = mock(InvoiceRepository.class);
    private final InvoiceService service = new InvoiceService(repo);
    private final UserDto accountant = new UserDto(1,"a","A",null,null,"accountant",true);
    private final UserDto admin = new UserDto(2,"b","B",null,null,"admin",true);
    private InvoiceRequest request(LocalDate date, LocalDate due, List<InvoiceRequest.Line> lines) {
        return new InvoiceRequest(1,date,due,date,null,lines);
    }
    @Test void rejectsAdminAndInvalidDates() {
        assertEquals(403, assertThrows(ResponseStatusException.class, () -> service.create(request(LocalDate.now(),LocalDate.now(),List.of()),admin)).getStatusCode().value());
        when(repo.salesJournal()).thenReturn(Optional.of(new InvoiceRepository.Journal(1,4)));
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.create(request(LocalDate.now(),LocalDate.now().minusDays(1),List.of()),accountant)).getStatusCode().value());
    }
    @Test void rejectsWrongTaxOrExcessPrecision() {
        LocalDate date = LocalDate.now();
        when(repo.salesJournal()).thenReturn(Optional.of(new InvoiceRepository.Journal(1,4)));
        when(repo.partner(1)).thenReturn(Optional.of(new InvoiceRepository.Partner(1,true,true)));
        when(repo.receivableAccount()).thenReturn(2);
        when(repo.product(1)).thenReturn(Optional.of(new InvoiceRepository.Product(1,"Hàng",true,null)));
        when(repo.tax(1)).thenReturn(Optional.of(new InvoiceRepository.Tax(1,"Thuế mua",BigDecimal.TEN,"purchase",6)));
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.create(request(date,date,List.of(new InvoiceRequest.Line(1,BigDecimal.ONE,BigDecimal.TEN,1))),accountant)).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.create(request(date,date,List.of(new InvoiceRequest.Line(1,new BigDecimal("1.0001"),BigDecimal.TEN,1))),accountant)).getStatusCode().value());
        verify(repo, never()).insertHeader(any(),anyInt(),anyInt(),any(),any(),any());
    }
}
