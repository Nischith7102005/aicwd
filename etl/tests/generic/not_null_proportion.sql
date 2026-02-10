{% test not_null_proportion(model, column_name, proportion=0.95) %}

with validation as (
    select
        sum(case when {{ column_name }} is null then 0 else 1 end) / count(*)::float as not_null_ratio
    from {{ model }}
),

validation_errors as (
    select * from validation
    where not_null_ratio < {{ proportion }}
)

select * from validation_errors

{% endtest %}
