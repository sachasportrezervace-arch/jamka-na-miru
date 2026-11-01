// node tests/kamera.cjs [seed ...]  – kamera při úderu: jamka, praporek a míček ve volné ploše mezi horním HUD a dolním panelem.
// Ověřuje se PROJEKCÍ do obrazovky (kamera scény → pixely), proti skutečným obdélníkům HUD z DOM, ne odhadem z nastavení kamery.
// Potřebuje server na 8808 (python -m http.server 8808). Výchozí seedy 21 44 7 3 (?mistni=). Hraje celé partie (jamky 1–6, údery 1–STROKES na každé jamce).
// Zařízení: Chromium 1440×900, WebKit iPhone 13 na výšku (390×664), na šířku PŘESNĚ jak ho dává Playwright (`devices["iPhone 13 landscape"]` = 750×342)
// a iPhone na šířku 844×390. Další pravidlo (od 31. 10. večer): když je jamka mimo obrazovku, musí být ve volné ploše míček A NEPŘETRŽITÝ kus cesty
// k jamce dlouhý aspoň min(celá cesta, REACH_TILES) políček (8; na šířku 6, viz REACH_LOW). Dřív se kontrolovalo jen, že jamka není uříznutá, takže „míček + trocha dráhy, jamka nahoře
// mimo obraz“ prošlo (a prošlo i na šířku, kde byla vada vidět). HUD: štítky, pilulka a panel se nesmí zalamovat ani useknout (scrollWidth, počet řádků).
// Pravidla: míček je vždy ve volné ploše a má aspoň 12 px v průměru (na nízkém displeji na šířku 10 px); jamka (obrys, špička tyče i konec látky) je buď CELÁ ve volné ploše,
// nebo CELÁ mimo obrazovku, nikdy napůl pod HUD ani uříznutá; míček sedí v dolní polovině volné plochy (daleká jamka: v dolní třetině až 45 %);
// tlačítko „Oddálit“ (#bCam) leží v panelu, nebo od něj má odstup aspoň 10 px a nepřekrývá dráhu.
// Prostředí: ONLY=desktop,iphone,iphone-sirka,iphone-sirka2 (jen vybraná zařízení), STROKES=2, SHOTS=1 (snímky vad do design/), SCAN=1 (rychle: bez hraní,
// jen první rána všech jamek seedu přenesením míčku na odpaliště; k ladění kamery).
const path = require("path"), fs = require("fs");
const pw = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const BASE = process.env.BASE || "http://127.0.0.1:8808/";
const SEEDS = process.argv.slice(2).length ? process.argv.slice(2) : ["21", "44", "7", "3"];
const STROKES = +process.env.STROKES || 2;          // kolik úderů na jamku se měří (po prvním se míček posune)
const OUT = process.env.OUT || path.join(__dirname, "..", "design");
const DEVICES = [
  { name: "desktop", engine: "chromium", opts: { viewport: { width: 1440, height: 900 } } },
  { name: "iphone", engine: "webkit", opts: { ...pw.devices["iPhone 13"] } },
];
DEVICES.push({ name: "iphone-sirka", engine: "webkit", opts: { ...pw.devices["iPhone 13 landscape"] } });                                   // 750×342
DEVICES.push({ name: "iphone-sirka2", engine: "webkit", opts: { ...pw.devices["iPhone 13 landscape"], viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 } } });   // 844×390
const REACH_TILES = +process.env.REACH || 8, REACH_LOW = +process.env.REACH_LOW || 6;      // na nízkém displeji na šířku (výška < 500) stačí 6: míček musí mít aspoň 10 px a výška volné plochy je ~250 px
if (process.env.ONLY) for (let i = DEVICES.length - 1; i >= 0; i--) if (!process.env.ONLY.split(",").includes(DEVICES[i].name)) DEVICES.splice(i, 1);
const launchOpts = e => e === "chromium" ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } : {};
const wait = (p, ms) => p.waitForTimeout(ms);

async function idle(p, max = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    await p.evaluate(() => window.__jm.scene.skip());
    const s = await p.evaluate(() => window.__jm.state());
    if (!s.busy) return s;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error("busy timeout");
}
async function settle(p) {                           // počká, až kamera dojede (poloha se přestane měnit)
  let prev = null;
  for (let i = 0; i < 40; i++) {
    const cur = await p.evaluate(() => { const c = window.__jm.scene.camera.position; return [c.x, c.y, c.z]; });
    if (prev && Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]) < 0.004) return;
    prev = cur; await wait(p, 220);
  }
}
// měření v prohlížeči: body v pixelech a obdélníky HUD. Parametry: seed a jamka (SCAN přenáší míček na odpaliště jiné jamky)
function measure(arg) {
  const m = window.__jm, sc = m.scene, J = window.JM, s = m.state();
  const seed = arg && arg.seed != null ? arg.seed : s.seed, hole = arg && arg.hole != null ? arg.hole : s.hole;
  const c = J.hole(seed, hole), b = sc.balls[arg && arg.k || s.p];
  const ch = J.surf(c, c.cup[0], c.cup[1]).h, cupR = J.CUP_R * (c.mod === "velka" ? 1.45 : c.mod === "mala" ? 0.8 : 1) + 0.1;
  const pt = (x, y, hh) => { const q = sc.toScreen(x, y, hh); return [q.x, q.y]; };
  const vis = e => { if (!e) return null; const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? [r.left, r.top, r.right, r.bottom] : null; };
  const rects = ["chipX", "chipO", "holePill", "bMenu", "dock", "bCam"].map(id => ({ id, r: vis(document.getElementById(id)) })).filter(q => q.r);
  const ci = Math.floor(b.y) * c.W + Math.floor(b.x);
  // jamka: obrys, špička tyče, konec látky (nezávisle na scéně)
  const cup = [];
  for (let i = 0; i < 8; i++) cup.push(pt(c.cup[0] + Math.cos(i * Math.PI / 4) * cupR, c.cup[1] + Math.sin(i * Math.PI / 4) * cupR, ch));
  cup.push(pt(c.cup[0], c.cup[1], ch + 1.34), pt(c.cup[0] + 0.55, c.cup[1], ch + 1.12), pt(c.cup[0] + 0.55, c.cup[1], ch + 1.3));
  // dráha pod tlačítkem Oddálit: středy políček trati v pixelech
  const tiles = [];
  for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) if (c.type[y * c.W + x]) tiles.push(pt(x + 0.5, y + 0.5, J.surf(c, x + 0.5, y + 0.5).h));
  // cesta z míčku k jamce po vzdálenostním poli (nezávisle na scéně): body v pixelech s kumulativní délkou v políčkách
  const path = []; let pathEnd = null;
  { let x = Math.floor(b.x), y = Math.floor(b.y), len = 0, px = b.x, py = b.y;
    for (let st = 0; st < 120; st++) {
      let best = null;
      for (let a = -1; a <= 1; a++) for (let bb = -1; bb <= 1; bb++) { const X = x + a, Y = y + bb; if (X < 0 || Y < 0 || X >= c.W || Y >= c.H) continue; const d = c.df[Y * c.W + X]; if (d < 1e8 && (!best || d < best.d)) best = { d, X, Y }; }
      if (!best || (best.X === x && best.Y === y)) break;
      x = best.X; y = best.Y; const qx = x + 0.5, qy = y + 0.5; len += Math.hypot(qx - px, qy - py); px = qx; py = qy;
      path.push({ len, q: pt(qx, qy, J.surf(c, qx, qy).h + 0.3) });
      if (best.d === 0) break;
    }
    pathEnd = len + Math.hypot(c.cup[0] - px, c.cup[1] - py); path.push({ len: pathEnd, q: pt(c.cup[0], c.cup[1], ch) }); }
  // texty HUD: jeden řádek, nic useknutého
  const hud = [];
  for (const id of ["chipX", "chipO", "holePill"]) { const e = document.getElementById(id); if (!e || !e.offsetParent) continue; hud.push({ id, h: e.getBoundingClientRect().height, parts: [...e.querySelectorAll(".nm,.cur,.par,b,.mod")].map(q => { const lh = parseFloat(getComputedStyle(q).lineHeight) || parseFloat(getComputedStyle(q).fontSize) * 1.3; return { cls: q.className || q.tagName, t: q.textContent, lines: q.getBoundingClientRect().height / lh, cut: q.scrollWidth > q.clientWidth + 1 }; }) }); }
  const dk = document.getElementById("dock"), dkSay = dk && dk.querySelector(".say");
  if (dkSay && dk.offsetParent) hud.push({ id: "dock", h: dk.getBoundingClientRect().height, parts: [...dk.querySelectorAll(".say b,.say span")].map(q => ({ cls: q.tagName, t: q.textContent, lines: q.getBoundingClientRect().height / (parseFloat(getComputedStyle(q).lineHeight) || parseFloat(getComputedStyle(q).fontSize) * 1.3), cut: q.scrollWidth > q.clientWidth + 1 })) });
  return {
    path, pathEnd, hud, W: innerWidth, H: innerHeight, rects, df: c.df[ci], tiles,
    ball: pt(b.x, b.y, b.g.position.y), ballPx: (() => { const e = sc.camera.matrixWorld.elements, r = 0.16, h0 = b.g.position.y, q1 = sc.toScreen(b.x + e[0] * r, b.y + e[2] * r, h0 + e[1] * r), q0 = sc.toScreen(b.x - e[0] * r, b.y - e[2] * r, h0 - e[1] * r); return Math.hypot(q1.x - q0.x, q1.y - q0.y); })(), cup,
    pads: JSON.stringify(sc.pads, (k, v) => typeof v === "number" ? Math.round(v * 100) / 100 : v), topbar: Math.round(document.getElementById("topbar").getBoundingClientRect().bottom),
    how: sc.cam.fr && sc.cam.fr.how, dist: sc.cam.fr && sc.cam.fr.dist, mode: sc.mode, p: s.p, hole, n: s.n,
  };
}
const inRect = (q, r, pad) => q[0] >= r[0] - pad && q[0] <= r[2] + pad && q[1] >= r[1] - pad && q[1] <= r[3] + pad;
function judge(m) {
  const bad = [];
  const free = q => {
    if (q[0] < 6 || q[0] > m.W - 6 || q[1] < 0 || q[1] > m.H) return false;
    for (const { id, r } of m.rects) if (id !== "bCam" && inRect(q, r, 4)) return false;
    return true;
  };
  const onScr = q => q[0] >= 0 && q[0] <= m.W && q[1] >= 0 && q[1] <= m.H;
  const rc = id => { const e = m.rects.find(q => q.id === id); return e && e.r; };
  if (!free(m.ball)) bad.push(`míček není ve volné ploše (${Math.round(m.ball[0])},${Math.round(m.ball[1])})`);
  const nFree = m.cup.filter(free).length, nOn = m.cup.filter(onScr).length, allFree = nFree === m.cup.length, noneOn = nOn === 0;
  if (!allFree && !noneOn) bad.push(`jamka uříznutá nebo pod HUD: ${nOn} z ${m.cup.length} bodů na obrazovce, ${nFree} ve volné ploše`);
  if (m.ballPx < (m.H < 500 ? 10 : 12)) bad.push(`míček je malý (${m.ballPx.toFixed(1)} px)`);
  // poloha míčku: dolní část volné plochy (mezi spodkem horního HUD a vrchem panelu, jak ji počítá scéna)
  const tops = ["chipX", "chipO", "holePill"].map(rc).filter(Boolean).map(r => r[3]), top = tops.length ? Math.max(...tops) : 0;
  const dock = rc("dock"), narrow = dock && dock[2] - dock[0] < m.W * 0.6, bot = dock && !narrow ? dock[1] : m.H;       // na šířku je panel jen vpravo dole: pod míčkem je volno až do spodku
  const frac = (bot - m.ball[1]) / Math.max(1, bot - top), lim = allFree ? 0.62 : narrow ? 0.7 : 0.45;
  if (frac > lim) bad.push(`míček je moc vysoko (${Math.round(frac * 100)} % od spodu volné plochy, limit ${Math.round(lim * 100)} %)`);
  // dlouhý kus cesty: když je jamka mimo obrazovku, od míčku nepřetržitě aspoň min(celá cesta, REACH_TILES) políček ve volné ploše
  if (!allFree) {
    let reach = 0, blk = null;
    for (const p of m.path) { if (!free(p.q)) { blk = p; break; } reach = p.len; }
    const need = Math.min(m.pathEnd, m.H < 500 ? REACH_LOW : REACH_TILES);
    if (blk && blk.len <= need + 0.01) bad.push(`vidět jen ${reach.toFixed(1)} políček cesty k jamce (další bod ${blk ? blk.len.toFixed(1) : "-"} už ne) (potřeba ${need.toFixed(1)}; z ${m.pathEnd.toFixed(1)}; stojí v cestě bod ${blk ? Math.round(blk.q[0]) + "," + Math.round(blk.q[1]) : "-"} na ${m.W}×${m.H}, míček ${Math.round(m.ball[0])},${Math.round(m.ball[1])}; topbar ${m.topbar}, pads ${m.pads})`);
  }
  // HUD: štítky, pilulka, panel na jeden řádek a nic useknutého
  for (const h of m.hud) for (const q of h.parts) {
    if (h.id !== "dock" && q.lines > 1.4) bad.push(`HUD ${h.id} ${q.cls} „${q.t}“ se zalamuje (${q.lines.toFixed(1)} řádku)`);
    if (q.cut) bad.push(`HUD ${h.id} ${q.cls} „${q.t}“ je useknutý`);
    if (h.id === "dock" && q.cls === "SPAN" && m.H < 500 && q.lines > 1.4) bad.push(`panel: nápověda „${q.t}“ se zalamuje`);
  }
  // tlačítko Oddálit: v panelu, nebo s odstupem od něj a mimo dráhu
  const cam = rc("bCam");
  if (cam && dock) {
    const inside = cam[0] >= dock[0] - 2 && cam[2] <= dock[2] + 2 && cam[1] >= dock[1] - 2 && cam[3] <= dock[3] + 2;
    const gap = Math.max(dock[1] - cam[3], cam[1] - dock[3], dock[0] - cam[2], cam[0] - dock[2]);
    if (!inside) {
      if (gap < 10) bad.push(`Oddálit se lepí na panel (odstup ${Math.round(gap)} px)`);
      const under = m.tiles.filter(q => inRect(q, cam, 0)).length;
      if (under) bad.push(`Oddálit překrývá dráhu (${under} políček)`);
    }
  }
  return { bad, cupIn: allFree };
}

async function run(browser, dev, seed, out) {
  const ctx = await browser.newContext(dev.opts);
  await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch { } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(`${BASE}?mistni=${seed}`);
  await p.waitForFunction(() => window.__jm && window.__jm.state());
  await wait(p, 1200);
  let measured = 0, nearSeen = 0, farSeen = 0, guard = 0, strokesHere = 0, lastHole = -1;
  const t0 = Date.now();
  while (Date.now() - t0 < 600000 && guard++ < 900) {
    const s = await p.evaluate(() => window.__jm.state());
    if (s.ph === "end") break;
    if (s.busy) { await p.evaluate(() => window.__jm.scene.skip()); await wait(p, 60); continue; }
    if (s.ph === "trap") { await p.evaluate(() => window.__jm.autoTrap()); await wait(p, 80); continue; }
    if (s.hole !== lastHole) { lastHole = s.hole; strokesHere = 0; }
    if (s.ph === "play" && !(await p.evaluate(() => !!document.querySelector("#dock .res")))) {
      if (strokesHere < STROKES) {
        await idle(p); await wait(p, 500); await settle(p);
        const m = await p.evaluate(measure), j = judge(m);
        measured++; j.cupIn ? nearSeen++ : farSeen++;
        const tag = `${dev.name} seed ${seed} jamka ${s.hole + 1} rána ${s.n + 1} (${s.p}) df ${m.df.toFixed(0)}`;
        if (j.bad.length) out.bad.push(`${tag}: ${j.bad.join("; ")} [${m.how}, d ${m.dist && m.dist.toFixed(1)}]`);
        if (process.env.SHOTS === "all" || (process.env.SHOTS && j.bad.length)) await p.screenshot({ path: path.join(OUT, `kamera-${j.bad.length ? "vada" : "ok"}-${dev.name}-${seed}-${s.hole + 1}-${s.n + 1}.png`) });
        strokesHere++;
      }
      await p.evaluate(() => { const b = window.__jm.bot(); window.__jm.shoot(b.A, b.P); });
      await wait(p, 60);
      continue;
    }
    await wait(p, 120);
  }
  out.measured += measured; out.near += nearSeen; out.far += farSeen; out.how = out.how || {}; out.errs.push(...errs.map(e => `[${dev.name}/${seed}] ${e}`));
  await ctx.close();
}

// SCAN=1: rychlé měření bez hraní – míček se přenese na odpaliště a do dvou dalších míst každé jamky (df ≈ 70 % a 40 % cesty z odpaliště)
async function runScan(browser, dev, seed, out) {
  const ctx = await browser.newContext(dev.opts);
  await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch { } });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(`${BASE}?mistni=${seed}`);
  await p.waitForFunction(() => window.__jm && window.__jm.state());
  await wait(p, 800);
  await p.evaluate(() => window.__jm.autoTrap()); await wait(p, 200); await p.evaluate(() => window.__jm.autoTrap());
  await idle(p); await wait(p, 600);
  const k = (await p.evaluate(() => window.__jm.state())).p;
  for (let hole = 0; hole < 6; hole++) {
    const spots = await p.evaluate(({ seed, hole }) => {
      const J = window.JM, sc = window.__jm.scene, c = J.hole(seed, hole), dT = c.df[Math.floor(c.tee[1]) * c.W + Math.floor(c.tee[0])], res = [{ x: c.tee[0], y: c.tee[1] }];
      for (const f of [0.7, 0.4]) {
        let best = null;
        for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) { const d = c.df[y * c.W + x]; if (d >= 1e8 || J.where(c, x + 0.5, y + 0.5) !== J.FLOOR) continue; const e = Math.abs(d - dT * f); if (!best || e < best.e) best = { e, x: x + 0.5, y: y + 0.5 }; }
        if (best) res.push({ x: best.x, y: best.y });
      }
      sc.setHole(c); sc.setMode("ball"); return res;
    }, { seed: +seed || seed, hole });
    for (let i = 0; i < spots.length; i++) {
      await p.evaluate(({ k, s }) => { const sc = window.__jm.scene; sc.setBall(k, { x: s.x, y: s.y, on: true, in: false }, true); sc.frameBall(k, true); }, { k, s: spots[i] });
      await wait(p, 350); await settle(p);
      const m = await p.evaluate(measure, { seed: +seed || seed, hole, k }), j = judge(m);
      out.measured++; j.cupIn ? out.near++ : out.far++;
      if (j.bad.length) { out.bad.push(`${dev.name} seed ${seed} jamka ${hole + 1} poloha ${i} df ${m.df.toFixed(0)}: ${j.bad.join("; ")} [${m.how}, d ${m.dist && m.dist.toFixed(1)}]`); if (process.env.SHOTS) await p.screenshot({ path: path.join(OUT, `kamera-vada-${dev.name}-${seed}-${hole + 1}-${i}.png`) }); }
    }
  }
  out.errs.push(...errs.map(e => `[${dev.name}/${seed}] ${e}`));
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const out = { bad: [], measured: 0, near: 0, far: 0, errs: [] };
  for (const dev of DEVICES) {
    const browser = await pw[dev.engine].launch(launchOpts(dev.engine));
    for (const seed of SEEDS) { console.log(`${dev.name} seed ${seed}`); await (process.env.SCAN ? runScan : run)(browser, dev, seed, out); }
    await browser.close();
  }
  console.log(`měřeno ${out.measured} záběrů (jamka celá v záběru: ${out.near}, jamka mimo obrazovku: ${out.far})`);
  for (const b of out.bad) console.log("VADA  " + b);
  for (const e of out.errs.slice(0, 5)) console.log("KONZOLE  " + e);
  const ok = !out.bad.length && !out.errs.length;
  console.log(ok ? "PASS  jamka s praporkem je vždy celá ve volné ploše nebo celá mimo obrazovku, míček ve volné ploše" : `FAIL  ${out.bad.length} vad kamery, ${out.errs.length} chyb konzole`);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
