CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    email_verified_at TIMESTAMPTZ,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret_ciphertext TEXT,
    mfa_last_step BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose VARCHAR(32) NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_tokens_user ON email_tokens (user_id, purpose);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_id UUID,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE email_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_email VARCHAR(320) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users (id),
    name VARCHAR(200) NOT NULL,
    workspace_type VARCHAR(32) NOT NULL CHECK (workspace_type IN ('business', 'agency')),
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    suspended_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspaces_owner ON workspaces (owner_user_id);

ALTER TABLE sessions
    ADD CONSTRAINT fk_sessions_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL;

CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL CHECK (role IN ('owner', 'admin', 'creator', 'approver', 'analyst')),
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members (user_id);

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    logo_key TEXT,
    timezone VARCHAR(64) NOT NULL,
    notes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_workspace ON clients (workspace_id);

CREATE TABLE client_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL CHECK (role IN ('manager', 'creator', 'approver', 'analyst')),
    UNIQUE (client_id, user_id)
);

CREATE TABLE plans (
    id UUID PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    price_paise INTEGER,
    annual_price_paise INTEGER,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    billing_interval VARCHAR(16) NOT NULL DEFAULT 'month',
    display_order INTEGER NOT NULL,
    limits_json TEXT NOT NULL,
    features_json TEXT NOT NULL,
    upgrade_rules_json TEXT NOT NULL DEFAULT '{}',
    trial_days INTEGER NOT NULL DEFAULT 0,
    prices_include_tax BOOLEAN NOT NULL DEFAULT FALSE,
    provider_plan_id VARCHAR(80),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (price_paise IS NULL OR price_paise >= 0),
    CHECK (annual_price_paise IS NULL OR annual_price_paise >= 0)
);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans (id),
    provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
    provider_subscription_id VARCHAR(128),
    status VARCHAR(32) NOT NULL CHECK (status IN ('incomplete', 'active', 'past_due', 'cancelled', 'expired')),
    limits_override_json TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    charge_count INTEGER NOT NULL DEFAULT 0 CHECK (charge_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_workspace ON subscriptions (workspace_id, status);

CREATE UNIQUE INDEX idx_subscriptions_provider
    ON subscriptions (provider, provider_subscription_id)
    WHERE provider_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX idx_one_open_subscription
    ON subscriptions (workspace_id)
    WHERE status IN ('incomplete', 'active', 'past_due');

CREATE TABLE payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL,
    provider_event_id VARCHAR(160) NOT NULL UNIQUE,
    event_type VARCHAR(80) NOT NULL,
    workspace_id UUID REFERENCES workspaces (id) ON DELETE SET NULL,
    payload_reference VARCHAR(64),
    signature_verified BOOLEAN NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_events_created ON payment_events (created_at);

CREATE TABLE usage_counters (
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    billing_period VARCHAR(7) NOT NULL,
    metric VARCHAR(64) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    PRIMARY KEY (workspace_id, billing_period, metric)
);

CREATE TABLE social_integrations (
    provider VARCHAR(32) PRIMARY KEY,
    display_name VARCHAR(80) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    client_id VARCHAR(200),
    secret_ciphertext TEXT,
    redirect_uri TEXT,
    scopes TEXT,
    api_version VARCHAR(32),
    environment VARCHAR(16) NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'live')),
    console_url TEXT,
    docs_url TEXT,
    verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified'
        CHECK (verification_status IN ('unverified', 'configured', 'verified')),
    last_health_at TIMESTAMPTZ,
    last_health_message TEXT,
    updated_by UUID REFERENCES users (id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL,
    platform_account_id VARCHAR(160) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    token_ciphertext TEXT,
    refresh_ciphertext TEXT,
    expires_at TIMESTAMPTZ,
    granted_scopes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'connected'
        CHECK (status IN ('connected', 'needs_reconnect', 'disconnected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (client_id, platform, platform_account_id)
);

CREATE INDEX idx_social_accounts_client ON social_accounts (client_id);

CREATE TABLE oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_hash VARCHAR(64) NOT NULL UNIQUE,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    code_verifier_ciphertext TEXT,
    redirect_uri TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_states_expiry ON oauth_states (expires_at);

CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    width INTEGER,
    height INTEGER,
    scan_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'rejected')),
    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_client ON media_assets (client_id);

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users (id),
    caption TEXT NOT NULL DEFAULT '',
    hashtags TEXT,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    approval_required BOOLEAN NOT NULL DEFAULT TRUE,
    content_version INTEGER NOT NULL DEFAULT 1 CHECK (content_version > 0),
    approved_version INTEGER,
    scheduled_at TIMESTAMPTZ,
    schedule_zone VARCHAR(64),
    schedule_block_code VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status IN (
        'draft', 'awaiting_approval', 'approved', 'scheduled', 'publishing',
        'published', 'partially_failed', 'failed', 'cancelled', 'needs_reconnect',
        'needs_reconcile', 'sandbox_published'
    ))
);

CREATE INDEX idx_posts_client ON posts (client_id, scheduled_at);

CREATE TABLE post_media (
    post_id UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES media_assets (id),
    position INTEGER NOT NULL,
    PRIMARY KEY (post_id, media_asset_id)
);

CREATE TABLE post_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES social_accounts (id),
    platform_payload TEXT,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    external_post_id VARCHAR(200),
    sandbox BOOLEAN NOT NULL DEFAULT FALSE,
    last_error_code VARCHAR(80),
    last_error_message TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, social_account_id),
    CHECK (status IN (
        'draft', 'awaiting_approval', 'approved', 'scheduled', 'publishing',
        'published', 'failed', 'cancelled', 'needs_reconnect', 'needs_reconcile', 'sandbox_published'
    ))
);

CREATE INDEX idx_post_targets_post ON post_targets (post_id);
CREATE INDEX idx_post_targets_status ON post_targets (status);

CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    content_version INTEGER NOT NULL,
    requested_by UUID NOT NULL REFERENCES users (id),
    status VARCHAR(32) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'invalidated')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_approval_requests_post ON approval_requests (post_id, status);

CREATE TABLE approval_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL REFERENCES approval_requests (id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users (id),
    action VARCHAR(32) NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'commented', 'invalidated')),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_target_id UUID NOT NULL REFERENCES post_targets (id) ON DELETE CASCADE,
    run_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('pending', 'locked', 'done', 'failed', 'needs_reconcile', 'cancelled')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_error_code VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_due ON scheduled_jobs (run_at) WHERE status = 'pending';

CREATE TABLE publish_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_target_id UUID NOT NULL REFERENCES post_targets (id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    outcome VARCHAR(32) NOT NULL,
    error_code VARCHAR(80),
    safe_error_message TEXT,
    sandbox BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_publish_attempts_target ON publish_attempts (post_target_id, attempted_at);

CREATE TABLE quote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces (id) ON DELETE SET NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'quote' CHECK (source IN ('quote', 'contact')),
    company VARCHAR(200),
    contact_name VARCHAR(160) NOT NULL,
    email VARCHAR(320) NOT NULL,
    phone VARCHAR(40),
    client_count INTEGER,
    account_count INTEGER,
    monthly_volume INTEGER,
    platforms TEXT,
    notes TEXT,
    requested_limits_json TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
    assigned_admin UUID REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_status ON quote_requests (status, created_at DESC);

CREATE TABLE theme_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    brand_name VARCHAR(80) NOT NULL,
    logo_url TEXT,
    favicon_url TEXT,
    primary_color VARCHAR(7) NOT NULL,
    secondary_color VARCHAR(7) NOT NULL,
    accent_color VARCHAR(7) NOT NULL,
    background_color VARCHAR(7) NOT NULL,
    surface_color VARCHAR(7) NOT NULL,
    text_color VARCHAR(7) NOT NULL,
    font_family VARCHAR(64) NOT NULL,
    font_size_base VARCHAR(8) NOT NULL,
    radius VARCHAR(8) NOT NULL,
    button_style VARCHAR(16) NOT NULL,
    color_mode VARCHAR(16) NOT NULL,
    updated_by UUID REFERENCES users (id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feature_flags (
    key VARCHAR(80) PRIMARY KEY,
    enabled BOOLEAN NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    updated_by UUID REFERENCES users (id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE security_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    session_days INTEGER NOT NULL DEFAULT 14 CHECK (session_days BETWEEN 1 AND 60),
    mfa_required_for_admins BOOLEAN NOT NULL DEFAULT TRUE,
    login_max_attempts INTEGER NOT NULL DEFAULT 8 CHECK (login_max_attempts BETWEEN 3 AND 50),
    login_window_minutes INTEGER NOT NULL DEFAULT 15 CHECK (login_window_minutes BETWEEN 1 AND 120),
    public_form_limit_per_hour INTEGER NOT NULL DEFAULT 20 CHECK (public_form_limit_per_hour BETWEEN 1 AND 200),
    audit_retention_days INTEGER NOT NULL DEFAULT 365 CHECK (audit_retention_days BETWEEN 30 AND 3650),
    allowed_origins TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE legal_documents (
    slug VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body_markdown TEXT NOT NULL,
    review_status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'in_review', 'published')),
    updated_by UUID REFERENCES users (id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_templates (
    key VARCHAR(64) PRIMARY KEY,
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    updated_by UUID REFERENCES users (id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    workspace_id UUID,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(80),
    metadata_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_workspace ON audit_logs (workspace_id, created_at DESC);

CREATE TABLE support_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users (id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
