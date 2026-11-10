package com.ct286.invoicing.payment;

import com.ct286.invoicing.user.UserDto;
import java.math.BigDecimal;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
class PaymentPdfService {
    record Download(byte[] pdf, String filename) { }
    private final PaymentService payments;
    private final PaymentPdfRenderer renderer;

    PaymentPdfService(PaymentService payments, PaymentPdfRenderer renderer) {
        this.payments = payments;
        this.renderer = renderer;
    }

    Download download(int id, UserDto actor) {
        PaymentDetailDto detail = payments.detail(id,actor);
        if (!"posted".equals(detail.state()) || detail.journal() == null
                || !"CSH".equals(detail.journal().code()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Chỉ in được phiếu tiền mặt đã ghi sổ.");
        if (detail.name() == null || detail.invoiceName() == null || detail.items().size() != 2)
            throw invalidEntry();
        boolean inbound = "inbound".equals(detail.paymentType());
        if (!inbound && !"outbound".equals(detail.paymentType())) throw invalidEntry();
        String debtCode = inbound ? "131" : "331";
        PaymentDetailDto.Item cash = detail.items().stream()
                .filter(item -> "cash".equals(item.displayType()) && "111".equals(item.accountCode()))
                .findFirst().orElseThrow(this::invalidEntry);
        PaymentDetailDto.Item debt = detail.items().stream()
                .filter(item -> "payment_term".equals(item.displayType()) && debtCode.equals(item.accountCode()))
                .findFirst().orElseThrow(this::invalidEntry);
        BigDecimal zero = BigDecimal.ZERO;
        if ((inbound ? cash.debit() : cash.credit()).compareTo(detail.amount()) != 0
                || (inbound ? cash.credit() : cash.debit()).compareTo(zero) != 0
                || (inbound ? debt.credit() : debt.debit()).compareTo(detail.amount()) != 0
                || (inbound ? debt.debit() : debt.credit()).compareTo(zero) != 0)
            throw invalidEntry();
        String prefix = inbound ? "phieu-thu-" : "phieu-chi-";
        String safeNumber = detail.name().replaceAll("[^A-Za-z0-9._-]","-");
        return new Download(renderer.render(detail),prefix + safeNumber + ".pdf");
    }

    private ResponseStatusException invalidEntry() {
        return new ResponseStatusException(HttpStatus.CONFLICT,"Bút toán phiếu thu/chi không cân hoặc không khớp số tiền.");
    }
}
