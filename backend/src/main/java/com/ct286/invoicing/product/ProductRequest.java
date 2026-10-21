package com.ct286.invoicing.product;

import java.math.BigDecimal;

public record ProductRequest(String code, String name, Integer categoryId, String uom,
                             BigDecimal salePrice, BigDecimal costPrice, Integer saleTaxId, Integer purchaseTaxId) { }
