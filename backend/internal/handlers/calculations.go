package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"afere/backend/internal/generated"
	"afere/backend/internal/models"
	"afere/backend/internal/repository"
)

// makeSaveCalculationHandler returns a POST /api/calculations handler.
// Requires a completed valuation (lead_surgeon_fee > 0) before persisting.
func makeSaveCalculationHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req generated.SaveCalculationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json body", http.StatusBadRequest)
			return
		}

		if strings.TrimSpace(req.ProcedureName) == "" {
			http.Error(w, "procedure_name is required", http.StatusBadRequest)
			return
		}
		if len(req.SelectedCodes) == 0 {
			http.Error(w, "selected_codes must not be empty", http.StatusBadRequest)
			return
		}
		if req.AuxiliariesCount < 0 || req.AuxiliariesCount > 4 {
			http.Error(w, "auxiliaries_count must be between 0 and 4", http.StatusBadRequest)
			return
		}
		if req.AccessRouteType != generated.AccessRouteSame && req.AccessRouteType != generated.AccessRouteDifferent {
			http.Error(w, "access_route_type must be 'same' or 'different'", http.StatusBadRequest)
			return
		}
		if req.CalculationResult.LeadSurgeonFee <= 0 {
			http.Error(w, "calculation_result must contain a completed valuation (lead_surgeon_fee > 0)", http.StatusBadRequest)
			return
		}

		breakdownJSON, err := json.Marshal(req.CalculationResult)
		if err != nil {
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		selectedCodes := make([]models.SelectedCode, 0, len(req.SelectedCodes))
		for _, c := range req.SelectedCodes {
			selectedCodes = append(selectedCodes, models.SelectedCode{
				CBHPMCode:   c.CBHPMCode,
				Description: c.Description,
				Porte:       c.Porte,
			})
		}

		calc := models.Calculation{
			ProcedureName:         req.ProcedureName,
			ProcedureSBNCode:      req.ProcedureSBNCode,
			SelectedCBHPMCodes:    selectedCodes,
			AccessRoute:           models.AccessRouteType(req.AccessRouteType),
			AuxiliariesCount:      req.AuxiliariesCount,
			RequiresAnesthesia:    req.RequiresAnesthesia,
			SurgeonValue:          req.CalculationResult.LeadSurgeonFee,
			AuxiliariesTotalValue: req.CalculationResult.AuxiliariesFee,
			AnesthesiologistValue: req.CalculationResult.AnesthesiologistFee,
			TeamTotalValue:        req.CalculationResult.FinalTotal,
			BreakdownJSON:         json.RawMessage(breakdownJSON),
		}

		saved, err := repo.SaveCalculation(calc)
		if err != nil {
			log.Printf("save calculation: %v", err)
			http.Error(w, "failed to save calculation", http.StatusInternalServerError)
			return
		}

		respondJSON(w, http.StatusCreated, generated.SaveCalculationResponse{
			PublicID:  saved.PublicID,
			CreatedAt: saved.CreatedAt,
		})
	}
}

// makeListCalculationsHandler returns the GET /api/calculations list handler.
func makeListCalculationsHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		calcs, err := repo.ListCalculations()
		if err != nil {
			log.Printf("list calculations: %v", err)
			http.Error(w, "failed to list calculations", http.StatusInternalServerError)
			return
		}
		summaries := make([]generated.CalculationSummary, 0, len(calcs))
		for _, c := range calcs {
			summaries = append(summaries, generated.CalculationSummary{
				PublicID:              c.PublicID,
				ProcedureName:         c.ProcedureName,
				ProcedureSBNCode:      c.ProcedureSBNCode,
				SurgeonValue:          c.SurgeonValue,
				AuxiliariesTotalValue: c.AuxiliariesTotalValue,
				AnesthesiologistValue: c.AnesthesiologistValue,
				TeamTotalValue:        c.TeamTotalValue,
				AuxiliariesCount:      c.AuxiliariesCount,
				RequiresAnesthesia:    c.RequiresAnesthesia,
				AccessRouteType:       generated.AccessRouteType(c.AccessRoute),
				CreatedAt:             c.CreatedAt,
			})
		}
		respondJSON(w, http.StatusOK, summaries)
	}
}

// makeCalculationsCollectionHandler dispatches GET → list, POST → save on /api/calculations.
func makeCalculationsCollectionHandler(repo repository.Repository) http.HandlerFunc {
	save := makeSaveCalculationHandler(repo)
	list := makeListCalculationsHandler(repo)
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			save(w, r)
		case http.MethodGet:
			list(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

// makeDeleteCalculationHandler returns a DELETE /api/calculations/{id} handler.
func makeDeleteCalculationHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		publicID := strings.TrimPrefix(r.URL.Path, "/api/calculations/")
		if strings.TrimSpace(publicID) == "" {
			http.Error(w, "missing calculation id", http.StatusBadRequest)
			return
		}

		deleted, err := repo.DeleteCalculationByPublicID(publicID)
		if err != nil {
			log.Printf("delete calculation %q: %v", publicID, err)
			http.Error(w, "failed to delete calculation", http.StatusInternalServerError)
			return
		}
		if !deleted {
			http.Error(w, "calculation not found", http.StatusNotFound)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// makeGetCalculationHandler returns a GET /api/calculations/{id} handler.
func makeGetCalculationHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		publicID := strings.TrimPrefix(r.URL.Path, "/api/calculations/")
		if strings.TrimSpace(publicID) == "" {
			http.Error(w, "missing calculation id", http.StatusBadRequest)
			return
		}

		calc, err := repo.GetCalculationByPublicID(publicID)
		if err != nil {
			log.Printf("get calculation %q: %v", publicID, err)
			http.Error(w, "failed to retrieve calculation", http.StatusInternalServerError)
			return
		}
		if calc == nil {
			http.Error(w, "calculation not found", http.StatusNotFound)
			return
		}

		selectedCodes := make([]generated.SelectedCode, 0, len(calc.SelectedCBHPMCodes))
		for _, c := range calc.SelectedCBHPMCodes {
			selectedCodes = append(selectedCodes, generated.SelectedCode{
				CBHPMCode:   c.CBHPMCode,
				Description: c.Description,
				Porte:       c.Porte,
			})
		}

		respondJSON(w, http.StatusOK, generated.SavedCalculation{
			PublicID:              calc.PublicID,
			ProcedureName:         calc.ProcedureName,
			ProcedureSBNCode:      calc.ProcedureSBNCode,
			SelectedCBHPMCodes:    selectedCodes,
			AccessRouteType:       generated.AccessRouteType(calc.AccessRoute),
			AuxiliariesCount:      calc.AuxiliariesCount,
			RequiresAnesthesia:    calc.RequiresAnesthesia,
			SurgeonValue:          calc.SurgeonValue,
			AuxiliariesTotalValue: calc.AuxiliariesTotalValue,
			AnesthesiologistValue: calc.AnesthesiologistValue,
			TeamTotalValue:        calc.TeamTotalValue,
			CalculationBreakdown:  calc.BreakdownJSON,
			CreatedAt:             calc.CreatedAt,
		})
	}
}

// makeCalculationItemHandler dispatches GET → get and DELETE → delete on /api/calculations/{id}.
func makeCalculationItemHandler(repo repository.Repository) http.HandlerFunc {
	get := makeGetCalculationHandler(repo)
	del := makeDeleteCalculationHandler(repo)
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			get(w, r)
		case http.MethodDelete:
			del(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}
