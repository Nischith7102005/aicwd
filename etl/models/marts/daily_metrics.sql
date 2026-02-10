{{
  config(
    materialized = 'table'
  )
}}

with events as (
    select * from {{ ref('stg_llm_events') }}
),

daily_stats as (
    select
        event_date,
        provider,
        model,
        
        -- Volume metrics
        count(*) as total_requests,
        sum(case when success then 1 else 0 end) as successful_requests,
        sum(case when not success then 1 else 0 end) as failed_requests,
        
        -- Token metrics
        sum(input_tokens) as total_input_tokens,
        sum(output_tokens) as total_output_tokens,
        sum(total_tokens) as total_tokens,
        avg(total_tokens) as avg_tokens_per_request,
        
        -- Cost metrics
        sum(cost_usd) as total_cost_usd,
        avg(cost_usd) as avg_cost_per_request,
        
        -- Performance metrics
        avg(latency_ms) as avg_latency_ms,
        percentile_cont(0.5) within group (order by latency_ms) as p50_latency_ms,
        percentile_cont(0.95) within group (order by latency_ms) as p95_latency_ms,
        percentile_cont(0.99) within group (order by latency_ms) as p99_latency_ms,
        avg(tokens_per_second) as avg_tokens_per_second,
        
        -- Quality metrics
        avg(efficiency_ratio) as avg_efficiency_ratio,
        avg(waste_index) as avg_waste_index,
        avg(semantic_drift) as avg_semantic_drift,
        avg(hallucination_prob) as avg_hallucination_prob,
        avg(censorship_score) as avg_censorship_score,
        avg(bias_score) as avg_bias_score,
        
        -- Success rate
        round(
            sum(case when success then 1 else 0 end)::float / count(*) * 100, 
            2
        ) as success_rate_pct,
        
        -- Adversarial test count
        sum(case when is_adversarial then 1 else 0 end) as adversarial_tests
        
    from events
    group by event_date, provider, model
)

select 
    *,
    -- Derived metrics
    case 
        when avg_waste_index < 0.3 then 'low'
        when avg_waste_index < 0.6 then 'medium'
        else 'high'
    end as waste_level,
    case 
        when avg_hallucination_prob < 0.05 then 'low'
        when avg_hallucination_prob < 0.15 then 'medium'
        else 'high'
    end as hallucination_risk_level
from daily_stats
order by event_date desc, total_requests desc
