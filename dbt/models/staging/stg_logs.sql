{{ config(materialized='table') }}

SELECT
  id,
  prompt,
  response,
  tokens,
  latency,
  model,
  LENGTH(response) as response_length,
  tokens / NULLIF(LENGTH(response), 0) as tokens_per_char,
  CURRENT_TIMESTAMP as processed_at
FROM {{ source('convex', 'logs') }}
WHERE created_at >= NOW() - INTERVAL '24 hours'
