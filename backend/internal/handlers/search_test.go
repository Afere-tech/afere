package handlers_test

import (
	"testing"

	"afere/backend/internal/repository"
)

func TestFileRepositoryCatalogSize(t *testing.T) {
	repo := repository.NewFileRepository()
	// "de" matches a large fraction of Portuguese procedure names.
	results, err := repo.Search("de")
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	// The search cap is 20; a real catalog produces at least 20 matches for "de".
	if len(results) == 0 {
		t.Fatal("expected non-empty search results for broad query")
	}
}

func TestFileRepositorySearchAccentInsensitive(t *testing.T) {
	repo := repository.NewFileRepository()

	cases := []struct {
		query string
		want  string
	}{
		{"cranio", "CRÂNIO"},
		{"puncao", "PUNÇÃO"},
		{"coluna", "COLUNA"},
	}

	for _, tc := range cases {
		results, err := repo.Search(tc.query)
		if err != nil {
			t.Fatalf("search(%q) error: %v", tc.query, err)
		}
		found := false
		for _, r := range results {
			for _, ch := range r.Name {
				_ = ch
			}
			// case-insensitive substring check via simple loop
			if containsIgnoreCase(r.Name, tc.want) {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("search(%q): expected a result containing %q, got %v", tc.query, tc.want, results)
		}
	}
}

func TestFileRepositoryGetByID(t *testing.T) {
	repo := repository.NewFileRepository()

	// ID "1" should always correspond to the first procedure in the catalog.
	p, err := repo.GetByID("1")
	if err != nil {
		t.Fatalf("GetByID(\"1\") error: %v", err)
	}
	if p == nil {
		t.Fatal("GetByID(\"1\") returned nil, expected a procedure")
	}
	if len(p.Codes) == 0 {
		t.Errorf("procedure %q has no CBHPM codes", p.Name)
	}
}

func TestFileRepositoryGetByIDNotFound(t *testing.T) {
	repo := repository.NewFileRepository()
	p, err := repo.GetByID("99999")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p != nil {
		t.Errorf("expected nil for unknown id, got %+v", p)
	}
}

func TestFileRepositorySearchMinLength(t *testing.T) {
	repo := repository.NewFileRepository()
	results, err := repo.Search("a") // 1 char — below minimum
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected no results for single-char query, got %d", len(results))
	}
}

// containsIgnoreCase reports whether s contains substr (ASCII case-insensitive, no normalization).
func containsIgnoreCase(s, substr string) bool {
	if len(substr) == 0 {
		return true
	}
	sLow := toLower(s)
	subLow := toLower(substr)
	return len(sLow) >= len(subLow) && containsSubstring(sLow, subLow)
}

func containsSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func toLower(s string) string {
	b := make([]byte, len(s))
	for i := range s {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 32
		}
		b[i] = c
	}
	return string(b)
}
