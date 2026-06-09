// Package service contains the deterministic valuation engine for Afere.
package service

import "afere/backend/internal/models"

// anesthesiaFee is the fixed anesthesiologist fee in BRL, per the CBHPM table.
const anesthesiaFee = 1200.00

// PorteValues maps each porte code to its monetary value in BRL (CBHPM 2025/2026).
var PorteValues = map[string]float64{
	"1A":  26.74,
	"1B":  53.48,
	"1C":  80.24,
	"2A":  107.00,
	"2B":  141.05,
	"2C":  166.92,
	"3A":  228.07,
	"3B":  291.50,
	"3C":  333.81,
	"4A":  397.28,
	"4B":  434.89,
	"4C":  491.33,
	"5A":  528.93,
	"5B":  571.23,
	"5C":  606.50,
	"6A":  660.57,
	"6B":  726.40,
	"6C":  794.57,
	"7A":  858.03,
	"7B":  949.71,
	"7C":  1123.65,
	"8A":  1212.99,
	"8B":  1271.77,
	"8C":  1349.35,
	"9A":  1433.97,
	"9B":  1567.97,
	"9C":  1727.81,
	"10A": 1854.75,
	"10B": 2009.91,
	"10C": 2230.89,
	"11A": 2360.17,
	"11B": 2588.21,
	"11C": 2839.74,
	"12A": 2943.18,
	"12B": 3164.15,
	"12C": 3876.43,
	"13A": 4266.66,
	"13B": 4680.39,
	"13C": 5176.41,
	"14A": 5768.81,
	"14B": 6276.59,
	"14C": 6922.36,
}

// Calculate applies the CBHPM billing rules to a physician-assembled composition.
//
// Rules:
//   - Lead surgeon fee = 100% of total base (sum of all selected code porte values).
//   - 1st auxiliary = 30% of total base.
//   - 2nd–4th auxiliary = 20% of total base each.
//   - Anesthesiologist = fixed fee when required.
func Calculate(
	codes []models.SelectedCode,
	auxiliariesCount int,
	requiresAnesthesia bool,
) models.CalculationResult {
	breakdown := make([]models.CodeBreakdown, 0, len(codes))
	totalBase := 0.0

	for _, c := range codes {
		val := PorteValues[c.Porte]
		breakdown = append(breakdown, models.CodeBreakdown{
			CBHPMCode:   c.CBHPMCode,
			Description: c.Description,
			Porte:       c.Porte,
			BaseValue:   val,
		})
		totalBase += val
	}

	auxFee := auxiliaryFee(totalBase, auxiliariesCount)
	anesth := 0.0
	if requiresAnesthesia {
		anesth = anesthesiaFee
	}

	return models.CalculationResult{
		CodeBreakdown:       breakdown,
		TotalBase:           totalBase,
		LeadSurgeonFee:      totalBase,
		AuxiliariesFee:      auxFee,
		AnesthesiologistFee: anesth,
		FinalTotal:          totalBase + auxFee + anesth,
	}
}

// auxiliaryFee computes the combined fee for all auxiliary surgeons.
// First auxiliary receives 30%; each additional receives 20%, all applied to base.
func auxiliaryFee(base float64, count int) float64 {
	if count <= 0 {
		return 0
	}
	total := base * 0.30
	for i := 2; i <= count; i++ {
		total += base * 0.20
	}
	return total
}
