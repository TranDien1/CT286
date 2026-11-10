package com.ct286.invoicing.payment;

import com.ct286.invoicing.user.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
class PaymentController {
    private final PaymentService service;
    private final PaymentPdfService pdfs;
    PaymentController(PaymentService service, PaymentPdfService pdfs) {
        this.service = service;
        this.pdfs = pdfs;
    }
    @GetMapping List<PaymentDto> list() { return service.list(); }
    @GetMapping("/{id}") PaymentDetailDto detail(@PathVariable int id, HttpServletRequest http) {
        return service.detail(id,AuthInterceptor.currentUser(http));
    }
    @GetMapping(value = "/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    ResponseEntity<byte[]> download(@PathVariable int id, HttpServletRequest http) {
        PaymentPdfService.Download result = pdfs.download(id,AuthInterceptor.currentUser(http));
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(result.filename(),StandardCharsets.UTF_8).build().toString())
                .contentLength(result.pdf().length).body(result.pdf());
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    PaymentDto create(@RequestBody PaymentRequest request, HttpServletRequest http) {
        return service.create(request,AuthInterceptor.currentUser(http));
    }
}
