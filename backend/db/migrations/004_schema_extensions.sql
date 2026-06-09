-- Migration 004: Performance indexes + future-proof schema extensions.
-- Compatible with Neon (PostgreSQL 15+).
-- Run after 001, 002, 003.

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigram extension for fast autocomplete
-- ─────────────────────────────────────────────────────────────────────────────
-- pg_trgm enables GIN indexes on substring/ILIKE patterns.
-- The SearchProcedures query uses '%query%' patterns; without trigram indexes
-- those scans are sequential. With them, Postgres can use the GIN index and
-- return autocomplete results in < 5 ms even on large catalogs.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() is STABLE, not IMMUTABLE, so it cannot be used directly in a
-- functional index expression. This wrapper calls the two-argument form with
-- a hardcoded dictionary name, which makes the behaviour deterministic and
-- allows PostgreSQL to accept it in an index.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  SET search_path = public AS
  $$ SELECT unaccent('unaccent', $1) $$;

-- Trigram indexes for fast autocomplete ILIKE '%query%' matching.
-- For the index to be used the query expression must match exactly:
--   f_unaccent(lower(column)) ILIKE '%' || f_unaccent(lower($1)) || '%'
CREATE INDEX IF NOT EXISTS idx_sbn_procedures_name_trgm
    ON sbn_procedures USING gin (f_unaccent(lower(name)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cbhpm_codes_description_trgm
    ON cbhpm_codes USING gin (f_unaccent(lower(description)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cbhpm_codes_code_trgm
    ON cbhpm_codes USING gin (code gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- Catalog versioning
-- ─────────────────────────────────────────────────────────────────────────────
-- Tracks which edition of the SBN or CBHPM catalog is active.
-- Enables multiple concurrent catalog versions (e.g. CBHPM 2024 alongside 2026)
-- so physicians can recalculate historical cases without data loss.
CREATE TABLE IF NOT EXISTS catalog_versions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    kind        VARCHAR(10) NOT NULL CHECK (kind IN ('SBN', 'CBHPM')),
    edition     VARCHAR(50) NOT NULL,          -- e.g. '2025/2026'
    valid_from  DATE        NOT NULL,
    valid_until DATE,                          -- NULL = currently active
    is_current  BOOLEAN     NOT NULL DEFAULT false,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (kind, edition)
);

-- Seed the current catalog version
INSERT INTO catalog_versions (kind, edition, valid_from, is_current) VALUES
    ('SBN',   '2025',      '2025-01-01', true),
    ('CBHPM', '2025/2026', '2025-01-01', true)
ON CONFLICT (kind, edition) DO NOTHING;

-- Add version tracking to core tables.
-- Nullable so existing seed rows are not immediately forced to declare a version.
-- The application resolves "current" version via is_current = true when needed.
ALTER TABLE sbn_procedures ADD COLUMN IF NOT EXISTS catalog_version_id UUID
    REFERENCES catalog_versions(id);
ALTER TABLE cbhpm_codes    ADD COLUMN IF NOT EXISTS catalog_version_id UUID
    REFERENCES catalog_versions(id);
ALTER TABLE portes         ADD COLUMN IF NOT EXISTS catalog_version_id UUID
    REFERENCES catalog_versions(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Physician accounts
-- ─────────────────────────────────────────────────────────────────────────────
-- Designed for future authentication (OAuth / magic-link / CRM lookup).
-- crm is the Brazilian medical license number (e.g. "CRM/SP 123456").
-- No provider-specific columns here — an auth_providers join table is added later.
CREATE TABLE IF NOT EXISTS physician_accounts (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email        TEXT        UNIQUE NOT NULL,
    name         TEXT        NOT NULL,
    crm          VARCHAR(30),                  -- Conselho Regional de Medicina
    specialty    VARCHAR(100),                 -- e.g. 'Neurocirurgia'
    onboarded    BOOLEAN     NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physician_accounts_email
    ON physician_accounts (email);

-- ─────────────────────────────────────────────────────────────────────────────
-- Saved calculations
-- ─────────────────────────────────────────────────────────────────────────────
-- A physician can persist a composition for later recall or sharing.
-- sbn_procedure_ids:  ordered array of selected SBN procedure UUIDs.
-- selected_codes:     JSON object {"cbhpm_code": "porte"} (physician's adjustments).
-- result_snapshot:    full CalculationResult at save time; avoids recomputation.
CREATE TABLE IF NOT EXISTS saved_calculations (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    physician_id        UUID        REFERENCES physician_accounts(id) ON DELETE SET NULL,
    label               TEXT,                  -- optional user-assigned name
    sbn_procedure_ids   UUID[]      NOT NULL,
    selected_codes      JSONB       NOT NULL,
    auxiliaries_count   SMALLINT    NOT NULL DEFAULT 1,
    requires_anesthesia BOOLEAN     NOT NULL DEFAULT true,
    result_snapshot     JSONB       NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_calculations_physician
    ON saved_calculations (physician_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Shared links
-- ─────────────────────────────────────────────────────────────────────────────
-- Token-based URLs that render a read-only snapshot of a calculation.
-- The payload is denormalized so the share page renders without additional
-- DB reads: one row lookup = full data to display.
-- token: short random slug used in the URL (e.g. /share/abc123xyz).
CREATE TABLE IF NOT EXISTS shared_links (
    token               VARCHAR(32)  PRIMARY KEY,
    calculation_id      UUID         REFERENCES saved_calculations(id) ON DELETE SET NULL,
    -- Denormalized payload (allows sharing without a prior save):
    sbn_procedure_ids   UUID[]       NOT NULL,
    selected_codes      JSONB        NOT NULL,
    auxiliaries_count   SMALLINT     NOT NULL DEFAULT 1,
    requires_anesthesia BOOLEAN      NOT NULL DEFAULT true,
    result_snapshot     JSONB        NOT NULL,
    -- Metadata:
    views               INTEGER      NOT NULL DEFAULT 0,
    expires_at          TIMESTAMPTZ,           -- NULL = never expires
    created_by          UUID         REFERENCES physician_accounts(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Partial index only on expiring links to keep it small.
CREATE INDEX IF NOT EXISTS idx_shared_links_expires
    ON shared_links (expires_at)
    WHERE expires_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Procedure favorites
-- ─────────────────────────────────────────────────────────────────────────────
-- Physicians bookmark frequently used SBN procedures for one-click access.
CREATE TABLE IF NOT EXISTS procedure_favorites (
    physician_id     UUID        NOT NULL REFERENCES physician_accounts(id) ON DELETE CASCADE,
    sbn_procedure_id UUID        NOT NULL REFERENCES sbn_procedures(id)     ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (physician_id, sbn_procedure_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Analytics events
-- ─────────────────────────────────────────────────────────────────────────────
-- Anonymized event stream. No PHI (Protected Health Information) here.
-- session_id is an anonymous browser token, not tied to an account.
-- event_type values: 'search', 'procedure_view', 'calculation', 'share_create', 'share_view'.
-- payload: event-specific structured data (query text, procedure id, etc.).
CREATE TABLE IF NOT EXISTS analytics_events (
    id           BIGSERIAL   PRIMARY KEY,
    event_type   VARCHAR(50) NOT NULL,
    session_id   VARCHAR(64),
    physician_id UUID        REFERENCES physician_accounts(id) ON DELETE SET NULL,
    payload      JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index for the most common analytics queries (by type + time window).
CREATE INDEX IF NOT EXISTS idx_analytics_type_time
    ON analytics_events (event_type, created_at DESC);

-- Time-range scans across all event types (e.g. daily active usage).
CREATE INDEX IF NOT EXISTS idx_analytics_created_at
    ON analytics_events (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Audit log
-- ─────────────────────────────────────────────────────────────────────────────
-- Records catalog changes (procedure/code edits) for compliance and rollback.
-- Populated at the application layer (not via triggers) to avoid lock overhead.
-- old_data / new_data store the full row as JSON for point-in-time recovery.
CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGSERIAL    PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation  VARCHAR(10)  NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    row_id     UUID,
    old_data   JSONB,
    new_data   JSONB,
    changed_by UUID         REFERENCES physician_accounts(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_row
    ON audit_log (table_name, row_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
    ON audit_log (changed_at DESC);
