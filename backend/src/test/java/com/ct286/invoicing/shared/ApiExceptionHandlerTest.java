package com.ct286.invoicing.shared;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class ApiExceptionHandlerTest {
    @Test void preservesForbiddenStatusAndMessage() {
        var response = new ApiExceptionHandler().handleStatus(new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ kế toán được xem dữ liệu nghiệp vụ."));
        assertEquals(403, response.getStatusCode().value());
        assertEquals(403, response.getBody().status());
        assertEquals("Chỉ kế toán được xem dữ liệu nghiệp vụ.", response.getBody().message());
    }
}
