package com.ct286.invoicing.accounting;

import java.util.List;

public record AccountingConfigDto(List<AccountDto> accounts, List<JournalDto> journals) { }
