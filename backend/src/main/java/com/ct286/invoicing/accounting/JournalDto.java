package com.ct286.invoicing.accounting;

public record JournalDto(int id, String code, String name, String type,
                         AccountDto defaultAccount, AccountDto counterpartAccount) { }
