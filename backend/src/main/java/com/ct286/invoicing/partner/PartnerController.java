package com.ct286.invoicing.partner;

import com.ct286.invoicing.user.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/partners")
class PartnerController {
    record ActiveRequest(Boolean active) { }
    private final PartnerService service;
    PartnerController(PartnerService service) { this.service = service; }
    @GetMapping List<PartnerDto> list(@RequestParam(required = false) String type, @RequestParam(required = false) Boolean active) {
        return service.list(type, active);
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    PartnerDto create(@RequestBody PartnerRequest body, HttpServletRequest request) {
        return service.create(body, AuthInterceptor.currentUser(request).role());
    }
    @PutMapping("/{id}") PartnerDto update(@PathVariable int id, @RequestBody PartnerRequest body, HttpServletRequest request) {
        return service.update(id, body, AuthInterceptor.currentUser(request).role());
    }
    @PatchMapping("/{id}/active") PartnerDto active(@PathVariable int id, @RequestBody ActiveRequest body, HttpServletRequest request) {
        return service.setActive(id, body.active(), AuthInterceptor.currentUser(request).role());
    }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable int id, HttpServletRequest request) {
        service.delete(id, AuthInterceptor.currentUser(request).role());
    }
}
