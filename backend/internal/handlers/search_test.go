package handlers

import "testing"

func TestProcedureCatalogIsGenerated(t *testing.T) {
	if len(procedures) < 700 {
		t.Fatalf("expected full generated procedure catalog, got %d entries", len(procedures))
	}
}

func TestNormalizeSearchIsAccentInsensitive(t *testing.T) {
	tests := map[string]string{
		"crânio":         "cranio",
		"PUNÇÃO":         "puncao",
		"Neurólise":      "neurolise",
		"cirúrgico":      "cirurgico",
		"derivação":      "derivacao",
		"pós-operatório": "pos-operatorio",
	}

	for input, want := range tests {
		if got := normalizeSearch(input); got != want {
			t.Fatalf("normalizeSearch(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestCatalogContainsAccentedProcedureNames(t *testing.T) {
	var foundCranio bool
	var foundPuncao bool

	for _, procedure := range procedures {
		switch procedure.ProcedureName {
		case "CONSULTA GERAL - CRÂNIO":
			foundCranio = true
		case "CONSULTA + PUNÇÃO LOMBAR":
			foundPuncao = true
		}
	}

	if !foundCranio {
		t.Fatal("expected catalog to contain accented CRÂNIO procedure")
	}
	if !foundPuncao {
		t.Fatal("expected catalog to contain accented PUNÇÃO procedure")
	}
}
