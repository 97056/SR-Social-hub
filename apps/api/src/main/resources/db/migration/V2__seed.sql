INSERT INTO plans (
    id, code, name, description, price_paise, annual_price_paise, currency, billing_interval,
    display_order, limits_json, features_json, upgrade_rules_json, trial_days, prices_include_tax, active
) VALUES
(
    '10000000-0000-4000-8000-000000000001',
    'starter',
    'Starter',
    'For solo businesses and small teams.',
    20000,
    NULL,
    'INR',
    'month',
    1,
    '{"clientProfiles":3,"connectedAccounts":5,"postTargetsPerMonth":60,"teamMembers":2,"storageBytes":1073741824,"exactClientCap":false,"negotiated":false}',
    '["Content composer","Calendar","Drafts","Scheduled publishing where the platform supports it","Approval workflow","Basic post status","Account reconnect","Standard support"]',
    '{"canUpgradeTo":["growth","agency","custom"],"canDowngradeTo":[]}',
    0,
    FALSE,
    TRUE
),
(
    '10000000-0000-4000-8000-000000000002',
    'growth',
    'Growth',
    'For growing businesses and small agencies.',
    40000,
    NULL,
    'INR',
    'month',
    2,
    '{"clientProfiles":4,"connectedAccounts":10,"postTargetsPerMonth":150,"teamMembers":5,"storageBytes":5368709120,"exactClientCap":false,"negotiated":false}',
    '["Content composer","Calendar","Drafts","Scheduled publishing where the platform supports it","Approval workflow","Basic post status","Account reconnect","Standard support"]',
    '{"canUpgradeTo":["agency","custom"],"canDowngradeTo":["starter"]}',
    0,
    FALSE,
    TRUE
),
(
    '10000000-0000-4000-8000-000000000003',
    'agency',
    'Agency',
    'For agencies handling up to six client brands.',
    60000,
    NULL,
    'INR',
    'month',
    3,
    '{"clientProfiles":6,"connectedAccounts":15,"postTargetsPerMonth":300,"teamMembers":10,"storageBytes":10737418240,"exactClientCap":true,"negotiated":false}',
    '["Content composer","Calendar","Drafts","Scheduled publishing where the platform supports it","Approval workflow","Basic post status","Account reconnect","Standard support","Six client profiles included"]',
    '{"canUpgradeTo":["custom"],"canDowngradeTo":["growth","starter"]}',
    0,
    FALSE,
    TRUE
),
(
    '10000000-0000-4000-8000-000000000004',
    'custom',
    'Custom',
    'Negotiated limits for larger agencies and high-volume teams.',
    NULL,
    NULL,
    'INR',
    'month',
    4,
    '{"clientProfiles":null,"connectedAccounts":null,"postTargetsPerMonth":null,"teamMembers":null,"storageBytes":null,"exactClientCap":false,"negotiated":true}',
    '["Limits and price are agreed per workspace","Request a quote and an admin applies the negotiated entitlement"]',
    '{"canUpgradeTo":[],"canDowngradeTo":["agency","growth","starter"]}',
    0,
    FALSE,
    TRUE
);

INSERT INTO theme_settings (
    id, brand_name, logo_url, favicon_url, primary_color, secondary_color, accent_color,
    background_color, surface_color, text_color, font_family, font_size_base, radius,
    button_style, color_mode
) VALUES (
    1,
    'SR Social hub',
    NULL,
    NULL,
    '#0F3D3E',
    '#115E59',
    '#9A3412',
    '#F4F0E8',
    '#FFFDF9',
    '#1C1917',
    'Source Sans 3',
    '16px',
    '0.75rem',
    'solid',
    'light'
);

INSERT INTO security_settings (
    id, session_days, mfa_required_for_admins, login_max_attempts, login_window_minutes,
    public_form_limit_per_hour, audit_retention_days, allowed_origins
) VALUES (
    1, 14, TRUE, 8, 15, 20, 365, 'http://localhost:3000'
);

INSERT INTO feature_flags (key, enabled, config_json) VALUES
('signup.enabled', TRUE, '{}'),
('maintenance.banner', FALSE, '{"message":""}'),
('publishing.sandbox', FALSE, '{}');

INSERT INTO social_integrations (
    provider, display_name, enabled, console_url, docs_url, environment, verification_status, scopes
) VALUES
('facebook', 'Facebook Pages', FALSE, 'https://developers.facebook.com/', 'https://developers.facebook.com/docs/graph-api/', 'test', 'unverified', ''),
('instagram', 'Instagram', FALSE, 'https://developers.facebook.com/', 'https://developers.facebook.com/docs/instagram-platform/', 'test', 'unverified', ''),
('x', 'X', FALSE, 'https://developer.x.com/', 'https://docs.x.com/', 'test', 'unverified', ''),
('linkedin', 'LinkedIn', FALSE, 'https://www.linkedin.com/developers/', 'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api', 'test', 'unverified', ''),
('youtube', 'YouTube', FALSE, 'https://console.cloud.google.com/', 'https://developers.google.com/youtube/v3', 'test', 'unverified', ''),
('pinterest', 'Pinterest', FALSE, 'https://developers.pinterest.com/', 'https://developers.pinterest.com/docs/', 'test', 'unverified', ''),
('threads', 'Threads', FALSE, 'https://developers.facebook.com/', 'https://developers.facebook.com/docs/threads/', 'test', 'unverified', '');

INSERT INTO legal_documents (slug, title, body_markdown, review_status) VALUES
(
    'terms',
    'Terms of service',
    E'DRAFT — not reviewed by counsel. Do not treat this text as a final customer agreement.\n\nSR Social hub provides tools for scheduling and publishing content to social accounts that a customer connects with official OAuth. Customers are responsible for the content they publish and for complying with each platform''s rules.\n\nPaid plans renew monthly until cancelled. Limits shown at checkout are the limits stored for that plan. Taxes are extra unless a plan explicitly says they are included.\n\nThis draft must be replaced with counsel-reviewed terms before launch.',
    'draft'
),
(
    'privacy',
    'Privacy policy',
    E'DRAFT — not reviewed by counsel. Do not treat this text as a final privacy notice.\n\nThe service stores account details, workspace content, connected-account tokens in encrypted form, and billing events needed to run the product. OAuth tokens are not shown to other customers or returned to the browser.\n\nThis draft must be replaced with a counsel-reviewed privacy notice for every country where the service will operate.',
    'draft'
),
(
    'refunds',
    'Cancellation and refunds',
    E'DRAFT — not reviewed by counsel.\n\nCustomers can cancel a subscription from the billing page. Cancellation stops future renewal according to the payment provider. Content is not deleted automatically when a subscription expires.\n\nReplace this draft with the refund and cancellation policy you will actually honour.',
    'draft'
),
(
    'data-deletion',
    'Data deletion',
    E'DRAFT — not reviewed by counsel.\n\nA workspace owner can request deletion of a workspace and its connected-account tokens. Platform providers may also require a data-deletion callback once their app review is underway.\n\nDocument the operational deletion steps and retention exceptions with counsel before launch.',
    'draft'
);

INSERT INTO email_templates (key, subject, body) VALUES
(
    'verify_email',
    'Verify your {{brand}} email',
    E'Hello {{name}},\n\nConfirm your email address:\n{{link}}\n\nThis link expires in 24 hours.'
),
(
    'reset_password',
    'Reset your {{brand}} password',
    E'Hello {{name}},\n\nReset your password:\n{{link}}\n\nThis link expires in 1 hour. If you did not ask for a reset, you can ignore this message.'
),
(
    'quote_received',
    'We received your {{brand}} request',
    E'Hello {{name}},\n\nWe received your request and will reply to {{email}}. This is an acknowledgement, not a quote or a contract.'
);
