{{
  config(
    materialized = 'view'
  )
}}

with source as (
    select * from {{ source('raw_convex', 'logs') }}
),

renamed as (
    select
        id,
        timestamp as log_timestamp,
        level as log_level,
        message,
        _loaded_at,

        -- Time-based fields for analysis
        date_trunc('hour', timestamp) as log_hour,
        date_trunc('day', timestamp) as log_date,
        extract(hour from timestamp) as log_hour_of_day,
        extract(dow from timestamp) as day_of_week,

        -- Log level categorization
        case
            when lower(level) in ('error', 'fatal', 'critical') then 'error'
            when lower(level) in ('warn', 'warning') then 'warning'
            when lower(level) in ('info', 'information') then 'info'
            when lower(level) in ('debug') then 'debug'
            else 'other'
        end as log_level_category,

        -- Log level severity (numeric for sorting/filtering)
        case
            when lower(level) in ('fatal', 'critical') then 5
            when lower(level) in ('error') then 4
            when lower(level) in ('warn', 'warning') then 3
            when lower(level) in ('info', 'information') then 2
            when lower(level) in ('debug') then 1
            else 0
        end as log_level_severity

    from source
)

select * from renamed
