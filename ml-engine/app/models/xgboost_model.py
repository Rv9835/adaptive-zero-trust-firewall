"""
XGBoost — Supervised threat classifier.
Predicts probability of a request being malicious based on labeled data.
"""
import os
import numpy as np
import joblib
from xgboost import XGBClassifier


MODEL_PATH = os.environ.get("MODEL_DIR", "/app/models") + "/xgboost_threat.pkl"


class ThreatClassifier:
    """XGBoost-based threat probability classifier."""

    def __init__(self):
        self.model: XGBClassifier = None

    def load_or_train(self):
        """Load a pre-trained model or train from mock data."""
        if os.path.exists(MODEL_PATH):
            print(f"📂 Loading XGBoost model from {MODEL_PATH}")
            self.model = joblib.load(MODEL_PATH)
        else:
            print("🏗️ Training new XGBoost model...")
            self._train_on_mock_data()

    def _train_on_mock_data(self):
        """Train on synthetic labeled data (normal + malicious)."""
        np.random.seed(42)

        # Normal access patterns (label=0)
        n_normal = 800
        normal = np.column_stack([
            np.random.uniform(0.3, 0.8, n_normal),    # hour (business)
            np.random.uniform(0.0, 0.7, n_normal),     # day (weekdays)
            np.random.binomial(1, 0.7, n_normal),      # business_hours
            np.random.uniform(0.0, 0.1, n_normal),     # failed_logins
            np.random.binomial(1, 0.85, n_normal),     # ip_known
            np.zeros(n_normal),                          # ip_malicious
            np.zeros(n_normal),                          # ip_tor
            np.random.uniform(0.0, 0.2, n_normal),     # geo_distance
            np.random.binomial(1, 0.9, n_normal),      # device_trusted
            np.random.binomial(1, 0.8, n_normal),      # resource_typical
            np.random.binomial(1, 0.1, n_normal),      # ua_anomaly
            np.random.uniform(0.01, 0.3, n_normal),    # velocity
        ])
        normal_labels = np.zeros(n_normal)

        # Malicious access patterns (label=1)
        n_malicious = 200
        malicious = np.column_stack([
            np.random.uniform(0.0, 0.25, n_malicious),  # hour (unusual times)
            np.random.uniform(0.0, 1.0, n_malicious),    # day (any day)
            np.random.binomial(1, 0.2, n_malicious),     # business_hours (rarely)
            np.random.uniform(0.3, 1.0, n_malicious),    # failed_logins (high)
            np.random.binomial(1, 0.1, n_malicious),     # ip_known (rarely)
            np.random.binomial(1, 0.6, n_malicious),     # ip_malicious (often)
            np.random.binomial(1, 0.4, n_malicious),     # ip_tor (sometimes)
            np.random.uniform(0.5, 1.0, n_malicious),    # geo_distance (far)
            np.random.binomial(1, 0.1, n_malicious),     # device_trusted (rarely)
            np.random.binomial(1, 0.2, n_malicious),     # resource_typical (rarely)
            np.random.binomial(1, 0.8, n_malicious),     # ua_anomaly (often)
            np.random.uniform(0.5, 1.0, n_malicious),    # velocity (high)
        ])
        malicious_labels = np.ones(n_malicious)

        # Combine
        X = np.vstack([normal, malicious])
        y = np.concatenate([normal_labels, malicious_labels])

        # Shuffle
        indices = np.random.permutation(len(X))
        X, y = X[indices], y[indices]

        self.model = XGBClassifier(
            n_estimators=150,
            max_depth=6,
            learning_rate=0.1,
            eval_metric="logloss",
            random_state=42,
            use_label_encoder=False,
        )
        self.model.fit(X, y)

        # Save model
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump(self.model, MODEL_PATH)
        print(f"💾 XGBoost model saved to {MODEL_PATH}")

    def predict_threat_probability(self, features: list) -> float:
        """
        Predict the probability of a request being malicious.
        Returns: float (0-1, higher = more likely malicious)
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")

        features_array = np.array(features).reshape(1, -1)
        proba = self.model.predict_proba(features_array)[0]
        # Return probability of class 1 (malicious)
        return float(proba[1])
