{{
  config(
    materialized = 'table'
  )
}}

with events as (
    select * from {{ ref('stg_llm_events') }}
),

last_7_days as (
    select * from events
    where event_date >= current_date - interval '7 days'
),

provider_stats as (
    select
        provider,
        model,
        
        -- Counts
        count(*) as total_requests,
        count(distinct event_date) as active_days,
        
        -- Token efficiency
        avg(efficiency_ratio) as avg_efficiency,
        avg(input_tokens) as avg_input_tokens,
        avg(output_tokens) as avg_output_tokens,
        
        -- Cost
        sum(cost_usd) as total_cost,
        avg(cost_usd) as avg_cost_per_request,
        
        -- Speed
        avg(latency_ms) as avg_latency_ms,
        avg(tokens_per_second) as avg_throughput,
        
        -- Quality
        avg(semantic_drift) as avg_semantic_drift,
        avg(hallucination_prob) as avg_hallucination_prob,
        avg(censorship_score) as avg_censorship_score,
        avg(bias_score) as avg_bias_score,
        avg(waste_index) as avg_waste_index,
        
        -- Reliability
        round(
            sum(case when success then 1 else 0 end)::float / count(*) * 100,
            2
        ) as success_rate_pct,
        
        -- Recency
        max(event_timestamp) as last_used_at
        
    from last_7_days
    group by provider, model
),

ranked as (
    select
        *,
        -- Rank by waste index (lower is better)
        rank() over (order by avg_waste_index asc) as waste_rank,
        -- Rank by cost efficiency
        rank() over (order by avg_cost_per_request asc) as cost_rank,
        -- Rank by speed
        rank() over (order by avg_latency_ms asc) as speed_rank,
        -- Rank by quality (lower drift = better)
        rank() over (order by avg_semantic_drift asc) as quality_rank
    from provider_stats
)

select
    *,
    -- Overall score (lower is better)
    round((waste_rank + cost_rank + speed_rank + quality_rank) / 4.0, 1) as overall_rank,
    
    -- Recommendation
    case
        when waste_rank <= 2 and cost_rank <= 2 then 'Recommended for cost-efficiency'
        when quality_rank <= 2 then 'Recommended for quality'
        when speed_rank <= 2 then 'Recommended for speed'
        when waste_rank >= 5 then 'Consider alternatives - high waste'
        else 'Balanced option'
    end as recommendation
    
from ranked
order by overall_rank
