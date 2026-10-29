package com.ct286.invoicing.accounting;

import com.ct286.invoicing.user.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    @PutMapping("/accounts/{id}") AccountDto updateAccount(@PathVariable int id, @RequestBody AccountUpdateRequest body, HttpServletRequest request) {
        return service.updateAccount(id, body, AuthInterceptor.currentUser(request).role());
    }

    @PutMapping("/journals/{id}") JournalDto updateJournal(@PathVariable int id, @RequestBody JournalUpdateRequest body, HttpServletRequest request) {
        return service.updateJournal(id, body, AuthInterceptor.currentUser(request).role());
    }
}
