package com.sociallink.domain;

public final class PasswordPolicy {
    private PasswordPolicy() {
    }

    public static void check(String password) {
        if (password == null || password.length() < 10 || password.length() > 200) {
            throw new IllegalArgumentException("Use a password between 10 and 200 characters.");
        }
        boolean letter = password.chars().anyMatch(Character::isLetter);
        boolean digit = password.chars().anyMatch(Character::isDigit);
        if (!letter || !digit) {
            throw new IllegalArgumentException("Use a password with at least one letter and one number.");
        }
    }
}
