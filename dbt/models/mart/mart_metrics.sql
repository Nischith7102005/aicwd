{{ config(materialized='table') }}

WITH logs_staging AS (
  SELECT * FROM {{ ref('stg_logs') }}
),
baseline AS (
  SELECT * FROM {{ ref('baseline_embeddings') }}
),
enriched AS (
  SELECT
    logs.id,
    logs.prompt,
    logs.response,
    logs.tokens,
    logs.latency,
    logs.tokens_per_char as token_efficiency,
    1.0 - (logs.response_length::float / logs.tokens) as semantic_drift,
    logs.latency as adversarial_stress,
    ((logs.tokens - logs.response_length) / NULLIF(logs.tokens, 0)) as fragility_score,
    DATE_TRUNC('5 minutes', logs.processed_at) as window_5m
  FROM logs_staging logs
)

SELECT
  window_5m,
  AVG(token_efficiency) as avg_token_efficiency,
  AVG(semantic_drift) as avg_semantic_drift,
  AVG(adversarial_stress) as avg_stress_latency,
  AVG(fragility_score) as avg_fragility,
  COUNT(*) as log_count,
  CURRENT_TIMESTAMP as metric_timestamp
FROM enriched
GROUP BY window_5m
ORDER BY window_5m DESC
