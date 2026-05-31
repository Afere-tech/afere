CREATE TABLE procedures (
  id BIGSERIAL PRIMARY KEY,
  procedure_name TEXT NOT NULL,
  cbhpm_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  porte TEXT NOT NULL
);

CREATE TABLE porte_values (
  porte TEXT PRIMARY KEY,
  value_cents BIGINT NOT NULL CHECK (value_cents >= 0)
);
