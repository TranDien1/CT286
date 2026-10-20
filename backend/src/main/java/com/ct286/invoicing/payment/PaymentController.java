package com.ct286.invoicing.payment;

import com.ct286.invoicing.user.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
class PaymentController {
    private final PaymentService service;
    PaymentController(PaymentService service) { this.service = service; }
    @GetMapping List<PaymentDto> list() { return service.list(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    PaymentDto create(@RequestBody PaymentRequest request, HttpServletRequest http) {
        return service.create(request,AuthInterceptor.currentUser(http));
    }
}
