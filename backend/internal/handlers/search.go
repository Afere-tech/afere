package handlers

import (
	"net/http"

	"afere/backend/internal/generated"
	"afere/backend/internal/repository"
)

func makeSearchHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		q := r.URL.Query().Get("q")
		if len(q) < 2 {
			http.Error(w, "query must be at least 2 characters", http.StatusBadRequest)
			return
		}

		procedures, err := repo.Search(q)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		results := make([]generated.SBNProcedureResult, 0, len(procedures))
		for _, p := range procedures {
			results = append(results, generated.SBNProcedureResult{
				ID:   p.ID,
				Name: p.Name,
			})
		}

		respondJSON(w, http.StatusOK, results)
	}
}
