package com.ct286.invoicing.tax;

import java.math.BigDecimal;

public record TaxRequest(String name, BigDecimal amount, String typeTaxUse, Integer accountId) { }
