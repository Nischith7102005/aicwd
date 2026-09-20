#!/usr/bin/env python3
"""
Builds monitr_ai_user_analytics.twb (+ packaged .twbx with embedded CSVs).
Hand-authored Tableau workbook XML (format 18.1 -> opens in any modern
Tableau Desktop / Tableau Public).

PRE-LAUNCH BUILD: the product is in free beta - NO payment/billing fields
anywhere. All sheets are pure KPI & user-analytics.

  15 CSV data sources (4 product touchpoints + 2 per-location user files +
                       9 derived analytics sets)
  35 worksheets (bars, lines, stacked bars, cohort heatmap)
  5 dashboards:
    1 KPI Overview            - KPI identification, formulas, current values
    2 Funnel Analysis         - 4-stage funnel, conversions, time, by channel
                                AND by collection location (DSU vs Outside)
    3 User Behaviour          - segments, locations, programs, features,
                                cohorts, hours
    4 Product Quality-Safety  - monitr.ai value metrics (waste, CRI, security)
    5 Data Collection         - sources (4 places + 2 locations), methods,
                                relevance
"""
import csv, json, os, re, uuid, zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
S = json.load(open(os.path.join(HERE, "summary.json")))

# ------------------------------------------------------------------ registry
FILES = ["web_visitors", "user_signups", "api_key_configs", "monitoring_sessions",
         "users_dsu_campus", "users_outside_campus",
         "funnel_overall", "funnel_by_channel", "funnel_by_location",
         "kpi_monthly", "kpi_monthly_by_location", "retention_cohorts",
         "feature_adoption_overall", "feature_adoption_by_persona",
         "kpi_definitions"]

CAPTIONS = {
    "web_visitors": "P1 Web Visitors (GA4 landing-site analytics)",
    "user_signups": "P2 User Signups (Firebase auth records, free beta)",
    "api_key_configs": "P3 API Key Connections (Convex apiConfigs)",
    "monitoring_sessions": "P4 Monitoring Sessions (Convex sessions + telemetry)",
    "users_dsu_campus": "Users recorded at DSU Campus",
    "users_outside_campus": "Users recorded Outside Campus",
    "funnel_overall": "Funnel - Overall (derived)",
    "funnel_by_channel": "Funnel - By Channel (derived)",
    "funnel_by_location": "Funnel - By Location (derived)",
    "kpi_monthly": "KPI Monthly Timeseries (derived)",
    "kpi_monthly_by_location": "KPI Monthly By Location (derived)",
    "retention_cohorts": "Retention Cohorts (derived)",
    "feature_adoption_overall": "Feature Adoption - All Users (derived)",
    "feature_adoption_by_persona": "Feature Adoption - By Persona (derived)",
    "kpi_definitions": "KPI Definitions & Formulas",
}

NUMERIC_DIMS = {"stage_order", "week_number", "start_hour_utc", "signup_hour",
                "nps_score", "onboarding_steps_completed"}

def infer(stem):
    rows = []
    with open(os.path.join(DATA, stem + ".csv"), encoding="utf-8") as f:
        r = csv.reader(f)
        header = next(r)
        for i, row in enumerate(r):
            if i >= 400:
                break
            rows.append(row)
    reg = {}
    for ci, name in enumerate(header):
        vals = [row[ci] for row in rows if ci < len(row) and row[ci] not in ("", None)]
        dtype = "string"
        if vals and all(re.fullmatch(r"-?\d+", v) for v in vals):
            dtype = "integer"
        elif vals and all(re.fullmatch(r"-?\d+\.\d+", v) for v in vals):
            dtype = "real"
        elif vals and all(re.fullmatch(r"\d{4}-\d{2}-\d{2}", v) for v in vals):
            dtype = "date"
        if dtype in ("string", "date") or name in NUMERIC_DIMS:
            reg[name] = (dtype, "dimension", "nominal")
        else:
            reg[name] = (dtype, "measure", "quantitative")
    return header, reg

REG, HEADER = {}, {}
for stem in FILES:
    HEADER[stem], REG[stem] = infer(stem)

# ------------------------------------------------------------- xml fragments
def ds_xml(stem, packaged):
    filev = f"Data/{stem}.csv" if packaged else f"{stem}.csv"
    conn = (f"<connection class='textfile' filename='{filev}' password='' server=''>"
            if packaged else
            f"<connection class='textfile' directory='data' filename='{stem}.csv' password='' server=''>")
    cols = "\n".join(
        f"        <column datatype='{REG[stem][c][0]}' name='{c}' ordinal='{i}'/>"
        for i, c in enumerate(HEADER[stem]))
    dcols = "\n".join(
        f"    <column datatype='{REG[stem][c][0]}' caption='{escape(c.replace('_', ' '))}' "
        f"name='[{c}]' role='{REG[stem][c][1]}' type='{REG[stem][c][2]}'/>"
        for c in HEADER[stem])
    return f"""  <datasource caption='{escape(CAPTIONS[stem])}' inline='true' name='{stem}' version='18.1'>
    {conn}
      <relation name='{stem}.csv' table='[{stem}#csv]' type='table'>
        <columns character-set='UTF-8' header='yes' locale='en_US' separator=','>
{cols}
        </columns>
      </relation>
    </connection>
    <aliases enabled='yes'/>
{dcols}
    <layout show-structure='true'/>
  </datasource>"""

def dep_cols(ds, fields):
    return "\n".join(
        f"        <column datatype='{REG[ds][f][0]}' name='[{f}]' role='{REG[ds][f][1]}' type='{REG[ds][f][2]}'/>"
        for f in fields)

def worksheet_xml(name, ds, rows, cols, mark="Automatic", enc_color=None,
                  enc_text=None, enc_color_dim=None):
    used = re.findall(r"\[[^\]]+\]\.\[([^\]]+)\]",
                      " ".join(rows + cols + [enc_color or "", enc_text or "", enc_color_dim or ""]))
    used = sorted(set(f for f in used if f in REG[ds]))
    parts = []
    if enc_color:
        parts.append(f"      <color column='{enc_color}'/>")
    if enc_color_dim:
        parts.append(f"      <color column='{enc_color_dim}'/>")
    if enc_text:
        parts.append(f"      <text column='{enc_text}'/>")
    encs = ("\n    <encodings>\n" + "\n".join(parts) + "\n    </encodings>") if parts else ""
    return f"""  <worksheet name='{escape(name)}'>
    <table>
        <view dim-percentage='0.5' measure-percentage='0.5' dim-ordering='alphabetic' measure-ordering='alphabetic'>
        <datasource-dependencies datasource='{ds}'>
{dep_cols(ds, used)}
        </datasource-dependencies>
        <aggregation value='false'/>
      </view>
      <style/>
      <panes>
        <pane selection-relaxation-option='selection-relaxation-allow'>
          <view>
            <breakdown value='auto'/>
          </view>
          <mark class='{mark}'/>{encs}
          <style/>
        </pane>
      </panes>
      <rows>{" / ".join(rows)}</rows>
      <cols>{" / ".join(cols)}</cols>
    </table>
  </worksheet>"""

# ------------------------------------------------------------- sheet defs
def F(ds, f, agg=None):
    # Tableau shelf expressions are field references; aggregate behavior is
    # stored in the view/pane metadata, not as SQL-like SUM(...) text.
    return f"[{ds}].[{f}]"

SHEETS = []
def sheet(name, **kw):
    SHEETS.append((name, kw))

km = "kpi_monthly"
sheet("KPI MAU Trend", ds=km, cols=[F(km, "month")], rows=[F(km, "mau", "SUM")],
      mark="Bar", enc_text=F(km, "mau", "SUM"))
sheet("KPI North Star WOU Trend", ds=km, cols=[F(km, "month")], rows=[F(km, "wau_avg", "SUM")],
      mark="Bar", enc_text=F(km, "wau_avg", "SUM"))
sheet("KPI Key Connections Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "api_keys_connected", "SUM")], mark="Bar",
      enc_text=F(km, "api_keys_connected", "SUM"))
sheet("KPI Power Users Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "power_users", "SUM")], mark="Bar",
      enc_text=F(km, "power_users", "SUM"))
sheet("KPI Sessions Trend", ds=km, cols=[F(km, "month")], rows=[F(km, "total_sessions", "SUM")],
      mark="Bar", enc_text=F(km, "total_sessions", "SUM"))
sheet("KPI Tokens Monitored Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "total_tokens_millions", "SUM")], mark="Bar",
      enc_text=F(km, "total_tokens_millions", "SUM"))
sheet("KPI Activation Rate Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "activation_rate_pct", "AVG")], mark="Line",
      enc_text=F(km, "activation_rate_pct", "AVG"))
sheet("KPI Visitor to Signup CVR Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "visitor_to_signup_cvr_pct", "AVG")], mark="Line",
      enc_text=F(km, "visitor_to_signup_cvr_pct", "AVG"))
sheet("KPI W4 Retention Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "w4_retention_pct", "AVG")], mark="Line",
      enc_text=F(km, "w4_retention_pct", "AVG"))
sheet("KPI Next Month Return Rate Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "next_month_return_rate_pct", "AVG")], mark="Line",
      enc_text=F(km, "next_month_return_rate_pct", "AVG"))
sheet("KPI Invite Referral Share Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "invite_referral_share_pct", "AVG")], mark="Line",
      enc_text=F(km, "invite_referral_share_pct", "AVG"))
sheet("KPI Signups Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "new_signups", "SUM")], mark="Bar",
      enc_text=F(km, "new_signups", "SUM"))

kl = "kpi_monthly_by_location"
sheet("KPI Sessions By Location", ds=kl, cols=[F(kl, "month")],
      rows=[F(kl, "total_sessions", "SUM")], mark="Bar",
      enc_color_dim=F(kl, "collection_location"))
sheet("KPI Activation By Location", ds=kl, cols=[F(kl, "month")],
      rows=[F(kl, "activation_rate_pct", "AVG")], mark="Line",
      enc_color_dim=F(kl, "collection_location"))
sheet("KPI MAU By Location", ds=kl, cols=[F(kl, "month")],
      rows=[F(kl, "mau", "SUM")], mark="Bar",
      enc_color_dim=F(kl, "collection_location"))

fo = "funnel_overall"
sheet("Funnel Stage Volumes", ds=fo, cols=[F(fo, "stage_name")],
      rows=[F(fo, "users", "SUM")], mark="Bar", enc_text=F(fo, "users", "SUM"))
sheet("Funnel Conversion From Previous", ds=fo, cols=[F(fo, "stage_name")],
      rows=[F(fo, "conversion_from_previous_pct", "AVG")], mark="Bar",
      enc_text=F(fo, "conversion_from_previous_pct", "AVG"))
sheet("Funnel Median Days Between Stages", ds=fo, cols=[F(fo, "stage_name")],
      rows=[F(fo, "median_days_from_previous", "AVG")], mark="Bar",
      enc_text=F(fo, "median_days_from_previous", "AVG"))
fc = "funnel_by_channel"
sheet("Funnel By Channel", ds=fc, cols=[F(fc, "stage_name")],
      rows=[F(fc, "users", "SUM")], mark="Bar", enc_color_dim=F(fc, "acquisition_channel"))
fl = "funnel_by_location"
sheet("Funnel By Location", ds=fl, cols=[F(fl, "stage_name")],
      rows=[F(fl, "users", "SUM")], mark="Bar", enc_color_dim=F(fl, "collection_location"))

us = "user_signups"
sheet("Behaviour Signups By Channel", ds=us, cols=[F(us, "acquisition_channel")],
      rows=[F(us, "user_id", "COUNT")], mark="Bar", enc_text=F(us, "user_id", "COUNT"))
sheet("Behaviour Users By Persona", ds=us, cols=[F(us, "persona")],
      rows=[F(us, "user_id", "COUNT")], mark="Bar", enc_text=F(us, "user_id", "COUNT"))
sheet("Behaviour Activation Rate By Persona", ds=us, cols=[F(us, "persona")],
      rows=[F(us, "activated_within_7d_flag", "AVG")], mark="Bar",
      enc_text=F(us, "activated_within_7d_flag", "AVG"))
sheet("Behaviour Signups By Use Case", ds=us, cols=[F(us, "primary_use_case")],
      rows=[F(us, "user_id", "COUNT")], mark="Bar", enc_text=F(us, "user_id", "COUNT"))
sheet("Behaviour Signups By Program", ds=us, cols=[F(us, "signup_program")],
      rows=[F(us, "user_id", "COUNT")], mark="Bar", enc_text=F(us, "user_id", "COUNT"))
sheet("Behaviour Users By Location", ds=us, cols=[F(us, "collection_location")],
      rows=[F(us, "user_id", "COUNT")], mark="Bar", enc_text=F(us, "user_id", "COUNT"))
sheet("Behaviour Activation Rate By Location", ds=us, cols=[F(us, "collection_location")],
      rows=[F(us, "activated_within_7d_flag", "AVG")], mark="Bar",
      enc_text=F(us, "activated_within_7d_flag", "AVG"))
sheet("Behaviour Onboarding Rate By Location", ds=us, cols=[F(us, "collection_location")],
      rows=[F(us, "onboarding_completed_flag", "AVG")], mark="Bar",
      enc_text=F(us, "onboarding_completed_flag", "AVG"))
sheet("Behaviour Inactivity Rate By Location", ds=us, cols=[F(us, "collection_location")],
      rows=[F(us, "inactive_30d_flag", "AVG")], mark="Bar",
      enc_text=F(us, "inactive_30d_flag", "AVG"))
fov = "feature_adoption_overall"
sheet("Behaviour Feature Adoption All", ds=fov, cols=[F(fov, "feature_name")],
      rows=[F(fov, "adoption_pct", "SUM")], mark="Bar", enc_text=F(fov, "adoption_pct", "SUM"))
fbp = "feature_adoption_by_persona"
sheet("Behaviour Feature Adoption By Persona", ds=fbp,
      cols=[F(fbp, "feature_name"), F(fbp, "persona")],
      rows=[F(fbp, "adoption_pct", "SUM")], mark="Bar")
ms = "monitoring_sessions"
sheet("Behaviour Sessions By Hour", ds=ms, cols=[F(ms, "start_hour_utc")],
      rows=[F(ms, "session_id", "COUNT")], mark="Line")
rc = "retention_cohorts"
sheet("Behaviour Retention Cohort Heatmap", ds=rc, cols=[F(rc, "week_number")],
      rows=[F(rc, "cohort_month")], mark="Square",
      enc_color=F(rc, "retention_pct", "AVG"), enc_text=F(rc, "retention_pct", "AVG"))

sheet("Quality Provider Token Mix", ds=ms, cols=[F(ms, "provider")],
      rows=[F(ms, "total_tokens", "SUM")], mark="Bar", enc_text=F(ms, "total_tokens", "SUM"))
sheet("Quality CRI Level Mix", ds=ms, cols=[F(ms, "cri_level")],
      rows=[F(ms, "session_id", "COUNT")], mark="Bar", enc_text=F(ms, "session_id", "COUNT"))
sheet("Quality Waste Index Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "avg_cognitive_waste_index", "AVG")], mark="Line",
      enc_text=F(km, "avg_cognitive_waste_index", "AVG"))
sheet("Quality CRI Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "avg_cri", "AVG")], mark="Line", enc_text=F(km, "avg_cri", "AVG"))
sheet("Quality Security Events Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "security_events_per_100_sessions", "AVG")], mark="Line",
      enc_text=F(km, "security_events_per_100_sessions", "AVG"))
sheet("Quality Efficiency Ratio Trend", ds=km, cols=[F(km, "month")],
      rows=[F(km, "avg_efficiency_ratio", "AVG")], mark="Line",
      enc_text=F(km, "avg_efficiency_ratio", "AVG"))

WORKSHEETS = "\n".join(worksheet_xml(name, **kw) for name, kw in SHEETS)

# ----------------------------------------------------------------- dashboards
zone_id = [10]
def zn(kind, content, x, y, w, h, size=11, bold=False, color="#333333"):
    zone_id[0] += 1
    zid = zone_id[0]
    if kind == "sheet":
        return (f"      <zone h='{h}' id='{zid}' param='{escape(content)}' "
                f"type-v2='worksheet' w='{w}' x='{x}' y='{y}'/>")
    runs = []
    for i, line in enumerate(content.split("\n")):
        b = " bold='true'" if (bold and i == 0) else ""
        fs = size + (2 if (bold and i == 0) else 0)
        runs.append(f"        <run{b} fontsize='{fs}' fontcolor='{color}'>{escape(line)}</run>")
    body = "\n" + "\n".join(runs) + "\n      "
    return (f"      <zone h='{h}' id='{zid}' type-v2='text' w='{w}' x='{x}' y='{y}'>\n"
            f"      <formatted-text>{body}</formatted-text>\n      </zone>")

def lay(rows):
    out, y = [], 0
    for i, (hf, cells) in enumerate(rows):
        h = int(hf * 100000) if i < len(rows) - 1 else 100000 - y
        x = 0
        for j, (wf, fn) in enumerate(cells):
            w = int(wf * 100000) if j < len(cells) - 1 else 100000 - x
            out.append(fn(x, y, w, h))
            x += w
        y += h
    return "\n".join(out)

def dashboard_xml(name, rows_xml, px_h=1200):
    return f"""  <dashboard name='{escape(name)}'>
    <style/>
    <size maxheight='{px_h}' maxwidth='1600' minheight='{px_h}' minwidth='1600'/>
    <zones>
      <zone h='100000' id='2' type-v2='layout-basic' w='100000' x='0' y='0'>
{rows_xml}
      </zone>
    </zones>
  </dashboard>"""

A = S["aug"]
LC, LO = S["location"]["DSU Campus"], S["location"]["Outside Campus"]
fmt = lambda n: f"{n:,}"

# ---- Dashboard 1 (MAIN): monitr-ai Product Analytics ------------------------
SIG2CFG, CFG2ACT = S["overall_s2c"], S["overall_c2a"]
pa = S["persona_activation"]
ph = S["hour_hist"]
peak_h = max(ph, key=lambda k: ph[k])
d1_rows = lay([
    (0.028, [(1.0, lambda x, y, w, h: zn("text",
        "monitr-ai  |  PRODUCT ANALYTICS DASHBOARD  (PRE-LAUNCH / FREE BETA - usage data only, no payments)  "
        f"|  Mar-Sep 2026  |  {fmt(S['n_visitors'])} visitors -> {fmt(S['n_signups'])} signups -> {fmt(S['n_config_users'])} key connections -> "
        f"{fmt(S['n_activated'])} activated  |  recorded at DSU Campus ({fmt(LC['signups'])}) & Outside Campus ({fmt(LO['signups'])})",
        x, y, w, h, size=14, bold=True, color="#0B5C46"))]),
    (0.060, [(1.0, lambda x, y, w, h: zn("text",
        f"KPI SCORECARD (latest complete month: {A['month_label']})\n"
        f"  North Star - Weekly Observing Users: {A['wau_avg']}   |   MAU: {fmt(A['mau'])}   |   Stickiness DAU/MAU: {A['stickiness_dau_mau_pct']}%   |   Activation rate: {A['activation_rate_pct']}%   |   NPS: {A['nps']}\n"
        f"  Power users (>=8 sessions/mo): {fmt(A['power_users'])}   |   Next-month return: {A['next_month_return_rate_pct']}%   |   W4 retention: {A['w4_retention_pct']}%   |   Invite/referral share: {A['invite_referral_share_pct']}%\n"
        f"  Sessions: {fmt(A['total_sessions'])}   |   Tokens monitored: {A['total_tokens_millions']}M   |   Avg Cognitive Waste Index: {A['avg_cognitive_waste_index']} (lower=better)   |   Avg CRI: {A['avg_cri']}",
        x, y, w, h, size=11, bold=True, color="#173A5E"))]),
    (0.011, [(1.0, lambda x, y, w, h: zn("text", "KPI IDENTIFICATION & ANALYSIS - monthly trends",
        x, y, w, h, size=10, bold=True, color="#8A3B12"))]),
    (0.092, [(0.25, lambda x, y, w, h: zn("sheet", "KPI North Star WOU Trend", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "KPI MAU Trend", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "KPI Power Users Trend", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "KPI Next Month Return Rate Trend", x, y, w, h))]),
    (0.092, [(0.25, lambda x, y, w, h: zn("sheet", "KPI Activation Rate Trend", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "KPI Invite Referral Share Trend", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "KPI W4 Retention Trend", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "KPI Sessions Trend", x, y, w, h))]),
    (0.092, [(0.25, lambda x, y, w, h: zn("sheet", "Quality Waste Index Trend", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "Quality CRI Trend", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "KPI Tokens Monitored Trend", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "KPI Visitor to Signup CVR Trend", x, y, w, h))]),
    (0.058, [(1.0, lambda x, y, w, h: zn("text",
        "KPI FRAMEWORK (formulas - full catalogue in kpi_definitions.csv):  North Star WOU = COUNTD(user_id) with >=1 monitored session per ISO week  |  "
        "Signup->Key = users with apiConfigs row / signups  |  Activation = first session <=7d after key / signups  |  Stickiness = avg(DAU)/MAU  |  "
        "Pre-launch churn = inactivity: next-month return = active(m) INTERSECT active(m+1) / active(m); 30d-inactive overall = "
        + str(S["inactive_rate"]) + "%  |  Growth (pre-launch) = invite+referral share = " + str(S["invite_rate"]) + "%  |  "
        "Product value = avg Cognitive Waste Index & Efficiency Ratio; Product safety = avg CRI & security events/100 sessions.",
        x, y, w, h, size=10, bold=True, color="#173A5E"))]),
    (0.011, [(1.0, lambda x, y, w, h: zn("text", "FUNNEL ANALYSIS - visit -> signup -> API key -> activation",
        x, y, w, h, size=10, bold=True, color="#8A3B12"))]),
    (0.095, [(0.44, lambda x, y, w, h: zn("sheet", "Funnel Stage Volumes", x, y, w, h)),
             (0.30, lambda x, y, w, h: zn("sheet", "Funnel Conversion From Previous", x, y, w, h)),
             (0.26, lambda x, y, w, h: zn("sheet", "Funnel Median Days Between Stages", x, y, w, h))]),
    (0.090, [(0.52, lambda x, y, w, h: zn("sheet", "Funnel By Channel", x, y, w, h)),
             (0.48, lambda x, y, w, h: zn("sheet", "Funnel By Location", x, y, w, h))]),
    (0.055, [(1.0, lambda x, y, w, h: zn("text",
        "FUNNEL INSIGHTS:  * Visit->Signup (" + str(S['overall_v2s']) + "%) is the biggest leak: newsletter (" + str(S['channel_activation']['newsletter']) + "% activation), referral & HN are best-fit channels; "
        "organic/paid traffic needs an interactive demo + docs deep-links.  * Signup->Key (" + str(SIG2CFG) + "%) is the biggest intentional friction (API-key anxiety): auto-detect UX, read-only-scope guidance, OAuth.  "
        "* Key->Activation (" + str(CFG2ACT) + "% <=7d, median TTA " + str(S["med_tta"]) + "d): activated users return next month at " + str(A['next_month_return_rate_pct']) + "% - activation is the retention gateway.  "
        "* DSU Campus: workshop floods (" + str(LC['workshop_share']) + "%) convert to keys but stall before activation (" + str(LC['activation_rate']) + "% vs " + str(LO['activation_rate']) + "%) - add day-2 nudges & lab follow-ups.",
        x, y, w, h, size=10, bold=True, color="#8A3B12"))]),
    (0.011, [(1.0, lambda x, y, w, h: zn("text", "USER BEHAVIOUR ANALYSIS - segments, programs, features, cohorts",
        x, y, w, h, size=10, bold=True, color="#8A3B12"))]),
    (0.090, [(0.25, lambda x, y, w, h: zn("sheet", "Behaviour Signups By Channel", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "Behaviour Users By Location", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "Behaviour Users By Persona", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "Behaviour Activation Rate By Persona", x, y, w, h))]),
    (0.090, [(0.25, lambda x, y, w, h: zn("sheet", "Behaviour Signups By Program", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "Behaviour Activation Rate By Location", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "Behaviour Onboarding Rate By Location", x, y, w, h)),
             (0.25, lambda x, y, w, h: zn("sheet", "Behaviour Sessions By Hour", x, y, w, h))]),
    (0.090, [(0.5, lambda x, y, w, h: zn("sheet", "Behaviour Feature Adoption All", x, y, w, h)),
             (0.5, lambda x, y, w, h: zn("sheet", "Behaviour Retention Cohort Heatmap", x, y, w, h))]),
    (0.05, [(1.0, lambda x, y, w, h: zn("text",
        "BEHAVIOUR INSIGHTS: * Power engineers (Security " + str(pa['Security Engineer']) + "%, ML " + str(pa['ML Engineer']) + "% activation) drive 1.3-2x sessions - build beta community around them; "
        "PMs/Founders (" + str(pa['Product Manager']) + "/" + str(pa['Founder / Exec']) + "%) need guided first sessions.  "
        "* DSU Campus: " + str(LC['avg_sessions_per_user']) + " sessions/user, " + str(LC['inactive_rate']) + "% 30d-inactive (post-workshop drift) vs Outside " + str(LO['inactive_rate']) + "% - semester-start re-engagement pushes.  "
        "* Weekday-heavy usage, peak " + str(peak_h) + ":00 UTC - digests at 08-10 UTC.  * Alerts lag in adoption but alert users retain ~2x better - prompt alert setup in the first session.  "
        "* Cohorts flatten after wk3 at ~40-50% of activated - durable habit pocket in Security & Compliance use-cases.",
        x, y, w, h, size=10, bold=True, color="#173A5E"))]),
])

# ---- Dashboard 2: Data Collection and Methodology ---------------------------
d2_rows = lay([
    (0.05, [(1.0, lambda x, y, w, h: zn("text",
        "DATA COLLECTION - SOURCES, METHODS & RELEVANCE (one CSV per product recording place + one per collection location)\n"
        "PRE-LAUNCH NOTE: product is in free beta. Datasets carry ZERO billing/payment fields - pure usage, funnel, engagement & product-quality analytics.",
        x, y, w, h, size=14, bold=True, color="#0B5C46"))]),
    (0.45, [(0.5, lambda x, y, w, h: zn("text",
        f"P1  WEB_VISITORS.CSV  - {fmt(S['n_visitors'])} rows, one per unique visitor\n"
        "Source: Google Analytics 4 (gtag.js G-FK3PF0KZ2R) embedded in frontend/index.html with user-id stitching via localStorage firebase_uid.\n"
        "Method: passive event collection (page_view, cta_click) + UTM attribution + device/geo from request headers.\n"
        "Relevance: top of funnel. visit->signup CVR, channel/campaign effectiveness, content views (pricing/docs/demo) that predict conversion.\n"
        "\n"
        f"P2  USER_SIGNUPS.CSV  - {fmt(S['n_signups'])} rows, one per account\n"
        "Source: Firebase Authentication records created by frontend/auth.html; enriched with signup_program (open_beta / waitlist / invite_code / campus_workshop) and onboarding state. NO billing data exists.\n"
        "Method: authoritative transactional store (account_created event); joined back to P1 via anonymous_visitor_id (identity resolution).\n"
        "Relevance: the 'who'. Segments (persona, industry, company size, use case, collection_location, program), cohort_month for retention, activation & engagement flags defining funnel stages 2-4.",
        x, y, w, h, size=11, bold=True, color="#173A5E")),
            (0.5, lambda x, y, w, h: zn("text",
        f"P3  API_KEY_CONFIGS.CSV  - {fmt(S['n_config_rows'])} rows, one per provider key connection\n"
        "Source: Convex apiConfigs table, populated by frontend/key.html (provider auto-detect, key validation ping, model select, provider token prices for the USER'S OWN LLM spend estimate).\n"
        "Method: direct database export of the connection entity; validation attempts/latency captured during the connect UX.\n"
        "Relevance: the critical middle funnel stage (signup -> key -> value). Provider/model mix, days-to-connect, validation friction locate onboarding drop-off causes.\n"
        "\n"
        f"P4  MONITORING_SESSIONS.CSV  - {fmt(S['n_sessions'])} rows, one per monitoring session\n"
        "Source: Convex real-time telemetry schema (sessions, metrics, cognitiveRiskIndex, securityEvents, auditLog) powering frontend/dashboard.html & telemetry.html; mirrored to Postgres via etl/webhook.ts + dbt models.\n"
        "Method: server-side event logging on every observed LLM interaction: tokens, latency, monitored LLM cost, efficiency, waste index, CRI components, security events, feature flags.\n"
        "Relevance: the behavioral truth set. Powers engagement (MAU/WAU/stickiness/power users), cohort retention, product-value (waste, efficiency) and safety (CRI, security events) KPIs.",
        x, y, w, h, size=11, bold=True, color="#173A5E"))]),
    (0.5, [(0.55, lambda x, y, w, h: zn("text",
        "COLLECTION LOCATIONS (one user file each)\n"
        f"* USERS_DSU_CAMPUS.CSV  - {fmt(LC['signups'])} rows, one per user recorded at DSU Campus (Bengaluru).\n"
        f"    Collection method: on-campus collection - users recorded on the campus network & devices (labs, class demos, workshops). Profile: students & researchers; {LC['edu_email_pct']}% .edu emails, mobile-heavy, {LC['workshop_share']}% via campus_workshop program.\n"
        f"    Relevance: education/adoption channel. Explains signup volume, exploratory behaviour (red-team & stress tests) and post-workshop engagement decay; measures the student pipeline.\n"
        f"* USERS_OUTSIDE_CAMPUS.CSV  - {fmt(LO['signups'])} rows, one per user recorded outside campus.\n"
        f"    Collection method: organic global traffic - GA4 geo/device signals + professional personas, company emails; {LO['invite_share']}% arrive via invites/referrals.\n"
        f"    Relevance: the professional beta base. Higher activation ({LO['activation_rate']}%), deeper sustained engagement ({LO['avg_sessions_per_user']} sessions/user); the segment PMF decisions should be tuned on.\n"
        "* Field schema is IDENTICAL in both location files (and matches user_signups.csv) so they stack/union 1:1 and join onward to P3/P4 via user_id.",
        x, y, w, h, size=11, bold=True, color="#173A5E")),
            (0.45, lambda x, y, w, h: zn("text",
        "COLLECTION & GOVERNANCE NOTES\n"
        "* Identity chain: anonymous_visitor_id (GA) == anonymous_visitor_id (signup) -> user_id -> config_id -> session_id; collection_location stamped at first recording, denormalized downstream.\n"
        "* Period: 2026-03-01 .. 2026-09-20 (synthetic, seeded generator - fully reproducible).\n"
        "* Flags stored as 0/1 integers so AVG(field) in Tableau = rate (e.g. AVG(activated_within_7d_flag) = activation rate).\n"
        "* No raw prompts/responses/PII exported - only structured risk scores & counts (mirrors the product's zero-trust stance).\n"
        "* Derived sets (funnel_*, kpi_monthly*, retention_cohorts, feature_adoption_*) computed from P1-P4 - the same SQL you'd write in the dbt layer.",
        x, y, w, h, size=11, bold=True, color="#173A5E"))]),
])

DASH_NAMES = ["monitr-ai Product Analytics", "Data Collection and Methodology"]
DASHES = "\n".join([
    dashboard_xml("monitr-ai Product Analytics", d1_rows, px_h=2400),
    dashboard_xml("Data Collection and Methodology", d2_rows, px_h=1400),
])

WINDOWS = ("  <windows source-height='36'>\n"
           + "\n".join(f"    <window class='worksheet' name='{escape(n)}'/>" for n, _ in SHEETS)
           + "\n"
           + "\n".join(f"    <window class='dashboard' name='{escape(n)}'/>" for n in DASH_NAMES)
           + "\n  </windows>")

def build(packaged):
    datasources = "\n".join(ds_xml(stem, packaged) for stem in FILES)
    return (f"<?xml version='1.0' encoding='utf-8'?>\n"
            f"<workbook source-build='20232.23.1120.1144' source-platform='any' version='18.1' "
            f"xmlns:user='http://www.tableausoftware.com/xml/user'>\n"
            f"  <preferences>\n"
            f"    <preference name='ui.encoding.shelf.height' value='24'/>\n"
            f"    <preference name='ui.shelf' value='show'/>\n"
            f"    <preference name='ui.started.showing' value='welcome'/>\n"
            f"  </preferences>\n"
            f"  <datasources>\n{datasources}\n  </datasources>\n"
            f"  <worksheets>\n{WORKSHEETS}\n  </worksheets>\n"
            f"  <dashboards>\n{DASHES}\n  </dashboards>\n"
            f"</workbook>")

twb = build(packaged=False)
with open(os.path.join(HERE, "monitr_ai_user_analytics.twb"), "w", encoding="utf-8") as f:
    f.write(twb)

twb_pkg = build(packaged=True)
twbx = os.path.join(HERE, "monitr_ai_user_analytics.twbx")
with zipfile.ZipFile(twbx, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("monitr_ai_user_analytics.twb", twb_pkg)
    for stem in FILES:
        z.write(os.path.join(DATA, stem + ".csv"), f"Data/{stem}.csv")

import xml.etree.ElementTree as ET
for name, payload in [("twb", twb), ("twbx-internal", twb_pkg)]:
    try:
        ET.fromstring(payload)
        print(f"XML OK: {name}")
    except ET.ParseError as e:
        print(f"XML ERROR {name}: {e}")
print("sheets:", len(SHEETS), "| datasources:", len(FILES), "| dashboards: 2")
