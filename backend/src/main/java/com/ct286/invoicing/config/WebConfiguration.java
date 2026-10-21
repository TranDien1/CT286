package com.ct286.invoicing.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import com.ct286.invoicing.user.AuthInterceptor;

@Configuration
public class WebConfiguration implements WebMvcConfigurer {

    private final List<String> allowedOrigins;
    private final AuthInterceptor authInterceptor;

    public WebConfiguration(@Value("${app.cors.allowed-origins}") List<String> allowedOrigins, AuthInterceptor authInterceptor) {
        this.allowedOrigins = allowedOrigins;
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor).addPathPatterns("/api/**")
                .excludePathPatterns("/api/health", "/api/auth/login");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "Authorization")
                .maxAge(3600);
    }
}
