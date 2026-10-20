package com.ct286.invoicing.tax;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.ct286.invoicing.accounting.AccountDto;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class TaxServiceTest {
    private final TaxRepository repository = mock(TaxRepository.class);
    private final TaxService service = new TaxService(repository);
    private final AccountDto account = new AccountDto(6, "3331", "Thuế", "liability", false);
    private TaxDto tax(boolean used, boolean productDefault) {
        return new TaxDto(1, "VAT", new BigDecimal("10.0000"), "sale", account, used, productDefault);
    }
    private TaxRequest request(String name, String amount, String type, Integer accountId) {
        return new TaxRequest(name, new BigDecimal(amount), type, accountId);
    }
    @BeforeEach void setup() { when(repository.accountExists(6)).thenReturn(true); }

    @Test void onlyAccountantCanWrite() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.create(request("VAT", "10", "sale", 6), "admin"));
        assertEquals(403, ex.getStatusCode().value());
        verifyNoInteractions(repository);
    }
    @Test void validatesPrecisionAndType() {
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.create(request("VAT", "1.12345", "sale", 6), "accountant")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.create(request("VAT", "10", "other", 6), "accountant")).getStatusCode().value());
    }
    @Test void rejectsDuplicateNames() {
        when(repository.nameExists("VAT", 0)).thenReturn(true);
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.create(request(" VAT ", "10", "sale", 6), "accountant")).getStatusCode().value());
    }
    @Test void usedTaxCanBeRenamedButNotChangeRate() {
        when(repository.find(1)).thenReturn(Optional.of(tax(true, false)));
        service.update(1, request("Tên mới", "10", "sale", 6), "accountant");
        verify(repository).update(eq(1), any());
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.update(1, request("VAT", "5", "sale", 6), "accountant")).getStatusCode().value());
    }
    @Test void productDefaultCannotBeChangedToIncompatibleTypeOrDeleted() {
        when(repository.find(1)).thenReturn(Optional.of(tax(false, true)));
        when(repository.incompatibleProductDefault(1, "purchase")).thenReturn(true);
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.update(1, request("VAT", "10", "purchase", 6), "accountant")).getStatusCode().value());
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.delete(1, "accountant")).getStatusCode().value());
        verify(repository, never()).delete(anyInt());
    }
    @Test void unusedTaxCanBeDeleted() {
        when(repository.find(1)).thenReturn(Optional.of(tax(false, false)));
        service.delete(1, "accountant");
        verify(repository).delete(1);
    }
}
