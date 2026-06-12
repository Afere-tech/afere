package handlers

import (
	"net/http"

	"afere/backend/internal/repository"
)

// RegisterRoutes wires all HTTP routes onto mux, injecting the repository.
func RegisterRoutes(mux *http.ServeMux, repo repository.Repository) {
	mux.HandleFunc("/api/health", withCORS(health))
	mux.HandleFunc("/api/procedures/search", withCORS(makeSearchHandler(repo)))
	mux.HandleFunc("/api/procedures/", withCORS(makeGetProcedureHandler(repo)))
	mux.HandleFunc("/api/calculate", withCORS(calculateHandler))
	mux.HandleFunc("/api/calculations", withCORS(makeCalculationsCollectionHandler(repo)))
	mux.HandleFunc("/api/calculations/", withCORS(makeCalculationItemHandler(repo)))
}
