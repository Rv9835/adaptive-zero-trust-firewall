FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /auth-service \
    ./cmd/auth/main.go

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
RUN adduser -D -u 1001 nonroot
USER nonroot
WORKDIR /app
COPY --from=builder /auth-service .
EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8081/health || exit 1

ENTRYPOINT ["./auth-service"]
