package handlers

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"

	"github.com/adaptive-ztna/auth-service/internal/middleware"
	"github.com/adaptive-ztna/auth-service/internal/models"
)

// LoginHandler handles POST /api/auth/login
type LoginHandler struct {
	UsersCol *mongo.Collection
}

func NewLoginHandler(usersCol *mongo.Collection) *LoginHandler {
	return &LoginHandler{UsersCol: usersCol}
}

func (h *LoginHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":   "invalid_request",
			"message": "Invalid JSON payload",
		})
		return
	}

	if req.Username == "" || req.Password == "" {
		sendJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":   "missing_fields",
			"message": "Username and password are required",
		})
		return
	}

	// Find user
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var user models.User
	err := h.UsersCol.FindOne(ctx, bson.M{"username": req.Username}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			log.Warn().Str("username", req.Username).Msg("login attempt: user not found")
			sendJSON(w, http.StatusUnauthorized, map[string]interface{}{
				"error":   "invalid_credentials",
				"message": "Invalid username or password",
			})
			return
		}
		log.Error().Err(err).Msg("database error during login")
		sendJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":   "server_error",
			"message": "Internal server error",
		})
		return
	}

	// Check if account is locked
	if user.IsLocked {
		log.Warn().Str("username", req.Username).Msg("login attempt on locked account")
		sendJSON(w, http.StatusForbidden, map[string]interface{}{
			"error":   "account_locked",
			"message": "Account is temporarily locked. Contact administrator.",
		})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		// Increment failed login counter
		h.incrementFailedLogins(ctx, user.ID)

		log.Warn().
			Str("username", req.Username).
			Int("failed_logins", user.FailedLogins+1).
			Msg("login failed: wrong password")

		sendJSON(w, http.StatusUnauthorized, map[string]interface{}{
			"error":   "invalid_credentials",
			"message": "Invalid username or password",
		})
		return
	}

	// Reset failed logins on success
	clientIP := extractIP(r)
	now := time.Now()
	h.UsersCol.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{
			"failed_logins": 0,
			"last_login_at": now,
			"last_login_ip": clientIP,
			"updated_at":    now,
		},
	})

	// If MFA is enabled, issue a partial token (mfa_done=false)
	mfaDone := !user.MFAEnabled
	accessToken, err := middleware.GenerateAccessToken(
		user.ID.Hex(), user.Username, user.Role, mfaDone,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to generate access token")
		sendJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":   "token_error",
			"message": "Failed to generate token",
		})
		return
	}

	refreshToken, err := middleware.GenerateRefreshToken(user.ID.Hex())
	if err != nil {
		log.Error().Err(err).Msg("failed to generate refresh token")
		sendJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":   "token_error",
			"message": "Failed to generate token",
		})
		return
	}

	log.Info().
		Str("username", user.Username).
		Str("ip", clientIP).
		Bool("mfa_required", user.MFAEnabled).
		Msg("login successful")

	sendJSON(w, http.StatusOK, models.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    900, // 15 minutes
		MFARequired:  user.MFAEnabled,
	})
}

func (h *LoginHandler) incrementFailedLogins(ctx context.Context, userID primitive.ObjectID) {
	result, _ := h.UsersCol.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
		"$inc": bson.M{"failed_logins": 1},
		"$set": bson.M{"updated_at": time.Now()},
	})

	// Auto-lock after 5 failed attempts
	if result != nil && result.ModifiedCount > 0 {
		var user models.User
		h.UsersCol.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
		if user.FailedLogins >= 5 {
			h.UsersCol.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
				"$set": bson.M{"is_locked": true},
			})
			log.Warn().
				Str("username", user.Username).
				Msg("account auto-locked after 5 failed attempts")
		}
	}
}

func extractIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
