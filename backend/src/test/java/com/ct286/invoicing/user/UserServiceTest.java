package com.ct286.invoicing.user;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class UserServiceTest {
    private final UserRepository repo = mock(UserRepository.class);
    private final UserService service = new UserService(repo, mock(SessionRegistry.class));
    private final UserData admin = new UserData(1,"admin","Admin",null,null,"hash","admin",true);
    private final UserData accountant = new UserData(2,"kt","Kế toán",null,null,"hash","accountant",true);

    @Test void onlyAdminCanEditAccountantAndDuplicateEmailIsRejected() {
        when(repo.byId(2)).thenReturn(Optional.of(accountant));
        assertEquals(403, assertThrows(ResponseStatusException.class, () -> service.updateDetails(accountant, 2, "Tên", null)).getStatusCode().value());
        when(repo.byEmail("used@example.com")).thenReturn(List.of(new UserData(3,"other","Other","used@example.com",null,"hash","accountant",true)));
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.updateDetails(admin, 2, "Tên", "used@example.com")).getStatusCode().value());
        verify(repo, never()).updateDetails(anyInt(), anyString(), any());
    }
    @Test void adminCanUpdateDetailsWithoutChangingCredentials() {
        when(repo.byId(2)).thenReturn(Optional.of(accountant));
        service.updateDetails(admin, 2, " Tên mới ", "mail@example.com");
        verify(repo).updateDetails(2, "Tên mới", "mail@example.com");
        verify(repo, never()).setPassword(anyInt(), anyString());
    }
}
