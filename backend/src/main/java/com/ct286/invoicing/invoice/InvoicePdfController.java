package com.ct286.invoicing.invoice;

import com.ct286.invoicing.user.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/invoices")
class InvoicePdfController {
    private final InvoicePdfService service;

    InvoicePdfController(InvoicePdfService service) { this.service = service; }

    @GetMapping(value = "/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    ResponseEntity<byte[]> download(@PathVariable int id, HttpServletRequest request) {
        InvoicePdfService.Download download = service.download(id, AuthInterceptor.currentUser(request));
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(download.filename(), StandardCharsets.UTF_8).build().toString())
                .contentLength(download.pdf().length)
                .body(download.pdf());
    }
}
