package com.ct286.invoicing.product;

import com.ct286.invoicing.user.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
class ProductController {
    record ActiveRequest(Boolean active) { }
    private final ProductService service;
    ProductController(ProductService service) { this.service = service; }
    private String role(HttpServletRequest request) { return AuthInterceptor.currentUser(request).role(); }
    @GetMapping("/products") List<ProductDto> products() { return service.products(); }
    @GetMapping("/products/{id}") ProductDto product(@PathVariable int id) { return service.product(id); }
    @PostMapping("/products") @ResponseStatus(HttpStatus.CREATED)
    ProductDto createProduct(@RequestBody ProductRequest body, HttpServletRequest request) { return service.createProduct(body, role(request)); }
    @PutMapping("/products/{id}") ProductDto updateProduct(@PathVariable int id, @RequestBody ProductRequest body, HttpServletRequest request) { return service.updateProduct(id, body, role(request)); }
    @PatchMapping("/products/{id}/active") ProductDto active(@PathVariable int id, @RequestBody ActiveRequest body, HttpServletRequest request) { return service.setActive(id, body.active(), role(request)); }
    @DeleteMapping("/products/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteProduct(@PathVariable int id, HttpServletRequest request) { service.deleteProduct(id, role(request)); }
    @GetMapping("/product-categories") List<CategoryDto> categories() { return service.categories(); }
    @PostMapping("/product-categories") @ResponseStatus(HttpStatus.CREATED)
    CategoryDto createCategory(@RequestBody CategoryRequest body, HttpServletRequest request) { return service.createCategory(body, role(request)); }
    @PutMapping("/product-categories/{id}") CategoryDto updateCategory(@PathVariable int id, @RequestBody CategoryRequest body, HttpServletRequest request) { return service.updateCategory(id, body, role(request)); }
    @DeleteMapping("/product-categories/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteCategory(@PathVariable int id, HttpServletRequest request) { service.deleteCategory(id, role(request)); }
}
