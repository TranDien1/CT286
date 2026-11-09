package com.ct286.invoicing.invoice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

record InvoicePdfData(String number, String title, LocalDate invoiceDate, LocalDate dueDate,
                      String sellerName, String sellerVat, String sellerAddress,
                      String buyerName, String buyerVat, String buyerAddress,
                      String paymentState, String notes, List<Line> lines,
                      List<TaxTotal> taxes, BigDecimal untaxed, BigDecimal tax, BigDecimal total) {
    record Line(String description, BigDecimal quantity, BigDecimal unitPrice,
                BigDecimal taxRate, BigDecimal subtotal) { }
    record TaxTotal(String name, BigDecimal amount) { }
}
