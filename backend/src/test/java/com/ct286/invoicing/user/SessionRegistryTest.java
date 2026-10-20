package com.ct286.invoicing.user;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class SessionRegistryTest {
    @Test
    void sessionIsRevokedWhenPasswordChangesOrAccountIsLocked() {
        UserRepository repository = mock(UserRepository.class);
        SessionRegistry sessions = new SessionRegistry(repository);
        UserData original = new UserData(2, "ketoan", "Kế toán", null, null, "old-hash", "accountant", true);
        when(repository.byId(2)).thenReturn(Optional.of(original));
        String first = sessions.issue(original);
        assertNotNull(sessions.resolve(first));
        when(repository.byId(2)).thenReturn(Optional.of(new UserData(2, "ketoan", "Kế toán", null, null, "new-hash", "accountant", true)));
        assertNull(sessions.resolve(first));
        String second = sessions.issue(original);
        when(repository.byId(2)).thenReturn(Optional.of(new UserData(2, "ketoan", "Kế toán", null, null, "old-hash", "accountant", false)));
        assertNull(sessions.resolve(second));
    }

    @Test
    void logoutInvalidatesOnlyTheChosenToken() {
        UserRepository repository = mock(UserRepository.class);
        SessionRegistry sessions = new SessionRegistry(repository);
        UserData user = new UserData(1, "admin", "Admin", null, null, "hash", "admin", true);
        when(repository.byId(1)).thenReturn(Optional.of(user));
        String first = sessions.issue(user);
        String second = sessions.issue(user);
        assertNotEquals(first, second);
        sessions.revoke(first);
        assertNull(sessions.resolve(first));
        assertNotNull(sessions.resolve(second));
        sessions.revokeUser(1);
        assertNull(sessions.resolve(second));
    }
}
