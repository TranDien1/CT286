package com.ct286.invoicing.product;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
class ProductRepository {
    private final JdbcTemplate jdbc;
    ProductRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    private static final String PRODUCTS = """
            SELECT p.*, CASE WHEN EXISTS (SELECT 1 FROM dbo.Journal_Item i WHERE i.product_id=p.id)
                THEN 1 ELSE 0 END AS used_in_transactions FROM dbo.Product p
            """;
    private static final String CATEGORIES = """
            SELECT c.*, (SELECT COUNT(*) FROM dbo.Product p WHERE p.category_id=c.id) AS product_count
            FROM dbo.Product_Category c
            """;
    private static Integer nullableInt(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column); return rs.wasNull() ? null : value;
    }
    private final RowMapper<ProductDto> productMapper = (rs, row) -> new ProductDto(rs.getInt("id"),
            rs.getString("code"), rs.getString("name"), rs.getInt("category_id"), rs.getString("uom"),
            rs.getBigDecimal("sale_price"), rs.getBigDecimal("cost_price"), nullableInt(rs, "sale_tax_id"),
            nullableInt(rs, "purchase_tax_id"), rs.getBoolean("active"), rs.getBoolean("used_in_transactions"));
    private final RowMapper<CategoryDto> categoryMapper = (rs, row) -> new CategoryDto(rs.getInt("id"),
            rs.getString("name"), nullableInt(rs, "sales_account_id"), nullableInt(rs, "purchase_account_id"), rs.getInt("product_count"));
    List<ProductDto> products() { return jdbc.query(PRODUCTS + " ORDER BY p.name,p.id", productMapper); }
    Optional<ProductDto> product(int id) { return jdbc.query(PRODUCTS + " WHERE p.id=?", productMapper, id).stream().findFirst(); }
    List<CategoryDto> categories() { return jdbc.query(CATEGORIES + " ORDER BY c.name,c.id", categoryMapper); }
    Optional<CategoryDto> category(int id) { return jdbc.query(CATEGORIES + " WHERE c.id=?", categoryMapper, id).stream().findFirst(); }
    boolean productCodeExists(String code, int exceptId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Product WHERE LOWER(code)=LOWER(?) AND id<>?", Integer.class, code, exceptId) > 0;
    }
    boolean productNameExists(String name, int exceptId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Product WHERE LOWER(name)=LOWER(?) AND id<>?", Integer.class, name, exceptId) > 0;
    }
    boolean categoryNameExists(String name, int exceptId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Product_Category WHERE LOWER(name)=LOWER(?) AND id<>?", Integer.class, name, exceptId) > 0;
    }
    boolean accountExists(int id) { return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Account WHERE id=?", Integer.class, id) > 0; }
    boolean accountMatches(int id, String type, String code) { return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Account WHERE id=? AND account_type=? AND code=?", Integer.class, id, type, code) > 0; }
    boolean taxMatches(int id, String type) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM dbo.Tax WHERE id=? AND type_tax_use=?", Integer.class, id, type) > 0;
    }
    int insertProduct(ProductRequest p) {
        return jdbc.queryForObject("""
                INSERT INTO dbo.Product (code,name,category_id,uom,sale_price,cost_price,sale_tax_id,purchase_tax_id)
                OUTPUT INSERTED.id VALUES (?,?,?,?,?,?,?,?)
                """, Integer.class, p.code(),p.name(),p.categoryId(),p.uom(),p.salePrice(),p.costPrice(),p.saleTaxId(),p.purchaseTaxId());
    }
    void updateProduct(int id, ProductRequest p) {
        jdbc.update("""
                UPDATE dbo.Product SET code=?,name=?,category_id=?,uom=?,sale_price=?,cost_price=?,sale_tax_id=?,purchase_tax_id=? WHERE id=?
                """, p.code(),p.name(),p.categoryId(),p.uom(),p.salePrice(),p.costPrice(),p.saleTaxId(),p.purchaseTaxId(),id);
    }
    void setActive(int id, boolean active) { jdbc.update("UPDATE dbo.Product SET active=? WHERE id=?", active, id); }
    void deleteProduct(int id) { jdbc.update("DELETE FROM dbo.Product WHERE id=?", id); }
    int insertCategory(CategoryRequest c) {
        return jdbc.queryForObject("INSERT INTO dbo.Product_Category (name,sales_account_id,purchase_account_id) OUTPUT INSERTED.id VALUES (?,?,?)",
                Integer.class, c.name(),c.salesAccountId(),c.purchaseAccountId());
    }
    void updateCategory(int id, CategoryRequest c) {
        jdbc.update("UPDATE dbo.Product_Category SET name=?,sales_account_id=?,purchase_account_id=? WHERE id=?",
                c.name(),c.salesAccountId(),c.purchaseAccountId(),id);
    }
    void deleteCategory(int id) { jdbc.update("DELETE FROM dbo.Product_Category WHERE id=?", id); }
}
