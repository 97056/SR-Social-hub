package com.sociallink.service;

import com.sociallink.common.ApiException;
import com.sociallink.config.AppProperties;
import com.sociallink.config.SecurityConfig;
import com.sociallink.domain.EmailTemplateRenderer;
import com.sociallink.domain.PasswordPolicy;
import com.sociallink.domain.SessionTokens;
import com.sociallink.domain.SlidingWindowRateLimiter;
import com.sociallink.domain.Totp;
import com.sociallink.store.AdminStore;
import com.sociallink.store.AuthStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private final AuthStore authStore;
    private final AdminStore adminStore;
    private final PasswordEncoder passwordEncoder;
    private final SessionTokens sessionTokens;
    private final SecurityConfig.SecretBox secretBox;
    private final AppProperties properties;
    private final SlidingWindowRateLimiter rateLimiter = new SlidingWindowRateLimiter();
    private final Totp totp = new Totp();
    private final String dummyHash;
    private final SecureRandom random = new SecureRandom();

    public AuthService(AuthStore authStore, AdminStore adminStore, PasswordEncoder passwordEncoder, SessionTokens sessionTokens,
                       SecurityConfig.SecretBox secretBox, AppProperties properties) {
        this.authStore = authStore;
        this.adminStore = adminStore;
        this.passwordEncoder = passwordEncoder;
        this.sessionTokens = sessionTokens;
        this.secretBox = secretBox;
        this.properties = properties;
        this.dummyHash = passwordEncoder.encode("dummy-password-not-used");
    }

    public record SessionStart(String rawToken, Map<String, Object> body) {
    }

    @Transactional
    public Map<String, Object> register(String name, String email, String password, String ip) {
        if (!authStore.signupEnabled()) {
            throw new ApiException(403, "signup_disabled", "Registration is turned off.");
        }
        guard("register:" + ip, adminStore.publicFormLimit(), Duration.ofHours(1));
        String normalized = normalizeEmail(email);
        try {
            PasswordPolicy.check(password);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, "weak_password", ex.getMessage());
        }
        String safeName = cleanName(name);
        try {
            UUID userId = authStore.insertUser(safeName, normalized, passwordEncoder.encode(password));
            sendToken(userId, safeName, normalized, "verify_email", Duration.ofHours(24), "/verify-email?token=");
            return Map.of("status", "verification_sent");
        } catch (DuplicateKeyException ex) {
            throw new ApiException(409, "email_taken", "An account with this email already exists. Try signing in.");
        }
    }

    @Transactional
    public void verify(String token) {
        var userId = authStore.consumeToken(sessionTokens.hash(token), "verify_email")
                .orElseThrow(() -> new ApiException(400, "invalid_token", "This verification link is invalid or expired."));
        authStore.markVerified(userId);
    }

    @Transactional
    public void resend(String email, String ip) {
        guard("resend:" + ip, adminStore.publicFormLimit(), Duration.ofHours(1));
        authStore.findUserByEmail(normalizeEmail(email)).filter(user -> user.emailVerifiedAt() == null).ifPresent(user ->
                sendToken(user.id(), user.name(), user.email(), "verify_email", Duration.ofHours(24), "/verify-email?token="));
    }

    @Transactional
    public SessionStart login(String email, String password, String otp, String ip) {
        String normalized = normalizeEmail(email);
        guard("login:" + ip + ":" + normalized, adminStore.loginMaxAttempts(), Duration.ofMinutes(adminStore.loginWindowMinutes()));
        var user = authStore.findUserByEmail(normalized).orElse(null);
        boolean matches = passwordEncoder.matches(password, user == null ? dummyHash : user.passwordHash());
        if (user == null || !matches || !"active".equals(user.status())) {
            throw new ApiException(401, "invalid_credentials", "Invalid email or password.");
        }
        if (user.emailVerifiedAt() == null) {
            throw new ApiException(403, "email_unverified", "Verify your email before signing in.");
        }
        if (user.mfaEnabled()) {
            if (otp == null || otp.isBlank()) {
                throw new ApiException(401, "mfa_required", "Enter the code from your authenticator.");
            }
            long step = acceptOtp(user, otp);
            authStore.updateMfaStep(user.id(), step);
        }
        return startSession(user.id(), null);
    }

    @Transactional
    public void forgot(String email, String ip) {
        guard("forgot:" + ip, adminStore.publicFormLimit(), Duration.ofHours(1));
        authStore.findUserByEmail(normalizeEmail(email)).filter(user -> user.emailVerifiedAt() != null).ifPresent(user ->
                sendToken(user.id(), user.name(), user.email(), "reset_password", Duration.ofHours(1), "/reset-password?token="));
    }

    @Transactional
    public void reset(String token, String password) {
        try {
            PasswordPolicy.check(password);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, "weak_password", ex.getMessage());
        }
        var userId = authStore.consumeToken(sessionTokens.hash(token), "reset_password")
                .orElseThrow(() -> new ApiException(400, "invalid_token", "This reset link is invalid or expired."));
        authStore.updatePassword(userId, passwordEncoder.encode(password));
        authStore.deleteSessionsForUser(userId);
    }

    public void logout(String rawToken) {
        if (rawToken != null) {
            authStore.deleteSession(sessionTokens.hash(rawToken));
        }
    }

    @Transactional
    public Map<String, Object> beginMfa(java.util.UUID userId, String email) {
        byte[] secret = new byte[20];
        random.nextBytes(secret);
        String encoded = totp.encodeBase32(secret);
        authStore.saveMfaSecret(userId, secretBox.encrypt(encoded));
        String label = URLEncoder.encode(authStore.brandName() + ":" + email, StandardCharsets.UTF_8);
        String issuer = URLEncoder.encode(authStore.brandName(), StandardCharsets.UTF_8);
        return Map.of(
                "secret", encoded,
                "otpauthUrl", "otpauth://totp/" + label + "?secret=" + encoded + "&issuer=" + issuer + "&algorithm=SHA1&digits=6&period=30"
        );
    }

    @Transactional
    public void confirmMfa(java.util.UUID userId, String code) {
        var user = authStore.findUserById(userId).orElseThrow(() -> new ApiException(404, "not_found", "Not found."));
        long step = acceptOtp(user, code);
        authStore.enableMfa(userId, step);
    }

    @Transactional
    public void bootstrap() {
        String email = properties.getInitialSuperAdminEmail();
        String password = properties.getInitialSuperAdminPassword();
        if (email == null || email.isBlank() || password == null || password.isBlank() || authStore.countSuperAdmins() > 0) {
            return;
        }
        try {
            PasswordPolicy.check(password);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("INITIAL_SUPER_ADMIN_PASSWORD does not meet the password policy.");
        }
        authStore.insertSuperAdmin("Super Admin", normalizeEmail(email), passwordEncoder.encode(password));
        log.info("Bootstrapped the first super admin for {}", normalizeEmail(email));
    }

    public SessionStart startSession(java.util.UUID userId, java.util.UUID workspaceId) {
        String raw = sessionTokens.newRawToken();
        authStore.insertSession(userId, workspaceId, sessionTokens.hash(raw), Instant.now().plus(Duration.ofDays(adminStore.sessionDays())));
        var principal = authStore.findSession(sessionTokens.hash(raw)).orElseThrow();
        return new SessionStart(raw, userBody(principal.userId(), principal.email(), principal.name(), principal.superAdmin(), principal.mfaEnabled(), principal.workspaceId(), principal.workspaceRole()));
    }

    public void bindWorkspace(String rawToken, UUID workspaceId) {
        authStore.bindWorkspace(sessionTokens.hash(rawToken), workspaceId);
    }

    private long acceptOtp(AuthStore.UserRow user, String code) {
        if (user.mfaSecret() == null) {
            throw new ApiException(400, "mfa_not_started", "Set up an authenticator first.");
        }
        byte[] secret = totp.decodeBase32(secretBox.decrypt(user.mfaSecret()));
        var match = totp.match(secret, code, Instant.now().getEpochSecond());
        if (match.isEmpty() || (user.mfaLastStep() != null && match.getAsLong() <= user.mfaLastStep())) {
            throw new ApiException(401, "invalid_code", "That authenticator code is not valid.");
        }
        return match.getAsLong();
    }

    private void sendToken(java.util.UUID userId, String name, String email, String purpose, Duration ttl, String path) {
        String raw = sessionTokens.newRawToken();
        authStore.insertToken(userId, purpose, sessionTokens.hash(raw), Instant.now().plus(ttl));
        String link = properties.getBaseUrl().replaceAll("/$", "") + path + raw;
        Map<String, String> values = Map.of("name", name, "email", email, "brand", authStore.brandName(), "link", link);
        authStore.insertOutbox(email, EmailTemplateRenderer.render(authStore.template(purpose, "subject"), values),
                EmailTemplateRenderer.render(authStore.template(purpose, "body"), values));
    }

    private void guard(String key, int max, Duration window) {
        if (!rateLimiter.allow(key, max, window.toMillis())) {
            throw new ApiException(429, "rate_limited", "Too many attempts. Wait and try again.");
        }
    }

    public static Map<String, Object> userBody(java.util.UUID id, String email, String name, boolean superAdmin, boolean mfaEnabled, java.util.UUID workspaceId, String role) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", id);
        body.put("email", email);
        body.put("name", name);
        body.put("superAdmin", superAdmin);
        body.put("mfaEnabled", mfaEnabled);
        body.put("workspaceId", workspaceId);
        body.put("role", role);
        return body;
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String cleanName(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isBlank() || trimmed.length() > 160) {
            throw new ApiException(400, "invalid_name", "Enter your name.");
        }
        return trimmed;
    }
}
