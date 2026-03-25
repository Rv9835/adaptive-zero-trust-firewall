package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User represents a user in the system.
type User struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Username        string             `bson:"username" json:"username"`
	Email           string             `bson:"email" json:"email"`
	PasswordHash    string             `bson:"password_hash" json:"-"`
	Role            string             `bson:"role" json:"role"`
	MFASecret       string             `bson:"mfa_secret" json:"-"`
	MFAEnabled      bool               `bson:"mfa_enabled" json:"mfa_enabled"`
	IsLocked        bool               `bson:"is_locked" json:"is_locked"`
	FailedLogins    int                `bson:"failed_logins" json:"-"`
	LastLoginAt     *time.Time         `bson:"last_login_at,omitempty" json:"last_login_at,omitempty"`
	LastLoginIP     string             `bson:"last_login_ip,omitempty" json:"last_login_ip,omitempty"`
	CreatedAt       time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt       time.Time          `bson:"updated_at" json:"updated_at"`
}

// Device represents a registered device.
type Device struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID          primitive.ObjectID `bson:"user_id" json:"user_id"`
	FingerprintHash string             `bson:"fingerprint_hash" json:"fingerprint_hash"`
	DeviceName      string             `bson:"device_name" json:"device_name"`
	DeviceType      string             `bson:"device_type" json:"device_type"` // "desktop", "mobile", "iot"
	LastKnownIP     string             `bson:"last_known_ip" json:"last_known_ip"`
	IsTrusted       bool               `bson:"is_trusted" json:"is_trusted"`
	LastSeen        time.Time          `bson:"last_seen" json:"last_seen"`
	CreatedAt       time.Time          `bson:"created_at" json:"created_at"`
}

// AccessLog represents a single access decision log entry.
type AccessLog struct {
	ID              primitive.ObjectID     `bson:"_id,omitempty" json:"id"`
	UserID          primitive.ObjectID     `bson:"user_id" json:"user_id"`
	Username        string                 `bson:"username" json:"username"`
	TargetResource  string                 `bson:"target_resource" json:"target_resource"`
	TrustScore      float64                `bson:"trust_score" json:"trust_score"`
	Decision        string                 `bson:"decision" json:"decision"` // "ALLOW", "DENY", "CHALLENGE"
	IPAddress       string                 `bson:"ip_address" json:"ip_address"`
	GeoLocation     string                 `bson:"geo_location,omitempty" json:"geo_location,omitempty"`
	UserAgent       string                 `bson:"user_agent" json:"user_agent"`
	ScoringMode     string                 `bson:"scoring_mode" json:"scoring_mode"` // "normal", "fallback"
	AnomalyReason   string                 `bson:"anomaly_reason,omitempty" json:"anomaly_reason,omitempty"`
	MFAResult       string                 `bson:"mfa_result,omitempty" json:"mfa_result,omitempty"` // "passed", "failed", "timeout", ""
	ContextMetadata map[string]interface{} `bson:"context_metadata,omitempty" json:"context_metadata,omitempty"`
	CreatedAt       time.Time              `bson:"created_at" json:"created_at"`
}

// BaselineProfile holds the behavioral baseline for a user.
type BaselineProfile struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID            primitive.ObjectID `bson:"user_id" json:"user_id"`
	KnownIPs          []string           `bson:"known_ips" json:"known_ips"`
	KnownGeoLocations []string           `bson:"known_geolocations" json:"known_geolocations"`
	TypicalAccessHours []int             `bson:"typical_access_hours" json:"typical_access_hours"` // hours 0-23
	TypicalResources   []string          `bson:"typical_resources" json:"typical_resources"`
	LastUpdated        time.Time         `bson:"last_updated" json:"last_updated"`
}

// LoginRequest is the request payload for login.
type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

// LoginResponse is returned on successful authentication.
type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
	MFARequired  bool   `json:"mfa_required"`
}

// MFAVerifyRequest is the request for MFA verification.
type MFAVerifyRequest struct {
	UserID   string `json:"user_id" validate:"required"`
	TOTPCode string `json:"totp_code" validate:"required"`
}

// MFAVerifyResponse is returned on MFA verification.
type MFAVerifyResponse struct {
	Verified    bool   `json:"verified"`
	AccessToken string `json:"access_token,omitempty"`
	Message     string `json:"message"`
}

// MFAEnrollResponse is returned when enrolling MFA.
type MFAEnrollResponse struct {
	Secret    string `json:"secret"`
	QRCodeURL string `json:"qr_code_url"`
	Message   string `json:"message"`
}

// TokenRefreshRequest is the request for token refresh.
type TokenRefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}
