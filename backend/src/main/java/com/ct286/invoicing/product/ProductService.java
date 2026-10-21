package com.ct286.invoicing.product;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class ProductService {
    private static final BigDecimal MAX_PRICE = new BigDecimal("9999999999999999.99");
    private final ProductRepository repo;
    ProductService(ProductRepository repo) { this.repo = repo; }
    List<ProductDto> products() { return repo.products(); }
    List<CategoryDto> categories() { return repo.categories(); }
    ProductDto product(int id) { return repo.product(id).orElseThrow(() -> notFound("sản phẩm")); }
    CategoryDto category(int id) { return repo.category(id).orElseThrow(() -> notFound("nhóm sản phẩm")); }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    ProductDto createProduct(ProductRequest input, String role) {
        requireAccountant(role);
        return product(repo.insertProduct(validateProduct(input, 0)));
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    ProductDto updateProduct(int id, ProductRequest input, String role) {
        requireAccountant(role); product(id);
        repo.updateProduct(id, validateProduct(input, id));
        return product(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    ProductDto setActive(int id, Boolean active, String role) {
        requireAccountant(role);
        if (active == null) throw bad("Vui lòng chọn trạng thái.");
        product(id); repo.setActive(id, active); return product(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    void deleteProduct(int id, String role) {
        requireAccountant(role);
        if (product(id).usedInTransactions()) throw conflict("Sản phẩm đã dùng trong giao dịch, hãy ngừng hoạt động thay vì xóa.");
        try { repo.deleteProduct(id); }
        catch (DataIntegrityViolationException ex) { throw conflict("Sản phẩm đang được dữ liệu khác sử dụng, không thể xóa."); }
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    CategoryDto createCategory(CategoryRequest input, String role) {
        requireAccountant(role);
        return category(repo.insertCategory(validateCategory(input, 0)));
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    CategoryDto updateCategory(int id, CategoryRequest input, String role) {
        requireAccountant(role); category(id);
        repo.updateCategory(id, validateCategory(input, id)); return category(id);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    void deleteCategory(int id, String role) {
        requireAccountant(role);
        if (category(id).productCount() > 0) throw conflict("Nhóm đang có sản phẩm nên không thể xóa.");
        try { repo.deleteCategory(id); }
        catch (DataIntegrityViolationException ex) { throw conflict("Nhóm đang được dữ liệu khác sử dụng, không thể xóa."); }
    }
    private ProductRequest validateProduct(ProductRequest p, int id) {
        if (p == null) throw bad("Dữ liệu sản phẩm không hợp lệ.");
        String code = required(p.code(), 32, "Mã sản phẩm");
        String name = required(p.name(), 255, "Tên sản phẩm");
        String uom = required(p.uom(), 32, "Đơn vị tính");
        if (p.categoryId() == null) throw bad("Vui lòng chọn nhóm sản phẩm.");
        category(p.categoryId());
        validPrice(p.salePrice(), "Giá bán"); validPrice(p.costPrice(), "Giá mua");
        if (p.saleTaxId() != null && !repo.taxMatches(p.saleTaxId(), "sale")) throw bad("Thuế bán không tồn tại hoặc không đúng loại.");
        if (p.purchaseTaxId() != null && !repo.taxMatches(p.purchaseTaxId(), "purchase")) throw bad("Thuế mua không tồn tại hoặc không đúng loại.");
        if (repo.productCodeExists(code, id)) throw conflict("Mã sản phẩm đã tồn tại.");
        if (repo.productNameExists(name, id)) throw conflict("Đã có sản phẩm cùng tên.");
        return new ProductRequest(code,name,p.categoryId(),uom,p.salePrice(),p.costPrice(),p.saleTaxId(),p.purchaseTaxId());
    }
    private CategoryRequest validateCategory(CategoryRequest c, int id) {
        if (c == null) throw bad("Dữ liệu nhóm không hợp lệ.");
        String name = required(c.name(), 128, "Tên nhóm");
        if (repo.categoryNameExists(name, id)) throw conflict("Đã có nhóm cùng tên.");
        if (c.salesAccountId() == null || !repo.accountMatches(c.salesAccountId(), "income", "511")) throw bad("Vui lòng chọn tài khoản bán 511 (Doanh thu bán hàng).");
        if (c.purchaseAccountId() == null || !repo.accountMatches(c.purchaseAccountId(), "asset", "156")) throw bad("Vui lòng chọn tài khoản mua 156 (Hàng hóa).");
        return new CategoryRequest(name,c.salesAccountId(),c.purchaseAccountId());
    }
    private String required(String value, int max, String label) {
        if (value == null || value.isBlank()) throw bad("Vui lòng nhập " + label.toLowerCase() + ".");
        String result = value.trim();
        if (result.length() > max) throw bad(label + " tối đa " + max + " ký tự.");
        return result;
    }
    private void validPrice(BigDecimal value, String label) {
        if (value == null || value.signum() < 0 || value.compareTo(MAX_PRICE) > 0 || value.stripTrailingZeros().scale() > 2)
            throw bad(label + " phải không âm và tối đa 2 chữ số thập phân.");
    }
    private void requireAccountant(String role) {
        if (!"accountant".equals(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ kế toán được quản lý danh mục.");
    }
    private ResponseStatusException notFound(String name) { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy " + name + "."); }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
}
