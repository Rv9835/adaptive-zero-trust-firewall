package proxy

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// ReverseProxy manages multiple backend targets keyed by path prefix.
type ReverseProxy struct {
	targets   map[string]*httputil.ReverseProxy
	prefixes  []string // sorted longest-first for matching
}

// New creates a new ReverseProxy from a path→upstream mapping.
func New(targets map[string]string) (*ReverseProxy, error) {
	rp := &ReverseProxy{
		targets: make(map[string]*httputil.ReverseProxy),
	}

	for prefix, upstream := range targets {
		target, err := url.Parse(upstream)
		if err != nil {
			return nil, fmt.Errorf("invalid upstream URL %q for prefix %q: %w", upstream, prefix, err)
		}

		proxy := httputil.NewSingleHostReverseProxy(target)

		// Custom director to rewrite the request
		originalDirector := proxy.Director
		proxy.Director = func(req *http.Request) {
			originalDirector(req)
			req.Host = target.Host

			// Strip the prefix if it's not the root "/"
			if prefix != "/" {
				req.URL.Path = strings.TrimPrefix(req.URL.Path, prefix)
				if req.URL.Path == "" {
					req.URL.Path = "/"
				}
			}

			// Set X-Forwarded headers for downstream services
			if clientIP := req.Header.Get("X-Forwarded-For"); clientIP == "" {
				req.Header.Set("X-Forwarded-For", req.RemoteAddr)
			}
			req.Header.Set("X-Forwarded-Host", req.Host)
			req.Header.Set("X-Forwarded-Proto", "http")
			req.Header.Set("X-ZTF-Proxy", "adaptive-ztna/1.0")
		}

		// Custom error handler for failed upstream connections
		proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
			log.Error().
				Err(err).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("upstream", target.String()).
				Msg("upstream request failed")

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			fmt.Fprintf(w, `{"error":"bad_gateway","message":"upstream service unavailable","timestamp":"%s"}`,
				time.Now().UTC().Format(time.RFC3339))
		}

		// Custom transport with timeouts
		proxy.Transport = &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 25,
			IdleConnTimeout:     90 * time.Second,
			TLSHandshakeTimeout: 10 * time.Second,
			ResponseHeaderTimeout: 30 * time.Second,
		}

		rp.targets[prefix] = proxy
		rp.prefixes = append(rp.prefixes, prefix)

		log.Info().
			Str("prefix", prefix).
			Str("upstream", upstream).
			Msg("registered proxy target")
	}

	// Sort prefixes longest-first for greedy matching
	sort.Slice(rp.prefixes, func(i, j int) bool {
		return len(rp.prefixes[i]) > len(rp.prefixes[j])
	})

	return rp, nil
}

// ServeHTTP routes the request to the appropriate backend based on path prefix.
func (rp *ReverseProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	for _, prefix := range rp.prefixes {
		if strings.HasPrefix(r.URL.Path, prefix) {
			rp.targets[prefix].ServeHTTP(w, r)
			return
		}
	}

	// No matching target — return 404
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	fmt.Fprintf(w, `{"error":"not_found","message":"no upstream configured for path: %s","timestamp":"%s"}`,
		r.URL.Path, time.Now().UTC().Format(time.RFC3339))
}

// Handler returns the ReverseProxy as an http.Handler.
func (rp *ReverseProxy) Handler() http.Handler {
	return rp
}
