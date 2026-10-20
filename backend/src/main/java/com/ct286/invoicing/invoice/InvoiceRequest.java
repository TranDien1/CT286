package com.ct286.invoicing.invoice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record InvoiceRequest(Integer partnerId, LocalDate invoiceDate, LocalDate invoiceDateDue,
                             LocalDate accountingDate, String notes, List<Line> lines) {
    public record Line(Integer productId, BigDecimal quantity, BigDecimal priceUnit, Integer taxId) { }
}
