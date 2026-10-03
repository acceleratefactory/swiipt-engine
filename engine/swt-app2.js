/* SWIIPT App v2 â€” runtime part A: boot, state-over-REST, shell.
   Reference architecture (index/app-shell), live platform state (blocks.*).
   DOM speaks the v1 state protocol (data-swt-block/field/row, swt-rep-row,
   swt-col-item) so collect()/save() round-trip without loss; read-only rows
   carry hidden inputs. Nothing here names a product: copy comes from boot. */
(function () {
'use strict';
var boot = window.SWIIPT_APP2 || {};
var TS = boot.ts;
if (!TS) { return; }
var R = boot.copy || {};
var XP = (R.experience && typeof R.experience === 'object') ? R.experience : {};
var SYM = (boot.symbol === undefined || boot.symbol === null || boot.symbol === '') ? '' : String(boot.symbol);

var S = (boot.state && boot.state.blocks) ? boot.state.blocks : {};
var HIST = (boot.state && Array.isArray(boot.state.history)) ? boot.state.history : [];
var CMP = boot.computed || {};
var DISP = boot.display || {};

var activeView = (function () {
  var nav = (XP.navigation && XP.navigation.items) || (boot.copy && boot.copy.nav) || [];
  var v0 = boot.view || '';
  var i;
  if (v0) { for (i = 0; i < nav.length; i++) { if (nav[i].view === v0 || nav[i].id === v0 || nav[i].module === v0) { return (nav[i].view || nav[i].id); } } }
  var e = (XP.entry) || {};
  var st = String(XP.experience_state || '');
  var cand = (st === 'first_visit' && e.first_visit) ? e.first_visit : (e.returning || e.initial || e.first_visit || '');
  for (i = 0; i < nav.length; i++) { if (nav[i].view === cand || nav[i].id === cand) { return (nav[i].view || nav[i].id); } }
  return nav.length ? (nav[0].view || nav[0].id) : 'dashboard';
})();
var quizStep = 'recurring';
var decideStep = 'form';
var decideDraft = { item: '', price: '', problem: '', answers: {}, outcome: '' };

/* ---------------- helpers ---------------- */
function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function attr(el, n) { return el ? el.getAttribute(n) : null; }
function esc(s) { var d = document.createElement('div'); d.textContent = (s === null || s === undefined) ? '' : String(s); return d.innerHTML; }
function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
function money(v) {
  if (v === null || v === undefined || v === '') { return 'â€”'; }
  var n = Number(String(v).replace(/,/g, ''));
  if (isNaN(n)) { return 'â€”'; }
  return SYM + Math.round(n).toLocaleString('en-US');
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(ds, days) {
  var d = new Date((ds || todayStr()) + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function B(id) { return (S && S[id]) ? S[id] : {}; }
function rowsOf(id) {
  if (!S[id]) { S[id] = {}; }
  var b = S[id];
  if (Array.isArray(b.rows)) { return b.rows; }
  if (Array.isArray(b.entries)) { return b.entries; }
  b.rows = [];
  return b.rows;
}
function eff() {
  var e = CMP.effective || {};
  return {
    normal: (e.normal === undefined || e.normal === null || e.normal === '') ? null : Number(e.normal),
    lean: (e.lean === undefined || e.lean === null || e.lean === '') ? null : Number(e.lean),
    peak: (e.peak === undefined || e.peak === null || e.peak === '') ? null : Number(e.peak),
    fund: (e.fund === undefined || e.fund === null || e.fund === '') ? null : Number(e.fund)
  };
}
function prof() {
  var p = CMP.profile || {}, m = CMP.m1 || {};
  function g(o, k) { var v = (o || {})[k]; return (v === undefined || v === null || v === '') ? null : Number(v); }
  return {
    normal: g(p, 'normal'), lean: g(p, 'lean'), peak: g(p, 'peak'), fund: g(p, 'fund'),
    recMonthly: g(m, 'rec_monthly'), occMonthly: g(m, 'occ_monthly')
  };
}
function hasData() { return eff().normal !== null; }

/* ---------------- state over REST (same contract as v1) ---------------- */
var timer = null, inflight = false, queued = false, queuedCommit = false, dirty = false;
function track(name, payload) {
  try {
    fetch(boot.restBase + '/event', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': boot.nonce },
      body: JSON.stringify({ ts: TS, name: name, payload: payload || {} })
    }).catch(function () {});
  } catch (e) {}
}
function collect() {
  var blocks = {};
  function blk(id) { if (!blocks[id]) { blocks[id] = {}; } return blocks[id]; }
  qsa('[data-swt-block][data-swt-field]').forEach(function (el) {
    if (attr(el, 'data-swt-row') !== null) { return; }
    var id = attr(el, 'data-swt-block'), f = attr(el, 'data-swt-field'), b = blk(id);
    if (el.type === 'checkbox') { b[f] = el.checked ? 1 : 0; return; }
    if (f === 'answers' || f === 'outcome') { try { b[f] = JSON.parse(el.value); } catch (e) { b[f] = el.value; } return; }
    b[f] = el.value;
  });
  qsa('[data-swt-rep]').forEach(function (rep) {
    var rows = [];
    qsa('.swt-rep-row', rep).forEach(function (r) {
      var o = {};
      qsa('[data-swt-field]', r).forEach(function (el) { o[attr(el, 'data-swt-field')] = el.value; });
      rows.push(o);
    });
    blk(attr(rep, 'data-swt-rep')).rows = rows;
  });
  qsa('[data-swt-col]').forEach(function (col) {
    var entries = [];
    qsa('.swt-col-item', col).forEach(function (it) {
      var o = {};
      qsa('[data-swt-field]', it).forEach(function (el) { o[attr(el, 'data-swt-field')] = el.value; });
      entries.push(o);
    });
    blk(attr(col, 'data-swt-col')).entries = entries;
  });
  return { blocks: blocks };
}
function setSave(t, tone) {
  var pill = document.getElementById('savePill');
  if (pill) { pill.textContent = t; pill.setAttribute('data-tone', tone || ''); }
}
function save(now, commit) {
  dirty = true;
  if (timer) { clearTimeout(timer); }
  timer = setTimeout(function () { push(commit); }, now ? 0 : 700);
}
function push(commit) {
  if (inflight) { queued = true; queuedCommit = queuedCommit || !!commit; return; }
  inflight = true;
  setSave('Savingâ€¦', 'busy');
    var payload = collect();
    for (var _k in S) { if (S.hasOwnProperty(_k) && !(payload.blocks && (_k in payload.blocks))) { payload.blocks[_k] = S[_k]; } }
  fetch(boot.restBase + '/state', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': boot.nonce },
    body: JSON.stringify({ ts: TS, state: payload, commit: commit ? 1 : 0 })
  }).then(function (r) { return r.json(); }).then(function (j) {
    inflight = false;
    if (j && j.state) {
      S = (j.state.blocks) ? j.state.blocks : {};
      HIST = Array.isArray(j.state.history) ? j.state.history : [];
      CMP = j.computed || {};
      DISP = j.display || {};
      if (commit) { renderAll(); } else { renderTopbar(); }
    }
    setSave('All changes saved', 'ok');
    dirty = false;
    if (queued) { queued = false; var cq = queuedCommit; queuedCommit = false; push(cq); }
  }).catch(function () {
    inflight = false;
    setSave('Not saved â€” check your connection', '');
  });
}

/* ---------------- shared components (copy from boot) ---------------- */
function calloutHTML(type, title, body) {
  var cls = { info: 'info', warning: 'warning', success: 'success', protocol: 'protocol', safety: 'safety' }[type] || 'info';
  var icm = { info: 'info', warning: 'triangle-alert', success: 'circle-check-big', protocol: 'shield-check', safety: 'triangle-alert' };
  return '<div class="callout ' + cls + '"><div class="ic">' + icon(icm[type] || 'info', 15, '#fff') + '</div>'
    + '<div class="body"><span class="lbl">' + esc(title) + '</span><div class="tx">' + esc(body) + '</div></div></div>';
}
function statCard(label, value, sub) {
  return '<div class="stat-card"><div class="sv">' + value + '</div><div class="sl">' + esc(label) + '</div>' + (sub ? '<div class="ss">' + esc(sub) + '</div>' : '') + '</div>';
}
function emptyState(ic, text) {
  return '<div class="empty-state">' + icon(ic, 28, '#B7C0C9') + '<div>' + esc(text) + '</div></div>';
}
function verdictBadge(v, label) {
  return '<span class="verdict-badge badge-' + esc(String(v).toLowerCase()) + '">' + esc(label || v) + '</span>';
}
function toast(msg, warn) {
  var t = document.getElementById('toast');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.innerHTML = (warn
    ? '<svg class="tick" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg><span></span>'
    : '<svg class="tick" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg><span></span>');
  t.lastChild.textContent = msg;
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(window.__app2Toast);
  window.__app2Toast = setTimeout(function () { t.classList.remove('show'); }, 2400);
}

/* ---------------- shell ---------------- */
function navItems() {
  var xn = (XP.navigation && XP.navigation.items) || [];
  if (xn.length) { return xn.map(function (n) { return { view: (n.view || n.id), label: (n.label || n.id), icon: (n.icon || 'circle'), module: (n.module || '') }; }); }
  return (R.nav && R.nav.length) ? R.nav : [{ view: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' }];
}
function renderMark() {
  document.getElementById('brandMark').innerHTML =
    '<svg width="24" height="24" viewBox="0 0 100 100"><rect x="10" y="46" width="40" height="40" rx="10" transform="rotate(45 30 66)" fill="#FFFFFF"/><rect x="50" y="6" width="40" height="40" rx="10" transform="rotate(45 70 26)" fill="#D9A52E"/><path d="M42 54 L58 38" stroke="#D9A52E" stroke-width="5" stroke-linecap="round" opacity="0.9"/></svg><span>SWIIPT</span>';
}
function renderSidebar() {
  document.getElementById('sidebarNav').innerHTML = navItems().map(function (n) {
    return '<button class="nav-item' + (activeView === n.view ? ' active' : '') + '" data-act="goto-view" data-view="' + esc(n.view) + '">'
      + icon(n.icon || 'circle', 17) + '<span>' + esc(n.label) + '</span></button>';
  }).join('');
}
function renderTopbar() {
  var f = eff();
  var page = null;
  navItems().forEach(function (n) { if (n.view === activeView) { page = n; } });
  var title = page ? String(page.label).replace(/^\d+ Â· /, '') : 'Dashboard';
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('budgetNumberVal').textContent = (f.normal !== null) ? money(f.normal) : 'Not set yet';
  document.getElementById('btnRescue').innerHTML = icon('siren', 15) + ' Rescue';
  document.getElementById('btnSettings').innerHTML = icon('settings', 17);
}
function renderMain() {
  var main = document.getElementById('main');
  var html = '';
  if ((XP.render === 'generic') && XP.screens_html && (typeof XP.screens_html[activeView] === 'string')) { html = XP.screens_html[activeView]; }
  else if (activeView === 'dashboard') { html = renderDashboard(); }
  else if (activeView === 'quiz') { html = renderQuiz(); }
  else if (activeView === 'chart') { html = renderChart(); }
  else if (activeView === 'decide') { html = renderDecide(); }
  else if (activeView === 'swap') { html = renderSwap(); }
  else if (activeView === 'audit') { html = renderAudit(); }
  else { html = renderDashboard(); }
  main.innerHTML = html;
  main.scrollTop = 0;
}
function renderAll() {
  var shell = document.querySelector('.app-shell');
  if (shell) { shell.className = shell.className.replace(/\bxp-[a-z_]+/g, '').replace(/\s+/g, ' ').trim(); shell.classList.add('xp-' + String(XP.archetype || 'command_center').toLowerCase()); }
  var mainEl = document.getElementById('main');
  if (mainEl) {
    mainEl.setAttribute('data-xp-state', String(XP.experience_state || ''));
    var _lay = (XP.screens_resolved && XP.screens_resolved[activeView] && XP.screens_resolved[activeView].layout) || '';
    mainEl.className = mainEl.className.replace(/\bxp-layout-[a-z-]+/g, '').replace(/\s+/g, ' ').trim();
    if (_lay) { mainEl.classList.add('xp-layout-' + _lay); }
  }  document.body.classList.remove('xp-motion-none', 'xp-motion-subtle', 'xp-motion-standard', 'xp-motion-expressive');
  document.body.classList.add('xp-motion-' + String(XP.motion || 'standard'));
  var vars = (XP.tokens && XP.tokens.vars) || {};
  Object.keys(vars).forEach(function (k) { document.documentElement.style.setProperty(k, vars[k]); });
  renderMark(); renderSidebar(); renderTopbar(); renderMain();
}

/* SWIIPT App v2 â€” part B: dashboard, quiz, chart. */
function odo(s) {
  var k = 0;
  return String(s).split('').map(function (ch) {
    if (/\d/.test(ch)) {
      var reel = '0123456789'.split('').map(function (d) { return '<span>' + d + '</span>'; }).join('');
      return '<span class="od"><span class="od-r" style="--d:' + ch + ';--k:' + (k++) + '">' + reel + '</span></span>';
    }
    return '<span class="od-s">' + esc(ch) + '</span>';
  }).join('');
}
function rangeBarHTML(f) {
  if (f.normal === null) { return '<div class="range-empty">' + esc(R.dashboard.rangeEmpty) + '</div>'; }
  var span = (f.peak - f.lean) || 1;
  var pos = Math.min(100, Math.max(0, (f.normal - f.lean) / span * 100));
  return '<div class="range-wrap" data-lean="' + esc(f.lean) + '" data-peak="' + esc(f.peak) + '"><div class="scrub"><span></span></div>'    + '<div class="range"><i class="range-fill"></i><b class="range-dot" style="left:' + pos + '%"></b></div>'
    + '<div class="range-labels"><div><span>Lean</span><em class="rv">' + esc(money(f.lean)) + '</em></div>'
    + '<div class="mid"><span>Normal</span><em class="rv">' + esc(money(f.normal)) + '</em></div>'
    + '<div><span>Peak</span><em class="rv">' + esc(money(f.peak)) + '</em></div></div></div>';
}
function renderDashboard() {
  var f = eff(), D = R.dashboard;
  var dec = rowsOf('decisions');
  function c(v) { return dec.filter(function (x) { return x._verdict === v; }).length; }
  var b = c('buy'), w = c('wait'), n = c('never'), total = b + w + n;
  var held = dec.filter(function (d) { return d._verdict !== 'buy'; });
  var deferred = held.reduce(function (a, d) { return a + (parseFloat(d.price) || 0); }, 0);
  var sw = rowsOf('swaps');
  var activeSw = sw.filter(function (s) { return s._verdict === 'testing'; }).length;
  var keptSw = sw.filter(function (s) { return s._verdict === 'kept'; }).length;
  var au = rowsOf('audit');
  var due = au.filter(function (a) { return !a._verdict && addDays(a._date, 30) <= todayStr(); }).length;
  var ak = au.filter(function (a) { return a._verdict === 'keep'; }).length;
  var ar = au.filter(function (a) { return a._verdict === 'review'; }).length;
  var as = au.filter(function (a) { return a._verdict === 'resell'; }).length;
  var mods = [
    { id: 'quiz', n: 'Quiz', ic: 'calculator', done: f.normal !== null && (rowsOf('rec').length > 0 || rowsOf('occ').length > 0) },
    { id: 'chart', n: 'Chart', ic: 'banknote', done: HIST.length > 0 || !!(B('chart').review_on) },
    { id: 'decide', n: 'Decide', ic: 'scale-3d', done: dec.length > 0 },
    { id: 'swap', n: 'Swap', ic: 'shuffle', done: sw.length > 0 },
    { id: 'audit', n: 'Audit', ic: 'clipboard-list', done: au.length > 0 }
  ];
  var doneCount = mods.filter(function (m) { return m.done; }).length;
  var next = mods.filter(function (m) { return !m.done; })[0];
  var pct = Math.round(doneCount / 5 * 100);
  var today = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  var RC = 54, CIRC = 2 * Math.PI * RC;
  var gap = [b, w, n].filter(Boolean).length > 1 ? 5 : 0, off = 0;
  function arc(k, v) {
    if (!v) { return ''; }
    var len = Math.max(CIRC * v / total - gap, 1);
    var el = '<circle class="arc a-' + k + '" data-k="' + k + '" cx="70" cy="70" r="' + RC + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (CIRC - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
    off += CIRC * v / total;
    return el;
  }
  var vrows = [['buy', 'Buy', b], ['wait', 'Wait', w], ['never', 'Never', n]].map(function (r) {
    return '<button class="vrow" data-act="goto-view" data-view="decide" data-k="' + r[0] + '" data-c="' + r[2] + '" data-l="' + r[1] + '"><i class="d-' + r[0] + '"></i><span class="vl">' + r[1] + '</span><span class="vbar"><u class="mix-' + r[0] + '" style="width:' + (total ? r[2] / total * 100 : 0) + '%"></u></span><b class="vc">' + r[2] + '</b></button>';
  }).join('');
  var chips = (f.normal !== null) ? '<div class="chips">'
    + '<button class="chip" data-act="goto-view" data-view="chart"><em>' + esc(D.chipLean) + '</em><b>' + esc(money(f.lean)) + '</b></button>'
    + '<button class="chip" data-act="goto-view" data-view="chart"><em>' + esc(D.chipPeak) + '</em><b>' + esc(money(f.peak)) + '</b></button>'
    + '<button class="chip" data-act="goto-view" data-view="chart"><em>' + esc(D.chipFund) + '</em><b>' + esc(money(f.fund)) + '</b></button></div>' : '';
  var docs = (boot.copy && boot.copy.documents && boot.copy.documents.length) ? '<div class="card tile"><div class="tile-head"><div class="tile-ic">' + icon('package', 15) + '</div><div class="card-title" style="margin:0">' + esc(D.docsTitle || 'Your documents') + '</div></div>'
    + boot.copy.documents.map(function (d) {
      return '<div class="doc-row"><span>' + esc(d.title) + '</span><a class="btn btn-ghost btn-sm" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(D.docsOpen || 'Open') + '</a></div>';
    }).join('') + '</div>' : '';
  return ''
    + '<div class="hero-card"><div class="hero-grid"></div><div class="sweep"></div>'
    + '<div class="hero-top"><div class="hero-label">' + icon('wallet', 14, '#D9A52E') + ' ' + esc(D.heroLabel) + '</div><span class="live"><i></i>' + esc(today) + '</span></div>'
    + (f.normal !== null ? '<div class="hero-odo">' + odo(money(f.normal)) + '<small>/ month</small></div>' : '<div class="hero-odo idle">Not set yet</div>')
    + '<div class="hero-sub">' + esc(f.normal !== null ? D.heroHave : D.heroEmpty) + '</div>' + chips
    + '<button class="btn btn-gold" data-act="goto-view" data-view="quiz">' + esc(f.normal !== null ? D.heroCtaHave : D.heroCtaEmpty) + ' ' + icon('arrow-right', 15) + '</button></div>'
    + '<div class="card tile journey"><div class="tile-head"><div class="tile-ic">' + icon('sparkles', 15) + '</div>'
    + '<div><div class="card-title" style="margin:0">' + esc(D.setupTitle) + '</div><div class="card-sub" style="margin:2px 0 0">' + doneCount + ' ' + esc(D.setupOf) + (next ? ' Â· ' + esc(D.setupNext) + ': <b style="color:var(--gold-l);font-weight:600">' + esc(next.n) + '</b>' : ' Â· ' + esc(D.setupDone)) + '</div></div>'
    + '<div class="jpct">' + pct + '<small>%</small></div></div>'
    + '<div class="track"><i style="width:' + pct + '%"></i></div>'
    + '<div class="nodes">' + mods.map(function (m) {
      return '<button class="node' + (m.done ? ' done' : '') + ((next && next.id === m.id) ? ' next' : '') + '" data-act="goto-view" data-view="' + m.id + '"><span class="nd">' + (m.done ? icon('check', 16) : icon(m.ic, 16)) + '</span><span class="nl">' + esc(m.n) + '</span></button>';
    }).join('') + '</div></div>'
    + '<div class="bento">'
    + '<div class="card tile verdict-tile" data-total="' + total + '"><div class="tile-head"><div class="tile-ic">' + icon('scale-3d', 15) + '</div><div class="card-title" style="margin:0">' + esc(D.verdictTitle) + '</div></div>'
    + '<div class="vbody"><div class="dn"><svg viewBox="0 0 140 140"><circle class="dn-track" cx="70" cy="70" r="' + RC + '"/><g transform="rotate(-90 70 70)">' + arc('buy', b) + arc('wait', w) + arc('never', n) + '</g></svg>'
    + '<div class="dn-c"><b class="dn-num">' + total + '</b><span class="dn-lbl">' + esc(D.decisionsWord) + '</span></div></div>'
    + '<div class="vrows">' + vrows + '</div></div>'
    + '<button class="btn btn-ghost btn-sm vcta" data-act="goto-view" data-view="decide">' + esc(D.verdictCta) + ' ' + icon('arrow-right', 13) + '</button></div>'
    + '<div class="card tile" role="button" tabindex="0" data-act="goto-view" data-view="decide"><div class="tile-head"><div class="tile-ic gold">' + icon('wallet', 15) + '</div><span class="tile-go">' + icon('arrow-right', 16) + '</span></div>'
    + '<div class="sv">' + esc(money(deferred)) + '</div><div class="sl">' + esc(D.deferredTitle) + '</div>'
    + '<div class="ss">' + esc(held.length ? ('from ' + held.length + ' ' + D.deferredUnit + (held.length > 1 ? 's' : '')) : D.deferredEmpty) + '</div></div>'
    + '<div class="card tile" role="button" tabindex="0" data-act="goto-view" data-view="swap"><div class="tile-head"><div class="tile-ic">' + icon('shuffle', 15) + '</div><span class="tile-go">' + icon('arrow-right', 16) + '</span></div>'
    + '<div class="sv-row"><span class="sv">' + activeSw + '</span><span class="of">' + esc(D.swapOf) + '</span></div><div class="sl">' + esc(D.swapTitle) + '</div>'
    + '<div class="pips">' + [0, 1, 2].map(function (i) { return '<i class="pip' + (i < activeSw ? ' on' : '') + '"></i>'; }).join('') + '</div>'
    + '<div class="ss">' + keptSw + ' ' + esc(D.swapKept) + '</div></div>'
    + '<div class="card tile t-audit" role="button" tabindex="0" data-act="goto-view" data-view="audit"><div class="tile-head"><div class="tile-ic blue">' + icon('clipboard-list', 15) + '</div><div class="card-title" style="margin:0">' + esc(D.auditTitle) + '</div>'
    + (due ? '<span class="stat warn"><i></i>' + esc(D.auditNeed) + '</span>' : '<span class="stat ok"><i></i>' + esc(au.length ? D.auditOk : D.auditNone) + '</span>') + '<span class="tile-go">' + icon('arrow-right', 16) + '</span></div>'
    + '<div class="audit-body"><div><div class="sv">' + due + '</div><div class="sl">' + esc(D.auditDue) + '</div></div>'
    + '<div class="minis"><span><b>' + ak + '</b>Kept</span><span><b>' + ar + '</b>Review</span><span><b>' + as + '</b>Resell</span><span><b>' + au.length + '</b>Logged</span></div></div></div>'
    + '</div>'
    + '<div class="card tile range-card"><div class="tile-head"><div class="tile-ic gold">' + icon('banknote', 15) + '</div>'
    + '<div><div class="card-title" style="margin:0">' + esc(D.rangeTitle) + '</div><div class="card-sub" style="margin:2px 0 0">' + esc(D.rangeSub) + '</div></div>'
    + '<button class="btn btn-ghost btn-sm" style="margin-left:auto" data-act="goto-view" data-view="chart">' + esc(D.rangeCta) + ' ' + icon('arrow-right', 13) + '</button></div>'
    + rangeBarHTML(f) + '</div>'
    + docs
    + calloutHTML('protocol', D.calloutTitle, D.calloutBody);
}

/* ---------------- quiz ---------------- */
function quizHidden(id, field, value, row) {
  return '<input type="hidden" data-swt-block="' + esc(id) + '" data-swt-field="' + esc(field) + '"' + (row !== undefined ? ' data-swt-row="' + esc(row) + '"' : '') + ' value="' + esc(value === null || value === undefined ? '' : String(value)) + '"/>';
}
function quizTabs() {
  var tabs = R.quiz.tabs;
  return '<div class="step-tabs">' + tabs.map(function (t) {
    return '<button class="step-tab' + (quizStep === t.id ? ' active' : '') + '" data-act="quiz-step" data-step="' + esc(t.id) + '">' + esc(t.label) + '</button>';
  }).join('') + '</div>';
}
function quizRowsHTML(id, cols, emptyIcon, emptyText) {
  var list = rowsOf(id);
  if (!list.length) { return emptyState(emptyIcon, emptyText); }
  var head = cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '<th></th>';
  var body = list.map(function (r, i) {
    var tds = cols.map(function (c) {
      var v = r[c.id];
      var disp = (v === null || v === undefined || v === '') ? 'â€”' : String(v);
      if (c.options && v) { disp = c.options[v] || disp; }
      else if (c.money && v !== '' && v !== null && v !== undefined) { disp = money(v); }
      return '<td>' + esc(disp) + quizHidden(id, c.id, (v === null || v === undefined) ? '' : String(v), i) + '</td>';
    }).join('');
    return '<tr class="swt-rep-row">' + tds + '<td><button class="icon-btn-sm" data-act="del-row" data-block="' + esc(id) + '" data-idx="' + i + '">' + icon('x', 13) + '</button></td></tr>';
  }).join('');
  return '<table class="data-table"><tr>' + head + '</tr>' + body + '</table>';
}
function quizAddRow(id, cols, btnLabel) {
  return '<div class="add-row-form" data-swt-addrow="1">'
    + cols.map(function (c) {
      if (c.type === 'select') {
        return '<select data-swt-add="' + esc(c.id) + '"><option value="">' + esc(c.placeholder || c.label) + '</option>'
          + Object.keys(c.options || {}).map(function (k) { return '<option value="' + esc(k) + '">' + esc(c.options[k]) + '</option>'; }).join('') + '</select>';
      }
      return '<input type="' + (c.type === 'number' ? 'number' : 'text') + '" data-swt-add="' + esc(c.id) + '" placeholder="' + esc(c.placeholder || c.label) + '"/>';
    }).join('')
    + '<button class="btn btn-purple btn-sm" data-act="add-row" data-block="' + esc(id) + '">' + icon('plus', 14) + ' ' + esc(btnLabel) + '</button></div>';
}
function renderQuiz() {
  var Q = R.quiz, f = eff(), p = prof();
  var body = '';
  if (quizStep === 'recurring') {
    var cols = (Q.addFields && Q.addFields.rec) || [];
    body = '<div class="card" data-swt-rep="rec"><div class="card-title">' + esc(Q.step1Title) + '</div><div class="card-sub">' + esc(Q.step1Sub) + '</div>'
      + quizRowsHTML('rec', cols, 'repeat', Q.step1Empty)
      + quizAddRow('rec', cols, Q.addBtn || 'Add cost')
      + '<div class="hint-text">' + esc(Q.step1Hint) + '</div></div>';
  } else if (quizStep === 'occasional') {
    var cols2 = (Q.addFields && Q.addFields.occ) || [];
    body = '<div class="card" data-swt-rep="occ"><div class="card-title">' + esc(Q.step2Title) + '</div><div class="card-sub">' + esc(Q.step2Sub) + '</div>'
      + quizRowsHTML('occ', cols2, 'calendar-clock', Q.step2Empty)
      + quizAddRow('occ', cols2, Q.addBtn || 'Add cost') + '</div>';
  } else if (quizStep === 'figures') {
    body = '<div class="card"><div class="card-title">' + esc(Q.step3Title) + '</div><table class="kv-table">'
      + '<tr><td>' + esc(Q.figRecurring) + '</td><td>' + esc(p.recMonthly !== null ? money(p.recMonthly) : 'â€”') + '</td></tr>'
      + '<tr><td>' + esc(Q.figOccMonthly) + '</td><td>' + esc(p.occMonthly !== null ? money(p.occMonthly) : 'â€”') + '</td></tr>'
      + '<tr class="kv-highlight"><td><strong>' + esc(Q.figNormal) + '</strong></td><td><strong>' + esc(p.normal !== null ? money(p.normal) : 'â€”') + '</strong></td></tr>'
      + '<tr><td>' + esc(Q.figLean) + '</td><td>' + esc(p.lean !== null ? money(p.lean) : 'â€”') + '</td></tr>'
      + '<tr><td>' + esc(Q.figPeak) + '</td><td>' + esc(p.peak !== null ? money(p.peak) : 'â€”') + '</td></tr>'
      + '<tr><td>' + esc(Q.figFund) + '</td><td>' + esc(p.fund !== null ? money(p.fund) : 'â€”') + '</td></tr>'
      + '</table>' + calloutHTML('success', Q.figCalloutTitle, Q.figCalloutBody) + '</div>';
  } else {
    var note = B('check').note || '';
    body = '<div class="card"><div class="card-title">' + esc(Q.step4Title) + '</div><div class="card-sub">' + esc(Q.step4Sub) + '</div>'
      + '<div class="field"><label>' + esc(Q.realityLabel) + '</label><textarea id="realityNote" rows="4" data-swt-block="check" data-swt-field="note" placeholder="' + esc(Q.realityPh) + '">' + esc(note) + '</textarea></div>'
      + '<button class="btn btn-purple btn-sm" data-act="save-reality">' + esc(Q.realitySave) + '</button></div>';
  }
  return quizTabs() + body;
}

/* ---------------- chart ---------------- */
function renderChart() {
  var C2 = R.chart, f = eff(), ch = B('chart');
  function fv(k) { var v = ch[k]; return (v === null || v === undefined) ? '' : String(v); }
  var paths = (R.historyPaths && R.historyPaths.chart) || [];
  var log = HIST.filter(function (h) { return paths.some(function (p) { return String(h.path || '').indexOf(p) === 0; }); }).slice().reverse();
  var logHtml = log.length ? '<table class="data-table"><tr><th>Date</th><th>Field</th><th>Change</th><th>Reason</th></tr>'
    + log.map(function (c) {
      function fm(v) { return (v === null || v === undefined || v === '') ? 'â€”' : ((isNaN(Number(v)) || String(v).trim() === '') ? String(v) : money(v)); }
      return '<tr><td>' + esc(c.at || '') + '</td><td>' + esc(c.label || c.path || '') + '</td><td>' + esc(fm(c.from) + ' â†’ ' + fm(c.to)) + '</td><td>' + esc(c.reason || 'â€”') + '</td></tr>';
    }).join('') + '</table>'
    : emptyState('pen-line', C2.histEmpty);
  return ''
    + '<div class="card"><div class="card-title">' + esc(C2.figTitle) + '</div><div class="card-sub">' + esc(C2.figSub) + '</div>'
    + rangeBarHTML(f)
    + '<table class="kv-table">'
    + '<tr><td>' + esc(C2.rowNormal) + '</td><td>' + esc(f.normal !== null ? money(f.normal) : C2.rowEmptyNormal) + '</td></tr>'
    + '<tr><td>' + esc(C2.rowLean) + '</td><td>' + esc(f.lean !== null ? money(f.lean) : 'â€”') + '</td></tr>'
    + '<tr><td>' + esc(C2.rowPeak) + '</td><td>' + esc(f.peak !== null ? money(f.peak) : 'â€”') + '</td></tr>'
    + '<tr><td>' + esc(C2.rowFund) + '</td><td>' + esc(f.fund !== null ? money(f.fund) : 'â€”') + '</td></tr>'
    + '</table></div>'
    + '<div class="card"><div class="card-title">' + esc(C2.adjTitle) + '</div><div class="card-sub">' + esc(C2.adjSub) + '</div>'
    + '<div class="grid-4">'
    + '<div class="field"><label>Normal / month</label><input type="number" data-swt-block="chart" data-swt-field="normal" placeholder="' + esc(f.normal !== null ? Math.round(f.normal) : '') + '" value="' + esc(fv('normal')) + '"/></div>'
    + '<div class="field"><label>Lean / month</label><input type="number" data-swt-block="chart" data-swt-field="lean" placeholder="' + esc(f.lean !== null ? Math.round(f.lean) : '') + '" value="' + esc(fv('lean')) + '"/></div>'
    + '<div class="field"><label>Peak / month</label><input type="number" data-swt-block="chart" data-swt-field="peak" placeholder="' + esc(f.peak !== null ? Math.round(f.peak) : '') + '" value="' + esc(fv('peak')) + '"/></div>'
    + '<div class="field"><label>Baby fund / month</label><input type="number" data-swt-block="chart" data-swt-field="fund" placeholder="' + esc(f.fund !== null ? Math.round(f.fund) : '') + '" value="' + esc(fv('fund')) + '"/></div>'
    + '</div><div class="grid-2">'
    + '<div class="field"><label>' + esc(C2.reasonLabel) + '</label><input type="text" data-swt-block="chart" data-swt-field="reason" placeholder="' + esc(C2.reasonPh) + '" value="' + esc(fv('reason')) + '"/></div>'
    + '<div class="field"><label>' + esc(C2.reviewLabel) + '</label><input type="date" data-swt-block="chart" data-swt-field="review_on" value="' + esc(fv('review_on')) + '"/></div>'
    + '</div><button class="btn btn-purple btn-sm" data-act="save-chart">' + esc(C2.save) + '</button></div>'
    + '<div class="card"><div class="card-title">' + esc(C2.histTitle) + '</div>' + logHtml + '</div>'
    + '<button class="btn btn-ghost" data-act="copy-chart">' + icon('copy', 14) + ' ' + esc(C2.copyBtn) + '</button>';
}

/* SWIIPT App v2 â€” part C: decide, swap, audit, overlays, acts, fx, init.
   Registers render from recipe regColumns + live field specs; add-forms from
   live addFields; entries build from record_fields. No product field ids here. */
function getPath(o, p) {
  var k = String(p || '').split('.');
  for (var i = 0; i < k.length; i++) { if (o === null || o === undefined) { return null; } o = o[k[i]]; }
  return (o === undefined) ? null : o;
}
function evalComputed(col, row) {
  var op = col.op;
  function v(x) { var n = parseFloat(x); return isNaN(n) ? null : n; }
  if (op === 'subtract' || op === 'add' || op === 'multiply' || op === 'divide') {
    var a = v(row[col.from]), b = v(row[col.to]);
    if (a === null || b === null) { return null; }
    if (op === 'subtract') { return a - b; }
    if (op === 'add') { return a + b; }
    if (op === 'multiply') { return a * b; }
    if (b === 0) { return null; }
    return a / b;
  }
  return null;
}
function fieldSpec(blockId, fid) {
  var all = (R.fields && R.fields[blockId]) || [];
  for (var i = 0; i < all.length; i++) { if (all[i].id === fid) { return all[i]; } }
  return { id: fid, label: fid };
}
function cellText(col, val, row) {
  if (col.type === 'computed') {
    var r = evalComputed(col, row || {});    return (r === null) ? 'â€”' : (col.money ? money(r) : String(Math.round(r * 100) / 100));
  }
  if (col.type === 'date_derived') { return (val === null || val === undefined || val === '') ? 'â€”' : String(val); }
  if (val === null || val === undefined || val === '') { return 'â€”'; }
  if (col.type === 'select' && col.options) { return col.options[val] || String(val); }
  if (col.money) { return money(val); }
  return String(val);
}
function rowHidden(blockId, fid, val, idx) {
  return '<input type="hidden" data-swt-block="' + esc(blockId) + '" data-swt-field="' + esc(fid) + '" data-swt-row="' + idx + '" value="' + esc(val === null || val === undefined ? '' : String(val)) + '"/>';
}
function walkVerdict(dt, answers) {
  var nid = dt.start, guard = 0;
  while (nid && dt.nodes[nid] && guard < 50) {
    guard++;
    var n = dt.nodes[nid];
    if (!n.options || !n.options.length) { return ''; }
    var idx = answers[nid];
    if (idx === undefined || idx === null || !n.options[idx]) { return ''; }
    var op = n.options[idx];
    if (op.outcome) { return op.outcome; }
    if (op.next && dt.nodes[op.next]) { nid = op.next; continue; }
    return '';
  }
  return '';
}
function verdictBadge(v, label) {
  return '<span class="verdict-badge badge-' + esc(String(v).toLowerCase()) + '">' + esc(label || v) + '</span>';
}
function renderDecide() {
  var D2 = R.decide, dec = rowsOf('decisions'), dt = R.dt || { nodes: {}, outcomes: {} };
  function c(v) { return dec.filter(function (x) { return x._verdict === v; }).length; }
  var deferred = dec.filter(function (d) { return d._verdict !== 'buy'; }).reduce(function (a, d) { return a + (parseFloat(d.price) || 0); }, 0);
  var formBody = '';
  if (decideStep === 'form') {
    var fields = D2.formFields || [];
    formBody = fields.map(function (fl, fi) {
      var d = decideDraft[fl.id] || '';
      var input = (fl.type === 'textarea')
        ? '<textarea id="dF' + fi + '" data-dk="' + esc(fl.id) + '" rows="' + (fl.rows || 2) + '" placeholder="' + esc(fl.placeholder || '') + '">' + esc(d) + '</textarea>'
        : '<input type="' + (fl.type === 'number' ? 'number' : 'text') + '" id="dF' + fi + '" data-dk="' + esc(fl.id) + '" placeholder="' + esc(fl.placeholder || '') + '" value="' + esc(d) + '"/>';
      return '<div class="field"><label>' + esc(fl.label) + (fl.required ? ' *' : '') + '</label>' + input + (fl.help ? '<div class="hint-text">' + esc(fl.help) + '</div>' : '') + '</div>';
    }).join('')
      + '<button class="btn btn-purple btn-sm" data-act="decide-next">' + esc(D2.formNext) + ' ' + icon('chevron-right', 13) + '</button>';
  } else {
    var nodes = dt.nodes || {};
    var qrows = Object.keys(nodes).filter(function (k) { return nodes[k].options && nodes[k].options.length; }).map(function (k) {
      var opts = nodes[k].options.map(function (o, i) {
        var on = (decideDraft.answers[k] === i) ? ' on' : '';
        return '<button class="seg-btn' + on + '" data-act="decide-q" data-q="' + esc(k) + '" data-i="' + i + '">' + esc(o.label) + '</button>';
      }).join('');
      return '<div class="qa-row"><div class="qa-q">' + esc(nodes[k].q) + '</div><div class="seg">' + opts + '</div></div>';
    }).join('');
    var verdict = walkVerdict(dt, decideDraft.answers);
    var out = (dt.outcomes || {})[verdict];
    formBody = qrows
      + (verdict && out ? '<div class="verdict-reveal">' + verdictBadge(verdict, out.label || verdict) + '<div class="vr-text">' + esc(out.body || '') + '</div></div>' : '')
      + '<div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="decide-back">' + icon('chevron-left', 13) + ' ' + esc(D2.back) + '</button>'
      + '<button class="btn btn-gold btn-sm" data-act="decide-save"' + (verdict ? '' : ' disabled') + '>' + esc(D2.save) + '</button></div>'
      + (verdict === 'wait' ? '<div class="field" style="margin-top:12px"><label>' + esc(D2.reviewPh) + '</label><input type="date" id="dReview" value="' + esc(decideDraft.review || addDays(todayStr(), 7)) + '"/></div>' : '');
  }
  var regCols = D2.regColumns || ['item', 'price', '_verdict', '_date'];
  function regCell(colId, x, i) {
    if (colId === '_verdict') {
      var o = (dt.outcomes || {})[x._verdict] || {};
      return '<td>' + verdictBadge(x._verdict, o.label || x._verdict) + rowHidden('decisions', '_verdict', x._verdict || '', i) + '</td>';
    }
    var col = fieldSpec('decisions', colId);
    return '<td>' + esc(cellText(col, x[colId], x)) + rowHidden('decisions', colId, x[colId] || '', i) + '</td>';
  }
  var reg = dec.length ? '<table class="data-table"><tr>' + regCols.map(function (c) {
      return '<th>' + esc(c === '_verdict' ? D2.verdictLabel : (c === '_date' ? D2.dateLabel : fieldSpec('decisions', c).label)) + '</th>';
    }).join('') + '</tr>'
    + dec.slice().reverse().map(function (x, ri) {
      var i = dec.length - 1 - ri;
      return '<tr class="swt-col-item">' + regCols.map(function (c) { return regCell(c, x, i); }).join('') + '</tr>';
    }).join('') + '</table>'
    : emptyState('scale-3d', D2.regEmpty);
  return '<div class="stat-grid">' + statCard(D2.statBuy, c('buy')) + statCard(D2.statWait, c('wait')) + statCard(D2.statNever, c('never')) + statCard(D2.statDeferred, money(deferred)) + '</div>'
    + '<div class="card" ><div class="card-title">' + esc(D2.cardTitle) + '</div><div class="card-sub">' + esc(D2.cardSub) + '</div>' + formBody + '</div>'
    + '<div class="card" data-swt-col="decisions"><div class="card-title">' + esc(D2.regTitle) + '</div>' + reg + '</div>';
}
function addRowHTML(blockId, showDate, btnLabel, fields) {
  fields = fields || [];
  var h = '<div class="add-row-form" data-swt-addrow="1" style="margin-top:12px;">';
  
  h += fields.map(function (fl) {
    if (fl.type === 'select') {
      return '<select data-swt-add="' + esc(fl.id) + '"><option value="">' + esc(fl.placeholder || fl.label) + '</option>'
        + Object.keys(fl.options || {}).map(function (k) { return '<option value="' + esc(k) + '">' + esc(fl.options[k]) + '</option>'; }).join('') + '</select>';
    }
    if (fl.type === 'textarea') { return '<input type="text" data-swt-add="' + esc(fl.id) + '" placeholder="' + esc(fl.placeholder || fl.label) + '"/>'; }
    return '<input type="' + (fl.type === 'number' || fl.type === 'date' ? fl.type : 'text') + '" data-swt-add="' + esc(fl.id) + '" placeholder="' + esc(fl.placeholder || fl.label) + '"/>';
  }).join('')
    + (showDate ? '<input type="date" data-swt-add="_date" value="' + esc(todayStr()) + '"/>' : '') + '<button class="btn btn-purple btn-sm" data-act="add-entry" data-block="' + esc(blockId) + '">' + icon('plus', 14) + ' ' + esc(btnLabel) + '</button></div>';
  return h;
}
function renderSwap() {
  var W = R.swap, list = rowsOf('swaps');
  var capMax = W.capMax || 3, capEq = W.capEq || 'testing';
  var active = list.filter(function (s) { return s._verdict === capEq; });
  var kept = list.filter(function (s) { return s._verdict === 'kept'; });
  var rejected = list.filter(function (s) { return s._verdict === 'rejected'; });
  var weeklyDiff = kept.reduce(function (a, s) { return a + ((parseFloat(s.old_cost) || 0) - (parseFloat(s.new_cost) || 0)); }, 0);
  var dis = active.length >= capMax ? ' disabled' : '';
  var regCols = W.regColumns || [];
  function regCell(colId, x, i, vopts) {
    if (colId === '_verdict') {
      var btns = (x._verdict === capEq) ? Object.keys(vopts).filter(function (k) { return k !== x._verdict; }).map(function (k) {
        var ic = (/reject|never/i.test(k)) ? 'x' : 'check';
        return '<button class="icon-btn-sm" data-act="swap-verdict" data-idx="' + i + '" data-v="' + esc(k) + '" title="' + esc(k) + '">' + icon(ic === 'x' ? 'x' : 'circle-check-big', 14) + '</button>';
      }).join('') : '';
      return '<td><span class="status-pill status-' + esc(x._verdict || '') + '">' + esc(x._verdict || '') + '</span>' + rowHidden('swaps', '_verdict', x._verdict || '', i) + btns + '</td>';
    }
    var col = fieldSpec('swaps', colId);
    return '<td>' + esc(cellText(col, x[colId], x)) + rowHidden('swaps', colId, x[colId] || '', i) + '</td>';
  }
  var vopts = W.verdictOptions || {};
  var reg = list.length ? '<table class="data-table"><tr>' + regCols.map(function (c) {
      return '<th>' + esc(c === '_verdict' ? W.verdictLabel : fieldSpec('swaps', c).label) + '</th>';
    }).join('') + '<th></th></tr>'
    + list.map(function (s, i) {
      return '<tr class="swt-col-item">' + regCols.map(function (c) { return regCell(c, s, i, vopts); }).join('') + '<td></td></tr>';
    }).join('') + '</table>'
    : emptyState('shuffle', W.regEmpty);
  return '<div class="stat-grid">' + statCard(W.statActive, active.length, W.statActiveSub) + statCard(W.statKept, kept.length) + statCard(W.statRejected, rejected.length) + statCard(W.statDiff, money(weeklyDiff)) + '</div>'
    + '<div class="card" data-swt-col="swaps"><div class="card-title">' + esc(W.regTitle) + '</div><div class="card-sub">' + esc(W.regNote) + '</div>' + reg
    + addRowHTML('swaps', false, W.addBtn, W.addFields || [])
    + (active.length >= capMax ? '<div class="hint-text">' + esc(W.capHint) + '</div>' : '') + '</div>';
}
function renderAudit() {
  var A = R.audit, list = rowsOf('audit');
  var kept = list.filter(function (a) { return a._verdict === 'keep'; }).length;
  var review = list.filter(function (a) { return a._verdict === 'review'; }).length;
  var resell = list.filter(function (a) { return a._verdict === 'resell'; }).length;
  var recovered = list.filter(function (a) { return a._verdict === 'resell'; }).reduce(function (acc, x) { return acc + (parseFloat(x.recovered) || 0); }, 0);
  var vopts = A.verdictOptions || { keep: 'Keep', review: 'Review', resell: 'Resell' };
  var regCols = A.regColumns || [];
  function regCell(colId, x, i) {
    if (colId === '_verdict') {
      var opts = [['', A.verdictNone]].concat(Object.keys(vopts).map(function (k) { return [k, vopts[k]]; })).map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (((x._verdict || '') === o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('');
      return '<td><select class="verdict-select" data-act="audit-verdict" data-idx="' + i + '">' + opts + '</select>' + rowHidden('audit', '_verdict', x._verdict || '', i) + '</td>';
    }
    if (colId === 'day30') { return '<td>' + esc(x._date ? addDays(x._date, 30) : 'â€”') + '</td>'; }
    var col = fieldSpec('audit', colId);
    return '<td>' + esc(cellText(col, x[colId], x)) + rowHidden('audit', colId, x[colId] || '', i) + '</td>';
  }
  var reg = list.length ? '<table class="data-table"><tr>' + regCols.map(function (c) {
      return '<th>' + esc(c === '_verdict' ? A.verdictLabel : (c === '_date' ? A.dateLabel : fieldSpec('audit', c).label)) + '</th>';
    }).join('') + '</tr>'
    + list.slice().reverse().map(function (a, ri) {
      var i = list.length - 1 - ri;
      return '<tr class="swt-col-item">' + regCols.map(function (c) { return regCell(c, a, i); }).join('') + '</tr>';
    }).join('') + '</table>'
    : emptyState('package', A.regEmpty);
  return '<div class="stat-grid">' + statCard(A.statLogged, list.length) + statCard(A.statKept, kept) + statCard(A.statReview, review) + statCard(A.statRecovered, money(recovered)) + '</div>'
    + '<div class="card" data-swt-col="audit"><div class="card-title">' + esc(A.regTitle) + '</div><div class="card-sub">' + esc(A.regNote) + '</div>' + reg
    + addRowHTML('audit', true, A.addBtn, A.addFields || []) + '</div>';
}
function renderRescueBody() {
  var r = R.rescue || {};
  return (r.steps || []).map(function (s) { return calloutHTML(s.tone || 'info', s.title || '', s.body || ''); }).join('')
    + '<div class="phrase-card">&ldquo;' + esc(r.phrase || '') + '&rdquo;</div>';
}
function renderSettingsBody() {
  var sc = R.scope, dec = rowsOf('decisions').length, sw = rowsOf('swaps').length, au = rowsOf('audit').length;
  return calloutHTML('info', sc.whatTitle, sc.whatText)
    + calloutHTML('warning', sc.notTitle, sc.notText)
    + '<div class="card"><div class="card-title" style="font-size:13px;">' + esc(sc.scopeTitle) + '</div><div class="card-sub" style="margin-bottom:0;">' + esc(sc.scopeText) + '</div></div>'
    + calloutHTML('safety', sc.safetyTitle, sc.safetyText)
    + '<div class="card"><div class="card-title" style="font-size:13px;">' + esc(sc.dataTitle) + '</div>'
    + '<div class="card-sub">' + dec + ' decisions Â· ' + sw + ' swaps Â· ' + au + ' audit items</div>'
    + '<div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="export-data">' + icon('copy', 13) + ' ' + esc(sc.exportBtn) + '</button>'
    + '<button class="btn btn-danger btn-sm" data-act="reset-data">' + esc(sc.resetBtn) + '</button></div></div>'
    + '<div class="foot-note">' + esc(R.contentVersion || '') + ' Â· ' + esc(R.productCode || R.productId || '') + '</div>';
}

/* ---------------- acts ---------------- */
function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
function addVals(block) {
  var zone = document.querySelector('[data-swt-col="' + block + '"] [data-swt-addrow]');
  var o = {};
  qsa('[data-swt-add]', zone).forEach(function (f) { o[f.getAttribute('data-swt-add')] = f.value.trim(); });
  return o;
}
document.addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('[data-act]') : null;
  if (!el) { return; }
  var act = el.getAttribute('data-act'), T = R.toasts;
  if (act === 'goto-view') {
    activeView = el.getAttribute('data-view') || 'dashboard';
    if (activeView === 'decide') { decideStep = 'form'; decideDraft = { item: '', price: '', problem: '', answers: {}, outcome: '' }; }
    renderAll(); return;
  }
  if (act === 'quiz-step') { quizStep = el.getAttribute('data-step'); renderMain(); return; }
  if (act === 'add-row') {
    var block = el.getAttribute('data-block');
    var zone = el.closest('[data-swt-addrow]');
    var o = {};
    qsa('[data-swt-add]', zone).forEach(function (f) { o[f.getAttribute('data-swt-add')] = f.value.trim(); });
    var keys = Object.keys(o);
    if (!keys.length || !o[keys[0]]) { toast(T.needName, true); return; }
    rowsOf(block).push(o);
    track(block === 'rec' ? 'recurring_added' : 'occasional_added', {});
    save(true); renderMain(); renderTopbar(); toast(T.added); return;
  }
  if (act === 'add-entry') {
    var b2 = el.getAttribute('data-block');
    var o2 = addVals(b2);
    var keys2 = Object.keys(o2).filter(function (k) { return k !== '_date'; });
    if (!keys2.length || !o2[keys2[0]]) { toast(T.needName, true); return; }
    o2._date = o2._date || todayStr();
    if (b2 === 'swaps') { o2._verdict = (R.swap.capEq || 'testing'); track('swap_added', {}); }
    if (b2 === 'audit') { o2._verdict = ''; o2.use_count = ''; o2.recovered = ''; track('audit_added', {}); }
    rowsOf(b2).push(o2);
    save(true); renderMain(); renderTopbar(); toast(T.added); return;
  }
  if (act === 'del-row') {
    var b = el.getAttribute('data-block'), i = parseInt(el.getAttribute('data-idx'), 10);
    rowsOf(b).splice(i, 1);
    save(true); renderMain(); renderTopbar(); return;
  }  if (act === 'save-reality') { var rt = document.getElementById('realityNote'); if (rt) { if (!S.check) { S.check = {}; } S.check.note = rt.value; } save(true, true); toast(T.saved); return; }
  if (act === 'save-chart') { save(true, true); toast(T.saved); return; }
  if (act === 'copy-chart') {
    var f = eff();
    var text = (R.title || '') + '\nNormal: ' + money(f.normal) + '\nLean: ' + money(f.lean) + '\nPeak: ' + money(f.peak) + '\nBaby fund: ' + money(f.fund);
    if (navigator.clipboard) { navigator.clipboard.writeText(text); }
    toast(T.copied); return;
  }
  if (act === 'decide-next') {
    var vals = {};
    var dcard = el.closest('.card');
    qsa('[data-dk]', dcard).forEach(function (f) { vals[f.getAttribute('data-dk')] = f.value.trim(); });
    var req = (R.decide.formFields || []).filter(function (fl) { return fl.required; });
    var firstKey = req.length ? req[0].id : ((R.decide.formFields || [])[0] || {}).id;
    decideDraft = { item: vals[((R.decide.formFields || [])[0] || {}).id] || '', price: '', problem: '', answers: {}, outcome: '', fields: vals };
    if (firstKey && !vals[firstKey]) { toast(T.needName, true); return; }
    decideStep = 'questions'; renderMain(); return;
  }
  if (act === 'decide-back') { decideStep = 'form'; renderMain(); return; }
  if (act === 'decide-q') {
    decideDraft.answers[el.getAttribute('data-q')] = parseInt(el.getAttribute('data-i'), 10);
    save(); renderMain(); return;
  }
  if (act === 'decide-save') {
    var dt = R.dt || { nodes: {} };
    var verdict = walkVerdict(dt, decideDraft.answers);
    if (!verdict) { return; }
    var entry = {};
    Object.keys(dt.record_fields || {}).forEach(function (field) {
      var src = dt.record_fields[field];
      var v = null;
      if (src === '@outcome') { v = verdict.toLowerCase(); }
      else if (src === '@date') { v = todayStr(); }
      else { v = getPath({ blocks: { purchase: (decideDraft.fields || {}), 'wait-review': { date: val('dReview') || '' } } }, src); }
      entry[field] = (v === null || v === undefined) ? '' : String(v);
    });
    if (verdict.toLowerCase() === 'wait' && !entry.review_on) { entry.review_on = addDays(todayStr(), 7); }
    if (!entry._date) { entry._date = todayStr(); }
    rowsOf('decisions').push(entry);
    track('decision_completed', { outcome: verdict });
    decideDraft = { item: '', price: '', problem: '', answers: {}, outcome: '' };
    decideStep = 'form';
    save(true, true); renderMain(); renderTopbar(); toast(T.savedDecision + verdict);
    return;
  }
  if (act === 'swap-verdict') {
    var sl = rowsOf('swaps'), si = parseInt(el.getAttribute('data-idx'), 10);
    if (sl[si]) { sl[si]._verdict = el.getAttribute('data-v'); track('swap_verdict', { v: el.getAttribute('data-v') }); }
    save(true, true); renderMain(); renderTopbar(); return;
  }
  if (act === 'open-rescue') {
    document.getElementById('rescueBody').innerHTML = renderRescueBody();
    document.getElementById('overlayRescue').classList.add('open');
    track('rescue_opened', {}); return;
  }
  if (act === 'close-rescue') { document.getElementById('overlayRescue').classList.remove('open'); return; }
  if (act === 'open-settings') {
    document.getElementById('settingsBody').innerHTML = renderSettingsBody();
    document.getElementById('overlaySettings').classList.add('open'); return;
  }
  if (act === 'close-settings') { document.getElementById('overlaySettings').classList.remove('open'); return; }
  if (act === 'export-data') {
    var blob = new Blob([JSON.stringify({ product: (R.productCode || R.productId || 'product'), state: { blocks: S, history: HIST }, computed: CMP }, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'swiipt-app-data.json'; a.click();
    URL.revokeObjectURL(url); return;
  }
  if (act === 'reset-data') {
    if (!confirm(R.scope.resetAsk)) { return; }
    fetch(boot.restBase + '/reset', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': boot.nonce },
      body: JSON.stringify({ ts: TS })
    }).then(function () { location.reload(); }).catch(function () { location.reload(); });
    return;
  }
});
document.addEventListener('change', function (e) {
  if (e.target.dataset && e.target.dataset.act === 'audit-verdict') {
    var list = rowsOf('audit'), i = parseInt(e.target.getAttribute('data-idx'), 10);
    var a = list[i];
    if (a) {
      a._verdict = e.target.value || '';
      if (a._verdict === 'resell') {
        var amt = prompt(R.audit.resellPrompt);
        if (amt) { a.recovered = amt; }
      }
      track('audit_verdict_set', { v: a._verdict });
      save(true, true); renderMain(); renderTopbar();
    }
  } else if (e.target.hasAttribute && e.target.hasAttribute('data-swt-block')) {
    save();
  }
});
document.addEventListener('input', function (e) {
  var el = e.target;
  if (!el.getAttribute || !el.getAttribute('data-swt-block')) { return; }
  if (el.type === 'date' || el.type === 'checkbox' || el.tagName === 'SELECT') { return; }
  save();
});
document.addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.tile[role=button]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape') { qsa('.overlay-wrap.open').forEach(function (o) { o.classList.remove('open'); }); }
  var zone = e.target.closest ? e.target.closest('[data-swt-addrow]') : null;
  if (zone && e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    var add = zone.querySelector('[data-act="add-row"],[data-act="add-entry"]');
    if (add && !add.disabled) { add.click(); }
  }
});

/* ---------------- fx: stagger, count-up, glow, tooltips, skeleton ---------------- */
(function fx() {
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var prev = {}, lastKey = '';
  function countUp(el, key, entering) {
    var m = el.textContent.trim().match(/^(.*?\s)?(-?[\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) { return; }
    var to = parseFloat(m[2].replace(/,/g, '')), from = entering ? 0 : (prev[key] || 0);
    prev[key] = to;
    if (from === to || calm) { return; }
    var t0 = performance.now(), d = 850;
    (function f(now) {
      var p = Math.min((now - t0) / d, 1), v = from + (to - from) * (1 - Math.pow(1 - p, 4));
      el.textContent = (m[1] || '') + Math.round(v).toLocaleString('en-US') + (m[3] || '');
      if (p < 1) { requestAnimationFrame(f); }
    })(t0);
  }
  window.__app2Post = function () {
    var main = document.getElementById('main'), key = activeView, entering = key !== lastKey;
    lastKey = key;
    main.classList.toggle('enter', entering);
    Array.prototype.forEach.call(main.children, function (c, i) { c.style.setProperty('--i', i); });
    qsa('.stat-card', main).forEach(function (c, i) { c.style.setProperty('--i', i); });
    qsa('.sv,.hero-value,.rv', main).forEach(function (el, i) { countUp(el, activeView + i, entering); });
    var reels = main.querySelectorAll('.od-r');
    if (!entering || calm) { reels.forEach(function (r) { r.style.transition = 'none'; r.classList.add('go'); }); }
    else { requestAnimationFrame(function () { requestAnimationFrame(function () { reels.forEach(function (r) { r.classList.add('go'); }); }); }); }
  };
  var _rm = renderMain;
  renderMain = function () { _rm(); window.__app2Post(); };
  var _rt = renderTopbar;
  renderTopbar = function () { _rt(); var b = document.getElementById('budgetNumberVal'); if (b) { countUp(b, 'top', false); } };
  document.addEventListener('pointermove', function (e) {
    var c = e.target.closest && e.target.closest('.card,.stat-card,.hero-card');
    if (!c) { return; }
    var r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
  var tip = document.createElement('div');
  tip.id = 'tip';
  document.body.appendChild(tip);
  var tt = null;
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('[data-tip],[title]');
    if (!el) { return; }
    if (el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); }
    clearTimeout(tt);
    tt = setTimeout(function () {
      tip.textContent = el.dataset.tip;
      var r = el.getBoundingClientRect();
      tip.classList.add('show');
      var w = tip.offsetWidth;
      tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      tip.style.top = (r.bottom + 8) + 'px';
    }, 150);
  });
  document.addEventListener('mouseout', function (e) { if (e.target.closest && e.target.closest('[data-tip]')) { clearTimeout(tt); tip.classList.remove('show'); } });
  document.addEventListener('click', function () { clearTimeout(tt); tip.classList.remove('show'); }, true);
  if (!calm && window.matchMedia && window.matchMedia('(hover:hover)').matches) {
    document.addEventListener('pointermove', function (e) {
      var t = e.target.closest && e.target.closest('.tile');
      if (!t) { return; }
      var r = t.getBoundingClientRect(), amp = Math.max(1, Math.min(6, 1400 / r.width));
      t.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * amp).toFixed(2) + 'deg');
      t.style.setProperty('--rx', ((-((e.clientY - r.top) / r.height - 0.5)) * amp).toFixed(2) + 'deg');
    }, { passive: true });
    document.addEventListener('pointerout', function (e) {
      var t = e.target.closest && e.target.closest('.tile');
      if (t && !t.contains(e.relatedTarget)) { t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); }
    });
  }
  document.addEventListener('mouseover', function (e) {
    var t = e.target.closest && e.target.closest('.verdict-tile');
    if (!t) { return; }
    var el = e.target.closest('[data-k]');
    var num = t.querySelector('.dn-num'), lbl = t.querySelector('.dn-lbl');
    if (el) { t.dataset.hl = el.dataset.k; num.textContent = el.dataset.c; lbl.textContent = el.dataset.l; }
  });
  document.addEventListener('mouseout', function (e) {
    var t = e.target.closest && e.target.closest('.verdict-tile');
    if (t && !t.contains(e.relatedTarget) && t.dataset.hl) { delete t.dataset.hl; t.querySelector('.dn-num').textContent = t.dataset.total; t.querySelector('.dn-lbl').textContent = 'decisions'; }
  });
  document.addEventListener('pointermove', function (e) {
    var w = e.target.closest && e.target.closest('.range-wrap');
    if (!w) { return; }
    var r = w.getBoundingClientRect(), x = Math.min(r.width - 4, Math.max(4, e.clientX - r.left)), p = (x - 4) / (r.width - 8);
    var lean = +w.dataset.lean, peak = +w.dataset.peak, s = w.querySelector('.scrub');
    if (s) { s.style.left = x + 'px'; s.firstElementChild.textContent = money(lean + p * (peak - lean)); }
  }, { passive: true });
  document.getElementById('main').innerHTML = '<div class="sk sk-hero"></div><div class="sk-row"><div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div></div><div class="sk sk-card"></div>';
})();

/* ---------------- init ---------------- */
(function init() {
  fetch(boot.restBase + '/state?ts=' + TS, { credentials: 'same-origin', headers: { 'X-WP-Nonce': boot.nonce } })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (j && j.state && !dirty && !timer && !inflight) {
        S = j.state.blocks || {};
        Object.keys((boot.state && boot.state.blocks) || {}).forEach(function (k) { if (!(k in S)) { S[k] = boot.state.blocks[k]; } });
        HIST = Array.isArray(j.state.history) ? j.state.history : [];
        CMP = j.computed || {};
        DISP = j.display || {};
      }
      track('interactive_opened', {});
      renderAll();
    })
    .catch(function () { renderAll(); });
})();
})();
/* mobile nav drawer */
(function () {
  function closeNav() { var sb = document.querySelector('.sidebar'); if (sb) { sb.classList.remove('open'); } var sc = document.getElementById('navScrim'); if (sc) { sc.classList.remove('open'); } }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) { return; }
    if (t.closest('#navToggle')) { var sb = document.querySelector('.sidebar'); if (sb) { sb.classList.add('open'); } var sc = document.getElementById('navScrim'); if (sc) { sc.classList.add('open'); } return; }
    if (t.closest('.nav-scrim') || t.closest('.nav-item')) { closeNav(); return; }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeNav(); } });
})();
