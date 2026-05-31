// Package generated contains hand-written placeholders for the OpenAPI models.
// Replace this file with oapi-codegen output when the generator is wired into CI.
package generated

type CalculateRequest struct {
	CBHPMCode          string `json:"cbhpm_code"`
	AuxiliariesCount   int    `json:"auxiliaries_count"`
	RequiresAnesthesia bool   `json:"requires_anesthesia"`
}

type CalculateResponse struct {
	BasePorteValue      float64 `json:"base_porte_value"`
	LeadSurgeonFee      float64 `json:"lead_surgeon_fee"`
	AuxiliariesFee      float64 `json:"auxiliaries_fee"`
	AnesthesiologistFee float64 `json:"anesthesiologist_fee"`
	FinalTotal          float64 `json:"final_total"`
}

type ProcedureSearchResult struct {
	ProcedureName string `json:"procedure_name"`
	CBHPMCode     string `json:"cbhpm_code"`
	Description   string `json:"description"`
	Porte         string `json:"porte"`
}
