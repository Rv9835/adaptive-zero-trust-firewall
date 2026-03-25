package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"

	"github.com/adaptive-ztna/auth-service/internal/middleware"
)

// TokenHandler handles token refresh.
type TokenHandler struct{}

func NewTokenHandler() *TokenHandler {
	return &TokenHandler{}
}

// Refresh handles POST /api/auth/token/refresh
func (h *TokenHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid_request", "message": "refresh_token is required",
		})
		return
	}

	// Parse and validate the refresh token
	claims := &jwt.RegisteredClaims{}
	token, err := jwt.ParseWithClaims(req.RefreshToken, claims, func(token *jwt.Token) (interface{}, error) {
		return middleware.JWTSecret, nil
	})
	if err != nil || !token.Valid {
		log.Warn().Err(err).Msg("invalid refresh token")
		sendJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "invalid_token", "message": "Refresh token is invalid or expired",
		})
		return
	}

	// Issue new access token
	// NOTE: In production, also check if refresh token has been revoked in Redis/DB
	userID := claims.Subject
	accessToken, err := middleware.GenerateAccessToken(userID, "", "", true)
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "token_error", "message": "Failed to generate new token",
		})
		return
	}

	log.Info().
		Str("user_id", userID).
		Msg("token refreshed")

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"access_token": accessToken,
		"token_type":   "Bearer",
		"expires_in":   900,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	})
}
