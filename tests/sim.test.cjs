// node tests/sim.test.cjs  – testy jádra (src/sim.js) bez prohlížeče.
//  1) shoot je deterministický (stejné vstupy = stejný JSON), včetně pastí a dvou míčků
//  2) replay je deterministický a shoduje se s postupným playShot
//  3) generátor: 50 seedů × 6 jamek je hratelných (par 2–5, žádný pád, bot dojde do jamky)
//  4) tři partie za sebou (3 různé seedy jako v aplikaci) mají různé jamky
// Vypíše PASS/FAIL, skončí nenulovým kódem, když něco selže.
const J = require("../src/sim.js");

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const ms = t0 => Math.round(performance.now() - t0);

// ---------- pomocné: místo pro past a bot, který odehraje celou partii ----------
function trapSpot(g, who) {
  const c = J.courseOf(g), k = J.offer(g, who)[0], rot = J.TRAPS[k].rot ? 0 : 0;
  const dTee = c.df[Math.floor(c.tee[1]) * c.W + Math.floor(c.tee[0])];
  const cand = [];
  for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) { const d = c.df[y * c.W + x]; if (d < 1e8) cand.push({ x: x + 0.5, y: y + 0.5, s: Math.abs(d - dTee * 0.5) }); }
  cand.sort((a, b) => a.s - b.s);
  for (const q of cand) { const t = { k, x: Math.round(q.x * 20), y: Math.round(q.y * 20), a: rot, by: who }; if (J.trapValid(c, t)) return { t: "t", h: g.hole, k, x: t.x, y: t.y, a: rot }; }
  return { t: "t", h: g.hole, k, x: 0, y: 0, a: 0 };       // neplatná past propadne, i to je platný vstup
}
function playWholeGame(seed, first) {
  let g = J.newGame(seed, first);
  const logs = { x: [], o: [] };
  for (let guard = 0; guard < 400 && g.ph !== "end"; guard++) {
    if (g.ph === "trap") {
      for (const p of ["x", "o"]) if (g.pend[p] === null) { const a = trapSpot(g, p); logs[p].push(a); g = J.placeTrap(g, p, a); }
    } else {
      const p = g.p, c = J.courseOf(g);
      const balls = g.balls[p].on ? g.balls : { ...g.balls, [p]: { x: c.tee[0], y: c.tee[1], on: true, in: false } };
      const b = J.botShot(c, balls, p);
      logs[p].push({ t: "s", n: g.n + 1, A: b.A, P: b.P });
      g = J.playShot(g, p, b.A, b.P).g;
    }
  }
  return { g, logs };
}

// ---------- 1) shoot ----------
{
  const t0 = performance.now(); let same = 0, total = 0, moved = 0;
  for (const seed of [1, 7, 42, 2026]) for (const hi of [0, 2, 5]) {
    const c = J.hole(seed, hi);
    const traps = [{ by: "x", k: "mlyn", x: Math.round((c.tee[0] + c.cup[0]) / 2 * 20), y: Math.round((c.tee[1] + c.cup[1]) / 2 * 20), a: 0 }];
    const balls = { x: { x: c.tee[0], y: c.tee[1], on: true, in: false }, o: { x: c.tee[0] + 0.2, y: c.tee[1], on: true, in: false } };
    for (const [A, P] of [[0, 400], [1000, 700], [2048, 1000], [3100, 150], [777, 555]]) {
      const run = () => JSON.stringify(J.shoot({ c, traps, balls, n: 3 }, { by: "o", A, P }));
      const r1 = run(), r2 = run(); total++; if (r1 === r2) same++;
      const o = JSON.parse(r1); if (Math.abs(o.balls.o.x - balls.o.x) + Math.abs(o.balls.o.y - balls.o.y) > 0.05) moved++;
    }
  }
  check("shoot: stejné vstupy = stejný JSON", same === total, `${same}/${total} shodných`);
  check("shoot: údery opravdu hýbou míčkem (test není prázdný)", moved >= total / 2, `${moved}/${total}`);
  console.log(`      (${ms(t0)} ms)`);
}

// ---------- 2) replay ----------
{
  const t0 = performance.now();
  const seed = J.hashStr("test-room:0"), { g, logs } = playWholeGame(seed, "x");
  check("partie botem dojde do konce (6 jamek)", g.ph === "end" && g.sc.x.length === 6 && g.sc.o.length === 6, `ph ${g.ph}, ${g.sc.x.length}/${g.sc.o.length} jamek`);
  const a = JSON.stringify(J.replay(seed, "x", logs)), b = JSON.stringify(J.replay(seed, "x", logs));
  check("replay: dvě přehrání stejných deníků = stejný JSON", a === b, `${a.length} znaků`);
  const r = J.replay(seed, "x", logs);
  check("replay: konečný stav = stav z postupného playShot/placeTrap", JSON.stringify(r.g) === JSON.stringify(g));
  const steps = r.steps.length, half = J.replay(seed, "x", logs, Math.floor(steps / 2));
  check("replay: prefix (upto) odpovídá prvním krokům celé partie", half.steps.length === Math.floor(steps / 2) && JSON.stringify(half.steps.map(s => s.g)) === JSON.stringify(r.steps.slice(0, half.steps.length).map(s => s.g)), `${half.steps.length}/${steps} kroků`);
  const sw = J.replay(seed, "x", { x: logs.o, o: logs.x });
  check("replay: prohozené deníky dají jiný stav (nejde o konstantu)", JSON.stringify(sw.g) !== JSON.stringify(r.g) || sw.steps.length !== r.steps.length);
  const rr = J.replay(seed, "x", { x: logs.x.slice(0, 3), o: logs.o.slice(0, 2) });
  check("replay: neúplné deníky se zastaví v rozumném stavu (bez pádu)", rr.g.ph !== undefined && rr.steps.length > 0, `${rr.steps.length} kroků, ph ${rr.g.ph}`);
  console.log(`      (${ms(t0)} ms)`);
}

// ---------- 3) generátor ----------
{
  const t0 = performance.now(), bad = [], pars = { 2: 0, 3: 0, 4: 0, 5: 0 }, themes = {}, mods = {};
  let slow = 0, maxMs = 0, fallbacks = 0, n = 0;
  for (let i = 1; i <= 50; i++) {
    const seed = J.hashStr("gen:" + i);
    for (let hi = 0; hi < 6; hi++) {
      const t1 = performance.now();
      try {
        const c = J.hole(seed, hi);
        const dt = performance.now() - t1; maxMs = Math.max(maxMs, dt); if (dt > 2000) slow++;
        n++;
        const dTee = c.df[Math.floor(c.tee[1]) * c.W + Math.floor(c.tee[0])];
        const playable = Number.isInteger(c.par) && c.par >= 2 && c.par <= 5 && Number.isInteger(c.bot) && c.bot >= 1 && c.bot <= 5 && dTee < 1e8 && c.tee && c.cup;
        if (!c.bot) fallbacks++;
        if (!playable) bad.push(`seed ${i} jamka ${hi + 1}: par ${c.par}, bot ${c.bot}, df ${dTee}`);
        else { pars[c.par]++; themes[c.th] = (themes[c.th] || 0) + 1; mods[c.mod] = (mods[c.mod] || 0) + 1; }
      } catch (e) { bad.push(`seed ${i} jamka ${hi + 1}: PÁD ${e.message}`); }
    }
  }
  check("generátor: 50 seedů × 6 jamek, všechny hratelné (par 2–5, bot dojde do jamky)", bad.length === 0 && n === 300, bad.length ? bad.slice(0, 3).join(" | ") : `${n} jamek`);
  check("generátor: žádná nouzová rovinka (fallback)", fallbacks === 0, `${fallbacks} nouzových`);
  check("generátor: žádný pád a žádná jamka nad 2 s", slow === 0, `nejdéle ${Math.round(maxMs)} ms`);
  check("generátor: pary jsou rozmanité (aspoň 3 různé hodnoty)", Object.values(pars).filter(v => v > 0).length >= 3, JSON.stringify(pars));
  console.log(`      témata ${JSON.stringify(themes)}, modifikátory ${JSON.stringify(mods)}  (${ms(t0)} ms)`);
}

// ---------- 4) tři partie za sebou mají různé jamky ----------
{
  const sig = (seed, hi) => { const c = J.hole(seed, hi); let h = 2166136261; for (const v of c.type) h = Math.imul(h ^ v, 16777619) >>> 0; return [c.th, c.mod, c.W + "x" + c.H, c.par, h, c.tee.join(","), c.cup.join(",")].join("|"); };
  const rooms = ["mistni-demo", "Zk4Qp9aT12", "a1b2c3d4e5"];
  let allOk = true; const lines = [];
  for (const room of rooms) {
    const seeds = [0, 1, 2].map(gi => J.hashStr(room + ":" + gi));
    const games = seeds.map(s => [0, 1, 2, 3, 4, 5].map(hi => sig(s, hi)));
    const gameSig = games.map(g => g.join("#"));
    const distinctGames = new Set(gameSig).size === 3;
    const flat = games.flat(), dupHoles = flat.length - new Set(flat).size;
    const themeOrder = seeds.map(s => [0, 1, 2, 3, 4, 5].map(hi => J.hole(s, hi).th[0]).join(""));
    const distinctThemes = new Set(themeOrder).size;
    allOk = allOk && distinctGames && dupHoles === 0;
    lines.push(`${room}: partie různé ${distinctGames}, shodných jamek ${dupHoles}/18, pořadí témat ${themeOrder.join(" ")}`);
  }
  check("3 partie za sebou (seed = hash(místnost:číslo partie)) mají různé jamky, žádná jamka se neopakuje", allOk, lines.join(" ; "));
  const s0 = J.hashStr("r:0"), s1 = J.hashStr("r:1");
  check("seed se mezi partiemi mění", s0 !== s1);
}

console.log(`\n${pass}/${pass + fail} PASS${fail ? `, ${fail} FAIL` : ""}`);
process.exit(fail ? 1 : 0);
