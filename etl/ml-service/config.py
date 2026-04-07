"""
Configuration for ML Red Team Service
"""

import os
from dataclasses import dataclass, field
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()


@dataclass
class DatabaseConfig:
    """Database connection configuration"""
    
    url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", ""))
    host: str = field(default_factory=lambda: os.getenv("PGHOST", "localhost"))
    port: int = field(default_factory=lambda: int(os.getenv("PGPORT", "5432")))
    database: str = field(default_factory=lambda: os.getenv("PGDATABASE", "monitr"))
    user: str = field(default_factory=lambda: os.getenv("PGUSER", "postgres"))
    password: str = field(default_factory=lambda: os.getenv("PGPASSWORD", ""))
    sslmode: str = field(default_factory=lambda: os.getenv("PGSSLMODE", "prefer"))
    
    def get_connection_string(self) -> str:
        """Get connection string for psycopg2"""
        if self.url:
            return self.url
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"
    
    def get_async_connection_string(self) -> str:
        """Get connection string for asyncpg"""
        base = self.get_connection_string()
        if self.sslmode == "require":
            base += "?ssl=require"
        return base


@dataclass
class ModelConfig:
    """ML Model configuration"""
    
    # Model paths
    model_dir: str = field(default_factory=lambda: os.getenv("MODEL_DIR", "./artifacts"))
    model_version: str = field(default_factory=lambda: os.getenv("MODEL_VERSION", "v1"))
    
    # Feature extraction
    use_embeddings: bool = field(default_factory=lambda: os.getenv("USE_EMBEDDINGS", "false").lower() == "true")
    embedding_model: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"))
    max_features: int = field(default_factory=lambda: int(os.getenv("MAX_FEATURES", "5000")))
    
    # Model hyperparameters
    n_estimators: int = field(default_factory=lambda: int(os.getenv("N_ESTIMATORS", "100")))
    max_depth: int = field(default_factory=lambda: int(os.getenv("MAX_DEPTH", "10")))
    learning_rate: float = field(default_factory=lambda: float(os.getenv("LEARNING_RATE", "0.1")))
    
    # Risk score weights (must sum to 1.0)
    risk_weights: Dict[str, float] = field(default_factory=lambda: {
        "injection_risk": 0.25,
        "leakage_risk": 0.20,
        "hallucination_risk": 0.15,
        "bias_risk": 0.10,
        "anomaly_risk": 0.15,
        "tool_misuse_risk": 0.15,
    })
    
    # CRI thresholds
    cri_thresholds: Dict[str, float] = field(default_factory=lambda: {
        "minimal": 0.15,
        "low": 0.35,
        "moderate": 0.55,
        "high": 0.75,
        "critical": 1.0,
    })


@dataclass
class ServiceConfig:
    """Service runtime configuration"""
    
    # Server
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    
    # Processing
    poll_interval: float = field(default_factory=lambda: float(os.getenv("POLL_INTERVAL", "2.0")))
    batch_size: int = field(default_factory=lambda: int(os.getenv("BATCH_SIZE", "10")))
    max_workers: int = field(default_factory=lambda: int(os.getenv("MAX_WORKERS", "4")))
    
    # Fallback
    enable_fallback: bool = field(default_factory=lambda: os.getenv("ENABLE_FALLBACK", "true").lower() == "true")
    
    # Logging
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    
    # Monitoring
    metrics_port: int = field(default_factory=lambda: int(os.getenv("METRICS_PORT", "9090")))


@dataclass
class TrainingConfig:
    """Model training configuration"""
    
    # Data
    training_data_query: str = field(default_factory=lambda: os.getenv(
        "TRAINING_QUERY",
        """
        SELECT 
            rle.*,
            sm.injection_risk,
            sm.leakage_risk,
            sm.hallucination_risk,
            sm.bias_risk,
            sm.anomaly_risk,
            sm.tool_misuse_risk,
            sm.cri,
            sm.cri_level
        FROM raw_llm_events rle
        LEFT JOIN security_metrics sm ON rle.id = sm.raw_event_id
        WHERE sm.computed_at IS NOT NULL
        ORDER BY rle.timestamp DESC
        LIMIT 10000
        """
    ))
    
    # Training params
    test_size: float = field(default_factory=lambda: float(os.getenv("TEST_SIZE", "0.2")))
    random_state: int = field(default_factory=lambda: int(os.getenv("RANDOM_STATE", "42")))
    
    # Augmentation
    synthetic_ratio: float = field(default_factory=lambda: float(os.getenv("SYNTHETIC_RATIO", "0.3")))


# Global config instances
db_config = DatabaseConfig()
model_config = ModelConfig()
service_config = ServiceConfig()
training_config = TrainingConfig()
