// Data store: everything lives in localStorage on the device.
import { makeSeed } from './seed.js';

const KEY = 'bjj-mind-map:data:v1';
const LAYOUT_KEY = 'bjj-mind-map:layout:v1';

export const TYPES = {
  position:   { label: 'Position',   plural: 'Positions',   color: '#8b9cff' },
  guard:      { label: 'Guard',      plural: 'Guards',      color: '#c084fc' },
  grip:       { label: 'Grip',       plural: 'Grips',       color: '#d4a373' },
  submission: { label: 'Submission', plural: 'Submissions', color: '#ff6b6b' },
  sweep:      { label: 'Sweep',      plural: 'Sweeps',      color: '#3ddc97' },
  pass:       { label: 'Pass',       plural: 'Passes',      color: '#ffb84d' },
  escape:     { label: 'Escape',     plural: 'Escapes',     color: '#4cc9f0' },
  takedown:   { label: 'Takedown',   plural: 'Takedowns',   color: '#ff7ac6' },
  transition: { label: 'Transition', plural: 'Transitions', color: '#b9b9c9' },
};
export const TYPE_KEYS = Object.keys(TYPES);
// Types that act as places you can be in (shown as cards in Library → By position).
export const PLACE_TYPES = ['position', 'guard'];
export const isPlace = type => PLACE_TYPES.includes(type);

// One-time upgrade for data saved before the Guard type existed:
// bottom-guard positions (e.g. "Closed Guard", "De La Riva") become Guards; "(Top)" positions stay positions.
function migrate(d) {
  d.migrations = d.migrations || [];
  if (!d.migrations.includes('guard-type')) {
    d.nodes.forEach(n => {
      if (n.type === 'position' && /guard|de la riva|\bdlr\b|x-guard|lasso|spider|worm/i.test(n.name) && !/\btop\b|passing/i.test(n.name)) n.type = 'guard';
    });
    d.migrations.push('guard-type');
  }
  return d;
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

let data = null;
let layout = {};
const listeners = new Set();

function blank() {
  return { version: 1, nodes: [], edges: [], courses: [], journal: [], paths: [] };
}

function normalize(d) {
  const out = blank();
  out.nodes = (d.nodes || []).map(n => ({
    id: n.id || uid(),
    name: n.name || 'Untitled',
    type: TYPES[n.type] ? n.type : 'transition',
    tags: Array.isArray(n.tags) ? n.tags : [],
    notes: n.notes || '',
    clips: Array.isArray(n.clips) ? n.clips : [],
    favorite: !!n.favorite,
    parentId: n.parentId || '',
    created: n.created || Date.now(),
  }));
  const ids = new Set(out.nodes.map(n => n.id));
  out.nodes.forEach(n => { if (!ids.has(n.parentId) || n.parentId === n.id) n.parentId = ''; });
  out.edges = (d.edges || []).filter(e => ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
    .map(e => ({ id: e.id || uid(), from: e.from, to: e.to, label: e.label || '', how: e.how || '' }));
  out.courses = (d.courses || []).map(c => ({
    id: c.id || uid(),
    title: c.title || 'Untitled course',
    instructor: c.instructor || '',
    url: c.url || '',
    notes: c.notes || '',
    chapters: (c.chapters || []).map(ch => ({
      id: ch.id || uid(),
      title: ch.title || 'Chapter',
      url: ch.url || '',
      time: ch.time || '',
      notes: ch.notes || '',
      done: !!ch.done,
      nodeIds: (ch.nodeIds || []).filter(id => ids.has(id)),
    })),
  }));
  out.migrations = Array.isArray(d.migrations) ? d.migrations : [];
  out.paths = (d.paths || []).map(p => ({
    id: p.id || uid(),
    name: p.name || 'Untitled path',
    notes: p.notes || '',
    starred: !!p.starred,
    steps: (p.steps || []).filter(id => ids.has(id)),
    created: p.created || Date.now(),
  }));
  out.journal = (d.journal || []).map(j => ({
    id: j.id || uid(),
    kind: j.kind === 'roll' ? 'roll' : 'lesson',
    date: /^\d{4}-\d{2}-\d{2}$/.test(j.date || '') ? j.date : today(),
    title: j.title || '',
    coach: j.coach || '',
    school: j.school || '',
    body: j.body || '',
    partner: j.partner || '',
    worked: j.worked || '',
    struggled: j.struggled || '',
    nextFocus: j.nextFocus || '',
    feel: Math.max(0, Math.min(5, +j.feel || 0)),
    nodeIds: (j.nodeIds || []).filter(id => ids.has(id)),
    created: j.created || Date.now(),
  }));
  return out;
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    data = raw ? migrate(normalize(JSON.parse(raw))) : migrate(normalize(makeSeed()));
  } catch {
    data = normalize(makeSeed());
  }
  try { layout = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}') || {}; } catch { layout = {}; }
  persist();
  return data;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); }
}
export function saveLayout(l) {
  layout = l;
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch {}
}
export function getLayout() { return layout; }

function changed() {
  persist();
  listeners.forEach(fn => fn());
}
export function onChange(fn) { listeners.add(fn); }

export const db = () => data;

// ---------- nodes ----------
export const node = id => data.nodes.find(n => n.id === id);
export const nodesSorted = () => [...data.nodes].sort((a, b) => a.name.localeCompare(b.name));

export function addNode({ name, type = 'position', tags = [] }) {
  const n = { id: uid(), name: name.trim() || 'Untitled', type, tags, notes: '', clips: [], favorite: false, created: Date.now() };
  data.nodes.push(n);
  changed();
  return n;
}
// ---------- variations (parent / child) ----------
// A move can be a variation of a guard or position, e.g. the "Collar & Sleeve" grip is a variation of Closed Guard.
// This is separate from flows: it says "this is a version of that position", not "this leads to that".
export const children = id => nodesSorted().filter(n => n.parentId === id);
export function ancestors(id) {
  const out = [];
  let p = node(id)?.parentId;
  while (p && !out.includes(p)) { out.push(p); p = node(p)?.parentId; }
  return out;
}
// Can `parentId` be the parent of `id`? (must be a guard/position and must not create a loop)
export function canParent(id, parentId) {
  const p = node(parentId);
  return !!p && parentId !== id && ['position', 'guard'].includes(p.type) && !ancestors(parentId).includes(id);
}
export function setParent(id, parentId) {
  const n = node(id);
  if (!n || (parentId && !canParent(id, parentId))) return false;
  n.parentId = parentId || '';
  changed();
  return true;
}

export function updateNode(id, patch) {
  const n = node(id);
  if (!n) return;
  Object.assign(n, patch);
  changed();
}
export function deleteNode(id) {
  data.nodes = data.nodes.filter(n => n.id !== id);
  data.edges = data.edges.filter(e => e.from !== id && e.to !== id);
  data.courses.forEach(c => c.chapters.forEach(ch => { ch.nodeIds = ch.nodeIds.filter(x => x !== id); }));
  data.journal.forEach(j => { j.nodeIds = j.nodeIds.filter(x => x !== id); });
  data.paths.forEach(p => { p.steps = p.steps.filter(x => x !== id); });
  data.nodes.forEach(n => { if (n.parentId === id) n.parentId = ''; });
  delete layout[id];
  saveLayout(layout);
  changed();
}

// ---------- edges ----------
export const incoming = id => data.edges.filter(e => e.to === id);
export const outgoing = id => data.edges.filter(e => e.from === id);
// label = why / when it happens (shown on the map); how = how you do it.
export function addEdge(from, to, label = '', how = '') {
  if (from === to) return null;
  const existing = data.edges.find(e => e.from === from && e.to === to);
  if (existing) {
    if (label) existing.label = label;
    if (how) existing.how = how;
    if (label || how) changed();
    return existing;
  }
  const e = { id: uid(), from, to, label, how };
  data.edges.push(e);
  changed();
  return e;
}
export function updateEdge(id, patch) {
  const e = data.edges.find(x => x.id === id);
  if (e) { Object.assign(e, patch); changed(); }
}
export function deleteEdge(id) {
  data.edges = data.edges.filter(e => e.id !== id);
  changed();
}

// ---------- clips ----------
export function addClip(nodeId, clip) {
  const n = node(nodeId);
  if (!n) return;
  n.clips.push({ id: uid(), ...clip });
  changed();
}
export function deleteClip(nodeId, clipId) {
  const n = node(nodeId);
  if (!n) return;
  n.clips = n.clips.filter(c => c.id !== clipId);
  changed();
}

// ---------- courses ----------
export const course = id => data.courses.find(c => c.id === id);
export function addCourse(patch) {
  const c = { id: uid(), title: 'New course', instructor: '', url: '', notes: '', chapters: [], ...patch };
  data.courses.push(c);
  changed();
  return c;
}
export function updateCourse(id, patch) {
  const c = course(id);
  if (c) { Object.assign(c, patch); changed(); }
}
export function deleteCourse(id) {
  data.courses = data.courses.filter(c => c.id !== id);
  changed();
}
export function addChapter(courseId, patch) {
  const c = course(courseId);
  if (!c) return null;
  const ch = { id: uid(), title: 'New chapter', url: '', time: '', notes: '', done: false, nodeIds: [], ...patch };
  c.chapters.push(ch);
  changed();
  return ch;
}
export function updateChapter(courseId, chId, patch) {
  const ch = course(courseId)?.chapters.find(x => x.id === chId);
  if (ch) { Object.assign(ch, patch); changed(); }
}
export function deleteChapter(courseId, chId) {
  const c = course(courseId);
  if (c) { c.chapters = c.chapters.filter(x => x.id !== chId); changed(); }
}
export function moveChapter(courseId, chId, dir) {
  const c = course(courseId);
  if (!c) return;
  const i = c.chapters.findIndex(x => x.id === chId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= c.chapters.length) return;
  [c.chapters[i], c.chapters[j]] = [c.chapters[j], c.chapters[i]];
  changed();
}
export function chaptersForNode(nodeId) {
  const out = [];
  data.courses.forEach(c => c.chapters.forEach(ch => { if (ch.nodeIds.includes(nodeId)) out.push({ course: c, chapter: ch }); }));
  return out;
}

// ---------- journal ----------
export const entry = id => data.journal.find(j => j.id === id);
export function journalSorted(kind) {
  return data.journal.filter(j => !kind || j.kind === kind)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
}
export function addEntry(kind, patch = {}) {
  const j = { id: uid(), kind, date: today(), title: '', coach: '', school: '', body: '', partner: '', worked: '', struggled: '', nextFocus: '', feel: 0, nodeIds: [], created: Date.now(), ...patch };
  data.journal.push(j);
  changed();
  return j;
}
export function updateEntry(id, patch) {
  const j = entry(id);
  if (j) { Object.assign(j, patch); changed(); }
}
export function deleteEntry(id) {
  data.journal = data.journal.filter(j => j.id !== id);
  changed();
}
// Schools you've logged, most recently used first (for autocomplete and as the default for new entries).
export function schools() {
  const seen = new Set();
  journalSorted().forEach(j => { const s = j.school.trim(); if (s) seen.add(s); });
  return [...seen];
}
export const journalForNode = nodeId => journalSorted().filter(j => j.nodeIds.includes(nodeId));

// ---------- paths (game plans) ----------
// A path is an ordered list of moves, e.g. Standing → Guard Pull → Closed Guard → Hip Bump → Mount → Armbar.
// Starred paths are your main plans and are listed first.
export const path = id => data.paths.find(p => p.id === id);
export const pathsSorted = () => [...data.paths].sort((a, b) => (b.starred - a.starred) || a.created - b.created);
export function addPath(patch = {}) {
  const p = { id: uid(), name: 'New path', notes: '', starred: false, steps: [], created: Date.now(), ...patch };
  data.paths.push(p);
  changed();
  return p;
}
export function updatePath(id, patch) {
  const p = path(id);
  if (p) { Object.assign(p, patch); changed(); }
}
export function deletePath(id) {
  data.paths = data.paths.filter(p => p.id !== id);
  changed();
}
export const pathsForNode = nodeId => pathsSorted().filter(p => p.steps.includes(nodeId));

// ---------- backup ----------
export function exportJSON() {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString(), layout }, null, 2);
}
export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.nodes)) throw new Error('Not a BJJ Mind Map backup file');
  data = migrate(normalize(parsed));
  saveLayout(parsed.layout && typeof parsed.layout === 'object' ? parsed.layout : {});
  changed();
}
export function resetTo(kind) {
  data = migrate(normalize(kind === 'sample' ? makeSeed() : blank()));
  saveLayout({});
  changed();
}
