/* SWIIPT App v2 ΓÇö runtime part A: boot, state-over-REST, shell.
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
  if (v === null || v === undefined || v === '') { return 'ΓÇö'; }
  var n = Number(String(v).replace(/,/g, ''));
  if (isNaN(n)) { return 'ΓÇö'; }
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
function paintDisplay(display) {
  Object.keys(display || {}).forEach(function (path) {
    qsa('[data-swt-live="' + path.replace(/"/g, '\\"') + '"]').forEach(function (el) { el.innerHTML = display[path]; });
  });
}
function paintBlocks(html) {
  Object.keys(html || {}).forEach(function (id) {
    qsa('[data-swt-block-id="' + id + '"]').forEach(function (el) { el.outerHTML = html[id]; });
  });
}
function collect() {
  var blocks = {};
  function blk(id) { if (!blocks[id]) { blocks[id] = {}; } return blocks[id]; }
  qsa('[data-swt-block][data-swt-field]').forEach(function (el) {
    if (attr(el, 'data-swt-row') !== null) { return; }
    var id = attr(el, 'data-swt-block'), f = attr(el, 'data-swt-field'), b = blk(id);
    if (f === 'done') { b.done = b.done || {}; b.done[attr(el, 'data-swt-key') || ''] = el.checked ? 1 : 0; return; }
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
  setSave('SavingΓÇª', 'busy');
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
      if (j.display) { paintDisplay(j.display); }
      if (j.blocks_html) { paintBlocks(j.blocks_html); }
      var _gen = !!(XP.screens_html && (typeof XP.screens_html[activeView] === 'string'));
      if (_gen) { renderTopbar(); } else if (commit) { renderAll(); } else { renderTopbar(); }
    }
    setSave('All changes saved', 'ok');
    dirty = false;
    if (queued) { queued = false; var cq = queuedCommit; queuedCommit = false; push(cq); }
  }).catch(function () {
    inflight = false;
    setSave('Not saved ΓÇö check your connection', '');
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
/* Read a dotted path from the live state (blocks.*) or the computed map
   (computed.*). Product-agnostic: the recipe decides what the primary value is. */
function readPath(p) {
  if (!p) { return null; }
  var parts = String(p).split('.');
  var root = parts.shift();
  var cur = (root === 'computed') ? CMP : (root === 'blocks' ? S : null);
  if (cur === null) { return null; }
  for (var i = 0; i < parts.length; i++) {
    if (cur === null || typeof cur !== 'object') { return null; }
    cur = cur[parts[i]];
  }
  return (cur === undefined) ? null : cur;
}
/* The top-bar pill shows the recipe's primary result. `format:'money'` keeps
   the effective-figure behaviour; anything else prints the raw value + unit. */
function primaryDisplay() {
  var c = (XP.completion && typeof XP.completion === 'object') ? XP.completion : {};
  var cr = (XP.completion_resolved && typeof XP.completion_resolved === 'object') ? XP.completion_resolved : {};
  if ((c.format || '') === 'money') { var f = eff(); return (f.normal !== null) ? money(f.normal) : 'Not set yet'; }
  var path = cr.primary_path || c.primary_path || '';
  var val = path ? readPath(path) : null;
  if (val === null || val === undefined || val === '') { val = cr.primary_value; }
  if (val === null || val === undefined || val === '') { return 'Not set yet'; }
  var s = String(val);
  if (c.unit) { s = s + ' ' + c.unit; }
  return s;
}
function renderTopbar() {
  var f = eff();
  var page = null;
  navItems().forEach(function (n) { if (n.view === activeView) { page = n; } });
  var title = page ? String(page.label).replace(/^\d+ ┬╖ /, '') : 'Dashboard';
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('budgetNumberVal').textContent = primaryDisplay();
  document.getElementById('btnRescue').innerHTML = icon('siren', 15) + ' Rescue';
  document.getElementById('btnSettings').innerHTML = icon('settings', 17);
}
function renderMain() {
  var main = document.getElementById('main');
  var isGen = (XP.render === 'generic') || (XP.screens_html && (typeof XP.screens_html[activeView] === 'string'));
  if (!isGen) { main.innerHTML = ''; return; }
  if (XP.screens_html && (typeof XP.screens_html[activeView] === 'string')) { main.innerHTML = XP.screens_html[activeView]; }
  main.scrollTop = 0;
  var reqView = activeView;
  fetch(boot.restBase + '/screen?ts=' + TS + '&view=' + encodeURIComponent(reqView), { credentials: 'same-origin', headers: { 'X-WP-Nonce': boot.nonce } })
    .then(function (r) { return r.json(); }).then(function (j) {
      if (reqView === activeView && j && typeof j.html === 'string' && j.html) {
        main.innerHTML = j.html; main.scrollTop = 0;
        if (window.__app2Post) { window.__app2Post(); }
        if (document.dispatchEvent) { document.dispatchEvent(new Event('swt:screen')); }
      }
    }).catch(function () {});
}

function renderAll() {
  var shell = document.querySelector('.app-shell');
  if (shell) { shell.className = shell.className.replace(/\bxp-[a-z_]+/g, '').replace(/\s+/g, ' ').trim(); shell.classList.add('xp-' + String(XP.archetype || 'command_center').toLowerCase()); }
  var mainEl = document.getElementById('main');
  if (mainEl) {
    mainEl.setAttribute('data-xp-state', String(XP.experience_state || ''));
    /* Layout primitives belong to the server-rendered .xp-screen wrapper (generic
       render), never on #main. #main is the bounded flex scroll container
       (.app-shell{height:100vh;overflow:hidden} > .main{flex:1;overflow-y:auto}),
       so a flex/max-width layout class here compresses every product screen into
       clipped cards or a narrow column. Strip any strays; keep #main full-width. */
    mainEl.className = mainEl.className.replace(/\bxp-layout-[a-z-]+/g, '').replace(/\s+/g, ' ').trim();
  }  document.body.classList.remove('xp-motion-none', 'xp-motion-subtle', 'xp-motion-standard', 'xp-motion-expressive');
  document.body.classList.add('xp-motion-' + String(XP.motion || 'standard'));
  var vars = (XP.tokens && XP.tokens.vars) || {};
  Object.keys(vars).forEach(function (k) { document.documentElement.style.setProperty(k, vars[k]); });
  renderMark(); renderSidebar(); renderTopbar(); renderMain();
  if (document.dispatchEvent) { document.dispatchEvent(new Event('swt:screen')); }
}

/* SWIIPT App v2 ΓÇö part B: dashboard, quiz, chart. */
/* SWIIPT App v2 ΓÇö part C: decide, swap, audit, overlays, acts, fx, init.
   Registers render from recipe regColumns + live field specs; add-forms from
   live addFields; entries build from record_fields. No product field ids here. */
function renderRescueBody() {
  var r = R.rescue || {};
  return (r.steps || []).map(function (s) { return calloutHTML(s.tone || 'info', s.title || '', s.body || ''); }).join('')
    + '<div class="phrase-card">&ldquo;' + esc(r.phrase || '') + '&rdquo;</div>';
}
function renderSettingsBody() {
  var sc = R.scope || {}, dec = rowsOf('decisions').length, sw = rowsOf('swaps').length, au = rowsOf('audit').length;
  return calloutHTML('info', sc.whatTitle, sc.whatText)
    + calloutHTML('warning', sc.notTitle, sc.notText)
    + '<div class="card"><div class="card-title" style="font-size:13px;">' + esc(sc.scopeTitle) + '</div><div class="card-sub" style="margin-bottom:0;">' + esc(sc.scopeText) + '</div></div>'
    + calloutHTML('safety', sc.safetyTitle, sc.safetyText)
    + '<div class="card"><div class="card-title" style="font-size:13px;">' + esc(sc.dataTitle) + '</div>'
    + '<div class="card-sub">' + dec + ' decisions ┬╖ ' + sw + ' swaps ┬╖ ' + au + ' audit items</div>'
    + '<div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="export-data">' + icon('copy', 13) + ' ' + esc(sc.exportBtn) + '</button>'
    + '<button class="btn btn-danger btn-sm" data-act="reset-data">' + esc(sc.resetBtn) + '</button></div></div>'
    + '<div class="foot-note">' + esc(R.contentVersion || '') + ' ┬╖ ' + esc(R.productCode || R.productId || '') + '</div>';
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
  var act = el.getAttribute('data-act'), T = R.toasts || {};
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
    if (!confirm((R.scope && R.scope.resetAsk) || 'Reset this app? This deletes everything you have entered and cannot be undone.')) { return; }
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
    var c = e.target.closest && e.target.closest('.card,.stat-card,.hero-card,.swt-bl');
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
  window.SWIIPT_APP2_SAVE = save; window.SWIIPT_APP2_COLLECT = collect; window.SWIIPT_APP2_SETSAVE = setSave; window.SWIIPT_APP2_TRACK = track;
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
