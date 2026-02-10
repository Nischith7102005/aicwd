{{
  config(
    materialized = 'table',
    description = 'Comprehensive Cognitive Waste Index aggregating efficiency, semantic drift, and quality metrics'
  )
}}

with events as (
    select * from {{ ref('stg_llm_events') }}
),

efficiency_metrics as (
    select
        event_date,
        provider,
        model,
        
        -- Token efficiency
        sum(input_tokens) as total_input,
        sum(output_tokens) as total_output,
        avg(efficiency_ratio) as avg_efficiency,
        
        -- Quality indicators
        avg(semantic_drift) as avg_semantic_drift,
        avg(hallucination_prob) as avg_hallucination_risk,
        avg(censorship_score) as avg_censorship,
        avg(bias_score) as avg_bias,
        
        -- Performance
        avg(latency_ms) as avg_latency,
        sum(cost_usd) as total_cost,
        count(*) as request_count
        
    from events
    where success = true
    group by event_date, provider, model
),

waste_calculation as (
    select
        *,
        
        -- Component scores (0-1, higher = more waste)
        -- Efficiency component: lower efficiency = higher waste
        case 
            when avg_efficiency > 0 then 1 - least(avg_efficiency, 1)
            else 0.5
        end as efficiency_waste,
        
        -- Semantic component: higher drift = higher waste
        coalesce(avg_semantic_drift, 0) as semantic_waste,
        
        -- Quality component: combine hallucination, censorship, bias
        coalesce(
            (avg_hallucination_risk * 0.5 + 
             avg_censorship * 0.25 + 
             avg_bias * 0.25), 
            0
        ) as quality_waste,
        
        -- Latency component: higher latency = higher waste (normalized)
        case 
            when avg_latency < 500 then 0
            when avg_latency < 2000 then 0.2
            when avg_latency < 5000 then 0.5
            else 0.8
        end as latency_waste
        
    from efficiency_metrics
),

final_index as (
    select
        event_date,
        provider,
        model,
        
        request_count,
        total_input,
        total_output,
        total_cost,
        avg_latency,
        
        efficiency_waste,
        semantic_waste,
        quality_waste,
        latency_waste,
        
        -- Weighted Cognitive Waste Index
        round(
            (efficiency_waste * 0.35 + 
             semantic_waste * 0.30 + 
             quality_waste * 0.25 + 
             latency_waste * 0.10),
            4
        ) as cognitive_waste_index,
        
        -- Grade classification
        case 
            when (efficiency_waste * 0.35 + semantic_waste * 0.30 + quality_waste * 0.25 + latency_waste * 0.10) < 0.2 then 'A'
            when (efficiency_waste * 0.35 + semantic_waste * 0.30 + quality_waste * 0.25 + latency_waste * 0.10) < 0.4 then 'B'
            when (efficiency_waste * 0.35 + semantic_waste * 0.30 + quality_waste * 0.25 + latency_waste * 0.10) < 0.6 then 'C'
            when (efficiency_waste * 0.35 + semantic_waste * 0.30 + quality_waste * 0.25 + latency_waste * 0.10) < 0.8 then 'D'
            else 'F'
        end as waste_grade,
        
        -- Recommendations
        case 
            when efficiency_waste > 0.6 then 'Review prompt engineering - high input/output waste'
            when semantic_waste > 0.6 then 'Investigate response quality - high semantic drift'
            when quality_waste > 0.4 then 'Review model outputs for hallucinations/bias'
            when latency_waste > 0.5 then 'Consider model optimization or caching'
            else 'Performance within acceptable parameters'
        end as recommendation
        
    from waste_calculation
)

select * from final_index
order by event_date desc, cognitive_waste_index desc
