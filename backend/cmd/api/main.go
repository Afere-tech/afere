package main

import (
	"log"
	"net/http"
	"os"

	"procedureprice/backend/internal/handlers"
)

func main() {
	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux)

	addr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	}

	log.Printf("procedureprice api listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
