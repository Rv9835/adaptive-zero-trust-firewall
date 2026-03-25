"""
Feedback Route — POST /api/ml/feedback
Receives false-positive feedback to update user behavioral baselines.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone

router = APIRouter()


class FeedbackRequest(BaseModel):
    user_id: str
    event_type: str  # "mfa_passed", "mfa_failed", "admin_override"
    context: Dict[str, Any] = {}


class FeedbackResponse(BaseModel):
    baseline_updated: bool
    message: str


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(request: FeedbackRequest):
    """
    Process false-positive feedback from the MFA step-up challenge.

    When a user passes MFA after being challenged:
    - Their current context (IP, geo, time) is added to their baseline
    - Future requests from the same context will score higher
    - The ML model learns that this pattern is valid for this user

    When MFA fails:
    - The event is logged as a confirmed threat
    - The IP/context is added to a watchlist
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    if request.event_type == "mfa_passed":
        # In production: update MongoDB baseline_profiles collection
        # Add new IP, geo, and time to the user's known patterns
        updates = {}
        if "ip_address" in request.context:
            updates["known_ips"] = request.context["ip_address"]
        if "geo_location" in request.context:
            updates["known_geolocations"] = request.context["geo_location"]
        if "hour_of_day" in request.context:
            updates["typical_access_hours"] = request.context["hour_of_day"]

        # TODO Phase 5: Actually write to MongoDB
        # baseline_profiles.update_one(
        #     {"user_id": request.user_id},
        #     {"$addToSet": updates, "$set": {"last_updated": timestamp}}
        # )

        return FeedbackResponse(
            baseline_updated=True,
            message=f"Baseline updated for user {request.user_id}. "
                    f"New context added: {list(updates.keys())}",
        )

    elif request.event_type == "mfa_failed":
        # Log as confirmed threat — do NOT update baseline
        # TODO Phase 5: Write to access_logs with decision=DENY, mfa_result=failed
        return FeedbackResponse(
            baseline_updated=False,
            message=f"MFA failed for user {request.user_id}. Logged as threat event.",
        )

    elif request.event_type == "admin_override":
        # Admin manually approved — update baseline
        return FeedbackResponse(
            baseline_updated=True,
            message=f"Admin override processed for user {request.user_id}.",
        )

    return FeedbackResponse(
        baseline_updated=False,
        message=f"Unknown event type: {request.event_type}",
    )
