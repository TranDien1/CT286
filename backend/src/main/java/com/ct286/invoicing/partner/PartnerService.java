package com.ct286.invoicing.partner;

import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class PartnerService {
    private final PartnerRepository repository;
    PartnerService(PartnerRepository repository) { this.repository = repository; }
    List<PartnerDto> list(String type, Boolean active) {
        if (type != null && !type.equals("customer") && !type.equals("supplier")) throw bad("Loại đối tác không hợp lệ.");
        return repository.list(type, active);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    PartnerDto create(PartnerRequest input, String role) {
        requireAccountant(role);
        return find(repository.insert(validate(input, 0)));
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    PartnerDto update(int id, PartnerRequest input, String role) {
        requireAccountant(role);
        PartnerDto old = find(id);
        PartnerRequest p = validate(input, id);
        if (old.usedInTransactions() && !old.partnerType().equals(p.partnerType()))
            throw conflict("Đối tác đã có giao dịch nên không đổi được loại.");
        repository.update(id, p);
        return find(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    PartnerDto setActive(int id, Boolean active, String role) {
        requireAccountant(role);
        if (active == null) throw bad("Vui lòng chọn trạng thái.");
        find(id);
        repository.setActive(id, active);
        return find(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    void delete(int id, String role) {
        requireAccountant(role);
        if (find(id).usedInTransactions()) throw conflict("Đối tác đã có giao dịch, hãy ngừng hoạt động thay vì xóa.");
        try { repository.delete(id); }
        catch (DataIntegrityViolationException ex) { throw conflict("Đối tác đang được dữ liệu khác sử dụng, không thể xóa."); }
    }
    private PartnerDto find(int id) {
        return repository.find(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đối tác."));
    }
    private PartnerRequest validate(PartnerRequest input, int exceptId) {
        if (input == null || input.name() == null || input.name().isBlank()) throw bad("Vui lòng nhập tên đối tác.");
        String name = input.name().trim();
        if (name.length() > 255) throw bad("Tên đối tác tối đa 255 ký tự.");
        if (!"customer".equals(input.partnerType()) && !"supplier".equals(input.partnerType())) throw bad("Loại đối tác không hợp lệ.");
        String vat = optional(input.vat(), 32, "Mã số thuế");
        String email = optional(input.email(), 255, "Email");
        String phone = optional(input.phone(), 32, "Điện thoại");
        String address = optional(input.address(), 255, "Địa chỉ");
        String city = optional(input.city(), 128, "Tỉnh/Thành");
        if (vat != null && !vat.matches("\\d{10}(-\\d{3})?")) throw bad("Mã số thuế gồm 10 chữ số hoặc 10 số kèm -XXX.");
        if (email != null && !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw bad("Email không hợp lệ.");
        if (repository.nameExists(name, input.partnerType(), exceptId)) throw conflict("Đã có đối tác cùng tên và cùng loại.");
        return new PartnerRequest(name, input.partnerType(), vat, email, phone, address, city);
    }
    private String optional(String value, int max, String label) {
        if (value == null || value.isBlank()) return null;
        String result = value.trim();
        if (result.length() > max) throw bad(label + " tối đa " + max + " ký tự.");
        return result;
    }
    private void requireAccountant(String role) {
        if (!"accountant".equals(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ kế toán được quản lý đối tác.");
    }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
}
