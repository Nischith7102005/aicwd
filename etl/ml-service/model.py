"""
ML Model for Red Team Security Analysis
Multi-output regression for risk scores + classifier for CRI level
"""

import os
import json
import joblib
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import warnings

warnings.filterwarnings("ignore")

from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.multioutput import MultiOutputRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.feature_extraction.text import TfidfVectorizer
import xgboost as xgb

from features import feature_extractor, FeatureExtractor
from config import model_config, ModelConfig


@dataclass
class RiskPrediction:
    """Prediction output for a single LLM event"""
    
    # Risk scores (0-1)
    injection_risk: float = 0.0
    leakage_risk: float = 0.0
    hallucination_risk: float = 0.0
    bias_risk: float = 0.0
    anomaly_risk: float = 0.0
    tool_misuse_risk: float = 0.0
    
    # Computed CRI
    cri: float = 0.0
    cri_level: str = "minimal"
    trust_level: str = "full"
    action: str = "allow"
    
    # Metadata
    matched_patterns: List[Dict] = None
    model_version: str = ""
    inference_time_ms: float = 0.0
    
    def __post_init__(self):
        if self.matched_patterns is None:
            self.matched_patterns = []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database insertion"""
        return {
            "injection_risk": round(self.injection_risk, 4),
            "leakage_risk": round(self.leakage_risk, 4),
            "hallucination_risk": round(self.hallucination_risk, 4),
            "bias_risk": round(self.bias_risk, 4),
            "anomaly_risk": round(self.anomaly_risk, 4),
            "tool_misuse_risk": round(self.tool_misuse_risk, 4),
            "cri": round(self.cri, 4),
            "cri_level": self.cri_level,
            "trust_level": self.trust_level,
            "action": self.action,
            "matched_patterns": json.dumps(self.matched_patterns),
            "model_version": self.model_version,
        }


class RedTeamMLModel:
    """
    ML-based Red Team security analysis model
    
    Replaces PostgreSQL function-based algorithm with:
    - Multi-output regression for 6 risk scores
    - Classifier for CRI level prediction
    - Feature-based pattern detection
    """
    
    RISK_NAMES = [
        "injection_risk",
        "leakage_risk", 
        "hallucination_risk",
        "bias_risk",
        "anomaly_risk",
        "tool_misuse_risk"
    ]
    
    CRI_LEVELS = ["minimal", "low", "moderate", "high", "critical"]
    
    def __init__(self, config: Optional[ModelConfig] = None):
        self.config = config or model_config
        self.feature_extractor = FeatureExtractor()
        
        # Models (initialized as None, loaded in load() or fit())
        self.risk_regressor: Optional[Any] = None
        self.cri_classifier: Optional[Any] = None
        self.scaler: Optional[StandardScaler] = None
        self.label_encoder: Optional[LabelEncoder] = None
        
        # Feature metadata
        self.feature_names: List[str] = []
        self.is_fitted: bool = False
        
        # Model versioning
        self.version = self.config.model_version
        self.trained_at: Optional[str] = None
    
    def _compute_cri(self, risk_scores: np.ndarray) -> float:
        """Compute CRI from risk scores using weighted sum"""
        weights = np.array([
            self.config.risk_weights["injection_risk"],
            self.config.risk_weights["leakage_risk"],
            self.config.risk_weights["hallucination_risk"],
            self.config.risk_weights["bias_risk"],
            self.config.risk_weights["anomaly_risk"],
            self.config.risk_weights["tool_misuse_risk"],
        ])
        return float(np.dot(risk_scores, weights))
    
    def _get_cri_level(self, cri: float) -> str:
        """Determine CRI level from score"""
        thresholds = self.config.cri_thresholds
        if cri < thresholds["minimal"]:
            return "minimal"
        elif cri < thresholds["low"]:
            return "low"
        elif cri < thresholds["moderate"]:
            return "moderate"
        elif cri < thresholds["high"]:
            return "high"
        else:
            return "critical"
    
    def _get_trust_level(self, cri: float) -> str:
        """Determine trust level from CRI"""
        if cri < 0.25:
            return "full"
        elif cri < 0.50:
            return "restricted"
        elif cri < 0.75:
            return "minimal"
        else:
            return "revoked"
    
    def _get_action(self, cri: float) -> str:
        """Determine action from CRI"""
        if cri >= 0.75:
            return "block"
        elif cri >= 0.50:
            return "restrict"
        elif cri >= 0.20:
            return "warn"
        else:
            return "allow"
    
    def _extract_matched_patterns(self, features: Dict[str, Any]) -> List[Dict]:
        """Extract pattern matches from features for explainability"""
        patterns = []
        
        # Check attack pattern features
        for key, value in features.items():
            if key.startswith("pattern_") and key.endswith("_binary") and value > 0.5:
                category = key.replace("pattern_", "").replace("_binary", "")
                patterns.append({
                    "type": category,
                    "pattern": f"ML_DETECTED_{category.upper()}",
                    "severity": "high" if features.get(f"pattern_{category}", 0) > 1 else "medium",
                    "confidence": value
                })
        
        # Check leakage indicators
        for key, value in features.items():
            if key.startswith("leak_") and value > 0.5:
                leak_type = key.replace("leak_", "")
                patterns.append({
                    "type": "data_leakage",
                    "pattern": f"potential_{leak_type}_leakage",
                    "severity": "high",
                    "confidence": value
                })
        
        return patterns
    
    def _build_model(self):
        """Initialize model architecture"""
        # Use XGBoost for better performance
        base_regressor = xgb.XGBRegressor(
            n_estimators=self.config.n_estimators,
            max_depth=self.config.max_depth,
            learning_rate=self.config.learning_rate,
            objective='reg:squarederror',
            random_state=42,
            n_jobs=-1
        )
        
        self.risk_regressor = MultiOutputRegressor(base_regressor)
        
        self.cri_classifier = xgb.XGBClassifier(
            n_estimators=self.config.n_estimators,
            max_depth=self.config.max_depth,
            learning_rate=self.config.learning_rate,
            objective='multi:softprob',
            num_class=5,
            random_state=42,
            n_jobs=-1
        )
        
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
    
    def fit(
        self, 
        X: np.ndarray, 
        y_risks: np.ndarray,
        y_cri_levels: Optional[np.ndarray] = None
    ) -> 'RedTeamMLModel':
        """
        Train the model on labeled data
        
        Args:
            X: Feature matrix (n_samples, n_features)
            y_risks: Risk scores (n_samples, 6) - [injection, leakage, hallucination, bias, anomaly, tool_misuse]
            y_cri_levels: Optional CRI level labels (n_samples,)
        """
        print(f"Training model on {X.shape[0]} samples with {X.shape[1]} features...")
        
        self._build_model()
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train risk regressor
        print("Training risk score regressor...")
        self.risk_regressor.fit(X_scaled, y_risks)
        
        # Train CRI classifier (or derive from risk scores)
        if y_cri_levels is not None:
            print("Training CRI level classifier...")
            y_encoded = self.label_encoder.fit_transform(y_cri_levels)
            self.cri_classifier.fit(X_scaled, y_encoded)
        
        self.is_fitted = True
        self.trained_at = datetime.utcnow().isoformat()
        self.feature_names = self.feature_extractor.get_feature_names()
        
        print(f"Model training complete. Version: {self.version}")
        return self
    
    def predict(self, features: Dict[str, Any]) -> RiskPrediction:
        """
        Predict risk scores and CRI for a single event
        
        Args:
            features: Dictionary of extracted features
            
        Returns:
            RiskPrediction with all scores and metadata
        """
        import time
        start_time = time.time()
        
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before prediction")
        
        # Convert features to array
        feature_array = np.array([[features.get(name, 0.0) for name in self.feature_names]])
        
        # Scale
        X_scaled = self.scaler.transform(feature_array)
        
        # Predict risk scores
        risk_scores = self.risk_regressor.predict(X_scaled)[0]
        risk_scores = np.clip(risk_scores, 0.0, 1.0)  # Ensure 0-1 range
        
        # Compute CRI
        cri = self._compute_cri(risk_scores)
        
        # Get CRI level (from classifier if available, else from thresholds)
        if self.cri_classifier is not None:
            cri_level_encoded = self.cri_classifier.predict(X_scaled)[0]
            cri_level = self.label_encoder.inverse_transform([cri_level_encoded])[0]
        else:
            cri_level = self._get_cri_level(cri)
        
        inference_time = (time.time() - start_time) * 1000
        
        # Build prediction
        prediction = RiskPrediction(
            injection_risk=float(risk_scores[0]),
            leakage_risk=float(risk_scores[1]),
            hallucination_risk=float(risk_scores[2]),
            bias_risk=float(risk_scores[3]),
            anomaly_risk=float(risk_scores[4]),
            tool_misuse_risk=float(risk_scores[5]),
            cri=cri,
            cri_level=cri_level,
            trust_level=self._get_trust_level(cri),
            action=self._get_action(cri),
            matched_patterns=self._extract_matched_patterns(features),
            model_version=self.version,
            inference_time_ms=inference_time
        )
        
        return prediction
    
    def predict_batch(self, features_list: List[Dict[str, Any]]) -> List[RiskPrediction]:
        """Predict for a batch of events"""
        return [self.predict(features) for features in features_list]
    
    def save(self, path: Optional[str] = None) -> str:
        """Save model to disk"""
        save_path = path or os.path.join(self.config.model_dir, f"model_{self.version}.joblib")
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        model_data = {
            "risk_regressor": self.risk_regressor,
            "cri_classifier": self.cri_classifier,
            "scaler": self.scaler,
            "label_encoder": self.label_encoder,
            "feature_names": self.feature_names,
            "version": self.version,
            "trained_at": self.trained_at,
            "config": asdict(self.config)
        }
        
        joblib.dump(model_data, save_path)
        print(f"Model saved to {save_path}")
        return save_path
    
    def load(self, path: Optional[str] = None) -> 'RedTeamMLModel':
        """Load model from disk"""
        load_path = path or os.path.join(self.config.model_dir, f"model_{self.version}.joblib")
        
        if not os.path.exists(load_path):
            raise FileNotFoundError(f"Model file not found: {load_path}")
        
        model_data = joblib.load(load_path)
        
        self.risk_regressor = model_data["risk_regressor"]
        self.cri_classifier = model_data.get("cri_classifier")
        self.scaler = model_data["scaler"]
        self.label_encoder = model_data.get("label_encoder")
        self.feature_names = model_data.get("feature_names", [])
        self.version = model_data.get("version", self.version)
        self.trained_at = model_data.get("trained_at")
        self.is_fitted = True
        
        print(f"Model loaded from {load_path} (version: {self.version})")
        return self
    
    def get_feature_importance(self) -> Dict[str, List[Tuple[str, float]]]:
        """Get feature importance for each risk type"""
        if not self.is_fitted:
            return {}
        
        importance = {}
        for i, risk_name in enumerate(self.RISK_NAMES):
            estimator = self.risk_regressor.estimators_[i]
            if hasattr(estimator, 'feature_importances_'):
                feats = list(zip(self.feature_names, estimator.feature_importances_))
                feats.sort(key=lambda x: x[1], reverse=True)
                importance[risk_name] = feats[:20]  # Top 20 features
        
        return importance


# Singleton instance
model = RedTeamMLModel()
