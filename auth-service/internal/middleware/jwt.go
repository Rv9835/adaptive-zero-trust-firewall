package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
)

// JWTSecret is the signing key — in production, load from Vault / env.
var JWTSecret []byte

// TokenClaims holds the custom JWT claims.
type TokenClaims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	MFADone  bool   `json:"mfa_done"`
	jwt.RegisteredClaims
}

type contextKey string

const ClaimsKey contextKey = "claims"

// InitJWT sets the signing secret.
func InitJWT(secret string) {
	JWTSecret = []byte(secret)
}

// GenerateAccessToken creates a new signed JWT for a user.
func GenerateAccessToken(userID, username, role string, mfaDone bool) (string, error) {
	claims := TokenClaims{
		UserID:   userID,
		Username: username,
		Role:     role,
		MFADone:  mfaDone,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "adaptive-ztna-firewall",
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret)
}

// GenerateRefreshToken creates a long-lived refresh token.
func GenerateRefreshToken(userID string) (string, error) {
	claims := jwt.RegisteredClaims{
		Issuer:    "adaptive-ztna-firewall",
		Subject:   userID,
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret)
}

// JWTAuth is middleware that validates JWT tokens in the Authorization header.
func JWTAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			sendError(w, http.StatusUnauthorized, "missing_token", "Authorization header required")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			sendError(w, http.StatusUnauthorized, "invalid_format", "Use: Bearer <token>")
			return
		}

		tokenString := parts[1]
		claims := &TokenClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return JWTSecret, nil
		})

		if err != nil || !token.Valid {
			log.Warn().
				Err(err).
				Str("path", r.URL.Path).
				Msg("invalid JWT token")
			sendError(w, http.StatusUnauthorized, "invalid_token", "Token is invalid or expired")
			return
		}

		// Inject claims into request context
		ctx := context.WithValue(r.Context(), ClaimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetClaims extracts TokenClaims from the request context.
func GetClaims(r *http.Request) *TokenClaims {
	claims, ok := r.Context().Value(ClaimsKey).(*TokenClaims)
	if !ok {
		return nil
	}
	return claims
}

func sendError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":     code,
		"message":   message,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
