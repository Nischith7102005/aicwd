# monitr-ai — Product Analytics Pack (Tableau) — PRE-LAUNCH / FREE BETA

Product-analytics dataset + native **Tableau** dashboard for **monitr-ai** —
the LLM observability platform (real-time token efficiency, Cognitive Waste
Index, Cognitive Risk Index, zero-trust security telemetry).

> **The product is NOT launched — it is in free beta.** These datasets contain
> **zero payment/billing/revenue fields**. Everything is pure KPI & user
> analytics: funnel, engagement, retention (inactivity-based), feature
> adoption, and product quality metrics.
> All data is **synthetic** (seeded, reproducible) but internally consistent.
> Period: **2026-03-01 → 2026-09-20**. The repo itself is untouched.

## Datasets recorded at 2 locations (one file per location)

| Location file | Users | Profile of users recorded there |
|---|---|---|
| **`users_dsu_campus.csv`** | 452 | DSU Campus (Bengaluru): students & researchers — 44% `.edu` emails, mobile-heavy, 51% arrived via **campus workshops**, activation 50.0%, 15.7 sessions/user, power-user share 21.2% |
| **`users_outside_campus.csv`** | 988 | Global professionals: company emails, 31.6% arrived via invites/referrals, activation 59.4%, 16.8 sessions/user, power-user share 24.7% |

Schema is identical in both (same ~42 fields as `user_signups.csv`) — they
union 1:1 and join onward via `user_id`. `collection_location` is also
denormalized onto visitors, configs and sessions.

## Where users are recorded in the product (one CSV per place)

| # | Place (in the app) | Collection method | File | Rows |
|---|---|---|---|---|
| P1 | Marketing site `frontend/index.html` | GA4 gtag (`G-FK3PF0KZ2R`), user-id stitching | `web_visitors.csv` | 20,731 |
| P2 | Auth `frontend/auth.html` | Firebase auth + signup_program/onboarding enrichment (no billing) | `user_signups.csv` | 1,440 |
| P3 | Key setup `frontend/key.html` | Convex `apiConfigs` (provider auto-detect, validation ping) | `api_key_configs.csv` | 1,194 |
| P4 | Observatory `frontend/dashboard.html` + `telemetry.html` | Convex telemetry (`sessions`, `cognitiveRiskIndex`, `securityEvents`) → Postgres/dbt via `etl/webhook.ts` | `monitoring_sessions.csv` | 13,385 |

Derived sets: `funnel_overall.csv`, `funnel_by_channel.csv`,
`funnel_by_location.csv`, `kpi_monthly.csv`, `kpi_monthly_by_location.csv`,
`retention_cohorts.csv`, `feature_adoption_overall.csv`,
`feature_adoption_by_persona.csv`, `kpi_definitions.csv` (19 KPIs with
formulas + interpretation).

Note: `llm_cost_usd` fields are the *users' own monitored LLM spend* (the
metric monitr-ai optimizes) — not payments to monitr-ai.

## Open the dashboard

| File | Contents |
|---|---|
| **`monitr_ai_user_analytics.twbx`** | Packaged workbook — all 15 CSVs embedded, opens directly in Tableau Desktop / Tableau Public |
| `monitr_ai_user_analytics.twb` | Same workbook, loose — reads CSVs from `./data/` |
| `generate_data.py` / `build_workbook.py` | Rebuild: `python3 generate_data.py && python3 build_workbook.py` |
| `summary.json` | Headline numbers used in dashboard text |

Workbook (format 18.1): **2 dashboards / 39 worksheets / 15 data sources**:

1. **monitr-ai Product Analytics** (one main scrolling dashboard) —
   - *KPI scorecard* (Aug 2026): North Star Weekly Observing Users, MAU,
     stickiness, activation, power users, next-month return, W4 retention,
     invite/referral share, NPS, tokens monitored, waste index, CRI.
   - *KPI trends* (12 sheets) + KPI framework strip with formulas.
   - *Funnel analysis*: Visit → Signup (6.9%) → Key Connected (66.9%) →
     Activation (84.3%); by channel **and by location**; median days per stage;
     leak insights.
   - *User behaviour analysis*: channel/location/persona/program mix,
     activation & onboarding by location, sessions-by-hour, feature adoption,
     cohort retention heatmap, segment insights.
2. **Data Collection and Methodology** — the 4 product recording places + the
   2 collection locations (DSU Campus / Outside Campus): source, collection
   method, relevance to product analysis, governance notes.

## Location story (user analytics, pre-launch)

- **DSU Campus** = workshop-led volume: great signup spikes and exploratory
  usage (adversarial red-team tests), but lower activation (50%) and drifting
  engagement after workshops/semester breaks → needs follow-through nudges.
- **Outside Campus** = referral-led depth: higher activation (59.4%), more
  power users, steadier sustained usage → the segment to tune PMF on.

> Location note: this folder lives at `analytics/` in the repository (branch
> `arena/01a0bd49-aicwd`). Regenerate any time with the two scripts.
