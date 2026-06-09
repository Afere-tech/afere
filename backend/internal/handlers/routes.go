package handlers

import (
	"net/http"

	"afere/backend/internal/repository"
)

// RegisterRoutes wires all HTTP routes onto mux, injecting the procedure repository.
func RegisterRoutes(mux *http.ServeMux, repo repository.ProcedureRepository) {
	mux.HandleFunc("/api/health", withCORS(health))
	mux.HandleFunc("/api/procedures/search", withCORS(makeSearchHandler(repo)))
	mux.HandleFunc("/api/procedures/", withCORS(makeGetProcedureHandler(repo)))
	mux.HandleFunc("/api/calculate", withCORS(calculateHandler))
}
