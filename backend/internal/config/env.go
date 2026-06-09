package config

import (
	"bufio"
	"os"
	"strings"
)

// loadDotEnv reads a .env file from the working directory and injects any
// key that is not already present in the process environment.
// A missing .env file is silently ignored — in production, real env vars are used.
// Lines starting with # and blank lines are skipped.
// Values wrapped in single or double quotes are unquoted.
func loadDotEnv() {
	f, err := os.Open(".env")
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		val = strings.Trim(val, `"'`)
		if key != "" && os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}
