package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"afere/backend/internal/generated"
	"afere/backend/internal/handlers"
	"afere/backend/internal/repository"
)

// minimalValidRequest returns a SaveCalculationRequest that passes all validation.
func minimalValidRequest() generated.SaveCalculationRequest {
	return generated.SaveCalculationRequest{
		ProcedureName: "Craniectomia descompressiva",
		SelectedCodes: []generated.SelectedCode{
			{CBHPMCode: "3.01.01.11-5", Description: "Craniectomia", Porte: "10A"},
		},
		AuxiliariesCount:   1,
		RequiresAnesthesia: true,
		AccessRouteType:    generated.AccessRouteSame,
		CalculationResult: generated.CalculateResponse{
			LeadSurgeonFee: 1250.00,
			AuxiliariesFee: 750.00,
			FinalTotal:     2000.00,
		},
	}
}

func postCalculation(t *testing.T, repo *repository.FileRepository, body any) *httptest.ResponseRecorder {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, repo)
	req := httptest.NewRequest(http.MethodPost, "/api/calculations", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

func getCalculation(t *testing.T, repo *repository.FileRepository, publicID string) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, repo)
	req := httptest.NewRequest(http.MethodGet, "/api/calculations/"+publicID, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

func TestSaveCalculation_Success(t *testing.T) {
	repo := repository.NewFileRepository()
	w := postCalculation(t, repo, minimalValidRequest())

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp generated.SaveCalculationResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.PublicID == "" {
		t.Error("expected non-empty public_id")
	}
	if resp.CreatedAt.IsZero() {
		t.Error("expected non-zero created_at")
	}
}

func TestSaveCalculation_MissingProcedureName(t *testing.T) {
	repo := repository.NewFileRepository()
	req := minimalValidRequest()
	req.ProcedureName = "   "
	w := postCalculation(t, repo, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestSaveCalculation_EmptySelectedCodes(t *testing.T) {
	repo := repository.NewFileRepository()
	req := minimalValidRequest()
	req.SelectedCodes = nil
	w := postCalculation(t, repo, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestSaveCalculation_InvalidAuxiliariesCount(t *testing.T) {
	repo := repository.NewFileRepository()
	req := minimalValidRequest()
	req.AuxiliariesCount = 5
	w := postCalculation(t, repo, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for auxiliaries_count=5, got %d", w.Code)
	}
}

func TestSaveCalculation_InvalidAccessRoute(t *testing.T) {
	repo := repository.NewFileRepository()
	req := minimalValidRequest()
	req.AccessRouteType = "unknown"
	w := postCalculation(t, repo, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestSaveCalculation_IncompleteResult(t *testing.T) {
	repo := repository.NewFileRepository()
	req := minimalValidRequest()
	req.CalculationResult.LeadSurgeonFee = 0
	w := postCalculation(t, repo, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when lead_surgeon_fee == 0, got %d", w.Code)
	}
}

func TestCalculations_MethodNotAllowed(t *testing.T) {
	repo := repository.NewFileRepository()
	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, repo)
	req := httptest.NewRequest(http.MethodDelete, "/api/calculations", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func listCalculations(t *testing.T, repo *repository.FileRepository) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, repo)
	req := httptest.NewRequest(http.MethodGet, "/api/calculations", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

func TestListCalculations_Empty(t *testing.T) {
	repo := repository.NewFileRepository()
	w := listCalculations(t, repo)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var result []generated.CalculationSummary
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected empty list, got %d items", len(result))
	}
}

func TestListCalculations_AfterSave(t *testing.T) {
	repo := repository.NewFileRepository()

	postCalculation(t, repo, minimalValidRequest())

	req2 := minimalValidRequest()
	req2.ProcedureName = "Cranioplastia"
	req2.CalculationResult.LeadSurgeonFee = 2500.00
	req2.CalculationResult.FinalTotal = 3000.00
	postCalculation(t, repo, req2)

	w := listCalculations(t, repo)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var result []generated.CalculationSummary
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(result) != 2 {
		t.Errorf("expected 2 items, got %d", len(result))
	}
	for _, s := range result {
		if s.PublicID == "" {
			t.Error("expected non-empty public_id")
		}
		if s.TeamTotalValue <= 0 {
			t.Errorf("expected positive team_total_value, got %f", s.TeamTotalValue)
		}
		if s.CreatedAt.IsZero() {
			t.Error("expected non-zero created_at")
		}
	}
}

func TestGetCalculation_Success(t *testing.T) {
	repo := repository.NewFileRepository()

	// Save first
	pw := postCalculation(t, repo, minimalValidRequest())
	if pw.Code != http.StatusCreated {
		t.Fatalf("save failed: %d %s", pw.Code, pw.Body.String())
	}
	var saveResp generated.SaveCalculationResponse
	if err := json.NewDecoder(pw.Body).Decode(&saveResp); err != nil {
		t.Fatalf("decode save response: %v", err)
	}

	// Retrieve by public_id
	gw := getCalculation(t, repo, saveResp.PublicID)
	if gw.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", gw.Code, gw.Body.String())
	}

	var calc generated.SavedCalculation
	if err := json.NewDecoder(gw.Body).Decode(&calc); err != nil {
		t.Fatalf("decode get response: %v", err)
	}
	if calc.PublicID != saveResp.PublicID {
		t.Errorf("public_id mismatch: got %q, want %q", calc.PublicID, saveResp.PublicID)
	}
	if calc.ProcedureName != "Craniectomia descompressiva" {
		t.Errorf("unexpected procedure_name: %q", calc.ProcedureName)
	}
}

func TestGetCalculation_NotFound(t *testing.T) {
	repo := repository.NewFileRepository()
	w := getCalculation(t, repo, "00000000-0000-0000-0000-000000000000")
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func deleteCalculation(t *testing.T, repo *repository.FileRepository, publicID string) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, repo)
	req := httptest.NewRequest(http.MethodDelete, "/api/calculations/"+publicID, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

func TestDeleteCalculation_Success(t *testing.T) {
	repo := repository.NewFileRepository()

	pw := postCalculation(t, repo, minimalValidRequest())
	if pw.Code != http.StatusCreated {
		t.Fatalf("save failed: %d %s", pw.Code, pw.Body.String())
	}
	var saveResp generated.SaveCalculationResponse
	if err := json.NewDecoder(pw.Body).Decode(&saveResp); err != nil {
		t.Fatalf("decode save response: %v", err)
	}

	dw := deleteCalculation(t, repo, saveResp.PublicID)
	if dw.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", dw.Code, dw.Body.String())
	}

	// Confirm it's gone
	gw := getCalculation(t, repo, saveResp.PublicID)
	if gw.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", gw.Code)
	}
}

func TestDeleteCalculation_NotFound(t *testing.T) {
	repo := repository.NewFileRepository()
	dw := deleteCalculation(t, repo, "00000000-0000-0000-0000-000000000000")
	if dw.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", dw.Code)
	}
}

func TestDeleteCalculation_MethodNotAllowed(t *testing.T) {
	repo := repository.NewFileRepository()

	// Save so there is something to target
	pw := postCalculation(t, repo, minimalValidRequest())
	var saveResp generated.SaveCalculationResponse
	_ = json.NewDecoder(pw.Body).Decode(&saveResp)

	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, repo)
	req := httptest.NewRequest(http.MethodPatch, "/api/calculations/"+saveResp.PublicID, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func TestCalculationPersistenceRoundtrip(t *testing.T) {
	repo := repository.NewFileRepository()
	original := minimalValidRequest()
	original.AuxiliariesCount = 2
	original.RequiresAnesthesia = true
	original.AccessRouteType = generated.AccessRouteDifferent
	original.CalculationResult = generated.CalculateResponse{
		LeadSurgeonFee:      2500.00,
		AuxiliariesFee:      1000.00,
		AnesthesiologistFee: 500.00,
		FinalTotal:          4000.00,
	}

	pw := postCalculation(t, repo, original)
	if pw.Code != http.StatusCreated {
		t.Fatalf("save failed: %d %s", pw.Code, pw.Body.String())
	}
	var saveResp generated.SaveCalculationResponse
	_ = json.NewDecoder(pw.Body).Decode(&saveResp)

	gw := getCalculation(t, repo, saveResp.PublicID)
	if gw.Code != http.StatusOK {
		t.Fatalf("get failed: %d", gw.Code)
	}
	var calc generated.SavedCalculation
	_ = json.NewDecoder(gw.Body).Decode(&calc)

	if calc.AuxiliariesCount != 2 {
		t.Errorf("auxiliaries_count: got %d, want 2", calc.AuxiliariesCount)
	}
	if !calc.RequiresAnesthesia {
		t.Error("expected requires_anesthesia=true")
	}
	if calc.AccessRouteType != generated.AccessRouteDifferent {
		t.Errorf("access_route_type: got %q, want %q", calc.AccessRouteType, generated.AccessRouteDifferent)
	}
	if calc.SurgeonValue != 2500.00 {
		t.Errorf("surgeon_value: got %f, want 2500", calc.SurgeonValue)
	}
	if calc.TeamTotalValue != 4000.00 {
		t.Errorf("team_total_value: got %f, want 4000", calc.TeamTotalValue)
	}
	if len(calc.CalculationBreakdown) == 0 {
		t.Error("expected non-empty calculation_breakdown")
	}
}
