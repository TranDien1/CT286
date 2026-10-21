package com.ct286.invoicing.product;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@Transactional
@EnabledIfEnvironmentVariable(named = "RUN_SQL_TESTS", matches = "true")
class ProductSqlServerIntegrationTest {
    @Autowired ProductService service;
    @Autowired JdbcTemplate jdbc;
    @Test void categoryAndProductCrudAgainstSqlServer() {
        String name = "TEST-" + UUID.randomUUID();
        Integer account = jdbc.queryForObject("SELECT id FROM dbo.Account WHERE code='511'", Integer.class);
        Integer purchase = jdbc.queryForObject("SELECT id FROM dbo.Account WHERE code='156'", Integer.class);
        CategoryDto category = service.createCategory(new CategoryRequest(name, account, purchase), "accountant");
        CategoryDto renamed = service.updateCategory(category.id(), new CategoryRequest(name + "-new", category.salesAccountId(), category.purchaseAccountId()), "accountant");
        assertEquals(account, renamed.salesAccountId());
        ProductRequest input = new ProductRequest("T-" + UUID.randomUUID().toString().substring(0, 20), name, category.id(), "Cái", new BigDecimal("25.50"), BigDecimal.TEN, null, null);
        ProductDto product = service.createProduct(input, "accountant");
        assertEquals(1, service.category(category.id()).productCount());
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.deleteCategory(category.id(), "accountant")).getStatusCode().value());
        ProductDto updated = service.updateProduct(product.id(), new ProductRequest(input.code(), name + "-new", category.id(), "Hộp", BigDecimal.TEN, BigDecimal.ONE, null, null), "accountant");
        assertEquals("Hộp", updated.uom());
        assertFalse(service.setActive(product.id(), false, "accountant").active());
        service.deleteProduct(product.id(), "accountant");
        service.deleteCategory(category.id(), "accountant");
        assertTrue(service.products().stream().noneMatch(p -> p.id() == product.id()));
        assertTrue(service.categories().stream().noneMatch(c -> c.id() == category.id()));
    }
}
