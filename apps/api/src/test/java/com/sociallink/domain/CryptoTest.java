package com.sociallink.domain;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CryptoTest {
    @Test
    void totpMatchesTheRfcVector() {
        var totp = new Totp();
        byte[] secret = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);
        assertEquals(287082, totp.hotp(secret, 59 / 30));
        assertTrue(totp.match(secret, "287082", 59).isPresent());
        assertFalse(totp.match(secret, "000000", 59).isPresent());
        byte[] raw = new byte[]{0x01, 0x02, 0x03, 0x04, 0x05};
        assertEquals(raw.length, totp.decodeBase32(totp.encodeBase32(raw)).length);
    }

    @Test
    void tokenCipherRoundTripsAndHidesPlaintext() {
        var cipher = new TokenCipher(TokenCipher.DEV_KEY);
        String encrypted = cipher.encrypt("page-access-token");
        assertFalse(encrypted.contains("page-access-token"));
        assertEquals("page-access-token", cipher.decrypt(encrypted));
        assertNotEquals(encrypted, cipher.encrypt("page-access-token"));
        assertThrows(IllegalArgumentException.class, () -> cipher.decrypt(encrypted.substring(0, encrypted.length() - 4) + "AAAA"));
    }

    @Test
    void sessionHashChangesWithThePepper() {
        var first = new SessionTokens("pepper-one-value!!");
        var second = new SessionTokens("pepper-two-value!!");
        String raw = first.newRawToken();
        assertNotEquals(first.hash(raw), second.hash(raw));
        assertEquals(first.hash(raw), first.hash(raw));
    }
}
