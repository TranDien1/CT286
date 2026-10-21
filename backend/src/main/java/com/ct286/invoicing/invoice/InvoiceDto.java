package com.ct286.invoicing.invoice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record InvoiceDto(int id, String name, String entryType, String state, Reference journal,
                         Reference partner, Reference createdBy, LocalDate invoiceDate,
                         LocalDate invoiceDateDue, LocalDate accountingDate, BigDecimal amountUntaxed,
                         BigDecimal amountTax, BigDecimal amountTotal, String paymentState,
                         String notes, LocalDateTime createdAt, List<Line> lines, List<Item> items) {
    public record Reference(int id, String name, String code) { }
    public record Line(int id, int productId, BigDecimal quantity, BigDecimal priceUnit, Integer taxId) { }
    public record Item(int id, String displayType, int accountId, String accountCode, String name,
                       Integer productId, Integer taxId, Integer taxLineId, BigDecimal quantity,
                       BigDecimal priceUnit, BigDecimal debit, BigDecimal credit, boolean reconciled) { }
}
