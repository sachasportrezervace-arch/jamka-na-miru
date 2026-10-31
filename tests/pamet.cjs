// node tests/pamet.cjs [seed] – únik paměti scény: dohraje celou partii (bot) a po každé jamce vypíše renderer.info (geometrie, textury, programy)
// a počet objektů ve scéně. Výchozí: WebKit iPhone 13 na ŠÍŘKU, seed 3 (tam spadl „Page crashed“). Potřebuje server na 8808.
// Selže (exit 1), když počet geometrií / textur / objektů ve scéně po jamkách roste, nebo stránka spadne.
const path = require("path");
const pw = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const BASE = process.env.BASE || "http://127.0.0.1:8808/";
const SEED = process.argv[2] || "3";
const DEV = process.env.DEV || "iPhone 13 landscape";
const ENGINE = process.env.ENGINE || "webkit";
const wait = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const browser = await pw[ENGINE].launch(ENGINE === "chromium" ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } : {});
  const ctx = await browser.newContext(ENGINE === "chromium" ? { viewport: { width: 1440, height: 900 } } : { ...pw.devices[DEV] });
  await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch { } });
  const p = await ctx.newPage();
  let crashed = false; const errs = [];
  p.on("crash", () => { crashed = true; });
  p.on("pageerror", e => errs.push(e.message));
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(`${BASE}?mistni=${SEED}`);
  await p.waitForFunction(() => window.__jm && window.__jm.state());
  await wait(p, 1200);
  // živé geometrie a materiály ve scéně (podle průchodu stromem) proti tomu, co drží renderer (info.memory): rozdíl = osiřelé, neuvolněné
  const snap = () => p.evaluate(() => {
    const sc = window.__jm.scene, r = sc.renderer.info, geos = new Set(), mats = new Set(); let objs = 0;
    sc.root.traverse(o => { objs++; if (o.geometry) geos.add(o.geometry.uuid); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m.uuid); });
    return { geo: r.memory.geometries, tex: r.memory.textures, prog: r.programs ? r.programs.length : -1, live: geos.size, mats: mats.size, objs };
  });
  // zátěž ducha pasti: tažení prstem přestavuje ducha desítkykrát za sekundu; geometrie se nesmí hromadit
  const ghost = await p.evaluate(async () => {
    const sc = window.__jm.scene, J = window.JM, st = window.__jm.state(), c = J.hole(st.seed, st.hole), g0 = sc.renderer.info.memory.geometries;
    const k = J.offer(window.__jm.info ? { ...J.newGame(st.seed, "x"), hole: st.hole } : null, "x")[0];
    for (let i = 0; i < 150; i++) { sc.setGhost({ k, x: Math.round((c.tee[0] + 0.02 * i) * 20), y: Math.round((c.tee[1] - 3) * 20), a: i % 16, by: null }, true); if (i % 3 === 0) await new Promise(r => requestAnimationFrame(r)); }
    await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r));
    const g1 = sc.renderer.info.memory.geometries; sc.setGhost(null);
    return { k, g0, g1 };
  });
  const ghostLeak = ghost.g1 - ghost.g0;
  console.log(`  duch pasti (${ghost.k}) 150× přestavěn: geometrie ${ghost.g0} → ${ghost.g1} (${ghostLeak >= 0 ? "+" : ""}${ghostLeak})`);
  const rows = []; let lastHole = -1, strokes = 0;
  const t0 = Date.now();
  while (!crashed && Date.now() - t0 < 900000) {
    let s; try { s = await p.evaluate(() => window.__jm.state()); } catch (e) { if (crashed) break; throw e; }
    if (s.ph === "end") break;
    if (s.hole !== lastHole) {
      if (lastHole >= 0) { await wait(p, 600); rows.push({ hole: lastHole + 1, ...(await snap()), strokes }); }
      lastHole = s.hole; strokes = 0;
    }
    if (s.busy) { await p.evaluate(() => window.__jm.scene.skip()); await wait(p, 50); continue; }
    if (s.ph === "trap") { await p.evaluate(() => window.__jm.autoTrap()); await wait(p, 60); continue; }
    if (s.ph === "play") { strokes++; await p.evaluate(() => { const b = window.__jm.bot(); window.__jm.shoot(b.A, b.P); }); await wait(p, 50); continue; }
    await wait(p, 100);
  }
  if (!crashed) { await wait(p, 800); rows.push({ hole: "konec", ...(await snap()), strokes }); }
  console.log(`${ENGINE} ${ENGINE === "webkit" ? DEV : "desktop"} seed ${SEED}  ${crashed ? "SPADLO (Page crashed)" : "dohráno"}  ${Math.round((Date.now() - t0) / 1000)} s`);
  for (const r of rows) console.log(`  po jamce ${r.hole}: geometrie v rendereru ${r.geo} (ve scéně žije ${r.live}, osiřelých ${r.geo - r.live}), materiály ve scéně ${r.mats}, textury ${r.tex}, programy ${r.prog}, objektů ${r.objs}, úderů ${r.strokes}`);
  for (const e of errs.slice(0, 5)) console.log("  KONZOLE " + e);
  const orphans = rows.map(r => r.geo - r.live), maxOrph = Math.max(0, ...orphans), last = rows[rows.length - 1], first = rows[0];
  // únik = osiřelé geometrie (po dispose by jich nemělo být víc než pár: sdílené geometrie míčků a částic), nebo roste počet textur / objektů ve scéně
  const grow = ghostLeak > 40 || rows.length > 2 && (maxOrph > 25 || last.tex > first.tex + 3 || last.objs > first.objs * 2.5 + 50);
  console.log(crashed ? "FAIL  stránka spadla" : grow ? `FAIL  únik: osiřelých geometrií až ${maxOrph}, textur ${first && first.tex}→${last && last.tex}` : `PASS  žádný únik (osiřelých geometrií nejvýš ${maxOrph}, textur ${first && first.tex}→${last && last.tex})`);
  await browser.close();
  process.exit(crashed || grow ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
