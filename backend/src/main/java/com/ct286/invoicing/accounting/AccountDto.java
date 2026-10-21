package com.ct286.invoicing.accounting;

public record AccountDto(int id, String code, String name, String accountType, boolean reconcile) { }
