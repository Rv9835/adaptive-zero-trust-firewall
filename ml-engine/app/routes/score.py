"""
Score Route — POST /api/ml/score
Accepts request metadata, returns Trust Score and anomaly detection results.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.services.feature_engineering import (
    extract_features,
    compute_trust_score,
    determine_action,
)

router = APIRouter()


class ScoreRequest(BaseModel):
    user_id: str
    ip_address: str
    user_agent: str = ""
    target_resource: str = ""
    time_utc: str = ""
    failed_logins_1h: int = 0
    device_trusted: bool = False
    geo_location: str = ""
    access_count_1h: int = 1
    # Baseline data (passed by proxy from DB, or empty for new users)
    baseline: Optional[dict] = None


class ScoreResponse(BaseModel):
    trust_score: float
    anomaly_detected: bool
    anomaly_reason: str = ""
    recommended_action: str
    scoring_mode: str = "normal"


@router.post("/score", response_model=ScoreResponse)
async def calculate_trust_score(request: ScoreRequest):
    """Calculate real-time Trust Score for a request."""
    try:
        # Import models from app state
        from app.main import anomaly_detector, threat_classifier

        if anomaly_detector is None or threat_classifier is None:
            return ScoreResponse(
                trust_score=50.0,
                anomaly_detected=False,
                anomaly_reason="ML models not loaded — using default score",
                recommended_action="CHALLENGE",
                scoring_mode="fallback",
            )

        # Extract features
        features = extract_features(request.model_dump(), request.baseline)

        # Run models
        anomaly_score = anomaly_detector.predict(features)
        is_anomaly = anomaly_detector.is_anomaly(features)
        threat_prob = threat_classifier.predict_threat_probability(features)

        # Compute Trust Score
        trust_score = compute_trust_score(anomaly_score, threat_prob)

        # Build anomaly reason
        reasons = []
        if is_anomaly:
            if not request.device_trusted:
                reasons.append("unknown device")
            if request.failed_logins_1h > 3:
                reasons.append(f"{request.failed_logins_1h} failed logins in last hour")
            if request.geo_location and request.baseline:
                known_geos = request.baseline.get("known_geolocations", [])
                if request.geo_location not in known_geos:
                    reasons.append(f"new location: {request.geo_location}")
            if threat_prob > 0.5:
                reasons.append(f"threat probability: {threat_prob:.1%}")

        anomaly_reason = "; ".join(reasons) if reasons else ""
        action = determine_action(trust_score)

        return ScoreResponse(
            trust_score=trust_score,
            anomaly_detected=is_anomaly,
            anomaly_reason=anomaly_reason,
            recommended_action=action,
            scoring_mode="normal",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring error: {str(e)}")
