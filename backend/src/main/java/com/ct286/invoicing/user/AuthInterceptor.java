package com.ct286.invoicing.user;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {
    static final String USER_ATTRIBUTE = "authenticatedUser";
    static final String TOKEN_ATTRIBUTE = "authenticatedToken";
    private final SessionRegistry sessions;
    AuthInterceptor(SessionRegistry sessions) { this.sessions = sessions; }

    public static UserDto currentUser(HttpServletRequest request) {
        UserData user = (UserData) request.getAttribute(USER_ATTRIBUTE);
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        return user.dto();
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equals(request.getMethod())) return true;
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) throw unauthorized();
        String token = authorization.substring(7);
        UserData user = sessions.resolve(token);
        if (user == null) throw unauthorized();
        request.setAttribute(USER_ATTRIBUTE, user);
        request.setAttribute(TOKEN_ATTRIBUTE, token);
        return true;
    }

    private ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    }
}
