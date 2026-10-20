package com.ct286.invoicing.payment;

import java.time.LocalDate;

public record PaymentRequest(Integer invoiceId, LocalDate paymentDate) { }
