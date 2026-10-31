// Jamka na míru – generátor jamek ze seedu a deterministická fyzika minigolfu.
// Jednotka = jedno políčko dráhy. Jen +, -, *, /, Math.sqrt, Math.floor a Math.imul: stejné vstupy dají
// v Chromiu i WebKitu bit po bitu stejný výsledek. Žádné Math.sin/cos/atan2/hypot (ty se mezi enginy smějí lišit).
(function (root) {
  "use strict";
  const PI = 3.141592653589793, TAU = 2 * PI;

  // ---------- deterministická trigonometrie ----------
  function dsin(x) {
    x = x - TAU * Math.floor((x + PI) / TAU);
    if (x > PI / 2) x = PI - x; else if (x < -PI / 2) x = -PI - x;
    const q = x * x;
    return x * (1 - q / 6 * (1 - q / 20 * (1 - q / 42 * (1 - q / 72 * (1 - q / 110 * (1 - q / 156))))));
  }
  const dcos = x => dsin(x + PI / 2);
  const ANG = 4096, ROT = 16;                    // úhel úderu v 1/4096 otáčky, natočení pasti v 1/16

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
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));

  // ---------- konstanty ----------
  const R = 0.16, CUP_R = 0.27, VMAX = 0.27, DEC = 0.0017, DRAG = 0.0018, G = 0.02, WALL_E = 0.74, VCAP = 0.6;
  const TICK_LIMIT = 2400, RAMP = 0.25;
  const VOID = 0, FLOOR = 1, WATER = 2, BRIDGE = 3;
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // S(ever), V, J, Z – v mřížce jde y dolů, odpaliště je dole

  // ---------- témata, modifikátory, pasti ----------
  const THEMES = ["zahrada", "plaz", "zima"];
  const THEME_NAMES = { zahrada: "Zahrádka", plaz: "Pláž", zima: "Zimní hřiště" };
  const MODS = {
    klid: { name: "Klidná jamka", desc: "Nic zvláštního. Zatím." },
    led: { name: "Náledí", desc: "Míček klouže a skoro nebrzdí." },
    vitr: { name: "Vítr", desc: "Přes dráhu fouká stálý vítr." },
    velka: { name: "Velká jamka", desc: "Jamka je skoro o půlku větší." },
    guma: { name: "Gumové mantinely", desc: "Mantinely odrážejí bez ztráty rychlosti." },
    mala: { name: "Malá jamka", desc: "Jamka je menší a míček musí přijet pomalu." },
  };
  const TRAPS = {
    mlyn: { name: "Mlýnek", desc: "Lopatky se točí a odpálí, co jim vleze do cesty.", rot: false, clear: 1.02 },
    louze: { name: "Louže", desc: "Míček v ní skoro zastaví.", rot: false, clear: 0.35 },
    stena: { name: "Pérovačka", desc: "Stěna, která odrazí víc, než přiletělo.", rot: true, clear: 0.25 },
    kopec: { name: "Krtinec", desc: "Kopeček, ze kterého míček sjede do strany.", rot: false, clear: 0.35 },
  };
  const TRAP_KINDS = Object.keys(TRAPS);
  const LOUZE_R = 0.8, KOPEC_R = 1.1, KOPEC_H = 0.38, MLYN_R = 0.95, MLYN_W = 0.03, STENA_H = 0.7;

  // ---------- plán hry: 6 jamek, každá s rysy, tématem a modifikátorem ----------
  function plan(seed) {
    const r = rng(seed ^ 0x9E3779B9);
    const sets = shuffle([["svah"], ["most"], ["ostrov"], ["most", "svah"], ["ostrov", "svah"], ["most", "ostrov"], ["svah", "svah"], ["ostrov", "most"]], r).slice(0, 6);
    // první jamka je na rozehrání: jen jeden rys
    if (sets[0].length > 1) { const i = sets.findIndex(s => s.length === 1); const t = sets[0]; sets[0] = sets[i]; sets[i] = t; }
    const themes = [...shuffle(THEMES, r), ...shuffle(THEMES, r)];
    if (themes[3] === themes[2]) { const t = themes[3]; themes[3] = themes[4]; themes[4] = t; }
    const modKeys = ["led", "vitr", "velka", "guma", "mala"];
    const mods = ["klid"];
    for (let i = 1; i < 6; i++) { let m; do m = r() < 0.25 ? "klid" : modKeys[Math.floor(r() * modKeys.length)]; while (m === mods[i - 1]); mods.push(m); }
    return sets.map((fs, i) => {
      const legs = i === 0 ? 3 : Math.min(4, Math.max(3, fs.length + ri(r, 1, 2)));
      const feats = new Array(legs).fill("");
      const slots = shuffle([...Array(legs).keys()], r);
      fs.forEach((f, q) => { feats[slots[q]] = f; });
      return { i, feats, th: themes[i], mod: mods[i], wind: Math.floor(r() * 16), sub: Math.floor(r() * 4294967296) };
    });
  }

  // ---------- stavba tratě ----------
  // Trať je pár rovných úseků (nohou) s pravoúhlými zatáčkami. Na nohu může připadnout rys:
  // svah (rampa nahoru/dolů), most (úzký můstek přes vodu) nebo ostrov (široký úsek s ostrůvkem uprostřed).
  // Vnější rohy se zkosí, takže trať nevypadá jako bludiště z kostiček.
  function build(r, spec) {
    const feats = spec.feats, n = feats.length;
    const ws = feats.map(f => f === "ostrov" ? 5 : 3);
    const legs = [];
    let px = 0, py = 0, d = 0, H = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) { const pd = legs[i - 1].d; d = pd === 0 || pd === 2 ? (r() < 0.5 ? 1 : 3) : (i === n - 1 && n >= 3 && r() < 0.3 ? 2 : 0); }
      const f = feats[i], w = ws[i], hw = (w - 1) / 2;
      const hsIn = i > 0 ? Math.max(legs[i - 1].hw, hw) : -1, hsOut = i < n - 1 ? Math.max(hw, (ws[i + 1] - 1) / 2) : -1;
      const k0 = i === 0 ? 2 : hsIn + 1;
      const horiz = d === 1 || d === 3;
      let L, k1 = -1, H1 = H, v = 0;
      if (f) {
        const len = f === "ostrov" ? ri(r, 2, 4) : ri(r, 2, 3);
        k1 = k0 + len - 1;
        L = i < n - 1 ? k1 + 2 + hsOut : k1 + 3;
        if (f === "svah") { const up = H < 0.5 ? r() < 0.75 : r() < 0.3; H1 = H + (up ? 1 : -1) * RAMP * len; if (H1 < -0.25) H1 = H + RAMP * len; }
        v = Math.floor(r() * 3);
      } else {
        L = Math.max(i === 0 ? ri(r, 6, 9) : ri(r, 4, horiz ? 7 : 9), hsIn + hsOut + 3);
      }
      if (horiz && L > 9) return null;
      legs.push({ sx: px, sy: py, d, L, w, hw, f, H0: H, H1, k0, k1, v, jb: f === "most" && v === 2 ? (r() < 0.5 ? -1 : 1) : 0 });
      px += DIR[d][0] * (L - 1); py += DIR[d][1] * (L - 1); H = H1;
    }
    // políčka: první zápis vyhrává, sousedící nesousední nohy = kolize
    const cells = new Map(), key = (x, y) => (x + 512) * 2048 + (y + 512);
    const isl = [];
    let bad = false;
    const put = (x, y, t, li, extra) => {
      const kk = key(x, y), old = cells.get(kk);
      if (old) { if (Math.abs(old.li - li) >= 2) bad = true; return; }
      cells.set(kk, { x, y, t, li, ...extra });
    };
    const posts = [];
    legs.forEach((g, li) => {
      const dx = DIR[g.d][0], dy = DIR[g.d][1], qx = -dy, qy = dx;
      for (let k = 0; k < g.L; k++) for (let j = -g.hw; j <= g.hw; j++) {
        const x = g.sx + dx * k + qx * j, y = g.sy + dy * k + qy * j;
        let t = FLOOR;
        const inF = g.f && k >= g.k0 && k <= g.k1;
        if (inF && g.f === "most") {
          if (g.v === 1) t = j === 0 ? WATER : BRIDGE;           // dva můstky, voda mezi nimi
          else t = j === g.jb ? BRIDGE : WATER;                  // jeden můstek (uprostřed nebo u kraje)
        }
        if (inF && g.f === "ostrov") {
          const mid = g.v === 2 ? (j === 0 && k > g.k0 && k < g.k1 + 1 && (k - g.k0) % 2 === 1) : j === 0;
          if (g.v === 0 && mid) { isl.push({ x, y, li }); cells.set(key(x, y), { x, y, t: -1, li }); continue; }   // ostrůvek s keřem
          if (g.v === 1 && mid) t = WATER;                                                                         // tůňka uprostřed
          if (g.v === 2 && j === 0 && (k - g.k0) % 2 === 0) posts.push({ x: x + 0.5, y: y + 0.5, r: 0.2 });         // kolíky
        }
        put(x, y, t, li, { k, j });
      }
      if (li < legs.length - 1) {
        const hs = Math.max(g.hw, legs[li + 1].hw), ex = g.sx + dx * (g.L - 1), ey = g.sy + dy * (g.L - 1);
        for (let a = -hs; a <= hs; a++) for (let b = -hs; b <= hs; b++) put(ex + a, ey + b, FLOOR, li, { k: g.L - 1, j: 0, sq: 1 });
      }
    });
    if (bad) return null;
    // sousedství nesousedních nohou (mezi souběžnými úseky musí zůstat aspoň políčko mezery)
    for (const c of cells.values()) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const o = cells.get(key(c.x + a, c.y + b));
      if (o && Math.abs(o.li - c.li) >= 2) return null;
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of cells.values()) { if (c.x < x0) x0 = c.x; if (c.y < y0) y0 = c.y; if (c.x > x1) x1 = c.x; if (c.y > y1) y1 = c.y; }
    const W = x1 - x0 + 3, Hh = y1 - y0 + 3;
    if (W > 15 || Hh > 27) return null;
    const type = new Uint8Array(W * Hh), legOf = new Int8Array(W * Hh).fill(-1), island = new Uint8Array(W * Hh);
    const hc = new Float64Array((W + 1) * (Hh + 1)), hset = new Uint8Array((W + 1) * (Hh + 1));
    const ox = 1 - x0, oy = 1 - y0;
    for (const c of cells.values()) {
      const i = (c.y + oy) * W + (c.x + ox);
      if (c.t === -1) { island[i] = 1; continue; }
      type[i] = c.t; legOf[i] = c.li;
    }
    // výšky v rozích políček podle funkce nohy (rampa lineárně po délce úseku)
    const hAt = (g, X, Y) => {
      if (g.f !== "svah") return g.H0;
      const al = (X - (g.sx + ox + 0.5)) * DIR[g.d][0] + (Y - (g.sy + oy + 0.5)) * DIR[g.d][1];
      const a0 = g.k0 - 0.5, a1 = g.k1 + 0.5;
      let t = (al - a0) / (a1 - a0); t = t < 0 ? 0 : t > 1 ? 1 : t;
      return g.H0 + (g.H1 - g.H0) * t;
    };
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!type[i]) continue;
      const g = legs[legOf[i]];
      for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) {
        const ci = cy * (W + 1) + cx, h = hAt(g, cx, cy);
        if (hset[ci] && Math.abs(hc[ci] - h) > 1e-9) return null;
        hc[ci] = h; hset[ci] = 1;
      }
    }
    for (const p of posts) { p.x += ox; p.y += oy; }
    // odpaliště a jamka
    const g0 = legs[0], gl = legs[n - 1];
    const tee = [g0.sx + ox + 0.5 + DIR[g0.d][0], g0.sy + oy + 0.5 + DIR[g0.d][1]];
    const cj = ri(r, -gl.hw, gl.hw), ck = gl.L - 2, qx = -DIR[gl.d][1], qy = DIR[gl.d][0];
    const cup = [gl.sx + ox + 0.5 + DIR[gl.d][0] * ck + qx * cj, gl.sy + oy + 0.5 + DIR[gl.d][1] * ck + qy * cj];
    const c = { W, H: Hh, type, legOf, island, hc, posts, tee, cup, legs, cut: new Uint8Array(W * Hh) };
    if (type[cellIdx(c, cup[0], cup[1])] !== FLOOR || type[cellIdx(c, tee[0], tee[1])] !== FLOOR) return null;
    for (const p of posts) if ((p.x - cup[0]) ** 2 + (p.y - cup[1]) ** 2 < 1.5 || (p.x - tee[0]) ** 2 + (p.y - tee[1]) ** 2 < 1.5) return null;
    finish(c);
    return c;
  }
  const cellIdx = (c, x, y) => Math.floor(y) * c.W + Math.floor(x);
  const occ = (c, x, y) => x >= 0 && y >= 0 && x < c.W && y < c.H && c.type[y * c.W + x] !== VOID;

  // zkosené rohy, mantinely, seznam mantinelů u každého políčka
  // cut: 1 = chybí roh SV (horní pravý), 2 = SZ, 3 = JV, 4 = JZ
  function finish(c) {
    const { W, H, type } = c;
    const tc = cellIdx(c, c.tee[0], c.tee[1]), cc = cellIdx(c, c.cup[0], c.cup[1]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (type[i] !== FLOOR || i === tc || i === cc) continue;
      const N = occ(c, x, y - 1), E = occ(c, x + 1, y), S = occ(c, x, y + 1), Z = occ(c, x - 1, y);
      if (!N && !E && S && Z && occ(c, x - 1, y + 1)) c.cut[i] = 1;
      else if (!N && !Z && S && E && occ(c, x + 1, y + 1)) c.cut[i] = 2;
      else if (!S && !E && N && Z && occ(c, x - 1, y - 1)) c.cut[i] = 3;
      else if (!S && !Z && N && E && occ(c, x + 1, y - 1)) c.cut[i] = 4;
    }
    const segs = [], hAtC = (X, Y) => c.hc[Y * (W + 1) + X];
    const add = (ax, ay, bx, by) => segs.push([ax, ay, bx, by, hAtC(ax, ay), hAtC(bx, by)]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!type[i]) continue;
      const cu = c.cut[i];
      if (!occ(c, x, y - 1) && cu !== 1 && cu !== 2) add(x, y, x + 1, y);
      if (!occ(c, x + 1, y) && cu !== 1 && cu !== 3) add(x + 1, y, x + 1, y + 1);
      if (!occ(c, x, y + 1) && cu !== 3 && cu !== 4) add(x + 1, y + 1, x, y + 1);
      if (!occ(c, x - 1, y) && cu !== 2 && cu !== 4) add(x, y + 1, x, y);
      // úhlopříčky orientované tak, aby vnější strana (pro kreslení) ležela vlevo od směru
      if (cu === 1) add(x, y, x + 1, y + 1); else if (cu === 4) add(x + 1, y + 1, x, y);
      else if (cu === 2) add(x, y + 1, x + 1, y); else if (cu === 3) add(x + 1, y, x, y + 1);
    }
    c.segs = segs;
    c.near = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const l = [];
      if (type[y * W + x]) segs.forEach((s, si) => { if (segDist(x + 0.5, y + 0.5, s).d < 1.3) l.push(si); });
      c.near.push(l);
    }
    // vzdálenostní pole od jamky (pro bota a pro ověření, že se k jamce dá dojít)
    const df = new Float64Array(W * H).fill(1e9), pass = i => type[i] === FLOOR || type[i] === BRIDGE;
    df[cc] = 0;
    const q = [cc];
    for (let qi = 0; qi < q.length; qi++) {        // Dijkstra na malé mřížce: stačí opakované uvolňování
      const i = q[qi], x = i % W, y = (i - x) / W;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        if (!a && !b) continue;
        const nx = x + a, ny = y + b; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (!pass(j)) continue;
        if (a && b && (!pass(y * W + nx) || !pass(ny * W + x))) continue;
        const nd = df[i] + (a && b ? 1.4142135623730951 : 1);
        if (nd < df[j] - 1e-9) { df[j] = nd; q.push(j); }
      }
    }
    c.df = df;
    c.bb = { x0: 0, y0: 0, x1: W, y1: H };
  }

  // výška povrchu dráhy a její spád (bilineárně z rohů políčka)
  function surf(c, x, y) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= c.W || cy >= c.H) return { h: 0, hx: 0, hy: 0 };
    const W1 = c.W + 1, h00 = c.hc[cy * W1 + cx], h10 = c.hc[cy * W1 + cx + 1], h01 = c.hc[(cy + 1) * W1 + cx], h11 = c.hc[(cy + 1) * W1 + cx + 1];
    const fx = x - cx, fy = y - cy;
    const h = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy;
    return { h, hx: (h10 - h00) * (1 - fy) + (h11 - h01) * fy, hy: (h01 - h00) * (1 - fx) + (h11 - h10) * fx };
  }
  // je bod na hratelné ploše? 0 mimo, 1 trávník, 2 voda, 3 most
  function where(c, x, y) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= c.W || cy >= c.H) return VOID;
    const i = cy * c.W + cx, t = c.type[i];
    if (!t) return VOID;
    const cu = c.cut[i];
    if (cu) {
      const fx = x - cx, fy = y - cy;
      if (cu === 1 && fx > fy) return VOID;
      if (cu === 4 && fx < fy) return VOID;
      if (cu === 2 && fx + fy < 1) return VOID;
      if (cu === 3 && fx + fy > 1) return VOID;
    }
    return t;
  }

  // ---------- jamka: stavba + ověření botem + par ----------
  const holeCache = new Map();
  function hole(seed, hi) {
    const k = seed + ":" + hi;
    if (holeCache.has(k)) return holeCache.get(k);
    const hp = plan(seed)[hi];
    let c = null;
    for (let at = 0; at < 60 && !c; at++) {
      const r = rng(hp.sub ^ hashStr("pokus" + at));
      // když se rysy nedaří poskládat, zkus po 30 pokusech kratší recept
      const spec = at < 30 ? hp : { ...hp, feats: hp.feats.filter(f => f).slice(0, 2) };
      const b = build(r, spec);
      if (!b) continue;
      b.hp = hp; b.mod = hp.mod; b.wind = hp.wind; b.th = hp.th; b.attempt = at;
      const strokes = botPar(b);
      if (strokes == null) continue;
      b.bot = strokes; b.par = Math.max(2, Math.min(5, strokes + 1));
      c = b;
    }
    if (!c) {            // nouzová rovinka, kdyby seed nic nedal (nestává se, ale hra nesmí spadnout)
      const b = build(rng(hp.sub), { feats: ["", ""] }) || build(rng(1), { feats: [""] });
      b.hp = hp; b.mod = "klid"; b.wind = 0; b.th = hp.th; b.par = 3; c = b;
    }
    c.seed = seed; c.hi = hi;
    holeCache.set(k, c);
    return c;
  }
  // greedy bot: z každé pozice zkusí 64 směrů × 9 sil, vybere ránu, která skončí nejblíž (po dráze) jamce
  const BOT_P = [90, 160, 240, 330, 430, 550, 690, 850, 1000];
  function botShot(c, balls, by) {
    let best = null;
    const st = { c, traps: [], balls, n: 0 };
    const score = res => {
      const b = res.balls[by];
      if (b.in) return -1e6;
      const i = cellIdx(c, b.x, b.y), dd = c.df[i] >= 1e8 ? 99 : c.df[i];
      return dd + res.pen * 3;
    };
    for (let a = 0; a < 64; a++) for (const P of BOT_P) {
      const res = shoot(st, { by, A: a * 64, P });
      const s = score(res);
      if (!best || s < best.s - 1e-9) best = { s, A: a * 64, P, res };
    }
    if (best.s > -1e5) for (let da = -24; da <= 24; da += 8) for (const dp of [-50, 0, 50]) {
      const A = (best.A + da + ANG) % ANG, P = Math.max(40, Math.min(1000, best.P + dp));
      const res = shoot(st, { by, A, P }), s = score(res);
      if (s < best.s - 1e-9) best = { s, A, P, res };
    }
    return best;
  }
  function botPar(c) {
    let balls = { x: { x: c.tee[0], y: c.tee[1], on: true, in: false }, o: { x: 0, y: 0, on: false, in: false } };
    if (c.df[cellIdx(c, c.tee[0], c.tee[1])] >= 1e8) return null;
    for (let s = 1; s <= 5; s++) {
      const b = botShot(c, balls, "x");
      if (b.res.balls.x.in) return s;
      balls = b.res.balls;
    }
    return null;
  }

  // ---------- pasti ----------
  // past: {by, k, x, y, a}; x, y v dvacetinách políčka (celá čísla), a v 1/16 otáčky
  function trapGeom(t) {
    const x = t.x / 20, y = t.y / 20, an = t.a * TAU / ROT, ux = dcos(an), uy = dsin(an);
    const g = { x, y, ux, uy };
    if (t.k === "stena") g.seg = [x - ux * STENA_H, y - uy * STENA_H, x + ux * STENA_H, y + uy * STENA_H];
    return g;
  }
  function trapValid(c, t) {
    const T = TRAPS[t.k];
    if (!T || !Number.isInteger(t.x) || !Number.isInteger(t.y)) return false;
    const g = trapGeom(t), x = g.x, y = g.y;
    if (where(c, x, y) !== FLOOR) return false;
    if ((x - c.tee[0]) ** 2 + (y - c.tee[1]) ** 2 < 2.0 * 2.0) return false;
    if ((x - c.cup[0]) ** 2 + (y - c.cup[1]) ** 2 < 1.7 * 1.7) return false;
    for (const p of c.posts) if ((x - p.x) ** 2 + (y - p.y) ** 2 < (T.clear + 0.3) ** 2) return false;
    const pts = [];
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; pts.push([x + dcos(a) * T.clear, y + dsin(a) * T.clear]); }
    if (t.k === "stena") for (let s = -1; s <= 1; s += 0.25) pts.push([x + g.ux * (STENA_H + 0.12) * s, y + g.uy * (STENA_H + 0.12) * s]);
    for (const [px, py] of pts) if (where(c, px, py) !== FLOOR) return false;
    return true;
  }
  // výška krtince v bodě (pro kreslení míčku i trávy)
  function trapHeight(traps, x, y, skip) {
    let h = 0;
    for (const t of traps) {
      if (t.k !== "kopec" || t.by === skip) continue;
      const dx = x - t.x / 20, dy = y - t.y / 20, q = (dx * dx + dy * dy) / (KOPEC_R * KOPEC_R);
      if (q < 1) h += KOPEC_H * (1 - q) * (1 - q);
    }
    return h;
  }
  const bladeAngle = (n, tick) => n * 1.6180339887 + tick * MLYN_W;

  // ---------- jeden úder ----------
  // st: {c, traps, balls:{x:{x,y,on,in}, o}, n}; shot: {by, A 0..4095, P 40..1000}
  // onTick(t, bx, bo) volitelně dostává polohy po každém tiku (animace)
  function segDist(px, py, s) {
    const dx = s[2] - s[0], dy = s[3] - s[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - s[0]) * dx + (py - s[1]) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = s[0] + dx * t, cy = s[1] + dy * t, ex = px - cx, ey = py - cy;
    return { d: Math.sqrt(ex * ex + ey * ey), cx, cy, t };
  }
  function shoot(st, shot, onTick) {
    const c = st.c, mod = c.mod;
    const by = shot.by;
    const cupR = CUP_R * (mod === "velka" ? 1.45 : mod === "mala" ? 0.8 : 1);
    const capV = mod === "mala" ? 0.12 : 0.17;
    const dec = mod === "led" ? DEC * 0.45 : DEC, drag = mod === "led" ? DRAG * 0.5 : DRAG;
    const wallE = mod === "guma" ? 0.97 : WALL_E;
    const wa = c.wind * TAU / 16, wx = mod === "vitr" ? dcos(wa) * 0.0009 : 0, wy = mod === "vitr" ? dsin(wa) * 0.0009 : 0;
    const B = {};
    for (const k of ["x", "o"]) { const b = st.balls[k]; B[k] = { x: b.x, y: b.y, vx: 0, vy: 0, on: b.on, in: b.in, k, rest: true }; }
    const me = B[by];
    if (!me.on) { me.x = c.tee[0]; me.y = c.tee[1]; me.on = true; }
    const ox = me.x, oy = me.y;
    const ang = shot.A * TAU / ANG, sp = VMAX * Math.max(40, Math.min(1000, shot.P)) / 1000;
    me.vx = dcos(ang) * sp; me.vy = dsin(ang) * sp; me.rest = false;
    const traps = st.traps.map(t => ({ ...t, g: trapGeom(t) }));
    const ev = [], hitTrap = new Set(), lastHit = { x: -99, o: -99 };
    let pen = 0, t = 0;
    const evt = (e, b, extra) => ev.push({ t, e, b: b.k, ...extra });

    function bounce(b, nx, ny, px, py, e, vbx, vby, tag) {
      b.x = px; b.y = py;
      const rvx = b.vx - vbx, rvy = b.vy - vby, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const tx = rvx - vn * nx, ty = rvy - vn * ny;
        b.vx = tx * 0.98 - vn * e * nx + vbx; b.vy = ty * 0.98 - vn * e * ny + vby;
        if (-vn > 0.03 && t - lastHit[b.k] > 6) { evt(tag, b, { v: Math.round(-vn * 1000) }); lastHit[b.k] = t; }
      }
    }
    function hitSeg(b, s, e, tag, rad) {
      const q = segDist(b.x, b.y, s), rr = rad || R;
      if (q.d >= rr || q.d === 0) return false;
      const nx = (b.x - q.cx) / q.d, ny = (b.y - q.cy) / q.d;
      bounce(b, nx, ny, q.cx + nx * rr, q.cy + ny * rr, e, 0, 0, tag);
      return true;
    }
    function hitCircle(b, cx, cy, cr, e, tag) {
      const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy, rr = cr + R;
      if (d2 >= rr * rr || d2 === 0) return false;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      bounce(b, nx, ny, cx + nx * rr, cy + ny * rr, e, 0, 0, tag);
      return true;
    }
    const mark = (b, tr) => { if (!hitTrap.has(tr)) { hitTrap.add(tr); evt("past", b, { k: tr.k, by: tr.by }); } };
    const reset = (b, why) => {
      if (b === me) { b.x = ox; b.y = oy; } else { b.x = st.balls[b.k].x; b.y = st.balls[b.k].y; }
      b.vx = 0; b.vy = 0; b.rest = true;
      if (why === "voda" && b === me) pen++;
    };

    for (; t < TICK_LIMIT; t++) {
      let moving = false;
      for (const k of ["x", "o"]) {
        const b = B[k];
        if (!b.on || b.in) continue;
        const sf = surf(c, b.x, b.y);
        let fx = -G * sf.hx + wx, fy = -G * sf.hy + wy, extra = 0;
        for (const tr of traps) {
          if (tr.by === b.k) continue;                          // vlastní past tě nechá být
          const dx = b.x - tr.g.x, dy = b.y - tr.g.y, d2 = dx * dx + dy * dy;
          if (tr.k === "kopec" && d2 < KOPEC_R * KOPEC_R) {
            const q = d2 / (KOPEC_R * KOPEC_R), f = G * KOPEC_H * 4 * (1 - q) / (KOPEC_R * KOPEC_R);
            fx += dx * f; fy += dy * f; if (q < 0.7) mark(b, tr);
          } else if (tr.k === "louze" && d2 < LOUZE_R * LOUZE_R) { extra += 0.016; mark(b, tr); }
          else if (tr.k === "mlyn" && d2 < (MLYN_R + R) * (MLYN_R + R) && d2 > 1e-6) { const d = Math.sqrt(d2); fx += dx / d * 0.0035; fy += dy / d * 0.0035; }
        }
        let s = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const f2 = fx * fx + fy * fy, lim = dec + extra;
        if (b.rest && f2 <= lim * lim) continue;               // leží a nic ho nehne
        b.vx += fx; b.vy += fy;
        s = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (s > VCAP) { b.vx *= VCAP / s; b.vy *= VCAP / s; s = VCAP; }
        const ns = s - dec - extra - drag * s;
        if (ns <= 0) { b.vx = 0; b.vy = 0; if (f2 <= lim * lim) { b.rest = true; continue; } }
        else { b.vx *= ns / s; b.vy *= ns / s; }
        b.rest = false; moving = true;
        const n = Math.max(1, Math.ceil(ns / 0.07));
        for (let i = 0; i < n; i++) {
          b.x += b.vx / n; b.y += b.vy / n;
          const ci = cellIdx(c, b.x, b.y), near = ci >= 0 && ci < c.near.length ? c.near[ci] : [];
          for (const si of near) hitSeg(b, c.segs[si], wallE, "zed");
          for (const p of c.posts) hitCircle(b, p.x, p.y, p.r, wallE, "zed");
          for (const tr of traps) {
            if (tr.by === b.k) continue;
            if (tr.k === "stena") { if (hitSeg(b, tr.g.seg, 1.35, "pero", R + 0.06)) mark(b, tr); }
            else if (tr.k === "mlyn") {
              const dx = b.x - tr.g.x, dy = b.y - tr.g.y;
              if (dx * dx + dy * dy > (MLYN_R + R + 0.1) ** 2) continue;
              if (hitCircle(b, tr.g.x, tr.g.y, 0.2, 0.7, "mlyn")) mark(b, tr);
              const a0 = bladeAngle(st.n, t + i / n);
              for (let qd = 0; qd < 4; qd++) {
                const a = a0 + qd * PI / 2, ux = dcos(a), uy = dsin(a);
                const q = segDist(b.x, b.y, [tr.g.x + ux * 0.2, tr.g.y + uy * 0.2, tr.g.x + ux * MLYN_R, tr.g.y + uy * MLYN_R]);
                const rr = R + 0.05;
                if (q.d >= rr || q.d === 0) continue;
                const vbx = -(q.cy - tr.g.y) * MLYN_W, vby = (q.cx - tr.g.x) * MLYN_W;   // obvodová rychlost lopatky
                const nx = (b.x - q.cx) / q.d, ny = (b.y - q.cy) / q.d;
                bounce(b, nx, ny, q.cx + nx * rr, q.cy + ny * rr, 0.75, vbx, vby, "mlyn");
                mark(b, tr);
              }
            }
          }
        }
        // míček proti míčku
        const o = B[k === "x" ? "o" : "x"];
        if (o.on && !o.in) {
          const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 4 * R * R && d2 > 0) {
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = 2 * R - d;
            b.x -= nx * ov / 2; b.y -= ny * ov / 2; o.x += nx * ov / 2; o.y += ny * ov / 2;
            const rv = (b.vx - o.vx) * nx + (b.vy - o.vy) * ny;
            if (rv > 0) { const j = rv * 0.92; b.vx -= j * nx; b.vy -= j * ny; o.vx += j * nx; o.vy += j * ny; o.rest = false; evt("srazka", b); }
          }
        }
        // voda, výlet mimo, jamka
        const wh = where(c, b.x, b.y);
        if (wh === WATER) { evt("voda", b, { x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100 }); reset(b, "voda"); continue; }
        if (wh === VOID) { evt("ven", b); reset(b, "ven"); continue; }
        const cx = b.x - c.cup[0], cy = b.y - c.cup[1], cd2 = cx * cx + cy * cy;
        if (cd2 < cupR * cupR) {
          const v2 = b.vx * b.vx + b.vy * b.vy;
          if (v2 < capV * capV) { b.in = true; b.vx = 0; b.vy = 0; b.x = c.cup[0]; b.y = c.cup[1]; b.rest = true; evt("jamka", b); }
          else { const d = Math.sqrt(cd2) || 1; b.vx -= cx / d * 0.02; b.vy -= cy / d * 0.02; if (t - lastHit[b.k] > 6) { evt("lip", b); lastHit[b.k] = t; } }
        }
      }
      if (onTick) onTick(t, B.x, B.o);
      if (!moving) break;
    }
    const out = {};
    for (const k of ["x", "o"]) { const b = B[k]; out[k] = { x: b.x, y: b.y, on: b.on, in: b.in }; }
    return { balls: out, ticks: t, ev, pen, trapHits: [...hitTrap].map(tr => tr.by) };
  }

  // ---------- pravidla (čisté funkce nad stavem) ----------
  const other = p => p === "x" ? "o" : "x";
  const total = (sc, p) => sc[p].reduce((s, v) => s + (v || 0), 0);
  const freshBalls = () => ({ x: { x: 0, y: 0, on: false, in: false }, o: { x: 0, y: 0, on: false, in: false } });
  const capOf = c => c.par + 3;                         // po tolika ranách bez jamky se jamka zapíše za cap+1
  function newGame(seed, first) {
    return { seed, first, hole: 0, ph: "trap", pend: { x: null, o: null }, traps: [], balls: freshBalls(), str: { x: 0, o: 0 }, done: { x: false, o: false },
      sc: { x: [], o: [] }, pars: [], p: first, hf: first, n: 0,
      stats: { x: { past: 0, mokro: 0, eso: 0, low: 0 }, o: { past: 0, mokro: 0, eso: 0, low: 0 } }, win: "" };
  }
  const courseOf = g => hole(g.seed, g.hole);
  // kdo vybírá ze 3 pastí místo ze 2: kdo ztrácí aspoň 2 rány
  const trailing = (g, p) => total(g.sc, p) - total(g.sc, other(p)) >= 2;
  function offer(g, who) {
    const r = rng(g.seed ^ hashStr("past" + g.hole + who));
    return shuffle(TRAP_KINDS, r).slice(0, trailing(g, who) ? 3 : 2);
  }
  // past pokládají oba naráz a naslepo; hra jede dál, až jsou obě
  function placeTrap(g, by, t) {
    if (g.ph !== "trap" || g.pend[by] !== null) return null;
    const tr = { by, k: t.k, x: t.x | 0, y: t.y | 0, a: TRAPS[t.k] && TRAPS[t.k].rot ? (((t.a | 0) % ROT) + ROT) % ROT : 0 };
    const ok = offer(g, by).includes(t.k) && trapValid(courseOf(g), tr);
    const ng = { ...g, pend: { ...g.pend, [by]: ok ? tr : false } };
    if (ng.pend.x !== null && ng.pend.o !== null) {
      ng.traps = [ng.pend.x, ng.pend.o].filter(Boolean);
      ng.ph = "play"; ng.p = g.hf;
    }
    return ng;
  }
  function playShot(g, by, A, P) {
    if (g.ph !== "play" || g.p !== by || g.done[by]) return null;
    A = (((A | 0) % ANG) + ANG) % ANG; P = Math.max(40, Math.min(1000, P | 0));
    const c = courseOf(g);
    const res = shoot({ c, traps: g.traps, balls: g.balls, n: g.n }, { by, A, P });
    const str = { ...g.str, [by]: g.str[by] + 1 + res.pen };
    const done = { ...g.done };
    const stats = { x: { ...g.stats.x }, o: { ...g.stats.o } };
    for (const k of ["x", "o"]) if (res.balls[k].in && !g.balls[k].in) done[k] = true;
    if (res.balls[by].in && str[by] === 1) stats[by].eso++;
    if (res.pen) stats[by].mokro += res.pen;
    for (const owner of res.trapHits) if (owner !== by) stats[owner].past++;
    if (!done[by] && str[by] >= capOf(c)) { done[by] = true; str[by] = capOf(c) + 1; }
    let ng = { ...g, balls: res.balls, str, done, stats, n: g.n + 1 };
    if (done.x && done.o) {
      const sc = { x: [...g.sc.x, str.x], o: [...g.sc.o, str.o] };
      ng.sc = sc; ng.pars = [...g.pars, c.par];
      for (const k of ["x", "o"]) { const d = total(sc, k) - total(sc, other(k)); if (d > stats[k].low) stats[k].low = d; }
      if (g.hole === 5) {
        const tx = total(sc, "x"), to = total(sc, "o");
        ng.ph = "end"; ng.win = tx < to ? "x" : to < tx ? "o" : "="; ng.p = "";
      } else {
        // čest odpalu: kdo jamku zahrál líp, začíná další; při shodě se střídá
        const hf = str.x < str.o ? "x" : str.o < str.x ? "o" : other(g.hf);
        ng = { ...ng, hole: g.hole + 1, ph: "trap", pend: { x: null, o: null }, traps: [], balls: freshBalls(), str: { x: 0, o: 0 }, done: { x: false, o: false }, hf, p: hf };
      }
    } else ng.p = done[other(by)] ? by : other(by);
    return { g: ng, res };
  }
  // Celá partie z obou deníků akcí. Vrací konečný stav a kroky (pro animaci a testy).
  // Akce: past {t:"t", h, k, x, y, a}, úder {t:"s", n, A, P}. Neplatná akce se nezahodí potichu: past propadne, úder se přeskočí.
  function replay(seed, first, logs, upto) {
    let g = newGame(seed, first);
    const steps = [];
    for (let guard = 0; guard < 400; guard++) {
      if (upto != null && steps.length >= upto) break;
      if (g.ph === "trap") {
        const need = ["x", "o"].filter(p => g.pend[p] === null);
        let moved = false;
        for (const p of need) {
          const a = (logs[p] || []).find(q => q.t === "t" && q.h === g.hole);
          if (a) { const g0 = g; g = placeTrap(g, p, a); steps.push({ kind: "t", by: p, a, g0, g }); moved = true; }
        }
        if (!moved) break;
      } else if (g.ph === "play") {
        const p = g.p, a = (logs[p] || []).find(q => q.t === "s" && q.n === g.n + 1);
        if (!a) break;
        const g0 = g, r = playShot(g, p, a.A, a.P);
        if (!r) break;
        g = r.g; steps.push({ kind: "s", by: p, a, g0, g, res: r.res });
      } else break;
    }
    return { g, steps };
  }
  function titles(g, series) {
    const out = [];
    for (const k of ["x", "o"]) if (g.stats[k].eso) out.push({ p: k, t: g.stats[k].eso > 1 ? `Eso ×${g.stats[k].eso}` : "Eso", d: "Jamka jednou ranou." });
    const px = g.stats.x.past, po = g.stats.o.past;
    if (px !== po && Math.max(px, po) > 0) out.push({ p: px > po ? "x" : "o", t: "Cena za zlomyslnost", d: `Tvoje pasti chytily soupeře ${Math.max(px, po)}×.` });
    const mx = g.stats.x.mokro, mo = g.stats.o.mokro;
    if (Math.max(mx, mo) >= 2 && mx !== mo) out.push({ p: mx > mo ? "x" : "o", t: "Mokré ponožky", d: `Žbluňk ${Math.max(mx, mo)}×.` });
    if ((g.win === "x" || g.win === "o") && g.stats[g.win].low >= 3) out.push({ p: g.win, t: "Návrat z hrobu", d: `Výhra po ztrátě ${g.stats[g.win].low} ran.` });
    if (series) { const [wx, wo] = series; if (Math.max(wx, wo) >= 3 && wx !== wo) out.push({ p: wx > wo ? "x" : "o", t: Math.max(wx, wo) >= 5 ? "Postrach hřiště" : "Vede sérii", d: `Série ${Math.max(wx, wo)}:${Math.min(wx, wo)}.` }); }
    return out.slice(0, 4);
  }

  const API = { PI, TAU, dsin, dcos, rng, hashStr, R, CUP_R, VMAX, ANG, ROT, VOID, FLOOR, WATER, BRIDGE, THEMES, THEME_NAMES, MODS, TRAPS, TRAP_KINDS,
    LOUZE_R, KOPEC_R, KOPEC_H, MLYN_R, STENA_H, plan, build, hole, botShot, botPar, surf, where, trapGeom, trapValid, trapHeight, bladeAngle, shoot, segDist,
    other, total, newGame, courseOf, trailing, offer, placeTrap, playShot, replay, titles, capOf };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JM = API;
})(typeof self !== "undefined" ? self : this);
