package com.ct286.invoicing.accounting;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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

    @Transactional(isolation = Isolation.SERIALIZABLE)
    AccountDto updateAccount(int id, AccountUpdateRequest request, String role) {
        requireAdmin(role);
        AccountDto old = repository.accounts().stream().filter(account -> account.id() == id).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản."));
        String name = requiredName(request == null ? null : request.name(), 255, "tài khoản");
        if (repository.accounts().stream().anyMatch(account -> account.id() != id && account.name().equalsIgnoreCase(name)))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên tài khoản đã tồn tại.");
        repository.updateAccountName(old.id(), name);
        return repository.accounts().stream().filter(account -> account.id() == id).findFirst().orElseThrow();
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    JournalDto updateJournal(int id, JournalUpdateRequest request, String role) {
        requireAdmin(role);
        JournalDto old = repository.journals().stream().filter(journal -> journal.id() == id).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sổ nhật ký."));
        String name = requiredName(request == null ? null : request.name(), 128, "sổ nhật ký");
        if (repository.journals().stream().anyMatch(journal -> journal.id() != id && journal.name().equalsIgnoreCase(name)))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên sổ nhật ký đã tồn tại.");
        Integer accountId = request.defaultAccountId();
        AccountDto account = repository.accounts().stream().filter(a -> accountId != null && a.id() == accountId).findFirst().orElse(null);
        if (accountId != null && account == null) throw bad("Tài khoản mặc định không tồn tại.");
        String expectedType = switch (old.type()) {
            case "sale" -> "income";
            case "purchase" -> "asset";
            case "cash" -> "cash";
            default -> null;
        };
        if (expectedType != null && (account == null || !expectedType.equals(account.accountType())))
            throw bad("Tài khoản mặc định không phù hợp với loại sổ.");
        if ("CSH".equals(old.code()) && (account == null || !"111".equals(account.code())))
            throw bad("Sổ CSH phải dùng tài khoản 111.");
        repository.updateJournal(id, name, accountId);
        return repository.journals().stream().filter(journal -> journal.id() == id).findFirst().orElseThrow();
    }

    private void requireAdmin(String role) {
        if (!"admin".equals(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ Admin được sửa cấu hình kế toán.");
    }

    private String requiredName(String input, int maxLength, String subject) {
        if (input == null || input.isBlank()) throw bad("Vui lòng nhập tên " + subject + ".");
        String name = input.trim();
        if (name.length() > maxLength) throw bad("Tên " + subject + " tối đa " + maxLength + " ký tự.");
        return name;
    }

    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
