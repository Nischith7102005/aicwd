{{
  config(
    materialized = 'view'
  )
}}

with source as (
    select * from {{ source('raw_convex', 'raw_llm_events') }}
),

models as (
    select distinct
        model,
        provider,
        -- Categorize models by size/type based on name
        case
            when lower(model) like '%gpt-4%' or lower(model) like '%claude-3-opus%' then 'large'
            when lower(model) like '%gpt-3.5%' or lower(model) like '%claude-3-sonnet%' or lower(model) like '%claude-3-haiku%' then 'medium'
            when lower(model) like '%embedding%' or lower(model) like '%small%' then 'small'
            else 'unknown'
        end as model_tier,
        min(timestamp) over (partition by model) as first_seen_at,
        max(timestamp) over (partition by model) as last_seen_at
    from source
    where model is not null
)

select * from models
