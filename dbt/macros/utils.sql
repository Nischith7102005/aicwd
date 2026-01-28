-- DBT macros for common utility functions
-- These macros are used across multiple models

{% macro calculate_waste_score(prompt, response) %}
    (
        LENGTH({{ response }}) / 
        NULLIF(LENGTH({{ prompt }}), 0)
    ) * 
    (
        1 + 
        (LENGTH({{ response }}) - LENGTH(REPLACE({{ response }}, ' ', ''))) * 0.01
    )
{% endmacro %}

{% macro calculate_tokens_per_word(tokens, text) %}
    {{ tokens }} / NULLIF(LENGTH({{ text }}) - LENGTH(REPLACE({{ text }}, ' ', '')) + 1, 0)
{% endmacro %}

{% macro time_bucket(timestamp, bucket_size) %}
    CASE 
        WHEN '{{ bucket_size }}' = 'minute' THEN DATE_TRUNC('minute', FROM_UNIXTIME({{ timestamp }} / 1000))
        WHEN '{{ bucket_size }}' = 'hour' THEN DATE_TRUNC('hour', FROM_UNIXTIME({{ timestamp }} / 1000))
        WHEN '{{ bucket_size }}' = 'day' THEN DATE_TRUNC('day', FROM_UNIXTIME({{ timestamp }} / 1000))
        ELSE DATE_TRUNC('hour', FROM_UNIXTIME({{ timestamp }} / 1000))
    END
{% endmacro %}

{% macro is_jailbreak_attempt(prompt) %}
    (
        {{ prompt }} ILIKE '%ignore all previous%' OR
        {{ prompt }} ILIKE '%developer mode%' OR
        {{ prompt }} ILIKE '%system override%' OR
        {{ prompt }} ILIKE '%no restrictions%' OR
        {{ prompt }} ILIKE '%bypass safety%'
    )
{% endmacro %}

{% macro classify_adversarial_type(prompt) %}
    CASE
        WHEN {{ prompt }} ILIKE '%ignore%' OR {{ prompt }} ILIKE '%override%' THEN 'jailbreak'
        WHEN {{ prompt }} ILIKE '%paradox%' OR {{ prompt }} ILIKE '%contradiction%' THEN 'logic_puzzle'
        WHEN {{ prompt }} ILIKE '%explain%' AND {{ prompt }} ILIKE '%technical%' THEN 'semantic_overload'
        ELSE 'generic'
    END
{% endmacro %}

{% macro safe_divide(numerator, denominator, default_value) %}
    CASE 
        WHEN {{ denominator }} IS NULL OR {{ denominator }} = 0 THEN {{ default_value }}
        ELSE {{ numerator }} / {{ denominator }}
    END
{% endmacro %}

{% macro calculate_drift(current_value, baseline_value) %}
    ABS({{ current_value }} - {{ baseline_value }}) / NULLIF({{ baseline_value }}, 0) * 100
{% endmacro %}
