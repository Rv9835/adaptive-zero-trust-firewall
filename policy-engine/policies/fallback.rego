# ZTNA Policy Engine — Fallback Rules
# Activated when ML Engine is unreachable
package ztna.fallback

import rego.v1

# Default fallback decision
default decision := {"action": "CHALLENGE", "reason": "ML engine unavailable — fallback to MFA"}

# ──────────────────────────────────────────────────────────────
# Fail-Closed Mode (default): All users must pass MFA
# ──────────────────────────────────────────────────────────────
decision := {"action": "CHALLENGE", "reason": "fail-closed — MFA required for all sessions"} if {
    input.scoring_mode == "fallback"
    input.fail_mode == "closed"
}

# ──────────────────────────────────────────────────────────────
# Fail-Open Mode: Known devices get through, unknown get MFA
# ──────────────────────────────────────────────────────────────
decision := {"action": "ALLOW", "reason": "fail-open — known device allowed"} if {
    input.scoring_mode == "fallback"
    input.fail_mode == "open"
    input.device_trusted == true
}

decision := {"action": "CHALLENGE", "reason": "fail-open — unknown device requires MFA"} if {
    input.scoring_mode == "fallback"
    input.fail_mode == "open"
    input.device_trusted == false
}
