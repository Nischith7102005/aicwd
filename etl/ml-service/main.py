"""
FastAPI application for ML Red Team Service
Provides HTTP endpoints for inference, training, and monitoring
"""

import asyncio
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import service_config, model_config, db_config
from features import feature_extractor
from model import RedTeamMLModel, RiskPrediction, model
from database import db_manager
from processor import processor, trainer


# ============================================================================
# Pydantic Models
# ============================================================================

class LLMEventInput(BaseModel):
    """Input for single event prediction"""
    prompt: str = Field(..., description="User prompt text")
    response: Optional[str] = Field(None, description="LLM response text")
    provider: str = Field("openai", description="LLM provider")
    model_name: str = Field("gpt-4", description="Model name", alias="model")
    latency_ms: int = Field(0, description="Request latency in ms")
    input_tokens: int = Field(0, description="Input token count")
    output_tokens: int = Field(0, description="Output token count")
    is_adversarial: bool = Field(False, description="Whether this is an adversarial test")
    
    class Config:
        populate_by_name = True


class RiskPredictionOutput(BaseModel):
    """Output from risk prediction"""
    injection_risk: float = Field(..., ge=0, le=1)
    leakage_risk: float = Field(..., ge=0, le=1)
    hallucination_risk: float = Field(..., ge=0, le=1)
    bias_risk: float = Field(..., ge=0, le=1)
    anomaly_risk: float = Field(..., ge=0, le=1)
    tool_misuse_risk: float = Field(..., ge=0, le=1)
    cri: float = Field(..., ge=0, le=1)
    cri_level: str
    trust_level: str
    action: str
    matched_patterns: List[Dict[str, Any]]
    model_version: str
    inference_time_ms: float


class BatchPredictionInput(BaseModel):
    """Input for batch prediction"""
    events: List[LLMEventInput]


class BatchPredictionOutput(BaseModel):
    """Output from batch prediction"""
    predictions: List[RiskPredictionOutput]
    total: int
    avg_inference_time_ms: float


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    model_version: str
    database_connected: bool
    timestamp: str


class StatsResponse(BaseModel):
    """Processing statistics"""
    total_processed: int
    total_errors: int
    avg_inference_time_ms: float
    events_per_second: float
    high_risk_detected: int
    database_stats: Dict[str, Any]


class FeatureImportanceResponse(BaseModel):
    """Feature importance from model"""
    model_version: str
    feature_importance: Dict[str, List[List[Any]]]


# ============================================================================
# FastAPI Application
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    print("Starting up ML Red Team Service...")
    
    # Initialize database pool
    await db_manager.init_pool()
    
    # Try to load existing model, or train with synthetic data
    model_loaded = False
    try:
        model.load()
        model_loaded = True
        print(f"Loaded model version: {model.version}")
    except FileNotFoundError:
        print("No existing model found. Training with synthetic data...")
        trainer.train_with_synthetic_data()
        model_loaded = True
    
    # Start background processing if enabled
    if service_config.poll_interval > 0:
        asyncio.create_task(processor.run())
    
    print("Service started successfully")
    
    yield
    
    # Shutdown
    print("Shutting down...")
    processor.running = False
    await db_manager.close_pool()
    print("Shutdown complete")


app = FastAPI(
    title="ML Red Team Security Service",
    description="ML-based security analysis for LLM interactions",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    db_connected = False
    try:
        # Quick DB check
        stats = await db_manager.get_stats()
        db_connected = True
    except:
        pass
    
    return HealthResponse(
        status="healthy" if model.is_fitted and db_connected else "degraded",
        model_loaded=model.is_fitted,
        model_version=model.version,
        database_connected=db_connected,
        timestamp=datetime.utcnow().isoformat()
    )


@app.post("/predict", response_model=RiskPredictionOutput)
async def predict(event: LLMEventInput):
    """Predict risk scores for a single LLM event"""
    if not model.is_fitted:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Extract features
    features = feature_extractor.extract_all_features(
        prompt=event.prompt,
        response=event.response,
        provider=event.provider,
        model=event.model_name,
        latency_ms=event.latency_ms,
        input_tokens=event.input_tokens,
        output_tokens=event.output_tokens,
        is_adversarial=event.is_adversarial,
    )
    
    # Predict
    prediction = model.predict(features)
    
    return RiskPredictionOutput(
        injection_risk=prediction.injection_risk,
        leakage_risk=prediction.leakage_risk,
        hallucination_risk=prediction.hallucination_risk,
        bias_risk=prediction.bias_risk,
        anomaly_risk=prediction.anomaly_risk,
        tool_misuse_risk=prediction.tool_misuse_risk,
        cri=prediction.cri,
        cri_level=prediction.cri_level,
        trust_level=prediction.trust_level,
        action=prediction.action,
        matched_patterns=prediction.matched_patterns,
        model_version=prediction.model_version,
        inference_time_ms=prediction.inference_time_ms
    )


@app.post("/predict/batch", response_model=BatchPredictionOutput)
async def predict_batch(batch: BatchPredictionInput):
    """Predict risk scores for a batch of LLM events"""
    if not model.is_fitted:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    predictions = []
    total_inference_time = 0.0
    
    for event in batch.events:
        features = feature_extractor.extract_all_features(
            prompt=event.prompt,
            response=event.response,
            provider=event.provider,
            model=event.model_name,
            latency_ms=event.latency_ms,
            input_tokens=event.input_tokens,
            output_tokens=event.output_tokens,
            is_adversarial=event.is_adversarial,
        )
        
        prediction = model.predict(features)
        total_inference_time += prediction.inference_time_ms
        
        predictions.append(RiskPredictionOutput(
            injection_risk=prediction.injection_risk,
            leakage_risk=prediction.leakage_risk,
            hallucination_risk=prediction.hallucination_risk,
            bias_risk=prediction.bias_risk,
            anomaly_risk=prediction.anomaly_risk,
            tool_misuse_risk=prediction.tool_misuse_risk,
            cri=prediction.cri,
            cri_level=prediction.cri_level,
            trust_level=prediction.trust_level,
            action=prediction.action,
            matched_patterns=prediction.matched_patterns,
            model_version=prediction.model_version,
            inference_time_ms=prediction.inference_time_ms
        ))
    
    return BatchPredictionOutput(
        predictions=predictions,
        total=len(predictions),
        avg_inference_time_ms=total_inference_time / len(predictions) if predictions else 0
    )


@app.post("/train")
async def train_model(background_tasks: BackgroundTasks, synthetic: bool = False):
    """Trigger model training"""
    if synthetic:
        background_tasks.add_task(trainer.train_with_synthetic_data)
        return {"message": "Synthetic training started in background"}
    else:
        background_tasks.add_task(trainer.train_from_database)
        return {"message": "Database training started in background"}


@app.get("/stats", response_model=StatsResponse)
async def get_stats():
    """Get processing statistics"""
    db_stats = await db_manager.get_stats()
    
    return StatsResponse(
        total_processed=processor.stats.total_processed,
        total_errors=processor.stats.total_errors,
        avg_inference_time_ms=processor.stats.avg_inference_time_ms,
        events_per_second=processor.stats.events_per_second,
        high_risk_detected=processor.stats.high_risk_detected,
        database_stats=db_stats
    )


@app.get("/features/importance", response_model=FeatureImportanceResponse)
async def get_feature_importance():
    """Get feature importance from the model"""
    if not model.is_fitted:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    importance = model.get_feature_importance()
    
    # Convert to JSON-serializable format
    serializable_importance = {}
    for risk, feats in importance.items():
        serializable_importance[risk] = [[name, float(imp)] for name, imp in feats]
    
    return FeatureImportanceResponse(
        model_version=model.version,
        feature_importance=serializable_importance
    )


@app.get("/config")
async def get_config():
    """Get current configuration (sanitized)"""
    return {
        "model": {
            "version": model_config.model_version,
            "use_embeddings": model_config.use_embeddings,
            "risk_weights": model_config.risk_weights,
        },
        "service": {
            "poll_interval": service_config.poll_interval,
            "batch_size": service_config.batch_size,
        },
        "database": {
            "host": db_config.host,
            "database": db_config.database,
        }
    }


@app.post("/process/once")
async def process_once():
    """Manually trigger one processing iteration"""
    processed = await processor.run_once()
    return {"processed": processed}


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=service_config.host,
        port=service_config.port,
        reload=False,
        workers=1
    )
