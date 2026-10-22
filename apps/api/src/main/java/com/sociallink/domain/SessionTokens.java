package com.sociallink.domain;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

public final class SessionTokens {
    public static final String DEV_PEPPER = "dev-session-pepper-not-for-prod!";
    private final byte[] pepper;
    private final SecureRandom random = new SecureRandom();

    public SessionTokens(String secret) {
        if (secret == null || secret.length() < 16) {
            throw new IllegalArgumentException("Session secret must be at least 16 characters.");
        }
        this.pepper = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String newRawToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String hash(String rawToken) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not hash a token.", ex);
        }
    }
}
