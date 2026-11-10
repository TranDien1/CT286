package com.ct286.invoicing.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record PaymentDetailDto(int id, int entryId, int invoiceId, String name, String paymentType,
                               BigDecimal amount, LocalDate paymentDate, PaymentDto.Reference journal,
                               PaymentDto.Reference partner, PaymentDto.Reference createdBy,
                               String invoiceName, String invoiceType, LocalDateTime createdAt,
                               String state, String reason, String amountWords, String partnerVat,
                               String partnerAddress, boolean reconciled, List<Item> items) {
    public record Item(int id, String accountCode, String accountName, String label,
                       String displayType, BigDecimal debit, BigDecimal credit, boolean reconciled) { }
}
