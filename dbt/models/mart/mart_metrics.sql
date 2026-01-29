-- Four materialized views/metrics
WITH staged_logs AS (
    SELECT * FROM {{ ref('stg_logs') }}
),

baselines AS (
    SELECT * FROM {{ ref('baseline_embeddings') }}
),

-- 1. token_efficiency: tokens / (semantic_payload_size)
token_efficiency_calc AS (
    SELECT
        created_at_ts,
        tokens,
        -- Simplified semantic payload size (length of response / 4)
        LENGTH(response) / 4.0 AS semantic_payload_size,
        tokens / NULLIF(LENGTH(response) / 4.0, 0) AS waste_ratio
    FROM staged_logs
),

-- 2. semantic_drift: measure how far model wandered (simulated logic)
semantic_drift_calc AS (
    SELECT
        l.created_at_ts,
        l.prompt,
        l.response,
        -- In reality, we'd use a UDF for cosine similarity
        -- Here we simulate it with a random variation around 0.9
        0.9 - (RANDOM() * 0.2) AS cosine_similarity
    FROM staged_logs l
),

-- 3. adversarial_stress: response_latency_under_attack / baseline_latency
adversarial_stress_calc AS (
    SELECT
        created_at_ts,
        latency_ms,
        AVG(latency_ms) OVER (PARTITION BY model ORDER BY created_at_ts ROWS BETWEEN 100 PRECEDING AND 1 PRECEDING) as avg_baseline_latency,
        latency_ms / NULLIF(AVG(latency_ms) OVER (PARTITION BY model ORDER BY created_at_ts ROWS BETWEEN 100 PRECEDING AND 1 PRECEDING), 0) as stress_multiplier
    FROM staged_logs
),

-- 4. fragility_score logic (aggregated)
metrics_joined AS (
    SELECT
        t.created_at_ts,
        t.waste_ratio as token_efficiency,
        s.cosine_similarity as semantic_drift,
        a.stress_multiplier as adversarial_stress,
        (t.waste_ratio - 1.0) * (1.0 - s.cosine_similarity) as cognitive_waste_index
    FROM token_efficiency_calc t
    JOIN semantic_drift_calc s ON t.created_at_ts = s.created_at_ts
    JOIN adversarial_stress_calc a ON t.created_at_ts = a.created_at_ts
)

SELECT
    DATE_TRUNC('minute', created_at_ts) as window_start,
    AVG(token_efficiency) as avg_token_efficiency,
    AVG(semantic_drift) as avg_semantic_drift,
    AVG(adversarial_stress) as avg_adversarial_stress,
    AVG(cognitive_waste_index) as avg_waste_index,
    CASE WHEN AVG(cognitive_waste_index) > 2.5 THEN TRUE ELSE FALSE END as anomaly_flag
FROM metrics_joined
GROUP BY 1
ORDER BY 1 DESC
