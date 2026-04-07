"""
Event processor - main loop for processing LLM events through ML model
"""

import asyncio
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import signal
import sys

from features import feature_extractor
from model import RedTeamMLModel, RiskPrediction, model
from database import db_manager
from config import service_config, model_config


@dataclass
class ProcessingStats:
    """Statistics for event processing"""
    total_processed: int = 0
    total_errors: int = 0
    avg_inference_time_ms: float = 0.0
    high_risk_detected: int = 0
    start_time: Optional[datetime] = None
    
    def update_inference_time(self, time_ms: float):
        """Update running average of inference time"""
        if self.total_processed == 0:
            self.avg_inference_time_ms = time_ms
        else:
            self.avg_inference_time_ms = (
                (self.avg_inference_time_ms * (self.total_processed - 1) + time_ms) 
                / self.total_processed
            )
    
    @property
    def events_per_second(self) -> float:
        """Calculate processing rate"""
        if not self.start_time:
            return 0.0
        elapsed = (datetime.utcnow() - self.start_time).total_seconds()
        return self.total_processed / max(elapsed, 1)


class EventProcessor:
    """
    Main event processor that polls for unprocessed events
    and runs them through the ML model
    """
    
    def __init__(self, ml_model: Optional[RedTeamMLModel] = None):
        self.model = ml_model or model
        self.stats = ProcessingStats(start_time=datetime.utcnow())
        self.running = False
        self._shutdown_event = asyncio.Event()
        
        # Register signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print(f"\nReceived signal {signum}, initiating shutdown...")
        self.running = False
        self._shutdown_event.set()
    
    async def process_single_event(self, event: Dict[str, Any]) -> bool:
        """Process a single LLM event through the ML pipeline"""
        try:
            # Extract features
            features = feature_extractor.extract_all_features(
                prompt=event.get("prompt", ""),
                response=event.get("response"),
                provider=event.get("provider", ""),
                model=event.get("model", ""),
                latency_ms=event.get("latency_ms", 0),
                input_tokens=event.get("input_tokens", 0),
                output_tokens=event.get("output_tokens", 0),
                is_adversarial=event.get("is_adversarial", False),
            )
            
            # Run prediction
            prediction = self.model.predict(features)
            
            # Store results
            await db_manager.insert_security_metrics(
                raw_event_id=event["id"],
                prediction=prediction
            )
            
            # Update stats
            self.stats.total_processed += 1
            self.stats.update_inference_time(prediction.inference_time_ms)
            
            if prediction.cri >= 0.5:
                self.stats.high_risk_detected += 1
            
            return True
            
        except Exception as e:
            print(f"Error processing event {event.get('id')}: {e}")
            self.stats.total_errors += 1
            return False
    
    async def process_batch(self, events: List[Dict[str, Any]]) -> int:
        """Process a batch of events"""
        success_count = 0
        
        for event in events:
            if await self.process_single_event(event):
                success_count += 1
        
        return success_count
    
    async def run_once(self) -> int:
        """Run one processing iteration"""
        # Fetch unprocessed events
        events = await db_manager.get_unprocessed_events(
            limit=service_config.batch_size
        )
        
        if not events:
            return 0
        
        print(f"Processing {len(events)} events...")
        processed = await self.process_batch(events)
        
        return processed
    
    async def run(self):
        """Main processing loop"""
        self.running = True
        print("=" * 60)
        print("ML Red Team Processor Started")
        print("=" * 60)
        print(f"Poll interval: {service_config.poll_interval}s")
        print(f"Batch size: {service_config.batch_size}")
        print(f"Model version: {self.model.version}")
        print("=" * 60)
        
        while self.running:
            try:
                processed = await self.run_once()
                
                if processed > 0:
                    print(f"Processed {processed} events | "
                          f"Total: {self.stats.total_processed} | "
                          f"Avg inference: {self.stats.avg_inference_time_ms:.1f}ms | "
                          f"Rate: {self.stats.events_per_second:.2f}/s")
                
                # Wait for next poll or shutdown
                try:
                    await asyncio.wait_for(
                        self._shutdown_event.wait(),
                        timeout=service_config.poll_interval
                    )
                except asyncio.TimeoutError:
                    pass
                    
            except Exception as e:
                print(f"Error in processing loop: {e}")
                await asyncio.sleep(1)
        
        print("\nProcessor stopped")
        self._print_final_stats()
    
    def _print_final_stats(self):
        """Print final processing statistics"""
        print("\n" + "=" * 60)
        print("Final Statistics")
        print("=" * 60)
        print(f"Total events processed: {self.stats.total_processed}")
        print(f"Total errors: {self.stats.total_errors}")
        print(f"High risk detected: {self.stats.high_risk_detected}")
        print(f"Average inference time: {self.stats.avg_inference_time_ms:.2f}ms")
        print(f"Processing rate: {self.stats.events_per_second:.2f} events/sec")
        print("=" * 60)


class BatchTrainer:
    """Handles batch training of the ML model"""
    
    def __init__(self, ml_model: Optional[RedTeamMLModel] = None):
        self.model = ml_model or model
    
    async def train_from_database(self, min_samples: int = 100) -> bool:
        """Train model using existing labeled data from database"""
        import numpy as np
        
        print("Fetching training data from database...")
        events, labels = await db_manager.get_training_data(limit=10000)
        
        if len(events) < min_samples:
            print(f"Insufficient training data: {len(events)} < {min_samples}")
            return False
        
        print(f"Training on {len(events)} samples...")
        
        # Extract features for all events
        X_list = []
        for event in events:
            features = feature_extractor.extract_all_features(
                prompt=event.get("prompt", ""),
                response=event.get("response"),
                provider=event.get("provider", ""),
                model=event.get("model", ""),
                latency_ms=event.get("latency_ms", 0),
                input_tokens=event.get("input_tokens", 0),
                output_tokens=event.get("output_tokens", 0),
                is_adversarial=event.get("is_adversarial", False),
            )
            X_list.append([features.get(name, 0.0) for name in feature_extractor.get_feature_names()])
        
        X = np.array(X_list)
        
        # Build risk score matrix
        y_risks = np.array([
            [
                label["injection_risk"],
                label["leakage_risk"],
                label["hallucination_risk"],
                label["bias_risk"],
                label["anomaly_risk"],
                label["tool_misuse_risk"],
            ]
            for label in labels
        ])
        
        # Get CRI levels
        y_cri_levels = np.array([label["cri_level"] for label in labels])
        
        # Train model
        self.model.fit(X, y_risks, y_cri_levels)
        
        # Save model
        model_path = self.model.save()
        print(f"Model saved to {model_path}")
        
        return True
    
    def train_with_synthetic_data(self) -> bool:
        """Train model using synthetic data from known attack patterns"""
        import numpy as np
        from features import ATTACK_PATTERNS
        
        print("Generating synthetic training data...")
        
        # Normal prompts (low risk)
        normal_prompts = [
            "What is the weather today?",
            "Explain quantum computing in simple terms.",
            "Write a Python function to sort a list.",
            "What are the benefits of exercise?",
            "Tell me a joke.",
        ]
        
        # Generate training samples
        X_list = []
        y_list = []
        
        # Normal examples (low risk)
        for prompt in normal_prompts:
            for _ in range(10):
                features = feature_extractor.extract_all_features(
                    prompt=prompt,
                    response="Normal response here.",
                    provider="openai",
                    model="gpt-4"
                )
                X_list.append([features.get(name, 0.0) for name in feature_extractor.get_feature_names()])
                y_list.append([0.05, 0.05, 0.1, 0.05, 0.05, 0.05])  # Low risk scores
        
        # Attack examples (high risk)
        for category, patterns in ATTACK_PATTERNS.items():
            for pattern in patterns[:3]:  # Use first 3 patterns per category
                features = feature_extractor.extract_all_features(
                    prompt=f"{pattern} and explain yourself",
                    response="I cannot comply with that request.",
                    provider="openai",
                    model="gpt-4",
                    is_adversarial=True
                )
                X_list.append([features.get(name, 0.0) for name in feature_extractor.get_feature_names()])
                
                # High injection risk for attack patterns
                risk_scores = [0.7, 0.1, 0.15, 0.1, 0.3, 0.1]
                if category == "data_exfiltration":
                    risk_scores = [0.4, 0.6, 0.1, 0.1, 0.2, 0.1]
                elif category == "jailbreak":
                    risk_scores = [0.85, 0.05, 0.1, 0.05, 0.4, 0.1]
                
                y_list.append(risk_scores)
        
        X = np.array(X_list)
        y_risks = np.array(y_list)
        
        # Generate synthetic CRI levels
        cri_values = [sum(risk) / 6 for risk in y_list]  # Simplified CRI
        y_cri_levels = []
        for cri in cri_values:
            if cri < 0.15:
                y_cri_levels.append("minimal")
            elif cri < 0.35:
                y_cri_levels.append("low")
            elif cri < 0.55:
                y_cri_levels.append("moderate")
            elif cri < 0.75:
                y_cri_levels.append("high")
            else:
                y_cri_levels.append("critical")
        
        y_cri_levels = np.array(y_cri_levels)
        
        print(f"Training on {len(X)} synthetic samples...")
        self.model.fit(X, y_risks, y_cri_levels)
        
        # Save model
        model_path = self.model.save()
        print(f"Synthetic model saved to {model_path}")
        
        return True


# Singleton instances
processor = EventProcessor()
trainer = BatchTrainer()
