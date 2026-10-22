package com.sociallink.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sociallink.common.ApiException;
import com.sociallink.config.AppProperties;
import com.sociallink.domain.WebhookProcessor;
import com.sociallink.domain.WebhookSignatureVerifier;
import com.sociallink.store.BillingStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class WebhookService {
    private static final Logger log = LoggerFactory.getLogger(WebhookService.class);
    private final AppProperties properties;
    private final BillingStore billing;
    private final ObjectMapper mapper;
    private final WebhookProcessor processor = new WebhookProcessor();

    public WebhookService(AppProperties properties, BillingStore billing, ObjectMapper mapper) {
        this.properties = properties;
        this.billing = billing;
        this.mapper = mapper;
    }

    @Transactional
    public void handleRazorpay(byte[] body, String signature, String eventId) {
        boolean verified = WebhookSignatureVerifier.matches(properties.getRazorpay().getWebhookSecret(), body, signature);
        if (!verified) {
            log.warn("Rejected a Razorpay webhook with an invalid signature");
            throw new ApiException(400, "invalid_signature", "Webhook signature was rejected.");
        }
        if (eventId == null || eventId.isBlank()) {
            throw new ApiException(400, "missing_event_id", "Webhook event id is required.");
        }
        JsonNode root;
        try {
            root = mapper.readTree(body);
        } catch (Exception ex) {
            throw new ApiException(400, "invalid_payload", "Webhook payload was not valid JSON.");
        }
        String eventType = root.path("event").asText("");
        String reference = sha256(body);
        var notice = new WebhookProcessor.Notice(eventId, eventType, true, reference);
        WebhookProcessor.ProcessResult result = processor.process(notice, ignored -> billing.insertEvent(eventId, eventType, workspaceId(root), reference), ignored -> apply(root, eventType));
        if (result == WebhookProcessor.ProcessResult.REJECTED) {
            throw new ApiException(400, "invalid_signature", "Webhook signature was rejected.");
        }
    }

    private void apply(JsonNode root, String eventType) {
        JsonNode entity = root.path("payload").path("subscription").path("entity");
        String workspace = text(entity.path("notes"), "workspace_id");
        String planCode = text(entity.path("notes"), "plan_code");
        if (workspace == null || planCode == null) {
            log.warn("Stored Razorpay event {} without a workspace note", eventType);
            return;
        }
        UUID workspaceId;
        try {
            workspaceId = UUID.fromString(workspace);
        } catch (IllegalArgumentException ex) {
            log.warn("Stored Razorpay event with a malformed workspace note");
            return;
        }
        var plan = billing.findPlanByCode(planCode).orElse(null);
        if (plan == null) {
            log.warn("Stored Razorpay event for unknown plan code");
            return;
        }
        String status = switch (eventType) {
            case "subscription.activated", "subscription.charged" -> "active";
            case "subscription.halted", "payment.failed" -> "past_due";
            case "subscription.cancelled" -> "cancelled";
            case "subscription.completed" -> "expired";
            default -> "incomplete";
        };
        billing.applySubscription(workspaceId, plan.id(), text(entity, "id"), status, epoch(entity, "current_start"), epoch(entity, "current_end"),
                "subscription.charged".equals(eventType));
    }

    private static UUID workspaceId(JsonNode root) {
        String value = text(root.path("payload").path("subscription").path("entity").path("notes"), "workspace_id");
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() || value.asText().isBlank() ? null : value.asText();
    }

    private static Instant epoch(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (!value.isNumber()) {
            return null;
        }
        return Instant.ofEpochSecond(value.asLong());
    }

    private static String sha256(byte[] body) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
        } catch (Exception ex) {
            return "";
        }
    }
}
