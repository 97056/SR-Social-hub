package com.sociallink.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private String baseUrl = "http://localhost:3000";
    private String sessionSecret = "";
    private String tokenEncryptionKey = "";
    private final Cookie cookie = new Cookie();
    private final Worker worker = new Worker();
    private final Publishing publishing = new Publishing();
    private final Dev dev = new Dev();
    private String initialSuperAdminEmail = "";
    private String initialSuperAdminPassword = "";
    private final Razorpay razorpay = new Razorpay();
    private final Storage storage = new Storage();
    private final Email email = new Email();
    private String sentryDsn = "";

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getSessionSecret() { return sessionSecret; }
    public void setSessionSecret(String sessionSecret) { this.sessionSecret = sessionSecret; }
    public String getTokenEncryptionKey() { return tokenEncryptionKey; }
    public void setTokenEncryptionKey(String tokenEncryptionKey) { this.tokenEncryptionKey = tokenEncryptionKey; }
    public Cookie getCookie() { return cookie; }
    public Worker getWorker() { return worker; }
    public Publishing getPublishing() { return publishing; }
    public Dev getDev() { return dev; }
    public String getInitialSuperAdminEmail() { return initialSuperAdminEmail; }
    public void setInitialSuperAdminEmail(String initialSuperAdminEmail) { this.initialSuperAdminEmail = initialSuperAdminEmail; }
    public String getInitialSuperAdminPassword() { return initialSuperAdminPassword; }
    public void setInitialSuperAdminPassword(String initialSuperAdminPassword) { this.initialSuperAdminPassword = initialSuperAdminPassword; }
    public Razorpay getRazorpay() { return razorpay; }
    public Storage getStorage() { return storage; }
    public Email getEmail() { return email; }
    public String getSentryDsn() { return sentryDsn; }
    public void setSentryDsn(String sentryDsn) { this.sentryDsn = sentryDsn; }

    public static class Cookie {
        private boolean secure;
        public boolean isSecure() { return secure; }
        public void setSecure(boolean secure) { this.secure = secure; }
    }

    public static class Worker {
        private boolean enabled = true;
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
    }

    public static class Publishing {
        private boolean sandbox;
        public boolean isSandbox() { return sandbox; }
        public void setSandbox(boolean sandbox) { this.sandbox = sandbox; }
    }

    public static class Dev {
        private boolean exposeEmailOutbox;
        public boolean isExposeEmailOutbox() { return exposeEmailOutbox; }
        public void setExposeEmailOutbox(boolean exposeEmailOutbox) { this.exposeEmailOutbox = exposeEmailOutbox; }
    }

    public static class Razorpay {
        private String keyId = "";
        private String keySecret = "";
        private String webhookSecret = "";
        public String getKeyId() { return keyId; }
        public void setKeyId(String keyId) { this.keyId = keyId; }
        public String getKeySecret() { return keySecret; }
        public void setKeySecret(String keySecret) { this.keySecret = keySecret; }
        public String getWebhookSecret() { return webhookSecret; }
        public void setWebhookSecret(String webhookSecret) { this.webhookSecret = webhookSecret; }
        public boolean credentialsPresent() {
            return keyId != null && !keyId.isBlank() && keySecret != null && !keySecret.isBlank();
        }
    }

    public static class Storage {
        private String endpoint = "";
        private String bucket = "";
        private String accessKey = "";
        private String secretKey = "";
        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public String getBucket() { return bucket; }
        public void setBucket(String bucket) { this.bucket = bucket; }
        public String getAccessKey() { return accessKey; }
        public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
        public String getSecretKey() { return secretKey; }
        public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
        public boolean configured() {
            return notBlank(endpoint) && notBlank(bucket) && notBlank(accessKey) && notBlank(secretKey);
        }
        private static boolean notBlank(String value) { return value != null && !value.isBlank(); }
    }

    public static class Email {
        private String apiKey = "";
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    }
}
