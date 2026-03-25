package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/pquerna/otp/totp"
	"github.com/rs/zerolog/log"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/adaptive-ztna/auth-service/internal/middleware"
	"github.com/adaptive-ztna/auth-service/internal/models"
)

// MFAHandler handles MFA enrollment and verification.
type MFAHandler struct {
	UsersCol *mongo.Collection
}

func NewMFAHandler(usersCol *mongo.Collection) *MFAHandler {
	return &MFAHandler{UsersCol: usersCol}
}

// Enroll handles POST /api/auth/mfa/enroll — generates a TOTP secret.
func (h *MFAHandler) Enroll(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	if claims == nil {
		sendJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "unauthorized", "message": "Valid token required",
		})
		return
	}

	// Generate TOTP key
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "AdaptiveZTNA",
		AccountName: claims.Username,
	})
	if err != nil {
		log.Error().Err(err).Msg("failed to generate TOTP secret")
		sendJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "mfa_error", "message": "Failed to generate MFA secret",
		})
		return
	}

	// Store secret in database
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	userID, _ := primitive.ObjectIDFromHex(claims.UserID)
	_, err = h.UsersCol.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
		"$set": bson.M{
			"mfa_secret":  key.Secret(),
			"mfa_enabled": true,
			"updated_at":  time.Now(),
		},
	})
	if err != nil {
		log.Error().Err(err).Msg("failed to store MFA secret")
		sendJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "db_error", "message": "Failed to save MFA configuration",
		})
		return
	}

	log.Info().
		Str("username", claims.Username).
		Msg("MFA enrolled successfully")

	sendJSON(w, http.StatusOK, models.MFAEnrollResponse{
		Secret:    key.Secret(),
		QRCodeURL: key.URL(),
		Message:   "Scan the QR code with your authenticator app",
	})
}

// Verify handles POST /api/auth/mfa/verify — validates a TOTP code.
func (h *MFAHandler) Verify(w http.ResponseWriter, r *http.Request) {
	var req models.MFAVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid_request", "message": "Invalid JSON payload",
		})
		return
	}

	if req.UserID == "" || req.TOTPCode == "" {
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error": "missing_fields", "message": "user_id and totp_code are required",
		})
		return
	}

	// Find user
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	userID, err := primitive.ObjectIDFromHex(req.UserID)
	if err != nil {
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid_user_id", "message": "Invalid user ID format",
		})
		return
	}

	var user models.User
	err = h.UsersCol.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		sendJSON(w, http.StatusNotFound, map[string]string{
			"error": "user_not_found", "message": "User not found",
		})
		return
	}

	if user.MFASecret == "" {
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error": "mfa_not_enrolled", "message": "MFA is not enrolled for this user",
		})
		return
	}

	// Validate TOTP code
	valid := totp.Validate(req.TOTPCode, user.MFASecret)
	if !valid {
		log.Warn().
			Str("username", user.Username).
			Msg("MFA verification failed — invalid code")

		sendJSON(w, http.StatusUnauthorized, models.MFAVerifyResponse{
			Verified: false,
			Message:  "Invalid or expired TOTP code",
		})
		return
	}

	// MFA passed — issue a full token with mfa_done=true
	accessToken, err := middleware.GenerateAccessToken(
		user.ID.Hex(), user.Username, user.Role, true,
	)
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "token_error", "message": "Failed to generate token",
		})
		return
	}

	log.Info().
		Str("username", user.Username).
		Msg("MFA verification successful")

	// TODO Phase 5: Call ML Engine /api/ml/feedback to mark this as a verified session

	sendJSON(w, http.StatusOK, models.MFAVerifyResponse{
		Verified:    true,
		AccessToken: accessToken,
		Message:     "MFA verification successful",
	})
}
