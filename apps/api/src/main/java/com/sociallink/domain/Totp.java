package com.sociallink.domain;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.OptionalLong;

public final class Totp {
    private static final char[] BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();

    public String encodeBase32(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bits = 0;
        for (byte value : data) {
            buffer = (buffer << 8) | (value & 0xff);
            bits += 8;
            while (bits >= 5) {
                out.append(BASE32[(buffer >> (bits - 5)) & 31]);
                bits -= 5;
            }
        }
        if (bits > 0) {
            out.append(BASE32[(buffer << (5 - bits)) & 31]);
        }
        return out.toString();
    }

    public byte[] decodeBase32(String value) {
        String cleaned = value.replace(" ", "").replace("=", "").toUpperCase();
        int buffer = 0;
        int bits = 0;
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        for (int i = 0; i < cleaned.length(); i++) {
            int index = new String(BASE32).indexOf(cleaned.charAt(i));
            if (index < 0) {
                throw new IllegalArgumentException("Invalid authenticator secret.");
            }
            buffer = (buffer << 5) | index;
            bits += 5;
            if (bits >= 8) {
                out.write((buffer >> (bits - 8)) & 0xff);
                bits -= 8;
            }
        }
        return out.toByteArray();
    }

    public OptionalLong match(byte[] secret, String code, long nowSeconds) {
        if (code == null || !code.matches("\\d{6}")) {
            return OptionalLong.empty();
        }
        long step = Math.floorDiv(nowSeconds, 30);
        for (long candidate = step - 1; candidate <= step + 1; candidate++) {
            String expected = String.format("%06d", hotp(secret, candidate));
            if (MessageDigest.isEqual(expected.getBytes(), code.getBytes())) {
                return OptionalLong.of(candidate);
            }
        }
        return OptionalLong.empty();
    }

    public int hotp(byte[] secret, long counter) {
        try {
            byte[] value = ByteBuffer.allocate(8).putLong(counter).array();
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret, "HmacSHA1"));
            byte[] hash = mac.doFinal(value);
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24)
                    | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8)
                    | (hash[offset + 3] & 0xff);
            return binary % 1_000_000;
        } catch (Exception ex) {
            throw new IllegalStateException("Could not generate authenticator code.", ex);
        }
    }
}
