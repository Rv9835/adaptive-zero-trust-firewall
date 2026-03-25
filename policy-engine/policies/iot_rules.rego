# ZTNA Policy Engine — IoT Device Rules
package ztna.iot

import rego.v1

# Default IoT decision
default decision := {"action": "DENY", "reason": "IoT device — no matching rule"}

# ──────────────────────────────────────────────────────────────
# IoT devices cannot perform MFA — behavioral profile only
# ──────────────────────────────────────────────────────────────

# ALLOW: IoT device with normal behavior
decision := {"action": "ALLOW", "reason": "IoT device — normal behavior"} if {
    input.device_type == "iot"
    input.trust_score >= 70
    not input.anomaly_detected
}

# QUARANTINE: IoT device with anomalous behavior
decision := {"action": "QUARANTINE", "reason": "IoT device — anomalous network behavior detected"} if {
    input.device_type == "iot"
    input.trust_score < 25
    input.anomaly_type == "network_behavior"
}

# DENY: IoT device with very low trust
decision := {"action": "DENY", "reason": "IoT device — critical anomaly"} if {
    input.device_type == "iot"
    input.trust_score < 25
}

# RESTRICT: IoT device with medium trust — limit to known endpoints only
decision := {"action": "RESTRICT", "reason": "IoT device — limited to baseline endpoints"} if {
    input.device_type == "iot"
    input.trust_score >= 25
    input.trust_score < 70
}
