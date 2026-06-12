package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"afere/backend/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRepository is a ProcedureRepository backed by a Neon/PostgreSQL database.
// Activate it by setting the DATABASE_URL environment variable.
type PostgresRepository struct {
	pool *pgxpool.Pool
}

// NewPostgresRepository opens a connection pool to the Neon database at dsn.
// Returns an error if the connection cannot be established.
func NewPostgresRepository(ctx context.Context, dsn string) (*PostgresRepository, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("postgres: open pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres: ping: %w", err)
	}
	return &PostgresRepository{pool: pool}, nil
}

// Close releases all connections in the pool.
func (r *PostgresRepository) Close() {
	r.pool.Close()
}

// Search returns up to 20 SBN procedures matching the query (accent-insensitive).
// Results are ordered by relevance: name-starts-with > name-contains > code/description match.
// The trigram indexes created in migration 004 make the ILIKE patterns sub-millisecond.
func (r *PostgresRepository) Search(query string) ([]models.SBNProcedure, error) {
	ctx := context.Background()
	rows, err := r.pool.Query(ctx, `
		SELECT id, name FROM (
			SELECT DISTINCT ON (sp.id)
				sp.id::text AS id,
				sp.name,
				CASE
					WHEN f_unaccent(lower(sp.name)) ILIKE f_unaccent(lower($1)) || '%'        THEN 0
					WHEN f_unaccent(lower(sp.name)) ILIKE '%' || f_unaccent(lower($1)) || '%' THEN 1
					ELSE 2
				END AS relevance
			FROM sbn_procedures sp
			LEFT JOIN sbn_cbhpm_mappings m ON m.sbn_procedure_id = sp.id
			LEFT JOIN cbhpm_codes cc       ON cc.id = m.cbhpm_code_id
			WHERE
				f_unaccent(lower(sp.name))           ILIKE '%' || f_unaccent(lower($1)) || '%'
				OR f_unaccent(lower(cc.code))        ILIKE '%' || f_unaccent(lower($1)) || '%'
				OR f_unaccent(lower(cc.description)) ILIKE '%' || f_unaccent(lower($1)) || '%'
			ORDER BY sp.id
		) sub
		ORDER BY relevance, name
		LIMIT 20
	`, query)
	if err != nil {
		return nil, fmt.Errorf("postgres: search: %w", err)
	}
	defer rows.Close()

	var results []models.SBNProcedure
	for rows.Next() {
		var p models.SBNProcedure
		if err := rows.Scan(&p.ID, &p.Name); err != nil {
			return nil, fmt.Errorf("postgres: search scan: %w", err)
		}
		results = append(results, p)
	}
	return results, rows.Err()
}

// SaveCalculation inserts a new calculation row and returns the record with its
// generated UUID, public_id, and created_at populated from the database.
func (r *PostgresRepository) SaveCalculation(calc models.Calculation) (*models.Calculation, error) {
	publicID, err := models.GeneratePublicID()
	if err != nil {
		return nil, fmt.Errorf("postgres: generate public id: %w", err)
	}

	codesJSON, err := json.Marshal(calc.SelectedCBHPMCodes)
	if err != nil {
		return nil, fmt.Errorf("postgres: marshal selected codes: %w", err)
	}

	ctx := context.Background()
	err = r.pool.QueryRow(ctx, `
		INSERT INTO calculations (
			public_id, procedure_name, procedure_sbn_code, selected_cbhpm_codes,
			access_route, auxiliaries_count, requires_anesthesia,
			surgeon_value, auxiliaries_total_value, anesthesiologist_value, team_total_value,
			calculation_breakdown
		) VALUES (
			$1::uuid, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
		)
		RETURNING id::text, created_at, updated_at
	`,
		publicID,
		calc.ProcedureName,
		calc.ProcedureSBNCode,
		string(codesJSON),
		string(calc.AccessRoute),
		calc.AuxiliariesCount,
		calc.RequiresAnesthesia,
		calc.SurgeonValue,
		calc.AuxiliariesTotalValue,
		calc.AnesthesiologistValue,
		calc.TeamTotalValue,
		string(calc.BreakdownJSON),
	).Scan(&calc.ID, &calc.CreatedAt, &calc.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("postgres: save calculation: %w", err)
	}

	calc.PublicID = publicID
	return &calc, nil
}

// ListCalculations returns up to 100 saved calculations ordered newest-first.
func (r *PostgresRepository) ListCalculations() ([]models.CalculationSummary, error) {
	ctx := context.Background()
	rows, err := r.pool.Query(ctx, `
		SELECT
			public_id::text, procedure_name, COALESCE(procedure_sbn_code, ''),
			surgeon_value, auxiliaries_total_value, anesthesiologist_value, team_total_value,
			auxiliaries_count, requires_anesthesia, access_route, created_at
		FROM calculations
		ORDER BY created_at DESC
		LIMIT 100
	`)
	if err != nil {
		return nil, fmt.Errorf("postgres: list calculations: %w", err)
	}
	defer rows.Close()

	var results []models.CalculationSummary
	for rows.Next() {
		var s models.CalculationSummary
		var accessRoute string
		if err := rows.Scan(
			&s.PublicID, &s.ProcedureName, &s.ProcedureSBNCode,
			&s.SurgeonValue, &s.AuxiliariesTotalValue, &s.AnesthesiologistValue, &s.TeamTotalValue,
			&s.AuxiliariesCount, &s.RequiresAnesthesia,
			&accessRoute, &s.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("postgres: list calculations scan: %w", err)
		}
		s.AccessRoute = models.AccessRouteType(accessRoute)
		results = append(results, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if results == nil {
		results = []models.CalculationSummary{}
	}
	return results, nil
}

// GetCalculationByPublicID retrieves a saved calculation by its public URL identifier.
// Returns nil, nil when no record matches.
func (r *PostgresRepository) GetCalculationByPublicID(publicID string) (*models.Calculation, error) {
	ctx := context.Background()

	var calc models.Calculation
	var codesJSON, breakdownJSON []byte
	var accessRoute string

	err := r.pool.QueryRow(ctx, `
		SELECT
			id::text, public_id,
			procedure_name, COALESCE(procedure_sbn_code, ''),
			selected_cbhpm_codes, access_route,
			auxiliaries_count, requires_anesthesia,
			surgeon_value, auxiliaries_total_value, anesthesiologist_value, team_total_value,
			calculation_breakdown, created_at, updated_at
		FROM calculations
		WHERE public_id = $1
	`, publicID).Scan(
		&calc.ID, &calc.PublicID,
		&calc.ProcedureName, &calc.ProcedureSBNCode,
		&codesJSON, &accessRoute,
		&calc.AuxiliariesCount, &calc.RequiresAnesthesia,
		&calc.SurgeonValue, &calc.AuxiliariesTotalValue, &calc.AnesthesiologistValue, &calc.TeamTotalValue,
		&breakdownJSON, &calc.CreatedAt, &calc.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("postgres: get calculation: %w", err)
	}

	if err := json.Unmarshal(codesJSON, &calc.SelectedCBHPMCodes); err != nil {
		return nil, fmt.Errorf("postgres: unmarshal selected codes: %w", err)
	}
	calc.AccessRoute = models.AccessRouteType(accessRoute)
	calc.BreakdownJSON = json.RawMessage(breakdownJSON)
	return &calc, nil
}

// DeleteCalculationByPublicID deletes the calculation row identified by public_id.
// Returns (true, nil) when a row was deleted, (false, nil) when no row matched.
func (r *PostgresRepository) DeleteCalculationByPublicID(publicID string) (bool, error) {
	ctx := context.Background()
	tag, err := r.pool.Exec(ctx, `DELETE FROM calculations WHERE public_id = $1`, publicID)
	if err != nil {
		return false, fmt.Errorf("postgres: delete calculation: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// GetByID returns the full procedure package or nil if the ID does not exist.
func (r *PostgresRepository) GetByID(id string) (*models.ProcedureWithCodes, error) {
	ctx := context.Background()

	var p models.ProcedureWithCodes
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, name FROM sbn_procedures WHERE id = $1
	`, id).Scan(&p.ID, &p.Name)
	if err != nil {
		// pgx returns pgx.ErrNoRows; treat as not-found (nil, nil).
		return nil, nil //nolint:nilerr
	}

	rows, err := r.pool.Query(ctx, `
		SELECT cc.code, cc.description, m.porte_code, COALESCE(cc.num_auxiliaries, 0)
		FROM sbn_cbhpm_mappings m
		JOIN cbhpm_codes cc ON cc.id = m.cbhpm_code_id
		WHERE m.sbn_procedure_id = $1
		ORDER BY m.sort_order, cc.code
	`, id)
	if err != nil {
		return nil, fmt.Errorf("postgres: get codes: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var c models.CBHPMCode
		if err := rows.Scan(&c.Code, &c.Description, &c.Porte, &c.NumAuxiliaries); err != nil {
			return nil, fmt.Errorf("postgres: codes scan: %w", err)
		}
		p.Codes = append(p.Codes, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &p, nil
}
