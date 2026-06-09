// Package config loads and validates runtime configuration from environment variables.
package config

import "os"

// Config holds all environment-driven configuration for the API server.
type Config struct {
	// DatabaseURL is the Neon/PostgreSQL connection string (e.g. postgres://…).
	// When empty, the server falls back to the embedded file-based catalog.
	DatabaseURL string

	// Port is the TCP port the HTTP server listens on.
	Port string
}

// Load reads configuration from environment variables.
// It first loads a .env file from the working directory (if present),
// so that real environment variables always take precedence over file values.
func Load() Config {
	loadDotEnv()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Port:        port,
	}
}
