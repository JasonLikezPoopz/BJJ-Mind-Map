// SVG "spider web" renderer with pan / pinch-zoom / drag, plus a focused Flow view.
import { TYPES } from './store.js';

const NS = 'http://www.w3.org/2000/svg';
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';
const TITLE_FONT = `600 13px ${FONT_FAMILY}`;
const SUB_FONT = `italic 400 11px ${FONT_FAMILY}`;
const HEADER_FONT = `700 11px ${FONT_FAMILY}`;
const MAX_W = 200;

const ctx = document.createElement('canvas').getContext('2d');
function textWidth(s, font) { ctx.font = font; return ctx.measureText(s).width; }
function truncate(s, font, max) {
  if (textWidth(s, font) <= max) return s;
  let t = s;
  while (t.length > 1 && textWidth(t + '…', font) > max) t = t.slice(0, -1);
  return t + '…';
}

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUB_LINE = 14;
// Break text into lines that fit `max` pixels (long single words are cut with an ellipsis).
export function wrapText(s, font, max) {
  const lines = [];
  let line = '';
  for (const word of String(s).split(/\s+/).filter(Boolean)) {
    const tryLine = line ? line + ' ' + word : word;
    if (textWidth(tryLine, font) <= max) { line = tryLine; continue; }
    if (line) lines.push(line);
    line = textWidth(word, font) <= max ? word : truncate(word, font, max);
  }
  if (line) lines.push(line);
  return lines;
}

export function nodeSize(node, sub, maxW = MAX_W) {
  const tw = Math.min(textWidth(node.name, TITLE_FONT), maxW - 34);
  const lines = sub ? wrapText(sub, SUB_FONT, maxW - 34) : [];
  const sw = lines.reduce((m, l) => Math.max(m, textWidth(l, SUB_FONT)), 0);
  return { w: Math.max(84, Math.max(tw, sw) + 34), h: 36 + lines.length * SUB_LINE, lines };
}

// Fruchterman–Reingold force layout followed by box-collision cleanup.
// Nodes that already have a position in `prev` stay put; only new ones are placed.
export function forceLayout(nodes, edges, prev = {}, aspect = 1) {
  const rand = rng(1337);
  const pos = {};
  const nbrs = new Map(nodes.map(n => [n.id, []]));
  edges.forEach(e => { nbrs.get(e.from)?.push(e.to); nbrs.get(e.to)?.push(e.from); });
  const size = Object.fromEntries(nodes.map(n => [n.id, nodeSize(n)]));
  let known = 0;
  nodes.forEach(n => { if (prev[n.id]) { pos[n.id] = { ...prev[n.id] }; known++; } });
  if (known === nodes.length) return pos;
  const R = Math.sqrt(nodes.length) * 80;
  const fixed = new Set(Object.keys(pos));
  nodes.forEach(n => {
    if (pos[n.id]) return;
    const anchor = nbrs.get(n.id).find(id => pos[id]);
    if (anchor) {
      const a = rand() * Math.PI * 2;
      pos[n.id] = { x: pos[anchor].x + Math.cos(a) * 140, y: pos[anchor].y + Math.sin(a) * 140 };
    } else {
      const a = rand() * Math.PI * 2, r = R * Math.sqrt(rand());
      pos[n.id] = { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }
  });

  const ids = nodes.map(n => n.id);
  const k = 170;
  const iterations = known ? 150 : 600;
  let temp = known ? 60 : k;
  for (let it = 0; it < iterations; it++) {
    const disp = {};
    ids.forEach(id => { disp[id] = { x: 0, y: 0 }; });
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos[ids[i]], b = pos[ids[j]];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = rand() - 0.5; dy = rand() - 0.5; d = 0.5; }
        const f = (k * k) / d;
        disp[ids[i]].x += (dx / d) * f; disp[ids[i]].y += (dy / d) * f;
        disp[ids[j]].x -= (dx / d) * f; disp[ids[j]].y -= (dy / d) * f;
      }
    }
    edges.forEach(e => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      const dx = a.x - b.x, dy = a.y - b.y, d = Math.max(0.01, Math.hypot(dx, dy));
      const f = (d * d) / k;
      disp[e.from].x -= (dx / d) * f; disp[e.from].y -= (dy / d) * f;
      disp[e.to].x += (dx / d) * f; disp[e.to].y += (dy / d) * f;
    });
    ids.forEach(id => {
      if (fixed.has(id)) return;
      const p = pos[id], v = disp[id];
      // gravity, stretched to match the screen shape (taller web on a phone in portrait)
      v.x -= p.x * 0.9 * Math.sqrt(aspect); v.y -= p.y * 0.9 / Math.sqrt(aspect);
      const d = Math.hypot(v.x, v.y);
      if (d > 0) { p.x += (v.x / d) * Math.min(d, temp); p.y += (v.y / d) * Math.min(d, temp); }
    });
    temp = Math.max(2, temp * 0.992);
  }

  // Remove box overlaps.
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = ids[i], B = ids[j], a = pos[A], b = pos[B];
        const ox = (size[A].w + size[B].w) / 2 + 16 - Math.abs(a.x - b.x);
        const oy = (size[A].h + size[B].h) / 2 + 16 - Math.abs(a.y - b.y);
        if (ox > 0 && oy > 0) {
          moved = true;
          const fa = fixed.has(A) ? 0 : fixed.has(B) ? 1 : 0.5, fb = 1 - fa;
          if (ox < oy) { const s = a.x < b.x ? -1 : 1; a.x += s * ox * fa; b.x -= s * ox * fb; }
          else { const s = a.y < b.y ? -1 : 1; a.y += s * oy * fa; b.y -= s * oy * fb; }
        }
      }
    }
    if (!moved) break;
  }
  ids.forEach(id => { pos[id].x = Math.round(pos[id].x); pos[id].y = Math.round(pos[id].y); });
  return pos;
}

function boxExit(cx, cy, hw, hh, dx, dy) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const t = Math.min(ax ? hw / ax : Infinity, ay ? hh / ay : Infinity);
  return [cx + dx * t, cy + dy * t];
}

function roundedPath(pts, r = 9) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 0.5) { d += ` L${x1},${y1}`; continue; }
    d += ` L${x1 - (x1 - x0) / l1 * rr},${y1 - (y1 - y0) / l1 * rr} Q${x1},${y1} ${x1 + (x2 - x1) / l2 * rr},${y1 + (y2 - y1) / l2 * rr}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0]},${last[1]}`;
}

const easeOut = t => 1 - Math.pow(1 - t, 3);

export class GraphView {
  constructor(container, { getData, getLayout, saveLayout, onSelect, onOpen }) {
    Object.assign(this, { getData, getLayout, saveLayout, onSelect, onOpen });
    this.mode = 'web';
    this.selected = null;
    this.scale = 1; this.tx = 0; this.ty = 0;
    this.els = new Map();   // key -> { g, x, y, w, h, id }
    this.edgeEls = [];      // { path, from, to, kind }
    this.webPos = {};
    this.bottomInset = 0;
    this.topInset = 0;

    const svg = this.svg = el('svg', { class: 'graph' }, container);
    const defs = el('defs', {}, svg);
    for (const kind of ['default', 'in', 'out']) {
      const m = el('marker', { id: `arrow-${kind}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', class: `arrowhead ${kind}` }, m);
    }
    this.vp = el('g', {}, svg);
    this.gEdges = el('g', {}, this.vp);
    this.gHeaders = el('g', {}, this.vp);
    this.gNodes = el('g', {}, this.vp);
    this.bindPointer();
  }

  // ---------- public API ----------
  setMode(mode) { this.mode = mode; this.rebuild({ fit: true }); }
  select(id, { center = false } = {}) {
    this.selected = id;
    if (this.mode !== 'web') this.rebuild({ fit: true });
    else { this.applyHighlight(); if (center && id) this.centerOn(id); }
  }
  relayout() {
    const { nodes, edges } = this.getData();
    this.webPos = forceLayout(nodes, edges, {}, this.aspect());
    this.saveLayout(this.webPos);
    this.rebuild({ fit: true });
  }

  aspect() {
    const w = this.svg.clientWidth || 390, h = (this.svg.clientHeight || 700) - this.bottomInset - this.topInset;
    return Math.max(0.5, Math.min(2.2, h / w));
  }

  rebuild({ fit = false, animate = true } = {}) {
    const { nodes, edges } = this.getData();
    const byId = new Map(nodes.map(n => [n.id, n]));
    if (this.selected && !byId.has(this.selected)) this.selected = null;
    this.webPos = forceLayout(nodes, edges, this.getLayout(), this.aspect());
    this.saveLayout(this.webPos);

    const scene = this.mode === 'flow' ? this.flowScene(byId, edges)
      : this.mode === 'max' ? this.maxScene(byId, edges)
      : this.webScene(nodes, edges);
    this.renderScene(scene, byId, animate);
    this.applyHighlight();
    if (fit) this.fit(scene.nodes);
  }

  webScene(nodes, edges) {
    const pairs = new Set(edges.map(e => e.from + '>' + e.to));
    return {
      nodes: nodes.map(n => ({ key: n.id, id: n.id, ...this.webPos[n.id] })),
      edges: edges.map(e => ({ from: e.from, to: e.to, kind: 'web', curve: pairs.has(e.to + '>' + e.from) })),
      headers: [],
    };
  }

  // "Flow Max": every chain into and out of the selected move, all the way to the end.
  // Each move appears once, at its shortest distance, so loops (armbar ⇄ triangle) don't repeat forever.
  // Laid out as indented trees: what leads here above the move, what follows below it.
  maxScene(byId, edges) {
    const c = this.selected;
    this.chainCounts = { up: 0, down: 0 };
    if (!c) return { nodes: [], edges: [], headers: [], empty: true };
    const outAdj = new Map(), inAdj = new Map();
    const push = (m, k, e) => { if (!m.has(k)) m.set(k, []); m.get(k).push(e); };
    edges.forEach(e => { push(outAdj, e.from, e); push(inAdj, e.to, e); });
    const order = (list, key) => list.slice().sort((a, b) => {
      const A = byId.get(a[key]), B = byId.get(b[key]);
      return A.type.localeCompare(B.type) || A.name.localeCompare(B.name);
    });
    const tree = (adj, key) => {
      const parentEdge = new Map(), children = new Map(), seen = new Set([c]);
      let frontier = [c];
      while (frontier.length) {
        const next = [];
        for (const u of frontier) {
          for (const e of order(adj.get(u) || [], key)) {
            const v = e[key];
            if (seen.has(v) || !byId.has(v)) continue;
            seen.add(v); parentEdge.set(v, e); push(children, u, v); next.push(v);
          }
        }
        frontier = next;
      }
      return { parentEdge, children };
    };
    const INDENT = 26, GAP = 12;
    const nodes = [], sEdges = [];
    const place = (key, id, left, y, sub, center) => {
      const { w } = nodeSize(byId.get(id), sub, MAX_W);
      nodes.push({ key, id, x: left + w / 2, y, sub, center });
    };
    const heightOf = (id, sub) => nodeSize(byId.get(id), sub, MAX_W).h;
    place('c:' + c, c, 0, 0, '', true);
    const centerH = heightOf(c, '');

    // Downstream: pre-order, children below their parent.
    const down = tree(outAdj, 'to');
    let y = 0, prevH = centerH, downCount = 0;
    const walkDown = (u, depth) => {
      for (const v of down.children.get(u) || []) {
        const sub = down.parentEdge.get(v).label, h = heightOf(v, sub);
        y += prevH / 2 + GAP + h / 2; prevH = h; downCount++;
        place('out:' + v, v, depth * INDENT, y, sub);
        sEdges.push({ from: u === c ? 'c:' + c : 'out:' + u, to: 'out:' + v, kind: 'out', route: 'tree-out' });
        walkDown(v, depth + 1);
      }
    };
    walkDown(c, 1);

    // Upstream: post-order, so each move sits just above the move it leads into.
    const up = tree(inAdj, 'from');
    const upList = [];
    const walkUp = (u, depth) => {
      for (const v of up.children.get(u) || []) { walkUp(v, depth + 1); upList.push({ v, u, depth }); }
    };
    walkUp(c, 1);
    // Stack upward from the centre, nearest first.
    let upY = 0, upPrevH = centerH;
    for (let i = upList.length - 1; i >= 0; i--) {
      const { v, u, depth } = upList[i];
      const sub = up.parentEdge.get(v).label, h = heightOf(v, sub);
      upY -= upPrevH / 2 + GAP + h / 2; upPrevH = h;
      place('in:' + v, v, depth * INDENT, upY, sub);
      sEdges.push({ from: 'in:' + v, to: u === c ? 'c:' + c : 'in:' + u, kind: 'in', route: 'tree-in' });
    }
    this.chainCounts = { up: upList.length, down: downCount };
    return { nodes, edges: sEdges, headers: [] };
  }

  flowScene(byId, edges) {
    const c = this.selected;
    if (!c) return { nodes: [], edges: [], headers: [], empty: true };
    const ins = edges.filter(e => e.to === c).map(e => ({ e, n: byId.get(e.from) })).sort((a, b) => a.n.type.localeCompare(b.n.type) || a.n.name.localeCompare(b.n.name));
    const outs = edges.filter(e => e.from === c).map(e => ({ e, n: byId.get(e.to) })).sort((a, b) => a.n.type.localeCompare(b.n.type) || a.n.name.localeCompare(b.n.name));
    const width = this.svg.clientWidth || 390;
    const colW = width < 420 ? Math.floor((width - 12) / 2) : 210;
    const cols = Math.max(1, Math.min(5, Math.floor((width - 12) / colW)));
    this.flowColW = colW;
    const maxW = this.flowMaxW = Math.min(MAX_W, colW - 22);
    const gap = 120, firstEdge = 95, rowGap = 12;
    const nodes = [], sEdges = [], headers = [];
    // Tree / bracket layout: each column has a rail on its left; every move branches off it.
    // Rows are as tall as their tallest box, so long "why" notes are shown in full.
    const grid = (items, prefix, dir) => {
      const usedCols = Math.max(1, Math.min(cols, items.length));
      let edge = firstEdge; // distance from the centre to the near edge of the current row
      let farEdge = firstEdge;
      for (let r = 0; r * usedCols < items.length; r++) {
        const row = items.slice(r * usedCols, (r + 1) * usedCols).map(it => ({ it, size: nodeSize(it.n, it.e.label, maxW) }));
        const rowH = Math.max(...row.map(x => x.size.h));
        row.forEach(({ it, size }, col) => {
          const colLeft = (col - usedCols / 2) * colW;
          nodes.push({ key: prefix + it.n.id, id: it.n.id, x: colLeft + 18 + size.w / 2, y: dir * (edge + rowH / 2), sub: it.e.label });
        });
        farEdge = edge + rowH;
        edge = farEdge + rowGap;
      }
      return farEdge;
    };
    const insTop = grid(ins, 'in:', -1);
    grid(outs, 'out:', 1);
    nodes.push({ key: 'c:' + c, id: c, x: 0, y: 0, center: true });
    const barIn = -gap / 2 - 4, barOut = gap / 2 + 4;
    ins.forEach(it => sEdges.push({ from: 'in:' + it.n.id, to: 'c:' + c, kind: 'in', route: 'in', bar: barIn }));
    outs.forEach(it => sEdges.push({ from: 'c:' + c, to: 'out:' + it.n.id, kind: 'out', route: 'out', bar: barOut }));
    headers.push({ text: ins.length ? `FLOWS IN FROM · ${ins.length}` : 'NOTHING FLOWS IN YET', y: ins.length ? -insTop - 21 : barIn, kind: 'in' });
    headers.push({ text: outs.length ? `FLOWS OUT TO · ${outs.length}` : 'NOTHING FLOWS OUT YET', y: barOut, kind: 'out' });
    return { nodes, edges: sEdges, headers };
  }

  renderScene(scene, byId, animate) {
    this.scene = scene;
    // headers
    this.gHeaders.textContent = '';
    scene.headers.forEach(hd => {
      const w = textWidth(hd.text, HEADER_FONT) + 20;
      el('rect', { x: -w / 2, y: hd.y - 11, width: w, height: 22, rx: 11, class: `flow-pill ${hd.kind}` }, this.gHeaders);
      const t = el('text', { x: 0, y: hd.y, class: `flow-header ${hd.kind}`, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, this.gHeaders);
      t.textContent = hd.text;
    });

    const keep = new Set(scene.nodes.map(n => n.key));
    const prevById = new Map();
    for (const [key, item] of this.els) {
      prevById.set(item.id, item);
      if (!keep.has(key)) { item.g.remove(); this.els.delete(key); }
    }
    const targets = new Map();
    scene.nodes.forEach(sn => {
      const n = byId.get(sn.id);
      if (!n) return;
      let item = this.els.get(sn.key);
      if (item && (item.sub !== (sn.sub || '') || item.center !== !!sn.center || item.name !== n.name || item.type !== n.type)) {
        item.g.remove(); this.els.delete(sn.key);
        item = { x: item.x, y: item.y, _reuse: true };
      }
      if (!item || item._reuse) {
        const start = item?._reuse ? item : (prevById.get(sn.id) || (this.mode !== 'web' ? { x: 0, y: 0 } : sn));
        item = this.makeNode(n, sn, start);
        this.els.set(sn.key, item);
      }
      targets.set(sn.key, { x: sn.x, y: sn.y });
    });

    // edges
    this.gEdges.textContent = '';
    this.edgeEls = scene.edges.filter(e => this.els.has(e.from) && this.els.has(e.to)).map(e => {
      const path = el('path', { class: 'edge' }, this.gEdges);
      return { ...e, path };
    });

    // animate to targets
    cancelAnimationFrame(this.raf);
    const from = new Map([...this.els].map(([k, v]) => [k, { x: v.x, y: v.y }]));
    const t0 = performance.now(), dur = animate ? 380 : 0;
    const step = now => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1, e = easeOut(p);
      for (const [k, item] of this.els) {
        const a = from.get(k), b = targets.get(k) || a;
        item.x = a.x + (b.x - a.x) * e; item.y = a.y + (b.y - a.y) * e;
        item.g.setAttribute('transform', `translate(${item.x},${item.y})`);
      }
      this.drawEdges();
      if (p < 1) this.raf = requestAnimationFrame(step);
    };
    step(performance.now());
  }

  makeNode(n, sn, start) {
    const sub = sn.sub || '';
    const { w, h, lines } = nodeSize(n, sub, this.mode === 'flow' && !sn.center ? this.flowMaxW || MAX_W : MAX_W);
    const titleY = sub ? -h / 2 + 18 : 0;
    const color = TYPES[n.type].color;
    const g = el('g', { class: 'node' + (sn.center ? ' center' : ''), 'data-key': sn.key, 'data-id': n.id, style: `--c:${color}` }, this.gNodes);
    el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 11, class: 'node-box' }, g);
    el('circle', { cx: -w / 2 + 13, cy: titleY, r: 4.5, class: 'node-dot' }, g);
    const t = el('text', { x: -w / 2 + 24, y: titleY, class: 'node-title', 'dominant-baseline': 'central' }, g);
    t.textContent = truncate(n.name, TITLE_FONT, w - 34);
    lines.forEach((line, i) => {
      const s = el('text', { x: -w / 2 + 24, y: -h / 2 + 36 + i * SUB_LINE, class: 'node-sub', 'dominant-baseline': 'central' }, g);
      s.textContent = line;
    });
    if (n.clips?.length) {
      el('circle', { cx: w / 2 - 2, cy: -h / 2 + 2, r: 6, class: 'node-badge' }, g);
    }
    return { g, x: start.x, y: start.y, w, h, id: n.id, sub, center: !!sn.center, name: n.name, type: n.type };
  }

  drawEdges() {
    for (const e of this.edgeEls) {
      const a = this.els.get(e.from), b = this.els.get(e.to);
      if (!a || !b) continue;
      let d;
      if (e.route === 'tree-out') {
        const rail = a.x - a.w / 2 + 14;
        d = roundedPath([[rail, a.y + a.h / 2], [rail, b.y], [b.x - b.w / 2 - 3, b.y]]);
      } else if (e.route === 'tree-in') {
        const rail = b.x - b.w / 2 + 14;
        d = roundedPath([[a.x - a.w / 2, a.y], [rail, a.y], [rail, b.y - b.h / 2 - 3]]);
      } else if (e.route === 'out') {
        const rail = b.x - b.w / 2 - 11;
        d = roundedPath([[a.x, a.y + a.h / 2], [a.x, e.bar], [rail, e.bar], [rail, b.y], [b.x - b.w / 2 - 3, b.y]]);
      } else if (e.route === 'in') {
        const rail = a.x - a.w / 2 - 11;
        d = roundedPath([[a.x - a.w / 2, a.y], [rail, a.y], [rail, e.bar], [b.x, e.bar], [b.x, b.y - b.h / 2 - 3]]);
      } else {
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        if (e.curve) {
          const off = 26, nx = -dy / len * off, ny = dx / len * off;
          const cx = (a.x + b.x) / 2 + nx, cy = (a.y + b.y) / 2 + ny;
          const [sx, sy] = boxExit(a.x, a.y, a.w / 2, a.h / 2, cx - a.x, cy - a.y);
          let [ex, ey] = boxExit(b.x, b.y, b.w / 2, b.h / 2, cx - b.x, cy - b.y);
          const l2 = Math.hypot(cx - ex, cy - ey) || 1; ex += (cx - ex) / l2 * 3; ey += (cy - ey) / l2 * 3;
          d = `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`;
        } else {
          const [sx, sy] = boxExit(a.x, a.y, a.w / 2, a.h / 2, dx, dy);
          let [ex, ey] = boxExit(b.x, b.y, b.w / 2, b.h / 2, -dx, -dy);
          ex -= dx / len * 3; ey -= dy / len * 3;
          d = `M${sx},${sy} L${ex},${ey}`;
        }
      }
      e.path.setAttribute('d', d);
    }
  }

  applyHighlight() {
    const s = this.selected;
    if (this.mode !== 'web') {
      for (const item of this.els.values()) item.g.classList.remove('dim', 'in', 'out', 'sel');
      for (const e of this.edgeEls) e.path.setAttribute('class', `edge ${e.kind}`);
      for (const [key, item] of this.els) {
        if (key.startsWith('in:')) item.g.classList.add('in');
        if (key.startsWith('out:')) item.g.classList.add('out');
        if (key.startsWith('c:')) item.g.classList.add('sel');
      }
      return;
    }
    const ins = new Set(), outs = new Set();
    for (const e of this.edgeEls) {
      let cls = 'edge';
      if (s) {
        if (e.to === s) { cls += ' in'; ins.add(e.from); }
        else if (e.from === s) { cls += ' out'; outs.add(e.to); }
        else cls += ' dim';
      }
      e.path.setAttribute('class', cls);
    }
    // bring highlighted edges to the front
    if (s) this.edgeEls.filter(e => e.from === s || e.to === s).forEach(e => this.gEdges.appendChild(e.path));
    for (const [key, item] of this.els) {
      const c = item.g.classList;
      c.toggle('sel', key === s);
      c.toggle('in', !!s && ins.has(key));
      c.toggle('out', !!s && outs.has(key));
      c.toggle('dim', !!s && key !== s && !ins.has(key) && !outs.has(key));
      if (key === s) this.gNodes.appendChild(item.g);
    }
  }

  // ---------- camera ----------
  applyView() { this.vp.setAttribute('transform', `translate(${this.tx},${this.ty}) scale(${this.scale})`); }

  fit(sceneNodes) {
    const items = (sceneNodes || []).map(n => this.els.get(n.key)).filter(Boolean);
    const W = this.svg.clientWidth, H = this.svg.clientHeight - this.bottomInset - this.topInset;
    if (!W || !H) return;
    if (!items.length) { this.scale = 1; this.tx = W / 2; this.ty = this.topInset + H / 2; this.applyView(); return; }
    const tgt = new Map((sceneNodes || []).map(n => [n.key, n]));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [key, item] of this.els) {
      const p = tgt.get(key) || item;
      x0 = Math.min(x0, p.x - item.w / 2); x1 = Math.max(x1, p.x + item.w / 2);
      y0 = Math.min(y0, p.y - item.h / 2); y1 = Math.max(y1, p.y + item.h / 2);
    }
    const pad = 16;
    if (this.mode !== 'web') {
      if (this.mode === 'flow') y0 -= 20; // header pill
      // Fit the width so text stays readable; scroll/pan vertically if it's tall.
      this.scale = Math.max(0.6, Math.min(1.15, (W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0)));
      this.tx = W / 2 - ((x0 + x1) / 2) * this.scale;
      // Too wide (deep chains): line up the left edge instead of centering.
      if ((x1 - x0) * this.scale > W - pad * 2) this.tx = pad - x0 * this.scale;
      if ((y1 - y0) * this.scale <= H - pad * 2) {
        this.ty = this.topInset + H / 2 - ((y0 + y1) / 2) * this.scale;
      } else {
        // Show from the top, but never push the selected move below ~45% of the screen.
        this.ty = Math.min(this.topInset + pad - y0 * this.scale, this.topInset + H * 0.45);
      }
    } else {
      this.scale = Math.max(0.12, Math.min(1.25, (W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0)));
      this.tx = W / 2 - ((x0 + x1) / 2) * this.scale;
      this.ty = this.topInset + H / 2 - ((y0 + y1) / 2) * this.scale;
    }
    this.applyView();
  }

  centerOn(key, scale) {
    const item = this.els.get(key);
    if (!item) return;
    if (scale) this.scale = scale;
    const W = this.svg.clientWidth, H = this.svg.clientHeight - this.bottomInset - this.topInset;
    this.tx = W / 2 - item.x * this.scale;
    this.ty = this.topInset + H / 2 - item.y * this.scale;
    this.applyView();
  }

  zoomAt(factor, cx, cy) {
    const ns = Math.max(0.12, Math.min(3, this.scale * factor));
    const f = ns / this.scale;
    this.tx = cx - (cx - this.tx) * f;
    this.ty = cy - (cy - this.ty) * f;
    this.scale = ns;
    this.applyView();
  }

  // ---------- input ----------
  bindPointer() {
    const svg = this.svg;
    const pts = new Map();
    let drag = null, pinch = null;
    const local = e => { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    svg.addEventListener('pointerdown', e => {
      svg.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, local(e));
      if (pts.size === 1) {
        const g = e.target.closest('.node');
        const key = g?.getAttribute('data-key');
        const p = local(e);
        drag = { key, id: g?.getAttribute('data-id'), sx: p.x, sy: p.y, moved: false, tx: this.tx, ty: this.ty, item: key ? this.els.get(key) : null };
        if (drag.item) drag.ox = drag.item.x, drag.oy = drag.item.y;
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale, tx: this.tx, ty: this.ty, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        drag = null;
      }
    });
    svg.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, local(e));
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const ns = Math.max(0.12, Math.min(3, pinch.scale * d / pinch.d));
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        // keep the world point under the original midpoint under the current midpoint
        const wx = (pinch.mx - pinch.tx) / pinch.scale, wy = (pinch.my - pinch.ty) / pinch.scale;
        this.scale = ns; this.tx = mx - wx * ns; this.ty = my - wy * ns;
        this.applyView();
        return;
      }
      if (!drag) return;
      const p = local(e);
      const dx = p.x - drag.sx, dy = p.y - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 10) return;
      drag.moved = true;
      if (drag.item && this.mode === 'web') {
        drag.item.x = drag.ox + dx / this.scale; drag.item.y = drag.oy + dy / this.scale;
        drag.item.g.setAttribute('transform', `translate(${drag.item.x},${drag.item.y})`);
        this.drawEdges();
      } else {
        this.tx = drag.tx + dx; this.ty = drag.ty + dy;
        this.applyView();
      }
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pinch) { if (pts.size < 2) pinch = null; drag = null; return; }
      if (!drag) return;
      const d = drag; drag = null;
      if (d.moved) {
        if (d.item && this.mode === 'web') {
          this.webPos[d.key] = { x: Math.round(d.item.x), y: Math.round(d.item.y) };
          this.saveLayout(this.webPos);
        }
        return;
      }
      if (e.type === 'pointercancel') return;
      if (!d.id) { if (this.mode === 'web' && this.selected) { this.selected = null; this.applyHighlight(); this.onSelect(null); } return; }
      if (d.id === this.selected) { this.onOpen(d.id); return; }
      this.selected = d.id;
      if (this.mode !== 'web') this.rebuild({ fit: true }); else this.applyHighlight();
      this.onSelect(d.id);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const p = local(e);
      this.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
    }, { passive: false });
    // iOS Safari: stop the page from rubber-banding / gesture-zooming while on the map
    svg.addEventListener('gesturestart', e => e.preventDefault());
  }
}
