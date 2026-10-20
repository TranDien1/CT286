package com.ct286.invoicing.tax;

import com.ct286.invoicing.user.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/taxes")
class TaxController {
    private final TaxService service;
    TaxController(TaxService service) { this.service = service; }
    @GetMapping List<TaxDto> list(@RequestParam(required = false) String use) { return service.list(use); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    TaxDto create(@RequestBody TaxRequest body, HttpServletRequest request) {
        return service.create(body, AuthInterceptor.currentUser(request).role());
    }
    @PutMapping("/{id}") TaxDto update(@PathVariable int id, @RequestBody TaxRequest body, HttpServletRequest request) {
        return service.update(id, body, AuthInterceptor.currentUser(request).role());
    }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable int id, HttpServletRequest request) {
        service.delete(id, AuthInterceptor.currentUser(request).role());
    }
}
