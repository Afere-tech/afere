-- Queries for the Afere domain model (sbn_procedures → sbn_cbhpm_mappings → cbhpm_codes).
-- These are the canonical queries used by PostgresRepository.
-- If sqlc codegen is wired into CI, these become the source of truth for generated types.

-- name: SearchProcedures :many
-- Returns up to 20 SBN procedures matching the query, ordered by relevance:
--   0 = procedure name starts with the query (strongest signal)
--   1 = procedure name contains the query
--   2 = match is only in a CBHPM code or description
-- The trigram indexes on unaccent(lower(name)) and unaccent(lower(description))
-- (created in migration 004) make the ILIKE patterns sub-millisecond on Neon.
SELECT id, name
FROM (
    SELECT DISTINCT ON (sp.id)
        sp.id::text AS id,
        sp.name,
        CASE
            WHEN unaccent(lower(sp.name)) ILIKE unaccent(lower(sqlc.arg(query))) || '%'   THEN 0
            WHEN unaccent(lower(sp.name)) ILIKE '%' || unaccent(lower(sqlc.arg(query))) || '%' THEN 1
            ELSE 2
        END AS relevance
    FROM sbn_procedures sp
    LEFT JOIN sbn_cbhpm_mappings m  ON m.sbn_procedure_id = sp.id
    LEFT JOIN cbhpm_codes cc        ON cc.id = m.cbhpm_code_id
    WHERE
        unaccent(lower(sp.name))           ILIKE '%' || unaccent(lower(sqlc.arg(query))) || '%'
        OR unaccent(lower(cc.code))        ILIKE '%' || unaccent(lower(sqlc.arg(query))) || '%'
        OR unaccent(lower(cc.description)) ILIKE '%' || unaccent(lower(sqlc.arg(query))) || '%'
    ORDER BY sp.id
) sub
ORDER BY relevance, name
LIMIT 20;

-- name: GetProcedureByID :one
SELECT id::text, name
FROM sbn_procedures
WHERE id = sqlc.arg(id)::uuid;

-- name: GetProcedureCodes :many
SELECT
    cc.code,
    cc.description,
    m.porte_code AS porte
FROM sbn_cbhpm_mappings m
JOIN cbhpm_codes cc ON cc.id = m.cbhpm_code_id
WHERE m.sbn_procedure_id = sqlc.arg(sbn_procedure_id)::uuid
ORDER BY m.sort_order, cc.code;

-- name: GetPorteValue :one
SELECT code, value_brl
FROM portes
WHERE code = sqlc.arg(code);
