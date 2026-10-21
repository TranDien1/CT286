package com.ct286.invoicing.product;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ProductServiceTest {
    private final ProductRepository repo = mock(ProductRepository.class);
    private final ProductService service = new ProductService(repo);
    private ProductRequest product(Integer cat, String price, Integer saleTax) {
        return new ProductRequest("CODE", "Tên", cat, "Cái", new BigDecimal(price), BigDecimal.ZERO, saleTax, null);
    }
    private CategoryDto category(int count) { return new CategoryDto(1, "Nhóm", 4, 5, count); }
    private ProductDto existing(boolean used) { return new ProductDto(1,"CODE","Tên",1,"Cái",BigDecimal.ZERO,BigDecimal.ZERO,null,null,true,used); }
    @Test void onlyAccountantCanWrite() {
        assertEquals(403, assertThrows(ResponseStatusException.class, () -> service.createProduct(product(1,"1",null), "admin")).getStatusCode().value());
        verifyNoInteractions(repo);
    }
    @Test void validatesRequiredGroupPricesAndTaxType() {
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.createProduct(product(null,"1",null), "accountant")).getStatusCode().value());
        when(repo.category(1)).thenReturn(Optional.of(category(0)));
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.createProduct(product(1,"1.234",null), "accountant")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.createProduct(product(1,"1",2), "accountant")).getStatusCode().value());
    }
    @Test void usedProductAndOccupiedCategoryCannotBeDeleted() {
        when(repo.product(1)).thenReturn(Optional.of(existing(true)));
        when(repo.category(1)).thenReturn(Optional.of(category(2)));
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.deleteProduct(1, "accountant")).getStatusCode().value());
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.deleteCategory(1, "accountant")).getStatusCode().value());
        verify(repo, never()).deleteProduct(anyInt()); verify(repo, never()).deleteCategory(anyInt());
    }
    @Test void duplicateProductCodeRejected() {
        when(repo.category(1)).thenReturn(Optional.of(category(0)));
        when(repo.productCodeExists("CODE", 0)).thenReturn(true);
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.createProduct(product(1,"1",null), "accountant")).getStatusCode().value());
    }
    @Test void unusedProductCanBeDeleted() {
        when(repo.product(1)).thenReturn(Optional.of(existing(false)));
        service.deleteProduct(1, "accountant"); verify(repo).deleteProduct(1);
    }
    @Test void categoryRequiresCorrectAccountTypes() {
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.createCategory(new CategoryRequest("Nhóm", null, 5), "accountant")).getStatusCode().value());
        when(repo.accountMatches(4, "income", "511")).thenReturn(true);
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> service.createCategory(new CategoryRequest("Nhóm", 4, 5), "accountant")).getStatusCode().value());
        verify(repo, never()).insertCategory(any());
    }
}
