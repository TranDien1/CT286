package com.ct286.invoicing.shared;

import java.time.Instant;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleStatus(ResponseStatusException exception) {
        int status = exception.getStatusCode().value();
        return ResponseEntity.status(status).body(new ApiError(Instant.now(), status, "REQUEST_ERROR", exception.getReason()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class,
            HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> handleValidation(Exception exception) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception exception) {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Máy chủ không thể xử lý yêu cầu.");
    }

    private ResponseEntity<ApiError> error(HttpStatus status, String code, String message) {
        ApiError body = new ApiError(Instant.now(), status.value(), code, message);
        return ResponseEntity.status(status).body(body);
    }
}
