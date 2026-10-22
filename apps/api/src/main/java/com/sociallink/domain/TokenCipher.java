package com.sociallink.domain;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

public final class TokenCipher {
    public static final String DEV_KEY = "dev-only-key-do-not-use-in-prod!";
    private final byte[] key;
    private final SecureRandom random = new SecureRandom();

    public TokenCipher(String rawKey) {
        if (rawKey == null || rawKey.isBlank()) {
            throw new IllegalArgumentException("Token encryption key is required.");
        }
        byte[] material = decode(rawKey.trim());
        if (material.length != 32) {
            throw new IllegalArgumentException("Token encryption key must be 32 bytes.");
        }
        this.key = material;
    }

    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[12];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] packed = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, packed, 0, iv.length);
            System.arraycopy(encrypted, 0, packed, iv.length, encrypted.length);
            return "v1:" + Base64.getEncoder().encodeToString(packed);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not encrypt a secret.", ex);
        }
    }

    public String decrypt(String ciphertext) {
        if (ciphertext == null || !ciphertext.startsWith("v1:")) {
            throw new IllegalArgumentException("Unknown secret format.");
        }
        try {
            byte[] packed = Base64.getDecoder().decode(ciphertext.substring(3));
            byte[] iv = Arrays.copyOfRange(packed, 0, 12);
            byte[] encrypted = Arrays.copyOfRange(packed, 12, packed.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Could not decrypt a secret.");
        }
    }

    private static byte[] decode(String rawKey) {
        if (rawKey.length() == 32) {
            return rawKey.getBytes(StandardCharsets.UTF_8);
        }
        try {
            return Base64.getDecoder().decode(rawKey);
        } catch (IllegalArgumentException ex) {
            return rawKey.getBytes(StandardCharsets.UTF_8);
        }
    }
}
