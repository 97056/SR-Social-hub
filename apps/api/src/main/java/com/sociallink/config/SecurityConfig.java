package com.sociallink.config;

import com.sociallink.common.HttpResponses;
import com.sociallink.domain.SessionTokens;
import com.sociallink.domain.TokenCipher;
import com.sociallink.security.OriginGuardFilter;
import com.sociallink.security.SessionAuthFilter;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SessionAuthFilter sessionAuthFilter, OriginGuardFilter originGuardFilter, AppProperties properties) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource(properties)))
                .anonymous(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login", "/api/auth/verify-email", "/api/auth/verify-email/resend", "/api/auth/password/forgot", "/api/auth/password/reset").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/plans", "/api/theme", "/api/legal/**", "/api/system/status", "/api/integrations").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/quotes", "/api/contact", "/api/webhooks/razorpay").permitAll()
                        .requestMatchers("/api/docs", "/api/docs/**", "/api/openapi", "/api/openapi/**").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/api/dev/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("SUPER_ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, ex) -> HttpResponses.write(response, 401, "unauthenticated", "Sign in required."))
                        .accessDeniedHandler((request, response, ex) -> HttpResponses.write(response, 403, "forbidden", "You do not have access to that action.")))
                .addFilterBefore(sessionAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(originGuardFilter, SessionAuthFilter.class);
        return http.build();
    }

    private CorsConfigurationSource corsConfigurationSource(AppProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(properties.getBaseUrl()));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
        configuration.setAllowedHeaders(List.of("Content-Type", "X-Requested-With"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    @Bean
    FilterRegistrationBean<SessionAuthFilter> sessionFilterRegistration(SessionAuthFilter filter) {
        FilterRegistrationBean<SessionAuthFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    FilterRegistrationBean<OriginGuardFilter> originFilterRegistration(OriginGuardFilter filter) {
        FilterRegistrationBean<OriginGuardFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SessionTokens sessionTokens(AppProperties properties, Environment environment) {
        boolean production = environment.matchesProfiles("prod");
        String secret = properties.getSessionSecret();
        if (secret == null || secret.isBlank()) {
            if (production) {
                throw new IllegalStateException("SESSION_SECRET is required in the prod profile.");
            }
            secret = SessionTokens.DEV_PEPPER;
        }
        if (production && SessionTokens.DEV_PEPPER.equals(secret)) {
            throw new IllegalStateException("Refusing the development session secret in the prod profile.");
        }
        return new SessionTokens(secret);
    }

    @Bean
    SecretBox secretBox(AppProperties properties, Environment environment) {
        boolean production = environment.matchesProfiles("prod");
        String key = properties.getTokenEncryptionKey();
        if (key == null || key.isBlank()) {
            if (production) {
                throw new IllegalStateException("TOKEN_ENCRYPTION_KEY is required in the prod profile.");
            }
            return new SecretBox(null);
        }
        if (production && TokenCipher.DEV_KEY.equals(key)) {
            throw new IllegalStateException("Refusing the development token key in the prod profile.");
        }
        return new SecretBox(new TokenCipher(key));
    }

    @Bean
    OpenAPI openAPI() {
        return new OpenAPI().info(new Info()
                .title("SR Social hub API")
                .version("0.1.0")
                .description("Multi-tenant social media management API. Provider publishing stays unavailable until an authorized end-to-end test passes."));
    }

    @Bean
    ApplicationRunner productionCookieCheck(AppProperties properties, Environment environment) {
        return args -> {
            if (environment.matchesProfiles("prod") && !properties.getCookie().isSecure()) {
                throw new IllegalStateException("Production cookies must be marked Secure.");
            }
        };
    }

    public static final class SecretBox {
        private final TokenCipher cipher;

        public SecretBox(TokenCipher cipher) {
            this.cipher = cipher;
        }

        public String encrypt(String plaintext) {
            if (cipher == null) {
                throw new com.sociallink.common.ApiException(503, "encryption_not_configured", "Set TOKEN_ENCRYPTION_KEY before storing secrets.");
            }
            return cipher.encrypt(plaintext);
        }

        public String decrypt(String ciphertext) {
            if (cipher == null) {
                throw new com.sociallink.common.ApiException(503, "encryption_not_configured", "Set TOKEN_ENCRYPTION_KEY before reading secrets.");
            }
            return cipher.decrypt(ciphertext);
        }
    }
}
