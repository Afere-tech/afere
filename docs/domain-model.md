# Domain Model — Afere

## Business Context

Afere is a medical billing calculator for neurosurgeons in Brazil. Physicians bill insurance companies using the **CBHPM** table (Classificação Brasileira Hierarquizada de Procedimentos Médicos). The **SBN** (Sociedade Brasileira de Neurocirurgia) groups related CBHPM codes into named surgical packages for practical use.

One SBN surgical package maps to **one or more** CBHPM billable codes. Each code carries an intrinsic **porte** (complexity class) that determines its monetary value. The physician selects which codes were actually performed and declares whether the procedures shared the same access route — this drives the multi-procedure discount rule.

---

## Domain Concepts

| Concept | Description |
|---|---|
| **SBN Procedure** | A named surgical package published by the SBN. Has a code and a human-readable name. |
| **CBHPM Code** | A billable line item from the national procedure table. Has a code, description, and an intrinsic porte. |
| **Porte** | A complexity class (e.g. `7A`, `8B`) with a fixed BRL value defined by CBHPM 2025/2026 (Faixa Original). Read-only — the physician cannot change a code's porte. |
| **AccessRouteType** | `same` (CBHPM 4.1) or `different` (CBHPM 4.2). Drives the multi-procedure discount rate. |
| **Composition** | The physician's selection of which CBHPM codes to include in a bill. |
| **Valuation** | The monetary breakdown of a composition applying CBHPM 4.1/4.2 and 5.1 rules. |

---

## CBHPM Code Selectability

Per the SBN Manual de Codificação (MCPN), item 6:

> "A recomendação é que não haja desmembramento na relação de códigos cirúrgicos, salvo naquelas situações em que há um (*) enfatizando a ressalva no próprio rodapé da cirurgia."

All codes in an SBN procedure list are included by default. Only codes marked with `(*)` in the SBN manual are conditionally applicable. The UI currently allows free deselection; this should be improved in a future release to distinguish mandatory from optional codes.

---

## Valuation Engine

### Step 1 — Resolve porte values

For each selected CBHPM code, look up `PorteValues[code.porte]` (CBHPM 2025/2026, Faixa Original).

### Step 2 — Identify the principal procedure

The principal procedure is the code with the highest monetary porte value.

### Step 3 — Apply multi-procedure discount (CBHPM 4.1 / 4.2)

**Single procedure**: surgeon fee = 100% of its porte value (no discount).

**Same access route (CBHPM item 4.1)**:
```
surgeon_fee = principal_value + 0.50 × Σ(all other selected porte values)
```

**Different access routes (CBHPM item 4.2)**:
```
surgeon_fee = principal_value + 0.70 × Σ(all other selected porte values)
```

`total_base` (sum of all values before discounting) is preserved in the response for reference.

### Step 4 — Auxiliary surgeon fees (CBHPM 5.1 applied to surgeon total per 5.2)

Auxiliary fees are computed on the **surgeon_fee** (not on total_base), per CBHPM item 5.2.

| Position | Percentage |
|----------|-----------|
| 1st auxiliary | **60%** |
| 2nd auxiliary | **40%** |
| 3rd auxiliary | **30%** |
| 4th auxiliary | **30%** |

### Step 5 — Anesthesiologist

Optional fixed fee of R$ 1,200.00 when `requires_anesthesia = true`.

### Step 6 — Final total

```
final_total = surgeon_fee + Σ(auxiliary_fees) + anesthesiologist_fee
```

---

## Database Schema

```
sbn_procedures
  id          UUID PK (gen_random_uuid())
  code        TEXT UNIQUE NOT NULL         -- e.g. "1.1"
  name        TEXT NOT NULL                -- e.g. "CONSULTA GERAL - CRÂNIO"
  description TEXT
  created_at  TIMESTAMPTZ DEFAULT now()

cbhpm_codes
  id              UUID PK (gen_random_uuid())
  code            TEXT UNIQUE NOT NULL         -- e.g. "1.01.01.01-2"
  description     TEXT NOT NULL
  num_auxiliaries INT NOT NULL DEFAULT 0
  created_at      TIMESTAMPTZ DEFAULT now()

portes
  code        TEXT PK                      -- e.g. "7A"
  value_brl   NUMERIC(10,2) NOT NULL       -- e.g. 858.03

sbn_cbhpm_mappings
  id                UUID PK
  sbn_procedure_id  UUID FK → sbn_procedures.id
  cbhpm_code_id     UUID FK → cbhpm_codes.id
  porte_code        TEXT FK → portes.code
  sort_order        INT DEFAULT 0
  UNIQUE (sbn_procedure_id, cbhpm_code_id)
```

---

## API Flows

### Search flow

```
GET /api/procedures/search?q=cranio
  → [{ id, name }]           ← SBNProcedureResult[]
```

### Detail flow

```
GET /api/procedures/{id}
  → { id, name, cbhpm_codes: [{ code, description, porte, num_auxiliaries }] }
```

### Calculation flow

```
POST /api/calculate
  body: {
    selected_codes:    [{ cbhpm_code, description, porte }],
    auxiliaries_count: int,          -- 0–4
    requires_anesthesia: bool,
    access_route_type: "same" | "different"
  }
  → {
    code_breakdown:          [{ cbhpm_code, description, porte, base_value, is_principal }],
    access_route_type:       "same" | "different",
    surgeon_breakdown:       { principal_value, additional_gross, discount_rate,
                               additional_discounted, surgeon_total },
    lead_surgeon_fee:        number,
    individual_auxiliary_fees: [{ position, percentage, fee }],
    auxiliaries_fee:         number,
    anesthesiologist_fee:    number,
    final_total:             number,
    total_base:              number
  }
```

---

## Frontend Flow

```
Search box
  │  (user types ≥2 chars → debounced GET /api/procedures/search)
  ▼
Dropdown → user selects SBN procedure
  │  (GET /api/procedures/{id})
  ▼
CBHPM code list (all pre-checked, porte shown read-only)
  │  (user checks/unchecks codes that were performed)
  ▼
Access route selection (Mesma via / Vias diferentes)
  │
Auxiliary count selector (0–4 toggle buttons)
  │
Anesthesia toggle
  │  (debounced 150ms → POST /api/calculate)
  ▼
Right panel:
  ├── Per-code breakdown (principal badge on highest-value code)
  ├── Rule applied (4.1 or 4.2 label)
  ├── Surgeon calculation (principal + additional discounted)
  ├── Auxiliary calculation (per-position with CBHPM 5.1 percentages)
  └── Total da Equipe (surgeon + aux + anesthesia)
  │
  ▼
Share button → copies URL:
  /share?sbn={id}&codes={code1},{code2}&a={n}&an={0|1}&route={same|different}
```

---

## Backend Architecture

```
cmd/api/main.go
  └── config.Load()                        reads DATABASE_URL, PORT
  └── repository.NewPostgresRepository()  (if DATABASE_URL set)
      or repository.NewFileRepository()   (fallback: embedded JSON)
  └── handlers.RegisterRoutes(mux, repo)

internal/
  config/         env config
  models/         domain types (AccessRouteType, SurgeonBreakdown, AuxiliaryFee, …)
  repository/     interface + file-based + postgres implementations
  service/        calculator.go — pure functions, no I/O; calculator_test.go
  handlers/       HTTP handlers (search, procedure, calculate, health)
  generated/      openapi.gen.go — hand-maintained to match openapi.yaml v3.1.0
```

---

## CBHPM Auxiliary Counts (`num_auxiliaries`)

### Source

The CBHPM 2022 document (`CBHPM-2022_versao-agosto-2023.pdf`) Chapter 3 contains a six-column surgical procedure table:

```
Código | Procedimento | Porte | Custo Oper. | N° de Aux. | Anest.
```

The **N° de Aux.** column specifies the maximum number of auxiliary surgeons for each surgical code. A dash (`–`) means zero auxiliaries.

Chapters 1 (Consultas), 2 (Clínica), and 4 (Diagnóstico) have **no auxiliary column** — those codes always default to `num_auxiliaries = 0`.

### Distribution (184 catalog codes)

| num_auxiliaries | count |
|---|---|
| 0 | 48 |
| 1 | 68 |
| 2 | 60 |
| 3 | 8 |

### Data Flow

```
CBHPM-2022_versao-agosto-2023.pdf  ← official source
  │ (data/generate_catalog.py → parse_cbhpm_aux())
  ▼
procedures.json[].num_auxiliaries      ← enriched per-code field
  │ (data/generate_seed.py)
  ▼
003_seed_procedures.sql                ← INSERT … num_auxiliaries = N
  │ (applied on fresh database)
  ▼
cbhpm_codes.num_auxiliaries            ← live DB column
```

Migration `007_populate_num_auxiliaries.sql` contains 184 idempotent `UPDATE`
statements to backfill existing production databases that ran migration 003
before the aux-count enrichment was implemented.

### What Was Missing / Root Cause

Migration 005 (`add num_auxiliaries`) added the column with `DEFAULT 0` but never populated it because:

1. `data/generate_catalog.py` only parsed the **SBN MCPN PDF** — which has no N° Aux. column.
2. The CBHPM 2022 PDF (which does have N° Aux.) was used only for porte values, never for auxiliary counts.
3. `data/generate_seed.py` never emitted `num_auxiliaries` in its INSERT.

Result: all 184 codes retained the schema default of `0`.

### Automatic Suggestion Status

`cbhpm_codes.num_auxiliaries` is now populated from the official source. The
backend already returns it via `GET /api/procedures/{id}`. The frontend type
`CBHPMCode` already declares `num_auxiliaries: number`.

**Automatic suggestion** ("set auxiliariesCount to the max num_auxiliaries
among selected codes") can now be implemented safely — the data is correct
and end-to-end. No additional domain validation is required before shipping
that feature.

---

## Calculation Persistence

### Overview

Afere v2.2.0 introduces the `calculations` table, enabling physicians to save a completed valuation and retrieve it later by URL. This is the first step toward a full SaaS history feature; no authentication is required in this release.

### Entity: `Calculation`

| Field | Type | Description |
|---|---|---|
| `id` | `UUID` (PK) | Internal primary key. **Never exposed externally.** |
| `public_id` | `UUID v4` | External identifier used in all API responses and future shareable URLs (e.g. `/calc/{public_id}`). Immutable after creation. |
| `procedure_name` | `TEXT` | SBN procedure name(s) as displayed at save time. |
| `procedure_sbn_code` | `TEXT` (nullable) | SBN catalog ID of the primary procedure. |
| `selected_cbhpm_codes` | `JSONB` | Array of `{cbhpm_code, description, porte}` objects selected at save time. |
| `access_route` | `TEXT` | `"same"` or `"different"` (CBHPM 4.1/4.2). |
| `auxiliaries_count` | `INT` | 0–4. |
| `requires_anesthesia` | `BOOLEAN` | Whether anesthesia was included. |
| `surgeon_value` | `NUMERIC(12,2)` | Lead surgeon fee (= `lead_surgeon_fee` from `CalculateResponse`). |
| `auxiliaries_total_value` | `NUMERIC(12,2)` | Sum of all auxiliary fees. |
| `anesthesiologist_value` | `NUMERIC(12,2)` | Anesthesiologist fee (0 if not applicable). |
| `team_total_value` | `NUMERIC(12,2)` | Grand total of the entire team. |
| `calculation_breakdown` | `JSONB` | Full `CalculateResponse` JSON preserved verbatim for auditing. |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Record timestamps. |

### Identifier Design

Two separate UUIDs serve distinct roles:

- **`id`** — internal DB primary key generated by `gen_random_uuid()`. Used only for internal joins. Never sent in API responses.
- **`public_id`** — UUID v4 generated in application code via `crypto/rand`. Used in all API responses and future shareable URLs (`/calc/{public_id}`). Immutable after creation. This decouples the external identifier from the internal storage layout, enabling future table restructuring without breaking URLs.

### Canonical Table

The active table for saved calculations is **`calculations`** (migration 006).

The name `saved_calculations` is a legacy alias that **must not be referenced** by any current runtime code (handlers, repository implementations, SQL queries, or tests). Any reference to `saved_calculations` in new code is a bug.

### Save Flow

```
POST /api/calculations
  body: SaveCalculationRequest {
    procedure_name, procedure_sbn_code?,
    selected_codes, auxiliaries_count, requires_anesthesia, access_route_type,
    calculation_result: CalculateResponse  ← must have lead_surgeon_fee > 0
  }
  → 201 SaveCalculationResponse { public_id, created_at }
```

**Validation gate**: `calculation_result.lead_surgeon_fee > 0` ensures only completed valuations (not empty or partial inputs) are persisted.

### Retrieval Flow

```
GET /api/calculations/{public_id}
  → 200 SavedCalculation { public_id, procedure_name, selected_cbhpm_codes,
                            access_route_type, surgeon_value, team_total_value,
                            calculation_breakdown, created_at, … }
  → 404  if public_id not found
```

### Delete Flow

```
DELETE /api/calculations/{public_id}
  → 204 No Content  on success
  → 404             if public_id not found
  → 405             for any other method on /api/calculations/{id}
```

Deletion is permanent. The physician is shown a confirmation dialog before the request is sent.

### Frontend UX

After a successful valuation, a secondary "Salvar cálculo" button appears below the share button. On click:

1. A `POST /api/calculations` request is made with the current state.
2. On success, the button is replaced with a confirmation chip: **"Cálculo salvo em DD/MM/YYYY · #{short-id}"**.
3. Any change to the composition (new code selection, access route change, etc.) automatically resets the saved state, requiring an explicit re-save.

### Future Evolution

The schema is intentionally designed for a future `Calculation → User` foreign key:

```sql
-- Migration 007 (future):
ALTER TABLE calculations ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_calculations_user_id ON calculations (user_id);
```

No existing data is broken by this additive migration. The `public_id` UUID survives as the stable URL key regardless of account linkage.

---

## Future Expansion

- **Payer-specific faixa**: CBHPM 2025/2026 defines Faixas I, II, III with different monetary multipliers. Add a `faixa` selector per payer.
- **(*)-optional codes**: Mark SBN catalog codes as optional vs mandatory and enforce this in the UI.
- **Emergency surcharge**: CBHPM item 2.1 adds 30% for procedures performed at night / weekends / holidays.
- **Pediatric surcharges**: CBHPM items 4.6–4.8 add 30–100% for young patients.
- **Multi-session bills**: Allow composing multiple SBN procedures in one calculation (each with its own access route).
- **Payer-specific porte overrides**: Add `payer_porte_overrides` table for negotiated portes.
