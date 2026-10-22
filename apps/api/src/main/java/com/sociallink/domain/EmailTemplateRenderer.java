package com.sociallink.domain;

import java.util.Map;

public final class EmailTemplateRenderer {
    private EmailTemplateRenderer() {
    }

    public static String render(String template, Map<String, String> values) {
        if (template == null || template.contains("<") || template.contains("${") || template.contains("{{#")) {
            throw new IllegalArgumentException("Email template contains unsupported markup.");
        }
        String rendered = template;
        for (Map.Entry<String, String> entry : values.entrySet()) {
            String safe = entry.getValue() == null ? "" : entry.getValue().replace("\r", " ").replace("\n", " ");
            rendered = rendered.replace("{{" + entry.getKey() + "}}", safe);
        }
        if (rendered.contains("{{")) {
            throw new IllegalArgumentException("Email template has an unknown placeholder.");
        }
        return rendered;
    }
}
