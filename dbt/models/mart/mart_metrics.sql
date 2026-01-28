-- Mart layer: Materialized views for cognitive waste metrics
-- This model creates the key metrics used by the AICWD dashboard

-- Token Efficiency View: Tokens per semantic unit
create or replace materialized view mart_token_efficiency as
with stg_logs as (
    select * from {{ ref('stg_logs') }}
),
token_metrics as (
    select
        log_id,
        timestamp,
        model,
        prompt_tokens,
        response_tokens,
        total_tokens,
        
        -- Calculate semantic units (sentence count as proxy)
        array_length(regexp_split_to_array(response, E'[.!?]+'), 1) as semantic_units,
        
        -- Calculate token efficiency
        case 
            when semantic_units > 0 then total_tokens::float / semantic_units
            else null 
        end as tokens_per_semantic_unit,
        
        -- Efficiency score (inverse of waste)
        case 
            when semantic_units > 0 then semantic_units::float / total_tokens
            else null 
        end as efficiency_score,
        
        -- Prompt efficiency
        case 
            when prompt_tokens > 0 then length(prompt)::float / prompt_tokens
            else null 
        end as prompt_character_efficiency,
        
        -- Response efficiency
        case 
            when response_tokens > 0 then length(response)::float / response_tokens
            else null 
        end as response_character_efficiency
        
    from stg_logs
),
efficiency_stats as (
    select
        model,
        avg(tokens_per_semantic_unit) as avg_tokens_per_unit,
        avg(efficiency_score) as avg_efficiency_score,
        percentile_cont(0.5) within group (order by tokens_per_semantic_unit) as median_tokens_per_unit,
        percentile_cont(0.95) within group (order by tokens_per_semantic_unit) as p95_tokens_per_unit,
        count(*) as total_interactions
    from token_metrics
    group by model
)
select
    tm.log_id,
    tm.timestamp,
    tm.model,
    tm.tokens_per_semantic_unit,
    tm.efficiency_score,
    tm.prompt_character_efficiency,
    tm.response_character_efficiency,
    es.avg_tokens_per_unit as model_avg_tokens,
    es.avg_efficiency_score as model_avg_efficiency,
    tm.tokens_per_semantic_unit - es.avg_tokens_per_unit as efficiency_delta,
    case 
        when tm.tokens_per_semantic_unit > es.p95_tokens_per_unit then 'high_waste'
        when tm.tokens_per_semantic_unit < es.avg_tokens_per_unit then 'efficient'
        else 'normal'
    end as efficiency_category,
    tm.prompt_tokens,
    tm.response_tokens,
    tm.total_tokens
from token_metrics tm
join efficiency_stats es on tm.model = es.model;

-- Semantic Drift View: Embedding deviation from baseline
create or replace materialized view mart_semantic_drift as
with stg_logs as (
    select * from {{ ref('stg_logs') }}
),
baseline_embeddings as (
    -- This would join with the baseline embeddings seed
    select
        category,
        prompt as baseline_prompt,
        embedding as baseline_embedding,
        created_at
    from baseline_embeddings
),
log_embeddings as (
    select
        log_id,
        timestamp,
        prompt,
        response,
        model,
        prompt_category,
        -- Simulated embedding drift calculation
        random() as embedding_drift_score,
        length(prompt) / 1000.0 as prompt_embedding_norm,
        length(response) / 1000.0 as response_embedding_norm,
        session_type
    from stg_logs
),
drift_metrics as (
    select
        le.log_id,
        le.timestamp,
        le.model,
        le.prompt_category,
        le.embedding_drift_score,
        le.prompt_embedding_norm,
        le.response_embedding_norm,
        
        -- Calculate semantic coherence
        case 
            when le.prompt_embedding_norm > 0 then le.response_embedding_norm / le.prompt_embedding_norm
            else null 
        end as semantic_coherence_ratio,
        
        -- Aggregate drift for the time window
        avg(le.embedding_drift_score) over (
            partition by le.model 
            order by le.timestamp 
            rows between 9 preceding and current row
        ) as rolling_avg_drift_10,
        
        stddev(le.embedding_drift_score) over (
            partition by le.model 
            order by le.timestamp 
            rows between 29 preceding and current row
        ) as rolling_stddev_drift_30,
        
        -- Drift velocity (change over time)
        le.embedding_drift_score - lag(le.embedding_drift_score) over (
            partition by le.model 
            order by le.timestamp
        ) as drift_velocity,
        
        le.session_type
        
    from log_embeddings le
),
drift_classifications as (
    select
        *,
        case 
            when embedding_drift_score > 0.7 then 'critical'
            when embedding_drift_score > 0.5 then 'high'
            when embedding_drift_score > 0.3 then 'moderate'
            when embedding_drift_score > 0.1 then 'low'
            else 'minimal'
        end as drift_level,
        
        case 
            when abs(drift_velocity) > 0.2 then 'volatile'
            when abs(drift_velocity) > 0.1 then 'fluctuating'
            else 'stable'
        end as drift_stability,
        
        case 
            when rolling_stddev_drift_30 > 0.15 then 'inconsistent'
            else 'consistent'
        end as drift_consistency
    from drift_metrics
)
select * from drift_classifications;

-- Adversarial Stress View: Latency/coherence under attack
create or replace materialized view mart_adversarial_stress as
with stg_logs as (
    select * from {{ ref('stg_logs') }}
    where session_type = 'red_team'
),
stress_metrics as (
    select
        log_id,
        timestamp,
        model,
        prompt_category as attack_type,
        latency_ms,
        latency_seconds,
        refused,
        response_quality_score,
        total_tokens,
        prompt_tokens,
        response_tokens,
        
        -- Calculate stress indicators
        case 
            when latency_seconds > 5 then 'critical_latency'
            when latency_seconds > 3 then 'high_latency'
            when latency_seconds > 2 then 'moderate_latency'
            else 'normal_latency'
        end as latency_category,
        
        case 
            when refused then 'refusal'
            when response_quality_score < 0.5 then 'low_quality'
            when response_quality_score < 0.7 then 'medium_quality'
            else 'high_quality'
        end as quality_category,
        
        -- Stress score (combination of latency and quality)
        case 
            when refused then 1.0
            else (latency_seconds / 10.0) + (1 - response_quality_score) * 0.5
        end as stress_score,
        
        -- Token pressure (how many tokens per second)
        case 
            when latency_seconds > 0 then total_tokens::float / latency_seconds
            else null 
        end as tokens_per_second,
        
        -- Refusal rate by attack type
        bool_or(refused) over (
            partition by attack_type 
            order by timestamp 
            rows between 9 preceding and current row
        ) as recent_refusal_in_window_10
        
    from stress_metrics
),
aggregated_stress as (
    select
        model,
        attack_type,
        count(*) as total_attacks,
        sum(case when refused then 1 else 0 end) as refusal_count,
        sum(case when refused then 1 else 0 end)::float / count(*) as refusal_rate,
        avg(latency_ms) as avg_latency_ms,
        max(latency_ms) as max_latency_ms,
        percentile_cont(0.95) within group (order by latency_ms) as p95_latency_ms,
        avg(stress_score) as avg_stress_score,
        max(stress_score) as max_stress_score,
        avg(response_quality_score) as avg_quality_score,
        avg(tokens_per_second) as avg_tokens_per_second
    from stress_metrics
    group by model, attack_type
)
select
    sm.log_id,
    sm.timestamp,
    sm.model,
    sm.attack_type,
    sm.latency_ms,
    sm.latency_seconds,
    sm.refused,
    sm.response_quality_score,
    sm.stress_score,
    sm.latency_category,
    sm.quality_category,
    sm.tokens_per_second,
    
    -- Baseline comparison
    as.avg_latency_ms as model_avg_latency,
    as.avg_stress_score as model_avg_stress,
    as.refusal_rate as attack_type_refusal_rate,
    
    -- Stress indicators
    sm.latency_ms - as.avg_latency_ms as latency_delta,
    sm.stress_score - as.avg_stress_score as stress_delta,
    
    -- Classification
    case 
        when sm.stress_score > 0.8 then 'critical_stress'
        when sm.stress_score > 0.6 then 'high_stress'
        when sm.stress_score > 0.4 then 'moderate_stress'
        else 'low_stress'
    end as stress_level
    
from stress_metrics sm
left join aggregated_stress as on sm.model = as.model and sm.attack_type = as.attack_type;

-- Fragility Score View: Delta baseline vs. adversarial
create or replace materialized view mart_fragility_score as
with stg_logs as (
    select * from {{ ref('stg_logs') }}
),
production_metrics as (
    select
        model,
        date(log_date) as date,
        avg(latency_ms) as avg_latency_ms,
        avg(response_quality_score) as avg_quality_score,
        avg(efficiency_score) as avg_efficiency_score,
        sum(case when refused then 1 else 0 end)::float / count(*) as refusal_rate,
        count(*) as total_interactions
    from stg_logs
    where session_type = 'production'
    group by model, date(log_date)
),
adversarial_metrics as (
    select
        model,
        date(log_date) as date,
        avg(latency_ms) as avg_latency_ms,
        avg(response_quality_score) as avg_quality_score,
        avg(efficiency_score) as avg_efficiency_score,
        sum(case when refused then 1 else 0 end)::float / count(*) as refusal_rate,
        count(*) as total_interactions,
        prompt_category as attack_type
    from stg_logs
    where session_type = 'red_team'
    group by model, date(log_date), prompt_category
),
fragility_metrics as (
    select
        am.model,
        am.date,
        am.attack_type,
        am.total_interactions as adversarial_count,
        pm.total_interactions as production_count,
        
        -- Latency fragility
        (am.avg_latency_ms - pm.avg_latency_ms) / nullif(pm.avg_latency_ms, 0) as latency_fragility,
        
        -- Quality fragility
        (pm.avg_quality_score - am.avg_quality_score) / nullif(pm.avg_quality_score, 0) as quality_fragility,
        
        -- Refusal fragility
        (am.refusal_rate - pm.refusal_rate) / nullif(pm.refusal_rate, 0) as refusal_fragility,
        
        -- Efficiency fragility
        (pm.avg_efficiency_score - am.avg_efficiency_score) / nullif(pm.avg_efficiency_score, 0) as efficiency_fragility,
        
        -- Combined fragility score (weighted average)
        (
            coalesce(latency_fragility, 0) * 0.3 +
            coalesce(quality_fragility, 0) * 0.3 +
            coalesce(refusal_fragility, 0) * 0.25 +
            coalesce(efficiency_fragility, 0) * 0.15
        ) as combined_fragility_score
        
    from adversarial_metrics am
    join production_metrics pm on am.model = pm.model and am.date = pm.date
),
fragility_classifications as (
    select
        *,
        case 
            when combined_fragility_score > 1.0 then 'extremely_fragile'
            when combined_fragility_score > 0.7 then 'highly_fragile'
            when combined_fragility_score > 0.4 then 'moderately_fragile'
            when combined_fragility_score > 0.2 then 'slightly_fragile'
            else 'resilient'
        end as fragility_category,
        
        case 
            when latency_fragility > 0.5 then 'latency_critical'
            when quality_fragility > 0.5 then 'quality_critical'
            when refusal_fragility > 0.5 then 'refusal_critical'
            when efficiency_fragility > 0.5 then 'efficiency_critical'
            else 'no_critical_issue'
        end as critical_issue_type,
        
        -- Model resilience score (inverse of fragility)
        1 - least(combined_fragility_score, 1) as resilience_score
        
    from fragility_metrics
)
select * from fragility_classifications;
