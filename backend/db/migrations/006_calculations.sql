-- Migration 006: Persistent calculations
--
-- Stores completed valuations for history, auditing, and future account features.
-- The public_id column is the external-facing identifier used in URLs and API responses;
-- the UUID primary key is reserved for internal joins.
--
-- Future evolution:
--   ALTER TABLE calculations ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
--   CREATE INDEX idx_calculations_user_id ON calculations (user_id);

CREATE TABLE calculations (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id                UUID        UNIQUE NOT NULL,
    procedure_name           TEXT        NOT NULL,
    procedure_sbn_code       TEXT,
    selected_cbhpm_codes     JSONB       NOT NULL,
    access_route             TEXT        NOT NULL CHECK (access_route IN ('same', 'different')),
    auxiliaries_count        INT         NOT NULL DEFAULT 0 CHECK (auxiliaries_count BETWEEN 0 AND 4),
    requires_anesthesia      BOOLEAN     NOT NULL DEFAULT FALSE,
    surgeon_value            NUMERIC(12, 2) NOT NULL,
    auxiliaries_total_value  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    anesthesiologist_value   NUMERIC(12, 2) NOT NULL DEFAULT 0,
    team_total_value         NUMERIC(12, 2) NOT NULL,
    calculation_breakdown    JSONB       NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by public URL identifier
CREATE INDEX idx_calculations_public_id   ON calculations (public_id);
-- Support future history queries ordered by recency
CREATE INDEX idx_calculations_created_at  ON calculations (created_at DESC);
-- Support future user-scoped history (no-op until user_id column is added)
-- CREATE INDEX idx_calculations_user_id ON calculations (user_id);
