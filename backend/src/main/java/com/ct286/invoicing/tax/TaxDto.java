package com.ct286.invoicing.tax;

import com.ct286.invoicing.accounting.AccountDto;
import java.math.BigDecimal;

public record TaxDto(int id, String name, BigDecimal amount, String typeTaxUse,
                     AccountDto account, boolean usedInTransactions, boolean defaultForProduct) { }
