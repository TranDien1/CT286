package com.ct286.invoicing.payment;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PaymentDto(int id, int entryId, int invoiceId, String name, String paymentType,
                         BigDecimal amount, LocalDate paymentDate, Reference journal, Reference partner,
                         Reference createdBy, String invoiceName, String invoiceType) {
    public record Reference(int id, String name, String code) { }
}
