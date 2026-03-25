# ============================================================
# Stage 1: Build the Go binary
# ============================================================
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy go.mod and go.sum first for dependency caching
COPY go.mod go.sum* ./
RUN go mod download

# Copy source code
COPY . .

# Build statically-linked binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /proxy-gateway \
    ./cmd/proxy/main.go

# ============================================================
# Stage 2: Minimal production image
# ============================================================
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

# Security: run as non-root user
RUN adduser -D -u 1001 nonroot
USER nonroot

WORKDIR /app

# Copy binary from builder
COPY --from=builder /proxy-gateway .

# Expose the proxy port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["./proxy-gateway"]
