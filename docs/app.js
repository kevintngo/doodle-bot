'use strict';
// The group portrait: everyone laid out round the host, each with a ballpoint arrow and their handle, each a link to X.
// Two looks: everyday clothes, and Halloween (people in the costume they asked for, doodles in the clear spaces).
(() => {
  const stage = document.getElementById('stage'), root = document.documentElement;
  const SVG = 'http://www.w3.org/2000/svg';
  const xUrl = (h) => 'https://x.com/' + encodeURIComponent(h);
  const GAP = 8; // px between an arrow's tip and the drawing it points at
  const LOOKS = ['halloween', 'everyday'];
  let nodes = [], ghost = null, ghostLooks = {}, postUrl = 'https://x.com/kevin_t_ngo', posts = {}, lastW = 0;
  let look = LOOKS.includes(root.dataset.theme) ? root.dataset.theme : 'halloween', openLook = 'halloween', deco = null, placed = null, decoLayer = null;

  // a seeded random per person, so their arrow bends the same way every visit
  const seeded = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; };
  // what someone looks like in the current look: their costume if they have one, else their everyday drawing
  const lookOf = (p) => (look !== 'everyday' && p.themes && p.themes[look]) || p;
  const postFor = (l) => (l === 'everyday' ? postUrl : posts[l] || 'https://x.com/kevin_t_ngo'); // until the Halloween post is set, Kevin's profile, where it will be

  // px per mm of drawing: big while the portrait is small, smaller as it fills up, smaller on phones
  function scaleFor(w, n) {
    const base = w < 480 ? 1.05 : w < 760 ? 1.15 : w < 1100 ? 1.3 : 1.45;
    return base * (n <= 2 ? 1.75 : n <= 6 ? 1.4 : n <= 16 ? 1.18 : 1);
  }

  function make(p, kind) {
    const a = document.createElement('a');
    a.className = 'pp' + (kind === 'host' ? ' is-host' : kind === 'ghost' ? ' is-ghost' : '');
    a.target = '_blank'; a.rel = 'noopener';
    if (kind !== 'ghost') { a.href = xUrl(p.handle); a.dataset.handle = p.handle.toLowerCase(); }
    const img = new Image();
    img.className = 'pp-img'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
    img.loading = kind === 'host' ? 'eager' : 'lazy';
    const hit = document.createElement('span'); hit.className = 'pp-hit';
    const tag = document.createElement('span'); tag.className = 'pp-tag';
    const name = document.createElement('span'); name.className = 'pp-name'; name.textContent = kind === 'ghost' ? 'you?' : '@' + p.handle;
    const as = document.createElement('span'); as.className = 'pp-as';
    tag.append(as, name);
    const svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('class', 'pp-arrow'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
    const path = document.createElementNS(SVG, 'path'); svg.append(path);
    a.append(img, hit, svg, tag);
    stage.append(a);
    const rand = seeded(p.handle || 'you');
    const n = { p, kind, a, img, hit, tag, as, path, g: null, jog: (rand() - 0.5) * 18, lean: rand() - 0.5, bend: (rand() - 0.5) * 0.5, box: null };
    dress(n);
    return n;
  }
  // put the drawing for the current look on someone (or on the empty spot)
  function dress(n) {
    const g = n.kind === 'ghost' ? ghostLooks[look] || ghostLooks.everyday : lookOf(n.p);
    if (g === n.g) return; n.g = g;
    n.img.src = g.src;
    n.hit.style.clipPath = g.hit && g.hit.length > 2 ? `polygon(${g.hit.map(([x, y]) => `${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%`).join(',')})` : '';
    const costume = n.kind !== 'ghost' && g !== n.p && g.as;
    n.as.textContent = costume ? 'as ' + g.as : '';
    n.a.classList.toggle('in-costume', !!costume);
    if (n.kind === 'ghost') { n.a.href = postFor(look); n.a.setAttribute('aria-label', look === 'halloween' ? 'An empty spot: reply to the Halloween post on X with your costume' : 'An empty spot: reply to the post on X to get drawn in'); }
    else n.a.setAttribute('aria-label', `@${n.p.handle} on X${costume ? `, dressed as ${g.as}` : ''}`);
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
    const { box, g } = n, hull = (g.hit || []).map(([x, y]) => [x * box.w, y * box.h]);
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
    const narrow = W < 700, s = scaleFor(W, nodes.length + 1), gap = narrow ? 10 : 16, half = W / 2 - 8, pad = narrow ? 30 : 40;
    const tagW = (n) => n.tag.offsetWidth || 90, tagH = Math.max(18, ...all.map((n) => n.tag.offsetHeight || 20));
    // the width a person takes in a row: their drawing or their name tag, whichever is wider, so tags never collide
    const room = (n) => Math.max(n.g.w * s * 0.8, n === host ? 0 : tagW(n)) + gap;
    const stand = (n) => n.g.h * n.g.feet[1]; // mm from the top of a drawing to its soles
    const tallest = Math.max(132, ...all.map(stand)), rowH = tallest * s + tagH + pad;
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
    // each row is as tall as its tallest member (a witch's hat needs more room than a cap), so one tall costume doesn't spread out everyone
    const members = (row) => (row.r === 0 ? row.L.concat(row.R) : row.list);
    const need = (r) => { const row = rows.get(r), t = Math.max(132, ...(row ? members(row) : []).map(stand)) * s + tagH + pad; return r === 0 ? Math.max(t, (stand(host) + 14) * s + tagH + pad) : t; };
    const rs = [...rows.keys()], baseAt = new Map([[0, 0]]);
    for (let r = 1; r <= Math.max(0, ...rs); r++) baseAt.set(r, baseAt.get(r - 1) + need(r));
    for (let r = -1; r >= Math.min(0, ...rs); r--) baseAt.set(r, baseAt.get(r + 1) - need(r + 1));
    const base = (r) => baseAt.get(r);
    const place = (n, x, r) => {
      const w = n.g.w * s, h = n.g.h * s;
      n.box = { left: x - n.g.feet[0] * w, top: base(r) - n.g.feet[1] * h, w, h, r, room: room(n) };
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
    const tags = [], abs = (n) => ({ x: n.box.left + n.tagAt.x, y: n.box.top + n.tagAt.y, w: n.tagAt.w, h: n.tagAt.h });
    const hits = (r) => tags.some((q) => r.x < q.x + q.w + 6 && q.x < r.x + r.w + 6 && r.y < q.y + q.h + 4 && q.y < r.y + r.h + 4);
    { const b = host.box, tw = host.tag.offsetWidth || 160, th = host.tag.offsetHeight || 28, cx = b.w * host.g.head[0];
      host.tagAt = { x: cx - tw / 2 - 10 * s, y: -th - 12, w: tw, h: th }; // centred over the host, a little to the left of the straw
      host.aim = [cx - 6 * s, b.h * host.g.head[1]];
      tags.push(abs(host)); }
    for (const n of all.slice().sort((a, b) => a.box.r - b.box.r || a.box.left - b.box.left)) {
      const b = n.box, tw = n.tag.offsetWidth || 90, th = n.tag.offsetHeight || 20, slack = Math.max(0, (b.room - gap - tw) / 2);
      n.tagAt = { x: b.w * n.g.head[0] + Math.max(-slack, Math.min(slack, n.jog)) - tw / 2, y: -12 - th, w: tw, h: th };
      const sx = W / 2 + b.left + n.tagAt.x; // keep the whole tag on the screen
      if (sx < 6) n.tagAt.x += 6 - sx; else if (sx + tw > W - 6) n.tagAt.x -= sx + tw - (W - 6);
      for (let step = 0; step < 3 && hits(abs(n)); step++) n.tagAt.y -= th + 6;
      n.aim = [b.w * n.g.head[0], b.h * n.g.head[1]];
      tags.push(abs(n));
    }
    // where it all goes on the stage: x = 0 is the middle; the highest tag sits a little below the stage's top
    let minY = Infinity, maxY = -Infinity;
    for (const n of [host, ...all]) { const b = n.box; minY = Math.min(minY, b.top + n.tagAt.y); maxY = Math.max(maxY, b.top + b.h); }
    const ox = W / 2, oy = 24 - minY, H = Math.ceil(maxY - minY + 48);
    for (const n of [host, ...all]) {
      const b = n.box, st = n.a.style, t = n.tagAt;
      st.left = (ox + b.left).toFixed(1) + 'px'; st.top = (oy + b.top).toFixed(1) + 'px'; st.width = b.w.toFixed(1) + 'px'; st.height = b.h.toFixed(1) + 'px';
      st.zIndex = String(10 + b.r * 2);
      n.tag.style.left = t.x.toFixed(1) + 'px'; n.tag.style.top = t.y.toFixed(1) + 'px';
      const from = [t.x + t.w / 2 + n.lean * Math.min(t.w * 0.3, 14), t.y + t.h + 2];
      arrow(n, from, n.aim, n === host ? 0.16 : n.bend);
    }
    stage.style.height = H + 'px';
    // what is taken, in stage px, for the doodles to stay out of: each drawing's outline box, its tag, and its arrow
    const busy = [];
    for (const n of [host, ...all]) {
      const b = n.box, X = ox + b.left, Y = oy + b.top, hull = n.g.hit && n.g.hit.length > 2 ? n.g.hit : [[0, 0], [1, 1]];
      const xs = hull.map((q) => q[0]), ys = hull.map((q) => q[1]);
      busy.push({ x: X + Math.min(...xs) * b.w, y: Y + Math.min(...ys) * b.h, w: (Math.max(...xs) - Math.min(...xs)) * b.w, h: (Math.max(...ys) - Math.min(...ys)) * b.h });
      const t = n.tagAt; busy.push({ x: X + t.x - 4, y: Y + t.y - 4, w: t.w + 8, h: t.h + 8 });
      const ax = [X + t.x + t.w / 2, X + n.aim[0]]; busy.push({ x: Math.min(...ax) - 8, y: Y + t.y + t.h, w: Math.abs(ax[1] - ax[0]) + 16, h: Math.max(0, n.aim[1] - t.y - t.h) });
    }
    const rowsAt = [...rows.values()].map((row) => { const list = row.r === 0 ? [host, ...members(row)] : members(row); if (!list.length) return null;
      return { y: oy + base(row.r), x0: ox + Math.min(...list.map((n) => n.box.left + n.box.w * 0.1)), x1: ox + Math.max(...list.map((n) => n.box.left + n.box.w * 0.9)) }; }).filter(Boolean);
    placed = { W, H, s, busy, rows: rowsAt };
    decorate();
  }

  // Halloween doodles, only where nothing else is: pumpkins and a cat on the ground at the ends of rows, bats, ghosts and
  // stars in the air. Seeded, so the same screen gets the same doodles.
  function decorate() {
    if (decoLayer) { decoLayer.remove(); decoLayer = null; }
    if (look !== 'halloween' || !deco || !placed) return;
    const { W, H, busy: taken, rows } = placed, s = placed.s, busy = taken.slice(), rand = seeded('halloween:' + Math.round(W / 40) + ':' + nodes.length);
    const layer = document.createElement('div'); layer.className = 'deco-layer'; layer.setAttribute('aria-hidden', 'true');
    const clear = (r, pad) => r.x >= 6 && r.x + r.w <= W - 6 && r.y >= 4 && r.y + r.h <= H - 4 && !busy.some((q) => r.x < q.x + q.w + pad && q.x < r.x + r.w + pad && r.y < q.y + q.h + pad && q.y < r.y + r.h + pad);
    const put = (name, x, y, k, cls) => {
      const m = deco[name], w = m.w * s * k, h = m.h * s * k, im = new Image();
      im.src = m.src; im.alt = ''; im.decoding = 'async'; im.className = 'deco deco-' + cls;
      im.style.left = x.toFixed(1) + 'px'; im.style.top = y.toFixed(1) + 'px'; im.style.width = w.toFixed(1) + 'px';
      im.style.animationDelay = (-rand() * 6).toFixed(2) + 's';
      layer.append(im); busy.push({ x, y, w, h });
    };
    const ground = ['pumpkin-grin', 'pumpkin-round', 'pumpkin-plain', 'cat', 'pumpkin-grin', 'candy-corn', 'sweet'];
    rows.forEach((row, i) => { for (const side of [-1, 1]) {
      const name = ground[Math.floor(rand() * ground.length)], k = 0.9 + rand() * 0.25, w = deco[name].w * s * k, h = deco[name].h * s * k;
      const x = side < 0 ? row.x0 - 12 - w - rand() * 16 : row.x1 + 12 + rand() * 16, y = row.y - h + 3;
      if (clear({ x, y, w, h }, 6)) put(name, x, y, k, 'ground');
    } });
    const air = ['bat-up', 'ghost', 'star', 'bat-down', 'star', 'bat-up', 'ghost', 'star'];
    const want = Math.round(Math.min(18, Math.max(3, W * H / 95000)));
    for (let tries = 0, got = 0; tries < want * 40 && got < want; tries++) {
      const name = air[got % air.length], k = 0.8 + rand() * 0.5, w = deco[name].w * s * k, h = deco[name].h * s * k;
      const x = 6 + rand() * (W - 12 - w), y = 4 + rand() * (H - 8 - h);
      if (clear({ x, y, w, h }, 16)) { put(name, x, y, k, name.startsWith('bat') ? 'bat' : name); got++; }
    }
    stage.append(layer);
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
    const count = data.people.length, dressed = data.people.filter((p) => p.themes && p.themes.halloween).length;
    document.querySelector('.count-n').textContent = String(count);
    document.querySelector('.count-w').textContent = count === 1 ? 'person' : 'people';
    const sub = document.querySelector('[data-sub="halloween"]'); if (sub) sub.textContent = dressed ? `${dressed} in costume` : 'costumes';
    for (const a of document.querySelectorAll('.cta-post')) a.href = postUrl;
    for (const a of document.querySelectorAll('.cta-halloween')) a.href = postFor('halloween');
    if (data.bot) for (const el of document.querySelectorAll('.bot-name')) { const a = document.createElement('a'); a.href = xUrl(data.bot); a.textContent = '@' + data.bot; a.rel = 'noopener'; el.replaceChildren(a); }
  }

  // ---------------------------------------------------------------- the two looks
  function setLook(next, o = {}) {
    if (!LOOKS.includes(next)) return;
    look = next; root.dataset.theme = next;
    for (const b of document.querySelectorAll('.look')) b.setAttribute('aria-pressed', String(b.dataset.theme === next));
    if (o.url !== false) { const u = new URL(location.href); if (next === openLook) u.searchParams.delete('theme'); else u.searchParams.set('theme', next); history.replaceState(null, '', u.pathname + u.search + u.hash); }
    if (!nodes.length) return;
    for (const n of nodes) dress(n); if (ghost) dress(ghost);
    layout(true);
  }
  function wireLooks() {
    for (const b of document.querySelectorAll('.look')) b.addEventListener('click', () => { if (b.dataset.theme !== look) setLook(b.dataset.theme); });
  }

  // ---------------------------------------------------------------- find someone: suggestions as you type
  function wireFind() {
    const form = document.querySelector('.find'), q = document.getElementById('find-q'), list = document.getElementById('find-list');
    const msg = form.querySelector('.find-msg'), live = document.getElementById('find-live');
    let opts = [], active = -1, said = 0;
    const norm = (v) => v.replace(/^@+/, '').trim().toLowerCase();
    // best first: the whole handle, then the start of it, then the start of a part (after _ or a digit), then anywhere, then letters in order
    function score(h, k) {
      const x = h.toLowerCase(), i = x.indexOf(k);
      if (x === k) return [0, 0]; if (i === 0) return [1, 0]; if (i > 0 && /[_\d]/.test(x[i - 1])) return [2, i]; if (i > 0) return [3, i];
      const at = []; let j = 0; for (let c = 0; c < x.length && j < k.length; c++) if (x[c] === k[j]) { at.push(c); j++; }
      return j === k.length && k.length > 1 ? [4, at[at.length - 1] - at[0], at] : null;
    }
    function find(k) {
      return nodes.map((n) => ({ n, sc: score(n.p.handle, k) })).filter((m) => m.sc)
        .sort((a, b) => a.sc[0] - b.sc[0] || a.sc[1] - b.sc[1] || a.n.p.handle.length - b.n.p.handle.length || a.n.p.handle.localeCompare(b.n.p.handle)).slice(0, 8);
    }
    function marked(h, k, sc) { // the handle with the part that matched picked out
      const frag = document.createDocumentFragment(), lower = h.toLowerCase(), hits = new Set();
      if (sc[0] < 4) { const i = lower.indexOf(k); for (let c = i; c < i + k.length; c++) hits.add(c); } else for (const c of sc[2]) hits.add(c);
      frag.append('@');
      let run = '', on = false;
      const flush = () => { if (!run) return; if (on) { const m = document.createElement('mark'); m.textContent = run; frag.append(m); } else frag.append(run); run = ''; };
      for (let c = 0; c < h.length; c++) { const hit = hits.has(c); if (hit !== on) { flush(); on = hit; } run += h[c]; }
      flush(); return frag;
    }
    function face(n) { // their head, cut from their drawing for this look
      const g = lookOf(n.p), el = document.createElement('span'), box = 40, mm = n.p.host ? 54 : 50, k = box / mm;
      const fx = g.face[0], fy = g.face[1] === g.head[1] ? Math.min(0.9, g.head[1] + 18 / g.h) : g.face[1];
      el.className = 'find-face'; el.setAttribute('aria-hidden', 'true');
      el.style.backgroundImage = `url("${g.src}")`; el.style.backgroundSize = `${(g.w * k).toFixed(1)}px auto`;
      el.style.backgroundPosition = `${(box / 2 - fx * g.w * k).toFixed(1)}px ${(box / 2 - fy * g.h * k + 3).toFixed(1)}px`;
      return el;
    }
    function render(k) {
      list.replaceChildren(); active = -1; q.removeAttribute('aria-activedescendant');
      opts.forEach((m, i) => {
        const li = document.createElement('li'), g = lookOf(m.n.p), words = document.createElement('span'), name = document.createElement('span');
        li.id = 'find-o' + i; li.className = 'find-opt'; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false'); li.dataset.i = String(i);
        words.className = 'find-words'; name.className = 'find-name'; name.append(marked(m.n.p.handle, k, m.sc));
        words.append(name);
        const note = m.n.p.host ? 'in the middle' : look === 'halloween' ? (g !== m.n.p && g.as ? 'as ' + g.as : 'no costume yet') : '';
        if (note) { const sub = document.createElement('span'); sub.className = 'find-note' + (look === 'halloween' && g === m.n.p && !m.n.p.host ? ' is-plain' : ''); sub.textContent = note; words.append(sub); }
        li.append(face(m.n), words); list.append(li);
      });
      const open = opts.length > 0;
      list.hidden = !open; q.setAttribute('aria-expanded', String(open));
      const say = ++said, count = opts.length; setTimeout(() => { if (say === said) live.textContent = count ? `${count} ${count === 1 ? 'match' : 'matches'}, use the arrow keys to pick` : `No one called @${k} yet`; }, 500);
    }
    function close() { said++; opts = []; active = -1; list.hidden = true; list.replaceChildren(); q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); }
    function setActive(i) {
      active = i;
      list.querySelectorAll('[role="option"]').forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      const li = i >= 0 && document.getElementById('find-o' + i);
      if (li) { q.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); } else q.removeAttribute('aria-activedescendant');
    }
    function choose(n) {
      q.value = n.p.handle; close(); msg.textContent = '';
      show(n.p.handle); history.replaceState(null, '', location.pathname + location.search + '#' + n.p.handle.toLowerCase());
    }
    function notDrawn(h) {
      msg.textContent = ''; const a = document.createElement('a');
      a.href = postFor(look); a.textContent = look === 'halloween' ? 'reply to the Halloween post' : 'reply to the post';
      msg.append(`@${h} isn't drawn yet: `, a);
    }
    q.addEventListener('input', () => { msg.textContent = ''; const k = norm(q.value); if (!k) { close(); return; } opts = find(k); render(k); });
    q.addEventListener('focus', () => { const k = norm(q.value); if (k && list.hidden) { opts = find(k); render(k); } });
    q.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== q) close(); }, 150));
    q.addEventListener('keydown', (e) => {
      const open = !list.hidden && opts.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) { const k = norm(q.value); if (!k) return; opts = find(k); render(k); if (!opts.length) return; setActive(e.key === 'ArrowDown' ? 0 : opts.length - 1); return; }
        setActive(e.key === 'ArrowDown' ? (active + 1) % opts.length : active <= 0 ? opts.length - 1 : active - 1);
      } else if (e.key === 'Enter' && open && active >= 0) { e.preventDefault(); choose(opts[active].n); }
      else if (e.key === 'Escape') { if (open) { e.preventDefault(); close(); } else if (q.value) { e.preventDefault(); q.value = ''; msg.textContent = ''; } }
      else if (e.key === 'Tab') close();
    });
    list.addEventListener('pointerdown', (e) => e.preventDefault()); // keep the focus in the field while picking
    list.addEventListener('click', (e) => { const li = e.target.closest('[role="option"]'); if (li && opts[+li.dataset.i]) choose(opts[+li.dataset.i].n); });
    list.addEventListener('pointermove', (e) => { const li = e.target.closest('[role="option"]'); if (li && +li.dataset.i !== active) setActive(+li.dataset.i); });
    document.addEventListener('pointerdown', (e) => { if (!form.contains(e.target)) close(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault(); const k = norm(q.value); if (!k) return;
      const exact = nodes.find((n) => n.p.handle.toLowerCase() === k), best = exact || (opts[active] || opts[0] || {}).n || (find(k)[0] || {}).n;
      if (best) choose(best); else { close(); notDrawn(k); }
    });
  }

  async function start() {
    let data;
    try { data = await (await fetch('people.json', { cache: 'no-cache' })).json(); } catch { stage.textContent = 'The portrait could not load. Try again in a moment.'; return; }
    if (data.post) postUrl = data.post;
    posts = Object.fromEntries(Object.entries(data.themes || {}).map(([k, v]) => [k, v && v.post]).filter(([, v]) => v));
    openLook = LOOKS.includes(data.theme) ? data.theme : 'halloween';
    const asked = new URLSearchParams(location.search).get('theme');
    setLook(LOOKS.includes(asked) ? asked : openLook, { url: false });
    wireLooks();
    const people = data.people.slice().sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0));
    try { const [g, gh, art] = await Promise.all(['art/ghost.json', 'art/ghost-halloween.json', 'art/halloween/art.json'].map((u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
      if (g) ghostLooks.everyday = g; if (gh) ghostLooks.halloween = gh; deco = art; } catch {}
    nodes = people.map((p, i) => make(p, i === 0 ? 'host' : 'person'));
    ghost = ghostLooks.everyday ? make({ handle: '' }, 'ghost') : null;
    words(data); wireFind();
    layout(true);
    // the page opens at the title and the looks (or on whoever the link is for)
    const target = decodeURIComponent(location.hash.slice(1));
    if (target) show(target, { instant: true });
    document.fonts && document.fonts.ready.then(() => layout(true));
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => layout(), 120); });
    addEventListener('hashchange', () => show(decodeURIComponent(location.hash.slice(1))));
  }
  start();
})();
