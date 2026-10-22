package com.sociallink.web;

import com.sociallink.common.CurrentUser;
import com.sociallink.config.AppProperties;
import com.sociallink.domain.ThemeValidator;
import com.sociallink.security.SessionAuthFilter;
import com.sociallink.service.AuthService;
import com.sociallink.service.CatalogService;
import com.sociallink.service.ClientService;
import com.sociallink.service.PostService;
import com.sociallink.service.WebhookService;
import com.sociallink.service.WorkspaceService;
import com.sociallink.store.AdminStore;
import com.sociallink.store.AuthStore;
import com.sociallink.store.TenantStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

final class Cookies {
    private Cookies() {
    }

    static void set(HttpServletResponse response, AppProperties properties, String value, int days) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(SessionAuthFilter.COOKIE, value)
                .httpOnly(true).secure(properties.getCookie().isSecure()).sameSite("Lax").path("/").maxAge(Duration.ofDays(days)).build().toString());
    }

    static void clear(HttpServletResponse response, AppProperties properties) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(SessionAuthFilter.COOKIE, "")
                .httpOnly(true).secure(properties.getCookie().isSecure()).sameSite("Lax").path("/").maxAge(0).build().toString());
    }
}

@RestController
class AuthController {
    private final AuthService auth;
    private final AppProperties properties;
    private final AdminStore admin;

    AuthController(AuthService auth, AppProperties properties, AdminStore admin) {
        this.auth = auth;
        this.properties = properties;
        this.admin = admin;
    }

    @PostMapping("/api/auth/register")
    Map<String, Object> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        return auth.register(request.name(), request.email(), request.password(), http.getRemoteAddr());
    }

    @PostMapping("/api/auth/verify-email")
    Map<String, String> verify(@RequestBody Map<String, String> body) {
        auth.verify(body.getOrDefault("token", ""));
        return Map.of("status", "verified");
    }

    @PostMapping("/api/auth/verify-email/resend")
    ResponseEntity<Map<String, String>> resend(@RequestBody Map<String, String> body, HttpServletRequest http) {
        auth.resend(body.getOrDefault("email", ""), http.getRemoteAddr());
        return ResponseEntity.accepted().body(Map.of("status", "accepted"));
    }

    @PostMapping("/api/auth/login")
    Map<String, Object> login(@RequestBody Map<String, String> body, HttpServletRequest http, HttpServletResponse response) {
        var session = auth.login(body.getOrDefault("email", ""), body.getOrDefault("password", ""), body.get("otp"), http.getRemoteAddr());
        Cookies.set(response, properties, session.rawToken(), admin.sessionDays());
        return session.body();
    }

    @PostMapping("/api/auth/logout")
    Map<String, String> logout(HttpServletRequest request, HttpServletResponse response) {
        auth.logout(SessionAuthFilter.readCookie(request));
        Cookies.clear(response, properties);
        return Map.of("status", "signed_out");
    }

    @PostMapping("/api/auth/password/forgot")
    ResponseEntity<Map<String, String>> forgot(@RequestBody Map<String, String> body, HttpServletRequest http) {
        auth.forgot(body.getOrDefault("email", ""), http.getRemoteAddr());
        return ResponseEntity.accepted().body(Map.of("status", "accepted"));
    }

    @PostMapping("/api/auth/password/reset")
    Map<String, String> reset(@RequestBody Map<String, String> body) {
        auth.reset(body.getOrDefault("token", ""), body.getOrDefault("password", ""));
        return Map.of("status", "reset");
    }

    @GetMapping("/api/auth/me")
    Map<String, Object> me() {
        var user = CurrentUser.get();
        return AuthService.userBody(user.userId(), user.email(), user.name(), user.superAdmin(), user.mfaEnabled(), user.workspaceId(), user.workspaceRole());
    }

    @PostMapping("/api/auth/mfa/setup")
    Map<String, Object> setupMfa() {
        var user = CurrentUser.get();
        return auth.beginMfa(user.userId(), user.email());
    }

    @PostMapping("/api/auth/mfa/confirm")
    Map<String, String> confirmMfa(@RequestBody Map<String, String> body) {
        auth.confirmMfa(CurrentUser.get().userId(), body.getOrDefault("code", ""));
        return Map.of("status", "enabled");
    }
}

record RegisterRequest(
        @NotBlank @Size(max = 160) String name,
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(min = 10, max = 200) String password,
        @AssertTrue(message = "Accept the terms to create an account.") boolean acceptTerms
) {
}

@RestController
class PublicController {
    private final CatalogService catalog;
    private final AdminStore admin;

    PublicController(CatalogService catalog, AdminStore admin) {
        this.catalog = catalog;
        this.admin = admin;
    }

    @GetMapping("/api/plans")
    List<Map<String, Object>> plans() { return catalog.publicPlans(); }

    @GetMapping("/api/theme")
    Map<String, Object> theme() { return catalog.theme(); }

    @GetMapping("/api/system/status")
    Map<String, Object> status() { return catalog.status(); }

    @GetMapping("/api/integrations")
    List<Map<String, Object>> integrations() { return catalog.customerIntegrations(); }

    @GetMapping("/api/legal/{slug}")
    AdminStore.LegalRow legal(@PathVariable String slug) {
        return admin.legal(slug).orElseThrow(com.sociallink.domain.TenantGuard.NotFoundException::new);
    }

    @PostMapping("/api/quotes")
    Map<String, Object> quote(@RequestBody QuoteRequest request, HttpServletRequest http) {
        return catalog.quote(http.getRemoteAddr(), null, "quote", request.company(), request.contactName(), request.email(), request.phone(),
                request.clientCount(), request.accountCount(), request.monthlyVolume(), request.platforms(), request.notes());
    }

    @PostMapping("/api/contact")
    Map<String, Object> contact(@RequestBody Map<String, String> body, HttpServletRequest http) {
        return catalog.quote(http.getRemoteAddr(), null, "contact", body.get("company"), body.getOrDefault("contactName", ""),
                body.getOrDefault("email", ""), body.get("phone"), null, null, null, null, body.get("notes"));
    }
}

record QuoteRequest(String company, String contactName, String email, String phone, Integer clientCount, Integer accountCount, Integer monthlyVolume, String platforms, String notes) {
}

@RestController
class WorkspaceController {
    private final WorkspaceService workspaces;
    private final TenantStore tenants;
    private final AuthService auth;
    private final CatalogService catalog;
    private final ClientService clients;
    private final PostService posts;

    WorkspaceController(WorkspaceService workspaces, TenantStore tenants, AuthService auth, CatalogService catalog, ClientService clients, PostService posts) {
        this.workspaces = workspaces;
        this.tenants = tenants;
        this.auth = auth;
        this.catalog = catalog;
        this.clients = clients;
        this.posts = posts;
    }

    @PostMapping("/api/workspaces")
    Map<String, Object> create(@RequestBody Map<String, String> body, HttpServletRequest request) {
        var actor = CurrentUser.get();
        UUID id = workspaces.create(actor, body.getOrDefault("name", ""), body.getOrDefault("workspaceType", ""), body.getOrDefault("timezone", "Asia/Kolkata"));
        auth.bindWorkspace(SessionAuthFilter.readCookie(request), id);
        var workspace = tenants.findWorkspace(id).orElseThrow();
        return Map.of("id", workspace.id(), "name", workspace.name(), "workspaceType", workspace.workspaceType(), "timezone", workspace.timezone());
    }

    @GetMapping("/api/workspaces")
    List<TenantStore.Membership> list() {
        return tenants.memberships(CurrentUser.get().userId());
    }

    @PostMapping("/api/workspaces/{id}/select")
    Map<String, String> select(@PathVariable UUID id, HttpServletRequest request) {
        var actor = CurrentUser.get();
        if (tenants.memberRole(id, actor.userId()).isEmpty()) {
            throw new com.sociallink.domain.TenantGuard.NotFoundException();
        }
        auth.bindWorkspace(SessionAuthFilter.readCookie(request), id);
        return Map.of("status", "selected");
    }

    @GetMapping("/api/clients")
    List<TenantStore.ClientRow> clients() { return clients.list(CurrentUser.get()); }

    @PostMapping("/api/clients")
    TenantStore.ClientRow createClient(@RequestBody Map<String, String> body) {
        return clients.create(CurrentUser.get(), body.get("name"), body.getOrDefault("timezone", "Asia/Kolkata"), body.get("notes"));
    }

    @GetMapping("/api/clients/{id}")
    TenantStore.ClientRow client(@PathVariable UUID id) { return clients.get(CurrentUser.get(), id); }

    @PostMapping("/api/members")
    Map<String, String> member(@RequestBody Map<String, String> body) {
        clients.addMember(CurrentUser.get(), body.getOrDefault("email", ""), body.getOrDefault("role", "creator"));
        return Map.of("status", "added");
    }

    @GetMapping("/api/billing")
    Map<String, Object> billing() {
        var actor = CurrentUser.get();
        return catalog.billingSummary(actor.workspaceId(), workspaces.requireRole(actor));
    }

    @PostMapping("/api/billing/checkout")
    Map<String, Object> checkout(@RequestBody Map<String, String> body) {
        workspaces.requireRole(CurrentUser.get());
        return catalog.checkout(body.getOrDefault("planCode", ""));
    }

    @GetMapping("/api/posts")
    List<Map<String, Object>> posts() { return posts.list(CurrentUser.get()); }

    @PostMapping("/api/posts")
    Map<String, Object> createPost(@RequestBody CreatePostRequest request) {
        return posts.create(CurrentUser.get(), request.clientId(), request.caption(), request.hashtags(), request.approvalRequired(), request.targetAccountIds());
    }

    @PutMapping("/api/posts/{id}")
    Map<String, Object> editPost(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return posts.edit(CurrentUser.get(), id, body.get("caption"), body.get("hashtags"));
    }

    @PostMapping("/api/posts/{id}/submit")
    Map<String, Object> submit(@PathVariable UUID id) { return posts.submit(CurrentUser.get(), id); }

    @PostMapping("/api/posts/{id}/decision")
    Map<String, Object> decision(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return posts.decide(CurrentUser.get(), id, "approved".equals(body.get("action")), body.get("comment"));
    }

    @PostMapping("/api/posts/{id}/schedule")
    Map<String, Object> schedule(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return posts.schedule(CurrentUser.get(), id, LocalDateTime.parse(body.getOrDefault("scheduledAt", "")));
    }

    @PostMapping("/api/connect/{provider}")
    Map<String, String> connect(@PathVariable String provider) {
        throw new com.sociallink.common.ApiException(409, "integration_unverified",
                provider + " connect is not available until the official adapter has passed an authorized end-to-end test.");
    }
}

record CreatePostRequest(@NotNull UUID clientId, @Size(max = 5000) String caption, @Size(max = 500) String hashtags, boolean approvalRequired, List<UUID> targetAccountIds) {
}

@RestController
class WebhookController {
    private final WebhookService webhooks;

    WebhookController(WebhookService webhooks) { this.webhooks = webhooks; }

    @PostMapping("/api/webhooks/razorpay")
    Map<String, String> razorpay(@RequestBody byte[] body,
                                 @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature,
                                 @RequestHeader(value = "X-Razorpay-Event-Id", required = false) String eventId) {
        webhooks.handleRazorpay(body, signature, eventId);
        return Map.of("status", "ok");
    }
}

@RestController
class AdminController {
    private final CatalogService catalog;
    private final AdminStore admin;
    private final TenantStore tenants;

    AdminController(CatalogService catalog, AdminStore admin, TenantStore tenants) {
        this.catalog = catalog;
        this.admin = admin;
        this.tenants = tenants;
    }

    @GetMapping("/api/admin/overview")
    Map<String, Object> overview() { return admin.overview(); }

    @GetMapping("/api/admin/plans")
    List<Map<String, Object>> plans() { return catalog.publicPlans(); }

    @PutMapping("/api/admin/plans/{code}")
    Map<String, Object> savePlan(@PathVariable String code, @RequestBody Map<String, Object> body) {
        return catalog.savePlan(CurrentUser.get().userId(), code, body);
    }

    @PutMapping("/api/admin/theme")
    Map<String, Object> theme(@RequestBody ThemeValidator.Input input) {
        return catalog.saveTheme(CurrentUser.get().userId(), input);
    }

    @GetMapping("/api/admin/integrations")
    List<Map<String, Object>> integrations() { return catalog.adminIntegrations(); }

    @PutMapping("/api/admin/integrations/{provider}")
    Map<String, Object> saveIntegration(@PathVariable String provider, @RequestBody Map<String, Object> body) {
        return catalog.saveIntegration(CurrentUser.get().userId(), provider,
                Boolean.TRUE.equals(body.get("enabled")),
                string(body.get("clientId")), string(body.get("secret")), string(body.get("redirectUri")),
                string(body.get("scopes")), string(body.get("apiVersion")), string(body.get("environment")));
    }

    @PostMapping("/api/admin/integrations/{provider}/health")
    Map<String, Object> health(@PathVariable String provider) { return catalog.health(provider); }

    @GetMapping("/api/admin/quotes")
    List<AdminStore.QuoteRow> quotes() { return admin.quotes(); }

    @PatchMapping("/api/admin/quotes/{id}")
    Map<String, String> quote(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        String status = body.getOrDefault("status", "contacted");
        UUID assignee = body.get("assignedAdmin") == null || body.get("assignedAdmin").isBlank() ? CurrentUser.get().userId() : UUID.fromString(body.get("assignedAdmin"));
        admin.updateQuote(id, status, assignee);
        admin.audit(CurrentUser.get().userId(), null, "quote.update", "quote_requests", id.toString(), "{\"status\":\"" + status + "\"}");
        return Map.of("status", status);
    }

    @GetMapping("/api/admin/audit")
    List<Map<String, Object>> audit() { return admin.recentAudit(); }

    @PostMapping("/api/admin/workspaces/{id}/suspension")
    Map<String, String> suspend(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        boolean suspend = Boolean.parseBoolean(body.getOrDefault("suspend", "true"));
        if (suspend) {
            tenants.suspend(id, body.getOrDefault("reason", "Suspended by an administrator."));
        } else {
            tenants.reinstate(id);
        }
        admin.audit(CurrentUser.get().userId(), id, suspend ? "workspace.suspend" : "workspace.reinstate", "workspaces", id.toString(), "{}");
        return Map.of("status", suspend ? "suspended" : "active");
    }

    private static String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}

@RestController
@Profile({"local", "embedded"})
class DevMailboxController {
    private final AuthStore authStore;
    private final AppProperties properties;

    DevMailboxController(AuthStore authStore, AppProperties properties) {
        this.authStore = authStore;
        this.properties = properties;
    }

    @GetMapping("/api/dev/mailbox")
    List<AuthStore.OutboxMessage> mailbox(@RequestParam String email) {
        if (!properties.getDev().isExposeEmailOutbox()) {
            throw new com.sociallink.domain.TenantGuard.NotFoundException();
        }
        return authStore.listOutbox(email.trim().toLowerCase());
    }
}

@org.springframework.context.annotation.Configuration
class BootstrapConfig {
    @Bean
    ApplicationRunner bootstrap(AuthService auth) {
        return args -> auth.bootstrap();
    }
}
