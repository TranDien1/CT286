package com.ct286.invoicing.tax;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class TaxService {
    private final TaxRepository repository;
    TaxService(TaxRepository repository) { this.repository = repository; }

    List<TaxDto> list(String use) {
        if (use != null && !use.equals("sale") && !use.equals("purchase")) throw bad("Loại thuế không hợp lệ.");
        return repository.list(use);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    TaxDto create(TaxRequest input, String role) {
        requireAccountant(role);
        TaxRequest request = validate(input, null);
        int id = repository.insert(request);
        return find(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    TaxDto update(int id, TaxRequest input, String role) {
        requireAccountant(role);
        TaxDto old = find(id);
        TaxRequest request = validate(input, old);
        Integer oldAccount = old.account() == null ? null : old.account().id();
        if (old.usedInTransactions() && (old.amount().compareTo(request.amount()) != 0
                || !old.typeTaxUse().equals(request.typeTaxUse()) || !Objects.equals(oldAccount, request.accountId()))) {
            throw conflict("Thuế đã dùng trong giao dịch chỉ được đổi tên.");
        }
        if (repository.incompatibleProductDefault(id, request.typeTaxUse()))
            throw conflict("Loại thuế không phù hợp với sản phẩm đang sử dụng mặc định.");
        repository.update(id, request);
        return find(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    void delete(int id, String role) {
        requireAccountant(role);
        TaxDto tax = find(id);
        if (tax.usedInTransactions() || tax.defaultForProduct())
            throw conflict("Không thể xóa thuế đã dùng trong giao dịch hoặc được sản phẩm sử dụng mặc định.");
        try { repository.delete(id); }
        catch (DataIntegrityViolationException ex) { throw conflict("Thuế đang được dữ liệu khác sử dụng, không thể xóa."); }
    }
    private TaxDto find(int id) {
        return repository.find(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy thuế."));
    }
    private TaxRequest validate(TaxRequest input, TaxDto old) {
        if (input == null || input.name() == null || input.name().trim().isEmpty()) throw bad("Vui lòng nhập tên thuế.");
        String name = input.name().trim();
        if (name.length() > 128) throw bad("Tên thuế tối đa 128 ký tự.");
        if (input.amount() == null || input.amount().compareTo(BigDecimal.ZERO) < 0
                || input.amount().compareTo(new BigDecimal("100")) > 0 || input.amount().stripTrailingZeros().scale() > 4)
            throw bad("Thuế suất phải từ 0 đến 100 và tối đa 4 chữ số thập phân.");
        if (!"sale".equals(input.typeTaxUse()) && !"purchase".equals(input.typeTaxUse())) throw bad("Loại thuế không hợp lệ.");
        boolean existingUsedWithoutAccount = old != null && old.usedInTransactions() && old.account() == null;
        if (input.accountId() == null && !existingUsedWithoutAccount) throw bad("Vui lòng chọn tài khoản thuế.");
        if (input.accountId() != null && !repository.accountExists(input.accountId())) throw bad("Tài khoản thuế không tồn tại.");
        if (repository.nameExists(name, old == null ? 0 : old.id())) throw conflict("Tên thuế đã tồn tại.");
        return new TaxRequest(name, input.amount(), input.typeTaxUse(), input.accountId());
    }
    private void requireAccountant(String role) {
        if (!"accountant".equals(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ kế toán được quản lý thuế.");
    }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
}
