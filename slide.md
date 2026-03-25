# 🛡️ Adaptive Zero Trust Firewall — Presentation Slides

---

## Slide 1 — Title

### **Adaptive Zero Trust Firewall**
**PS001 — Context-Aware Network Access Control**

> *"Never trust. Always verify. Continuously evaluate."*

- Real-time ML Trust Scoring
- Policy-as-Code enforcement via OPA
- Step-up MFA feedback loop to reduce false positives
- Zero Trust from request to response — every time

---

## Slide 2 — The Problem

### Traditional Firewalls Are Broken

| Old Model | Zero Trust Model |
|-----------|-----------------|
| "Inside = Trusted" | No implicit trust |
| Static IP-based rules | Context-aware decisions |
| Binary: Allow / Deny | Allow / Challenge / Deny |
| No anomaly awareness | ML-powered threat scoring |
| Alert fatigue + false positives | Adaptive MFA feedback loop |

**The threat:**
- Stolen credentials bypass perimeter defenses
- Insider threats & lateral movement go undetected
- IoT / remote work expands the attack surface massively

---

## Slide 3 — Architecture Overview

### Four-Layer Defense System

```
Client Request
      │
      ▼
┌─────────────────────────────┐
│   Proxy Gateway :8080       │  ← Rate limiting, CORS, Auth middleware
│   Go · chi · zerolog        │    Reverse proxy with path-based routing
└────────────┬────────────────┘
             │ fan-out
     ┌───────┼──────────┬──────────┐
     ▼       ▼          ▼          ▼
 Auth Svc  ML Engine  OPA Engine  Backend
  :8081     :8082      :8181     Services
  Go·JWT   Python·    Rego·
  bcrypt   FastAPI    Policies
  MongoDB  IsoForest
  TOTP     XGBoost
```

**Dashboard** (Next.js :3000) — Real-time observability & test console

---

## Slide 4 — How It Works (Request Flow)

### Every Request Goes Through 4 Checkpoints

1. **Proxy Gateway** receives the request
   - Extracts IP, headers, JWT token
   - Applies rate limiting (per-IP token bucket)
   - Forwards to upstream services

2. **Auth Service** validates identity
   - JWT generation & verification (RS256)
   - TOTP-based MFA enrollment & challenge
   - bcrypt password hashing, MongoDB user store

3. **ML Engine** scores the request
   - **Isolation Forest** → unsupervised anomaly detection (12 features)
   - **XGBoost** → threat classification if anomaly detected
   - Features: hour, location, device trust, failed logins, IP reputation, access velocity

4. **OPA Policy Engine** makes the final call
   - Trust score ≥ 80 + trusted device → **ALLOW**
   - Trust score 40–79 → **CHALLENGE** (trigger MFA)
   - Trust score < 30 or malicious IP → **DENY**

---

## Slide 5 — ML Engine Deep Dive

### Context-Aware Threat Intelligence

**12-Dimensional Feature Vector per Request:**

| Feature | What it detects |
|---------|----------------|
| Hour / Day of week | Unusual access times (3AM logins) |
| Business hours flag | Off-hours anomalies |
| Failed logins (1h) | Brute-force attempts |
| Known IP baseline | New/unknown network |
| Malicious IP list | Threat intel matching |
| Tor exit node | Anonymized attacks |
| Geo distance score | Impossible travel |
| Device trusted | Unregistered device |
| Resource typicality | Lateral movement |
| User-agent anomaly | Scripted/bot traffic |
| Access velocity | Request flooding |

**Models:**
- `Isolation Forest` (200 estimators, 5% contamination) — unsupervised baseline
- `XGBoost Classifier` — supervised classification on flagged sessions
- MFA feedback loop re-trains model to reduce false positives over time

---

## Slide 6 — Live Demo Scenarios

### Four Real-World Attack/Access Scenarios

| Scenario | Profile | Expected Result |
|----------|---------|----------------|
| 🟢 **Trusted Employee** | Office IP, known device, business hours, 0 failed logins | ALLOW — Trust ≥ 80 |
| 🟡 **Traveling Employee** | New country, untrusted device, 1 failed login | CHALLENGE — MFA required |
| 🔴 **Stolen Credentials** | Tor exit node, 3AM, 5 failed logins, curl UA | DENY — Malicious indicators |
| 🤖 **IoT Device Burst** | Sensor gateway, anomalous request velocity | CHALLENGE / DENY |

**All four services running simultaneously:**
- Proxy Gateway ✅ healthy · ⚡ ~8ms
- Auth Service ✅ healthy · ⚡ ~6ms
- ML Engine ✅ healthy · ⚡ ~7ms
- Policy Engine ✅ healthy · ⚡ ~7ms

---

## Slide 7 — Tech Stack & Differentiation

### Production-Grade Stack, Hackathon Speed

| Layer | Technology | Why |
|-------|-----------|-----|
| Gateway | Go + chi + zerolog | High-throughput, structured logs |
| Auth | Go + JWT + bcrypt + TOTP | Industry-standard security primitives |
| ML | Python + FastAPI + Scikit-learn + XGBoost | Rapid ML iteration |
| Policy | Open Policy Agent (Rego) | Auditable, declarative policy-as-code |
| Database | MongoDB Atlas | Flexible user/session schema |
| Cache | Redis | Rate limit state, session cache |
| Frontend | Next.js 15 + Framer Motion | Real-time observability dashboard |
| Containers | Docker + Docker Compose | One-command deployment |

**What makes this different:**
- ✅ **Adaptive** — ML scores every request, not just login events
- ✅ **Feedback loop** — MFA outcome retrains the model, reducing false positives
- ✅ **Policy-as-code** — OPA rules are auditable, version-controlled, testable
- ✅ **Observable** — Live dashboard shows trust scores, latency, and decisions in real time
- ✅ **SDK ready** — Node.js SDK for easy client integration

---
