#!/usr/bin/env python3
"""
monitr-ai - Product Analytics Dataset Generator (PRE-LAUNCH / BETA)
====================================================================
The product is NOT launched and has NO payments - every user is on the free
beta. All datasets are pure KPI & user-analytics data (no pricing / billing /
revenue fields anywhere).

Datasets split by DATA-COLLECTION LOCATION:
  * DSU Campus      (on-campus users: students/researchers, Bengaluru)
  * Outside Campus  (off-campus users: global professionals)

Core product datasets (where users are recorded in the app):
  P1 web_visitors.csv        - marketing site (GA4 gtag, frontend/index.html)
  P2 user_signups.csv        - auth records (frontend/auth.html, Firebase)
  P3 api_key_configs.csv     - provider key connections (frontend/key.html
                                -> Convex apiConfigs)
  P4 monitoring_sessions.csv - live observatory sessions (dashboard.html +
                                telemetry.html -> Convex telemetry schema)

Per-location user files: users_dsu_campus.csv, users_outside_campus.csv
Derived analytics sets:    funnel_overall / funnel_by_channel /
                           funnel_by_location / kpi_monthly /
                           kpi_monthly_by_location / retention_cohorts /
                           feature_adoption_overall / _by_persona /
                           kpi_definitions
Synthetic (seeded, reproducible) but internally consistent: all joins work.
"""
import csv, json, math, random, os
from datetime import date, timedelta, datetime

random.seed(42)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUT, exist_ok=True)

D0 = date(2026, 3, 1)
TODAY = date(2026, 9, 20)
NDAYS = (TODAY - D0).days + 1  # 204 days

# ---------------------------------------------------------------- reference --
CHANNELS = ["organic_search", "direct", "social_twitter", "hackernews",
            "linkedin", "referral", "newsletter", "paid_search"]
CH_W = [0.26, 0.14, 0.12, 0.11, 0.10, 0.09, 0.08, 0.10]
CH_SIGNUP = {"organic_search": 0.050, "direct": 0.058, "social_twitter": 0.042,
             "hackernews": 0.080, "linkedin": 0.072, "referral": 0.088,
             "newsletter": 0.095, "paid_search": 0.048}
UTM_MEDIUM = {"organic_search": "organic", "direct": "none",
              "social_twitter": "social", "hackernews": "social",
              "linkedin": "social", "referral": "referral",
              "newsletter": "email", "paid_search": "cpc"}
UTM_CAMPAIGN = {"organic_search": "none", "direct": "none",
                "social_twitter": "llm_observability_buzz",
                "hackernews": "show_hn_launch", "linkedin": "b2b_mlsops_q2",
                "referral": "partner_aiweekly", "newsletter": "beta_waitlist",
                "paid_search": "brand_llm_monitoring"}
LANDING = ["/", "/", "/", "/features", "/pricing", "/docs",
           "/blog/llm-observability-guide", "/blog/cognitive-waste-index",
           "/blog/zero-trust-llm-security"]
DEVICES = [("desktop", 0.72), ("mobile", 0.24), ("tablet", 0.04)]
BROWSERS = [("Chrome", 0.62), ("Safari", 0.20), ("Firefox", 0.09), ("Edge", 0.09)]
DESKTOP_OS = [("Windows", 0.52), ("macOS", 0.40), ("Linux", 0.08)]
MOBILE_OS = [("iOS", 0.55), ("Android", 0.45)]
GEO = [  # country, weight, region, city
    ("United States", 0.34, "California", "San Francisco"),
    ("United States", 0.04, "New York", "New York"),
    ("India", 0.14, "Karnataka", "Bengaluru"),
    ("United Kingdom", 0.08, "England", "London"),
    ("Germany", 0.07, "Bavaria", "Munich"),
    ("Canada", 0.05, "Ontario", "Toronto"),
    ("Brazil", 0.04, "Sao Paulo", "Sao Paulo"),
    ("France", 0.04, "Ile-de-France", "Paris"),
    ("Australia", 0.03, "New South Wales", "Sydney"),
    ("Japan", 0.03, "Tokyo", "Tokyo"),
    ("Netherlands", 0.03, "North Holland", "Amsterdam"),
    ("Singapore", 0.03, "Central", "Singapore"),
    ("Spain", 0.02, "Catalonia", "Barcelona"),
    ("Poland", 0.02, "Mazovia", "Warsaw"),
    ("Israel", 0.02, "Tel Aviv", "Tel Aviv"),
    ("South Korea", 0.02, "Seoul", "Seoul"),
]
GEO_W = [g[1] for g in GEO]
LANG = {"United States": "en-US", "United Kingdom": "en-GB", "India": "en-IN",
        "Germany": "de", "Canada": "en-CA", "Brazil": "pt-BR", "France": "fr",
        "Australia": "en-AU", "Japan": "ja", "Netherlands": "nl",
        "Singapore": "en-SG", "Spain": "es", "Poland": "pl", "Israel": "he",
        "South Korea": "ko"}
PERSONAS = ["ML Engineer", "Data Scientist", "Product Manager",
            "Founder / Exec", "Security Engineer", "Researcher"]
PERSONA_W = [0.30, 0.22, 0.14, 0.10, 0.12, 0.12]
PERSONA_CAMPUS_W = [0.34, 0.26, 0.06, 0.04, 0.08, 0.22]
PERSONA_P_CONFIG = {"ML Engineer": 0.70, "Data Scientist": 0.62,
                    "Product Manager": 0.40, "Founder / Exec": 0.42,
                    "Security Engineer": 0.68, "Researcher": 0.58}
PERSONA_LIFEMED = {"ML Engineer": 110, "Security Engineer": 115,
                   "Data Scientist": 95, "Researcher": 80,
                   "Product Manager": 60, "Founder / Exec": 55}
USE_CASES = ["Cost Optimization", "Security & Compliance", "Quality Assurance",
             "Performance Monitoring", "Research & Experimentation"]
USECASE_W = [0.24, 0.26, 0.18, 0.24, 0.08]
INDUSTRIES = [("SaaS / Software", 0.30), ("FinTech", 0.14), ("Healthcare", 0.08),
              ("E-commerce", 0.10), ("Consulting / Agency", 0.10),
              ("Research Lab / Academia", 0.08), ("Media & Gaming", 0.08),
              ("Enterprise IT", 0.12)]
COMPANY_SIZES = [("1-10", 0.34), ("11-50", 0.27), ("51-200", 0.21),
                 ("201-1000", 0.12), ("1000+", 0.06)]
SENIORITY = [("Individual Contributor", 0.55), ("Team Lead", 0.20),
             ("Manager", 0.13), ("Executive", 0.12)]
EMAILS = ["gmail.com", "outlook.com", "proton.me", "company.com", "university.edu"]
EMAIL_W = [0.52, 0.10, 0.04, 0.28, 0.06]
EMAIL_CAMPUS_W = [0.40, 0.06, 0.08, 0.06, 0.40]
FIRST = ["Aisha", "Rahul", "Mei", "Diego", "Sofia", "Liam", "Noah", "Emma",
         "Yuki", "Omar", "Fatima", "Lucas", "Elena", "Arjun", "Priya", "Chen",
         "Maya", "Ethan", "Zoe", "Hassan", "Ingrid", "Tomas", "Nadia", "Kenji"]
LAST = ["Verma", "Sharma", "Tanaka", "Garcia", "Rossi", "Smith", "Johnson",
        "Brown", "Sato", "Khan", "Ali", "Silva", "Petrova", "Iyer", "Nair",
        "Wang", "Costa", "Walker", "Kim", "Yamamoto", "Lindqvist", "Novak",
        "Haddad", "Muller"]

# pre-launch: how the user got into the free beta (NO paid plans exist)
PROGRAMS_OUTSIDE = [("open_beta", 0.55), ("waitlist", 0.22), ("invite_code", 0.23)]
PROGRAMS_CAMPUS = [("campus_workshop", 0.50), ("invite_code", 0.25), ("open_beta", 0.25)]
PROGRAM_CFG_TILT = {"open_beta": 1.0, "waitlist": 0.95, "invite_code": 1.15,
                    "campus_workshop": 0.90}
PROGRAM_LIFE_TILT = {"open_beta": 1.0, "waitlist": 0.90, "invite_code": 1.15,
                     "campus_workshop": 0.85}

PROVIDERS = {  # name: (models, $/1M in, $/1M out, base latency ms, tps, weight)
    "OpenAI":              (["gpt-5", "gpt-5-mini", "gpt-4o"],        1.25, 10.0,  850,  65, 0.30),
    "Anthropic":           (["claude-opus-5", "claude-sonnet-5"],     3.00, 15.0, 1000,  58, 0.20),
    "Google AI (Gemini)":  (["gemini-3-pro", "gemini-3-flash"],       1.00,  6.0,  800,  90, 0.12),
    "Groq":                (["llama-4-maverick", "qwen3-32b"],        0.50,  0.9,  320, 250, 0.10),
    "DeepSeek":            (["deepseek-v4", "deepseek-r2"],           0.30,  1.2, 1100,  50, 0.07),
    "Mistral AI":          (["mistral-large-3", "codestral-2"],       2.00,  6.0,  900,  70, 0.06),
    "xAI (Grok)":          (["grok-4", "grok-4-mini"],                2.50, 12.0,  950,  62, 0.05),
    "OpenRouter":          (["auto/router", "qwen3-235b"],            0.60,  2.4, 1000,  55, 0.05),
    "Together AI":         (["llama-4-scout", "deepseek-r2-distill"], 0.80,  2.0,  750,  95, 0.03),
    "Cohere":              (["command-r-plus-2"],                     2.50, 10.0, 1050,  58, 0.02),
}
PNAMES = list(PROVIDERS)
PW = [PROVIDERS[p][5] for p in PNAMES]
PROV_PERSONA_TILT = {
    "Security Engineer": {"Anthropic": 1.5, "OpenAI": 1.2},
    "Researcher": {"DeepSeek": 2.2, "OpenRouter": 2.0, "Groq": 1.5},
    "Founder / Exec": {"OpenAI": 1.6, "Google AI (Gemini)": 1.3},
    "Product Manager": {"OpenAI": 1.4},
    "Data Scientist": {"Google AI (Gemini)": 1.4, "Together AI": 1.4},
    "ML Engineer": {"Groq": 1.4, "DeepSeek": 1.3},
}
LOCATIONS = ["DSU Campus", "Outside Campus"]
LOC_FILES = {"DSU Campus": "users_dsu_campus.csv",
             "Outside Campus": "users_outside_campus.csv"}

# ---------------------------------------------------------------- helpers ---
def wchoice(items, weights):
    return random.choices(items, weights=weights, k=1)[0]

def poisson(lam):
    L = math.exp(-lam)
    k, p = 0, 1.0
    while p > L:
        k += 1
        p *= random.random()
    return k - 1

def lognorm(mu, sig):
    return random.lognormvariate(mu, sig)

def clamp(x, a, b):
    return max(a, min(b, x))

def rdate(d):
    return d.isoformat()

MONTHS = []
_d = D0
while _d <= TODAY:
    MONTHS.append(f"{_d.year}-{_d.month:02d}")
    _d = date(_d.year + (_d.month == 12), (_d.month % 12) + 1, 1)

# ---------------------------------------------------------------- P1 visitors
visitors = []
vid = 0
SPIKES = {date(2026, 5, 12): 3.0, date(2026, 7, 28): 2.6, date(2026, 9, 9): 1.8}
for i in range(NDAYS):
    day = D0 + timedelta(days=i)
    base = 55 + (150 - 55) * (i / (NDAYS - 1))
    wday_mult = [1.05, 1.10, 1.12, 1.10, 1.00, 0.75, 0.70][day.weekday()]
    n = int(base * wday_mult * SPIKES.get(day, 1.0) * random.uniform(0.92, 1.08))
    for _ in range(n):
        vid += 1
        on_campus = random.random() < 0.30          # DSU Campus vs Outside Campus
        if on_campus:
            ch = wchoice(CHANNELS, [0.17, 0.18, 0.18, 0.05, 0.07, 0.20, 0.10, 0.05])
            dev = wchoice(["desktop", "mobile", "tablet"], [0.43, 0.55, 0.02])
            geo = ("India", 0.0, "Karnataka", "Bengaluru")
        else:
            ch = wchoice(CHANNELS, CH_W)
            dev = wchoice([d for d, _ in DEVICES], [w for _, w in DEVICES])
            geo = wchoice(GEO, GEO_W)
        brw = wchoice([b for b, _ in BROWSERS], [w for _, w in BROWSERS])
        osys = (wchoice([o for o, _ in DESKTOP_OS], [w for _, w in DESKTOP_OS])
                if dev == "desktop"
                else wchoice([o for o, _ in MOBILE_OS], [w for _, w in MOBILE_OS]))
        returning = random.random() < 0.30
        visits = 1 + (poisson(1.6) if returning else 0)
        pageviews = 1 + poisson(2.1)
        bounces = 1 if (pageviews == 1 and random.random() < 0.72) else 0
        dur = max(8, int(lognorm(4.3, 0.9) * (pageviews ** 0.8)))
        v_pricing = 1 if random.random() < (0.30 if pageviews >= 2 else 0.10) else 0
        v_docs = 1 if random.random() < (0.34 if pageviews >= 2 else 0.12) else 0
        v_demo = 1 if random.random() < (0.16 if pageviews >= 3 else 0.04) else 0
        p = CH_SIGNUP[ch]
        p *= 1.15 if on_campus else 1.0
        p *= {"desktop": 1.0, "tablet": 0.8, "mobile": 0.6}[dev]
        p *= 1.25 if returning else 1.0
        p *= 1.22 if v_pricing else 1.0
        p *= 1.12 if v_docs else 1.0
        p *= 1.30 if v_demo else 1.0
        p *= 2.1 if day in SPIKES and ch == "hackernews" else 1.0
        signed = random.random() < p
        cta = 1 if (signed or random.random() < 0.045) else 0
        monday = day - timedelta(days=day.weekday())
        visitors.append({
            "visitor_id": f"vis_{vid:06d}",
            "first_visit_date": rdate(day),
            "collection_location": "DSU Campus" if on_campus else "Outside Campus",
            "acquisition_channel": ch,
            "utm_source": ch if ch != "direct" else "(direct)",
            "utm_medium": UTM_MEDIUM[ch],
            "utm_campaign": UTM_CAMPAIGN[ch],
            "landing_page": random.choice(LANDING),
            "referrer_domain": ("google.com" if ch == "organic_search" else
                                "news.ycombinator.com" if ch == "hackernews" else
                                "t.co" if ch == "social_twitter" else
                                "linkedin.com" if ch == "linkedin" else
                                "aiweekly.newsletter" if ch == "newsletter" else
                                "(direct)" if ch == "direct" else "google.com"),
            "device_category": dev,
            "device_os": osys,
            "browser": brw,
            "country": geo[0],
            "region": geo[2],
            "city": geo[3],
            "language": LANG.get(geo[0], "en"),
            "visit_count": visits,
            "is_returning_visitor": int(returning),
            "pageviews_total": pageviews,
            "pages_per_session": round(pageviews / visits, 2),
            "session_count": visits,
            "avg_session_duration_sec": dur,
            "total_time_on_site_sec": dur * visits,
            "bounced_flag": bounces,
            "viewed_pricing_flag": v_pricing,
            "viewed_docs_flag": v_docs,
            "viewed_demo_flag": v_demo,
            "cta_getstarted_clicked": cta,
            "signed_up_flag": 0, "signup_user_id": "", "days_to_signup": "",
            "cohort_week": f"{monday.isocalendar().year}-W{monday.isocalendar().week:02d}",
        })

# After a CTA click, a share of visitors completes the signup form.
random.seed(4242)
for v in visitors:
    if v["cta_getstarted_clicked"]:
        v["signed_up_flag"] = 1 if random.random() < 0.62 else 0

# ---------------------------------------------------------------- P2 signups
signups = []
uid = 0
for v in visitors:
    if not v["signed_up_flag"]:
        continue
    uid += 1
    on_campus = v["collection_location"] == "DSU Campus"
    fv = date.fromisoformat(v["first_visit_date"])
    dts = random.choices([0, 1, 2, 3, 5, 8], weights=[60, 18, 9, 6, 4, 3])[0]
    sdate = min(fv + timedelta(days=dts), TODAY)
    persona = wchoice(PERSONAS, PERSONA_CAMPUS_W if on_campus else PERSONA_W)
    prog_items, prog_w = (zip(*PROGRAMS_CAMPUS) if on_campus else zip(*PROGRAMS_OUTSIDE))
    program = wchoice(list(prog_items), list(prog_w))
    ind, indw = zip(*INDUSTRIES)
    industry = wchoice(list(ind), list(indw)).strip()
    sz, szw = zip(*COMPANY_SIZES)
    size = wchoice(list(sz), list(szw))
    if on_campus:
        if random.random() < 0.45:
            industry = "Research Lab / Academia"
        if random.random() < 0.72:
            size = "1-10"
    sen, senw = zip(*SENIORITY)
    seniority = wchoice(list(sen), list(senw))
    onboard_steps = random.choices([0, 1, 2, 3, 4, 5],
                                   weights=[6, 4, 6, 10, 18, 56])[0]
    onboarding_done = 1 if onboard_steps >= 4 else 0
    p_cfg = PERSONA_P_CONFIG[persona]
    p_cfg *= PROGRAM_CFG_TILT[program]
    p_cfg *= 1.20 if onboarding_done else 1.0
    p_cfg *= 1.10 if v["viewed_docs_flag"] else 1.0
    p_cfg *= 0.85 if v["device_category"] == "mobile" else 1.0
    p_cfg *= 0.90 if on_campus else 1.0
    connected = random.random() < min(p_cfg, 0.92)
    cfg_date = None
    if connected:
        dtc = int(clamp(random.expovariate(1 / 1.6), 0, 14))
        cfg_date = min(sdate + timedelta(days=dtc), TODAY)
    activated = 0
    act_date = None
    if connected:
        p_act = 0.80 * (1.1 if onboard_steps == 5 else 1.0)
        activated = 1 if random.random() < min(p_act, 0.95) else 0
        if activated:
            dta = int(clamp(int(random.expovariate(1 / 1.2)), 0, 6))
            act_date = min(cfg_date + timedelta(days=dta), TODAY)
            if (act_date - cfg_date).days > 7:
                activated, act_date = 0, None
    emailt = wchoice(EMAILS, EMAIL_CAMPUS_W if on_campus else EMAIL_W)
    signups.append({
        "user_id": f"usr_{uid:05d}",
        "anonymous_visitor_id": v["visitor_id"],
        "display_name": f"{random.choice(FIRST)} {random.choice(LAST)}",
        "signup_date": rdate(sdate),
        "signup_weekday": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][sdate.weekday()],
        "signup_hour": random.choice(list(range(7, 23))),
        "cohort_month": f"{sdate.year}-{sdate.month:02d}",
        "email_domain_type": emailt,
        "email_verified_flag": 1 if random.random() < 0.88 else 0,
        "persona": persona,
        "collection_location": v["collection_location"],
        "signup_program": program,
        "role_seniority": seniority,
        "acquisition_channel": v["acquisition_channel"],
        "utm_source": v["utm_source"], "utm_medium": v["utm_medium"],
        "utm_campaign": v["utm_campaign"],
        "device_type_at_signup": v["device_category"],
        "country": v["country"], "region": v["region"],
        "industry": industry, "company_size": size,
        "primary_use_case": wchoice(USE_CASES, USECASE_W),
        "referral_flag": 1 if (v["acquisition_channel"] == "referral"
                               or program == "invite_code") else 0,
        "invited_by_teammate_flag": 1 if random.random() < 0.06 else 0,
        "days_visit_to_signup": dts,
        "onboarding_steps_completed": onboard_steps,
        "onboarding_completed_flag": onboarding_done,
        "api_key_connected_flag": int(connected),
        "first_config_date": rdate(cfg_date) if cfg_date else "",
        "days_to_first_config": (cfg_date - sdate).days if cfg_date else "",
        "activated_within_7d_flag": activated,
        "activation_date": rdate(act_date) if act_date else "",
        "days_to_activate": (act_date - sdate).days if act_date else "",
        "lifetime_days_active": "", "days_since_last_active": "",
        "inactive_30d_flag": 0,
        "total_sessions": 0, "total_tokens_used": 0, "total_llm_cost_usd": 0.0,
        "last_active_date": "", "power_user_flag": 0, "nps_score": "",
    })
    v["signup_user_id"] = f"usr_{uid:05d}"
    v["days_to_signup"] = dts

# ------------------------------------------------- P3 configs + P4 sessions --
configs = []
sessions = []
sess_id = 0
cfg_id = 0
user_features = {}

def pick_provider(persona):
    w = list(PW)
    for i, p in enumerate(PNAMES):
        if p in PROV_PERSONA_TILT.get(persona, {}):
            w[i] *= PROV_PERSONA_TILT[persona][p]
    return wchoice(PNAMES, w)

for u in signups:
    if not u["api_key_connected_flag"]:
        continue
    sdate = date.fromisoformat(u["signup_date"])
    n_configs = 2 if (u["onboarding_completed_flag"] and random.random() < 0.20) or random.random() < 0.08 else 1
    user_cfgs = []
    provs = [pick_provider(u["persona"])] + [pick_provider(u["persona"]) for _ in range(n_configs - 1)]
    first = date.fromisoformat(u["first_config_date"])
    for ci, prov in enumerate(provs):
        cfg_id += 1
        cdate = first if ci == 0 else min(first + timedelta(days=random.randint(3, 40)), TODAY)
        models, pin, pout, latb, tpsb, _ = PROVIDERS[prov]
        cfg = {
            "config_id": f"cfg_{cfg_id:05d}",
            "user_id": u["user_id"],
            "collection_location": u["collection_location"],
            "created_date": rdate(cdate),
            "days_since_signup": (cdate - sdate).days,
            "provider": prov,
            "model": random.choice(models),
            "connection_name": f"{prov.split(' ')[0]} {'Primary' if ci == 0 else 'Backup'}-{random.randint(1, 9)}",
            "is_primary_config": 1 if ci == 0 else 0,
            "input_price_per_1m_usd": pin,      # provider token prices -> monitored LLM spend
            "output_price_per_1m_usd": pout,
            "monthly_budget_usd": random.choice([25, 50, 100, 250, 500, 1000]),
            "key_auto_detected_flag": 1 if random.random() < 0.78 else 0,
            "custom_base_url_flag": 1 if random.random() < 0.08 else 0,
            "validation_attempts": random.choices([1, 2, 3], weights=[88, 9, 3])[0],
            "validation_success_flag": 1,
            "connection_latency_ms": int(clamp(lognorm(5.0, 0.4), 60, 900)),
            "config_status": "active",
            "key_rotations": random.choices([0, 1, 2], weights=[82, 15, 3])[0],
            "last_rotation_date": "",
            "first_session_date": "",
            "days_to_first_session": "",
            "total_sessions": 0, "total_interactions": 0,
            "total_input_tokens": 0, "total_output_tokens": 0,
            "total_llm_cost_usd": 0.0,
            "avg_efficiency_ratio": 0.0, "avg_waste_index": 0.0, "avg_cri": 0.0,
            "max_cri": 0.0, "adversarial_tests_run": 0, "last_used_date": "",
            "config_age_days": (TODAY - cdate).days,
        }
        user_cfgs.append(cfg)
        configs.append(cfg)

    user_feats = {"adversarial": 0, "batch": 0, "export": 0, "alerts": 0}
    act_date = date.fromisoformat(u["activation_date"]) if u["activated_within_7d_flag"] else None
    if act_date:
        per_mult = {"ML Engineer": 1.35, "Security Engineer": 1.3, "Data Scientist": 1.2,
                    "Researcher": 1.05, "Product Manager": 0.75, "Founder / Exec": 0.6}[u["persona"]]
        prog_mult = PROGRAM_LIFE_TILT[u["signup_program"]]
        base_lam = 2.3 * per_mult * prog_mult
        lif_med = PERSONA_LIFEMED[u["persona"]] * prog_mult
        lifetime = int(clamp(random.expovariate(1 / lif_med), 3, (TODAY - act_date).days + 200))
        end = min(act_date + timedelta(days=lifetime), TODAY)
        cur = act_date
        wk = 0
        tot_tok = tot_sessions = 0
        tot_cost = 0.0
        last_active = None
        while cur <= end:
            lam = base_lam * (0.96 ** wk) * random.uniform(0.7, 1.3)
            for _ in range(poisson(lam)):
                sday = min(cur + timedelta(days=random.randint(0, 6)), end)
                sess_id += 1
                cfg = user_cfgs[0] if (len(user_cfgs) == 1 or random.random() < 0.85) else user_cfgs[1]
                prov = cfg["provider"]
                models, pin, pout, latb, tpsb, _ = PROVIDERS[prov]
                inter = int(clamp(lognorm(2.9, 0.65), 3, 90))
                in_tok = int(inter * clamp(lognorm(7.7, 0.7), 300, 30000))
                out_tok = int(inter * clamp(lognorm(6.9, 0.65), 120, 12000))
                tot_t = in_tok + out_tok
                cost = round(in_tok / 1e6 * pin + out_tok / 1e6 * pout, 4)
                lat_mult = (tot_t / 12000) ** 0.35
                lat_avg = int(clamp(latb * lat_mult * random.uniform(0.85, 1.25), 150, 20000))
                lat_p99 = int(lat_avg * random.uniform(2.2, 3.4))
                tps = round(clamp(tpsb * random.uniform(0.7, 1.3) / lat_mult, 5, 400), 1)
                eff = clamp(lognorm(-0.28, 0.28) + (0.04 if prov in ("OpenAI", "Anthropic") else 0), 0.30, 0.985)
                waste = clamp(1.05 - eff + lognorm(-2.0, 0.5), 0.02, 0.92)
                drift = clamp(waste * 0.55 + lognorm(-1.9, 0.6), 0.01, 0.95)
                hall = clamp(0.03 + waste * 0.16 + lognorm(-3.4, 0.5), 0.005, 0.9)
                cens = clamp(lognorm(-3.2, 0.55), 0.005, 0.8)
                bias = clamp(lognorm(-3.0, 0.5), 0.005, 0.8)
                flagged = random.random() < 0.035
                cri = (clamp(random.uniform(0.45, 0.97), 0, 1) if flagged else
                       clamp(waste * 0.25 + hall * 0.25 + lognorm(-2.6, 0.55) * 0.5, 0.01, 0.92))
                inj = clamp(cri * random.uniform(0.3, 0.9) + (0.25 if flagged and random.random() < 0.5 else 0), 0, 1)
                leak = clamp(cri * random.uniform(0.2, 0.8) + (0.2 if flagged and random.random() < 0.3 else 0), 0, 1)
                anom = clamp(cri * random.uniform(0.4, 1.0), 0, 1)
                hrisk = clamp(hall * 0.8 + cri * 0.2, 0, 1)
                brisk = clamp(bias * 0.8 + cri * 0.15, 0, 1)
                toolm = clamp(cri * random.uniform(0.1, 0.5), 0, 1)
                cri_peak = clamp(cri + random.uniform(0.0, 0.22), 0, 1)
                lvl = ("minimal" if cri < 0.2 else "low" if cri < 0.4 else
                       "moderate" if cri < 0.6 else "high" if cri < 0.8 else "critical")
                sec_events = poisson(cri * 4.5)
                crit_events = max(0, poisson(max(0.0, cri - 0.62) * 3))
                blocked = poisson(inj * 2.8)
                pii = 1 if random.random() < leak * 0.09 else 0
                d_lk = 1 if random.random() < leak * 0.05 else 0
                trust = ("full" if cri < 0.25 else "restricted" if cri < 0.55 else
                         "minimal" if cri < 0.8 else "revoked")
                status = ("flagged" if flagged and cri < 0.8 else
                          "terminated" if cri >= 0.8 else "completed")
                action = ("allow" if cri < 0.3 else "warn" if cri < 0.55 else
                          "restrict" if cri < 0.8 else "block")
                adv = 1 if random.random() < (0.20 if u["persona"] == "Security Engineer" else
                                              0.13 if u["persona"] == "Researcher" else 0.06) else 0
                bcmp = 1 if random.random() < 0.10 else 0
                expf = 1 if random.random() < 0.14 else 0
                alrt = 1 if random.random() < 0.09 else 0
                strs = 1 if random.random() < (0.12 if u["persona"] in ("Security Engineer", "ML Engineer") else 0.05) else 0
                for k, f in (("adversarial", adv), ("batch", bcmp), ("export", expf), ("alerts", alrt)):
                    user_feats[k] |= f
                succ = 0 if random.random() < 0.03 else 1
                err = "" if succ else random.choice(["timeout", "rate_limit", "context_length", "provider_error"])
                hour = random.choices(range(24), weights=[
                    1, 1, 0.5, 0.3, 0.3, 0.6, 1.5, 3, 5, 7, 8, 8,
                    7, 7, 7, 6.5, 6, 5, 4, 3.5, 3, 2.5, 2, 1.5], k=1)[0]
                monday = sday - timedelta(days=sday.weekday())
                sess = {
                    "session_id": f"sess_{sess_id:06d}",
                    "user_id": u["user_id"],
                    "config_id": cfg["config_id"],
                    "collection_location": u["collection_location"],
                    "session_date": rdate(sday),
                    "iso_week": f"{monday.isocalendar().year}-W{monday.isocalendar().week:02d}",
                    "weekday": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][sday.weekday()],
                    "start_hour_utc": hour,
                    "duration_minutes": round(clamp(inter * lat_avg / 60000 * 2.2, 1, 180), 1),
                    "provider": prov, "model": cfg["model"],
                    "user_persona": u["persona"],
                    "signup_program": u["signup_program"],
                    "cohort_month": u["cohort_month"],
                    "interaction_count": inter,
                    "input_tokens": in_tok, "output_tokens": out_tok,
                    "total_tokens": tot_t, "llm_cost_usd": cost,
                    "latency_avg_ms": lat_avg, "latency_p99_ms": lat_p99,
                    "tokens_per_second": tps,
                    "efficiency_ratio": round(eff, 4),
                    "cognitive_waste_index": round(waste, 4),
                    "semantic_drift": round(drift, 4),
                    "hallucination_prob": round(hall, 4),
                    "censorship_score": round(cens, 4),
                    "bias_score": round(bias, 4),
                    "cri_avg": round(cri, 4), "cri_peak": round(cri_peak, 4),
                    "cri_level": lvl,
                    "injection_risk": round(inj, 4), "leakage_risk": round(leak, 4),
                    "hallucination_risk": round(hrisk, 4), "bias_risk": round(brisk, 4),
                    "anomaly_risk": round(anom, 4), "tool_misuse_risk": round(toolm, 4),
                    "security_events_count": sec_events,
                    "critical_events_count": crit_events,
                    "blocked_actions_count": blocked,
                    "pii_detected_flag": pii, "data_leakage_flag": d_lk,
                    "trust_level_at_end": trust,
                    "session_status": status,
                    "enforcement_action": action,
                    "adversarial_test_used": adv,
                    "batch_comparison_used": bcmp,
                    "csv_export_used": expf,
                    "custom_alerts_used": alrt,
                    "stress_test_used": strs,
                    "success_flag": succ,
                    "error_type": err,
                }
                sessions.append(sess)
                cfg["total_sessions"] += 1
                cfg["total_interactions"] += inter
                cfg["total_input_tokens"] += in_tok
                cfg["total_output_tokens"] += out_tok
                cfg["total_llm_cost_usd"] = round(cfg["total_llm_cost_usd"] + cost, 4)
                cfg["avg_efficiency_ratio"] += eff
                cfg["avg_waste_index"] += waste
                cfg["avg_cri"] += cri
                cfg["max_cri"] = max(cfg["max_cri"], cri)
                cfg["adversarial_tests_run"] += adv
                cfg["last_used_date"] = rdate(sday)
                last_active = sday
                tot_tok += tot_t
                tot_sessions += 1
                tot_cost += cost
            cur += timedelta(days=7)
            wk += 1
        u["total_sessions"] = tot_sessions
        u["total_tokens_used"] = tot_tok
        u["total_llm_cost_usd"] = round(tot_cost, 2)
        u["last_active_date"] = rdate(last_active) if last_active else ""
        u["lifetime_days_active"] = (end - act_date).days
        if last_active:
            u["days_since_last_active"] = (TODAY - last_active).days
            u["inactive_30d_flag"] = 1 if (TODAY - last_active).days > 30 else 0
            if u["inactive_30d_flag"]:
                for c in user_cfgs:
                    c["config_status"] = "dormant"
        u["power_user_flag"] = 1 if tot_sessions >= 25 else 0
        if random.random() < 0.72:
            base_nps = 7.9 + (0.6 if u["signup_program"] in ("invite_code", "campus_workshop") else 0) \
                       + random.gauss(0, 1.25)
            u["nps_score"] = int(clamp(round(base_nps), 0, 10))
        user_features[u["user_id"]] = user_feats

    for c in user_cfgs:
        if c["total_sessions"]:
            nsc = c["total_sessions"]
            c["avg_efficiency_ratio"] = round(c["avg_efficiency_ratio"] / nsc, 4)
            c["avg_waste_index"] = round(c["avg_waste_index"] / nsc, 4)
            c["avg_cri"] = round(c["avg_cri"] / nsc, 4)
            c["first_session_date"] = u["activation_date"]
            if c["is_primary_config"]:
                c["days_to_first_session"] = (
                    date.fromisoformat(u["activation_date"]) - date.fromisoformat(c["created_date"])).days
        else:
            c["avg_efficiency_ratio"] = c["avg_waste_index"] = c["avg_cri"] = 0

# ================================================================== writes ==
def write_csv(name, rows, fields):
    path = os.path.join(OUT, name)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow(r)

V_FIELDS = list(visitors[0].keys())
S_FIELDS = list(signups[0].keys())
C_FIELDS = list(configs[0].keys())
SE_FIELDS = list(sessions[0].keys())

write_csv("web_visitors.csv", visitors, V_FIELDS)
write_csv("user_signups.csv", signups, S_FIELDS)
write_csv("api_key_configs.csv", configs, C_FIELDS)
write_csv("monitoring_sessions.csv", sessions, SE_FIELDS)

# per-LOCATION user files (the two data-collection locations)
for loc in LOCATIONS:
    write_csv(LOC_FILES[loc],
              [u for u in signups if u["collection_location"] == loc], S_FIELDS)

# ----- funnel overall / by channel / by location
n_vis = len(visitors)
n_sig = len(signups)
n_cfg = sum(u["api_key_connected_flag"] for u in signups)
n_act = sum(u["activated_within_7d_flag"] for u in signups)
med = lambda xs: (sorted(xs)[len(xs) // 2] if xs else "")
d_visit_sig = [u["days_visit_to_signup"] for u in signups]
d_sig_cfg = [u["days_to_first_config"] for u in signups if u["days_to_first_config"] != ""]
d_cfg_act = [u["days_to_activate"] - u["days_to_first_config"]
             for u in signups if u["activated_within_7d_flag"]]
stage_users = [n_vis, n_sig, n_cfg, n_act]
stage_names = ["1. Website Visit", "2. Signup (Account Created)",
               "3. API Key Connected", "4. Activation (First Monitoring Session)"]
stage_desc = [
    "Unique visitor lands on monitr.ai marketing site (tracked via GA4 gtag user-id)",
    "Visitor creates account on /auth (Firebase auth record created)",
    "User connects an LLM provider key on /key (Convex apiConfigs row created)",
    "User starts a monitoring session on /dashboard within 7 days of connecting a key",
]
med_days = [0, med(d_visit_sig), med(d_sig_cfg), med(d_cfg_act)]
FUNNEL_FIELDS = ["stage_order", "stage_name", "users", "description",
                 "conversion_from_previous_pct", "conversion_from_top_pct",
                 "median_days_from_previous", "dropoff_from_previous"]
write_csv("funnel_overall.csv",
          [{"stage_order": i + 1, "stage_name": stage_names[i], "users": stage_users[i],
            "description": stage_desc[i],
            "conversion_from_previous_pct": round(stage_users[i] / stage_users[i - 1] * 100, 2) if i else 100.0,
            "conversion_from_top_pct": round(stage_users[i] / stage_users[0] * 100, 2),
            "median_days_from_previous": med_days[i],
            "dropoff_from_previous": (stage_users[i - 1] - stage_users[i]) if i else 0}
           for i in range(4)], FUNNEL_FIELDS)

def funnel_dim(dim, vals, fname):
    rows = []
    for dv in vals:
        nv = sum(1 for v in visitors if v[dim] == dv)
        ns = sum(1 for u in signups if u[dim] == dv)
        nc = sum(1 for u in signups if u[dim] == dv and u["api_key_connected_flag"])
        na = sum(1 for u in signups if u[dim] == dv and u["activated_within_7d_flag"])
        for i, val in enumerate([nv, ns, nc, na]):
            prev = [nv, ns, nc, na][i - 1] if i else val
            rows.append({dim: dv, "stage_order": i + 1, "stage_name": stage_names[i],
                         "users": val,
                         "conversion_from_previous_pct": round(val / prev * 100, 2) if prev else 0,
                         "conversion_from_top_pct": round(val / nv * 100, 2) if nv else 0})
    write_csv(fname, rows, [dim, "stage_order", "stage_name", "users",
                            "conversion_from_previous_pct", "conversion_from_top_pct"])

funnel_dim("acquisition_channel", CHANNELS, "funnel_by_channel.csv")
funnel_dim("collection_location", LOCATIONS, "funnel_by_location.csv")

# ----- KPI monthly (overall + by location)  [pre-launch: engagement only]
sess_by_month = {}
for ssn in sessions:
    sess_by_month.setdefault(ssn["session_date"][:7], []).append(ssn)

active_by_month = {mk: set(s["user_id"] for s in sess_by_month.get(mk, []))
                   for mk in MONTHS}
power_by_month = {}
for mk in MONTHS:
    cnt = {}
    for s in sess_by_month.get(mk, []):
        cnt[s["user_id"]] = cnt.get(s["user_id"], 0) + 1
    power_by_month[mk] = sum(1 for c in cnt.values() if c >= 8)

kpi_rows = []
for mi, mk in enumerate(MONTHS):
    mstart = date.fromisoformat(mk + "-01")
    mend = min(date(mstart.year + (mstart.month == 12), (mstart.month % 12) + 1, 1)
               - timedelta(days=1), TODAY)
    if mstart > TODAY:
        continue
    v_m = sum(1 for v in visitors if v["first_visit_date"].startswith(mk))
    s_m = [u for u in signups if u["signup_date"].startswith(mk)]
    cfg_m = sum(1 for c in configs if c["created_date"].startswith(mk))
    act_m = sum(1 for u in signups if u["activation_date"] and u["activation_date"].startswith(mk))
    sess_m = sess_by_month.get(mk, [])
    n_sess = len(sess_m)
    mau = len(active_by_month[mk])
    days_in_m = (mend - mstart).days + 1
    day_users, week_users = {}, {}
    for s in sess_m:
        day_users.setdefault(s["session_date"], set()).add(s["user_id"])
        week_users.setdefault(s["iso_week"], set()).add(s["user_id"])
    dau_avg = round(sum(len(x) for x in day_users.values()) / max(days_in_m, 1), 1)
    wau = round(sum(len(x) for x in week_users.values()) / max(len(week_users), 1), 1) if week_users else 0
    tot_tok_m = sum(s["total_tokens"] for s in sess_m)
    cost_m = sum(s["llm_cost_usd"] for s in sess_m)
    waste_m = sum(s["cognitive_waste_index"] for s in sess_m) / n_sess if n_sess else 0
    eff_m = sum(s["efficiency_ratio"] for s in sess_m) / n_sess if n_sess else 0
    cri_m = sum(s["cri_avg"] for s in sess_m) / n_sess if n_sess else 0
    sec_m = sum(s["security_events_count"] for s in sess_m)
    flag_m = sum(1 for s in sess_m if s["session_status"] in ("flagged", "terminated"))
    power = power_by_month[mk]
    ret_next = ""
    if mi + 1 < len(MONTHS) and MONTHS[mi + 1] <= TODAY.strftime("%Y-%m"):
        nxt = active_by_month[MONTHS[mi + 1]]
        if mau and nxt:
            ret_next = round(len(active_by_month[mk] & nxt) / mau * 100, 1)
    invite_m = sum(1 for u in s_m if u["signup_program"] == "invite_code"
                   or u["acquisition_channel"] == "referral")
    campus_m = sum(1 for u in s_m if u["collection_location"] == "DSU Campus")
    nps_v = [u["nps_score"] for u in signups if u["nps_score"] != "" and u["cohort_month"] == mk]
    nps_m = round((sum(1 for x in nps_v if x >= 9) - sum(1 for x in nps_v if x <= 6)) / len(nps_v) * 100, 1) if nps_v else ""
    coh = [u for u in signups if u["cohort_month"] == mk and u["activated_within_7d_flag"]]
    w4r = ""
    if coh and (TODAY - mstart).days >= 45:
        ret = 0
        for u in coh:
            ad = date.fromisoformat(u["activation_date"])
            lo, hi = ad + timedelta(days=28), ad + timedelta(days=35)
            if any(s["user_id"] == u["user_id"] and lo <= date.fromisoformat(s["session_date"]) < hi for s in sessions):
                ret += 1
        w4r = round(ret / len(coh) * 100, 1)
    kpi_rows.append({
        "month": mk, "month_label": datetime.strptime(mk, "%Y-%m").strftime("%b %Y"),
        "days_in_month": days_in_m,
        "website_visitors": v_m, "new_signups": len(s_m),
        "visitor_to_signup_cvr_pct": round(len(s_m) / v_m * 100, 2) if v_m else 0,
        "api_keys_connected": cfg_m, "activations": act_m,
        "activation_rate_pct": round(act_m / len(s_m) * 100, 1) if s_m else 0,
        "invite_referral_signups": invite_m,
        "invite_referral_share_pct": round(invite_m / len(s_m) * 100, 1) if s_m else 0,
        "campus_signup_share_pct": round(campus_m / len(s_m) * 100, 1) if s_m else 0,
        "wau_avg": wau, "mau": mau, "dau_avg": dau_avg,
        "stickiness_dau_mau_pct": round(dau_avg / mau * 100, 1) if mau else 0,
        "total_sessions": n_sess,
        "sessions_per_active_user": round(n_sess / mau, 2) if mau else 0,
        "power_users": power,
        "power_user_share_pct": round(power / mau * 100, 1) if mau else 0,
        "next_month_return_rate_pct": ret_next,
        "total_tokens_millions": round(tot_tok_m / 1e6, 2),
        "total_llm_cost_usd": round(cost_m, 2),
        "avg_efficiency_ratio": round(eff_m, 3),
        "avg_cognitive_waste_index": round(waste_m, 3),
        "avg_cri": round(cri_m, 3),
        "security_events_per_100_sessions": round(sec_m / n_sess * 100, 1) if n_sess else 0,
        "flagged_sessions_pct": round(flag_m / n_sess * 100, 2) if n_sess else 0,
        "w4_retention_pct": w4r, "nps": nps_m,
    })
write_csv("kpi_monthly.csv", kpi_rows, list(kpi_rows[0].keys()))

kml_rows = []
for mk in MONTHS:
    mstart = date.fromisoformat(mk + "-01")
    if mstart > TODAY:
        continue
    for loc in LOCATIONS:
        v_m = sum(1 for v in visitors
                  if v["first_visit_date"].startswith(mk) and v["collection_location"] == loc)
        s_m = [u for u in signups if u["signup_date"].startswith(mk) and u["collection_location"] == loc]
        act_m = sum(1 for u in s_m if u["activated_within_7d_flag"])
        se_m = [ss for ss in sess_by_month.get(mk, []) if ss["collection_location"] == loc]
        n_se = len(se_m)
        cnt = {}
        for s in se_m:
            cnt[s["user_id"]] = cnt.get(s["user_id"], 0) + 1
        kml_rows.append({
            "month": mk, "collection_location": loc,
            "website_visitors": v_m, "new_signups": len(s_m),
            "activations": act_m,
            "activation_rate_pct": round(act_m / len(s_m) * 100, 1) if s_m else 0,
            "total_sessions": n_se,
            "mau": len(set(ss["user_id"] for ss in se_m)),
            "power_users": sum(1 for c in cnt.values() if c >= 8),
            "sessions_per_active_user": round(n_se / len(cnt), 2) if cnt else 0,
            "avg_cognitive_waste_index":
                round(sum(ss["cognitive_waste_index"] for ss in se_m) / n_se, 3) if n_se else 0,
            "avg_cri": round(sum(ss["cri_avg"] for ss in se_m) / n_se, 3) if n_se else 0,
        })
write_csv("kpi_monthly_by_location.csv", kml_rows, list(kml_rows[0].keys()))

# ----- retention cohorts (weekly)
from collections import defaultdict
sess_user_dates = defaultdict(set)
for s in sessions:
    sess_user_dates[s["user_id"]].add(s["session_date"])
coh_by = defaultdict(list)
for u in signups:
    if u["activated_within_7d_flag"]:
        coh_by[u["cohort_month"]].append(u)
coh_rows = []
for cm in sorted(coh_by):
    users_in = coh_by[cm]
    size = len(users_in)
    for wkn in range(0, 13):
        active_n = 0
        possible = False
        for u in users_in:
            ad = date.fromisoformat(u["activation_date"])
            lo, hi = ad + timedelta(days=7 * wkn), ad + timedelta(days=7 * (wkn + 1))
            if lo > TODAY:
                continue
            possible = True
            if any(lo <= date.fromisoformat(d) < hi for d in sess_user_dates.get(u["user_id"], ())):
                active_n += 1
        if not possible:
            continue
        coh_rows.append({"cohort_month": cm, "week_number": wkn,
                         "cohort_size": size, "active_users": active_n,
                         "retention_pct": round(active_n / size * 100, 1)})
write_csv("retention_cohorts.csv", coh_rows,
          ["cohort_month", "week_number", "cohort_size", "active_users", "retention_pct"])

# ----- feature adoption (overall + by persona)
FEATS = [("adversarial_test_used", "Adversarial / Red-Team Tests",
          "Probing models with uncensored LLM for bias & censorship detection"),
         ("batch_comparison_used", "Batch Model Comparisons",
          "Run same prompt across multiple providers and diff results"),
         ("csv_export_used", "Telemetry CSV Export",
          "Export raw telemetry for external analysis"),
         ("custom_alerts_used", "Custom CRI Alerts",
          "Threshold alerts on Cognitive Risk Index"),
         ("stress_test_used", "Stress Test Suites",
          "Structured stress-testing of connected models")]
activated_users = [u for u in signups if u["activated_within_7d_flag"]]
user_sess = defaultdict(list)
for s in sessions:
    user_sess[s["user_id"]].append(s)
FA_FIELDS = ["persona", "feature_key", "feature_name", "feature_description",
             "users_used", "activated_users_in_scope", "adoption_pct"]
fa_rows = []
for group in ["ALL"] + PERSONAS:
    us = [u for u in activated_users if group == "ALL" or u["persona"] == group]
    if not us:
        continue
    for fkey, fname, fdesc in FEATS:
        used = sum(1 for u in us if any(s[fkey] for s in user_sess.get(u["user_id"], ())))
        fa_rows.append({"persona": group, "feature_key": fkey, "feature_name": fname,
                        "feature_description": fdesc, "users_used": used,
                        "activated_users_in_scope": len(us),
                        "adoption_pct": round(used / len(us) * 100, 1)})
write_csv("feature_adoption.csv", fa_rows, FA_FIELDS)
write_csv("feature_adoption_overall.csv", [r for r in fa_rows if r["persona"] == "ALL"], FA_FIELDS)
write_csv("feature_adoption_by_persona.csv", [r for r in fa_rows if r["persona"] != "ALL"], FA_FIELDS)

# ----- KPI definitions (pre-launch: no revenue KPIs)
LM = "2026-08"  # latest complete month
lm = [k for k in kpi_rows if k["month"] == LM][0]
overall_act_rate = round(n_act / n_sig * 100, 1)
overall_v2s = round(n_sig / n_vis * 100, 2)
overall_s2c = round(n_cfg / n_sig * 100, 1)
overall_c2a = round(n_act / n_cfg * 100, 1) if n_cfg else 0
invite_rate = round(sum(1 for u in signups if u["signup_program"] == "invite_code"
                        or u["acquisition_channel"] == "referral") / n_sig * 100, 1)
inactive_rate = round(sum(1 for u in signups if u["inactive_30d_flag"]) /
                      max(1, n_act) * 100, 1)
power_overall = round(sum(1 for u in signups if u["power_user_flag"]) / max(1, n_act) * 100, 1)
med_tta = med([u["days_to_activate"] for u in signups if u["days_to_activate"] != ""])
kpi_defs = [
    ("North Star", "Weekly Observing Users (WOU)",
     "Unique users with >=1 monitored LLM session per ISO week",
     "COUNTD(user_id) of monitoring_sessions per week, averaged per month",
     f"{lm['wau_avg']} (Aug 2026)", ">= 350 by Q4-2026", "Attention",
     "Captures the core value loop: a user only counts if they actually observed their "
     "LLMs through monitr-ai. One guardrail metric aligning acquisition, activation and retention."),
    ("Acquisition", "Visitor -> Signup Conversion Rate",
     "Share of unique marketing-site visitors who create an account",
     "signups / unique visitors * 100 (per period)",
     f"{overall_v2s}% overall; {lm['month_label']}: {lm['visitor_to_signup_cvr_pct']}%", "6-8%", "On track",
     "Measures top-of-funnel message-market fit of the landing page."),
    ("Acquisition", "Signup -> Key Connection Rate",
     "Share of new accounts that connect at least one LLM provider API key",
     "users with >=1 row in api_key_configs / signups * 100",
     f"{overall_s2c}%", ">= 65%", "On track",
     "The biggest intentional-friction step in onboarding (API key entry). Gates every downstream metric."),
    ("Growth", "Invite & Referral Rate",
     "Share of signups arriving via invite codes or the referral channel",
     "(invite_code + referral-channel signups) / total signups * 100",
     f"{invite_rate}%", ">= 20% pre-launch", "On track",
     "Pre-launch growth is pure word-of-mouth; this measures the health of the viral loop while there is no paid marketing scale."),
    ("Activation", "Activation Rate (Aha! within 7 days)",
     "Share of signups who run their first monitoring session within 7 days of connecting a key",
     "users with activation_date - first_config_date <= 7d / signups * 100",
     f"{overall_act_rate}% overall; {lm['month_label']}: {lm['activation_rate_pct']}%", ">= 45%", "On track",
     "Activation = first moment of realized value (live token efficiency / CRI). Strongest predictor of W4 retention."),
    ("Activation", "Median Time-to-Activate (TTA)",
     "Median days from account creation to first monitoring session",
     "median(days_to_activate) over activated users",
     f"{med_tta} days", "<= 2 days", "On track",
     "Every extra day before first value multiplies abandonment risk."),
    ("Activation", "Onboarding Completion Rate",
     "Share of signups finishing >=4 of 5 onboarding steps",
     "AVG(onboarding_completed_flag)",
     f"{round(sum(u['onboarding_completed_flag'] for u in signups) / len(signups) * 100, 1)}%", ">= 80%", "On track",
     "Users who finish onboarding connect keys at ~1.2x the rate; incomplete onboarding predicts early inactivity."),
    ("Engagement", "Monthly Active Users (MAU)",
     "Unique users with >=1 session in the month",
     "COUNTD(user_id) per month from monitoring_sessions",
     f"{lm['mau']} ({lm['month_label']})", "grow 15% MoM", "On track",
     "Core reach metric of the product's recurring value."),
    ("Engagement", "Stickiness (DAU/MAU)",
     "Average daily actives as share of monthly actives",
     "avg(DAU) / MAU * 100",
     f"{lm['stickiness_dau_mau_pct']}%", ">= 20% for devtools", "On track",
     "Observability is episodic (incident-driven); alerts and digests convert reactive use into habit."),
    ("Engagement", "Sessions per Active User",
     "Average monitored sessions per active user per month",
     "COUNT(session_id) / COUNTD(user_id) per month",
     f"{lm['sessions_per_active_user']}", ">= 4", "On track",
     "Depth of usage distinguishes power users from drive-by evaluators."),
    ("Engagement", "Power User Share",
     "Share of monthly active users with >=8 sessions in the month",
     "COUNTD(users with >=8 sessions in month) / MAU * 100",
     f"{lm['power_user_share_pct']}% ({lm['month_label']}); {power_overall}% of all activated are power-grade", ">= 30%", "Attention",
     "Power users anchor retention and drive most of the monitored token volume; growing this share is the key pre-launch lever."),
    ("Retention", "W4 Retention of Activated Users",
     "Share of a signup cohort still active in week 4 after activation",
     "cohort users with >=1 session in activation+[28,35)d / cohort size",
     f"{lm['w4_retention_pct']}% ({lm['month_label']} cohorts)", ">= 35%", "On track",
     "The PMF litmus test; flat curves after week 4 signal durable habit."),
    ("Retention", "Next-Month Return Rate",
     "Share of users active this month who are also active next month",
     "COUNTD(intersect(active_m, active_m+1)) / COUNTD(active_m) * 100",
     f"{lm['next_month_return_rate_pct']}%", ">= 60%", "On track",
     "Pre-launch 'churn' is inactivity, not cancellation - this is the direct measure of it."),
    ("Retention", "30-Day Inactivity Rate",
     "Share of activated users with no session in the last 30 days",
     "users with days_since_last_active > 30 / activated users * 100",
     f"{inactive_rate}%", "<= 35%", "On track",
     "Substitute for churn in a pre-launch product; spikes usually trace to onboarding drop-offs or semester breaks (campus segment)."),
    ("Product Value", "Avg Cognitive Waste Index",
     "Proprietary 0-1 score: semantic drift + token inefficiency + quality loss (lower is better)",
     "AVG(cognitive_waste_index) over sessions",
     f"{lm['avg_cognitive_waste_index']}", "<= 0.25 and falling", "On track",
     "The metric users come to monitr-ai to reduce; a falling platform-wide average evidences real delivered value."),
    ("Product Value", "Avg Efficiency Ratio",
     "Useful output tokens / total tokens exchanged (higher is better)",
     "AVG(efficiency_ratio) over sessions",
     f"{lm['avg_efficiency_ratio']}", ">= 0.80", "On track",
     "Translates directly to the monitored LLM spend that monitr-ai optimizes."),
    ("Product Safety", "Avg Cognitive Risk Index (CRI)",
     "Weighted risk across injection/leakage/hallucination/bias/anomaly/tool-misuse",
     "AVG(cri_avg) over sessions; level bands min/low/mod/high/critical",
     f"{lm['avg_cri']}", "<= 0.25", "On track",
     "Headline trust-safety KPI; drives zero-trust enforcement actions."),
    ("Product Safety", "Security Events per 100 Sessions",
     "Rate of security detections (injection, PII, leakage) normalized by usage",
     "SUM(security_events_count) / COUNT(sessions) * 100",
     f"{lm['security_events_per_100_sessions']}", "stable as volume grows", "Watch",
     "Rising with adversarial-test adoption is healthy; rising in production traffic signals attacks."),
    ("Satisfaction", "NPS of Activated Users",
     "Net Promoter Score surveyed ~7 days after activation",
     "(percent promoters(9-10) - percent detractors(0-6)) * 100",
     f"{lm['nps']}", ">= 40", "On track",
     "Predicts invite/referral growth - the only growth engine that exists pre-launch."),
]
write_csv("kpi_definitions.csv",
          [{"kpi_category": a, "kpi_name": b, "definition": c,
            "measurement_formula": d, "current_value_aug_2026": str(e),
            "target_benchmark": f, "status": g, "significance_interpretation": h}
           for a, b, c, d, e, f, g, h in kpi_defs],
          ["kpi_category", "kpi_name", "definition", "measurement_formula",
           "current_value_aug_2026", "target_benchmark", "status",
           "significance_interpretation"])

# ----- summary json (all numbers the dashboard text cites)
def loc_stats(loc):
    us = [u for u in signups if u["collection_location"] == loc]
    act = [u for u in us if u["activated_within_7d_flag"]]
    nps = [u["nps_score"] for u in us if u["nps_score"] != ""]
    return {
        "signups": len(us),
        "sessions": sum(1 for ss in sessions if ss["collection_location"] == loc),
        "activation_rate": round(len(act) / max(1, len(us)) * 100, 1),
        "onboarding_rate": round(sum(u["onboarding_completed_flag"] for u in us) / max(1, len(us)) * 100, 1),
        "invite_share": round(sum(1 for u in us if u["signup_program"] == "invite_code"
                                  or u["acquisition_channel"] == "referral") / max(1, len(us)) * 100, 1),
        "workshop_share": round(sum(1 for u in us if u["signup_program"] == "campus_workshop") / max(1, len(us)) * 100, 1),
        "inactive_rate": round(sum(u["inactive_30d_flag"] for u in us) / max(1, len(act)) * 100, 1),
        "power_share": round(sum(u["power_user_flag"] for u in us) / max(1, len(act)) * 100, 1),
        "avg_sessions_per_user": round(sum(u["total_sessions"] for u in us) / max(1, len(act)), 1),
        "avg_nps": round(sum(nps) / len(nps), 1) if nps else "",
        "edu_email_pct": round(sum(1 for u in us if u["email_domain_type"] == "university.edu") / max(1, len(us)) * 100, 1),
        "top_persona": max(PERSONAS, key=lambda p: sum(1 for u in us if u["persona"] == p)),
    }

summary = {
    "n_visitors": n_vis, "n_signups": n_sig, "n_config_users": n_cfg,
    "n_config_rows": len(configs), "n_activated": n_act,
    "overall_v2s": overall_v2s, "overall_s2c": overall_s2c,
    "overall_c2a": overall_c2a, "overall_act_rate": overall_act_rate,
    "med_tta": med_tta,
    "med_visit_sig": med(d_visit_sig), "med_sig_cfg": med(d_sig_cfg), "med_cfg_act": med(d_cfg_act),
    "aug": lm,
    "invite_rate": invite_rate, "inactive_rate": inactive_rate, "power_overall": power_overall,
    "n_sessions": len(sessions),
    "sess_per_user": round(len(sessions) / max(1, len(set(s["user_id"] for s in sessions))), 1),
    "persona_activation": {p: round(
        sum(1 for u in signups if u["persona"] == p and u["activated_within_7d_flag"]) /
        max(1, sum(1 for u in signups if u["persona"] == p)) * 100, 1) for p in PERSONAS},
    "channel_activation": {c: round(
        sum(1 for u in signups if u["acquisition_channel"] == c and u["activated_within_7d_flag"]) /
        max(1, sum(1 for u in signups if u["acquisition_channel"] == c)) * 100, 1) for c in CHANNELS},
    "hour_hist": {h: sum(1 for s in sessions if s["start_hour_utc"] == h) for h in range(24)},
    "weekday_sessions": {wd: sum(1 for s in sessions if s["weekday"] == wd)
                         for wd in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]},
    "nps_overall": round((sum(1 for u in signups if u["nps_score"] != "" and u["nps_score"] >= 9)
                          - sum(1 for u in signups if u["nps_score"] != "" and u["nps_score"] <= 6))
                         / max(1, sum(1 for u in signups if u["nps_score"] != "")) * 100, 1),
    "provider_tokens": {p: sum(s["total_tokens"] for s in sessions if s["provider"] == p)
                        for p in PNAMES},
    "location": {loc: loc_stats(loc) for loc in LOCATIONS},
}
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "summary.json"), "w") as f:
    json.dump(summary, f, indent=1)

print("ROWS: visitors", n_vis, "| signups", n_sig, "| configs", len(configs),
      "| sessions", len(sessions))
print("FUNNEL:", [(st, n, round(n / stage_users[i - 1] * 100, 1) if i else 100)
      for i, (st, n) in enumerate(zip(stage_names, stage_users))])
print("AUG:", {k: lm[k] for k in ["wau_avg", "mau", "total_sessions", "power_users",
                                  "next_month_return_rate_pct", "w4_retention_pct", "nps"]})
print("LOCATION:", json.dumps(summary["location"], indent=1))
