// Package repository defines the data-access contract for Afere.
package repository

import "afere/backend/internal/models"

// Repository is the unified data-access contract for Afere.
// It combines procedure catalog access with calculation persistence.
// Both FileRepository (development/fallback) and PostgresRepository (production)
// must satisfy this interface.
type Repository interface {
	// Search returns SBN procedures whose name, CBHPM codes, or descriptions
	// match the query. Results are deduplicated at the SBN procedure level.
	Search(query string) ([]models.SBNProcedure, error)

	// GetByID returns the full procedure package (SBN metadata + suggested CBHPM codes).
	GetByID(id string) (*models.ProcedureWithCodes, error)

	// SaveCalculation persists a completed valuation and returns the stored record
	// with its generated ID, public_id, and timestamps populated.
	SaveCalculation(calc models.Calculation) (*models.Calculation, error)

	// ListCalculations returns all saved calculations ordered by recency, newest first.
	// Limited to 100 rows; pagination can be added when auth scoping is introduced.
	ListCalculations() ([]models.CalculationSummary, error)

	// GetCalculationByPublicID retrieves a saved calculation by its URL-safe public ID.
	// Returns nil, nil when no record matches.
	GetCalculationByPublicID(publicID string) (*models.Calculation, error)

	// DeleteCalculationByPublicID removes a saved calculation by its public ID.
	// Returns (true, nil) when deleted, (false, nil) when not found.
	DeleteCalculationByPublicID(publicID string) (bool, error)
}
