"""
Adaptive Zero Trust Firewall — ML Threat Engine
FastAPI application for anomaly detection and Trust Score calculation.
"""
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.score import router as score_router
from app.routes.feedback import router as feedback_router
from app.models.isolation_forest import AnomalyDetector
from app.models.xgboost_model import ThreatClassifier

# Global model instances
anomaly_detector: AnomalyDetector = None
threat_classifier: ThreatClassifier = None
start_time: float = 0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup, cleanup on shutdown."""
    global anomaly_detector, threat_classifier, start_time
    start_time = time.time()

    print("🧠 Loading ML models...")

    # Initialize and load/train models
    anomaly_detector = AnomalyDetector()
    anomaly_detector.load_or_train()

    threat_classifier = ThreatClassifier()
    threat_classifier.load_or_train()

    print("✅ ML models loaded successfully")

    yield

    print("🔻 Shutting down ML engine")


app = FastAPI(
    title="ZTNA ML Threat Engine",
    description="Anomaly detection and Trust Score calculation for the Adaptive Zero Trust Firewall",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS (internal service, but allow proxy gateway)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(score_router, prefix="/api/ml")
app.include_router(feedback_router, prefix="/api/ml")


@app.get("/health")
async def health():
    uptime = time.time() - start_time
    return {
        "status": "ok",
        "service": "ml-engine",
        "version": "1.0.0",
        "uptime_seconds": round(uptime, 1),
        "models_loaded": anomaly_detector is not None and threat_classifier is not None,
    }
