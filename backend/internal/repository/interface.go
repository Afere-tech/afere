// Package repository defines the data-access contract for Afere.
package repository

import "afere/backend/internal/models"

// ProcedureRepository is the single data-access interface for SBN procedures.
// Implementations may be file-based (development/fallback) or PostgreSQL (production).
type ProcedureRepository interface {
	// Search returns SBN procedures whose name, CBHPM codes, or descriptions
	// match the query. Results are deduplicated at the SBN procedure level.
	Search(query string) ([]models.SBNProcedure, error)

	// GetByID returns the full procedure package (SBN metadata + suggested CBHPM codes).
	GetByID(id string) (*models.ProcedureWithCodes, error)
}
