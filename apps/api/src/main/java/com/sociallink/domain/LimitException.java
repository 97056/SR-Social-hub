package com.sociallink.domain;

public final class LimitException extends RuntimeException {
    private final String code;

    public LimitException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
