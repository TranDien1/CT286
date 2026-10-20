package com.ct286.invoicing.user;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
class UserController {
    record LoginRequest(String identifier, String password) { }
    record PasswordChangeRequest(String oldPassword, String newPassword) { }
    record CreateUserRequest(String userName, String fullName, String email, String password) { }
    record ActiveRequest(Boolean active) { }
    record ResetPasswordRequest(String newPassword) { }
    private final UserService users;
    private final SessionRegistry sessions;
    UserController(UserService users, SessionRegistry sessions) { this.users = users; this.sessions = sessions; }

    @PostMapping("/auth/login") UserService.LoginResult login(@RequestBody LoginRequest body) { return users.login(body.identifier(), body.password()); }
    @GetMapping("/auth/me") UserDto me(HttpServletRequest request) { return actor(request).dto(); }
    @PostMapping("/auth/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request) { sessions.revoke((String) request.getAttribute(AuthInterceptor.TOKEN_ATTRIBUTE)); }
    @PostMapping("/auth/change-password") UserService.LoginResult changePassword(HttpServletRequest request, @RequestBody PasswordChangeRequest body) {
        return users.changePassword(actor(request), body.oldPassword(), body.newPassword());
    }
    @GetMapping("/users") List<UserDto> list(HttpServletRequest request) { return users.list(actor(request)); }
    @PostMapping("/users/accountants") @ResponseStatus(HttpStatus.CREATED)
    UserDto create(HttpServletRequest request, @RequestBody CreateUserRequest body) { return users.create(actor(request), body.userName(), body.fullName(), body.email(), body.password()); }
    @PatchMapping("/users/{id}/active") UserDto active(HttpServletRequest request, @PathVariable int id, @RequestBody ActiveRequest body) {
        if (body.active() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cần cung cấp trạng thái active.");
        return users.setActive(actor(request), id, body.active());
    }
    @PostMapping("/users/{id}/reset-password") UserDto reset(HttpServletRequest request, @PathVariable int id, @RequestBody ResetPasswordRequest body) {
        return users.resetPassword(actor(request), id, body.newPassword());
    }
    private UserData actor(HttpServletRequest request) { return (UserData) request.getAttribute(AuthInterceptor.USER_ATTRIBUTE); }
}
