package com.ct286.invoicing.user;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class UserService {
    record LoginResult(String token, UserDto user) { }
    private final UserRepository users;
    private final SessionRegistry sessions;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    UserService(UserRepository users, SessionRegistry sessions) { this.users = users; this.sessions = sessions; }

    LoginResult login(String identifier, String password) {
        String value = identifier == null ? "" : identifier.trim();
        UserData user = users.byName(value).orElse(null);
        if (user == null) {
            List<UserData> matches = users.byEmail(value);
            if (matches.size() == 1) user = matches.get(0);
        }
        if (user == null || !user.active() || password == null || !passwords.matches(password, user.passwordHash()))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tên đăng nhập, mật khẩu hoặc trạng thái tài khoản không hợp lệ.");
        return new LoginResult(sessions.issue(user), user.dto());
    }

    List<UserDto> list(UserData actor) { requireAdmin(actor); return users.all().stream().map(UserData::dto).toList(); }

    @Transactional
    UserDto create(UserData actor, String userName, String fullName, String email, String password) {
        requireAdmin(actor);
        String name = userName == null ? "" : userName.trim();
        String full = fullName == null ? "" : fullName.trim();
        String mail = email == null || email.isBlank() ? null : email.trim();
        if (!name.matches("[a-zA-Z0-9_.]{3,30}") || full.isEmpty() || full.length() > 255 ||
                (mail != null && (mail.length() > 255 || !mail.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"))))
            throw bad("Thông tin tài khoản không hợp lệ.");
        checkPassword(password);
        if (users.byName(name).isPresent() || (mail != null && !users.byEmail(mail).isEmpty())) throw bad("Tên đăng nhập hoặc email đã được sử dụng.");
        users.insert(name, full, mail, passwords.encode(password), "accountant");
        return users.byName(name).orElseThrow().dto();
    }

    @Transactional
    UserDto setActive(UserData actor, int id, boolean active) {
        UserData target = accountant(actor, id);
        users.setActive(target.id(), active);
        if (!active) sessions.revokeUser(id);
        return users.byId(id).orElseThrow().dto();
    }

    @Transactional
    UserDto resetPassword(UserData actor, int id, String password) {
        UserData target = accountant(actor, id);
        checkPassword(password);
        users.setPassword(id, passwords.encode(password));
        sessions.revokeUser(id);
        return users.byId(target.id()).orElseThrow().dto();
    }

    @Transactional
    LoginResult changePassword(UserData actor, String oldPassword, String newPassword) {
        if (oldPassword == null || !passwords.matches(oldPassword, actor.passwordHash())) throw bad("Mật khẩu hiện tại không đúng.");
        checkPassword(newPassword);
        if (oldPassword.equals(newPassword)) throw bad("Mật khẩu mới phải khác mật khẩu hiện tại.");
        users.setPassword(actor.id(), passwords.encode(newPassword));
        sessions.revokeUser(actor.id());
        UserData updated = users.byId(actor.id()).orElseThrow();
        return new LoginResult(sessions.issue(updated), updated.dto());
    }

    @Transactional
    public void seed(String adminPassword, String accountantPassword, String accountant2Password) {
        checkPassword(adminPassword); checkPassword(accountantPassword); checkPassword(accountant2Password);
        for (String name : List.of("admin", "ketoan", "ketoan2")) {
            if (users.byName(name).isPresent()) throw new IllegalStateException("Tài khoản mẫu đã tồn tại: " + name + ". Không ghi đè.");
        }
        users.insert("admin", "Quản trị viên", null, passwords.encode(adminPassword), "admin");
        users.insert("ketoan", "Kế toán 1", null, passwords.encode(accountantPassword), "accountant");
        users.insert("ketoan2", "Kế toán 2", null, passwords.encode(accountant2Password), "accountant");
    }

    private UserData accountant(UserData actor, int id) {
        requireAdmin(actor);
        UserData target = users.byId(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản."));
        if (target.id() == actor.id() || !"accountant".equals(target.role())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ được quản lý tài khoản kế toán.");
        return target;
    }
    private void requireAdmin(UserData actor) { if (!"admin".equals(actor.role())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ Admin được quản lý tài khoản."); }
    private void checkPassword(String password) {
        if (password == null || password.length() < 6 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw bad("Mật khẩu phải có ít nhất 6 ký tự và tối đa 72 byte UTF-8.");
    }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
