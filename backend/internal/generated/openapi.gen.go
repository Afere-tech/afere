// Package generated contains hand-written types matching openapi.yaml v2.0.0.
// Regenerate with oapi-codegen when the generator is wired into CI.
package generated

// HealthResponse is returned by GET /api/health.
type HealthResponse struct {
	Status string `json:"status"`
}

// SBNProcedureResult is one item in the search results list.
type SBNProcedureResult struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// CBHPMCodeEntry is a single CBHPM code within a procedure package.
type CBHPMCodeEntry struct {
	Code        string `json:"code"`
	Description string `json:"description"`
	Porte       string `json:"porte"`
}

// ProcedureDetail is returned by GET /api/procedures/:id.
type ProcedureDetail struct {
	ID         string           `json:"id"`
	Name       string           `json:"name"`
	CBHPMCodes []CBHPMCodeEntry `json:"cbhpm_codes"`
}

// SelectedCode is one physician-chosen code in a calculate request.
type SelectedCode struct {
	CBHPMCode   string `json:"cbhpm_code"`
	Description string `json:"description"`
	Porte       string `json:"porte"`
}

// CalculateRequest is the body for POST /api/calculate.
type CalculateRequest struct {
	SelectedCodes      []SelectedCode `json:"selected_codes"`
	AuxiliariesCount   int            `json:"auxiliaries_count"`
	RequiresAnesthesia bool           `json:"requires_anesthesia"`
}

// CodeBreakdown is the per-code contribution in the calculation result.
type CodeBreakdown struct {
	CBHPMCode   string  `json:"cbhpm_code"`
	Description string  `json:"description"`
	Porte       string  `json:"porte"`
	BaseValue   float64 `json:"base_value"`
}

// CalculateResponse is returned by POST /api/calculate.
type CalculateResponse struct {
	CodeBreakdown       []CodeBreakdown `json:"code_breakdown"`
	TotalBase           float64         `json:"total_base"`
	LeadSurgeonFee      float64         `json:"lead_surgeon_fee"`
	AuxiliariesFee      float64         `json:"auxiliaries_fee"`
	AnesthesiologistFee float64         `json:"anesthesiologist_fee"`
	FinalTotal          float64         `json:"final_total"`
}
