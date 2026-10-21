package com.ct286.invoicing.accounting;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
class AccountingController {
    private final AccountingService service;
    AccountingController(AccountingService service) { this.service = service; }

    @GetMapping("/accounts") List<AccountDto> accounts() { return service.accounts(); }
    @GetMapping("/journals") List<JournalDto> journals() { return service.journals(); }
    @GetMapping("/accounting-config") AccountingConfigDto config() { return service.config(); }
}
