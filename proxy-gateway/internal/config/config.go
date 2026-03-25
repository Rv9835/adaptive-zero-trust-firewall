package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds the entire application configuration.
type Config struct {
	Server   ServerConfig
	Proxy    ProxyConfig
	RateLimit RateLimitConfig
	Services ServicesConfig
}

// ServerConfig holds HTTP server settings.
type ServerConfig struct {
	Port            int
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration
}

// ProxyConfig holds reverse proxy target settings.
type ProxyConfig struct {
	Targets map[string]string // path prefix -> upstream URL
}

// RateLimitConfig holds rate limiting settings.
type RateLimitConfig struct {
	RequestsPerSecond float64
	BurstSize         int
	CleanupInterval   time.Duration
}

// ServicesConfig holds URLs for downstream microservices.
type ServicesConfig struct {
	AuthServiceURL   string
	MLEngineURL      string
	PolicyEngineURL  string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Port:            getEnvInt("SERVER_PORT", 8080),
			ReadTimeout:     getEnvDuration("SERVER_READ_TIMEOUT", 15*time.Second),
			WriteTimeout:    getEnvDuration("SERVER_WRITE_TIMEOUT", 15*time.Second),
			IdleTimeout:     getEnvDuration("SERVER_IDLE_TIMEOUT", 60*time.Second),
			ShutdownTimeout: getEnvDuration("SERVER_SHUTDOWN_TIMEOUT", 10*time.Second),
		},
		Proxy: ProxyConfig{
			Targets: parseProxyTargets(getEnv("PROXY_TARGETS", "/=http://localhost:9090")),
		},
		RateLimit: RateLimitConfig{
			RequestsPerSecond: getEnvFloat("RATE_LIMIT_RPS", 100),
			BurstSize:         getEnvInt("RATE_LIMIT_BURST", 200),
			CleanupInterval:   getEnvDuration("RATE_LIMIT_CLEANUP_INTERVAL", 5*time.Minute),
		},
		Services: ServicesConfig{
			AuthServiceURL:  getEnv("AUTH_SERVICE_URL", "http://localhost:8081"),
			MLEngineURL:     getEnv("ML_ENGINE_URL", "http://localhost:8082"),
			PolicyEngineURL: getEnv("POLICY_ENGINE_URL", "http://localhost:8181"),
		},
	}

	if len(cfg.Proxy.Targets) == 0 {
		return nil, fmt.Errorf("no proxy targets configured")
	}

	return cfg, nil
}

// Addr returns the server listen address.
func (c *ServerConfig) Addr() string {
	return fmt.Sprintf(":%d", c.Port)
}

// --- Helper functions ---

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return i
}

func getEnvFloat(key string, fallback float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return fallback
	}
	return f
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}

// parseProxyTargets parses a comma-separated list of path=url mappings.
// Example: "/api=http://api:8080,/web=http://web:3000"
func parseProxyTargets(s string) map[string]string {
	targets := make(map[string]string)
	if s == "" {
		return targets
	}
	pairs := strings.Split(s, ",")
	for _, pair := range pairs {
		parts := strings.SplitN(strings.TrimSpace(pair), "=", 2)
		if len(parts) == 2 {
			path := strings.TrimSpace(parts[0])
			url := strings.TrimSpace(parts[1])
			if path != "" && url != "" {
				targets[path] = url
			}
		}
	}
	return targets
}
