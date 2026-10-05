/* SWIIPT App v2 - generic block interaction layer.
   Binds the server-rendered block vocabulary (data-swt-*) to the v2 state
   pipeline (window.SWIIPT_APP2_SAVE / _COLLECT in swt-app2.js). Product views
   are untouched; only generic composition screens emit these hooks. Re-inits on
   every screen change (swt:screen) so client-navigated screens stay live. */
(function () {
  'use strict';
  var boot = window.SWIIPT_APP2 || {};
  if (!boot.ts) { return; }

  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function attr(el, n) { return el ? el.getAttribute(n) : null; }
  function esc(s) { var d = document.createElement('div'); d.textContent = (s === null || s === undefined) ? '' : String(s); return d.innerHTML; }
  function getPath(o, p) { var k = String(p || '').split('.'); for (var i = 0; i < k.length; i++) { if (o === null || o === undefined) { return null; } o = o[k[i]]; } return o; }
  function collect() { return window.SWIIPT_APP2_COLLECT ? window.SWIIPT_APP2_COLLECT() : { blocks: {} }; }
  function save(now, commit) { if (window.SWIIPT_APP2_SAVE) { window.SWIIPT_APP2_SAVE(now, commit); } }
  function track(name, payload) { if (window.SWIIPT_APP2_TRACK) { window.SWIIPT_APP2_TRACK(name, payload); } }

  function refreshCap(host) {
    if (!host) { return; }
    var fld = attr(host, 'data-swt-cap-field');
    if (!fld) { return; }
    var eq = attr(host, 'data-swt-cap-eq') || '';
    var max = parseInt(attr(host, 'data-swt-cap-max') || '0', 10);
    var n = 0;
    qsa('.swt-col-item, .swt-rep-row', host).forEach(function (r) {
      var el = r.querySelector('[data-swt-field="' + fld + '"]');
      if (el && String(el.value) === eq) { n++; }
    });
    var line = host.querySelector('[data-swt-cap-line]');
    if (line) {
      var b = line.querySelector('b'); if (b) { b.textContent = String(n); }
      var over = line.querySelector('.swt-over');
      if (max && n > max && !over) {
        var sp = document.createElement('span'); sp.className = 'swt-over';
        sp.textContent = ' more than the mechanism allows. Keep or reject one before adding another.';
        line.appendChild(sp);
      } else if (over && !(max && n > max)) { over.remove(); }
    }
    var add = host.querySelector('[data-swt-row-add]');
    if (add) { add.disabled = !!(max && n >= max); }
  }

  /* ---------- repeaters / collections / copy / save-now / open ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var add = t.closest ? t.closest('[data-swt-row-add]') : null;
    if (add) {
      ev.preventDefault();
      var host = add.closest('[data-swt-rep],[data-swt-col]');
      if (!host) { return; }
      var isRep = !!attr(host, 'data-swt-rep');
      var id = attr(host, isRep ? 'data-swt-rep' : 'data-swt-col');
      var box = host.querySelector(isRep ? '.swt-rep-rows' : '.swt-col-list');
      var tpl = host.querySelector(isRep ? '[data-swt-rep-tpl="' + id + '"]' : '[data-swt-col-tpl="' + id + '"]');
      if (!box || !tpl) { return; }
      var empty = box.querySelector('.swt-rep-empty'); if (empty) { empty.remove(); }
      var n = box.querySelectorAll(isRep ? '.swt-rep-row' : '.swt-col-item').length;
      var max = parseInt(attr(host, 'data-swt-max') || '0', 10);
      if (max && n >= max) { return; }
      var tplHtml = (tpl.content && tpl.content.firstElementChild) ? tpl.content.firstElementChild.outerHTML : tpl.innerHTML;
      var html = tplHtml.replace(/__ROW__/g, String(n));
      var hbody = document.createElement('tbody');
      hbody.innerHTML = html.trim();
      box.appendChild(hbody.firstElementChild);
      if (box.lastChild) { box.lastChild.classList.add('open'); }
      var addRow = host.querySelector('[data-swt-addrow]');
      if (addRow) {
        var madeRow = box.lastChild;
        qsa('[data-swt-field]', addRow).forEach(function (src) {
          var f = attr(src, 'data-swt-field');
          var dst = madeRow.querySelector('[data-swt-field="' + f + '"]');
          if (dst) { if (src.type === 'checkbox') { dst.checked = src.checked; } else { dst.value = src.value; } }
          if (src.type === 'checkbox') { src.checked = false; } else { src.value = ''; }
          if (src.tagName === 'SELECT') { src.selectedIndex = 0; }
        });
      }
      if (madeRow) { qsa('[data-swt-field]', madeRow).forEach(syncCell); }
      track('tracker_entry_created', { collection: id });
      refreshCap(host);
      save(true);
      return;
    }
    var sn = t.closest ? t.closest('[data-swt-save-now]') : null;
    if (sn) { ev.preventDefault(); save(true, true); return; }
    var rowOpen = t.closest ? t.closest('.swt-rep-row,.swt-col-item') : null;
    if (rowOpen && !(t.closest && t.closest('input,select,textarea,button,label,a'))) { rowOpen.classList.toggle('open'); return; }
    var rm = t.closest ? t.closest('[data-swt-row-remove]') : null;
    if (rm) {
      ev.preventDefault();
      var item = rm.closest('[data-swt-row]');
      var host2 = rm.closest('[data-swt-rep],[data-swt-col]');
      if (item) { item.remove(); }
      if (host2) {
        var btn = host2.querySelector('[data-swt-row-add]');
        var mx = parseInt(attr(host2, 'data-swt-max') || '0', 10);
        var cnt = host2.querySelectorAll('.swt-rep-row,.swt-col-item').length;
        if (btn && mx) { btn.disabled = cnt >= mx; }
      }
      refreshCap(host2); save(true);
      return;
    }
    var copy = t.closest ? t.closest('[data-swt-copy]') : null;
    if (copy) {
      ev.preventDefault();
      var txt = attr(copy, 'data-swt-copy') || '';
      if (navigator.clipboard && txt) {
        navigator.clipboard.writeText(txt).then(function () { var old = copy.textContent; copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = old; }, 1400); });
      }
      return;
    }
  });

  /* ---------- wizard ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var go = t.closest ? t.closest('[data-swt-wiz-go]') : null;
    var nxt = t.closest ? t.closest('[data-swt-wiz-next]') : null;
    var bck = t.closest ? t.closest('[data-swt-wiz-back]') : null;
    if (!go && !nxt && !bck) { return; }
    ev.preventDefault();
    var wiz = (go || nxt || bck).closest('[data-swt-wiz]');
    if (!wiz) { return; }
    var bodies = qsa('[data-swt-wiz-body]', wiz);
    var total = bodies.length;
    var cur = parseInt(attr(wiz, 'data-swt-wiz-step') || '0', 10);
    if (go) { cur = parseInt(attr(go, 'data-swt-wiz-go'), 10); }
    else if (nxt) { cur = Math.min(total - 1, cur + 1); }
    else { cur = Math.max(0, cur - 1); }
    wiz.setAttribute('data-swt-wiz-step', String(cur));
    bodies.forEach(function (b, i) { b.hidden = i !== cur; });
    qsa('.swt-wiz-dot', wiz).forEach(function (d, i) { d.classList.toggle('on', i === cur); d.classList.toggle('done', i < cur); });
    var back = wiz.querySelector('[data-swt-wiz-back]'); if (back) { back.hidden = cur === 0; }
    var hid = wiz.querySelector('input[data-swt-field="step"]'); if (hid) { hid.value = String(cur); }
    var main = document.getElementById('main'); if (main) { main.scrollTop = 0; }
    save();
  });

  /* ---------- decision tree (graph) ---------- */
  function dtGraph(dt) {
    var map = {}; try { map = JSON.parse(attr(dt, 'data-swt-dt-map') || '{}'); } catch (e) { map = {}; }
    var start = attr(dt, 'data-swt-dt-start') || '';
    var answers = [];
    var body = dt.querySelector('.swt-dt-body');
    var trail = dt.querySelector('.swt-dt-trail');
    var outBox = dt.querySelector('.swt-dt-outcomes');
    var back = dt.querySelector('[data-swt-dt-back]');
    if (!body) { return; }
    function finish(outcomeId) {
      qsa('.swt-outcome', dt).forEach(function (o) { o.hidden = attr(o, 'data-outcome') !== outcomeId; });
      body.innerHTML = '';
      if (outBox) { outBox.hidden = false; }
      var a = dt.querySelector('input[data-swt-field="answers"]'); if (a) { a.value = JSON.stringify(answers); }
      var o = dt.querySelector('input[data-swt-field="outcome"]'); if (o) { o.value = outcomeId || ''; }
      track('decision_completed', { outcome: outcomeId });
      recordOutcome(dt, outcomeId);
      save();
    }
    function node(nid) {
      if (outBox) { outBox.hidden = true; }
      var n = map[nid]; if (!n) { return; }
      var html = '<p class="swt-dt-q">' + esc(n.q) + '</p>' + (n.help ? '<p class="swt-muted sm">' + esc(n.help) + '</p>' : '');
      html += '<div class="swt-dt-opts">';
      (n.options || []).forEach(function (op, i) { html += '<button type="button" class="swt-dt-opt" data-swt-opt="' + i + '">' + esc(op.label) + '</button>'; });
      html += '</div>';
      body.innerHTML = html;
      if (trail) { trail.innerHTML = answers.map(function (a) { return '<span>' + esc(a) + '</span>'; }).join(''); }
      qsa('[data-swt-opt]', body).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var op = (n.options || [])[parseInt(attr(btn, 'data-swt-opt'), 10)] || {};
          answers.push(op.label || '');
          if (op.next && map[op.next]) { node(op.next); } else { finish(op.outcome || op.next || ''); }
        });
      });
      if (back) { back.hidden = answers.length === 0; }
    }
    dt.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-swt-dt-back],[data-swt-dt-restart]') : null;
      if (!b) { return; }
      ev.preventDefault();
      answers = [];
      dt.removeAttribute('data-swt-recorded');
      qsa('.swt-outcome', dt).forEach(function (o) { o.hidden = true; });
      if (outBox) { outBox.hidden = true; }
      node(start);
    });
    track('decision_started', {});
    node(start);
  }
  function recordOutcome(dt, outcomeId) {
    var colId = attr(dt, 'data-swt-dt-record');
    if (!colId || attr(dt, 'data-swt-recorded') === '1') { return; }
    var map = {}; try { map = JSON.parse(attr(dt, 'data-swt-dt-record-map') || '{}'); } catch (e) { return; }
    var host = document.querySelector('[data-swt-col="' + colId + '"]');
    var box = host ? host.querySelector('.swt-col-list') : null;
    var tpl = host ? host.querySelector('[data-swt-col-tpl="' + colId + '"]') : null;
    if (!host || !box || !tpl) { return; }
    var state = collect();
    var today = new Date().toISOString().slice(0, 10);
    var empty = box.querySelector('.swt-rep-empty'); if (empty) { empty.remove(); }
    var n = box.querySelectorAll('.swt-col-item').length;
    /* A <tr> cannot be parsed inside a <div> (it is dropped by the HTML parser),
       so build the row through a <tbody> and take its first element child. */
    var holder = document.createElement('tbody');
    holder.innerHTML = tpl.innerHTML.replace(/__ROW__/g, String(n)).trim();
    var row = holder.firstElementChild;
    if (!row) { return; }
    Object.keys(map).forEach(function (field) {
      var src = map[field];
      var val = src === '@outcome' ? outcomeId : (src === '@date' ? today : getPath(state, src));
      var el = row.querySelector('[data-swt-field="' + field + '"]');
      if (el) { el.value = (val === null || val === undefined) ? '' : String(val); }
      if (field === '_verdict') { var pill = row.querySelector('.swt-pill'); if (pill) { pill.textContent = outcomeId; } }
    });
    box.appendChild(row);
    var head = row.querySelector('[data-swt-row-date]');
    var dsel = row.querySelector('input[type="date"]');
    if (head) { head.textContent = dsel ? dsel.value : today; }
    var dateInput = row.querySelector('input[type="date"][data-swt-field="_date"]'); if (dateInput && !dateInput.value) { dateInput.value = today; if (head) { head.textContent = today; } }
    dt.setAttribute('data-swt-recorded', '1');
    save(true);
  }

  /* ---------- decision tree (form layout) ---------- */
  function dtForm(dt) {
    var map = {}; try { map = JSON.parse(attr(dt, 'data-swt-dt-map') || '{}'); } catch (e) { map = {}; }
    var outcomes = {}; try { outcomes = JSON.parse(attr(dt, 'data-swt-dt-outcomes') || '{}'); } catch (e) { outcomes = {}; }
    var start = attr(dt, 'data-swt-dt-start') || '';
    var ansInput = dt.querySelector('input[data-swt-field="answers"]');
    var outInput = dt.querySelector('input[data-swt-field="outcome"]');
    var reveal = dt.querySelector('.verdict-reveal');
    var saveBtn = dt.querySelector('[data-swt-dt-form-save]');
    var answers = {};
    try { var a0 = ansInput ? JSON.parse(ansInput.value || '{}') : {}; if (a0 && typeof a0 === 'object' && !Array.isArray(a0)) { answers = a0; } } catch (e) { answers = {}; }
    var verdict = '';
    function walk() {
      var nid = start, guard = 0;
      while (nid && map[nid] && guard < 50) {
        guard++;
        var n = map[nid];
        if (!n.options || !n.options.length) { return ''; }
        var idx = answers[nid];
        if (idx === undefined || idx === null || !n.options[idx]) { return ''; }
        var op = n.options[idx];
        if (op.outcome) { return op.outcome; }
        if (op.next && map[op.next]) { nid = op.next; continue; }
        return '';
      }
      return '';
    }
    function paint() {
      verdict = walk();
      if (reveal) {
        if (verdict && outcomes[verdict]) {
          var o = outcomes[verdict];
          var badge = reveal.querySelector('.verdict-badge');
          if (badge) { badge.textContent = o.label || verdict; badge.className = 'verdict-badge badge-' + verdict; }
          var tx = reveal.querySelector('.vr-text'); if (tx) { tx.textContent = o.body || ''; }
          reveal.hidden = false;
        } else { reveal.hidden = true; }
      }
      if (saveBtn) { saveBtn.disabled = !verdict; }
      if (ansInput) { ansInput.value = JSON.stringify(answers); }
      if (outInput) { outInput.value = verdict || ''; }
    }
    qsa('[data-swt-dt-opt]', dt).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = attr(btn, 'data-swt-dt-opt') || '';
        var sep = key.lastIndexOf(':'); if (sep < 0) { return; }
        var nid = key.slice(0, sep); var idx = parseInt(key.slice(sep + 1), 10);
        answers[nid] = idx;
        qsa('[data-swt-dt-q="' + nid + '"] [data-swt-dt-opt]', dt).forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        dt.removeAttribute('data-swt-recorded');
        paint();
        save();
      });
    });
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (!verdict) { return; }
        track('decision_completed', { outcome: verdict });
        recordOutcome(dt, verdict);
        if (!dt.closest('[data-swt-wiz]')) { answers = {}; qsa('[data-swt-dt-opt]', dt).forEach(function (b) { b.classList.remove('on'); }); dt.removeAttribute('data-swt-recorded'); paint(); }
        var wiz = dt.closest('[data-swt-wiz]');
        if (wiz) {
          var bodies = qsa('[data-swt-wiz-body]', wiz);
          var cur = parseInt(attr(wiz, 'data-swt-wiz-step') || '0', 10);
          var nxt = Math.min(bodies.length - 1, cur + 1);
          wiz.setAttribute('data-swt-wiz-step', String(nxt));
          bodies.forEach(function (b, i) { b.hidden = i !== nxt; });
          var hid = wiz.querySelector('input[data-swt-field="step"]'); if (hid) { hid.value = String(nxt); }
        }
        save(true, true);
      });
    }
    track('decision_started', {});
    paint();
  }

  /* ---------- register verdict actions (pill + keep/reject) ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-swt-verdict-set]') : null;
    if (!b) { return; }
    ev.preventDefault();
    var row = b.closest('.swt-col-item'); if (!row) { return; }
    var hid = row.querySelector('input[data-swt-field="_verdict"]');
    var pill = row.querySelector('.swt-vcell .status-pill');
    var nv = attr(b, 'data-swt-verdict-set') || '';
    if (hid) { hid.value = nv; }
    if (pill) { pill.textContent = nv; pill.className = 'status-pill status-' + nv; }
    var host = b.closest('[data-swt-col]'); if (host) { refreshCap(host); }
    save(true, true);
  });

  /* ---------- rescue: set-to-today ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-swt-today]') : null;
    if (!t) { return; }
    ev.preventDefault();
    var parts = String(attr(t, 'data-swt-today') || '').split('.');
    var el = document.querySelector('[data-swt-block="' + parts[0] + '"][data-swt-field="' + (parts[1] || 'date') + '"]');
    if (!el) { return; }
    el.value = new Date().toISOString().slice(0, 10);
    save(true);
  });

  /* ---------- add-row keyboard ---------- */
  document.addEventListener('keydown', function (ev) {
    var el = ev.target;
    if (!el || !el.closest) { return; }
    var zone = el.closest('[data-swt-addrow]');
    if (!zone) { return; }
    if (ev.key === 'Enter' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT' && el.tagName !== 'BUTTON') {
      ev.preventDefault();
      var add = zone.querySelector('[data-swt-row-add]'); if (add && !add.disabled) { add.click(); }
    } else if (ev.key === 'Escape') {
      qsa('input,textarea,select', zone).forEach(function (f) { if (f.type === 'checkbox') { f.checked = false; } else if (f.tagName === 'SELECT') { f.selectedIndex = 0; } else { f.value = ''; } });
    }
  });

  /* ---------- autosave on change / input ---------- */
  /* keep a register/repeater row's read-only cell in step with its input (live reflect) */
  function syncCell(el) {
    if (!el || !el.closest) { return; }
    var cell = el.closest('.swt-cell');
    if (!cell) { return; }
    var v = cell.querySelector('.swt-cellv');
    if (!v) { return; }
    var val = (el.tagName === 'SELECT' && el.selectedIndex >= 0) ? el.options[el.selectedIndex].text : el.value;
    v.textContent = (val === '' || val === null || val === undefined) ? '\u2014' : val;
  }

  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (!el.getAttribute || !el.getAttribute('data-swt-block')) { return; }
    syncCell(el);
    if (el.type === 'date') {
      var host = el.closest('[data-swt-col]');
      if (host) { var head = el.closest('[data-swt-row]').querySelector('[data-swt-row-date]'); if (head) { head.textContent = el.value; } }
    }
    save();
  });
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (!el.getAttribute || !el.getAttribute('data-swt-block')) { return; }
    syncCell(el);
    if (el.type === 'date' || el.type === 'checkbox' || el.tagName === 'SELECT') { return; }
    if (el.getAttribute('data-swt-row') !== null) { return; }
    save();
  });

  /* ---------- screen init / re-init (idempotent) ---------- */
  function initScreens() {
    qsa('[data-swt-dt]:not([data-swt-dt-layout="form"])').forEach(function (dt) { if (attr(dt, 'data-swt-inited')) { return; } dt.setAttribute('data-swt-inited', '1'); dtGraph(dt); });
    qsa('[data-swt-dt-layout="form"]').forEach(function (dt) { if (attr(dt, 'data-swt-inited')) { return; } dt.setAttribute('data-swt-inited', '1'); dtForm(dt); });
    qsa('[data-swt-col]').forEach(refreshCap);
  }
  window.SWT_APP2_BLOCKS_INIT = initScreens;
  document.addEventListener('swt:screen', initScreens);
  function init() { initScreens(); track('interactive_opened', {}); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
