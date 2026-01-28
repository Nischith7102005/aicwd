-- Staging model: Raw log normalization
-- This model normalizes raw LLM interaction logs from Convex into a clean staging layer

with source_logs as (
    -- This would normally come from a raw CSV export from Convex
    -- For now, we'll structure the expected data format
    select
        cast(null as string) as log_id,
        cast(null as numeric) as timestamp,
        cast(null as string) as prompt,
        cast(null as string) as response,
        cast(null as string) as model,
        cast(null as numeric) as prompt_tokens,
        cast(null as numeric) as response_tokens,
        cast(null as numeric) as total_tokens,
        cast(null as numeric) as latency_ms,
        cast(null as string) as user_id,
        cast(null as string) as session_id,
        cast(null as string) as red_team_id,
        cast(null as string) as prompt_category,
        cast(null as numeric) as response_quality_score,
        cast(null as boolean) as refused
    union all
    select
        '',
        0,
        '',
        '',
        '',
        0,
        0,
        0,
        0,
        null,
        null,
        null,
        null,
        null,
        false
    limit 0
),

normalized_logs as (
    select
        -- Unique identifiers
        log_id,
        timestamp,
        
        -- LLM interaction content
        prompt,
        response,
        model,
        
        -- Token usage metrics
        prompt_tokens,
        response_tokens,
        total_tokens,
        
        -- Performance metrics
        latency_ms,
        latency_ms / 1000.0 as latency_seconds,
        
        -- Session and user metadata
        user_id,
        session_id,
        red_team_id,
        
        -- Prompt classification
        prompt_category,
        
        -- Quality metrics
        response_quality_score,
        refused,
        
        -- Derived metrics
        case 
            when total_tokens > 0 then prompt_tokens::float / total_tokens::float
            else null 
        end as prompt_token_ratio,
        
        case 
            when total_tokens > 0 then response_tokens::float / total_tokens::float
            else null 
        end as response_token_ratio,
        
        case 
            when latency_ms > 0 then total_tokens::float / latency_ms::float * 1000
            else null 
        end as tokens_per_second,
        
        -- Timestamp parsing
        from_unixtime(timestamp) as parsed_timestamp,
        date(from_unixtime(timestamp)) as log_date,
        hour(from_unixtime(timestamp)) as log_hour
        
    from source_logs
),

enriched_logs as (
    select
        *,
        -- Add semantic units calculation (simple heuristic based on sentences)
        length(regexp_replace(response, '[.!?]+', ' ')) as semantic_units_estimate,
        
        -- Add prompt complexity score (based on length and structure)
        length(prompt) / nullif(length(regexp_replace(prompt, '[^a-zA-Z]', '')), 0) as prompt_complexity_score,
        
        -- Add response verbosity ratio
        length(response)::float / nullif(length(prompt), 0) as verbosity_ratio,
        
        -- Session type classification
        case 
            when red_team_id is not null then 'red_team'
            when session_id is not null then 'production'
            else 'test'
        end as session_type
        
    from normalized_logs
)

select * from enriched_logs

-- Quality tests
-- {{ test("unique", "log_id") }}
-- {{ test("not_null", "timestamp") }}
-- {{ test("not_null", "prompt") }}
-- {{ test("not_null", "response") }}
-- {{ test("not_null", "model") }}
-- {{ test("not_null", "total_tokens") }}
-- {{ test("not_null", "latency_ms") }}
