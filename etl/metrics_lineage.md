# dbt Metric Lineage Inventory

This document inventories every raw table and transformed model in the dbt project and maps each metric column to its SQL model and raw-log lineage from Neon Postgres (`raw_llm_events`).

## Raw Sources (Neon Postgres)

### `raw_convex.raw_llm_events`
Created by `etl/webhook.ts` and registered in `etl/models/sources.yml`.

| Raw Column | Type (from webhook) | Notes |
| --- | --- | --- |
| id | BIGSERIAL | Primary key |
| timestamp | TIMESTAMP | Event timestamp |
| prompt | TEXT | Prompt text |
| response | TEXT | Response text |
| input_tokens | INTEGER | Input token count |
| output_tokens | INTEGER | Output token count |
| latency_ms | INTEGER | Request latency |
| model | VARCHAR | Model identifier |
| provider | VARCHAR | Provider identifier |
| config_id | VARCHAR | Convex config ID |
| is_adversarial | BOOLEAN | Adversarial flag |
| error | TEXT | Error message |
| efficiency_ratio | DOUBLE PRECISION | Output/Input ratio |
| waste_index | DOUBLE PRECISION | Cognitive waste score (0-1) |
| semantic_drift | DOUBLE PRECISION | Semantic drift (0-1) |
| hallucination_prob | DOUBLE PRECISION | Hallucination probability |
| censorship_score | DOUBLE PRECISION | Censorship score |
| bias_score | DOUBLE PRECISION | Bias score |
| tokens_per_second | DOUBLE PRECISION | Throughput metric |
| cost_usd | DOUBLE PRECISION | Estimated cost |
| success | BOOLEAN | Success flag |
| _loaded_at | TIMESTAMP | Ingestion timestamp |

## Seeds

### `seeds.seed_llm_providers`
Loaded from `etl/seeds/seed_llm_providers.csv`.

| Column | Source | Notes |
| --- | --- | --- |
| provider_name | CSV | Provider ID |
| display_name | CSV | Human-friendly name |
| category | CSV | Provider category |

## Staging Models (schema: `staging`)

### `staging.stg_llm_events` (view)
Source: `raw_convex.raw_llm_events`.

| Staging Column | Raw Column(s) / Logic | Notes |
| --- | --- | --- |
| id | raw_llm_events.id | Direct map |
| event_timestamp | raw_llm_events.timestamp | Rename |
| prompt | raw_llm_events.prompt | Direct map |
| response | raw_llm_events.response | Direct map |
| input_tokens | raw_llm_events.input_tokens | Direct map |
| output_tokens | raw_llm_events.output_tokens | Direct map |
| latency_ms | raw_llm_events.latency_ms | Direct map |
| model | raw_llm_events.model | Direct map |
| provider | raw_llm_events.provider | Direct map |
| config_id | raw_llm_events.config_id | Direct map |
| is_adversarial | raw_llm_events.is_adversarial | Direct map |
| error | raw_llm_events.error | Direct map |
| efficiency_ratio | raw_llm_events.efficiency_ratio | Direct map |
| waste_index | raw_llm_events.waste_index | Direct map |
| semantic_drift | raw_llm_events.semantic_drift | Direct map |
| hallucination_prob | raw_llm_events.hallucination_prob | Direct map |
| censorship_score | raw_llm_events.censorship_score | Direct map |
| bias_score | raw_llm_events.bias_score | Direct map |
| tokens_per_second | raw_llm_events.tokens_per_second | Direct map (canonical throughput) |
| cost_usd | raw_llm_events.cost_usd | Direct map |
| success | raw_llm_events.success | Direct map |
| _loaded_at | raw_llm_events._loaded_at | Direct map |
| total_tokens | input_tokens + output_tokens | Derived |
| tokens_per_sec_calc | CASE WHEN latency_ms &gt; 0 THEN (output_tokens::float / latency_ms) * 1000 ELSE 0 END | Derived alternative throughput |
| event_hour | date_trunc('hour', timestamp) | Derived time bucket |
| event_date | date_trunc('day', timestamp) | Derived date bucket |
| event_hour_of_day | extract(hour from timestamp) | Derived |
| day_of_week | extract(dow from timestamp) | Derived |

### `staging.stg_models` (view)
Source: `raw_convex.raw_llm_events`.

| Column | Raw Column(s) / Logic | Notes |
| --- | --- | --- |
| model | raw_llm_events.model | Distinct models |
| provider | raw_llm_events.provider | Distinct providers |
| model_tier | CASE on lower(model) | large/medium/small/unknown classification |
| first_seen_at | min(timestamp) over (partition by model) | Derived |
| last_seen_at | max(timestamp) over (partition by model) | Derived |

## Mart Models (schema: `marts`)

### `marts.daily_metrics` (table)
Source: `staging.stg_llm_events`.

| Metric Column | Logic in `daily_metrics.sql` | Raw Lineage |
| --- | --- | --- |
| event_date | group by event_date | raw_llm_events.timestamp (via stg_llm_events.event_date) |
| provider | group by provider | raw_llm_events.provider |
| model | group by model | raw_llm_events.model |
| total_requests | count(*) | raw_llm_events rows |
| successful_requests | sum(case when success then 1 else 0 end) | raw_llm_events.success |
| failed_requests | sum(case when not success then 1 else 0 end) | raw_llm_events.success |
| total_input_tokens | sum(input_tokens) | raw_llm_events.input_tokens |
| total_output_tokens | sum(output_tokens) | raw_llm_events.output_tokens |
| total_tokens | sum(total_tokens) | raw_llm_events.input_tokens + raw_llm_events.output_tokens |
| avg_tokens_per_request | avg(total_tokens) | raw_llm_events.input_tokens + raw_llm_events.output_tokens |
| total_cost_usd | sum(cost_usd) | raw_llm_events.cost_usd |
| avg_cost_per_request | avg(cost_usd) | raw_llm_events.cost_usd |
| avg_latency_ms | avg(latency_ms) | raw_llm_events.latency_ms |
| p50_latency_ms | percentile_cont(0.5) within group (order by latency_ms) | raw_llm_events.latency_ms |
| p95_latency_ms | percentile_cont(0.95) within group (order by latency_ms) | raw_llm_events.latency_ms |
| p99_latency_ms | percentile_cont(0.99) within group (order by latency_ms) | raw_llm_events.latency_ms |
| avg_tokens_per_second | avg(tokens_per_second) | raw_llm_events.tokens_per_second |
| avg_efficiency_ratio | avg(efficiency_ratio) | raw_llm_events.efficiency_ratio |
| avg_waste_index | avg(waste_index) | raw_llm_events.waste_index |
| avg_semantic_drift | avg(semantic_drift) | raw_llm_events.semantic_drift |
| avg_hallucination_prob | avg(hallucination_prob) | raw_llm_events.hallucination_prob |
| avg_censorship_score | avg(censorship_score) | raw_llm_events.censorship_score |
| avg_bias_score | avg(bias_score) | raw_llm_events.bias_score |
| success_rate_pct | round(sum(success) / count(*) * 100, 2) | raw_llm_events.success |
| adversarial_tests | sum(case when is_adversarial then 1 else 0 end) | raw_llm_events.is_adversarial |
| waste_level | CASE on avg_waste_index (&lt;0.3 low, &lt;0.6 medium, else high) | raw_llm_events.waste_index |
| hallucination_risk_level | CASE on avg_hallucination_prob (&lt;0.05 low, &lt;0.15 medium, else high) | raw_llm_events.hallucination_prob |

### `marts.provider_comparison` (table)
Source: `staging.stg_llm_events` filtered to the last 7 days (`event_date >= current_date - interval '7 days'`).

| Metric Column | Logic in `provider_comparison.sql` | Raw Lineage |
| --- | --- | --- |
| provider | group by provider | raw_llm_events.provider |
| model | group by model | raw_llm_events.model |
| total_requests | count(*) | raw_llm_events rows |
| active_days | count(distinct event_date) | raw_llm_events.timestamp |
| avg_efficiency | avg(efficiency_ratio) | raw_llm_events.efficiency_ratio |
| avg_input_tokens | avg(input_tokens) | raw_llm_events.input_tokens |
| avg_output_tokens | avg(output_tokens) | raw_llm_events.output_tokens |
| total_cost | sum(cost_usd) | raw_llm_events.cost_usd |
| avg_cost_per_request | avg(cost_usd) | raw_llm_events.cost_usd |
| avg_latency_ms | avg(latency_ms) | raw_llm_events.latency_ms |
| avg_throughput | avg(tokens_per_second) | raw_llm_events.tokens_per_second |
| avg_semantic_drift | avg(semantic_drift) | raw_llm_events.semantic_drift |
| avg_hallucination_prob | avg(hallucination_prob) | raw_llm_events.hallucination_prob |
| avg_censorship_score | avg(censorship_score) | raw_llm_events.censorship_score |
| avg_bias_score | avg(bias_score) | raw_llm_events.bias_score |
| avg_waste_index | avg(waste_index) | raw_llm_events.waste_index |
| success_rate_pct | round(sum(success) / count(*) * 100, 2) | raw_llm_events.success |
| last_used_at | max(event_timestamp) | raw_llm_events.timestamp |
| waste_rank | rank() over (order by avg_waste_index asc) | raw_llm_events.waste_index |
| cost_rank | rank() over (order by avg_cost_per_request asc) | raw_llm_events.cost_usd |
| speed_rank | rank() over (order by avg_latency_ms asc) | raw_llm_events.latency_ms |
| quality_rank | rank() over (order by avg_semantic_drift asc) | raw_llm_events.semantic_drift |
| overall_rank | round((waste_rank + cost_rank + speed_rank + quality_rank) / 4.0, 1) | Derived from ranks above |
| recommendation | CASE on ranks | Derived from ranks above |

### `marts.cognitive_waste_index` (table)
Source: `staging.stg_llm_events`, filtered to `success = true`.

**Step 1: `efficiency_metrics`**

| Metric Column | Logic | Raw Lineage |
| --- | --- | --- |
| event_date | group by event_date | raw_llm_events.timestamp |
| provider | group by provider | raw_llm_events.provider |
| model | group by model | raw_llm_events.model |
| total_input | sum(input_tokens) | raw_llm_events.input_tokens |
| total_output | sum(output_tokens) | raw_llm_events.output_tokens |
| avg_efficiency | avg(efficiency_ratio) | raw_llm_events.efficiency_ratio |
| avg_semantic_drift | avg(semantic_drift) | raw_llm_events.semantic_drift |
| avg_hallucination_risk | avg(hallucination_prob) | raw_llm_events.hallucination_prob |
| avg_censorship | avg(censorship_score) | raw_llm_events.censorship_score |
| avg_bias | avg(bias_score) | raw_llm_events.bias_score |
| avg_latency | avg(latency_ms) | raw_llm_events.latency_ms |
| total_cost | sum(cost_usd) | raw_llm_events.cost_usd |
| request_count | count(*) | raw_llm_events rows |

**Step 2: `waste_calculation`**

| Metric Column | Logic | Raw Lineage |
| --- | --- | --- |
| efficiency_waste | CASE: 1 - least(avg_efficiency, 1) when avg_efficiency &gt; 0 else 0.5 | raw_llm_events.efficiency_ratio |
| semantic_waste | coalesce(avg_semantic_drift, 0) | raw_llm_events.semantic_drift |
| quality_waste | coalesce(avg_hallucination_risk * 0.5 + avg_censorship * 0.25 + avg_bias * 0.25, 0) | raw_llm_events.hallucination_prob/censorship_score/bias_score |
| latency_waste | CASE buckets on avg_latency | raw_llm_events.latency_ms |

**Step 3: `final_index`**

| Metric Column | Logic | Raw Lineage |
| --- | --- | --- |
| request_count | passthrough | raw_llm_events rows |
| total_input | passthrough | raw_llm_events.input_tokens |
| total_output | passthrough | raw_llm_events.output_tokens |
| total_cost | passthrough | raw_llm_events.cost_usd |
| avg_latency | passthrough | raw_llm_events.latency_ms |
| efficiency_waste | passthrough | raw_llm_events.efficiency_ratio |
| semantic_waste | passthrough | raw_llm_events.semantic_drift |
| quality_waste | passthrough | raw_llm_events.hallucination_prob/censorship_score/bias_score |
| latency_waste | passthrough | raw_llm_events.latency_ms |
| cognitive_waste_index | round(efficiency_waste * 0.35 + semantic_waste * 0.30 + quality_waste * 0.25 + latency_waste * 0.10, 4) | derived from raw_llm_events metrics above |
| waste_grade | CASE on weighted index (&lt;0.2 A, &lt;0.4 B, &lt;0.6 C, &lt;0.8 D, else F) | derived from raw_llm_events metrics above |
| recommendation | CASE on efficiency/semantic/quality/latency waste thresholds | derived from raw_llm_events metrics above |

## Lineage Summary

```
raw_convex.raw_llm_events
  ├─ staging.stg_llm_events
  │    ├─ marts.daily_metrics
  │    ├─ marts.provider_comparison
  │    └─ marts.cognitive_waste_index
  └─ staging.stg_models

seeds.seed_llm_providers (independent seed)
```
