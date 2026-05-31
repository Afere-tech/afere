-- name: SearchProcedures :many
SELECT procedure_name, cbhpm_code, description, porte
FROM procedures
WHERE procedure_name ILIKE '%' || sqlc.arg(query) || '%'
   OR cbhpm_code ILIKE '%' || sqlc.arg(query) || '%'
   OR description ILIKE '%' || sqlc.arg(query) || '%'
ORDER BY procedure_name
LIMIT 20;

-- name: GetProcedureByCode :one
SELECT procedure_name, cbhpm_code, description, porte
FROM procedures
WHERE cbhpm_code = sqlc.arg(cbhpm_code);

-- name: GetPorteValue :one
SELECT porte, value_cents
FROM porte_values
WHERE porte = sqlc.arg(porte);
