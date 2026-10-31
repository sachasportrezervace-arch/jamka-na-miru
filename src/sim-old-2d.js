// Jamka na míru – deterministická simulace minigolfu (pohled shora).
// Jen +, -, *, /, Math.sqrt, Math.floor a Math.imul: stejné vstupy dají v Chromiu i WebKitu bit po bitu stejný výsledek.
// Žádné Math.sin/cos/atan2/hypot (ty se mezi enginy smějí lišit v posledních bitech).
(function (root) {
  "use strict";
  const PI = 3.141592653589793, TAU = 2 * PI;

  // ---------- deterministická trigonometrie ----------
  function dsin(x) {
    x = x - TAU * Math.floor((x + PI) / TAU);          // do [-π, π)
    if (x > PI / 2) x = PI - x; else if (x < -PI / 2) x = -PI - x;
    const q = x * x;
    return x * (1 - q / 6 * (1 - q / 20 * (1 - q / 42 * (1 - q / 72 * (1 - q / 110 * (1 - q / 156))))));
  }
  const dcos = x => dsin(x + PI / 2);
  const ANG_STEPS = 4096;                                // úhel úderu v 1/4096 otáčky
  const angOf = A => A * TAU / ANG_STEPS;

  // ---------- seed ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- konstanty ----------
  const BALL_R = 8, CUP_R = 13, VMAX = 12, TICK_LIMIT = 2600, MAX_STROKES = 6;
  const BASE_DEC = 0.022, DRAG = 0.006, WALL_E = 0.78;

  // ---------- tratě (souřadnice v px světa; odpaliště dole, jamka nahoře) ----------
  function chamfer(poly, c) {
    const out = [], n = poly.length;
    for (let i = 0; i < n; i++) {
      const p = poly[(i + n - 1) % n], q = poly[i], r = poly[(i + 1) % n];
      const l1 = Math.sqrt((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2), l2 = Math.sqrt((r[0] - q[0]) ** 2 + (r[1] - q[1]) ** 2);
      const k = Math.min(c, l1 / 2.5, l2 / 2.5);
      out.push([q[0] + (p[0] - q[0]) * k / l1, q[1] + (p[1] - q[1]) * k / l1], [q[0] + (r[0] - q[0]) * k / l2, q[1] + (r[1] - q[1]) * k / l2]);
    }
    return out;
  }
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  function octo(cx, cy, R) { const p = []; for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * TAU / 10 + PI / 10; p.push([cx + R * dcos(a), cy + R * dsin(a)]); } return p; }

  const LAYOUTS = [
    { name: "Ostrůvek", poly: chamfer(rect(60, 40, 360, 1000), 40), blocks: [chamfer(rect(165, 420, 255, 600), 22)], bumps: [{ x: 210, y: 250, r: 18 }], tee: [210, 920], cup: [210, 110] },
    { name: "Klika", poly: chamfer([[40, 1000], [270, 1000], [270, 330], [640, 330], [640, 50], [40, 50]], 46), blocks: [], bumps: [{ x: 280, y: 320, r: 20 }, { x: 450, y: 190, r: 16 }], tee: [155, 925], cup: [560, 175] },
    { name: "Esíčko", poly: chamfer(rect(40, 40, 480, 1000), 40), blocks: [chamfer(rect(40, 640, 330, 676), 14), chamfer(rect(190, 330, 480, 366), 14)], bumps: [], tee: [130, 925], cup: [370, 130] },
    { name: "Trychtýř", poly: chamfer([[20, 1000], [460, 1000], [460, 720], [310, 420], [310, 40], [170, 40], [170, 420], [20, 720]], 30), blocks: [], bumps: [{ x: 140, y: 800, r: 17 }, { x: 340, y: 800, r: 17 }, { x: 240, y: 660, r: 22 }], tee: [240, 930], cup: [240, 110] },
    { name: "Kuličky", poly: chamfer(rect(40, 40, 440, 960), 50), blocks: [], bumps: [{ x: 140, y: 720, r: 22 }, { x: 340, y: 610, r: 22 }, { x: 150, y: 430, r: 22 }, { x: 330, y: 300, r: 22 }, { x: 240, y: 520, r: 16 }], tee: [240, 890], cup: [240, 115] },
    { name: "Schod", poly: chamfer([[300, 1000], [530, 1000], [530, 350], [270, 350], [270, 40], [40, 40], [40, 570], [300, 570]], 40), blocks: [], bumps: [{ x: 300, y: 460, r: 16 }], tee: [415, 930], cup: [155, 115] },
    { name: "Rozcestí", poly: chamfer(rect(40, 40, 500, 1000), 46), blocks: [chamfer(rect(215, 280, 325, 760), 30)], bumps: [{ x: 120, y: 520, r: 18 }], tee: [270, 925], cup: [270, 130] },
    { name: "Kapka", poly: null, blocks: [], bumps: [{ x: 260, y: 330, r: 30 }], tee: [260, 940], cup: [260, 150] },
  ];
  // Kapka: úzký koridor do kulatého greenu (desetiúhelník); spodní dva body kruhu vynecháme, navazuje koridor
  (function () {
    const cx = 260, cy = 300, R = 240, ring = [];
    for (let i = 1; i < 9; i++) { const a = PI / 2 + PI / 10 + i * TAU / 10; ring.push([cx + R * dcos(a), cy + R * dsin(a)]); }
    LAYOUTS[7].poly = chamfer([[200, 1000], [200, 520], ...ring, [320, 520], [320, 1000]], 22);
  })();

  function mirrorLayout(L, W) {
    const mx = p => [W - p[0], p[1]];
    return { name: L.name, poly: L.poly.map(mx).reverse(), blocks: L.blocks.map(b => b.map(mx).reverse()), bumps: L.bumps.map(b => ({ ...b, x: W - b.x })), tee: mx(L.tee), cup: mx(L.cup) };
  }
  function bbox(poly) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of poly) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  // ---------- témata, modifikátory, pasti ----------
  const THEMES = ["zahrada", "plaz", "obyvak"];
  const THEME_NAMES = { zahrada: "Zahrádka", plaz: "Pláž", obyvak: "Obývák" };
  const MODS = {
    klid: { name: "Klidná jamka", desc: "Nic zvláštního. Zatím." },
    led: { name: "Náledí", desc: "Míček klouže skoro bez brzdění." },
    vitr: { name: "Vítr", desc: "Celou dráhou fouká stálý vítr." },
    velka: { name: "Velká jamka", desc: "Jamka je o půlku větší." },
    guma: { name: "Gumové mantinely", desc: "Mantinely odrážejí bez ztráty rychlosti." },
    mala: { name: "Malá jamka", desc: "Jamka je menší a míček musí přijet pomalu." },
  };
  const TRAPS = {
    mlyn: { name: "Mlýnek", desc: "Točí se a odpálí, co mu vleze do lopatek.", r: 50, rot: false, clear: 46 },
    louze: { name: "Louže", desc: "Míček v ní skoro zastaví.", r: 54, rot: false, clear: 0 },
    stena: { name: "Pérovačka", desc: "Stěna, která odrazí víc, než přiletělo.", r: 50, rot: true, clear: 10 },
    kopec: { name: "Kopeček", desc: "Míček z něj sjede do strany.", r: 64, rot: false, clear: 0 },
    jezirko: { name: "Jezírko", desc: "Žbluňk: zpátky na místo úderu a trestná rána.", r: 42, rot: false, clear: 0 },
    fukar: { name: "Fukar", desc: "Pruh větru, který tlačí jedním směrem.", r: 60, rot: true, clear: 0 },
  };
  const TRAP_KINDS = Object.keys(TRAPS);
  const ROT_STEPS = 16;                                    // natočení pasti v 1/16 otáčky

  // Plán celé hry ze seedu: 6 jamek, každá s tématem, tratí, zrcadlením a modifikátorem
  function plan(seed) {
    const r = rng(seed);
    const themes = [...shuffle(THEMES, r), ...shuffle(THEMES, r)];
    for (let i = 3; i < 6; i++) if (themes[i] === themes[i - 1]) { const j = i === 5 ? 3 : i + 1; [themes[i], themes[j]] = [themes[j], themes[i]]; }
    const lays = shuffle([0, 1, 2, 3, 4, 5, 6, 7], r).slice(0, 6);
    const modKeys = ["led", "vitr", "velka", "guma", "mala"];
    const mods = ["klid"];
    for (let i = 1; i < 6; i++) { let m; do m = r() < 0.18 ? "klid" : modKeys[Math.floor(r() * modKeys.length)]; while (m === mods[i - 1]); mods.push(m); }
    return lays.map((li, i) => ({ th: themes[i], lay: li, mir: r() < 0.5 ? 1 : 0, mod: mods[i], wind: Math.floor(r() * 16) }));
  }
  const courseCache = new Map();
  function course(hp) {
    const key = hp.lay + ":" + hp.mir;
    if (!courseCache.has(key)) {
      const L0 = LAYOUTS[hp.lay], bb0 = bbox(L0.poly);
      const L = hp.mir ? mirrorLayout(L0, bb0.x0 + bb0.x1) : L0;
      const segs = [];
      const addPoly = p => { for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; segs.push([a[0], a[1], b[0], b[1]]); } };
      addPoly(L.poly); L.blocks.forEach(addPoly);
      courseCache.set(key, { ...L, segs, bb: bbox(L.poly) });
    }
    return courseCache.get(key);
  }
  // Nabídka pastí pro hráče na jamce: kdo prohrává, vybírá ze 3, ostatní ze 2
  function offer(seed, hole, who, trailing) {
    const r = rng(seed ^ hashStr("past" + hole + who));
    return shuffle(TRAP_KINDS, r).slice(0, trailing ? 3 : 2);
  }

  // ---------- geometrie ----------
  function inPoly(x, y, p) {
    let inside = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function segDist(px, py, s) {
    const dx = s[2] - s[0], dy = s[3] - s[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - s[0]) * dx + (py - s[1]) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = s[0] + dx * t, cy = s[1] + dy * t, ex = px - cx, ey = py - cy;
    return { d: Math.sqrt(ex * ex + ey * ey), cx, cy, t };
  }
  const onCourse = (c, x, y) => inPoly(x, y, c.poly) && !c.blocks.some(b => inPoly(x, y, b)) && !c.bumps.some(b => (x - b.x) ** 2 + (y - b.y) ** 2 < (b.r + BALL_R) ** 2);

  // tvar pasti ve světě (pro kolize i kreslení)
  function trapGeom(t) {
    const a = t.a * TAU / ROT_STEPS, ux = dcos(a), uy = dsin(a);
    if (t.k === "stena") { const h = 46; return { seg: [t.x - ux * h, t.y - uy * h, t.x + ux * h, t.y + uy * h], ux, uy }; }
    if (t.k === "fukar") return { ux, uy, hw: 34, hl: 88 };
    return { ux, uy };
  }
  function trapValid(c, traps, t) {
    const T = TRAPS[t.k];
    if (!T || !onCourse(c, t.x, t.y)) return false;
    if ((t.x - c.tee[0]) ** 2 + (t.y - c.tee[1]) ** 2 < 86 * 86) return false;
    if ((t.x - c.cup[0]) ** 2 + (t.y - c.cup[1]) ** 2 < 80 * 80) return false;
    for (const o of traps) if ((t.x - o.x) ** 2 + (t.y - o.y) ** 2 < 74 * 74) return false;
    for (const s of c.segs) if (segDist(t.x, t.y, s).d < Math.max(14, T.clear)) return false;
    if (t.k === "stena") { const g = trapGeom(t).seg; if (!onCourse(c, g[0], g[1]) || !onCourse(c, g[2], g[3])) return false; }
    return true;
  }

  // ---------- simulace jednoho úderu ----------
  // st: {hp, traps:[{by,k,x,y,a}], balls:{x:{x,y,on,in}, o:{...}}, n}
  // úder: {by, A (0..4095), P (40..1000)}; onTick(t, bx, bo) volitelně dostává polohy po každém tiku (animace)
  function shoot(st, shot, onTick) {
    const hp = st.hp, c = course(hp), mod = hp.mod;
    const by = shot.by, opp = by === "x" ? "o" : "x";
    const cupR = CUP_R * (mod === "velka" ? 1.5 : mod === "mala" ? 0.8 : 1);
    const capV = mod === "mala" ? 3.1 : 4.4;
    const dec = mod === "led" ? BASE_DEC * 0.4 : BASE_DEC, drag = mod === "led" ? DRAG * 0.45 : DRAG;
    const wallE = mod === "guma" ? 1.0 : WALL_E;
    const wa = hp.wind * TAU / 16, wx = mod === "vitr" ? dcos(wa) * 0.0105 : 0, wy = mod === "vitr" ? dsin(wa) * 0.0105 : 0;
    const B = {};
    for (const k of ["x", "o"]) { const b = st.balls[k]; B[k] = { x: b.x, y: b.y, vx: 0, vy: 0, on: b.on, in: b.in, k }; }
    const me = B[by];
    if (!me.on) { me.x = c.tee[0]; me.y = c.tee[1]; me.on = true; }
    const ox = me.x, oy = me.y;
    const ang = angOf(shot.A), sp = VMAX * Math.max(40, Math.min(1000, shot.P)) / 1000;
    me.vx = dcos(ang) * sp; me.vy = dsin(ang) * sp;
    const traps = st.traps.map(t => ({ ...t, g: trapGeom(t) }));
    const ev = [];                                          // události pro efekty a postavičky: {t, e, b, k}
    const hitTrap = new Set();
    let pen = 0, t = 0;
    const spin = st.n * 53;                                 // posun fáze mlýnku podle pořadí akce
    const bladeAngle = tick => (spin + tick) * 0.021;
    const lastWall = { x: -99, o: -99 };

    function collideSeg(b, s, e, vbx, vby, tag) {
      const r = segDist(b.x, b.y, s);
      if (r.d >= BALL_R || r.d === 0) return false;
      const nx = (b.x - r.cx) / r.d, ny = (b.y - r.cy) / r.d;
      b.x = r.cx + nx * BALL_R; b.y = r.cy + ny * BALL_R;
      const rvx = b.vx - vbx, rvy = b.vy - vby, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const tx = rvx - vn * nx, ty = rvy - vn * ny;
        b.vx = tx * 0.985 - vn * e * nx + vbx; b.vy = ty * 0.985 - vn * e * ny + vby;
        if (-vn > 0.9 && t - lastWall[b.k] > 8) { ev.push({ t, e: tag, b: b.k, v: +(-vn).toFixed(2) }); lastWall[b.k] = t; }
      }
      return true;
    }
    function collideCircle(b, cx, cy, cr, e, tag) {
      const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy, R = cr + BALL_R;
      if (d2 >= R * R || d2 === 0) return;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      b.x = cx + nx * R; b.y = cy + ny * R;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; if (-vn > 0.9 && t - lastWall[b.k] > 8) { ev.push({ t, e: tag, b: b.k }); lastWall[b.k] = t; } }
    }
    const moving = b => b.on && !b.in && (b.vx * b.vx + b.vy * b.vy > 0.0009);
    const mark = (b, tr) => { if (!hitTrap.has(tr)) { hitTrap.add(tr); ev.push({ t, e: "past", b: b.k, k: tr.k, by: tr.by }); } };

    for (; t < TICK_LIMIT; t++) {
      let any = false;
      for (const k of ["x", "o"]) {
        const b = B[k];
        if (!b.on || b.in) continue;
        let fx = wx, fy = wy, extra = 0;
        for (const tr of traps) {
          if (tr.by === b.k) continue;                          // vlastní past tě nechá být
          const dx = b.x - tr.x, dy = b.y - tr.y, d2 = dx * dx + dy * dy;
          if (tr.k === "kopec" && d2 < 64 * 64 && d2 > 0.0001) { const d = Math.sqrt(d2), f = 0.075 * (1 - d / 64); fx += dx / d * f; fy += dy / d * f; if (f > 0.02) mark(b, tr); }
          else if (tr.k === "mlyn" && d2 < 58 * 58 && d2 > 0.0001) { const d = Math.sqrt(d2); fx += dx / d * 0.03; fy += dy / d * 0.03; }   // v lopatkách se nedá zastavit
          else if (tr.k === "louze" && d2 < 54 * 54) { extra += 0.16; mark(b, tr); }
          else if (tr.k === "fukar") { const g = tr.g, along = dx * g.ux + dy * g.uy, side = -dx * g.uy + dy * g.ux; if (along > -g.hl && along < g.hl && side > -g.hw && side < g.hw) { fx += g.ux * 0.05; fy += g.uy * 0.05; mark(b, tr); } }
        }
        const s2 = b.vx * b.vx + b.vy * b.vy;
        if (s2 < 0.0009 && fx * fx + fy * fy < 0.0004) { b.vx = 0; b.vy = 0; continue; }
        b.vx += fx; b.vy += fy;
        let s = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (s > 14) { b.vx *= 14 / s; b.vy *= 14 / s; s = 14; }
        const ns = s - dec - extra - drag * s;
        if (ns <= 0) { b.vx = 0; b.vy = 0; if (fx * fx + fy * fy < 0.0004) continue; }
        else { b.vx *= ns / s; b.vy *= ns / s; }
        any = true;
        const n = Math.max(1, Math.ceil(ns / 3));
        for (let i = 0; i < n; i++) {
          b.x += b.vx / n; b.y += b.vy / n;
          for (const sg of c.segs) collideSeg(b, sg, wallE, 0, 0, "zed");
          for (const bu of c.bumps) collideCircle(b, bu.x, bu.y, bu.r, Math.min(1, wallE + 0.08), "zed");
          for (const tr of traps) {
            if (tr.by === b.k) continue;
            if (tr.k === "stena") { if (collideSeg(b, tr.g.seg, 1.32, 0, 0, "pero")) mark(b, tr); }
            else if (tr.k === "mlyn") {
              const dx = b.x - tr.x, dy = b.y - tr.y;
              if (dx * dx + dy * dy > 62 * 62) continue;
              collideCircle(b, tr.x, tr.y, 9, 0.8, "mlyn");
              const a0 = bladeAngle(t + i / n), w = 0.021;
              for (let q = 0; q < 4; q++) {
                const a = a0 + q * PI / 2, ux = dcos(a), uy = dsin(a);
                const r = segDist(b.x, b.y, [tr.x + ux * 9, tr.y + uy * 9, tr.x + ux * 48, tr.y + uy * 48]);
                if (r.d >= BALL_R + 3 || r.d === 0) continue;
                // obvodová rychlost lopatky v bodě dotyku: ω × r
                const vbx = -(r.cy - tr.y) * w, vby = (r.cx - tr.x) * w;
                const nx = (b.x - r.cx) / r.d, ny = (b.y - r.cy) / r.d;
                b.x = r.cx + nx * (BALL_R + 3); b.y = r.cy + ny * (BALL_R + 3);
                const vn = (b.vx - vbx) * nx + (b.vy - vby) * ny;
                if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny; }
                mark(b, tr);
              }
            }
          }
        }
        // míček proti míčku
        const o = B[k === "x" ? "o" : "x"];
        if (o.on && !o.in) {
          const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 4 * BALL_R * BALL_R && d2 > 0) {
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = 2 * BALL_R - d;
            b.x -= nx * ov / 2; b.y -= ny * ov / 2; o.x += nx * ov / 2; o.y += ny * ov / 2;
            const rv = (b.vx - o.vx) * nx + (b.vy - o.vy) * ny;
            if (rv > 0) { const j = rv * 0.92; b.vx -= j * nx; b.vy -= j * ny; o.vx += j * nx; o.vy += j * ny; ev.push({ t, e: "srazka", b: b.k }); }
          }
        }
        // jezírko: zpátky na místo úderu (u cizího míčku na jeho poslední klidové místo) + trestná rána
        for (const tr of traps) {
          if (tr.by === b.k || tr.k !== "jezirko") continue;
          const dx = b.x - tr.x, dy = b.y - tr.y;
          if (dx * dx + dy * dy < 36 * 36) {
            ev.push({ t, e: "zbluňk", b: b.k, x: +b.x.toFixed(1), y: +b.y.toFixed(1), by: tr.by, k: "jezirko" });
            hitTrap.add(tr);
            if (b === me) { b.x = ox; b.y = oy; pen++; } else { b.x = st.balls[b.k].x; b.y = st.balls[b.k].y; }
            b.vx = 0; b.vy = 0;
          }
        }
        // jamka
        const cx = b.x - c.cup[0], cy = b.y - c.cup[1], cd2 = cx * cx + cy * cy;
        if (cd2 < cupR * cupR) {
          const v2 = b.vx * b.vx + b.vy * b.vy;
          if (v2 < capV * capV) { b.in = true; b.vx = 0; b.vy = 0; b.x = c.cup[0]; b.y = c.cup[1]; ev.push({ t, e: "jamka", b: b.k }); }
          else { const d = Math.sqrt(cd2) || 1; b.vx -= cx / d * 0.35; b.vy -= cy / d * 0.35; }
        }
        // pojistka: míček mimo dráhu se vrátí
        if (!inPoly(b.x, b.y, c.poly)) { b.x = b === me ? ox : st.balls[b.k].x; b.y = b === me ? oy : st.balls[b.k].y; b.vx = 0; b.vy = 0; }
      }
      if (onTick) onTick(t, B.x, B.o);
      if (!any && !moving(B.x) && !moving(B.o)) break;
    }
    const out = {};
    for (const k of ["x", "o"]) { const b = B[k]; out[k] = { x: b.x, y: b.y, on: b.on, in: b.in }; }
    // kolikrát soupeřova past zasáhla úder (statistika pro tituly)
    const trapHits = [...hitTrap].map(tr => tr.by);
    return { balls: out, ticks: t, ev, pen, trapHits };
  }

  // ---------- pravidla hry (čisté funkce nad stavem) ----------
  const other = p => p === "x" ? "o" : "x";
  const total = (sc, p) => sc[p].reduce((s, v) => s + (v || 0), 0);
  function freshBalls() { return { x: { x: 0, y: 0, on: false, in: false }, o: { x: 0, y: 0, on: false, in: false } }; }
  // kdo staví past první: vedoucí (nebo při shodě podle čísla jamky začínající / druhý)
  function trapOrder(g) {
    const tx = total(g.sc, "x"), to = total(g.sc, "o");
    if (tx !== to) { const lead = tx < to ? "x" : "o"; return [lead, other(lead)]; }
    const first = g.hole % 2 === 0 ? g.s : other(g.s);
    return [first, other(first)];
  }
  function trailing(g, p) { return total(g.sc, p) - total(g.sc, other(p)) >= 2; }
  function newGame({ id, x, o, s, fx, w, seed }) {
    const g = { id, x, o, s, fx, w: w || [0, 0], seed, hole: 0, ph: "trap", p: s, n: 0, traps: [], balls: freshBalls(), str: { x: 0, o: 0 }, done: { x: false, o: false },
      sc: { x: [], o: [] }, stats: { x: { past: 0, mokro: 0, eso: 0, low: 0 }, o: { past: 0, mokro: 0, eso: 0, low: 0 } }, h: [], win: "" };
    g.p = trapOrder(g)[0];
    return g;
  }
  const holePlan = g => plan(g.seed)[g.hole];
  function simState(g) { return { hp: holePlan(g), traps: g.traps, balls: g.balls, n: g.n }; }
  function placeTrap(g, by, t) {
    if (g.ph !== "trap" || g.p !== by) return null;
    const ord = trapOrder(g), mine = g.traps.filter(q => q.by === by).length;
    if (mine) return null;
    const opts = offer(g.seed, g.hole, by, trailing(g, by));
    if (!opts.includes(t.k)) return null;
    const tr = { by, k: t.k, x: Math.round(t.x), y: Math.round(t.y), a: TRAPS[t.k].rot ? ((t.a | 0) % ROT_STEPS + ROT_STEPS) % ROT_STEPS : 0 };
    if (!trapValid(course(holePlan(g)), g.traps, tr)) return null;
    const ng = { ...g, traps: [...g.traps, tr], n: g.n + 1, h: [...g.h, { n: g.n + 1, by, kind: "t", tr }].slice(-4) };
    if (ng.traps.length === 2) { ng.ph = "play"; ng.p = ord[1]; } else ng.p = ord[1];
    return ng;
  }
  // zahraje úder a posune hru (konec jamky, další jamka, konec hry); vrátí {g, res}
  function playShot(g, by, A, P) {
    if (g.ph !== "play" || g.p !== by || g.done[by]) return null;
    A = ((A | 0) % ANG_STEPS + ANG_STEPS) % ANG_STEPS; P = Math.max(40, Math.min(1000, P | 0));
    const b0 = { x: { ...g.balls.x }, o: { ...g.balls.o } };
    const res = shoot(simState(g), { by, A, P });
    const str = { ...g.str, [by]: g.str[by] + 1 + res.pen };
    const done = { ...g.done };
    const stats = { x: { ...g.stats.x }, o: { ...g.stats.o } };
    for (const k of ["x", "o"]) if (res.balls[k].in && !g.balls[k].in) done[k] = true;
    if (res.balls[by].in && str[by] === 1) stats[by].eso++;
    if (res.pen) stats[by].mokro += res.pen;
    for (const owner of res.trapHits) if (owner !== by) stats[owner].past++;
    // tvrdý strop: po 6. ráně bez jamky je jamka za 7
    if (!done[by] && str[by] >= MAX_STROKES) { done[by] = true; str[by] = MAX_STROKES + 1; }
    const act = { n: g.n + 1, by, kind: "s", A, P, hole: g.hole, b0, traps: g.traps, n0: g.n, res: { balls: res.balls, pen: res.pen } };
    let ng = { ...g, balls: res.balls, str, done, stats, n: g.n + 1, h: [...g.h, act].slice(-4) };
    if (done.x && done.o) {
      const sc = { x: [...g.sc.x, str.x], o: [...g.sc.o, str.o] };
      ng.sc = sc;
      for (const k of ["x", "o"]) { const d = total(sc, k) - total(sc, other(k)); if (d > stats[k].low) stats[k].low = d; }
      if (g.hole === 5) {
        const tx = total(sc, "x"), to = total(sc, "o");
        ng.ph = "end"; ng.win = tx < to ? "x" : to < tx ? "o" : "=";
        ng.w = ng.win === "=" ? g.w : [g.w[0] + (ng.win === "x" ? 1 : 0), g.w[1] + (ng.win === "o" ? 1 : 0)];
        ng.p = "";
      } else {
        ng.hole = g.hole + 1; ng.ph = "trap"; ng.traps = []; ng.balls = freshBalls(); ng.str = { x: 0, o: 0 }; ng.done = { x: false, o: false };
        ng.p = trapOrder(ng)[0];
      }
    } else {
      ng.p = done[other(by)] ? by : other(by);
    }
    return { g: ng, res };
  }
  // tituly na konci hry (jména cen, ne osob, ať sedí na kohokoli)
  function titles(g) {
    const out = [];
    for (const k of ["x", "o"]) if (g.stats[k].eso) out.push({ p: k, t: g.stats[k].eso > 1 ? `Eso ×${g.stats[k].eso}` : "Eso", d: "Jamka jednou ranou." });
    const px = g.stats.x.past, po = g.stats.o.past;
    if (px !== po && Math.max(px, po) > 0) out.push({ p: px > po ? "x" : "o", t: "Cena za zlomyslnost", d: `Tvoje pasti chytily soupeře ${Math.max(px, po)}×.` });
    const mx = g.stats.x.mokro, mo = g.stats.o.mokro;
    if (Math.max(mx, mo) >= 2 && mx !== mo) out.push({ p: mx > mo ? "x" : "o", t: "Mokré ponožky", d: `Žbluňk ${Math.max(mx, mo)}×.` });
    if (g.win === "x" || g.win === "o") { if (g.stats[g.win].low >= 3) out.push({ p: g.win, t: "Návrat z hrobu", d: `Výhra po ztrátě ${g.stats[g.win].low} ran.` }); }
    const [wx, wo] = g.w;
    if (wx + wo >= 2 && wx !== wo) { const lead = wx > wo ? "x" : "o"; if (Math.max(wx, wo) >= 3) out.push({ p: lead, t: Math.max(wx, wo) >= 5 ? "Postrach hřiště" : "Vede sérii", d: `Série ${Math.max(wx, wo)}:${Math.min(wx, wo)}.` }); }
    return out.slice(0, 4);
  }
  // Kdo jsem v místnosti: uložená židle, nebo shoda zařízení. Nikdy nepřijímám vlastní výzvu.
  function seatFor(doc, device, saved) {
    if (saved === "x" || saved === "o") return { me: saved, intro: false };
    if (doc.sx && doc.sx === device) return { me: "x", intro: false };
    if (doc.so && doc.so === device) return { me: "o", intro: false };
    const free = !doc.sx ? "x" : !doc.so ? "o" : null;
    return { me: null, intro: !!free };
  }

  const API = { PI, TAU, dsin, dcos, rng, hashStr, BALL_R, CUP_R, VMAX, MAX_STROKES, ANG_STEPS, ROT_STEPS, LAYOUTS, THEMES, THEME_NAMES, MODS, TRAPS, TRAP_KINDS,
    plan, course, offer, inPoly, onCourse, trapGeom, trapValid, shoot, other, total, trapOrder, trailing, newGame, holePlan, simState, placeTrap, playShot, titles, seatFor, bbox };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JM = API;
})(typeof self !== "undefined" ? self : this);
