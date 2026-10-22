package com.sociallink.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(
        type = AutoConfigureEmbeddedDatabase.DatabaseType.POSTGRES,
        provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY
)
@TestPropertySource(properties = {
        "app.worker.enabled=false",
        "app.cookie.secure=false",
        "app.razorpay.webhook-secret=test-whsec",
        "app.publishing.sandbox=false"
})
class TenantBillingIT {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    @Test
    void plansExposeTheFourLaunchOffers() throws Exception {
        mvc.perform(get("/api/plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("starter"))
                .andExpect(jsonPath("$[0].pricePaise").value(20000))
                .andExpect(jsonPath("$[0].limits.clientProfiles").value(3))
                .andExpect(jsonPath("$[1].code").value("growth"))
                .andExpect(jsonPath("$[1].pricePaise").value(40000))
                .andExpect(jsonPath("$[2].code").value("agency"))
                .andExpect(jsonPath("$[2].pricePaise").value(60000))
                .andExpect(jsonPath("$[2].limits.clientProfiles").value(6))
                .andExpect(jsonPath("$[2].limits.exactClientCap").value(true))
                .andExpect(jsonPath("$[3].code").value("custom"))
                .andExpect(jsonPath("$[3].limits.negotiated").value(true));
    }

    @Test
    void agencyCapAndTenantIsolationHold() throws Exception {
        String cookieA = loginVerified("agency-owner@example.com");
        String cookieB = loginVerified("other-owner@example.com");
        String workspaceA = createWorkspace(cookieA, "Northwind", "agency");
        createWorkspace(cookieB, "Other Studio", "business");
        activate(workspaceA, "agency");

        String firstClient = null;
        for (int i = 1; i <= 6; i++) {
            MvcResult created = mvc.perform(post("/api/clients").cookie(cookie(cookieA))
                            .header("X-Requested-With", "sociallink")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Client " + i + "\",\"timezone\":\"Asia/Kolkata\"}"))
                    .andExpect(status().isOk())
                    .andReturn();
            firstClient = firstClient == null ? json.readTree(created.getResponse().getContentAsString()).get("id").asText() : firstClient;
        }
        mvc.perform(post("/api/clients").cookie(cookie(cookieA))
                        .header("X-Requested-With", "sociallink")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Client 7\",\"timezone\":\"Asia/Kolkata\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("limit_exceeded"));

        mvc.perform(get("/api/clients/" + firstClient).cookie(cookie(cookieB)).header("X-Requested-With", "sociallink"))
                .andExpect(status().isNotFound());
    }

    @Test
    void duplicatePaymentWebhookDoesNotChargeTwice() throws Exception {
        String cookie = loginVerified("billing-owner@example.com");
        String workspaceId = createWorkspace(cookie, "Billing Co", "business");
        String body = """
                {"event":"subscription.charged","payload":{"subscription":{"entity":{"id":"sub_test_1","current_start":1760000000,"current_end":1762592000,"notes":{"workspace_id":"%s","plan_code":"starter"}}}}}
                """.formatted(workspaceId);
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        String signature = sign(bytes);
        postWebhook(bytes, signature, "evt_test_1").andExpect(status().isOk());
        postWebhook(bytes, signature, "evt_test_1").andExpect(status().isOk());
        Integer charges = jdbc.queryForObject("SELECT charge_count FROM subscriptions WHERE workspace_id = ?", Integer.class, UUID.fromString(workspaceId));
        assertEquals(1, charges);
        Integer events = jdbc.queryForObject("SELECT count(*) FROM payment_events WHERE provider_event_id = 'evt_test_1'", Integer.class);
        assertEquals(1, events);
    }

    @Test
    void quoteIsVisibleToTheAdminInboxWithoutASecret() throws Exception {
        mvc.perform(post("/api/quotes").header("X-Requested-With", "sociallink").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"company":"Orbit","contactName":"Asha","email":"asha@orbit.example","phone":"9999999999","clientCount":12,"accountCount":40,"monthlyVolume":2000,"platforms":"LinkedIn, Instagram","notes":"Need a negotiated plan"}
                                """))
                .andExpect(status().isOk());
        Integer count = jdbc.queryForObject("SELECT count(*) FROM quote_requests WHERE email = 'asha@orbit.example'", Integer.class);
        assertTrue(count != null && count == 1);
        String row = jdbc.queryForObject("SELECT secret_ciphertext FROM social_integrations WHERE provider = 'facebook'", String.class);
        assertTrue(row == null);
    }

    private org.springframework.test.web.servlet.ResultActions postWebhook(byte[] bytes, String signature, String eventId) throws Exception {
        return mvc.perform(post("/api/webhooks/razorpay")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Razorpay-Signature", signature)
                .header("X-Razorpay-Event-Id", eventId)
                .content(bytes));
    }

    private String loginVerified(String email) throws Exception {
        mvc.perform(post("/api/auth/register").header("X-Requested-With", "sociallink").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Owner\",\"email\":\"" + email + "\",\"password\":\"correct-horse-1\",\"acceptTerms\":true}"))
                .andExpect(status().isOk());
        String body = jdbc.queryForObject("SELECT body FROM email_outbox WHERE to_email = ? ORDER BY created_at DESC LIMIT 1", String.class, email);
        String token = body.substring(body.indexOf("token=") + 6).trim().split("\\s+")[0];
        mvc.perform(post("/api/auth/verify-email").header("X-Requested-With", "sociallink").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk());
        MvcResult login = mvc.perform(post("/api/auth/login").header("X-Requested-With", "sociallink").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-1\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String setCookie = login.getResponse().getHeader("Set-Cookie");
        assertTrue(setCookie != null && setCookie.contains("sl_session="));
        return setCookie.substring(setCookie.indexOf("sl_session=") + "sl_session=".length(), setCookie.indexOf(';'));
    }

    private String createWorkspace(String rawCookie, String name, String type) throws Exception {
        MvcResult result = mvc.perform(post("/api/workspaces").cookie(cookie(rawCookie)).header("X-Requested-With", "sociallink")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"workspaceType\":\"" + type + "\",\"timezone\":\"Asia/Kolkata\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode node = json.readTree(result.getResponse().getContentAsString());
        return node.get("id").asText();
    }

    private void activate(String workspaceId, String planCode) {
        jdbc.update("""
                INSERT INTO subscriptions (id, workspace_id, plan_id, status, period_start, period_end, charge_count)
                SELECT ?, ?, id, 'active', now(), now() + interval '30 days', 0 FROM plans WHERE code = ?
                """, UUID.randomUUID(), UUID.fromString(workspaceId), planCode);
    }

    private static jakarta.servlet.http.Cookie cookie(String raw) {
        return new jakarta.servlet.http.Cookie("sl_session", raw);
    }

    private static String sign(byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("test-whsec".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(body));
    }
}
