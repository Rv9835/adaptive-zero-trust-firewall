# 🛡️ Adaptive Zero Trust Firewall (PS001)

A context-aware Zero Trust Network Access (ZTNA) gateway that acts as a reverse proxy, evaluates real-time ML-based Trust Scores, enforces policies via Open Policy Agent (OPA), and reduces false positives using a step-up MFA feedback loop.

## Architecture

```
Client → [Proxy Gateway :8080]
              ├── [Auth Service :8081]  ← JWT + MFA (MongoDB Atlas)
              ├── [ML Engine :8082]     ← Isolation Forest + XGBoost
              ├── [OPA Engine :8181]    ← Rego Policies
              └── [Backend Services]
```

## Quick Start

### Prerequisites
- Go 1.22+
- Python 3.11+
- Docker & Docker Compose
- MongoDB Atlas account (or local MongoDB)

### Option 1: Docker Compose (Recommended)

```bash
# Clone and configure
cp .env.example .env
# Edit .env with your MongoDB Atlas URI

# Start all services
docker-compose up --build

# Test
curl http://localhost:8080/health
curl http://localhost:8081/health
curl http://localhost:8082/health
```

### Option 2: Run Individually

#### Proxy Gateway (Go)
```bash
cd proxy-gateway
go mod tidy
go build -o proxy-gateway.exe ./cmd/proxy/main.go
# Set environment variables (see .env.example)
./proxy-gateway.exe
```

#### Auth Service (Go)
```bash
cd auth-service
go mod tidy
go build -o auth-service.exe ./cmd/auth/main.go
# Set MONGODB_URI, JWT_SECRET
./auth-service.exe
```

#### ML Engine (Python)
```bash
cd ml-engine
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8082
```

#### OPA Policy Engine
```bash
# Using Docker
docker run -p 8181:8181 -v ./policy-engine/policies:/policies -v ./policy-engine/data:/data \
  openpolicyagent/opa:latest run --server /policies/ /data/
```

## API Endpoints

| Service | Endpoint | Method | Description |
|---------|----------|--------|-------------|
| Proxy | `/health` | GET | Gateway health check |
| Proxy | `/*` | ANY | Reverse proxy to backends |
| Auth | `/api/auth/login` | POST | Login → JWT |
| Auth | `/api/auth/mfa/verify` | POST | Verify TOTP code |
| Auth | `/api/auth/mfa/enroll` | POST | Enroll MFA (JWT required) |
| Auth | `/api/auth/token/refresh` | POST | Refresh JWT |
| ML | `/api/ml/score` | POST | Get Trust Score |
| ML | `/api/ml/feedback` | POST | Submit MFA feedback |
| OPA | `/v1/data/ztna/decision` | POST | Query policy decision |

## Test Credentials

After running the seed script (`go run auth-service/scripts/seed.go`):

| Username | Password | Role |
|----------|----------|------|
| `sarah.engineer` | `SecurePass123!` | engineer |
| `raj.sales` | `SecurePass456!` | sales |
| `admin` | `AdminPass789!` | admin |

## Tech Stack

- **Gateway**: Go (chi, zerolog, x/time)
- **Auth**: Go (golang-jwt, pquerna/otp, bcrypt)
- **ML**: Python (FastAPI, Scikit-learn, XGBoost)
- **Policy**: Open Policy Agent (Rego)
- **Database**: MongoDB Atlas
- **Cache**: Redis
- **Containers**: Docker + Docker Compose

## License

MIT
