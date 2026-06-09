package repository

import (
	"context"
	"fmt"

	"afere/backend/internal/models"

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
		SELECT cc.code, cc.description, m.porte_code
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
		if err := rows.Scan(&c.Code, &c.Description, &c.Porte); err != nil {
			return nil, fmt.Errorf("postgres: codes scan: %w", err)
		}
		p.Codes = append(p.Codes, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &p, nil
}
