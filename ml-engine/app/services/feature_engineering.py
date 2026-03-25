"""
Feature engineering for Trust Score calculation.
Extracts and normalizes features from request metadata.
"""
import hashlib
import math
from datetime import datetime, timezone
from typing import Dict, Any, List

# Known malicious IP ranges (simplified — in production, use a threat intel feed)
MALICIOUS_IP_PREFIXES = [
    "185.220.",  # Common Tor exit nodes
    "198.51.",   # Test ranges often used in attacks
    "45.33.",    # Known botnet IPs
    "91.109.",   # Darknet IPs
]

# Known Tor exit node IPs (sample — in production, pull from Tor Project API)
TOR_EXIT_NODES = {"185.220.101.1", "185.220.101.2", "185.220.102.1"}


def extract_features(request_data: Dict[str, Any], baseline: Dict[str, Any] = None) -> List[float]:
    """
    Extract a feature vector from request metadata.

    Features (12-dimensional):
    0. hour_of_day (0-23 normalized to 0-1)
    1. day_of_week (0-6 normalized to 0-1)
    2. is_business_hours (0 or 1)
    3. failed_logins_1h (normalized 0-1, capped at 10)
    4. ip_is_known (0 or 1 — is the IP in user's baseline)
    5. ip_is_malicious (0 or 1)
    6. ip_is_tor (0 or 1)
    7. geo_distance_score (0-1, 0=same location, 1=max distance)
    8. device_trusted (0 or 1)
    9. resource_is_typical (0 or 1 — has user accessed this resource before)
    10. user_agent_anomaly (0 or 1 — does UA differ from baseline)
    11. access_velocity (0-1, how many requests in last hour, normalized)
    """
    now = datetime.now(timezone.utc)
    if "time_utc" in request_data:
        try:
            now = datetime.fromisoformat(request_data["time_utc"].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            pass

    hour = now.hour
    day = now.weekday()

    # Feature 0: Hour normalized
    hour_norm = hour / 23.0

    # Feature 1: Day normalized
    day_norm = day / 6.0

    # Feature 2: Business hours (Mon-Fri, 8AM-7PM)
    is_business = 1.0 if (0 <= day <= 4 and 8 <= hour <= 19) else 0.0

    # Feature 3: Failed logins (normalized, cap at 10)
    failed_logins = min(request_data.get("failed_logins_1h", 0), 10)
    failed_norm = failed_logins / 10.0

    # Feature 4: Known IP
    ip = request_data.get("ip_address", "")
    known_ips = baseline.get("known_ips", []) if baseline else []
    ip_known = 1.0 if ip in known_ips else 0.0

    # Feature 5: Malicious IP
    ip_malicious = 1.0 if any(ip.startswith(prefix) for prefix in MALICIOUS_IP_PREFIXES) else 0.0

    # Feature 6: Tor exit node
    ip_tor = 1.0 if ip in TOR_EXIT_NODES else 0.0

    # Feature 7: Geo distance (simplified — compute from IP hash difference as proxy)
    known_geos = baseline.get("known_geolocations", []) if baseline else []
    geo_location = request_data.get("geo_location", "")
    if geo_location and known_geos:
        geo_dist = 0.0 if geo_location in known_geos else 0.8
    else:
        geo_dist = 0.5  # Unknown

    # Feature 8: Device trusted
    device_trusted = 1.0 if request_data.get("device_trusted", False) else 0.0

    # Feature 9: Typical resource
    target = request_data.get("target_resource", "")
    typical_resources = baseline.get("typical_resources", []) if baseline else []
    resource_typical = 1.0 if target in typical_resources else 0.0

    # Feature 10: User agent anomaly
    ua = request_data.get("user_agent", "")
    baseline_ua = baseline.get("user_agent_hash", "") if baseline else ""
    ua_hash = hashlib.md5(ua.encode()).hexdigest()[:8]
    ua_anomaly = 0.0 if ua_hash == baseline_ua or not baseline_ua else 1.0

    # Feature 11: Access velocity
    access_count = request_data.get("access_count_1h", 1)
    velocity_norm = min(access_count / 100.0, 1.0)

    return [
        hour_norm,
        day_norm,
        is_business,
        failed_norm,
        ip_known,
        ip_malicious,
        ip_tor,
        geo_dist,
        device_trusted,
        resource_typical,
        ua_anomaly,
        velocity_norm,
    ]


def compute_trust_score(anomaly_score: float, threat_prob: float) -> float:
    """
    Combine anomaly score and threat probability into a Trust Score (0-100).

    - anomaly_score: from Isolation Forest (-1 to 1, higher = more normal)
    - threat_prob: from XGBoost (0-1, probability of being malicious)
    """
    # Normalize anomaly score to 0-100
    # Isolation Forest: scores close to 1 are normal, close to -1 are anomalous
    anomaly_normalized = max(0, min(100, (anomaly_score + 1) * 50))

    # Invert threat probability (high prob = low trust)
    threat_factor = (1 - threat_prob) * 100

    # Weighted combination: 40% anomaly, 60% threat classifier
    trust_score = 0.4 * anomaly_normalized + 0.6 * threat_factor

    return round(max(0, min(100, trust_score)), 1)


def determine_action(trust_score: float) -> str:
    """Determine recommended action based on trust score."""
    if trust_score >= 80:
        return "ALLOW"
    elif trust_score >= 40:
        return "CHALLENGE"
    else:
        return "DENY"
