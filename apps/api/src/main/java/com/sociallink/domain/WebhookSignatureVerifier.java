package com.sociallink.domain;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

public final class WebhookSignatureVerifier {
    private WebhookSignatureVerifier() {
    }

    public static boolean matches(String secret, byte[] body, String providedHex) {
        if (secret == null || secret.isBlank() || body == null || providedHex == null || providedHex.isBlank()) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal(body);
            byte[] actual = HexFormat.of().parseHex(providedHex.trim());
            return MessageDigest.isEqual(expected, actual);
        } catch (IllegalArgumentException ex) {
            return false;
        } catch (Exception ex) {
            return false;
        }
    }
}
