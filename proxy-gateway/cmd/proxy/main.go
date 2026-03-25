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

	"github.com/adaptive-ztna/proxy-gateway/internal/config"
	"github.com/adaptive-ztna/proxy-gateway/internal/health"
	"github.com/adaptive-ztna/proxy-gateway/internal/middleware"
	"github.com/adaptive-ztna/proxy-gateway/internal/proxy"
)

func main() {
	// ── Configure Zerolog ───────────────────────────────────────────────
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	logLevel := os.Getenv("LOG_LEVEL")
	switch logLevel {
	case "debug":
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	case "warn":
		zerolog.SetGlobalLevel(zerolog.WarnLevel)
	case "error":
		zerolog.SetGlobalLevel(zerolog.ErrorLevel)
	default:
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}

	// Pretty print for development, JSON for production
	if os.Getenv("ENV") != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339})
	}

	log.Info().Msg("========================================")
	log.Info().Msg("  Adaptive Zero Trust Firewall v1.0.0")
	log.Info().Msg("  PS001 — Proxy Gateway")
	log.Info().Msg("========================================")

	// ── Load Configuration ─────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load configuration")
	}

	log.Info().
		Int("port", cfg.Server.Port).
		Float64("rate_limit_rps", cfg.RateLimit.RequestsPerSecond).
		Int("rate_limit_burst", cfg.RateLimit.BurstSize).
		Msg("configuration loaded")

	// ── Initialize Reverse Proxy ───────────────────────────────────────
	reverseProxy, err := proxy.New(cfg.Proxy.Targets)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to initialize reverse proxy")
	}

	// ── Initialize Auth Middleware ─────────────────────────────────────
	authEnabled := os.Getenv("AUTH_ENABLED") == "true"
	authMiddleware := middleware.NewAuth(cfg.Services.AuthServiceURL, authEnabled)

	// ── Build Router ───────────────────────────────────────────────────
	r := chi.NewRouter()

	// Global middleware stack (order matters)
	r.Use(middleware.CORS)         // CORS for dashboard
	r.Use(chiMiddleware.RealIP)    // Extract real IP from X-Forwarded-For
	r.Use(chiMiddleware.Recoverer) // Recover from panics gracefully
	r.Use(middleware.Logging())    // Structured request logging
	r.Use(middleware.RateLimit(    // Per-IP rate limiting
		cfg.RateLimit.RequestsPerSecond,
		cfg.RateLimit.BurstSize,
		cfg.RateLimit.CleanupInterval,
	))
	r.Use(authMiddleware.Middleware()) // Auth check (Phase 1: disabled by default)

	// ── Routes ─────────────────────────────────────────────────────────
	// Health check (bypasses proxy)
	r.Get("/health", health.Handler())

	// Proxy all other routes to upstream backends
	r.Handle("/*", reverseProxy.Handler())

	// ── Create HTTP Server ─────────────────────────────────────────────
	srv := &http.Server{
		Addr:         cfg.Server.Addr(),
		Handler:      r,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// ── Graceful Shutdown ──────────────────────────────────────────────
	// Start server in a goroutine
	go func() {
		log.Info().
			Str("addr", cfg.Server.Addr()).
			Bool("auth_enabled", authEnabled).
			Msg("proxy gateway started — listening for connections")

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server failed to start")
		}
	}()

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit

	log.Info().
		Str("signal", sig.String()).
		Msg("shutdown signal received — draining connections...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("forced shutdown")
	}

	log.Info().Msg("proxy gateway stopped gracefully")
}
