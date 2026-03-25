package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/adaptive-ztna/auth-service/internal/db"
	"github.com/adaptive-ztna/auth-service/internal/handlers"
	"github.com/adaptive-ztna/auth-service/internal/middleware"
)

func main() {
	// ── Logger Setup ───────────────────────────────────────────────────
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	if os.Getenv("ENV") != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339})
	}

	log.Info().Msg("========================================")
	log.Info().Msg("  Adaptive Zero Trust Firewall v1.0.0")
	log.Info().Msg("  PS001 — Auth Service")
	log.Info().Msg("========================================")

	// ── Initialize JWT ─────────────────────────────────────────────────
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-secret-change-in-production-ZTNA2026!"
		log.Warn().Msg("using default JWT secret — set JWT_SECRET in production!")
	}
	middleware.InitJWT(jwtSecret)

	// ── Connect to MongoDB Atlas ───────────────────────────────────────
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
		log.Warn().Msg("MONGODB_URI not set — using local MongoDB")
	}
	dbName := os.Getenv("MONGODB_DATABASE")
	if dbName == "" {
		dbName = "ztna-firewall"
	}

	mongoDB, err := db.Connect(mongoURI, dbName)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to MongoDB")
	}
	defer mongoDB.Disconnect()

	// ── Initialize Handlers ────────────────────────────────────────────
	usersCol := mongoDB.Collection("users")
	loginHandler := handlers.NewLoginHandler(usersCol)
	mfaHandler := handlers.NewMFAHandler(usersCol)
	tokenHandler := handlers.NewTokenHandler()

	// ── Build Router ───────────────────────────────────────────────────
	r := chi.NewRouter()
	r.Use(middleware.CORS)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.Timeout(30 * time.Second))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"auth-service","version":"1.0.0"}`))
	})

	// Public routes (no JWT required)
	r.Post("/api/auth/login", loginHandler.ServeHTTP)
	r.Post("/api/auth/mfa/verify", mfaHandler.Verify)
	r.Post("/api/auth/token/refresh", tokenHandler.Refresh)

	// Protected routes (JWT required)
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth)
		r.Post("/api/auth/mfa/enroll", mfaHandler.Enroll)
	})

	// ── Start Server ───────────────────────────────────────────────────
	port := os.Getenv("AUTH_PORT")
	if port == "" {
		port = "8081"
	}
	addr := ":" + port

	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Str("addr", addr).Msg("auth service started")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("auth service failed")
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down auth service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	log.Info().Msg("auth service stopped")
}
