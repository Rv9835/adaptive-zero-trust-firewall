# 🎙️ Voiceover Script — Adaptive Zero Trust Firewall
### Live Demo Walkthrough · ~3 minutes

---

## [Opening]

"What if your firewall could tell the difference between a legitimate employee logging in from Mumbai — and an attacker using stolen credentials from a Tor exit node at 3AM?

That's exactly what this system does. This is the **Adaptive Zero Trust Firewall** — and everything you're about to see is running live, right now."

---
Using "Replace String in File"

I'm in read-only Ask mode — I can't directly edit files. Here is the full rewritten peach.md content — replace everything in the file with this:

```markdown
# 🎙️ Prototype Demo Script — Adaptive Zero Trust Firewall
### Full Walkthrough · ~10 minutes · Live System

---

## [INTRO — 0:00–1:00]

"Good morning / afternoon everyone.

What I'm going to show you today is a fully working, production-architected security system that solves one of the most persistent problems in enterprise security — the fact that traditional firewalls are fundamentally broken.

They work on the assumption that if you're inside the network, you can be trusted. Get past the perimeter once — with stolen credentials, a phished employee, a compromised IoT device — and you're in. You can move freely. You can access resources. And in most organizations, no one will notice for weeks.

This system takes a completely different approach.

It's called the **Adaptive Zero Trust Firewall**. And the core principle is simple: **never trust, always verify, and continuously evaluate** — not just at login, but on every single request, in real time.

Let me show you exactly how it works."

---

## [THE DASHBOARD — 1:00–2:00]

*[Open the live dashboard in the browser]*

"This is the control center. Everything you see here is live — no mocks, no pre-recorded data.

The first thing to notice is the **Service Health Panel** at the top.

We have **4 out of 4 services online**, all healthy.

- **Proxy Gateway** — healthy · ⚡ 15ms
- **Auth Service** — healthy · ⚡ 14ms
- **ML Engine** — healthy · ⚡ 15ms
- **Policy Engine** — healthy

*[Click Refresh on the health panel]*

Every time you hit Refresh, the dashboard pings each service and measures response time live. These numbers will change slightly — that's real network latency, not a static screenshot.

These four services are the backbone of the entire system. Let me explain what each one does before we start running scenarios."

---

## [SERVICE 1 — PROXY GATEWAY — 2:00–3:00]

"The **Proxy Gateway** is the front door — port 8080. Every single request to the system enters here first, and nothing bypasses it.

It's written in Go, using the chi router and zerolog for structured logging.

Here's what it does the moment a request arrives:

**First** — it extracts the real client IP from the `X-Forwarded-For` header. Even behind a load balancer, we know exactly where the request originated.

**Second** — it enforces a **per-IP rate limiter**. We use a token bucket algorithm — each IP gets a fixed number of requests per second with a burst allowance. If an attacker is hammering the system, they get cut off before they ever hit a backend service.

**Third** — it runs the **authentication middleware**. In production mode, this validates the JWT token on every request — not just login. An expired token, a tampered token, a revoked token — all caught here, at the edge.

**Fourth** — it does **path-based reverse proxying**. Requests to `/api/auth` go to the Auth Service, `/api/ml` goes to the ML Engine, and so on. The gateway intelligently routes traffic and strips path prefixes before forwarding.

The gateway also injects headers — `X-Forwarded-Host`, `X-Forwarded-Proto`, and our own `X-ZTF-Proxy: adaptive-ztna/1.0` — so downstream services always know a request passed through the Zero Trust layer.

All of this happens in under 15 milliseconds."

---

## [SERVICE 2 — AUTH SERVICE — 3:00–4:00]

"The **Auth Service** handles identity — port 8081. It's also Go, also chi, backed by **MongoDB Atlas**.

When a user logs in, here's the exact sequence:

They POST their username and password to `/api/auth/login`. The service looks up the user in MongoDB, then runs **bcrypt** comparison on the password hash. We never store plain passwords — bcrypt with cost factor 12 means even if the database is breached, cracking a single password takes hours on modern hardware.

If the password is valid, we issue two tokens — a short-lived **JWT access token** (15 minutes) and a longer-lived **refresh token** (7 days). The JWT contains the user ID, username, role, and expiry — all signed with a secret key.

Now, MFA. The Auth Service supports **TOTP — Time-based One-Time Passwords** — the same standard used by Google Authenticator, Authy, and every enterprise 2FA app.

When a user enrolls, we generate a TOTP secret and return a QR code they scan with their authenticator app. When they verify, we generate the expected 6-digit code for the current 30-second window and compare. If it matches, MFA is confirmed and we upgrade their session.

The token refresh endpoint lets clients silently renew their access token before it expires — no re-login required unless the refresh token itself has expired.

Three user accounts are pre-seeded for this demo — Sarah the engineer, Raj from sales, and an admin account. Each has a different role and risk profile — which matters when the policy engine evaluates their requests."

---

## [SERVICE 3 — ML ENGINE — 4:00–5:30]

"This is where the intelligence lives. The **ML Engine** — port 8082 — is a Python FastAPI service running two machine learning models simultaneously.

Every request that comes through the system gets scored. Not just logins — every API call, every resource access. The output is a **Trust Score from 0 to 100**.

Here's how it works.

We extract a **12-dimensional feature vector** from the request metadata:

1. **Hour of day** — normalized 0 to 1. A login at 3AM is suspicious.
2. **Day of week** — a request on Sunday at 2AM looks very different from Monday at 9AM.
3. **Business hours flag** — binary. Is this request happening during normal working hours?
4. **Failed logins in the last hour** — normalized, capped at 10. Five failed attempts is serious.
5. **Known IP** — has this IP appeared in the user's baseline history?
6. **Malicious IP** — is this IP on our threat intel list? We check against known botnet ranges, Tor exit nodes, and malicious infrastructure prefixes.
7. **Tor exit node** — specific check against a list of known Tor IPs. Anonymized traffic is a major red flag.
8. **Geo distance score** — how far is this login from the user's known locations? A jump from New York to Mumbai in 2 hours is physically impossible.
9. **Device trusted** — is the device registered and known for this user?
10. **Resource typicality** — has this user ever accessed this specific resource before?
11. **User-agent anomaly** — is the browser or client consistent with the user's history? A `curl/7.0` user agent on an admin account is not normal.
12. **Access velocity** — how many requests has this user or device made in the last hour compared to their baseline?

These 12 features go into two models.

**Model one is Isolation Forest** — unsupervised. It was trained on 1,000 samples of normal enterprise access patterns. It doesn't know what an attack looks like — it only knows what *normal* looks like. Anything that deviates significantly is flagged as an anomaly. This catches novel attack patterns that no one has seen before.

**Model two is XGBoost** — supervised classifier. When the Isolation Forest flags something anomalous, XGBoost takes over for a more precise threat classification. It's been trained on labeled attack scenarios to produce a precise threat probability.

The final Trust Score is computed by combining these model outputs with weighted contextual signals — a clean IP with a trusted device gets a bonus, a Tor exit node gets an immediate penalty regardless of what the models say.

And critically — the ML Engine has a **feedback endpoint**. When a user completes MFA and is verified as legitimate, that outcome is sent back to the engine. The model learns. A user who travels frequently will stop being flagged. The system adapts without anyone writing new rules."

---

## [SERVICE 4 — POLICY ENGINE — 5:30–6:30]

"The **Policy Engine** is Open Policy Agent — OPA — with policies written in Rego. It's the final decision-maker.

The ML Engine gives us a score. The Policy Engine turns that score into an action.

The rules are explicit and auditable. Let me read them to you because they tell the whole story:

- Trust score **≥ 80** and device is trusted and IP is not malicious → **ALLOW** — trusted session
- Trust score **≥ 90** and IP is not malicious → **ALLOW** — high trust score, device doesn't even need to be registered
- Trust score **≥ 40 and < 80** and device is trusted → **CHALLENGE** — medium trust, MFA required
- Trust score **≥ 50** and device is untrusted → **CHALLENGE** — untrusted device, MFA required
- Trust score **< 30** → **DENY** — critically low trust score
- IP reputation is malicious → **DENY** — regardless of score
- Account is locked → **DENY** — regardless of score

Three outcomes. Allow, Challenge, Deny. Nothing gets through without passing through this policy layer.

What makes OPA special is that these rules are **version-controlled code**. They live in a `.rego` file in the repository. You can review them in a PR. You can write unit tests for them. You can audit exactly what the system decided and why, for every decision, forever.

No hidden logic. No black boxes. If the policy changes, there's a commit for it."

---

## [LIVE SCENARIOS — 6:30–9:00]

"Now let's make it real. I'm going to run all four scenarios live."

---

### Scenario 1 — Trusted Employee 🟢

*[Click 'Trusted Employee' preset → Run Score]*

"Sarah. Office IP — 10.0.1.50 — internal network. Registered device. Business hours. Zero failed logins. Target resource: the code repository.

Watch the trust score.

Above 80. Policy Engine returns **ALLOW** — reason: trusted session.

No MFA prompt. No friction. Sarah is doing exactly what she always does. The system recognizes that and gets out of her way.

That's important — Zero Trust doesn't mean making legitimate users' lives harder. It means being precise about risk. Low risk, low friction."

---

### Scenario 2 — Traveling Employee 🟡

*[Click 'Traveling Employee' preset → Run Score]*

"Raj. Same company, same legitimacy. But he's in Mumbai — IP 203.45.67.89, a public network, unregistered device, one failed login.

Trust score drops to the 50s. The ML Engine flagged three signals: unknown IP, geo distance from his home location in New York, and untrusted device. None of those alone are alarming. Together, they shift the score into the challenge zone.

Policy Engine returns **CHALLENGE** — MFA required.

Raj opens his authenticator app, enters the 6-digit TOTP code, passes. He's in.

Now — and this is the feedback loop — that successful MFA verification is sent back to the ML Engine. Mumbai is now a known location for Raj. His Mumbai IP range gets added to his baseline. Next time he travels there, his score will be higher. The system learned."

---

### Scenario 3 — Stolen Credentials 🔴

*[Click 'Stolen Credentials' preset → Run Score]*

"Same admin account. But this time — IP address 185.220.101.1. That's a known Tor exit node. 3AM. Five failed login attempts in the last hour. User agent is `curl/7.0`. Target: the finance database.

Someone has the admin password. Maybe it was phished. Maybe it was leaked. It doesn't matter.

Watch what happens.

Trust score collapses — below 30. The ML Engine's Isolation Forest classified this as a severe outlier. Six of our twelve features are simultaneously in the red — time, failed logins, IP malicious flag, Tor flag, user agent anomaly, geo distance unknown.

Policy Engine returns **DENY** — malicious IP detected. Hard stop.

No MFA prompt. No second chance. The request is dropped.

This is the critical capability — **valid credentials are not enough**. The attacker can have the username and password and still be blocked, because the *context* tells us something is wrong."

---

### Scenario 4 — IoT Device 🤖

*[Click 'IoT Device' preset → Run Score]*

"This is the scenario most security systems completely miss — a compromised IoT device.

Floor sensor, internal IP, trusted device, no failed logins. On the surface, this looks fine. But the access velocity is way above baseline — this sensor is sending far more requests than it ever has. It's been flagged as a possible pivot point.

Trust score comes in mid-range. Policy says **CHALLENGE**.

The device gets rate-limited. Its requests are queued for review. If it's a legitimate sensor glitch, operations can clear it. If it's been compromised and someone is using it to enumerate the internal network, we've just contained the blast radius before any lateral movement occurs."

---

## [ACCESS LOG — 9:00–9:30]

*[Scroll down to the access log panel]*

"Look at the bottom of the dashboard. Every decision we just made is logged — in real time.

User, IP address, target resource, trust score, action, reason. Timestamp on every row.

This is your audit trail. If there's ever a security incident, you can replay exactly what happened, when, and why the system made each decision. Not an approximation — the exact inputs and outputs of every policy evaluation.

This is what regulators and compliance frameworks want. GDPR, SOC 2, ISO 27001 — they all require access logging. We give you that out of the box."

---

## [CLOSE — 9:30–10:00]

"So let's recap what we just saw running live.

A **Proxy Gateway** that applies rate limiting and auth enforcement at the edge — 15 milliseconds.

An **Auth Service** with JWT, bcrypt, and TOTP MFA — 14 milliseconds.

An **ML Engine** computing a 12-feature Trust Score with Isolation Forest and XGBoost — 15 milliseconds.

A **Policy Engine** with version-controlled, auditable Rego rules converting that score into Allow, Challenge, or Deny — sub-millisecond.

A **feedback loop** that retrains the model on real MFA outcomes, so the system gets smarter over time without manual tuning.

And a **Next.js dashboard** giving you real-time observability into every decision the system makes.

All of it — `docker-compose up --build`. One command. Four services. Running right now.

Zero Trust isn't a product you buy. It's an architecture you build — one that evaluates context, not just credentials, on every request, every time.

We built it. You just watched it work."

---

> **Live service status at time of demo:**
>
> | Service | Status | Latency |
> |---------|--------|---------|
> | Proxy Gateway | ✅ healthy | ⚡ 15ms |
> | Auth Service | ✅ healthy | ⚡ 14ms |
> | ML Engine | ✅ healthy | ⚡ 15ms |
> | Policy Engine | ✅ healthy | — |
>
> **4 / 4 services online**
```