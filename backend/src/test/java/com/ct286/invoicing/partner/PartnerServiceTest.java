package com.ct286.invoicing.partner;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class PartnerServiceTest {
    private final PartnerRepository repository = mock(PartnerRepository.class);
    private final PartnerService service = new PartnerService(repository);
    private PartnerRequest request(String name, String type, String vat, String email) {
        return new PartnerRequest(name, type, vat, email, "", "", "");
    }
    private PartnerDto partner(boolean used) {
        return new PartnerDto(1, "Công ty", "customer", null, null, null, null, null, true, used);
    }
    @Test void adminCanManagePartners() {
        when(repository.insert(any())).thenReturn(1);
        when(repository.find(1)).thenReturn(Optional.of(partner(false)));
        service.create(request("Công ty", "customer", null, null), "admin");
        verify(repository).insert(any());
    }
    @Test void unknownRoleCannotWrite() {
        assertEquals(403, assertThrows(ResponseStatusException.class,
                () -> service.create(request("Công ty", "customer", null, null), "viewer")).getStatusCode().value());
        verifyNoInteractions(repository);
    }
    @Test void validatesInputs() {
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.create(request("", "customer", null, null), "accountant")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.create(request("Công ty", "none", null, null), "accountant")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.create(request("Công ty", "supplier", "123", null), "accountant")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> service.create(request("Công ty", "customer", null, "abc"), "accountant")).getStatusCode().value());
    }
    @Test void rejectsDuplicateNamesInSameType() {
        when(repository.nameExists("Công ty", "customer", 0)).thenReturn(true);
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.create(request(" Công ty ", "customer", null, null), "accountant")).getStatusCode().value());
    }
    @Test void usedPartnerCanAddRoleButCannotRemoveOldRoleOrBeDeleted() {
        when(repository.find(1)).thenReturn(Optional.of(partner(true)));
        service.update(1, request("Công ty", "both", null, null), "accountant");
        verify(repository).update(eq(1), argThat(p -> "both".equals(p.partnerType())));
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.update(1, request("Công ty", "supplier", null, null), "accountant")).getStatusCode().value());
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.delete(1, "accountant")).getStatusCode().value());
        service.setActive(1, false, "accountant");
        verify(repository).setActive(1, false);
        verify(repository, never()).delete(anyInt());
    }
    @Test void unusedPartnerCanBeDeleted() {
        when(repository.find(1)).thenReturn(Optional.of(partner(false)));
        service.delete(1, "accountant");
        verify(repository).delete(1);
    }
}
