# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import icon, footer_strap

pages = []

def add(html):
    pages.append(html)

# ============================================================
# THE TRANSFORMATION MARK (logo)
# two states -> central transition -> upward movement
# ============================================================
def mark(size=40, before="#0B1F33", after="#D9A52E", bridge="#D9A52E", bg=None):
    s = size
    return f'''<svg width="{s}" height="{s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="46" width="40" height="40" rx="10" transform="rotate(45 30 66)" fill="{before}"/>
      <rect x="50" y="6" width="40" height="40" rx="10" transform="rotate(45 70 26)" fill="{after}"/>
      <path d="M42 54 L58 38" stroke="{bridge}" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
    </svg>'''

def mark_reverse(size=40):
    return mark(size, before="#FFFFFF", after="#D9A52E", bridge="#D9A52E")

def mark_primary(size=40):
    return mark(size, before="#0B1F33", after="#6F35B5", bridge="#D9A52E")

# ============================================================
# PAGE 1 — COVER
# ============================================================
add(f'''
<div class="page cover">
  <div class="top-row">
    <div class="wordmark">{mark_reverse(26)}<span>SWIIPT</span></div>
    <div class="kicker">Postpartum Couple OS &middot; V06</div>
  </div>
  <div class="center">
    <div class="eyebrow-cover">A Night-Coordination System For New Parents</div>
    <h1>Every Night,<br/>Just <em>Me</em>.</h1>
    <p class="cover-sub">A postpartum night-coordination system that replaces nightly arguing with a pre-agreed roster, a fairness ledger, and the exact words to make it stick.</p>
  </div>
  <div class="bottom-row">
    <div class="promise">A written, fair night-shift system both adults follow &mdash; so she gets a protected sleep opportunity, and nobody has to ask.</div>
    <div class="mark-big">{mark_reverse(58)}</div>
  </div>
</div>
''')

# ============================================================
# PAGE 2 — IMPRINT / PRODUCT IDENTITY
# ============================================================
add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">i</span>PRODUCT IDENTITY</div>
    <h1 class="title">What This System Is &mdash; <span class="accent">And Isn&rsquo;t</span></h1>
    <p class="dek">This is not a book about sleep deprivation. It is a working household operating agreement &mdash; the roster, the ledger, and the language, ready to fill in tonight.</p>
    <hr class="rule"/>
    <table class="fact-table">
      <tr><td class="k">Life Area</td><td class="v">Motherhood (early) &middot; Marriage &amp; partnership</td></tr>
      <tr><td class="k">Life State</td><td class="v">New mother, 0&ndash;6 months postpartum, and her partner</td></tr>
      <tr><td class="k">Situation</td><td class="v">She is running every night alone &mdash; feeding, settling, soothing &mdash; while her partner sleeps through, works away, or believes &ldquo;helping&rdquo; means one diaper change. There is no agreed system; every night is renegotiated by exhaustion and resentment.</td></tr>
      <tr><td class="k">The Problem</td><td class="v">She cannot get a single protected sleep block, is approaching or past the point of physical and cognitive breakdown, and the marriage is absorbing the damage in silence.</td></tr>
      <tr><td class="k">Constraints</td><td class="v">Often still breastfeeding, so &ldquo;sleep through the night&rdquo; isn&rsquo;t simply available. Cultural norms assign night-care to the mother by default. Asking directly can feel like an accusation. For some readers, there is no partner in the home at all.</td></tr>
      <tr><td class="k">The Transformation</td><td class="v">A written, fair night-shift system both partners follow &mdash; protecting a 4&ndash;5 hour sleep opportunity for the mother whenever circumstances allow, without the nightly argument about whose turn it is.</td></tr>
    </table>
    <div class="disclaimer-block">
      <strong>Evidence &amp; scope.</strong> Educational content informed by relationship research, postpartum health guidance, and lived experience. It is not a substitute for medical, clinical, or mental-health assessment. Cultural-norm observations are labeled as informed by lived experience, not prescriptive clinical fact. See Module 5 and Module 13 for full safety guardrails and escalation routing.
    </div>
  </div>
  {footer_strap("Product Identity")}
</div>
''')

# ============================================================
# PAGE 3 — TABLE OF CONTENTS
# ============================================================
toc_items = [
    ("01", "The Argument That Ends the War", "Why unstructured \u201casking for help\u201d fails", "READ"),
    ("02", "The Situation Finder", "A three-question self-triage quiz", "DECIDE"),
    ("03", "The Decision Tree", "Route yourself to the right roster", "DECIDE"),
    ("04", "Roster Safety &amp; Boundary Rules", "The non-negotiable guardrails", "READ"),
    ("05", "The Three Shift Contracts", "Roster A, B and C \u2014 fillable templates", "BUILD"),
    ("06", "The Sleep Banker", "The Recovery Bank fairness ledger", "TRACK"),
    ("07", "The Seven Script Cards", "The exact words for the hard moments", "PRINT"),
    ("08", "The Fridge Shift Chart", "Your one-page wall reference", "PRINT"),
    ("09", "The 14-Day Shift Tracker", "Log the system\u2019s real performance", "PRINT"),
    ("10", "The Rescue Card", "Bad Night Protocol \u2014 for when it all breaks", "PRINT"),
    ("11", "The Re-entry Protocol", "Restarting after a relapse, without guilt", "READ"),
    ("12", "The Safety Gate", "When exhaustion needs more than a roster", "READ"),
]
toc_html = ""
for n, t, d, tag in toc_items:
    toc_html += f'''<div class="toc-item"><div class="n">{n}</div><div style="flex:1"><div class="t">{t}</div><div class="d">{d}</div></div><div class="tag">{tag}</div></div>'''

add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">ii</span>CONTENTS</div>
    <h1 class="title">Twelve Modules. <span class="accent">One System.</span></h1>
    <p class="dek">Follow them in order the first time. After that, use the Contents to jump straight to whatever tonight requires.</p>
    <hr class="rule"/>
    <div class="toc-list">{toc_html}</div>
  </div>
  {footer_strap("Contents")}
</div>
''')

# ============================================================
# PAGE 4 — THE ROADMAP (visual journey timeline)
# ============================================================
roadmap_steps = [
    ("1","Read","The Argument That Ends the War","Understand why unstructured \u201casking for help\u201d is structurally fragile and where it commonly breaks down."),
    ("2","Find","The Situation Finder","Diagnose your household\u2019s exact night profile in three questions."),
    ("3","Decide","The Decision Tree","Select the roster template engineered for your feeding style and partner availability."),
    ("4","Learn","Safety &amp; Boundary Rules","Establish the non-negotiable guardrails for adult vigilance and baby care."),
    ("5","Build","The Roster Templates","Customize your Shift Contract \u2014 Roster A, B, or C."),
    ("6","Bank","Sleep Banker Mechanics","Activate the Recovery Bank ledger so shifts trade fairly."),
    ("7","Communicate","Script Cards","Use precise, battle-tested words to navigate objections."),
    ("8","Execute","The Fridge Shift Chart","Put the physical chart somewhere both adults see it every night."),
    ("9","Track","The 14-Day Shift Tracker","Log performance, friction and sleep outcomes daily."),
    ("10","Recover &amp; Restart","Rescue Cards &amp; Re-entry","Specialized protocols for illness, teething, or roster breakdown."),
]
tl_html = ""
for n, verb, t, d in roadmap_steps:
    tl_html += f'''<div class="tl-item"><div class="tl-node"><div class="tl-dot">{n}</div><div class="tl-line"></div></div>
    <div class="tl-body"><div class="tl-title">{verb} &mdash; {t}</div><div class="tl-desc">{d}</div></div></div>'''

add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">iii</span>HOW THIS SYSTEM WORKS</div>
    <h1 class="title">The Ten-Step <span class="accent">Night-Shift Roadmap</span></h1>
    <p class="dek">This is not a book to read cover to cover before you act. It is a sequence you move through &mdash; most of it inside your first evening.</p>
    <hr class="rule"/>
    <div class="timeline">{tl_html}</div>
  </div>
  {footer_strap("The Roadmap")}
</div>
''')

# ============================================================
# PAGE 5 — PRINTABLE ASSETS INDEX
# ============================================================
printable_items = [
    ("printer","The Fridge Shift Chart","Module 8, page 1","One page. Print and place on the fridge or wall tonight."),
    ("scissors","The Seven Script Cards","Module 7, 4 pages","Print, cut along the dashed line, and keep in reach."),
    ("clipboard-list","The 14-Day Shift Tracker","Module 9, 1 landscape page","Print two copies to cover the full 14 days, or reuse one weekly."),
    ("life-buoy","The Rescue Card","Module 10, page 1","Print and keep somewhere reachable at 3 a.m. \u2014 by the crib, or on the fridge beside the chart."),
]
pidx = ""
for ic, t, loc, d in printable_items:
    pidx += f'''<div class="reason"><div class="rn">{icon(ic, color="#fff", size=13)}</div>
      <div><div class="rt">{t}</div><div class="rd"><span class="muted" style="font-weight:700;">{loc}.</span> {d}</div></div></div>'''

add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">iv</span>BEFORE YOU BEGIN</div>
    <h1 class="title">Four Pages You Should <span class="accent">Print Tonight</span></h1>
    <p class="dek">Everything in this book can be used on screen. But four assets are built to leave the screen entirely &mdash; each sits alone on its own page for exactly that reason.</p>
    <hr class="rule"/>
    <div class="reason-grid">{pidx}</div>
    <div class="callout info" style="margin-top:16pt;">
      <div class="ic">{icon("printer", color="#fff", size=12)}</div>
      <div class="body"><span class="label">Printing note</span><div class="txt">Every printable page in this book is framed with a dashed border and a gold <strong>PRINTABLE</strong> tag in the corner. Print at A4 or Letter size. Laminating the Fridge Chart and Rescue Card lets you reuse them week to week with a dry-erase marker.</div></div>
    </div>
  </div>
  {footer_strap("Before You Begin")}
</div>
''')

# ============================================================
# MODULE 01 — THE READ
# ============================================================
add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">01</span>THE READ &middot; 3 MIN</div>
    <h1 class="title">The Argument <span class="accent">That Ends the War</span></h1>
    <p class="dek">Why unstructured &ldquo;asking for help&rdquo; is structurally fragile.</p>
    <hr class="rule"/>
    <p style="font-size:10.3pt; color:var(--text-secondary);">When you are waking up every 90 minutes to a crying baby while your partner sleeps peacefully in the next room, the issue feels deeply personal. It feels like a lack of love, a lack of awareness, or a lack of care.</p>
    <p style="font-size:10.3pt; color:var(--text-secondary);">The next morning, the conversation usually goes like this:</p>
    <div class="dialogue">
      <div class="line"><span class="who">Mother:</span> <span class="say">&ldquo;I need you to help more at night. I am dying here.&rdquo;</span></div>
      <div class="line"><span class="who">Partner:</span> <span class="say">&ldquo;Just tell me what to do, I&rsquo;ll help. But you know I have work tomorrow.&rdquo;</span></div>
    </div>
    <p style="font-size:10.3pt; color:var(--text-secondary);">That night, the baby cries. The mother lies awake waiting for the partner to wake up. He doesn&rsquo;t. She becomes furious, nudges him aggressively, or simply gets up herself, muttering in resentment.</p>
    <div class="pullquote">Unstructured nightly negotiation is structurally fragile.</div>
    <p style="font-size:10.3pt; color:var(--text-secondary); margin-bottom:4pt;">It fails for three structural reasons:</p>
    <div class="reason-grid">
      <div class="reason"><div class="rn">1</div><div><div class="rt">The Burden of Asking</div><div class="rd">Asking your partner to &ldquo;help&rdquo; is cognitive labor. You wake, evaluate if the cry is urgent, decide to wake him, and instruct him. By then you are already fully awake and your sleep cycle is ruined.</div></div></div>
      <div class="reason"><div class="rn">2</div><div><div class="rt">The &ldquo;Helper&rdquo; Reframe</div><div class="rd">A partner positioned as a &ldquo;helper&rdquo; waits for instructions. He does not take ownership. If the baby is wet, he waits to be told. If the baby won&rsquo;t settle, he hands the baby back.</div></div></div>
      <div class="reason"><div class="rn">3</div><div><div class="rt">Exhaustion Negotiation</div><div class="rd">At 3:00 a.m. both brains run at near-zero capacity. Arguing about &ldquo;whose turn it is&rdquo; under severe sleep deprivation is like negotiating a contract during a mild concussion.</div></div></div>
    </div>
    <div class="callout success" style="margin-top:14pt;">
      <div class="ic">{icon("compass", color="#fff", size=12)}</div>
      <div class="body"><span class="label">The solution &mdash; shift-based adult coordination</span><div class="txt">Stop negotiating at night. Externalize the schedule. A written contract removes the emotional labor of asking &mdash; nobody has to ask, the schedule asks. The partner stops being a &ldquo;helper&rdquo; and becomes a <strong>co-manager</strong> who owns a specific, non-optional shift block. This is not about blame. It is about a system that works even when you are too exhausted to be generous with each other.</div></div>
    </div>
  </div>
  {footer_strap("Module 01 &middot; The Read")}
</div>
''')

# ============================================================
# MODULE 02 — THE SITUATION FINDER (quiz / checklist)
# ============================================================
add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">02</span>SELF-TRIAGE QUIZ</div>
    <h1 class="title">The Situation <span class="accent">Finder</span></h1>
    <p class="dek">Answer three questions honestly. Your answers route you to the exact roster and scripts built for your household.</p>
    <hr class="rule" style="margin-bottom:6pt;"/>

    <div class="quiz-q">
      <div class="qn"><div class="qchip">1</div>What is your primary feeding method?</div>
      <div class="opt-list">
        <div class="opt"><div class="ol">A</div><div><strong>Exclusively breastfeeding</strong> &mdash; direct latch only, no bottles.</div></div>
        <div class="opt"><div class="ol">B</div><div><strong>Breastfeeding but can pump</strong> expressed milk, or combo-feed with formula.</div></div>
        <div class="opt"><div class="ol">C</div><div><strong>Exclusively formula</strong> or expressed milk.</div></div>
      </div>
    </div>

    <div class="quiz-q">
      <div class="qn"><div class="qchip">2</div>What is your partner&rsquo;s availability at night?</div>
      <div class="opt-list">
        <div class="opt"><div class="ol">A</div><div><strong>Home but minimally involved</strong> &mdash; or sleeps through.</div></div>
        <div class="opt"><div class="ol">B</div><div><strong>Works nights, travels, or lives elsewhere.</strong></div></div>
        <div class="opt"><div class="ol">C</div><div><strong>I am parenting solo</strong> &mdash; no partner in the home.</div></div>
      </div>
    </div>

    <div class="quiz-q">
      <div class="qn"><div class="qchip">3</div>What is your primary source of household friction right now?</div>
      <div class="opt-list">
        <div class="opt"><div class="ol">A</div><div>Partner says he &ldquo;wants to help&rdquo; but sleeps through the cries or doesn&rsquo;t know what to do.</div></div>
        <div class="opt"><div class="ol">B</div><div>We constantly argue at night about whose turn it is, or who is more tired.</div></div>
        <div class="opt"><div class="ol">C</div><div>Extended family says night duty is solely the woman&rsquo;s job and criticizes my partner&rsquo;s involvement.</div></div>
        <div class="opt"><div class="ol">D</div><div>I am too exhausted to coordinate anything &mdash; we are in absolute survival mode.</div></div>
      </div>
    </div>

    <table class="route-table">
      <tr><th>Q1</th><th>Q2</th><th>Q3</th><th>Your route</th></tr>
      <tr><td>A &mdash; breastfeeding only</td><td>A &mdash; partner home</td><td>A, B, or C</td><td><span class="route-badge">Roster A</span> &nbsp;+ Scripts 1, 2, 3</td></tr>
      <tr><td>B or C &mdash; bottle-capable</td><td>A &mdash; partner home</td><td>A, B, or C</td><td><span class="route-badge">Roster B</span> &nbsp;+ Scripts 5, 6</td></tr>
      <tr><td>Any</td><td>B or C &mdash; no partner / solo</td><td>Any</td><td><span class="route-badge">Roster C</span> &nbsp;+ Script 7</td></tr>
      <tr><td>Any</td><td>Any</td><td>D &mdash; survival mode</td><td><span class="route-badge" style="background:var(--error);">Rescue Card first</span> &nbsp;return here tomorrow</td></tr>
    </table>
  </div>
  {footer_strap("Module 02 &middot; Situation Finder")}
</div>
''')

# ============================================================
# MODULE 03 — THE DECISION TREE (visual flowchart)
# ============================================================
add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">03</span>DECISION SUPPORT &middot; ROUTING DIAGRAM</div>
    <h1 class="title">The Decision <span class="accent">Tree</span></h1>
    <p class="dek">Confirm your route from the Situation Finder by following the tree below, top to bottom.</p>
    <hr class="rule"/>

    <div class="tree">
      <div class="tree-root"><div class="tbox start">Start &mdash; Every Night, Just Me</div></div>
      <div class="vline"></div>
      <div class="branch-row">
        <div class="branch">
          <div class="branch-connector"><div class="stem"></div><div class="seg"></div></div>
          <div class="tbox q">Partner available at night</div>
          <div class="label-tag">↓ then by feeding method</div>
          <div class="branch-row" style="margin-top:2pt;">
            <div class="branch">
              <div class="branch-connector"><div class="stem"></div><div class="seg"></div></div>
              <div class="tbox" style="font-size:8.6pt;">Breastfeeding<br/>(direct latch only)</div>
              <div class="vline"></div>
              <div class="tbox leaf">Roster A</div>
            </div>
            <div class="branch">
              <div class="branch-connector"><div class="seg"></div><div class="stem"></div></div>
              <div class="tbox" style="font-size:8.6pt;">Bottle / formula /<br/>expressed milk</div>
              <div class="vline"></div>
              <div class="tbox leaf">Roster B</div>
            </div>
          </div>
        </div>
        <div class="branch">
          <div class="branch-connector"><div class="seg"></div><div class="stem"></div></div>
          <div class="tbox q">No partner / solo</div>
          <div class="vline"></div>
          <div class="tbox leaf">Roster C</div>
        </div>
      </div>
    </div>

    <hr class="rule" style="margin-top:18pt;"/>

    <div class="reason-grid">
      <div class="reason"><div class="rn" style="background:var(--purple);">A</div><div><div class="rt">Routed to Roster A</div><div class="rd">You are breastfeeding and your partner is home. He manages all non-feeding duties during his shift &mdash; diapering, soothing, resettling &mdash; and brings the baby to you only for feeds. <strong>Start:</strong> Module 5 &middot; Roster A. Use <strong>Script Cards 1, 2, 3.</strong></div></div></div>
      <div class="reason"><div class="rn" style="background:var(--purple);">B</div><div><div class="rt">Routed to Roster B</div><div class="rd">You can use bottles &mdash; formula or expressed milk. This allows a true alternating shift: one parent fully off, one fully on. <strong>Start:</strong> Module 5 &middot; Roster B. Use <strong>Script Cards 5 and 6.</strong></div></div></div>
      <div class="reason"><div class="rn" style="background:var(--purple);">C</div><div><div class="rt">Routed to Roster C</div><div class="rd">You are parenting without a partner at night. This roster builds a scheduled support web from your available village. <strong>Start:</strong> Module 5 &middot; Roster C. Use <strong>Script Card 7.</strong></div></div></div>
      <div class="reason"><div class="rn" style="background:var(--error);">!</div><div><div class="rt">Survival Mode (Q3 = D)</div><div class="rd">Do not start the roster tonight. Go directly to <strong>Module 10 &mdash; The Rescue Card.</strong> Get through tonight. Return to this tree tomorrow, once you have had any rest at all.</div></div></div>
    </div>
  </div>
  {footer_strap("Module 03 &middot; Decision Tree")}
</div>
''')

# ============================================================
# MODULE 04 — SAFETY & BOUNDARY RULES
# ============================================================
add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">04</span>NON-NEGOTIABLE GUARDRAILS</div>
    <h1 class="title">Roster Safety <span class="accent">&amp; Boundary Rules</span></h1>
    <p class="dek">Before signing any roster, both adults read and agree to the following. These are not optional &mdash; they are the boundary within which the entire system operates.</p>
    <hr class="rule"/>

    <div class="callout safety">
      <div class="ic">{icon("shield-alert", color="#fff", size=12)}</div>
      <div class="body"><span class="label">Rule 1 &middot; Infant safety is paramount, always</span>
      <div class="txt"><strong>Safe-sleep standards.</strong> This contract controls adult coordination only. It does NOT override safe-sleep practice. Baby always sleeps on their back, on a firm flat separate surface, free of blankets, pillows, bumpers, or soft toys &mdash; per WHO and pediatric guidance. Ask your pediatrician or midwife if you are unsure.<br/><br/>
      <strong>Vigilance requirement.</strong> The active Shift Manager remains fully awake and alert while handling the baby. Never hold the baby in a bed, sofa, or armchair if there is any risk of falling asleep.<br/><br/>
      <strong>No earplugs for the active manager.</strong> The on-shift parent must not wear earplugs, headphones, or use sleep-inducing aids. The off-duty parent may use earplugs or white noise &mdash; that is the point of the system.</div></div>
    </div>

    <div class="callout warning">
      <div class="ic">{icon("triangle-alert", color="#fff", size=12)}</div>
      <div class="body"><span class="label">Rule 2 &middot; Baby concerns always override the roster</span>
      <div class="txt">If the baby cannot be settled, or the active caregiver is concerned about feeding, illness, injury, breathing, or any unusual behavior &mdash; the active caregiver assesses the baby and follows pediatric or clinical guidance, or seeks appropriate help. Use the agreed phrase <strong>&ldquo;I need a handoff&rdquo;</strong> to coordinate support. The roster pauses. Baby comes first.</div></div>
    </div>

    <div class="callout info">
      <div class="ic">{icon("book-open", color="#fff", size=12)}</div>
      <div class="body"><span class="label">Rule 3 &middot; This is a coordination tool, not medical advice</span>
      <div class="txt">This guide provides household scheduling models and relationship communication tools. It does not contain clinical diagnoses, pediatric medical advice, or safe-sleep certifications. For feeding schedules, safe-sleep arrangements, or any physical concern about the baby, consult your pediatrician, midwife, or certified lactation consultant.</div></div>
    </div>

    <div class="sign-block" style="margin-top:20pt;">
      <div class="sign-line"><div class="ln"></div><div class="lbl">Initial &mdash; Mother</div></div>
      <div class="sign-line"><div class="ln"></div><div class="lbl">Initial &mdash; Partner / Helper</div></div>
      <div class="sign-line" style="flex:0.6;"><div class="ln"></div><div class="lbl">Date</div></div>
    </div>
  </div>
  {footer_strap("Module 04 &middot; Safety Rules")}
</div>
''')

# ============================================================
# MODULE 05 — THE THREE ROSTER TEMPLATES (schedule-grid asset)
# ============================================================

def sched_bar(seg1_pct, t_pct, seg2_pct, seg1_label, t_label, seg2_label):
    return f'''<div class="sched-bar">
      <div class="sched-seg a" style="flex:0 0 {seg1_pct}%;">{seg1_label}</div>
      <div class="sched-seg t" style="flex:0 0 {t_pct}%;">{t_label}</div>
      <div class="sched-seg b" style="flex:0 0 {seg2_pct}%;">{seg2_label}</div>
    </div>'''

add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">05</span>FILLABLE CONTRACT &middot; TEMPLATE A</div>
    <h1 class="title">Roster A <span class="accent">&mdash; Breastfeeding Split Shift</span></h1>
    <p class="dek">For couples where the baby is exclusively breastfed. Partner manages all non-feeding duties, protecting the mother&rsquo;s sleep opportunity.</p>
    <hr class="rule" style="margin-bottom:8pt;"/>

    <div class="roster-card">
      <div class="roster-head"><div class="letter">A</div><div><div class="rh-t">Postpartum Shift Agreement</div><div class="rh-s">Goal: protect 4+ hrs of uninterrupted sleep opportunity for Mother, safely.</div></div></div>
      <div class="roster-body">
        <div class="sched-grid">
          {sched_bar(46,8,46,"PARTNER&rsquo;S SHIFT &middot; 9PM&ndash;2AM","HANDOFF","MOTHER&rsquo;S SHIFT &middot; 2AM&ndash;7AM")}
          <div class="sched-labels"><span>9:00 PM</span><span>2:00 AM (silent handoff)</span><span>7:00 AM</span></div>
        </div>
        <div class="duty-cols">
          <div class="duty-col">
            <div class="dc-head"><div class="sw" style="background:var(--navy);"></div>Partner &mdash; active manager</div>
            <ul><li>Diapering, burping, soothing, resettling</li><li>If baby wakes: diaper-check &amp; soothe first</li><li>Brings baby to mother for feeds only, in the dark, then returns baby to crib</li></ul>
          </div>
          <div class="duty-col">
            <div class="dc-head"><div class="sw" style="background:var(--purple);"></div>Mother &mdash; active manager</div>
            <ul><li>All feeding, diapering, soothing duties</li><li>Partner is fully off-duty and sleeps uninterrupted</li></ul>
          </div>
        </div>
        <div class="callout protocol" style="margin:10pt 0 0 0;">
          <div class="ic">{icon("moon-star", color="#fff", size=11)}</div>
          <div class="body"><span class="label">Off-duty rule</span><div class="txt">During the partner&rsquo;s shift the mother is officially off-duty &mdash; separate room or earplugs/white noise. She does not get up unless called upon. <strong>Escalation:</strong> any safety concern overrides the roster; coordinate with &ldquo;I need a handoff.&rdquo;</div></div>
        </div>
        <div class="sign-block">
          <div class="sign-line"><div class="ln"></div><div class="lbl">Mother &mdash; my hours: ______ PM to ______ AM</div></div>
          <div class="sign-line"><div class="ln"></div><div class="lbl">Partner &mdash; my hours: ______ PM to ______ AM</div></div>
        </div>
      </div>
    </div>
  </div>
  {footer_strap("Module 05 &middot; Roster A")}
</div>
''')

add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">05</span>FILLABLE CONTRACT &middot; TEMPLATE B</div>
    <h1 class="title">Roster B <span class="accent">&mdash; Alternating Bottle-Fed Shift</span></h1>
    <p class="dek">For couples using formula or expressed breastmilk. A true alternating shift &mdash; both parents receive a full sleep opportunity window.</p>
    <hr class="rule" style="margin-bottom:8pt;"/>

    <div class="roster-card">
      <div class="roster-head"><div class="letter">B</div><div><div class="rh-t">Postpartum Shift Agreement</div><div class="rh-s">Goal: split duties equally, 5+ hrs of sleep opportunity for both parents.</div></div></div>
      <div class="roster-body">
        <div class="sched-grid">
          {sched_bar(46,8,46,"PARTNER&rsquo;S SHIFT &middot; 10PM&ndash;3AM","ALARM","MOTHER&rsquo;S SHIFT &middot; 3AM&ndash;8AM")}
          <div class="sched-labels"><span>10:00 PM</span><span>3:00 AM (silent, swift handoff)</span><span>8:00 AM</span></div>
        </div>
        <div class="duty-cols">
          <div class="duty-col">
            <div class="dc-head"><div class="sw" style="background:var(--navy);"></div>Partner &mdash; active manager</div>
            <ul><li>Bottle-feed (formula / expressed milk)</li><li>Burp, diaper change, soothe, resettle</li><li>Mother off-duty, separate sleep zone</li></ul>
          </div>
          <div class="duty-col">
            <div class="dc-head"><div class="sw" style="background:var(--purple);"></div>Mother &mdash; active manager</div>
            <ul><li>Breastfeed or bottle-feed, burp, diaper</li><li>Soothe, resettle</li><li>Partner off-duty, sleeps uninterrupted</li></ul>
          </div>
        </div>
        <div class="callout protocol" style="margin:10pt 0 0 0;">
          <div class="ic">{icon("alarm-clock", color="#fff", size=11)}</div>
          <div class="body"><span class="label">Handoff &amp; prep rules</span><div class="txt">A physical alarm marks the transition &mdash; silent and swift, oncoming manager takes over immediately. Before the first shift, all bottles / formula / expressed milk are pre-measured at the feeding station. No night-time hunting for supplies.</div></div>
        </div>
        <div class="sign-block">
          <div class="sign-line"><div class="ln"></div><div class="lbl">Mother &mdash; my hours: ______ AM to ______ AM</div></div>
          <div class="sign-line"><div class="ln"></div><div class="lbl">Partner &mdash; my hours: ______ PM to ______ AM</div></div>
        </div>
      </div>
    </div>
  </div>
  {footer_strap("Module 05 &middot; Roster B")}
</div>
''')

add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">05</span>FILLABLE CONTRACT &middot; TEMPLATE C</div>
    <h1 class="title">Roster C <span class="accent">&mdash; Support-Web Roster</span></h1>
    <p class="dek">For solo mothers, mothers whose partners are frequently away, or those using a helper &mdash; a family member, night nanny, or trusted friend.</p>
    <hr class="rule" style="margin-bottom:8pt;"/>

    <div class="roster-card">
      <div class="roster-head"><div class="letter">C</div><div><div class="rh-t">Postpartum Shift Agreement</div><div class="rh-s">Goal: protect the mother&rsquo;s recovery via a scheduled village, 4+ hrs.</div></div></div>
      <div class="roster-body">
        <div class="sched-grid">
          <div class="sched-bar"><div class="sched-seg a" style="flex:0 0 88%;">HELPER&rsquo;S SHIFT &middot; 11PM&ndash;4AM</div><div class="sched-seg t" style="flex:0 0 12%; font-size:6.2pt;">MOTHER SLEEPS</div></div>
          <div class="sched-labels"><span>11:00 PM</span><span>Active support nights: [ Mon &middot; Wed &middot; Fri ]</span><span>4:00 AM</span></div>
        </div>
        <div class="duty-cols">
          <div class="duty-col">
            <div class="dc-head"><div class="sw" style="background:var(--navy);"></div>Helper / Support Person &mdash; active manager</div>
            <ul><li>Diaper, soothe, bottle-feed</li><li>If direct breastfeeding required: brings baby to mother for feeding only, then takes baby back</li></ul>
          </div>
          <div class="duty-col">
            <div class="dc-head"><div class="sw" style="background:var(--purple);"></div>Mother &mdash; protected sleep</div>
            <ul><li>Sleep &mdash; that is the whole job</li><li>On nights with no helper: Survival Protocol (right)</li></ul>
          </div>
        </div>
        <div class="callout protocol" style="margin:10pt 0 0 0;">
          <div class="ic">{icon("users", color="#fff", size=11)}</div>
          <div class="body"><span class="label">Survival protocol &mdash; nights with no helper scheduled</span><div class="txt">Sleep when the baby sleeps, no exceptions. Defer all non-essential household tasks. Use pre-cooked or frozen meals. Restrict daytime visits to protect rest.</div></div>
        </div>
        <div class="sign-block">
          <div class="sign-line"><div class="ln"></div><div class="lbl">Mother</div></div>
          <div class="sign-line"><div class="ln"></div><div class="lbl">Helper / Family Member</div></div>
          <div class="sign-line" style="flex:0.6;"><div class="ln"></div><div class="lbl">Date</div></div>
        </div>
      </div>
    </div>
  </div>
  {footer_strap("Module 05 &middot; Roster C")}
</div>
''')

# ============================================================
# MODULE 06 — THE SLEEP BANKER (Recovery Bank ledger)
# ============================================================
add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">06</span>FAIRNESS SYSTEM &middot; LEDGER MECHANICS</div>
    <h1 class="title">The Sleep Banker <span class="accent">Recovery Bank</span></h1>
    <p class="dek">A fairness accounting system that translates invisible night exhaustion into visible, tradable credits &mdash; so exhaustion debt never silently compounds into resentment.</p>
    <hr class="rule" style="margin-bottom:8pt;"/>

    <table class="route-table" style="margin-bottom:10pt;">
      <tr><th style="width:34%">Credit type</th><th>What it is</th></tr>
      <tr><td><strong style="color:var(--ink)">1 Night Shift Credit (NSC)</strong></td><td>Covering a night block of 3&ndash;5 hrs outside your scheduled roster, allowing the other parent to sleep. Earned automatically by the covering parent.</td></tr>
      <tr><td><strong style="color:var(--ink)">1 Recovery Payback (RP)</strong></td><td>A morning sleep-in (until 11 AM) or a 3-hour weekend afternoon nap, where the other parent takes 100% responsibility for baby and household.</td></tr>
    </table>

    <div class="callout warning">
      <div class="ic">{icon("scale", color="#fff", size=12)}</div>
      <div class="body"><span class="label">The ledger rule &amp; the expiration rule</span>
      <div class="txt">All credits and debits are written on the Fridge Chart or the ledger below &mdash; verbal promises do not count. Every NSC must be redeemed within <strong>seven (7) days</strong> or it expires automatically. This is not a punishment; it prevents historical tally-keeping (&ldquo;you owe me from three weeks ago&rdquo;) and forces timely rest over compounding resentment.</div></div>
    </div>

    <div class="card-title" style="margin-top:12pt; font-size:11pt;">The Recovery Bank Ledger &mdash; print and attach to the Fridge Chart</div>
    <table class="ledger-table">
      <tr><th>Date earned</th><th>Parent (+1 NSC)</th><th>NSC activity</th><th>Date redeemed</th><th>Net balance</th></tr>
      <tr><td style="color:var(--text-muted); font-style:italic;">Example</td><td style="color:var(--text-muted); font-style:italic;">Partner</td><td style="color:var(--text-muted); font-style:italic;">Wed night extra block</td><td style="color:var(--text-muted); font-style:italic;">Sat morning sleep-in</td><td style="color:var(--text-muted); font-style:italic;">0</td></tr>
      <tr><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td><td></td></tr>
    </table>

    <div class="card-title" style="margin-top:14pt; font-size:11pt;">Three scenarios</div>
    <div style="margin-top:8pt;">
      <div class="scenario"><div class="sc-badge">01</div><div class="sc-txt"><strong>Partner covers an extra block.</strong> Baby is sick Wednesday; partner covers mother&rsquo;s 2&ndash;7 AM shift. Partner earns +1 NSC, logged Wednesday, redeemed as a Saturday sleep-in by Sunday.</div></div>
      <div class="scenario"><div class="sc-badge">02</div><div class="sc-txt"><strong>Emergency override.</strong> Any night the emergency handoff is activated and the off-duty parent takes over automatically earns the covering parent +1 NSC &mdash; no discussion needed.</div></div>
      <div class="scenario"><div class="sc-badge">03</div><div class="sc-txt"><strong>Expired credit.</strong> An NSC earned Monday, unredeemed by the following Monday, simply expires. Not a punishment &mdash; a system boundary. The goal is rest now, not debt-tracking later.</div></div>
    </div>
  </div>
  {footer_strap("Module 06 &middot; Sleep Banker")}
</div>
''')

# ============================================================
# MODULE 07 — SCRIPT CARDS (printable, cut-along-dashed-line)
# ============================================================
scripts = [
    (1,"message-square-text","Initiating the Shift Conversation","During the day &mdash; never at night &mdash; when the baby is calm.",
     "I love how hard we are both working to take care of the baby. But my current exhaustion isn&rsquo;t sustainable &mdash; I am hitting a wall. I want us to look at this night-shift contract together. It&rsquo;s not about fault, it&rsquo;s about a roster so we both get a guaranteed sleep block. Can we look at it for 5 minutes after lunch?"),
    (2,"clipboard-list","Defusing &ldquo;I Have Work Tomorrow&rdquo;","When your partner objects that he needs sleep for his job.",
     "I hear you, and your job is crucial. But caring for a newborn all day is also a full-time, high-stakes job. If I collapse or my health fails, our household goes down. We both need a minimum safety block to do our jobs safely. Let&rsquo;s look at the template that protects your sleep for the second half of the night."),
    (3,"heart-handshake","Handling &ldquo;You Do It Better&rdquo;","When he claims the baby only calms for you, to avoid night duty.",
     "The baby only prefers me because I&rsquo;ve had more practice. You are just as capable of learning. If I step in every time, you will never get that practice, and I will never get sleep. I&rsquo;m putting on my white noise machine. I trust you to find your rhythm. I&rsquo;m going to sleep now."),
    (4,"alarm-clock","The Emergency Handoff","When the active manager has reached their limit and safety is at risk.",
     "I have reached my limit. I am holding the baby safely but I am too exhausted to continue safely. I need to activate the emergency handoff. I&rsquo;m putting the baby safely in the crib now and I need you to take over. I&rsquo;ll be back in 30 minutes."),
    (5,"calendar-clock","The 5-Minute Sunday Roster Review","Every Sunday afternoon, to adjust the coming week&rsquo;s roster.",
     "Let&rsquo;s do our 5-minute night review. How did last week&rsquo;s shifts feel? Did you get your sleep blocks? Baby is waking at different times now &mdash; do we need to adjust our transition time? Let&rsquo;s write the updated hours on the chart."),
    (6,"refresh-ccw","The No-Blame Reset","The morning after a night the roster collapsed or someone slept through.",
     "Last night was rough and we both lost our tempers. Let&rsquo;s not blame each other &mdash; exhaustion does that. The roster didn&rsquo;t work because [specific reason]. Let&rsquo;s adjust: tonight we will [specific fix]. We reset today with a clean slate."),
    (7,"users","Defusing Extended Family Critique","When relatives say night duty &ldquo;isn&rsquo;t a man&rsquo;s job.&rdquo;",
     "Thank you for your care and concern. This is how we protect our marriage and our baby&rsquo;s safety. Sharing night shifts helps him bond with the baby from the beginning, and lets me heal physically. This system works for our household, and we are committed to it."),
]

def script_card(n, ic, title, when, quote):
    return f'''<div class="script-card">
      <div class="sc-num">{n}</div>
      <div class="sc-head"><div class="sc-tag">Script Card</div><div class="sc-icon">{icon(ic, color="#0B1F33", size=20)}</div></div>
      <div class="sc-title">{title}</div>
      <div class="sc-when"><b>When to use &middot;</b> {when}</div>
      <div class="sc-quote">&ldquo;{quote}&rdquo;</div>
    </div>'''

add(f'''
<div class="page printable-page">
  <div class="printable-frame">
    <div class="printable-tag">{icon("printer", color="#0B1F33", size=10)}PRINTABLE &middot; MODULE 07 &middot; 1 OF 4</div>
    <div class="script-card-page">
      {script_card(1,*scripts[0][1:])}
      <div class="cut-line">{icon("scissors", color="#7B8794", size=11)}<div class="dash"></div><span>Cut along dashed line</span><div class="dash"></div></div>
      {script_card(2,*scripts[1][1:])}
    </div>
  </div>
</div>
''')
add(f'''
<div class="page printable-page">
  <div class="printable-frame">
    <div class="printable-tag">{icon("printer", color="#0B1F33", size=10)}PRINTABLE &middot; MODULE 07 &middot; 2 OF 4</div>
    <div class="script-card-page">
      {script_card(3,*scripts[2][1:])}
      <div class="cut-line">{icon("scissors", color="#7B8794", size=11)}<div class="dash"></div><span>Cut along dashed line</span><div class="dash"></div></div>
      {script_card(4,*scripts[3][1:])}
    </div>
  </div>
</div>
''')
add(f'''
<div class="page printable-page">
  <div class="printable-frame">
    <div class="printable-tag">{icon("printer", color="#0B1F33", size=10)}PRINTABLE &middot; MODULE 07 &middot; 3 OF 4</div>
    <div class="script-card-page">
      {script_card(5,*scripts[4][1:])}
      <div class="cut-line">{icon("scissors", color="#7B8794", size=11)}<div class="dash"></div><span>Cut along dashed line</span><div class="dash"></div></div>
      {script_card(6,*scripts[5][1:])}
    </div>
  </div>
</div>
''')
add(f'''
<div class="page printable-page">
  <div class="printable-frame">
    <div class="printable-tag">{icon("printer", color="#0B1F33", size=10)}PRINTABLE &middot; MODULE 07 &middot; 4 OF 4</div>
    <div class="script-card-page" style="align-items:center;">
      {script_card(7,*scripts[6][1:])}
      <div style="flex:1; display:flex; align-items:center; justify-content:center; margin-top:14pt;">
        <div style="text-align:center; color:var(--text-muted); max-width:110mm;">
          <div style="margin-bottom:8pt;">{icon("message-square-text", color="#DDE2E7", size=28)}</div>
          <div class="small">These are precision tools, not suggestions. Do not improvise at 3 a.m. Use the script.</div>
        </div>
      </div>
    </div>
  </div>
</div>
''')

# ============================================================
# MODULE 08 — THE FRIDGE SHIFT CHART (printable poster)
# ============================================================
add(f'''
<div class="page printable-page">
  <div class="printable-frame">
    <div class="printable-tag">{icon("printer", color="#0B1F33", size=10)}PRINTABLE &middot; MODULE 08 &middot; FRIDGE CHART</div>
    <div class="fchart">
      <div class="fchart-head">
        <div><div class="ft">Every Night, Just Me</div><div class="fs">NIGHT-SHIFT CHART &middot; swiipt.com/v06</div></div>
        {mark_reverse(30)}
      </div>
      <div class="fchart-meta">
        <div class="fmeta-box" style="flex:1.3;"><div class="fl">Week of</div><div style="border-bottom:1pt solid var(--border); height:16pt;"></div></div>
        <div class="fmeta-box"><div class="fl">Roster type (circle one)</div><div class="roster-dots"><div class="rd">A</div><div class="rd">B</div><div class="rd">C</div></div></div>
      </div>

      <div class="fblock">
        <div class="fblock-head"><div class="fb-t">{icon("sunset", color="#0B1F33", size=13)}Shift 1 &mdash; Evening Block</div><div class="fb-hrs">_______ PM to _______ AM</div></div>
        <div class="fb-mgr">Active Shift Manager: ________________________________</div>
        <div class="fb-duty">Duties: Diaper check &middot; Soothe &middot; Bottle feed (if applicable)</div>
        <div class="fb-dnd">{icon("moon-star", color="#52606D", size=11)} Off-duty parent is in <strong style="color:var(--ink);">Do Not Disturb</strong> sleep zone &middot; may use earplugs / white noise. Active manager stays fully alert &mdash; no sleep aids.</div>
      </div>

      <div class="transition-strip"><div class="dash"></div><div class="tt">&#9679; Transition &mdash; Silent Handoff &middot; ______ AM &middot; Method: alarm / tap</div><div class="dash"></div></div>

      <div class="fblock">
        <div class="fblock-head"><div class="fb-t">{icon("sunrise", color="#0B1F33", size=13)}Shift 2 &mdash; Morning Block</div><div class="fb-hrs">_______ AM to _______ AM</div></div>
        <div class="fb-mgr">Active Shift Manager: ________________________________</div>
        <div class="fb-duty">Duties: Breastfeed / Bottle feed &middot; Diaper check &middot; Soothe</div>
        <div class="fb-dnd">{icon("moon-star", color="#52606D", size=11)} Off-duty parent is in <strong style="color:var(--ink);">Do Not Disturb</strong> sleep zone.</div>
      </div>

      <div class="callout safety" style="margin:9pt 0;">
        <div class="ic">{icon("shield-alert", color="#fff", size=12)}</div>
        <div class="body"><span class="label">Emergency handoff rule</span><div class="txt">If baby cannot be settled, or you are concerned about feeding, illness, or safety &mdash; assess baby and follow pediatric guidance or seek help. To coordinate partner support, say: <strong>&ldquo;I need a handoff.&rdquo;</strong></div></div>
      </div>

      <div class="card-title" style="font-size:10pt; margin-bottom:4pt;">Recovery Bank Ledger</div>
      <table class="ledger-table" style="margin-top:0;">
        <tr><th>Date</th><th>Parent (+1 NSC)</th><th>NSC activity</th><th>Date redeemed</th></tr>
        <tr><td></td><td></td><td></td><td></td></tr>
        <tr><td></td><td></td><td></td><td></td></tr>
      </table>
      <p class="small muted" style="margin-top:6pt; text-align:center;">Credits expire in 7 days. Redeem as a morning sleep-in (to 11 AM) or a 3-hour afternoon nap. Write it &mdash; don&rsquo;t just promise.</p>
    </div>
  </div>
</div>
''')

# ============================================================
# MODULE 09 — THE 14-DAY SHIFT TRACKER (landscape printable)
# ============================================================
tracker_rows = ""
for d in range(1, 15):
    tracker_rows += f'''<tr>
      <td class="dnum">{d}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>'''
    if d == 7:
        tracker_rows += '''<tr class="review-row"><td colspan="9">DAY 7 CHECK-IN &mdash; Run the 5-Minute Sunday Review (Script Card 5). Adjust shift times below if needed. New times: ___________________________________________</td></tr>'''

add(f'''
<div class="page landscape printable-page">
  <div style="margin:8mm; height:calc(100% - 16mm); border:1.6pt dashed #C7CFD6; border-radius:14pt; position:relative; padding:9mm 11mm; background:#fff;">
    <div class="printable-tag">{icon("printer", color="#0B1F33", size=10)}PRINTABLE &middot; MODULE 09 &middot; 14-DAY TRACKER</div>
    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8pt;">
      <div><span class="serif" style="font-size:19pt; color:var(--navy);">The 14-Day Shift Tracker</span> <span class="muted small">&mdash; log the system&rsquo;s real performance, one row per night</span></div>
      <div class="small muted">Started: ______________</div>
    </div>
    <table class="tracker-table">
      <tr>
        <th style="width:4%;">Day</th><th style="width:10%;">Date</th><th style="width:8%;">Roster</th>
        <th style="width:15%;">Shift 1 manager</th><th style="width:15%;">Shift 2 manager</th>
        <th style="width:11%;">Mother&rsquo;s sleep (hrs)</th><th style="width:9%;">NSC earned</th>
        <th style="width:9%;">Handoff used?</th><th style="width:19%;">Friction / notes</th>
      </tr>
      {tracker_rows}
      <tr class="review-row"><td colspan="9">DAY 14 REVIEW &mdash; Total NSC earned: _______ &nbsp;&middot;&nbsp; Total NSC redeemed: _______ &nbsp;&middot;&nbsp; Average nightly sleep (mother): _______ hrs &nbsp;&middot;&nbsp; Keep this roster? &#9633; Yes &#9633; Adjust &#9633; Switch template</td></tr>
    </table>
  </div>
</div>
''')

# ============================================================
# MODULE 10 — THE RESCUE CARD (printable card object)
# ============================================================
add(f'''
<div class="page printable-page">
  <div class="printable-frame">
    <div class="printable-tag">{icon("printer", color="#0B1F33", size=10)}PRINTABLE &middot; MODULE 10 &middot; RESCUE CARD</div>
    <div class="rescue-stage">
      <div class="rescue-card-obj">
        <div class="rc-head"><div class="rc-t">Bad Night Protocol</div><div class="rc-s">The Rescue Card &middot; Every Night, Just Me</div></div>

        <div class="rc-step">
          <div class="rc-n">1</div>
          <div><div class="rc-tt">Put baby down safely</div><div class="rc-dd">Place baby on their back, in the crib or bassinet, on a firm flat surface &mdash; even mid-cry. A crying baby in a safe crib is safer than an exhausted adult holding them.</div></div>
        </div>
        <div class="rc-step">
          <div class="rc-n">2</div>
          <div><div class="rc-tt">Step back &amp; reset, 60 seconds</div><div class="rc-dd">Leave the room if needed. Breathe. You are not failing &mdash; you are protecting your baby by stepping back before you reach zero capacity.</div></div>
        </div>
        <div class="rc-step">
          <div class="rc-n">3</div>
          <div><div class="rc-tt">Call for the handoff</div><div class="rc-dd">Wake your partner or helper. Use the exact phrase below. This is not weakness &mdash; it is the system working exactly as designed.</div></div>
        </div>

        <div class="rc-phrase">&ldquo;I need a handoff. Now.&rdquo;</div>

        <div class="rc-emerg">
          <div class="re-item"><div class="re-num">988</div><div class="re-country">USA &middot; 988 Suicide &amp; Crisis Lifeline</div></div>
          <div class="re-item"><div class="re-num">111</div><div class="re-country">UK &middot; NHS 111 &mdash; urgent medical help</div></div>
          <div class="re-item"><div class="re-num">112</div><div class="re-country">Nigeria &middot; 112 &mdash; emergency services</div></div>
        </div>
      </div>
      <div class="rescue-below-label"><div class="dash"></div>{icon("scissors", color="#7B8794", size=11)}&nbsp;Cut out and keep near the crib or on the fridge&nbsp;{icon("scissors", color="#7B8794", size=11)}<div class="dash"></div></div>
    </div>
  </div>
</div>
''')

# ============================================================
# MODULE 11 — THE RE-ENTRY PROTOCOL
# ============================================================
add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">11</span>RESTARTING WITHOUT GUILT</div>
    <h1 class="title">The Re-entry <span class="accent">Protocol</span></h1>
    <p class="dek">The roster will break sometimes &mdash; illness, travel, a terrible week, a fight. This is how you restart without turning the relapse into a new argument.</p>
    <hr class="rule"/>

    <div class="step-list">
      <div class="step">
        <div class="stn">1</div>
        <div><div class="stt">Name it without blame</div><div class="std">Say out loud: &ldquo;The roster broke down this week.&rdquo; Not &ldquo;you broke the roster.&rdquo; Exhaustion, illness, and travel break systems &mdash; people don&rsquo;t need to be at fault for that to be true.</div></div>
      </div>
      <div class="step">
        <div class="stn">2</div>
        <div><div class="stt">Run the No-Blame Reset</div><div class="std">Use <strong>Script Card 6</strong> verbatim, the same day if possible. Identify the one specific reason it broke &mdash; not a character flaw, a logistics gap.</div>
        <ul><li>Was the transition time unrealistic?</li><li>Did a feeding or teething change shift baby&rsquo;s wake pattern?</li><li>Did one parent take on a shift while sick or overloaded at work?</li></ul></div>
      </div>
      <div class="step">
        <div class="stn">3</div>
        <div><div class="stt">Adjust one variable, not the whole system</div><div class="std">Don&rsquo;t discard the roster and go back to unstructured nights. Change the smallest thing that caused the break &mdash; shift time, duty split, or feeding method &mdash; and re-commit for 48 hours before judging again.</div></div>
      </div>
      <div class="step">
        <div class="stn">4</div>
        <div><div class="stt">Re-sign, don&rsquo;t re-litigate</div><div class="std">Update the Fridge Chart with the new times. Both adults initial the change. Do not reopen the entire original argument from Module 1 &mdash; the system already answered that question.</div></div>
      </div>
    </div>

    <div class="callout human" style="margin-top:6pt;">
      <div class="ic">{icon("heart-handshake", color="#fff", size=12)}</div>
      <div class="body"><span class="label">A relapse is not a failure</span><div class="txt">Every couple running this system has a bad week. What makes the system work long-term isn&rsquo;t a perfect streak &mdash; it&rsquo;s a fast, low-drama return to the roster. Restarting on day 2 instead of day 12 is the entire skill.</div></div>
    </div>
  </div>
  {footer_strap("Module 11 &middot; Re-entry Protocol")}
</div>
''')

# ============================================================
# MODULE 12 — THE SAFETY GATE (crisis resources, checklist)
# ============================================================
add(f'''
<div class="page">
  <div class="page-pad">
    <div class="eyebrow"><span class="num">12</span>WHEN A ROSTER ISN&rsquo;T ENOUGH</div>
    <h1 class="title">The Safety <span class="accent">Gate</span></h1>
    <p class="dek">This system coordinates a household. It cannot treat a medical or mental-health emergency. Read this checklist honestly &mdash; for yourself, or for your partner.</p>
    <hr class="rule"/>

    <div class="checklist">
      <div class="check-item"><div class="cb"></div>Thoughts of harming yourself or your baby, even fleeting or &ldquo;intrusive&rdquo;</div>
      <div class="check-item"><div class="cb"></div>Persistent feelings of hopelessness, worthlessness, or rage lasting more than two weeks</div>
      <div class="check-item"><div class="cb"></div>Inability to sleep even when the baby is asleep and a shift-partner is covering</div>
      <div class="check-item"><div class="cb"></div>Panic attacks, racing thoughts, or a sense of unreality</div>
      <div class="check-item"><div class="cb"></div>Physical symptoms that concern you &mdash; chest pain, fainting, uncontrolled bleeding, fever</div>
    </div>

    <div class="callout safety">
      <div class="ic">{icon("shield-alert", color="#fff", size=12)}</div>
      <div class="body"><span class="label">If you checked even one box</span><div class="txt">Stop optimizing the roster. This is a clinical situation, not a scheduling one. Contact your doctor, midwife, or a crisis line today &mdash; the same day, not &ldquo;when things calm down.&rdquo; Postpartum depression, anxiety, and psychosis are medical, treatable conditions &mdash; they are not a personal failing, and they are not something a shift chart can fix alone.</div></div>
    </div>

    <div class="card-title" style="margin-top:14pt; font-size:11pt;">Crisis &amp; support directory</div>
    <div class="crisis-grid">
      <div class="crisis-card">
        <div class="cc-head">{icon("phone", color="#fff", size=12)} United States</div>
        <div class="cc-body">
          <div class="crisis-line"><div class="cl-name">988 Suicide &amp; Crisis Lifeline</div><div class="cl-num">988</div></div>
          <div class="crisis-line"><div class="cl-name">Postpartum Support Int&rsquo;l</div><div class="cl-num">1-800-944-4773</div></div>
        </div>
      </div>
      <div class="crisis-card">
        <div class="cc-head">{icon("phone", color="#fff", size=12)} United Kingdom</div>
        <div class="cc-body">
          <div class="crisis-line"><div class="cl-name">NHS non-emergency</div><div class="cl-num">111</div></div>
          <div class="crisis-line"><div class="cl-name">Samaritans</div><div class="cl-num">116 123</div></div>
        </div>
      </div>
      <div class="crisis-card">
        <div class="cc-head">{icon("phone", color="#fff", size=12)} Nigeria</div>
        <div class="cc-body">
          <div class="crisis-line"><div class="cl-name">National Emergency Number</div><div class="cl-num">112</div></div>
          <div class="crisis-line"><div class="cl-name">Mentally Aware Nigeria</div><div class="cl-num">0809&ndash;111&ndash;6264</div></div>
        </div>
      </div>
    </div>

    <div class="callout human" style="margin-top:12pt;">
      <div class="ic">{icon("hand-heart", color="#fff", size=12)}</div>
      <div class="body"><span class="label">For partners</span><div class="txt">If she checked a box but is reluctant to call, you can make the call together, or offer to sit with her while she does. Reluctance to seek help is common and is not a sign it isn&rsquo;t needed &mdash; it is often a sign it is needed most.</div></div>
    </div>
  </div>
  {footer_strap("Module 12 &middot; Safety Gate")}
</div>
''')

# ============================================================
# COLOPHON / CLOSING
# ============================================================
add(f'''
<div class="page navy-bg">
  <div class="page-pad" style="display:flex; flex-direction:column; height:100%; color:#fff;">
    <div class="flex" style="align-items:center; gap:8pt;">{mark_reverse(26)}<span style="font-weight:700; letter-spacing:.1em; font-size:11pt;">SWIIPT</span></div>
    <div style="margin-top:20mm;">
      <div class="eyebrow on-navy"><span class="num" style="background:var(--gold); color:var(--navy);">&#10003;</span>YOU HAVE EVERYTHING YOU NEED</div>
      <h1 class="serif" style="font-size:27pt; color:#fff; max-width:140mm; line-height:1.2;">The roster is written. The words are ready. Tonight doesn&rsquo;t have to be just you.</h1>
      <p style="color:rgba(255,255,255,.72); font-size:11pt; max-width:130mm; margin-top:10pt; line-height:1.6;">Print the four printable pages, sign the roster you chose, and put the chart where you&rsquo;ll both see it tonight. Come back to the Contents page whenever the shape of a night changes.</p>
    </div>

    <div style="margin-top:22mm;">
      <div class="eyebrow on-navy" style="margin-bottom:8pt;">NEXT IN YOUR JOURNEY</div>
      <div class="next-teaser">
        <div class="teaser-card" style="background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.18);">
          <div class="tc-code" style="color:var(--blush);">V09</div>
          <div class="tc-t" style="color:#fff;">Return-to-Body</div>
          <div class="tc-d" style="color:rgba(255,255,255,.65);">A gentle postpartum movement &amp; recovery tracker for the weeks after sleep starts to stabilize.</div>
        </div>
        <div class="teaser-card" style="background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.18);">
          <div class="tc-code" style="color:var(--blush);">V11</div>
          <div class="tc-t" style="color:#fff;">The Fourth Trimester Budget</div>
          <div class="tc-d" style="color:rgba(255,255,255,.65);">A household cash-flow system for the first six months of new expenses.</div>
        </div>
        <div class="teaser-card" style="background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.18);">
          <div class="tc-code" style="color:var(--blush);">V19</div>
          <div class="tc-t" style="color:#fff;">Re-entry to Work</div>
          <div class="tc-d" style="color:rgba(255,255,255,.65);">A phased plan for returning to a career without losing the shift system you just built.</div>
        </div>
      </div>
    </div>

    <div style="margin-top:auto; border-top:0.75pt solid rgba(255,255,255,.18); padding-top:10pt; font-size:8pt; color:rgba(255,255,255,.5); display:flex; justify-content:space-between;">
      <div>Every Night, Just Me &middot; V06 &middot; Postpartum Couple OS</div>
      <div>Educational content, not a substitute for medical or clinical care</div>
    </div>
  </div>
</div>
''')

if __name__ == "__main__":
    html = "\n".join(pages)
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_output.html")
    with open(out_path, "w") as f:
        f.write(f'''<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <link rel="stylesheet" href="style.css"/></head><body>{html}</body></html>''')
    print("wrote", len(pages), "pages")
