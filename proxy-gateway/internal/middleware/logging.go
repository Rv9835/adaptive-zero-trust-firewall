package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// responseWriter wraps http.ResponseWriter to capture the status code.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    int64
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.written += int64(n)
	return n, err
}

// Logging returns middleware that produces structured JSON logs for every request.
func Logging() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Generate a unique request ID
			requestID := r.Header.Get("X-Request-ID")
			if requestID == "" {
				requestID = generateRequestID()
			}

			// Inject request ID into response headers
			w.Header().Set("X-Request-ID", requestID)

			// Wrap the response writer to capture status code
			wrapped := newResponseWriter(w)

			// Process the request
			next.ServeHTTP(wrapped, r)

			// Calculate duration
			duration := time.Since(start)

			// Determine log level based on status code
			var event *zerolog.Event
			switch {
			case wrapped.statusCode >= 500:
				event = log.Error()
			case wrapped.statusCode >= 400:
				event = log.Warn()
			default:
				event = log.Info()
			}

			// Emit structured log
			event.
				Str("request_id", requestID).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("query", r.URL.RawQuery).
				Str("remote_addr", r.RemoteAddr).
				Str("user_agent", r.UserAgent()).
				Int("status", wrapped.statusCode).
				Int64("response_bytes", wrapped.written).
				Dur("latency_ms", duration).
				Str("protocol", r.Proto).
				Msg("request completed")
		})
	}
}

// generateRequestID creates a simple time-based request ID.
func generateRequestID() string {
	return fmt.Sprintf("ztf-%d", time.Now().UnixNano())
}
