package com.sociallink.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public final class EmbeddedPostgresInitializer implements EnvironmentPostProcessor {
    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String configured = environment.getProperty("spring.profiles.active", "");
        boolean embedded = Arrays.asList(environment.getActiveProfiles()).contains("embedded")
                || Arrays.asList(configured.split(",")).contains("embedded");
        if (!embedded) {
            return;
        }
        try {
            Class<?> type = Class.forName("io.zonky.test.db.postgres.embedded.EmbeddedPostgres");
            Object builder = type.getMethod("builder").invoke(null);
            builder.getClass().getMethod("setPort", int.class).invoke(builder, 0);
            Object postgres = builder.getClass().getMethod("start").invoke(builder);
            String url = (String) postgres.getClass()
                    .getMethod("getJdbcUrl", String.class, String.class)
                    .invoke(postgres, "postgres", "postgres");
            Map<String, Object> values = new HashMap<>();
            values.put("spring.datasource.url", url);
            values.put("spring.datasource.username", "postgres");
            values.put("spring.datasource.password", "postgres");
            environment.getPropertySources().addFirst(new MapPropertySource("embeddedPostgres", values));
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    postgres.getClass().getMethod("close").invoke(postgres);
                } catch (Exception ignored) {
                    // The process is exiting.
                }
            }));
        } catch (ClassNotFoundException ex) {
            throw new IllegalStateException("The embedded profile needs the Maven profile -Pembedded-db.", ex);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not start embedded Postgres.", ex);
        }
    }
}
