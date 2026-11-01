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

// ---------- 5) pasti: velikost odpovídá kreslení, nepřečnívají přes zeď a nejdou přes sebe ----------
{
  const t0 = performance.now();
  // a) clear musí pokrýt viditelnou velikost ze scene.js (mlýnek: prstenec MLYN_R+0.08, louže: LOUZE_R, krtinec: sukně KOPEC_R)
  const vis = { mlyn: J.MLYN_R + 0.08, louze: J.LOUZE_R, kopec: J.KOPEC_R };
  check("pasti: clear >= viditelný poloměr (mlýnek, louže, krtinec)", Object.keys(vis).every(k => J.TRAPS[k].clear >= vis[k] - 1e-9), Object.keys(vis).map(k => `${k} ${J.TRAPS[k].clear}/${vis[k].toFixed(2)}`).join(", "));
  check("pasti: louže má ~0,8 a krtinec je menší než dřív (<= 0,9)", J.TRAPS.louze.clear >= 0.8 && J.KOPEC_R <= 0.9);
  // b) každé platné místo má celou viditelnou plochu na trávníku (96 bodů po obvodu; pérovačka po celé délce)
  let spots = 0, over = 0;
  for (let i = 1; i <= 12; i++) for (let hi = 0; hi < 6; hi++) {
    const c = J.hole(J.hashStr("pasti:" + i), hi);
    for (const k of J.TRAP_KINDS) for (let q = 0; q < 60; q++) {
      const x = Math.round((0.5 + (q * 7919 % (c.W * 20)) / 20) * 20), y = Math.round((0.5 + (q * 104729 % (c.H * 20)) / 20) * 20), a = q % J.ROT;
      const t = { k, x, y, a: J.TRAPS[k].rot ? a : 0 };
      if (!J.trapValid(c, t)) continue;
      spots++;
      const g = J.trapGeom(t), pts = [], R = J.TRAPS[k].clear;
      for (let n = 0; n < 96; n++) pts.push([g.x + R * Math.cos((n + 0.5) / 96 * J.TAU), g.y + R * Math.sin((n + 0.5) / 96 * J.TAU)]);
      if (k === "stena") for (let s = -1; s <= 1; s += 0.1) pts.push([g.x + g.ux * J.STENA_H * s, g.y + g.uy * J.STENA_H * s]);
      if (pts.some(p => J.where(c, p[0], p[1]) !== J.FLOOR)) over++;
    }
  }
  check("pasti: žádná platná past nepřečnívá přes zeď ani vodu", spots > 200 && over === 0, `${spots} platných míst, ${over} přečnívajících`);
  // c) překryv: obě pasti na stejném místě
  const st = { same: 0, moved: 0, dropped: 0, order: 0, bad: 0, cases: 0 };
  for (let i = 1; i <= 40; i++) for (const hi of [0, 2, 4]) {
    const seed = J.hashStr("kryt:" + i), g0 = { ...J.newGame(seed, "x"), hole: hi }, c = J.courseOf(g0);
    const kx = J.offer(g0, "x")[0], ko = J.offer(g0, "o")[0];
    const dTee = c.df[Math.floor(c.tee[1]) * c.W + Math.floor(c.tee[0])], cand = [];
    for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) { const d = c.df[y * c.W + x]; if (d < 1e8) cand.push({ x: x + 0.5, y: y + 0.5, s: Math.abs(d - dTee * 0.5) }); }
    cand.sort((a, b) => a.s - b.s);
    const tx = cand.map(q => ({ k: kx, x: Math.round(q.x * 20), y: Math.round(q.y * 20), a: 0, by: "x" })).find(t => J.trapValid(c, t));
    if (!tx) continue;
    const to = { k: ko, x: tx.x, y: tx.y, a: 0, by: "o" };
    if (!J.trapValid(c, to)) continue;
    st.cases++;
    const a = J.placeTrap(J.placeTrap(g0, "x", tx), "o", to), b = J.placeTrap(J.placeTrap(g0, "o", to), "x", tx);
    if (JSON.stringify(a.traps) !== JSON.stringify(b.traps)) st.order++;
    const x = a.traps.find(t => t.by === "x"), o = a.traps.find(t => t.by === "o");
    if (!x) st.bad++;
    if (o) {
      if (J.overlaps(x, o) || !J.trapValid(c, o)) st.bad++;
      if (o.x !== to.x || o.y !== to.y) st.moved++; else st.same++;
    } else { st.dropped++; if (a.pend.o !== false) st.bad++; }
  }
  check("pasti: dvě pasti na stejném místě se nikdy nepřekryjí (past 'o' se posune nebo propadne)", st.cases >= 40 && st.bad === 0 && st.same === 0, JSON.stringify(st));
  check("pasti: výsledek nezávisí na tom, kdo past postavil první", st.order === 0, `${st.order} rozdílů z ${st.cases}`);
  // c2) pevný případ, kdy pro past 'o' není v okolí 3 políček žádné platné místo: propadne (pend.o === false)
  {
    const g0 = { ...J.newGame(836490882, "x"), hole: 0 }, tx = { k: "mlyn", x: 150, y: 80, a: 0 }, to = { k: "mlyn", x: 150, y: 80, a: 0 };   // seed nalezený hledáním (hashStr("propad:23")), oba mají v nabídce mlýnek
    const a = J.placeTrap(J.placeTrap(g0, "x", tx), "o", to), b = J.placeTrap(J.placeTrap(g0, "o", to), "x", tx);
    check("pasti: když pro past 'o' není volné místo, propadne (pend.o false, zůstane past x) a ne podle pořadí", a.pend.o === false && a.traps.length === 1 && a.traps[0].by === "x" && a.ph === "play" && JSON.stringify(a.traps) === JSON.stringify(b.traps) && b.pend.o === false);
  }
  // d) bez překryvu se nic neposouvá
  const gA = { ...J.newGame(J.hashStr("kryt:1"), "x"), hole: 1 };
  const sx = trapSpot(gA, "x"), gB = J.placeTrap(gA, "x", sx), so = trapSpot(gB, "o"), gC = J.placeTrap(gB, "o", so);
  const px = gC.pend.x, po = gC.pend.o;
  check("pasti: když se nekryjí, nic se neposouvá", !(px && po) || J.overlaps(px, po) || (gC.traps[1].x === po.x && gC.traps[1].y === po.y));
  console.log(`      (${ms(t0)} ms; překryv: ${st.moved} posunuto, ${st.dropped} propadlo z ${st.cases})`);
}

// ---------- 6) první jamka je pestrá a místní režim bere seed z ?mistni= ----------
{
  const skel = c => c.legs.map(l => l.d + (l.f ? l.f[0] : "-")).join("") + c.W + "x" + c.H;
  const first20 = new Set(); for (let i = 1; i <= 20; i++) first20.add(skel(J.hole(J.hashStr("g:" + i), 0)));
  check("první jamka: tvar (zatáčky, rysy, rozměr) se liší napříč 20 seedy aspoň v 15 případech", first20.size >= 15, `${first20.size}/20 různých`);
  const legsN = new Set(); for (let i = 1; i <= 40; i++) legsN.add(J.hole(J.hashStr("g:" + i), 0).legs.length);
  check("první jamka: 2 i 3 nohy (lehčí rozehrání, jen jeden rys)", legsN.has(2) && legsN.has(3) && !legsN.has(4), [...legsN].join(","));
  const seeds = ["3", "7", "11"].map(n => J.hashStr("mistni-" + n + ":0"));
  check("místní režim: seedy ?mistni=3/7/11 jsou tři různé a první jamky se liší", new Set(seeds).size === 3 && new Set(seeds.map(s => skel(J.hole(s, 0)))).size === 3, seeds.join(","));
  const main = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "main.js"), "utf8");
  check("místní režim: main.js skládá room.id z Q.get(\"mistni\") a seed z room.id + gi", /Q\.get\("mistni"\)/.test(main) && /id: "mistni-" \+ seed/.test(main) && /J\.hashStr\(room\.id \+ ":" \+ gi\)/.test(main));
}

// ---------- 7) první jamka není zbytečně trestající; bot sólo režimu hraje po lidsku, ale dá se porazit ----------
{
  const pars = {}; for (let i = 1; i <= 100; i++) { const p = J.hole(J.hashStr("g:" + i), 0).par; pars[p] = (pars[p] || 0) + 1; }
  check("první jamka: par 2–3 aspoň v 90 ze 100 seedů (lehké rozehrání, bez par 5)", (pars[2] || 0) + (pars[3] || 0) >= 90 && !pars[5], JSON.stringify(pars));
  // bot „po lidsku“ (botHuman): deterministický, platné údery, v průměru lehce nad par; dokonalý bot (botShot) ho porazí jen někdy
  let strokes = 0, par = 0, same = true, perfect = 0, holes = 0, beat = 0;
  const t0 = performance.now();
  for (let seed = 1; seed <= 12; seed++) for (let h = 0; h < 6; h++) {
    const c = J.hole(seed * 7919, h); par += c.par; holes++;
    const play = fn => {
      let balls = { x: { x: 0, y: 0, on: false, in: false }, o: { x: c.tee[0], y: c.tee[1], on: true, in: false } }, k = 0;
      while (k < J.capOf(c)) { const b = fn(balls, k), res = J.shoot({ c, traps: [], balls, n: k }, { by: "o", A: b.A, P: b.P }); balls = res.balls; k += 1 + res.pen; if (balls.o.in) break; }
      return k;
    };
    const hum = play((balls, k) => J.botHuman(c, balls, "o", [], k, seed + ":" + h + ":" + k));
    const hum2 = play((balls, k) => J.botHuman(c, balls, "o", [], k, seed + ":" + h + ":" + k));
    const per = play(balls => J.botShot({ ...c }, balls, "o"));
    if (hum !== hum2) same = false;
    strokes += hum; perfect += per; if (per < hum) beat++;
  }
  check("botHuman: deterministický (stejný klíč = stejná rána, 72 jamek dvakrát)", same);
  check("botHuman: v průměru lehce nad par (1,0–1,5× par), tedy ne dokonalý ani hloupý", strokes / par >= 1.0 && strokes / par <= 1.5, `${strokes} ran / par ${par} = ${(strokes / par).toFixed(2)}, ${ms(t0)} ms`);
  check("botHuman: dokonalý bot ho porazí jen na části jamek (s botem se dá utkat)", beat > 0 && beat < holes, `dokonalý lepší ${beat}× z ${holes} jamek, ran dokonalého ${perfect}`);
}

// ---------- 8) kolo 1. 11.: nové pasti, zábradlí mostů, žádné par 2 ve finále ----------
{
  const t0 = performance.now();
  // a) finále nikdy par 2 a nejvýš jedna jamka par 2 za partii; náledí nikdy na mostě
  let finals = 0, multi = 0, ledMost = 0;
  for (let i = 1; i <= 40; i++) {
    const seed = J.hashStr("kolo:" + i), hs = [0, 1, 2, 3, 4, 5].map(h => J.hole(seed, h));
    if (hs[5].par === 2) finals++;
    if (hs.filter(c => c.par === 2).length > 1) multi++;
    for (const c of hs) if (c.mod === "led" && c.legs.some(l => l.f === "most")) ledMost++;
  }
  check("generátor: finále bez paru 2, max. jedna jamka par 2 za partii, náledí nikdy s mostem (40 partií)", !finals && !multi && !ledMost, `finále par 2: ${finals}, víc par 2: ${multi}, náledí+most: ${ledMost}`);
  // b) most má zábradlí na každé hraně prkna, za kterou je voda
  let bridges = 0, rails = 0;
  for (let i = 1; i <= 40 && bridges < 10; i++) for (let h = 0; h < 6; h++) {
    const c = J.hole(J.hashStr("kolo:" + i), h); if (![...c.type].includes(J.BRIDGE)) continue;
    bridges++; if (c.segs.some(s => s[6] === 1)) rails++;
  }
  check("mosty: každá jamka s mostem má zábradlí", bridges >= 5 && rails === bridges, `${rails}/${bridges}`);
  // c) fukar: pomalý průjezd proudem míček odnese stranou, stojící míček v proudu nechá být, vlastní past nepůsobí
  const c = J.hole(J.hashStr("kolo:3"), 1), ball = (x, y) => ({ x: { x, y, on: true, in: false }, o: { x: 0, y: 0, on: false, in: false } });
  let fk = null;
  for (let y = 0; y < c.H && !fk; y++) for (let x = 0; x < c.W && !fk; x++) for (let a = 0; a < J.ROT; a += 4) {
    const t = { by: "o", k: "fukar", x: x * 20 + 10, y: y * 20 + 10, a };
    const g = J.trapGeom(t), bx = g.x + g.ux * 1.0, by = g.y + g.uy * 1.0;
    if (J.trapValid(c, t) && J.where(c, bx - g.uy * 1.2, by + g.ux * 1.2) === J.FLOOR && J.where(c, bx, by) === J.FLOOR && J.where(c, bx + g.uy * 1.2, by - g.ux * 1.2) === J.FLOOR) { fk = { t, g, bx, by }; break; }
  }
  if (fk) {
    // míček jede napříč proudem (kolmo na fukar) z místa 0,9 políčka bokem
    const sx = fk.bx - fk.g.uy * 0.9, sy = fk.by + fk.g.ux * 0.9, A = Math.round(Math.atan2(-fk.g.ux, fk.g.uy) / J.TAU * J.ANG + J.ANG) % J.ANG;
    const run = traps => J.shoot({ c, traps, balls: ball(sx, sy), n: 0 }, { by: "x", A, P: 260 });
    const free = run([]), blown = run([fk.t]), own = run([{ ...fk.t, by: "x" }]);
    const along = r => (r.balls.x.x - sx) * fk.g.ux + (r.balls.x.y - sy) * fk.g.uy;
    check("fukar: projíždějící míček odnese po proudu, vlastní fukar nepůsobí", along(blown) > along(free) + 0.15 && JSON.stringify(own.balls) === JSON.stringify(free.balls), `po proudu ${along(free).toFixed(2)} → ${along(blown).toFixed(2)}`);
    const rest = J.shoot({ c, traps: [fk.t], balls: { x: { x: sx, y: sy, on: true, in: false }, o: { x: fk.bx, y: fk.by, on: true, in: false } }, n: 0 }, { by: "x", A: (A + J.ANG / 2) % J.ANG, P: 120 });
    check("fukar: stojící míček v proudu zůstane ležet", Math.abs(rest.balls.o.x - fk.bx) < 1e-9 && Math.abs(rest.balls.o.y - fk.by) < 1e-9);
  } else check("fukar: nalezeno místo pro test", false);
  // d) vysavač: pomalý míček kolem něj skončí na robotovi, rychlý projede
  let vs = null;
  for (let y = 0; y < c.H && !vs; y++) for (let x = 0; x < c.W && !vs; x++) { const t = { by: "o", k: "vysavac", x: x * 20 + 10, y: y * 20 + 10, a: 0 }; if (J.trapValid(c, t) && J.where(c, t.x / 20 - 1.5, t.y / 20 + 0.45) === J.FLOOR && J.where(c, t.x / 20 + 1.5, t.y / 20 + 0.45) === J.FLOOR) vs = t; }
  if (vs) {
    const vx = vs.x / 20, vy = vs.y / 20, b0 = ball(vx - 1.5, vy + 0.45);
    const slow = J.shoot({ c, traps: [vs], balls: b0, n: 0 }, { by: "x", A: 0, P: 260 }), fast = J.shoot({ c, traps: [vs], balls: b0, n: 0 }, { by: "x", A: 0, P: 700 });
    const d = r => Math.hypot(r.balls.x.x - vx, r.balls.x.y - vy);
    check("vysavač: pomalý míček vysaje (skončí na robotovi), rychlý projede", d(slow) < J.VYS_IN && d(fast) > J.VYS_R, `pomalý ${d(slow).toFixed(2)}, rychlý ${d(fast).toFixed(2)}`);
  } else check("vysavač: nalezeno místo pro test", false);
  // e) žádný úder s novými pastmi nedojde na limit tiků (míček se u zdi v proudu netřese donekonečna)
  let shots = 0, maxT = 0;
  for (let i = 1; i <= 6; i++) for (const h of [1, 3]) {
    const cc = J.hole(J.hashStr("kolo:" + i), h), r = J.rng(i * 31 + h), tr = [];
    for (const k of ["fukar", "vysavac"]) for (let q = 0; q < 400 && tr.filter(t => t.k === k).length < 1; q++) { const t = { by: "o", k, x: Math.floor(r() * cc.W * 20), y: Math.floor(r() * cc.H * 20), a: Math.floor(r() * J.ROT) }; if (J.trapValid(cc, t)) tr.push(t); }
    for (let s = 0; s < 24; s++) { const res = J.shoot({ c: cc, traps: tr, balls: ball(cc.tee[0], cc.tee[1]), n: s }, { by: "x", A: s * 171 % J.ANG, P: 150 + s * 37 % 850 }); shots++; if (res.ticks > maxT) maxT = res.ticks; }
  }
  check("nové pasti: žádný úder nedojde na limit tiků (288 úderů)", shots === 288 && maxT < 2399, `nejdelší ${maxT} tiků`);
  console.log(`      (${ms(t0)} ms)`);
}

console.log(`\n${pass}/${pass + fail} PASS${fail ? `, ${fail} FAIL` : ""}`);
process.exit(fail ? 1 : 0);
