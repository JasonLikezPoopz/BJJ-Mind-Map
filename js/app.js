import * as S from './store.js';
import { TYPES, TYPE_KEYS, isPlace } from './store.js';
import { GraphView } from './graph.js';
import { SOURCES, detectSource, parseTime, formatTime, youtubeInfo, clipOpenUrl, normalizeUrl } from './clips.js';

S.load();

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = type => TYPES[type]?.color || '#999';
const dot = type => `<span class="dot" style="--c:${color(type)}"></span>`;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const PREFS_KEY = 'bjj-mind-map:ui';
const ui = Object.assign({ view: 'library', libMode: 'type', libFilter: 'all', mapMode: 'web', mapSelected: null, journalKind: 'lesson' },
  (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } })());
ui.libQuery = '';
ui.journalQuery = '';
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(ui)); } catch {} };

const I = {
  library: '<svg viewBox="0 0 24 24"><path d="M4 5h4v14H4zM10 5h4v14h-4zM16.5 5.5l3.8 1-3.4 13-3.8-1z"/></svg>',
  map: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.6"/><circle cx="4.5" cy="5" r="2"/><circle cx="19.5" cy="5" r="2"/><circle cx="4.5" cy="19" r="2"/><circle cx="19.5" cy="19" r="2"/><path d="M6 6.3l4.2 4M18 6.3l-4.2 4M6 17.7l4.2-4M18 17.7l-4.2-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  courses: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M10 8.5v5l4.3-2.5z" fill="var(--tab-bg)"/><rect x="6" y="19" width="12" height="1.8" rx=".9"/></svg>',
  journal: '<svg viewBox="0 0 24 24"><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8.5 7.5h7M8.5 11h7M8.5 14.5h4.5" stroke="var(--tab-bg)" stroke-width="1.6" stroke-linecap="round"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  starOn: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z" fill="#ffcc4d" stroke="#ffcc4d" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  chev: '<svg viewBox="0 0 24 24" class="chev"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  fit: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M4 17h3.5c2 0 3-1 4.5-4.5S14.5 7 16.5 7H20M17 4l3 3-3 3M4 7h3.5c1.2 0 2 .4 2.8 1.3M20 17h-3.5c-1.2 0-2-.4-2.8-1.3M17 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- sheets (iOS-style bottom sheets, stackable) ----------
const stack = [];
function openSheet(render, { onClose, className = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet ${className}" role="dialog" aria-modal="true"><div class="sheet-grab"><span></span></div><div class="sheet-body"></div></div>`;
  $('#sheets').appendChild(wrap);
  const panel = $('.sheet', wrap);
  const sheet = {
    wrap, body: $('.sheet-body', wrap), state: {},
    refresh() { const st = this.body.scrollTop; render(this.body, this); this.body.scrollTop = st; },
    close() { closeSheet(this); },
    onClose,
  };
  stack.push(sheet);
  $('#backupBar').hidden = true;
  sheet.refresh();
  $('.sheet-backdrop', wrap).addEventListener('click', () => sheet.close());
  // swipe down on the grabber to dismiss
  const grab = $('.sheet-grab', wrap);
  let y0 = null, dy = 0;
  grab.addEventListener('pointerdown', e => { y0 = e.clientY; dy = 0; grab.setPointerCapture(e.pointerId); panel.style.transition = 'none'; });
  grab.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = `translateY(${dy}px)`; });
  const up = () => { if (y0 == null) return; y0 = null; panel.style.transition = ''; panel.style.transform = ''; if (dy > 80) sheet.close(); };
  grab.addEventListener('pointerup', up); grab.addEventListener('pointercancel', up);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return sheet;
}
function closeSheet(sheet) {
  const i = stack.indexOf(sheet);
  if (i < 0) return;
  stack.splice(i, 1);
  sheet.wrap.classList.remove('open');
  setTimeout(() => sheet.wrap.remove(), 280);
  sheet.onClose?.();
  stack[stack.length - 1]?.refresh();
  if (!stack.length) updateBackupBar();
}
function closeAllSheets() { [...stack].reverse().forEach(s => closeSheet(s)); }

// ---------- tabs ----------
const VIEW_TITLES = { library: 'Library', map: 'Map', journal: 'Journal', courses: 'Courses', more: 'More' };
function setView(v) {
  ui.view = v; savePrefs();
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
  $('#title').textContent = VIEW_TITLES[v];
  const actions = $('#topActions');
  actions.innerHTML = '';
  if (v === 'library' || v === 'map') actions.innerHTML = `<button class="icon-btn accent" id="newMove" aria-label="New move">${I.plus}</button>`;
  if (v === 'courses') actions.innerHTML = `<button class="icon-btn accent" id="newCourse" aria-label="New course">${I.plus}</button>`;
  if (v === 'journal') actions.innerHTML = `<button class="icon-btn accent" id="newEntry" aria-label="New journal entry">${I.plus}</button>`;
  $('#newEntry')?.addEventListener('click', () => newEntry(ui.journalKind));
  $('#newMove')?.addEventListener('click', () => editNode(null, n => { if (ui.view === 'map') { mapSelect(n.id, true); } openNode(n.id); }));
  $('#newCourse')?.addEventListener('click', () => editCourse(null));
  if (typeof updateBackupBar === 'function' && backupReady) updateBackupBar();
  render();
}
function render() {
  if (ui.view === 'library') renderLibrary();
  if (ui.view === 'map') renderMap();
  if (ui.view === 'courses') renderCourses();
  if (ui.view === 'journal') renderJournal();
  if (ui.view === 'more') renderMore();
}
S.onChange(() => { backup.markChanged(); });
S.onChange(() => {
  if (ui.view === 'library') renderLibList();
  else if (ui.view === 'courses') renderCourses();
  else if (ui.view === 'journal') renderJournalList();
  else if (ui.view === 'more') renderMore();
  else if (ui.view === 'map' && graph) { graph.rebuild({ animate: true }); updateMapCard(); }
});

// ---------- Library ----------
function matches(n, q) {
  if (!q) return true;
  const hay = [n.name, n.notes, n.tags.join(' '), ...n.clips.map(c => `${c.title || ''} ${c.note || ''}`)].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
}

function renderLibrary() {
  const v = $('#view-library');
  if (!v.dataset.ready) {
    v.dataset.ready = '1';
    v.innerHTML = `
      <div class="lib-controls">
        <label class="search">${I.search}<input type="search" id="libSearch" placeholder="Search moves, notes, clips" autocomplete="off"></label>
        <div class="seg" id="libMode"><button data-mode="type">By type</button><button data-mode="position">By position</button></div>
        <div class="chips" id="libChips">
          <button data-f="all">All</button><button data-f="fav">★ Favorites</button>
          ${TYPE_KEYS.map(k => `<button data-f="${k}" style="--c:${TYPES[k].color}">${TYPES[k].plural}</button>`).join('')}
        </div>
      </div>
      <div id="libList" class="pad-bottom"></div>`;
    $('#libSearch').addEventListener('input', e => { ui.libQuery = e.target.value; renderLibList(); });
    $('#libMode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ui.libMode = b.dataset.mode; savePrefs(); renderLibrary(); } });
    $('#libChips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ui.libFilter = b.dataset.f; savePrefs(); renderLibrary(); } });
    $('#libList').addEventListener('click', e => {
      const add = e.target.closest('[data-add-from]');
      if (add) { addConnection(add.dataset.addFrom, 'out'); return; }
      const b = e.target.closest('[data-id]');
      if (b) openNode(b.dataset.id);
      if (e.target.closest('[data-empty-add]')) editNode(null, n => openNode(n.id));
    });
  }
  $$('#libMode button').forEach(b => b.classList.toggle('active', b.dataset.mode === ui.libMode));
  $$('#libChips button').forEach(b => b.classList.toggle('active', b.dataset.f === ui.libFilter));
  $('#libChips').hidden = ui.libMode !== 'type';
  renderLibList();
}

function nodeRow(n) {
  const ins = S.incoming(n.id).length, outs = S.outgoing(n.id).length;
  const bits = [`${ins} in`, `${outs} out`];
  if (n.clips.length) bits.push(`▶ ${n.clips.length}`);
  if (n.notes.trim()) bits.push('notes');
  return `<button class="row" data-id="${n.id}">${dot(n.type)}
    <span class="row-main"><span class="row-title">${esc(n.name)}${n.favorite ? ' <span class="fav">★</span>' : ''}</span>
    <span class="row-sub">${bits.join(' · ')}</span></span>${I.chev}</button>`;
}

function renderLibList() {
  const list = $('#libList');
  if (!list) return;
  const q = ui.libQuery.trim();
  const nodes = S.nodesSorted();
  if (!nodes.length) {
    list.innerHTML = `<div class="empty"><p>Your library is empty.</p><button class="btn primary" data-empty-add>Add your first move</button></div>`;
    return;
  }
  let html = '';
  if (ui.libMode === 'type') {
    for (const k of TYPE_KEYS) {
      if (ui.libFilter !== 'all' && ui.libFilter !== 'fav' && ui.libFilter !== k) continue;
      const items = nodes.filter(n => n.type === k && matches(n, q) && (ui.libFilter !== 'fav' || n.favorite));
      if (!items.length) continue;
      html += `<h4 class="group-head">${dot(k)}${TYPES[k].plural}<span class="count">${items.length}</span></h4>
        <div class="list">${items.map(nodeRow).join('')}</div>`;
    }
  } else {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const order = ['submission', 'sweep', 'pass', 'escape', 'takedown', 'transition', 'guard', 'position'];
    const label = k => (k === 'position' ? 'Leads to' : k === 'guard' ? 'Guards' : TYPES[k].plural);
    // Guards first, then other positions
    const positions = nodes.filter(n => isPlace(n.type)).sort((a, b) => (a.type === 'guard' ? 0 : 1) - (b.type === 'guard' ? 0 : 1) || a.name.localeCompare(b.name));
    for (const p of positions) {
      const outs = S.outgoing(p.id).map(e => ({ e, n: byId.get(e.to) }));
      if (q && !matches(p, q) && !outs.some(o => matches(o.n, q))) continue;
      const groups = order.map(k => {
        const items = outs.filter(o => o.n.type === k);
        if (!items.length) return '';
        return `<div class="pos-group"><div class="pos-group-label" style="--c:${color(k)}">${label(k)}</div><div class="chip-wrap">
          ${items.map(o => `<button class="mchip ${q && matches(o.n, q) ? 'hit' : ''}" data-id="${o.n.id}" style="--c:${color(o.n.type)}">${esc(o.n.name)}${o.e.label ? `<small>${esc(o.e.label)}</small>` : ''}</button>`).join('')}
        </div></div>`;
      }).join('');
      html += `<div class="pos-card">
        <button class="pos-head" data-id="${p.id}">${dot(p.type)}<span class="row-main"><span class="row-title">${esc(p.name)}${p.favorite ? ' <span class="fav">★</span>' : ''}</span>
        <span class="row-sub">${outs.length} option${outs.length === 1 ? '' : 's'}${p.clips.length ? ` · ▶ ${p.clips.length}` : ''}</span></span>${I.chev}</button>
        ${groups || '<p class="empty-small">No options yet.</p>'}
        <button class="link-btn" data-add-from="${p.id}">+ Add option</button>
      </div>`;
    }
    const orphans = nodes.filter(n => !isPlace(n.type) && matches(n, q) && !S.incoming(n.id).some(e => isPlace(byId.get(e.from)?.type)));
    if (orphans.length) {
      html += `<h4 class="group-head">Not reached from a position<span class="count">${orphans.length}</span></h4>
        <div class="chip-wrap loose">${orphans.map(n => `<button class="mchip" data-id="${n.id}" style="--c:${color(n.type)}">${esc(n.name)}</button>`).join('')}</div>`;
    }
  }
  list.innerHTML = html || `<div class="empty"><p>No matches${q ? ` for “${esc(q)}”` : ''}.</p></div>`;
}

// ---------- Move detail ----------
function clipHTML(c) {
  const src = SOURCES[c.source] || SOURCES.link;
  const yt = c.source === 'youtube' ? youtubeInfo(c.url) : null;
  let host = '';
  try { host = new URL(c.url).hostname.replace(/^www\./, ''); } catch {}
  const sub = [c.start != null ? `@ ${formatTime(c.start)}` : '', c.note ? esc(c.note) : ''].filter(Boolean).join(' · ');
  return `<div class="clip">
    ${yt ? `<div class="yt" data-act="play" data-clip="${c.id}" style="background-image:url('https://i.ytimg.com/vi/${encodeURIComponent(yt.id)}/hqdefault.jpg')"><span class="play">▶</span></div>` : ''}
    <div class="clip-body">
      <div class="clip-meta"><span class="src" style="--c:${src.color}">${src.label}</span>${sub ? `<span class="clip-sub">${sub}</span>` : ''}</div>
      <div class="clip-title">${esc(c.title || host || 'Clip')}</div>
      <div class="clip-actions">
        <a class="btn sm" href="${esc(clipOpenUrl(c))}" target="_blank" rel="noopener">${I.ext}Open${c.start != null ? ` at ${formatTime(c.start)}` : ''}</a>
        <button class="icon-btn sm" data-act="del-clip" data-clip="${c.id}" aria-label="Delete clip">${I.trash}</button>
      </div>
    </div>
  </div>`;
}

function flowSection(dir, edges) {
  const isIn = dir === 'in';
  const rows = edges.map(e => {
    const other = S.node(isIn ? e.from : e.to);
    return `<div class="flow-row">
      <button class="flow-main" data-act="goto" data-id="${other.id}">${dot(other.type)}
        <span class="row-main"><span class="row-title">${esc(other.name)}</span>${e.label ? `<span class="row-sub italic"><b class="why-tag">Why</b> ${esc(e.label)}</span>` : ''}${e.how ? `<span class="row-sub how-line"><b class="how-tag">How</b> ${esc(e.how)}</span>` : ''}</span>
        <span class="type-mini" style="--c:${color(other.type)}">${TYPES[other.type].label}</span></button>
      <button class="icon-btn sm" data-act="edge" data-edge="${e.id}" aria-label="Connection options">${I.dots}</button>
    </div>`;
  }).join('');
  return `<section class="sec flow-sec ${dir}">
    <div class="sec-head"><h3><span class="arrow">${isIn ? '↘' : '↗'}</span>${isIn ? 'Flows in from' : 'Flows out to'} <span class="count">${edges.length}</span></h3>
      <button class="link-btn" data-act="add-${dir}">+ Add</button></div>
    <div class="list">${rows || `<p class="empty-small">${isIn ? 'Where do you get here from?' : 'What can you do from here?'}</p>`}</div>
  </section>`;
}

function openNode(startId) {
  openSheet((body, sheet) => {
    const st = sheet.state;
    st.history ??= [];
    st.id ??= startId;
    const n = S.node(st.id);
    if (!n) { sheet.close(); return; }
    const t = TYPES[n.type];
    const chapters = S.chaptersForNode(n.id);
    const journalLinks = S.journalForNode(n.id);
    body.innerHTML = `
      <div class="sheet-head">
        ${st.history.length ? `<button class="icon-btn" data-act="back" aria-label="Back">${I.back}</button>` : ''}
        <span class="badge" style="--c:${t.color}">${t.label}</span>
        <span class="spacer"></span>
        <button class="icon-btn" data-act="fav" aria-label="Favorite">${n.favorite ? I.starOn : I.star}</button>
        <button class="icon-btn" data-act="edit" aria-label="Edit">${I.edit}</button>
        <button class="icon-btn" data-act="close" aria-label="Close">${I.close}</button>
      </div>
      <h2 class="sheet-title">${esc(n.name)}</h2>
      ${n.tags.length ? `<div class="tags">${n.tags.map(x => `<span class="tag">#${esc(x)}</span>`).join('')}</div>` : ''}
      <div class="btn-row">
        <button class="btn nowrap" data-act="web">${I.map}Web</button>
        <button class="btn nowrap" data-act="flow">Flow</button>
        <button class="btn nowrap" data-act="max">Flow Max</button>
      </div>
      ${flowSection('in', S.incoming(n.id))}
      ${flowSection('out', S.outgoing(n.id))}
      <section class="sec">
        <div class="sec-head"><h3>Notes</h3><span class="saved">Saved</span></div>
        <textarea class="notes" rows="4" placeholder="Key details, grips, common mistakes, what to drill…">${esc(n.notes)}</textarea>
      </section>
      <section class="sec">
        <div class="sec-head"><h3>Clips <span class="count">${n.clips.length}</span></h3><button class="link-btn" data-act="add-clip">+ Add clip</button></div>
        <div class="clips">${n.clips.map(clipHTML).join('') || '<p class="empty-small">Save timestamps from YouTube, BJJ Fanatics, Submeta or any link.</p>'}</div>
      </section>
      ${chapters.length ? `<section class="sec"><div class="sec-head"><h3>In your courses</h3></div><div class="list">
        ${chapters.map(({ course, chapter }) => `<button class="row" data-act="course" data-course="${course.id}"><span class="row-main"><span class="row-title">${esc(chapter.title)}</span><span class="row-sub">${esc(course.title)}${chapter.time ? ` · @ ${esc(chapter.time)}` : ''}</span></span>${I.chev}</button>`).join('')}
      </div></section>` : ''}
      ${journalLinks.length ? `<section class="sec"><div class="sec-head"><h3>In your journal <span class="count">${journalLinks.length}</span></h3></div><div class="list">
        ${journalLinks.map(j => `<button class="row" data-act="entry" data-entry="${j.id}"><span class="badge" style="--c:${JKIND[j.kind].color}">${JKIND[j.kind].short}</span><span class="row-main"><span class="row-title">${esc(entryTitle(j))}</span><span class="row-sub">${fmtDate(j.date)}</span></span>${I.chev}</button>`).join('')}
      </div></section>` : ''}
      <button class="btn danger wide" data-act="delete">${I.trash}Delete move</button>`;

    const notes = $('.notes', body), saved = $('.saved', body);
    const saveNotes = debounce(v => { S.updateNode(n.id, { notes: v }); saved.classList.add('show'); setTimeout(() => saved.classList.remove('show'), 1200); }, 500);
    notes.oninput = () => saveNotes(notes.value);
    notes.onblur = () => { if (notes.value !== S.node(n.id)?.notes) S.updateNode(n.id, { notes: notes.value }); };

    body.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'close') sheet.close();
      if (act === 'back') { st.id = st.history.pop(); sheet.refresh(); body.scrollTop = 0; }
      if (act === 'goto') { st.history.push(st.id); st.id = b.dataset.id; sheet.refresh(); body.scrollTop = 0; }
      if (act === 'fav') { S.updateNode(n.id, { favorite: !n.favorite }); sheet.refresh(); }
      if (act === 'edit') editNode(n.id);
      if (act === 'add-in') addConnection(n.id, 'in');
      if (act === 'add-out') addConnection(n.id, 'out');
      if (act === 'edge') edgeActions(b.dataset.edge);
      if (act === 'add-clip') addClip(n.id);
      if (act === 'del-clip') { if (confirm('Delete this clip?')) { S.deleteClip(n.id, b.dataset.clip); sheet.refresh(); } }
      if (act === 'play') {
        const c = n.clips.find(x => x.id === b.dataset.clip), yt = youtubeInfo(c.url), start = c.start ?? yt.start;
        b.outerHTML = `<div class="yt playing"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt.id)}?autoplay=1&playsinline=1&rel=0${start ? `&start=${start}` : ''}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="YouTube clip"></iframe></div>`;
      }
      if (act === 'course') openCourse(b.dataset.course);
      if (act === 'entry') openEntry(b.dataset.entry);
      if (act === 'web' || act === 'flow' || act === 'max') { closeAllSheets(); showOnMap(n.id, act); }
      if (act === 'delete') {
        if (confirm(`Delete “${n.name}” and all of its connections?`)) { S.deleteNode(n.id); if (st.history.length) { st.id = st.history.pop(); sheet.refresh(); } else sheet.close(); toast('Move deleted'); }
      }
    };
  });
}

function edgeActions(edgeId) {
  const e = S.db().edges.find(x => x.id === edgeId);
  if (!e) return;
  const a = S.node(e.from), b = S.node(e.to);
  openSheet((body, sheet) => {
    body.innerHTML = `
      <div class="sheet-head"><h3 class="head-title">Connection</h3><span class="spacer"></span><button class="icon-btn" data-act="close" aria-label="Close">${I.close}</button></div>
      <div class="edge-pair">${dot(a.type)}<b>${esc(a.name)}</b><span class="arrow">→</span>${dot(b.type)}<b>${esc(b.name)}</b></div>
      <label class="field"><span>Why <em>— when does it happen? (shown on the map)</em></span>
        <input class="input f-why" value="${esc(e.label)}" placeholder="e.g. they posture up" autocomplete="off"></label>
      <label class="field"><span>How <em>— the details of doing it</em></span>
        <textarea class="f-how" rows="4" placeholder="e.g. control the sleeve, hip out to the side, then swing the leg over">${esc(e.how)}</textarea></label>
      <button class="btn primary wide" data-act="save">Save</button>
      <button class="btn danger wide" data-act="remove">${I.trash}Remove connection</button>`;
    setTimeout(() => $('.f-why', body).focus(), 320);
    body.onclick = ev => {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'close') sheet.close();
      if (btn.dataset.act === 'save') { S.updateEdge(edgeId, { label: $('.f-why', body).value.trim(), how: $('.f-how', body).value.trim() }); sheet.close(); toast('Saved'); }
      if (btn.dataset.act === 'remove') { S.deleteEdge(edgeId); sheet.close(); toast('Connection removed'); }
    };
  }, { className: 'compact' });
}

function addConnection(nodeId, dir) {
  const n = S.node(nodeId);
  const linked = new Set((dir === 'in' ? S.incoming(nodeId).map(e => e.from) : S.outgoing(nodeId).map(e => e.to)));
  linked.add(nodeId);
  openPicker({
    title: dir === 'in' ? `What flows into ${n.name}?` : `What can you do from ${n.name}?`,
    exclude: linked,
    withLabel: true,
    allowCreate: true,
    defaultType: dir === 'out' && n.type === 'position' ? 'submission' : 'position',
    onPick: (id, label, how) => {
      if (dir === 'in') S.addEdge(id, nodeId, label, how); else S.addEdge(nodeId, id, label, how);
      toast('Connected');
    },
  });
}

// Searchable move picker; can also create a new move inline.
function openPicker({ title, exclude = new Set(), withLabel = false, allowCreate = true, onPick }) {
  openSheet((body, sheet) => {
    body.innerHTML = `
      <div class="sheet-head"><h3 class="head-title">${esc(title)}</h3><span class="spacer"></span><button class="icon-btn" data-close>${I.close}</button></div>
      <label class="search">${I.search}<input type="search" class="pk-q" placeholder="${allowCreate ? 'Search or type a new move' : 'Search moves'}" autocomplete="off"></label>
      ${withLabel ? `<input class="input pk-label" placeholder="Why? (optional) — e.g. they posture up" autocomplete="off">
        <input class="input pk-how" placeholder="How? (optional) — e.g. grip the sleeve, hip out" autocomplete="off">` : ''}
      <div class="pk-list"></div>`;
    const q = $('.pk-q', body), list = $('.pk-list', body);
    const draw = () => {
      const query = q.value.trim();
      const items = S.nodesSorted().filter(n => !exclude.has(n.id) && matches(n, query));
      const exact = S.db().nodes.some(n => n.name.toLowerCase() === query.toLowerCase());
      let html = '';
      if (allowCreate && query && !exact) {
        html += `<div class="pk-create"><div class="pk-create-title">Create “${esc(query)}” as…</div><div class="chip-wrap">
          ${TYPE_KEYS.map(k => `<button class="mchip" data-create="${k}" style="--c:${color(k)}">${TYPES[k].label}</button>`).join('')}</div></div>`;
      }
      html += `<div class="list">${items.map(n => `<button class="row" data-pick="${n.id}">${dot(n.type)}<span class="row-main"><span class="row-title">${esc(n.name)}</span><span class="row-sub">${TYPES[n.type].label}</span></span></button>`).join('')}</div>`;
      if (!items.length && !(allowCreate && query)) html += '<p class="empty-small">No moves found.</p>';
      list.innerHTML = html;
    };
    q.oninput = draw;
    draw();
    setTimeout(() => q.focus(), 320);
    body.onclick = e => {
      if (e.target.closest('[data-close]')) return sheet.close();
      const label = withLabel ? $('.pk-label', body).value.trim() : '';
      const how = withLabel ? $('.pk-how', body).value.trim() : '';
      const pick = e.target.closest('[data-pick]');
      const create = e.target.closest('[data-create]');
      // Save first, then close: closing refreshes the screen underneath, so it shows the new link right away.
      if (pick) { onPick(pick.dataset.pick, label, how); sheet.close(); }
      if (create) { const n = S.addNode({ name: q.value.trim(), type: create.dataset.create }); onPick(n.id, label, how); sheet.close(); }
    };
  }, { className: 'tall' });
}

function editNode(id, after) {
  const n = id ? S.node(id) : null;
  openSheet((body, sheet) => {
    let type = sheet.state.type ?? n?.type ?? 'position';
    body.innerHTML = `
      <div class="sheet-head"><h3 class="head-title">${n ? 'Edit move' : 'New move'}</h3><span class="spacer"></span><button class="icon-btn" data-close>${I.close}</button></div>
      <label class="field"><span>Name</span><input class="input f-name" value="${esc(n?.name || '')}" placeholder="e.g. Kimura Trap" autocomplete="off"></label>
      <div class="field"><span>Type</span><div class="chip-wrap type-pick">
        ${TYPE_KEYS.map(k => `<button class="mchip ${k === type ? 'active' : ''}" data-type="${k}" style="--c:${color(k)}">${TYPES[k].label}</button>`).join('')}
      </div></div>
      <label class="field"><span>Tags <em>(comma separated)</em></span><input class="input f-tags" value="${esc(n?.tags.join(', ') || '')}" placeholder="gi, no-gi, competition" autocomplete="off"></label>
      <button class="btn primary wide" data-save>${n ? 'Save' : 'Add move'}</button>`;
    const name = $('.f-name', body);
    if (!n) setTimeout(() => name.focus(), 320);
    body.onclick = e => {
      if (e.target.closest('[data-close]')) return sheet.close();
      const tb = e.target.closest('[data-type]');
      if (tb) { type = sheet.state.type = tb.dataset.type; $$('.type-pick .mchip', body).forEach(b => b.classList.toggle('active', b === tb)); }
      if (e.target.closest('[data-save]')) {
        const nm = name.value.trim();
        if (!nm) { name.focus(); return; }
        const tags = $('.f-tags', body).value.split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean);
        let res;
        if (n) { S.updateNode(n.id, { name: nm, type, tags }); res = S.node(n.id); } else res = S.addNode({ name: nm, type, tags });
        sheet.close();
        after?.(res);
      }
    };
    name.onkeydown = e => { if (e.key === 'Enter') $('[data-save]', body).click(); };
  }, { className: 'compact' });
}

function addClip(nodeId) {
  openSheet((body, sheet) => {
    body.innerHTML = `
      <div class="sheet-head"><h3 class="head-title">Add clip</h3><span class="spacer"></span><button class="icon-btn" data-close>${I.close}</button></div>
      <label class="field"><span>Link</span><input class="input c-url" type="url" inputmode="url" placeholder="Paste a YouTube, BJJ Fanatics or Submeta link" autocomplete="off"></label>
      <div class="detected"></div>
      <label class="field"><span>Title</span><input class="input c-title" placeholder="e.g. Danaher — kimura grip details" autocomplete="off"></label>
      <div class="field-row">
        <label class="field"><span>Start at</span><input class="input c-time" placeholder="mm:ss" inputmode="numeric" autocomplete="off"></label>
        <label class="field grow"><span>Note</span><input class="input c-note" placeholder="e.g. Vol 2, chapter 4" autocomplete="off"></label>
      </div>
      <p class="hint">YouTube clips play right here. BJJ Fanatics & Submeta open in their app/site at your saved timestamp note (they don’t allow embedding).</p>
      <button class="btn primary wide" data-save>Save clip</button>`;
    const url = $('.c-url', body), time = $('.c-time', body), det = $('.detected', body);
    url.oninput = () => {
      const u = url.value.trim();
      if (!u) { det.innerHTML = ''; return; }
      const src = SOURCES[detectSource(u)];
      det.innerHTML = `<span class="src" style="--c:${src.color}">${src.label}</span>`;
      const yt = youtubeInfo(normalizeUrl(u));
      if (yt?.start != null && !time.value) time.value = formatTime(yt.start);
    };
    setTimeout(() => url.focus(), 320);
    body.onclick = e => {
      if (e.target.closest('[data-close]')) return sheet.close();
      if (!e.target.closest('[data-save]')) return;
      const u = normalizeUrl(url.value);
      if (!u) { url.focus(); return; }
      const start = parseTime(time.value);
      if (time.value.trim() && start == null) { toast('Use a time like 2:35'); time.focus(); return; }
      S.addClip(nodeId, { url: u, source: detectSource(u), title: $('.c-title', body).value.trim(), start, note: $('.c-note', body).value.trim(), added: Date.now() });
      sheet.close();
      toast('Clip saved');
    };
  });
}

// ---------- Map ----------
let graph = null;
function renderMap() {
  const v = $('#view-map');
  if (!graph) {
    v.innerHTML = `
      <div class="map-wrap">
        <div id="graphHost"></div>
        <div class="map-toolbar">
          <div class="seg glass" id="mapMode"><button data-mode="web">Web</button><button data-mode="flow">Flow</button><button data-mode="max">Max</button></div>
          <span class="spacer"></span>
          <button class="icon-btn glass" id="mapFind" aria-label="Find move">${I.search}</button>
          <button class="icon-btn glass" id="mapFit" aria-label="Fit to screen">${I.fit}</button>
          <button class="icon-btn glass" id="mapRelayout" aria-label="Re-arrange web">${I.shuffle}</button>
        </div>
        <div class="map-card glass" id="mapCard"></div>
      </div>`;
    graph = new GraphView($('#graphHost'), {
      getData: () => S.db(),
      getLayout: S.getLayout,
      saveLayout: S.saveLayout,
      onSelect: id => { ui.mapSelected = id; savePrefs(); updateMapCard(); },
      onOpen: id => openNode(id),
    });
    graph.mode = ui.mapMode;
    graph.selected = S.node(ui.mapSelected) ? ui.mapSelected : null;
    graph.bottomInset = 96 + 56; // map card + tab bar
    graph.topInset = 52;          // toolbar
    $('#mapMode').onclick = e => { const b = e.target.closest('button'); if (b) setMapMode(b.dataset.mode); };
    $('#mapFit').onclick = () => graph.rebuild({ fit: true });
    $('#mapRelayout').onclick = () => { if (ui.mapMode === 'web') { graph.relayout(); toast('Web re-arranged'); } else setMapMode('web'); };
    $('#mapFind').onclick = () => openPicker({ title: 'Find a move', allowCreate: false, onPick: id => mapSelect(id, true) });
    $('#mapCard').onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'open') openNode(graph.selected);
      if (b.dataset.act === 'flow') setMapMode('flow');
      if (b.dataset.act === 'max') setMapMode('max');
      if (b.dataset.act === 'web') setMapMode('web');
      if (b.dataset.act === 'clear') clearMapSelection();
    };
    graph.rebuild({ fit: true, animate: false });
    updateMapCard();
  } else {
    graph.rebuild({ fit: false, animate: false });
    updateMapCard();
  }
  $$('#mapMode button').forEach(b => b.classList.toggle('active', b.dataset.mode === ui.mapMode));
}

function setMapMode(mode) {
  ui.mapMode = mode; savePrefs();
  if (mode !== 'web' && !graph.selected) {
    const first = S.db().nodes.find(n => isPlace(n.type)) || S.db().nodes[0];
    graph.selected = first?.id || null;
    ui.mapSelected = graph.selected;
  }
  graph.setMode(mode);
  if (mode === 'web' && graph.selected) graph.centerOn(graph.selected, 1);
  $$('#mapMode button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  updateMapCard();
}

// Deselect and go back to the whole web.
function clearMapSelection() {
  ui.mapSelected = null; savePrefs();
  graph.selected = null;
  if (ui.mapMode !== 'web') { ui.mapMode = 'web'; savePrefs(); graph.setMode('web'); $$('#mapMode button').forEach(b => b.classList.toggle('active', b.dataset.mode === 'web')); }
  else { graph.applyHighlight(); graph.fit(graph.scene?.nodes); }
  updateMapCard();
}

function mapSelect(id, center) {
  ui.mapSelected = id; savePrefs();
  if (!graph) return;
  graph.rebuild({ animate: false });
  graph.select(id, { center });
  updateMapCard();
}

function showOnMap(id, mode) {
  ui.mapSelected = id;
  ui.mapMode = mode;
  setView('map');
  graph.selected = id;
  setMapMode(mode);
}

function updateMapCard() {
  const card = $('#mapCard');
  if (!card || !graph) return;
  const n = graph.selected && S.node(graph.selected);
  if (!S.db().nodes.length) {
    card.innerHTML = `<div class="mc-hint">No moves yet — tap <b>+</b> to add one.</div>`;
    return;
  }
  if (!n) {
    card.innerHTML = `<div class="mc-hint">Tap a box to see what flows in &amp; out · tap ✕ or empty space to show everything</div>`;
    return;
  }
  const ins = S.incoming(n.id).length, outs = S.outgoing(n.id).length;
  card.innerHTML = `
    ${dot(n.type)}
    <div class="mc-main"><div class="mc-name">${esc(n.name)}</div>
      <div class="mc-sub">${ui.mapMode === 'max'
        ? `<span class="in-txt">↑ ${graph.chainCounts?.up || 0}</span> · <span class="out-txt">↓ ${graph.chainCounts?.down || 0}</span>`
        : `<span class="in-txt">${ins} in</span> · <span class="out-txt">${outs} out</span>`}</div></div>
    ${['web', 'flow', 'max'].filter(m => m !== ui.mapMode).map(m => `<button class="btn sm" data-act="${m}">${{ web: 'Web', flow: 'Flow', max: 'Max' }[m]}</button>`).join('')}
    <button class="btn sm primary" data-act="open">Details</button>
    <button class="icon-btn sm" data-act="clear" aria-label="Show everything">${I.close}</button>`;
}

window.addEventListener('resize', debounce(() => { if (graph && ui.view === 'map') graph.rebuild({ fit: ui.mapMode !== 'web', animate: false }); }, 200));

// ---------- Courses ----------
function courseStats(c) {
  const done = c.chapters.filter(ch => ch.done).length;
  const moves = new Set(c.chapters.flatMap(ch => ch.nodeIds)).size;
  return { done, total: c.chapters.length, pct: c.chapters.length ? Math.round((done / c.chapters.length) * 100) : 0, moves };
}

function renderCourses() {
  const v = $('#view-courses');
  const courses = S.db().courses;
  if (!courses.length) {
    v.innerHTML = `<div class="empty"><p>Track instructionals from BJJ Fanatics, Submeta, YouTube or anywhere — split them into chapters and link each chapter to moves in your game.</p><button class="btn primary" data-new>Add a course</button></div>`;
  } else {
    v.innerHTML = `<div class="course-list pad-bottom">${courses.map(c => {
      const s = courseStats(c), src = SOURCES[detectSource(c.url)];
      return `<button class="course-card" data-course="${c.id}">
        <div class="course-top">${c.url ? `<span class="src" style="--c:${src.color}">${src.label}</span>` : ''}<span class="spacer"></span>${I.chev}</div>
        <div class="course-title">${esc(c.title)}</div>
        ${c.instructor ? `<div class="course-sub">${esc(c.instructor)}</div>` : ''}
        <div class="progress"><span style="width:${s.pct}%"></span></div>
        <div class="course-sub">${s.done} / ${s.total} chapters done · ${s.moves} move${s.moves === 1 ? '' : 's'} linked</div>
      </button>`;
    }).join('')}</div>`;
  }
  v.onclick = e => {
    const c = e.target.closest('[data-course]');
    if (c) openCourse(c.dataset.course);
    if (e.target.closest('[data-new]')) editCourse(null);
  };
}

function editCourse(id) {
  const c = id ? S.course(id) : null;
  openSheet((body, sheet) => {
    body.innerHTML = `
      <div class="sheet-head"><h3 class="head-title">${c ? 'Edit course' : 'New course'}</h3><span class="spacer"></span><button class="icon-btn" data-close>${I.close}</button></div>
      <label class="field"><span>Title</span><input class="input f-title" value="${esc(c?.title || '')}" placeholder="e.g. Enter the System: Kimura" autocomplete="off"></label>
      <label class="field"><span>Instructor</span><input class="input f-inst" value="${esc(c?.instructor || '')}" placeholder="e.g. John Danaher" autocomplete="off"></label>
      <label class="field"><span>Link</span><input class="input f-url" type="url" inputmode="url" value="${esc(c?.url || '')}" placeholder="BJJ Fanatics / Submeta / YouTube playlist URL" autocomplete="off"></label>
      <button class="btn primary wide" data-save>${c ? 'Save' : 'Create course'}</button>`;
    if (!c) setTimeout(() => $('.f-title', body).focus(), 320);
    body.onclick = e => {
      if (e.target.closest('[data-close]')) return sheet.close();
      if (!e.target.closest('[data-save]')) return;
      const patch = { title: $('.f-title', body).value.trim() || 'Untitled course', instructor: $('.f-inst', body).value.trim(), url: normalizeUrl($('.f-url', body).value) };
      sheet.close();
      if (c) S.updateCourse(c.id, patch);
      else { const nc = S.addCourse(patch); openCourse(nc.id); }
    };
  }, { className: 'compact' });
}

function openCourse(id) {
  openSheet((body, sheet) => {
    const c = S.course(id);
    if (!c) { sheet.close(); return; }
    const s = courseStats(c), src = SOURCES[detectSource(c.url)];
    body.innerHTML = `
      <div class="sheet-head">
        ${c.url ? `<span class="src" style="--c:${src.color}">${src.label}</span>` : '<span class="badge" style="--c:#8e8e93">Course</span>'}
        <span class="spacer"></span>
        <button class="icon-btn" data-act="edit" aria-label="Edit">${I.edit}</button>
        <button class="icon-btn" data-act="close" aria-label="Close">${I.close}</button>
      </div>
      <h2 class="sheet-title">${esc(c.title)}</h2>
      ${c.instructor ? `<div class="sheet-sub">${esc(c.instructor)}</div>` : ''}
      ${c.url ? `<div class="btn-row"><a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener">${I.ext}Open course</a></div>` : ''}
      <div class="progress big"><span style="width:${s.pct}%"></span></div>
      <div class="course-sub">${s.done} of ${s.total} chapters done</div>
      <section class="sec">
        <div class="sec-head"><h3>Chapters <span class="count">${c.chapters.length}</span></h3><button class="link-btn" data-act="add-ch">+ Add chapter</button></div>
        <div class="list">${c.chapters.map((ch, i) => `
          <div class="chapter ${ch.done ? 'done' : ''}">
            <button class="check" data-act="toggle" data-ch="${ch.id}" aria-label="Mark done">${I.check}</button>
            <button class="ch-main" data-act="chapter" data-ch="${ch.id}">
              <span class="row-title">${i + 1}. ${esc(ch.title)}</span>
              <span class="row-sub">${[ch.time ? `@ ${esc(ch.time)}` : '', ...ch.nodeIds.map(nid => esc(S.node(nid)?.name || ''))].filter(Boolean).join(' · ') || 'Tap to link moves'}</span>
            </button>
            ${ch.url ? `<a class="icon-btn sm" href="${esc(ch.url)}" target="_blank" rel="noopener" aria-label="Open">${I.ext}</a>` : ''}
          </div>`).join('') || '<p class="empty-small">Break the course into chapters/volumes and link each to moves.</p>'}
        </div>
      </section>
      <section class="sec">
        <div class="sec-head"><h3>Notes</h3><span class="saved">Saved</span></div>
        <textarea class="notes" rows="4" placeholder="Big takeaways from this course…">${esc(c.notes)}</textarea>
      </section>
      <button class="btn danger wide" data-act="delete">${I.trash}Delete course</button>`;
    const notes = $('.notes', body), saved = $('.saved', body);
    const save = debounce(v => { S.updateCourse(c.id, { notes: v }); saved.classList.add('show'); setTimeout(() => saved.classList.remove('show'), 1200); }, 500);
    notes.oninput = () => save(notes.value);
    notes.onblur = () => { if (notes.value !== S.course(c.id)?.notes) S.updateCourse(c.id, { notes: notes.value }); };
    body.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'close') sheet.close();
      if (act === 'edit') editCourse(c.id);
      if (act === 'toggle') { const ch = c.chapters.find(x => x.id === b.dataset.ch); S.updateChapter(c.id, ch.id, { done: !ch.done }); sheet.refresh(); }
      if (act === 'chapter') editChapter(c.id, b.dataset.ch);
      if (act === 'add-ch') { const ch = S.addChapter(c.id, { title: `Chapter ${c.chapters.length + 1}` }); sheet.refresh(); editChapter(c.id, ch.id, true); }
      if (act === 'delete') { if (confirm(`Delete course “${c.title}”?`)) { S.deleteCourse(c.id); sheet.close(); toast('Course deleted'); } }
    };
  });
}

function editChapter(courseId, chId, isNew) {
  openSheet((body, sheet) => {
    const c = S.course(courseId), ch = c?.chapters.find(x => x.id === chId);
    if (!ch) { sheet.close(); return; }
    body.innerHTML = `
      <div class="sheet-head"><h3 class="head-title">Chapter</h3><span class="spacer"></span>
        <button class="icon-btn" data-act="up" aria-label="Move up">${I.up}</button>
        <button class="icon-btn" data-act="down" aria-label="Move down">${I.down}</button>
        <button class="icon-btn" data-act="close" aria-label="Done">${I.close}</button></div>
      <label class="field"><span>Title</span><input class="input f-title" value="${esc(ch.title)}" autocomplete="off"></label>
      <div class="field-row">
        <label class="field"><span>Timestamp</span><input class="input f-time" value="${esc(ch.time)}" placeholder="12:30" autocomplete="off"></label>
        <label class="field grow"><span>Link <em>(optional)</em></span><input class="input f-url" type="url" inputmode="url" value="${esc(ch.url)}" placeholder="Direct link to this part" autocomplete="off"></label>
      </div>
      <div class="field"><span>Moves covered</span><div class="chip-wrap">
        ${ch.nodeIds.map(nid => { const n = S.node(nid); return n ? `<span class="mchip removable" style="--c:${color(n.type)}"><button data-act="node" data-id="${n.id}">${esc(n.name)}</button><button class="x" data-act="unlink" data-id="${n.id}" aria-label="Unlink">×</button></span>` : ''; }).join('')}
        <button class="mchip add" data-act="link">+ Link move</button>
      </div></div>
      <label class="field"><span>Notes</span><textarea class="notes f-notes" rows="3" placeholder="Details from this chapter…">${esc(ch.notes)}</textarea></label>
      <label class="toggle"><input type="checkbox" class="f-done" ${ch.done ? 'checked' : ''}> Watched / done</label>
      <button class="btn primary wide" data-act="close">Done</button>
      <button class="btn danger wide" data-act="delete">${I.trash}Delete chapter</button>`;
    const save = () => S.updateChapter(courseId, chId, {
      title: $('.f-title', body).value.trim() || 'Chapter',
      time: $('.f-time', body).value.trim(),
      url: normalizeUrl($('.f-url', body).value),
      notes: $('.f-notes', body).value,
      done: $('.f-done', body).checked,
    });
    $$('input, textarea', body).forEach(i => { i.onchange = save; });
    $('.f-notes', body).oninput = debounce(save, 500);
    if (isNew && !sheet.state.focused) { sheet.state.focused = true; setTimeout(() => { const t = $('.f-title', body); t.focus(); t.select(); }, 320); }
    body.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'close') { save(); sheet.close(); }
      if (act === 'up' || act === 'down') { save(); S.moveChapter(courseId, chId, act === 'up' ? -1 : 1); toast(act === 'up' ? 'Moved up' : 'Moved down'); }
      if (act === 'node') { save(); openNode(b.dataset.id); }
      if (act === 'unlink') { save(); S.updateChapter(courseId, chId, { nodeIds: ch.nodeIds.filter(x => x !== b.dataset.id) }); sheet.refresh(); }
      if (act === 'link') {
        save();
        openPicker({ title: 'Link a move to this chapter', exclude: new Set(ch.nodeIds), onPick: nid => { S.updateChapter(courseId, chId, { nodeIds: [...ch.nodeIds, nid] }); } });
      }
      if (act === 'delete') { if (confirm('Delete this chapter?')) { S.deleteChapter(courseId, chId); sheet.close(); } }
    };
  });
}

// ---------- Journal ----------
const JKIND = {
  lesson: { label: 'Lessons', one: 'Lesson', short: 'Lesson', color: '#6e8bff' },
  roll: { label: 'Rolling', one: 'Roll', short: 'Roll', color: '#ff9f43' },
};
const parseDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = iso => parseDate(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const entryTitle = j => j.title.trim() || (j.kind === 'lesson' ? 'Lesson' : j.partner ? `Rolls with ${j.partner}` : 'Rolling session');
const entryText = j => [j.title, j.coach, j.school, j.body, j.partner, j.worked, j.struggled, j.nextFocus, ...j.nodeIds.map(id => S.node(id)?.name || '')].join(' ').toLowerCase();
const feelDots = f => f ? `<span class="feel" aria-label="Felt ${f} of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= f ? 'on' : ''}"></i>`).join('')}</span>` : '';

function renderJournal() {
  const v = $('#view-journal');
  if (!v.dataset.ready) {
    v.dataset.ready = '1';
    v.innerHTML = `
      <div class="lib-controls">
        <label class="search">${I.search}<input type="search" id="jSearch" placeholder="Search your journal" autocomplete="off"></label>
        <div class="seg" id="jKind"><button data-kind="lesson">Lessons</button><button data-kind="roll">Rolling</button></div>
      </div>
      <div id="jList" class="pad-bottom"></div>`;
    $('#jSearch').addEventListener('input', e => { ui.journalQuery = e.target.value; renderJournalList(); });
    $('#jKind').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ui.journalKind = b.dataset.kind; savePrefs(); renderJournal(); } });
    $('#jList').addEventListener('click', e => {
      const c = e.target.closest('[data-entry]');
      if (c) openEntry(c.dataset.entry);
      if (e.target.closest('[data-new-entry]')) newEntry(ui.journalKind);
    });
  }
  $$('#jKind button').forEach(b => b.classList.toggle('active', b.dataset.kind === ui.journalKind));
  renderJournalList();
}

function renderJournalList() {
  const list = $('#jList');
  if (!list) return;
  const kind = ui.journalKind;
  const q = ui.journalQuery.trim().toLowerCase();
  const all = S.journalSorted(kind);
  const items = all.filter(j => !q || q.split(/\s+/).every(w => entryText(j).includes(w)));
  if (!all.length) {
    list.innerHTML = kind === 'lesson'
      ? `<div class="empty"><p>Write down what you learned after each class — the technique, the key details, and what clicked.</p><button class="btn primary" data-new-entry>Add a lesson</button></div>`
      : `<div class="empty"><p>Reflect on your rolls — what worked, where you got stuck, and what to focus on next time.</p><button class="btn primary" data-new-entry>Add a roll reflection</button></div>`;
    return;
  }
  let html = '';
  if (kind === 'roll' && !q) {
    const focus = all.find(j => j.nextFocus.trim());
    if (focus) html += `<button class="focus-card" data-entry="${focus.id}"><span class="focus-label">Current focus</span><span class="focus-text">${esc(focus.nextFocus)}</span><span class="row-sub">from ${fmtDate(focus.date)}</span></button>`;
  }
  let month = '';
  for (const j of items) {
    const m = parseDate(j.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (m !== month) { month = m; html += `<h4 class="group-head">${esc(m)}</h4>`; }
    const preview = j.kind === 'lesson'
      ? (j.body.trim() ? `<p class="j-preview">${esc(j.body)}</p>` : '')
      : [j.worked.trim() ? `<p class="j-line good"><b>✓</b>${esc(j.worked)}</p>` : '', j.struggled.trim() ? `<p class="j-line bad"><b>✗</b>${esc(j.struggled)}</p>` : ''].join('');
    const moves = j.nodeIds.map(id => S.node(id)).filter(Boolean);
    html += `<button class="j-card" data-entry="${j.id}">
      <div class="j-top"><span class="j-date">${fmtDate(j.date)}</span>${j.school ? `<span class="j-school">· ${esc(j.school)}</span>` : ''}<span class="spacer"></span>${feelDots(j.feel)}</div>
      <div class="j-title">${esc(entryTitle(j))}</div>
      ${j.kind === 'lesson' && j.coach ? `<div class="row-sub">with ${esc(j.coach)}</div>` : ''}${j.kind === 'roll' && j.partner && j.title ? `<div class="row-sub">with ${esc(j.partner)}</div>` : ''}
      ${preview}
      ${moves.length ? `<div class="chip-wrap j-moves">${moves.map(n => `<span class="mchip tiny" style="--c:${color(n.type)}">${esc(n.name)}</span>`).join('')}</div>` : ''}
    </button>`;
  }
  list.innerHTML = html || `<div class="empty"><p>No entries match “${esc(ui.journalQuery)}”.</p></div>`;
}

function newEntry(kind) {
  // New entries default to the school you logged most recently.
  const j = S.addEntry(kind, { school: S.schools()[0] || '' });
  openEntry(j.id, true);
}

function openEntry(id, isNew) {
  openSheet((body, sheet) => {
    const j = S.entry(id);
    if (!j) { sheet.close(); return; }
    const k = JKIND[j.kind];
    const lesson = j.kind === 'lesson';
    body.innerHTML = `
      <div class="sheet-head">
        <span class="badge" style="--c:${k.color}">${k.one}</span>
        <span class="spacer"></span><span class="saved">Saved</span>
        <button class="icon-btn" data-act="close" aria-label="Done">${I.close}</button>
      </div>
      <div class="seg j-kind"><button data-kind="lesson" class="${lesson ? 'active' : ''}">Lesson</button><button data-kind="roll" class="${lesson ? '' : 'active'}">Roll reflection</button></div>
      <div class="field-row">
        <label class="field" style="width:150px"><span>Date</span><input class="input" type="date" data-f="date" value="${esc(j.date)}"></label>
        <label class="field grow"><span>${lesson ? 'Coach' : 'Partner(s)'}</span><input class="input" data-f="${lesson ? 'coach' : 'partner'}" value="${esc(lesson ? j.coach : j.partner)}" placeholder="${lesson ? 'Who taught it' : 'Who you rolled with'}" autocomplete="off"></label>
      </div>
      <label class="field"><span>School</span><input class="input" data-f="school" list="schoolList" value="${esc(j.school)}" placeholder="Which gym / academy" autocomplete="off"></label>
      <datalist id="schoolList">${S.schools().map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>
      <label class="field"><span>${lesson ? 'Topic' : 'Session'}</span><input class="input" data-f="title" value="${esc(j.title)}" placeholder="${lesson ? 'e.g. Knee cut pass vs. half guard' : 'e.g. Tuesday open mat'}" autocomplete="off"></label>
      ${lesson ? `
        <label class="field"><span>What I learned</span><textarea data-f="body" rows="7" placeholder="Key details, steps, grips, common mistakes, what clicked…">${esc(j.body)}</textarea></label>
      ` : `
        <div class="field"><span>How did it feel?</span><div class="feel-pick">${[1, 2, 3, 4, 5].map(i => `<button data-act="feel" data-v="${i}" class="${i <= j.feel ? 'on' : ''}" aria-label="${i} of 5">${i}</button>`).join('')}<em>${['', 'Rough', 'Meh', 'Okay', 'Good', 'Great'][j.feel] || ''}</em></div></div>
        <label class="field"><span class="good">✓ What worked</span><textarea data-f="worked" rows="3" placeholder="Sweeps, subs, positions that landed…">${esc(j.worked)}</textarea></label>
        <label class="field"><span class="bad">✗ Where I struggled / got caught</span><textarea data-f="struggled" rows="3" placeholder="Positions you got stuck in, what you got tapped with…">${esc(j.struggled)}</textarea></label>
        <label class="field"><span>→ Focus for next time</span><textarea data-f="nextFocus" rows="2" placeholder="One thing to work on in your next rolls">${esc(j.nextFocus)}</textarea></label>
      `}
      <div class="field"><span>Moves</span><div class="chip-wrap">
        ${j.nodeIds.map(nid => { const n = S.node(nid); return n ? `<span class="mchip removable" style="--c:${color(n.type)}"><button data-act="node" data-id="${n.id}">${esc(n.name)}</button><button class="x" data-act="unlink" data-id="${n.id}" aria-label="Unlink">×</button></span>` : ''; }).join('')}
        <button class="mchip add" data-act="link">+ Link move</button>
      </div></div>
      <button class="btn primary wide" data-act="close">Done</button>
      <button class="btn danger wide" data-act="delete">${I.trash}Delete entry</button>`;

    const saved = $('.saved', body);
    const save = () => {
      const patch = {};
      $$('[data-f]', body).forEach(f => { patch[f.dataset.f] = f.dataset.f === 'date' ? (f.value || S.today()) : f.value; });
      S.updateEntry(id, patch);
      saved.classList.add('show'); clearTimeout(save.t); save.t = setTimeout(() => saved.classList.remove('show'), 1000);
    };
    const saveSoon = debounce(save, 400);
    $$('[data-f]', body).forEach(f => { f.oninput = saveSoon; f.onchange = save; });
    if (isNew && !sheet.state.focused) { sheet.state.focused = true; setTimeout(() => $('[data-f=title]', body)?.focus(), 320); }

    body.onclick = e => {
      const kb = e.target.closest('.j-kind button');
      if (kb) { save(); S.updateEntry(id, { kind: kb.dataset.kind }); sheet.refresh(); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'close') { save(); sheet.close(); }
      if (act === 'feel') { save(); const v = +b.dataset.v; S.updateEntry(id, { feel: v === j.feel ? 0 : v }); sheet.refresh(); }
      if (act === 'node') { save(); openNode(b.dataset.id); }
      if (act === 'unlink') { save(); S.updateEntry(id, { nodeIds: j.nodeIds.filter(x => x !== b.dataset.id) }); sheet.refresh(); }
      if (act === 'link') {
        save();
        openPicker({ title: 'Link a move to this entry', exclude: new Set(j.nodeIds), onPick: nid => S.updateEntry(id, { nodeIds: [...S.entry(id).nodeIds, nid] }) });
      }
      if (act === 'delete') { if (confirm('Delete this journal entry?')) { S.deleteEntry(id); sheet.close(); toast('Entry deleted'); } }
    };
  }, {
    onClose: () => {
      // Throw away a brand-new entry that was never filled in.
      const j = S.entry(id);
      if (isNew && j && ![j.title, j.coach, j.body, j.partner, j.worked, j.struggled, j.nextFocus].some(x => x.trim()) && !j.nodeIds.length && !j.feel) S.deleteEntry(id);
    },
  });
}

// ---------- More ----------
function renderMore() {
  const v = $('#view-more');
  const d = S.db();
  const clips = d.nodes.reduce((a, n) => a + n.clips.length, 0);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  v.innerHTML = `<div class="more pad-bottom">
    <div class="stats">
      <div class="stat"><b>${d.nodes.length}</b><span>moves</span></div>
      <div class="stat"><b>${d.edges.length}</b><span>connections</span></div>
      <div class="stat"><b>${clips}</b><span>clips</span></div>
      <div class="stat"><b>${d.journal.length}</b><span>journal</span></div>
    </div>

    ${standalone ? '' : `<section class="card">
      <h3>Add to your iPhone home screen</h3>
      <ol class="steps">
        <li>Open this page in <b>Safari</b>.</li>
        <li>Tap the <b>Share</b> button (square with the up arrow).</li>
        <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      </ol>
      <p class="hint">It opens full-screen like a normal app and works offline.</p>
    </section>`}

    <section class="card">
      <h3>Backup to iCloud</h3>
      <p class="backup-status ${backup.unsaved() ? 'stale' : ''}">Last backup: <b>${ago(backup.state.backedUpAt)}</b>${backup.unsaved() ? ' · you have changes since then' : ' · up to date'}</p>
      <div class="btn-row">
        <button class="btn primary" data-act="export">Back up now</button>
        <button class="btn" data-act="import">Restore</button>
      </div>
      <label class="field"><span>Remind me to back up</span>
        <select class="input backup-every">
          ${[[1, 'Every day'], [3, 'Every 3 days'], [7, 'Every week'], [0, 'Never']].map(([v, l]) => `<option value="${v}" ${backup.state.every === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      <p class="hint">Tap <b>Back up now</b> → <b>Save to Files</b> → <b>iCloud Drive</b> and pick a folder (e.g. “BJJ”). The backup always has the same name, so next time just tap <b>Save</b> → <b>Replace</b> to overwrite the old one. To restore, tap <b>Restore</b> and pick “BJJ Mind Map Backup” from iCloud Drive.</p>
      <input type="file" accept="application/json,.json" hidden class="import-file">
    </section>

    <section class="card">
      <h3>Mind map</h3>
      <button class="btn wide" data-act="layout">Re-arrange the web automatically</button>
    </section>

    <section class="card">
      <h3>Start over</h3>
      <div class="btn-row">
        <button class="btn" data-act="sample">Load sample game</button>
        <button class="btn danger" data-act="blank">Start blank</button>
      </div>
      <p class="hint">Both replace everything currently in the app. Export a backup first if you want to keep it.</p>
    </section>
    <p class="footer-note">BJJ Mind Map · your data never leaves your phone.</p>
  </div>`;
  $('.backup-every', v).onchange = e => { backup.state.every = +e.target.value; backup.save(); updateBackupBar(); };
  const file = $('.import-file', v);
  file.onchange = async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      if (!confirm('Replace everything in the app with this backup?')) return;
      S.importJSON(text);
      backup.markBackedUp();
      graph && graph.rebuild({ fit: true });
      toast('Backup imported');
    } catch (err) { alert('Could not import: ' + err.message); }
    file.value = '';
  };
  v.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'export') exportBackup();
    if (act === 'import') file.click();
    if (act === 'layout') { S.saveLayout({}); toast('Web will be re-arranged'); if (graph) graph.relayout(); }
    if ((act === 'sample' || act === 'blank') && confirm(act === 'sample' ? 'Replace everything with the sample game?' : 'Delete everything and start with an empty library?')) {
      S.resetTo(act); ui.mapSelected = null; if (graph) { graph.selected = null; graph.rebuild({ fit: true }); } toast('Done');
    }
  };
}

// ---------- backup reminders ----------
// A home-screen web app can't write to iCloud Drive on its own, so the app keeps track of unsaved changes and
// nudges you to save a backup. One tap opens the share sheet → "Save to Files" → iCloud Drive (iOS remembers the folder).
const BACKUP_KEY = 'bjj-mind-map:backup';
var backupReady = true;
const backup = {
  state: (() => { try { return { every: 3, ...JSON.parse(localStorage.getItem(BACKUP_KEY)) }; } catch { return { every: 3 }; } })(),
  save() { try { localStorage.setItem(BACKUP_KEY, JSON.stringify(this.state)); } catch {} },
  markChanged() { this.state.changedAt = Date.now(); this.save(); },
  markBackedUp() { this.state.backedUpAt = Date.now(); this.state.snoozeUntil = 0; this.save(); updateBackupBar(); },
  unsaved() { return !!this.state.changedAt && (!this.state.backedUpAt || this.state.changedAt > this.state.backedUpAt); },
  due() {
    const s = this.state;
    if (!s.every || !this.unsaved() || Date.now() < (s.snoozeUntil || 0)) return false;
    const since = s.backedUpAt || s.firstChangeAt || s.changedAt;
    return Date.now() - since >= s.every * 86400000;
  },
};
if (backup.state.changedAt && !backup.state.firstChangeAt) { backup.state.firstChangeAt = backup.state.changedAt; backup.save(); }
S.onChange(() => { if (!backup.state.firstChangeAt) { backup.state.firstChangeAt = Date.now(); backup.save(); } });

function ago(t) {
  if (!t) return 'never';
  const d = Math.floor((Date.now() - t) / 86400000);
  if (d <= 0) return 'today';
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

function updateBackupBar() {
  const bar = $('#backupBar');
  if (!backup.due() || stack.length || ui.view === 'map' || ui.view === 'more') { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = `<div class="bb-text"><b>Back up to iCloud</b><span>Last backup: ${ago(backup.state.backedUpAt)}</span></div>
    <button class="btn sm primary" data-bb="now">Back up</button>
    <button class="icon-btn sm" data-bb="later" aria-label="Remind me tomorrow">${I.close}</button>`;
}
$('#backupBar').addEventListener('click', e => {
  const b = e.target.closest('[data-bb]');
  if (!b) return;
  if (b.dataset.bb === 'now') exportBackup();
  else { backup.state.snoozeUntil = Date.now() + 86400000; backup.save(); updateBackupBar(); toast('I’ll remind you tomorrow'); }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateBackupBar(); });

async function exportBackup() {
  const json = S.exportJSON();
  // Always the same file name, so saving to the same iCloud folder replaces the previous backup.
  const name = 'BJJ Mind Map Backup.json';
  const fileObj = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [fileObj] })) {
    try {
      await navigator.share({ files: [fileObj], title: 'BJJ Mind Map backup' });
      backup.markBackedUp(); toast('Backup saved'); if (ui.view === 'more') renderMore();
      return;
    } catch (err) { if (err.name === 'AbortError') return; }
  }
  backup.markBackedUp();
  if (ui.view === 'more') renderMore();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(fileObj);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------- boot ----------
$('#tabbar').innerHTML = ['library', 'map', 'journal', 'courses', 'more']
  .map(v => `<button class="tab" data-view="${v}">${I[v]}<span>${VIEW_TITLES[v]}</span></button>`).join('');
$('#tabbar').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) { closeAllSheets(); setView(t.dataset.view); } });
setView(VIEW_TITLES[ui.view] ? ui.view : 'library');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  // When a new version of the app installs, reload once so it shows up immediately.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      // Home-screen apps stay open in the background for days, so check for updates whenever the app is brought back.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}

// Lock page zoom: iOS Safari ignores user-scalable=no, so block its pinch gesture events.
// The map's own pinch-to-zoom uses pointer events, so it keeps working.
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));

// Ask iOS to keep this app's storage instead of clearing it when space runs low.
navigator.storage?.persist?.().catch(() => {});
updateBackupBar();
