package com.ct286.invoicing.invoice;

import com.ct286.invoicing.user.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/invoices")
class InvoiceController {
    private final InvoiceService service;
    InvoiceController(InvoiceService service) { this.service = service; }
    @GetMapping List<InvoiceDto> sales(@RequestParam String type) {
        if ("out_invoice".equals(type)) return service.listSales();
        if ("in_invoice".equals(type)) return service.listPurchases();
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Loại hóa đơn không hợp lệ.");
    }
    @GetMapping("/{id}") InvoiceDto get(@PathVariable int id) { return service.get(id); }
    @PostMapping("/sales") @ResponseStatus(HttpStatus.CREATED)
    InvoiceDto create(@RequestBody InvoiceRequest body, HttpServletRequest request) { return service.create(body,AuthInterceptor.currentUser(request)); }
    @PostMapping("/purchases") @ResponseStatus(HttpStatus.CREATED)
    InvoiceDto createPurchase(@RequestBody InvoiceRequest body, HttpServletRequest request) { return service.createPurchase(body,AuthInterceptor.currentUser(request)); }
    @PutMapping("/{id}") InvoiceDto update(@PathVariable int id, @RequestBody InvoiceRequest body, HttpServletRequest request) { return service.update(id,body,AuthInterceptor.currentUser(request)); }
    @PostMapping("/{id}/post") InvoiceDto post(@PathVariable int id, HttpServletRequest request) { return service.post(id,AuthInterceptor.currentUser(request)); }
    @PostMapping("/{id}/reset-to-draft") InvoiceDto reset(@PathVariable int id, HttpServletRequest request) { return service.reset(id,AuthInterceptor.currentUser(request)); }
    @PostMapping("/{id}/cancel") InvoiceDto cancel(@PathVariable int id, HttpServletRequest request) { return service.cancel(id,AuthInterceptor.currentUser(request)); }
}
