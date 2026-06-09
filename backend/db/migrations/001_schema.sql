-- Migration 001: Initial production schema for Afere
-- Compatible with Neon (PostgreSQL 15+).
-- Run once on a fresh database before seeding.

-- Enable the unaccent extension for accent-insensitive search.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------------------------------------------------------------------------
-- sbn_procedures
-- Each row represents one surgical/clinical package from the SBN manual.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sbn_procedures (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        TEXT        NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sbn_procedures_name
    ON sbn_procedures USING gin (to_tsvector('portuguese', name));

-- ---------------------------------------------------------------------------
-- cbhpm_codes
-- Individual billable codes from the CBHPM catalog.
-- A single CBHPM code may appear in multiple SBN procedure packages.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cbhpm_codes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(20) UNIQUE NOT NULL,
    description TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cbhpm_codes_code
    ON cbhpm_codes (code);

CREATE INDEX IF NOT EXISTS idx_cbhpm_codes_description
    ON cbhpm_codes USING gin (to_tsvector('portuguese', description));

-- ---------------------------------------------------------------------------
-- portes
-- CBHPM porte values in BRL (CBHPM 2025/2026 edition).
-- This table is authoritative; the Go service mirrors it for fast in-memory lookup.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portes (
    code      VARCHAR(5)      PRIMARY KEY,
    value_brl NUMERIC(10, 2)  NOT NULL CHECK (value_brl > 0)
);

-- ---------------------------------------------------------------------------
-- sbn_cbhpm_mappings
-- Junction table implementing the SBN 1→N CBHPM relationship.
-- Records which CBHPM codes are suggested for a given SBN procedure,
-- along with the porte assigned by the SBN manual for that specific context.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sbn_cbhpm_mappings (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sbn_procedure_id UUID        NOT NULL REFERENCES sbn_procedures(id) ON DELETE CASCADE,
    cbhpm_code_id    UUID        NOT NULL REFERENCES cbhpm_codes(id)    ON DELETE CASCADE,
    porte_code       VARCHAR(5)  NOT NULL REFERENCES portes(code),
    sort_order       INTEGER     NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (sbn_procedure_id, cbhpm_code_id)
);

CREATE INDEX IF NOT EXISTS idx_mappings_sbn_procedure
    ON sbn_cbhpm_mappings (sbn_procedure_id, sort_order);
