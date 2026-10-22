package com.sociallink.domain;

import java.net.URI;
import java.util.Set;
import java.util.regex.Pattern;

public final class ThemeValidator {
    public static final Set<String> FONTS = Set.of("Inter", "Source Sans 3", "IBM Plex Sans", "Nunito Sans");
    private static final Pattern HEX = Pattern.compile("^#[0-9A-F]{6}$");
    private static final Pattern RADIUS = Pattern.compile("^(0|0\\.25|0\\.5|0\\.75|1|1\\.5|2)rem$");
    private static final Pattern FONT_SIZE = Pattern.compile("^(14|15|16|17|18|20)px$");
    private static final Set<String> BUTTONS = Set.of("solid", "outline", "soft");
    private static final Set<String> MODES = Set.of("light", "dark", "system");

    public record Input(
            String brandName,
            String logoUrl,
            String faviconUrl,
            String primaryColor,
            String secondaryColor,
            String accentColor,
            String backgroundColor,
            String surfaceColor,
            String textColor,
            String fontFamily,
            String fontSizeBase,
            String radius,
            String buttonStyle,
            String colorMode
    ) {
    }

    public record Tokens(
            String brandName,
            String logoUrl,
            String faviconUrl,
            String primaryColor,
            String secondaryColor,
            String accentColor,
            String backgroundColor,
            String surfaceColor,
            String textColor,
            String fontFamily,
            String fontSizeBase,
            String radius,
            String buttonStyle,
            String colorMode,
            String primaryForeground,
            String secondaryForeground,
            String accentForeground
    ) {
    }

    public static final class ThemeValidationException extends RuntimeException {
        public ThemeValidationException(String message) {
            super(message);
        }
    }

    public Tokens validate(Input input) {
        String brand = cleanBrand(input.brandName());
        String primary = color(input.primaryColor(), "Primary");
        String secondary = color(input.secondaryColor(), "Secondary");
        String accent = color(input.accentColor(), "Accent");
        String background = color(input.backgroundColor(), "Background");
        String surface = color(input.surfaceColor(), "Surface");
        String text = color(input.textColor(), "Text");
        requireContrast(text, background, "Text on background");
        requireContrast(text, surface, "Text on surface");
        String primaryForeground = foreground(primary, "Primary");
        String secondaryForeground = foreground(secondary, "Secondary");
        String accentForeground = foreground(accent, "Accent");
        if (!FONTS.contains(input.fontFamily())) {
            throw new ThemeValidationException("Choose a font from the approved list.");
        }
        if (input.fontSizeBase() == null || !FONT_SIZE.matcher(input.fontSizeBase()).matches()) {
            throw new ThemeValidationException("Choose an approved base font size.");
        }
        if (input.radius() == null || !RADIUS.matcher(input.radius()).matches()) {
            throw new ThemeValidationException("Choose an approved corner radius.");
        }
        if (input.buttonStyle() == null || !BUTTONS.contains(input.buttonStyle())) {
            throw new ThemeValidationException("Choose an approved button style.");
        }
        if (input.colorMode() == null || !MODES.contains(input.colorMode())) {
            throw new ThemeValidationException("Choose light, dark, or system.");
        }
        return new Tokens(
                brand,
                url(input.logoUrl(), "Logo"),
                url(input.faviconUrl(), "Favicon"),
                primary,
                secondary,
                accent,
                background,
                surface,
                text,
                input.fontFamily(),
                input.fontSizeBase(),
                input.radius(),
                input.buttonStyle(),
                input.colorMode(),
                primaryForeground,
                secondaryForeground,
                accentForeground
        );
    }

    private static String cleanBrand(String value) {
        if (value == null || value.isBlank() || value.length() > 80) {
            throw new ThemeValidationException("Brand name must be 1 to 80 characters.");
        }
        String trimmed = value.trim();
        for (int i = 0; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            if (c < 32 || c == '<' || c == '>' || c == '{' || c == '}' || c == '`' ) {
                throw new ThemeValidationException("Brand name contains characters that are not allowed.");
            }
        }
        return trimmed;
    }

    private static String color(String value, String label) {
        if (value == null) {
            throw new ThemeValidationException(label + " color is required.");
        }
        String normalized = value.trim().toUpperCase();
        if (!HEX.matcher(normalized).matches()) {
            throw new ThemeValidationException(label + " color must be a #RRGGBB value.");
        }
        return normalized;
    }

    private static String url(String value, String label) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        URI uri;
        try {
            uri = URI.create(trimmed);
        } catch (IllegalArgumentException ex) {
            throw new ThemeValidationException(label + " must be an https URL.");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
            throw new ThemeValidationException(label + " must be an https URL without credentials.");
        }
        String lower = trimmed.toLowerCase();
        if (lower.contains("javascript:") || lower.contains("<") || lower.contains(">")) {
            throw new ThemeValidationException(label + " URL is not allowed.");
        }
        return trimmed;
    }

    private static void requireContrast(String foreground, String background, String label) {
        if (contrast(foreground, background) < 4.5) {
            throw new ThemeValidationException(label + " contrast is below WCAG AA (4.5:1).");
        }
    }

    private static String foreground(String background, String label) {
        if (contrast("#FFFFFF", background) >= 4.5) {
            return "#FFFFFF";
        }
        if (contrast("#1C1917", background) >= 4.5) {
            return "#1C1917";
        }
        throw new ThemeValidationException(label + " color needs a stronger contrast against white or ink text.");
    }

    static double contrast(String hexA, String hexB) {
        double l1 = luminance(hexA);
        double l2 = luminance(hexB);
        double lighter = Math.max(l1, l2);
        double darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    private static double luminance(String hex) {
        int rgb = Integer.parseInt(hex.substring(1), 16);
        double r = channel((rgb >> 16) & 0xff);
        double g = channel((rgb >> 8) & 0xff);
        double b = channel(rgb & 0xff);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    private static double channel(int value) {
        double s = value / 255.0;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
}
