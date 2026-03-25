# ZTNA Policy Engine — Main Package
package ztna

import rego.v1

# Default decision
default decision := {"action": "DENY", "reason": "no matching policy rule"}

# ──────────────────────────────────────────────────────────────
# ALLOW: High trust score + trusted device
# ──────────────────────────────────────────────────────────────
decision := {"action": "ALLOW", "reason": "trusted session"} if {
    input.trust_score >= 80
    input.device_trusted == true
    not input.ip_reputation == "malicious"
}

decision := {"action": "ALLOW", "reason": "high trust score"} if {
    input.trust_score >= 90
    not input.ip_reputation == "malicious"
}

# ──────────────────────────────────────────────────────────────
# CHALLENGE: Medium trust or untrusted device
# ──────────────────────────────────────────────────────────────
decision := {"action": "CHALLENGE", "reason": "medium trust — MFA required"} if {
    input.trust_score >= 40
    input.trust_score < 80
    input.device_trusted == true
    not input.ip_reputation == "malicious"
}

decision := {"action": "CHALLENGE", "reason": "untrusted device — MFA required"} if {
    input.trust_score >= 50
    input.device_trusted == false
    not input.ip_reputation == "malicious"
}

# ──────────────────────────────────────────────────────────────
# DENY: Low trust score or malicious indicators
# ──────────────────────────────────────────────────────────────
decision := {"action": "DENY", "reason": "critically low trust score"} if {
    input.trust_score < 30
}

decision := {"action": "DENY", "reason": "malicious IP detected"} if {
    input.ip_reputation == "malicious"
}

decision := {"action": "DENY", "reason": "account locked"} if {
    input.account_locked == true
}
