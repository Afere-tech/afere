package handlers

import (
	"net/http"
	"strings"

	"afere/backend/internal/generated"
	"afere/backend/internal/repository"
)

// makeGetProcedureHandler handles GET /api/procedures/{id}.
func makeGetProcedureHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Path: /api/procedures/{id} — extract last segment.
		id := strings.TrimPrefix(r.URL.Path, "/api/procedures/")
		if id == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		p, err := repo.GetByID(id)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if p == nil {
			http.Error(w, "procedure not found", http.StatusNotFound)
			return
		}

		codes := make([]generated.CBHPMCodeEntry, 0, len(p.Codes))
		for _, c := range p.Codes {
			codes = append(codes, generated.CBHPMCodeEntry{
				Code:           c.Code,
				Description:    c.Description,
				Porte:          c.Porte,
				NumAuxiliaries: c.NumAuxiliaries,
			})
		}

		respondJSON(w, http.StatusOK, generated.ProcedureDetail{
			ID:         p.ID,
			Name:       p.Name,
			CBHPMCodes: codes,
		})
	}
}
