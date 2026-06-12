package main

import (
	"context"
	"log"
	"net/http"

	"afere/backend/internal/config"
	"afere/backend/internal/handlers"
	"afere/backend/internal/repository"
)

func main() {
	cfg := config.Load()

	var repo repository.Repository

	if cfg.DatabaseURL != "" {
		pgRepo, err := repository.NewPostgresRepository(context.Background(), cfg.DatabaseURL)
		if err != nil {
			log.Printf("postgres: connection failed (%v) — falling back to file catalog", err)
			repo = repository.NewFileRepository()
		} else {
			log.Printf("Afere API: connected to Neon PostgreSQL")
			repo = pgRepo
		}
	} else {
		log.Printf("Afere API: DATABASE_URL not set — using embedded file catalog")
		repo = repository.NewFileRepository()
	}

	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, repo)

	addr := ":" + cfg.Port
	log.Printf("Afere API is listening on %s 🚀", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
