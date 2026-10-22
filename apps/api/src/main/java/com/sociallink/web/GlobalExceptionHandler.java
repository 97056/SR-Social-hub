package com.sociallink.web;

import com.sociallink.common.ApiException;
import com.sociallink.domain.LimitException;
import com.sociallink.domain.TenantGuard;
import com.sociallink.domain.ThemeValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, Object>> api(ApiException ex) {
        return body(ex.status(), ex.code(), ex.getMessage());
    }

    @ExceptionHandler(LimitException.class)
    ResponseEntity<Map<String, Object>> limit(LimitException ex) {
        return body(409, ex.code(), ex.getMessage());
    }

    @ExceptionHandler(TenantGuard.NotFoundException.class)
    ResponseEntity<Map<String, Object>> missing() {
        return body(404, "not_found", "Not found.");
    }

    @ExceptionHandler(ThemeValidator.ThemeValidationException.class)
    ResponseEntity<Map<String, Object>> theme(ThemeValidator.ThemeValidationException ex) {
        return body(400, "theme_invalid", ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> invalid(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error -> fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("error", "validation_failed");
        payload.put("message", "Check the highlighted fields.");
        payload.put("fields", fields);
        return ResponseEntity.badRequest().body(payload);
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<Map<String, Object>> data(DataAccessException ex) {
        log.error("database error", ex);
        return body(500, "server_error", "The request could not be completed.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> unexpected(Exception ex) {
        log.error("unhandled error", ex);
        return body(500, "server_error", "The request could not be completed.");
    }

    private static ResponseEntity<Map<String, Object>> body(int status, String code, String message) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("error", code);
        payload.put("message", message);
        return ResponseEntity.status(status).body(payload);
    }
}
