-- Normalize raw logs from Convex DB
WITH raw_logs AS (
    SELECT
        _id AS log_id,
        prompt,
        response,
        tokens,
        latency,
        model,
        created_at
    FROM {{ source('convex', 'logs') }}
)

SELECT
    log_id,
    prompt,
    response,
    CAST(tokens AS INT) AS tokens,
    CAST(latency AS FLOAT) AS latency_ms,
    model,
    TO_TIMESTAMP(created_at / 1000) AS created_at_ts,
    ROW_NUMBER() OVER (ORDER BY created_at) as row_num
FROM raw_logs
