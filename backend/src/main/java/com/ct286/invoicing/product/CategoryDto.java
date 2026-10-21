package com.ct286.invoicing.product;

public record CategoryDto(int id, String name, Integer salesAccountId, Integer purchaseAccountId, int productCount) { }
