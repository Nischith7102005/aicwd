{{
  config(
    materialized = 'view'
  )
}}

with source as (
    select * from {{ source('raw_convex', 'raw_llm_events') }}
),

renamed as (
    select
        id,
        timestamp as event_timestamp,
        prompt,
        response,
        input_tokens,
        output_tokens,
        latency_ms,
        model,
        provider,
        config_id,
        is_adversarial,
        error,
        efficiency_ratio,
        waste_index,
        semantic_drift,
        hallucination_prob,
        censorship_score,
        bias_score,
        tokens_per_second,
        cost_usd,
        success,
        _loaded_at,
        
        -- Computed fields
        input_tokens + output_tokens as total_tokens,
        case 
            when latency_ms > 0 then (output_tokens::float / latency_ms) * 1000
            else 0
        end as tokens_per_sec_calc,
        
        -- Time-based fields for analysis
        date_trunc('hour', timestamp) as event_hour,
        date_trunc('day', timestamp) as event_date,
        extract(hour from timestamp) as event_hour_of_day,
        extract(dow from timestamp) as day_of_week
        
    from source
)

select * from renamed
