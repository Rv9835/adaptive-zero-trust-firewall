package middleware

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// Auth provides a placeholder authentication middleware for Phase 1.
// In Phase 2+, this will validate JWTs and query the Auth Service.
// For now, it extracts basic identity info from headers for logging/context.
type Auth struct {
	// AuthServiceURL is the URL of the auth service (used in Phase 2+).
	AuthServiceURL string
	// Enabled controls whether auth enforcement is active.
	Enabled bool
}

// NewAuth creates a new Auth middleware.
func NewAuth(authServiceURL string, enabled bool) *Auth {
	return &Auth{
		AuthServiceURL: authServiceURL,
		Enabled:        enabled,
	}
}

// Middleware returns the HTTP middleware function.
func (a *Auth) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip auth for health endpoint
			if r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			// In Phase 1, auth is not enforced — just extract and log token presence.
			// In Phase 2+, this will validate the JWT with the Auth Service.
			if !a.Enabled {
				next.ServeHTTP(w, r)
				return
			}

			// Extract Bearer token
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				sendAuthError(w, "missing_token", "Authorization header is required")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				sendAuthError(w, "invalid_format", "Authorization header must be: Bearer <token>")
				return
			}

			token := parts[1]
			if token == "" {
				sendAuthError(w, "empty_token", "Bearer token cannot be empty")
				return
			}

			// Phase 1: Log token presence (no validation yet)
			log.Debug().
				Str("path", r.URL.Path).
				Bool("has_token", true).
				Msg("auth check passed (Phase 1: no validation)")

			// TODO Phase 2: Validate JWT with auth-service
			// TODO Phase 5: Extract context → call ML engine → call OPA → enforce decision

			next.ServeHTTP(w, r)
		})
	}
}

func sendAuthError(w http.ResponseWriter, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":     code,
		"message":   message,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
