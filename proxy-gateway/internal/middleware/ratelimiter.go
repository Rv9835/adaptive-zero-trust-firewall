package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/rs/zerolog/log"
)

// IPRateLimiter manages per-IP token bucket rate limiters.
type IPRateLimiter struct {
	mu       sync.RWMutex
	limiters map[string]*visitorLimiter
	rate     rate.Limit
	burst    int
	cleanup  time.Duration
}

type visitorLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// NewIPRateLimiter creates a new per-IP rate limiter.
func NewIPRateLimiter(rps float64, burst int, cleanupInterval time.Duration) *IPRateLimiter {
	rl := &IPRateLimiter{
		limiters: make(map[string]*visitorLimiter),
		rate:     rate.Limit(rps),
		burst:    burst,
		cleanup:  cleanupInterval,
	}

	// Start background cleanup of stale entries
	go rl.cleanupLoop()

	return rl
}

// getLimiter returns the rate limiter for the given IP, creating one if necessary.
func (rl *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.limiters[ip]
	if !exists {
		limiter := rate.NewLimiter(rl.rate, rl.burst)
		rl.limiters[ip] = &visitorLimiter{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}

	v.lastSeen = time.Now()
	return v.limiter
}

// cleanupLoop removes stale limiters periodically.
func (rl *IPRateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.cleanup)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		for ip, v := range rl.limiters {
			if time.Since(v.lastSeen) > rl.cleanup*3 {
				delete(rl.limiters, ip)
			}
		}
		count := len(rl.limiters)
		rl.mu.Unlock()

		log.Debug().
			Int("active_limiters", count).
			Msg("rate limiter cleanup completed")
	}
}

// RateLimit returns middleware that enforces per-IP rate limiting.
func RateLimit(rps float64, burst int, cleanupInterval time.Duration) func(http.Handler) http.Handler {
	limiter := NewIPRateLimiter(rps, burst, cleanupInterval)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract client IP (handle X-Forwarded-For and proxy scenarios)
			ip := extractClientIP(r)

			if !limiter.getLimiter(ip).Allow() {
				log.Warn().
					Str("client_ip", ip).
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Msg("rate limit exceeded")

				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "1")
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error":     "rate_limit_exceeded",
					"message":   "Too many requests. Please slow down.",
					"retry_after": 1,
					"timestamp": time.Now().UTC().Format(time.RFC3339),
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// extractClientIP extracts the real client IP from the request.
func extractClientIP(r *http.Request) string {
	// Check X-Forwarded-For first (from upstream load balancers)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP (the original client)
		if i := net.ParseIP(xff); i != nil {
			return xff
		}
	}

	// Check X-Real-IP
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		if i := net.ParseIP(xri); i != nil {
			return xri
		}
	}

	// Fall back to RemoteAddr
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
