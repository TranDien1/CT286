package com.ct286.invoicing.user;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
class SessionRegistry {
    private record Session(int userId, String passwordHash, Instant expiresAt) { }
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final UserRepository users;

    SessionRegistry(UserRepository users) { this.users = users; }

    String issue(UserData user) {
        sessions.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(Instant.now()));
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.put(token, new Session(user.id(), user.passwordHash(), Instant.now().plusSeconds(8 * 3600)));
        return token;
    }

    UserData resolve(String token) {
        Session session = sessions.get(token);
        if (session == null) return null;
        if (!session.expiresAt().isAfter(Instant.now())) { sessions.remove(token); return null; }
        UserData user = users.byId(session.userId()).orElse(null);
        if (user == null || !user.active() || !session.passwordHash().equals(user.passwordHash())) {
            sessions.remove(token);
            return null;
        }
        return user;
    }

    void revoke(String token) { sessions.remove(token); }
    void revokeUser(int id) { sessions.entrySet().removeIf(entry -> entry.getValue().userId() == id); }
}
