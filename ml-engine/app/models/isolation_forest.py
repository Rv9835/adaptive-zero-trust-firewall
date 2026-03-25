"""
Isolation Forest — Unsupervised anomaly detection model.
Identifies outliers in access patterns without labeled data.
"""
import os
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest


MODEL_PATH = os.environ.get("MODEL_DIR", "/app/models") + "/isolation_forest.pkl"


class AnomalyDetector:
    """Isolation Forest-based anomaly detector for access pattern analysis."""

    def __init__(self):
        self.model: IsolationForest = None

    def load_or_train(self):
        """Load a pre-trained model or train from mock data."""
        if os.path.exists(MODEL_PATH):
            print(f"📂 Loading Isolation Forest from {MODEL_PATH}")
            self.model = joblib.load(MODEL_PATH)
        else:
            print("🏗️ Training new Isolation Forest model...")
            self._train_on_mock_data()

    def _train_on_mock_data(self):
        """Train on synthetic normal access patterns."""
        np.random.seed(42)
        n_samples = 1000

        # Generate normal access patterns (12 features)
        normal_data = np.column_stack([
            np.random.uniform(0.3, 0.8, n_samples),   # hour_norm (business hours)
            np.random.uniform(0.0, 0.7, n_samples),    # day_norm (weekdays)
            np.random.binomial(1, 0.7, n_samples),     # is_business_hours
            np.random.uniform(0.0, 0.1, n_samples),    # failed_logins (low)
            np.random.binomial(1, 0.85, n_samples),    # ip_known (mostly known)
            np.zeros(n_samples),                         # ip_malicious (never)
            np.zeros(n_samples),                         # ip_tor (never)
            np.random.uniform(0.0, 0.2, n_samples),    # geo_distance (close)
            np.random.binomial(1, 0.9, n_samples),     # device_trusted
            np.random.binomial(1, 0.8, n_samples),     # resource_typical
            np.random.binomial(1, 0.1, n_samples),     # ua_anomaly (rare)
            np.random.uniform(0.01, 0.3, n_samples),   # access_velocity (low)
        ])

        self.model = IsolationForest(
            n_estimators=200,
            contamination=0.05,
            max_samples="auto",
            random_state=42,
        )
        self.model.fit(normal_data)

        # Save model
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump(self.model, MODEL_PATH)
        print(f"💾 Isolation Forest saved to {MODEL_PATH}")

    def predict(self, features: list) -> float:
        """
        Score a single feature vector.
        Returns: anomaly score (-1 to 1, higher = more normal)
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")

        features_array = np.array(features).reshape(1, -1)
        # score_samples returns negative values for anomalies, positive for normal
        score = self.model.score_samples(features_array)[0]
        return float(score)

    def is_anomaly(self, features: list) -> bool:
        """Returns True if the feature vector is classified as anomalous."""
        if self.model is None:
            raise RuntimeError("Model not loaded")

        features_array = np.array(features).reshape(1, -1)
        prediction = self.model.predict(features_array)[0]
        return prediction == -1  # -1 = anomaly, 1 = normal
