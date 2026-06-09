// Package models defines the core domain types for the Afere platform.
package models

// SBNProcedure represents a procedure package as defined in the SBN manual.
// One SBN procedure aggregates one or more CBHPM codes.
type SBNProcedure struct {
	ID   string
	Name string
}

// CBHPMCode is a single billable code from the CBHPM catalog,
// annotated with the default porte assigned by the SBN manual for this procedure package.
type CBHPMCode struct {
	Code        string
	Description string
	Porte       string
}

// ProcedureWithCodes is an SBN procedure together with its suggested CBHPM codes.
type ProcedureWithCodes struct {
	SBNProcedure
	Codes []CBHPMCode
}

// SelectedCode is a CBHPM code chosen by the physician, potentially with a
// porte different from the SBN-suggested default.
type SelectedCode struct {
	CBHPMCode   string
	Description string
	Porte       string
}

// CodeBreakdown is the per-code contribution in a valuation result.
type CodeBreakdown struct {
	CBHPMCode   string
	Description string
	Porte       string
	BaseValue   float64
}

// CalculationResult is the full output of the valuation engine.
type CalculationResult struct {
	CodeBreakdown       []CodeBreakdown
	TotalBase           float64
	LeadSurgeonFee      float64
	AuxiliariesFee      float64
	AnesthesiologistFee float64
	FinalTotal          float64
}
