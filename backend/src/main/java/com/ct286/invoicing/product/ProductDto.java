package com.ct286.invoicing.product;

import java.math.BigDecimal;

public record ProductDto(int id, String code, String name, int categoryId, String uom,
                         BigDecimal salePrice, BigDecimal costPrice, Integer saleTaxId,
                         Integer purchaseTaxId, boolean active, boolean usedInTransactions) { }
