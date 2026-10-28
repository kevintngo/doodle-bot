'use strict';
// The group portrait: everyone laid out round the host, each with a ballpoint arrow and their handle, each a link to X.
(() => {
  const stage = document.getElementById('stage');
  const SVG = 'http://www.w3.org/2000/svg';
  const xUrl = (h) => 'https://x.com/' + encodeURIComponent(h);
  const GAP = 8; // px between an arrow's tip and the drawing it points at
  let nodes = [], ghost = null, postUrl = 'https://x.com/kevin_t_ngo', lastW = 0;

  // a seeded random per person, so their arrow bends the same way every visit
  const seeded = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; };

  // px per mm of drawing: big while the portrait is small, smaller as it fills up, smaller on phones
  function scaleFor(w, n) {
    const base = w < 480 ? 1.05 : w < 760 ? 1.15 : w < 1100 ? 1.3 : 1.45;
    return base * (n <= 2 ? 1.75 : n <= 6 ? 1.4 : n <= 16 ? 1.18 : 1);
  }

  function make(p, kind) {
    const a = document.createElement('a');
    a.className = 'pp' + (kind === 'host' ? ' is-host' : kind === 'ghost' ? ' is-ghost' : '');
    a.href = kind === 'ghost' ? postUrl : xUrl(p.handle);
    a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', kind === 'ghost' ? 'An empty spot: reply to the post on X to get drawn in' : `@${p.handle} on X`);
    if (kind !== 'ghost') a.dataset.handle = p.handle.toLowerCase();
    const img = new Image();
    img.className = 'pp-img'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
    img.loading = kind === 'host' ? 'eager' : 'lazy'; img.src = p.src;
    const hit = document.createElement('span'); hit.className = 'pp-hit';
    if (p.hit && p.hit.length > 2) hit.style.clipPath = `polygon(${p.hit.map(([x, y]) => `${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%`).join(',')})`;
    const tag = document.createElement('span'); tag.className = 'pp-tag';
    const name = document.createElement('span'); name.className = 'pp-name'; name.textContent = kind === 'ghost' ? 'you?' : '@' + p.handle;
    tag.append(name);
    const svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('class', 'pp-arrow'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
    const path = document.createElementNS(SVG, 'path'); svg.append(path);
    a.append(img, hit, svg, tag);
    stage.append(a);
    const rand = seeded(p.handle || 'you');
    return { p, kind, a, tag, path, jog: (rand() - 0.5) * 18, lean: rand() - 0.5, bend: (rand() - 0.5) * 0.5, box: null };
  }

  // the first point where the ray from a toward t crosses the polygon, or null
  function rayHit(a, t, poly) {
    const dx = t[0] - a[0], dy = t[1] - a[1]; let best = null;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const u = ((p[0] - a[0]) * ey - (p[1] - a[1]) * ex) / den, v = ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / den;
      if (u > 0 && v >= 0 && v <= 1 && (best === null || u < best)) best = u;
    }
    return best === null ? null : [a[0] + dx * best, a[1] + dy * best];
  }

  // a hand-drawn arrow from a toward t (in the person's own px), its tip stopping GAP short of their outline
  function arrow(n, a, t, bend) {
    const { box, p } = n, hull = (p.hit || []).map(([x, y]) => [x * box.w, y * box.h]);
    const edge = (hull.length > 2 && rayHit(a, t, hull)) || t;
    const L = Math.hypot(edge[0] - a[0], edge[1] - a[1]) || 1, ux = (edge[0] - a[0]) / L, uy = (edge[1] - a[1]) / L;
    const b = [edge[0] - ux * GAP, edge[1] - uy * GAP], len = Math.max(4, L - GAP);
    const c = [(a[0] + b[0]) / 2 - uy * bend * len, (a[1] + b[1]) / 2 + ux * bend * len];
    const ang = Math.atan2(b[1] - c[1], b[0] - c[0]), hl = Math.min(8, 3 + len * 0.18);
    const h1 = [b[0] - Math.cos(ang - 0.48) * hl, b[1] - Math.sin(ang - 0.48) * hl], h2 = [b[0] - Math.cos(ang + 0.5) * hl, b[1] - Math.sin(ang + 0.5) * hl];
    const f = (q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
    n.path.setAttribute('d', `M${f(a)} Q${f(c)} ${f(b)} M${f(h1)} L${f(b)} L${f(h2)}`);
  }

  function layout(force) {
    const W = stage.clientWidth; if (!W || (!force && W === lastW)) return; lastW = W;
    const host = nodes[0], others = nodes.slice(1), all = ghost ? others.concat([ghost]) : others;
    const narrow = W < 700, s = scaleFor(W, nodes.length + 1), gap = narrow ? 10 : 16, half = W / 2 - 8;
    const tagW = (n) => n.tag.offsetWidth || 90, tagH = Math.max(18, ...all.map((n) => n.tag.offsetHeight || 20));
    // the width a person takes in a row: their drawing or their name tag, whichever is wider, so tags never collide
    const room = (n) => Math.max(n.p.w * s * 0.8, n === host ? 0 : tagW(n)) + gap;
    const stand = (n) => n.p.h * n.p.feet[1]; // mm from the top of a drawing to its soles
    const tallest = Math.max(132, ...all.map(stand)), rowH = tallest * s + tagH + (narrow ? 30 : 40);
    const lift = Math.max(0, stand(host) - tallest + 14) * s; // extra room above the host's row for the host's height
    // how wide each row may get: phones use the whole width; wider screens keep the crowd an oval round the host
    const N = all.length + 1, avg = all.length ? all.reduce((t, n) => t + room(n), 0) / all.length : room(host);
    const perRow = Math.max(3, Math.sqrt(2.2 * N * rowH / avg)), span = Math.ceil(N / perRow) / 2;
    const cap = (r) => (narrow ? half : Math.min(half, Math.max(room(host), perRow * avg / 2 * Math.sqrt(Math.max(0.25, 1 - (r / (span + 0.8)) ** 2)))));
    // rows: the host's row first; then below and above in turn (on phones only below, so the host is at the top)
    // the host's row grows out from the host on both sides; every other row is a centred line of people
    const rows = new Map(), rowAt = (r) => { if (!rows.has(r)) rows.set(r, { r, list: [], total: 0, L: [], R: [], wl: room(host) / 2, wr: room(host) / 2 }); return rows.get(r); };
    rowAt(0);
    const add = (row, n, side) => { // put n in a row; false if it is full
      const w = room(n);
      if (row.r === 0) {
        side = side === 'L' || side === 'R' ? side : row.wr <= row.wl ? 'R' : 'L';
        const ext = (side === 'R' ? row.wr : row.wl) + w;
        if (ext > cap(0)) return false;
        (side === 'R' ? row.R : row.L).push(n); if (side === 'R') row.wr = ext; else row.wl = ext;
        return true;
      }
      if (row.list.length && row.total + w > 2 * cap(row.r)) return false;
      if (side === 'L' || (side !== 'R' && side !== 'mid' && row.list.length % 2)) row.list.unshift(n); else row.list.push(n); // fill out from the middle
      row.total += w; return true;
    };
    const order = (i) => (narrow ? i : i === 0 ? 0 : i % 2 ? (i + 1) / 2 : -i / 2);
    // people pinned with `portrait.js move` go to their row and side first (on phones, rows above the host don't exist)
    const placedIn = new Map();
    for (const n of others.filter((n) => n.p.spot && !(narrow && n.p.spot[0] < 0)).sort((a, b) => Math.abs(a.p.spot[1]) - Math.abs(b.p.spot[1]))) {
      const [r, c] = n.p.spot; if (r === 0 && c === 0) continue;
      if (add(rowAt(r), n, c > 0 ? 'R' : c < 0 ? 'L' : 'mid')) placedIn.set(n, r);
    }
    // in the order they joined, each into the first row (host's first) that still has room: a short handle can fill a gap
    for (const n of all) {
      if (placedIn.has(n)) continue;
      for (let i = 0; i < 4000; i++) { const r = order(i); if (add(rowAt(r), n)) { placedIn.set(n, r); break; } }
    }
    const base = (r) => r * rowH - (r < 0 ? lift : 0);
    const place = (n, x, r) => {
      const w = n.p.w * s, h = n.p.h * s;
      n.box = { left: x - n.p.feet[0] * w, top: base(r) - n.p.feet[1] * h, w, h, r, room: room(n) };
    };
    for (const row of rows.values()) {
      if (row.r === 0) {
        place(host, 0, 0);
        let xr = room(host) / 2, xl = -xr;
        for (const n of row.R) { place(n, xr + room(n) / 2, 0); xr += room(n); }
        for (const n of row.L) { place(n, xl - room(n) / 2, 0); xl -= room(n); }
      } else { let x = -row.total / 2; for (const n of row.list) { place(n, x + room(n) / 2, row.r); x += room(n); } }
    }
    // tags (in each person's own px), centred over the head and inside the person's own room; anything still in the
    // way of another tag goes up a step
    const placed = [], abs = (n) => ({ x: n.box.left + n.tagAt.x, y: n.box.top + n.tagAt.y, w: n.tagAt.w, h: n.tagAt.h });
    const hits = (r) => placed.some((q) => r.x < q.x + q.w + 6 && q.x < r.x + r.w + 6 && r.y < q.y + q.h + 4 && q.y < r.y + r.h + 4);
    { const b = host.box, tw = host.tag.offsetWidth || 160, th = host.tag.offsetHeight || 28, cx = b.w * host.p.head[0];
      host.tagAt = { x: cx - tw / 2 - 10 * s, y: -th - 12, w: tw, h: th }; // centred over the host, a little to the left of the straw
      host.aim = [cx - 6 * s, b.h * host.p.head[1]];
      placed.push(abs(host)); }
    for (const n of all.slice().sort((a, b) => a.box.r - b.box.r || a.box.left - b.box.left)) {
      const b = n.box, tw = n.tag.offsetWidth || 90, th = n.tag.offsetHeight || 20, slack = Math.max(0, (b.room - gap - tw) / 2);
      n.tagAt = { x: b.w * n.p.head[0] + Math.max(-slack, Math.min(slack, n.jog)) - tw / 2, y: -12 - th, w: tw, h: th };
      const sx = W / 2 + b.left + n.tagAt.x; // keep the whole tag on the screen
      if (sx < 6) n.tagAt.x += 6 - sx; else if (sx + tw > W - 6) n.tagAt.x -= sx + tw - (W - 6);
      for (let step = 0; step < 3 && hits(abs(n)); step++) n.tagAt.y -= th + 6;
      n.aim = [b.w * n.p.head[0], b.h * n.p.head[1]];
      placed.push(abs(n));
    }
    // where it all goes on the stage: x = 0 is the middle; the highest tag sits a little below the stage's top
    let minY = Infinity, maxY = -Infinity;
    for (const n of [host, ...all]) { const b = n.box; minY = Math.min(minY, b.top + n.tagAt.y); maxY = Math.max(maxY, b.top + b.h); }
    const ox = W / 2, oy = 24 - minY;
    for (const n of [host, ...all]) {
      const b = n.box, st = n.a.style, t = n.tagAt;
      st.left = (ox + b.left).toFixed(1) + 'px'; st.top = (oy + b.top).toFixed(1) + 'px'; st.width = b.w.toFixed(1) + 'px'; st.height = b.h.toFixed(1) + 'px';
      st.zIndex = String(10 + b.r * 2);
      n.tag.style.left = t.x.toFixed(1) + 'px'; n.tag.style.top = t.y.toFixed(1) + 'px';
      const from = [t.x + t.w / 2 + n.lean * Math.min(t.w * 0.3, 14), t.y + t.h + 2];
      arrow(n, from, n.aim, n === host ? 0.16 : n.bend);
    }
    stage.style.height = Math.ceil(maxY - minY + 48) + 'px';
  }

  function show(handle, opts = {}) {
    const h = String(handle || '').replace(/^@/, '').trim().toLowerCase(), n = h && nodes.find((x) => x.p.handle.toLowerCase() === h);
    if (!n) return false;
    for (const x of stage.querySelectorAll('.is-found')) x.classList.remove('is-found');
    n.a.classList.add('is-found'); setTimeout(() => n.a.classList.remove('is-found'), 4200);
    n.a.scrollIntoView({ block: 'center', behavior: opts.instant ? 'auto' : 'smooth' });
    n.a.focus({ preventScroll: true });
    return true;
  }

  function words(data) {
    const count = data.people.length;
    document.querySelector('.count-n').textContent = String(count);
    document.querySelector('.count-w').textContent = count === 1 ? 'person' : 'people';
    for (const a of document.querySelectorAll('.cta-post')) a.href = postUrl;
    if (data.bot) for (const el of document.querySelectorAll('.bot-name')) { const a = document.createElement('a'); a.href = xUrl(data.bot); a.textContent = '@' + data.bot; a.rel = 'noopener'; el.replaceChildren(a); }
  }

  function wireFind() {
    const form = document.querySelector('.find'), q = form.querySelector('input'), msg = form.querySelector('.find-msg');
    form.addEventListener('submit', (e) => {
      e.preventDefault(); msg.textContent = '';
      const h = q.value.replace(/^@/, '').trim(); if (!h) return;
      if (!show(h)) { msg.textContent = ''; const a = document.createElement('a'); a.href = postUrl; a.textContent = 'reply to the post'; msg.append(`@${h} isn't drawn yet: `, a); }
      else history.replaceState(null, '', '#' + h.toLowerCase());
    });
  }

  async function start() {
    let data;
    try { data = await (await fetch('people.json', { cache: 'no-cache' })).json(); } catch { stage.textContent = 'The portrait could not load. Try again in a moment.'; return; }
    if (data.post) postUrl = data.post;
    const people = data.people.slice().sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0));
    nodes = people.map((p, i) => make(p, i === 0 ? 'host' : 'person'));
    try { const g = await (await fetch('art/ghost.json')).json(); ghost = make({ ...g, handle: '' }, 'ghost'); } catch { ghost = null; }
    words(data); wireFind();
    layout(true);
    const target = decodeURIComponent(location.hash.slice(1));
    // on a wide screen a big crowd opens on the host in the middle of it; phones (host at the top) and small crowds open at the title
    if (!(target && show(target, { instant: true })) && nodes.length > 24 && stage.clientWidth >= 700) nodes[0].a.scrollIntoView({ block: 'center' });
    document.fonts && document.fonts.ready.then(() => layout(true));
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => layout(), 120); });
    addEventListener('hashchange', () => show(decodeURIComponent(location.hash.slice(1))));
  }
  start();
})();
