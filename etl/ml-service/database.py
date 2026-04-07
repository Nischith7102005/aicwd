"""
Database operations for ML Red Team Service
"""

import asyncio
import asyncpg
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager, contextmanager
import json
from datetime import datetime

from config import db_config, service_config
from model import RiskPrediction


class DatabaseManager:
    """Manages database connections and operations"""
    
    def __init__(self):
        self.connection_string = db_config.get_connection_string()
        self.async_connection_string = db_config.get_async_connection_string()
        self.pool: Optional[asyncpg.Pool] = None
    
    async def init_pool(self):
        """Initialize async connection pool"""
        self.pool = await asyncpg.create_pool(
            self.async_connection_string,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
    
    async def close_pool(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
    
    @asynccontextmanager
    async def get_async_connection(self):
        """Get async database connection"""
        if not self.pool:
            await self.init_pool()
        async with self.pool.acquire() as conn:
            yield conn
    
    @contextmanager
    def get_sync_connection(self):
        """Get synchronous database connection"""
        conn = psycopg2.connect(self.connection_string)
        try:
            yield conn
        finally:
            conn.close()
    
    async def get_unprocessed_events(
        self, 
        limit: int = 10,
        max_retries: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Fetch raw events that don't have security metrics yet
        
        Uses a skip-locked approach for concurrent processing
        """
        query = """
        SELECT 
            rle.id,
            rle.timestamp,
            rle.prompt,
            rle.response,
            rle.input_tokens,
            rle.output_tokens,
            rle.latency_ms,
            rle.model,
            rle.provider,
            rle.config_id,
            rle.is_adversarial,
            rle.error,
            rle.bias_score,
            rle.hallucination_prob,
            rle.waste_index,
            rle.efficiency_ratio
        FROM raw_llm_events rle
        LEFT JOIN security_metrics sm ON rle.id = sm.raw_event_id
        WHERE sm.raw_event_id IS NULL
        ORDER BY rle.timestamp ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
        """
        
        for attempt in range(max_retries):
            try:
                async with self.get_async_connection() as conn:
                    rows = await conn.fetch(query, limit)
                    return [dict(row) for row in rows]
            except asyncpg.exceptions.LockNotAvailableError:
                if attempt < max_retries - 1:
                    await asyncio.sleep(0.1 * (attempt + 1))
                else:
                    raise
        return []
    
    async def insert_security_metrics(
        self, 
        raw_event_id: int,
        prediction: RiskPrediction
    ) -> bool:
        """Insert security metrics from ML prediction"""
        query = """
        INSERT INTO security_metrics (
            raw_event_id,
            session_id,
            injection_risk,
            leakage_risk,
            hallucination_risk,
            bias_risk,
            anomaly_risk,
            tool_misuse_risk,
            cri,
            cri_level,
            trust_level,
            action,
            matched_patterns,
            escalation_triggered,
            escalation_reason,
            computed_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        ON CONFLICT (raw_event_id) DO UPDATE SET
            injection_risk = EXCLUDED.injection_risk,
            leakage_risk = EXCLUDED.leakage_risk,
            hallucination_risk = EXCLUDED.hallucination_risk,
            bias_risk = EXCLUDED.bias_risk,
            anomaly_risk = EXCLUDED.anomaly_risk,
            tool_misuse_risk = EXCLUDED.tool_misuse_risk,
            cri = EXCLUDED.cri,
            cri_level = EXCLUDED.cri_level,
            trust_level = EXCLUDED.trust_level,
            action = EXCLUDED.action,
            matched_patterns = EXCLUDED.matched_patterns,
            escalation_triggered = EXCLUDED.escalation_triggered,
            escalation_reason = EXCLUDED.escalation_reason,
            computed_at = EXCLUDED.computed_at
        """
        
        data = prediction.to_dict()
        
        async with self.get_async_connection() as conn:
            await conn.execute(
                query,
                raw_event_id,
                None,  # session_id - can be derived from config_id if needed
                data["injection_risk"],
                data["leakage_risk"],
                data["hallucination_risk"],
                data["bias_risk"],
                data["anomaly_risk"],
                data["tool_misuse_risk"],
                data["cri"],
                data["cri_level"],
                data["trust_level"],
                data["action"],
                data["matched_patterns"],
                prediction.cri >= 0.5,  # escalation_triggered
                "CRI threshold exceeded" if prediction.cri >= 0.5 else None,
                datetime.utcnow()
            )
            return True
    
    async def get_training_data(
        self, 
        limit: int = 10000
    ) -> tuple[List[Dict], List[Dict]]:
        """
        Fetch labeled data for model training
        Returns (events, labels)
        """
        query = """
        SELECT 
            rle.id,
            rle.prompt,
            rle.response,
            rle.input_tokens,
            rle.output_tokens,
            rle.latency_ms,
            rle.model,
            rle.provider,
            rle.is_adversarial,
            rle.bias_score,
            sm.injection_risk,
            sm.leakage_risk,
            sm.hallucination_risk,
            sm.bias_risk,
            sm.anomaly_risk,
            sm.tool_misuse_risk,
            sm.cri,
            sm.cri_level
        FROM raw_llm_events rle
        INNER JOIN security_metrics sm ON rle.id = sm.raw_event_id
        WHERE sm.computed_at IS NOT NULL
        ORDER BY rle.timestamp DESC
        LIMIT $1
        """
        
        async with self.get_async_connection() as conn:
            rows = await conn.fetch(query, limit)
            
        events = []
        labels = []
        
        for row in rows:
            row_dict = dict(row)
            events.append({
                "id": row_dict["id"],
                "prompt": row_dict["prompt"],
                "response": row_dict["response"],
                "input_tokens": row_dict["input_tokens"],
                "output_tokens": row_dict["output_tokens"],
                "latency_ms": row_dict["latency_ms"],
                "model": row_dict["model"],
                "provider": row_dict["provider"],
                "is_adversarial": row_dict["is_adversarial"],
                "bias_score": row_dict["bias_score"],
            })
            labels.append({
                "injection_risk": row_dict["injection_risk"],
                "leakage_risk": row_dict["leakage_risk"],
                "hallucination_risk": row_dict["hallucination_risk"],
                "bias_risk": row_dict["bias_risk"],
                "anomaly_risk": row_dict["anomaly_risk"],
                "tool_misuse_risk": row_dict["tool_misuse_risk"],
                "cri": row_dict["cri"],
                "cri_level": row_dict["cri_level"],
            })
        
        return events, labels
    
    def disable_postgres_trigger(self) -> bool:
        """Disable the PostgreSQL trigger for fallback mode"""
        try:
            with self.get_sync_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        ALTER TABLE raw_llm_events 
                        DISABLE TRIGGER trg_red_team_analysis
                    """)
                    conn.commit()
                    print("PostgreSQL trigger disabled")
                    return True
        except Exception as e:
            print(f"Warning: Could not disable trigger: {e}")
            return False
    
    def enable_postgres_trigger(self) -> bool:
        """Re-enable the PostgreSQL trigger"""
        try:
            with self.get_sync_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        ALTER TABLE raw_llm_events 
                        ENABLE TRIGGER trg_red_team_analysis
                    """)
                    conn.commit()
                    print("PostgreSQL trigger enabled")
                    return True
        except Exception as e:
            print(f"Warning: Could not enable trigger: {e}")
            return False
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        queries = {
            "total_events": "SELECT COUNT(*) FROM raw_llm_events",
            "processed_events": "SELECT COUNT(*) FROM security_metrics",
            "pending_events": """
                SELECT COUNT(*) FROM raw_llm_events rle
                LEFT JOIN security_metrics sm ON rle.id = sm.raw_event_id
                WHERE sm.raw_event_id IS NULL
            """,
            "high_risk_events": """
                SELECT COUNT(*) FROM security_metrics WHERE cri >= 0.5
            """,
            "avg_processing_time": """
                SELECT AVG(EXTRACT(EPOCH FROM (computed_at - rle._loaded_at)) * 1000)
                FROM security_metrics sm
                JOIN raw_llm_events rle ON sm.raw_event_id = rle.id
                WHERE sm.computed_at > NOW() - INTERVAL '1 hour'
            """
        }
        
        stats = {}
        async with self.get_async_connection() as conn:
            for name, query in queries.items():
                try:
                    result = await conn.fetchval(query)
                    stats[name] = result or 0
                except Exception as e:
                    stats[name] = f"Error: {e}"
        
        return stats
    
    async def listen_for_events(self, callback):
        """Listen for PostgreSQL NOTIFY events (optional optimization)"""
        conn = await asyncpg.connect(self.async_connection_string)
        try:
            await conn.add_listener('new_llm_event', callback)
            print("Listening for database notifications...")
            while True:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            await conn.remove_listener('new_llm_event', callback)
            raise
        finally:
            await conn.close()


# Singleton instance
db_manager = DatabaseManager()
