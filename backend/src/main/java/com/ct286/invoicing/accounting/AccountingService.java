package com.ct286.invoicing.accounting;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class AccountingService {
    private final AccountingRepository repository;
    AccountingService(AccountingRepository repository) { this.repository = repository; }

    @Transactional(readOnly = true)
    List<AccountDto> accounts() { return repository.accounts(); }

    @Transactional(readOnly = true)
    List<JournalDto> journals() { return repository.journals(); }

    @Transactional(readOnly = true)
    AccountingConfigDto config() { return new AccountingConfigDto(repository.accounts(), repository.journals()); }
}
