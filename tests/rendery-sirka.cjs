// node tests/rendery-sirka.cjs  – rendery úderu na šířku (WebKit iPhone 13 landscape 750×342, nebo VIEW=844x390) pro vybrané jamky seedu.
// SEED=21 (výchozí), HOLES=1,3 (výchozí), VIEW=750x342|844x390. Výstup: design/a-s<seed>-iphoneL-uder-j<jamka>.png (pro 844×390 přípona iphoneL2).
// Hráč „x“ i „o“ hrají skriptem (__jm.bot); u cílových jamek se při první ráně udělá tažení od míčku jako prstem a snímek se pořídí v okamžiku míření.
// Potřebuje server na 8808 (python -m http.server 8808).
const path = require("path"), fs = require("fs");
const pw = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const BASE = process.env.BASE || "http://127.0.0.1:8808/", SEED = process.env.SEED || "21";
const HOLES = (process.env.HOLES || "1,3").split(",").map(Number), VIEW = (process.env.VIEW || "750x342").split("x").map(Number);
const OUT = path.join(__dirname, "..", "design"), tagDev = VIEW[0] === 750 ? "iphoneL" : "iphoneL2";
const wait = (p, ms) => p.waitForTimeout(ms);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await pw.webkit.launch();
  const opts = { ...pw.devices["iPhone 13 landscape"] };
  if (VIEW[0] !== 750) { opts.viewport = { width: VIEW[0], height: VIEW[1] }; opts.screen = { width: VIEW[0], height: VIEW[1] }; }
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch { } });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(`${BASE}?mistni=${SEED}`);
  await p.waitForFunction(() => window.__jm && window.__jm.state());
  await wait(p, 1200);
  const done = new Set(); let guard = 0;
  while (guard++ < 1500) {
    const s = await p.evaluate(() => window.__jm.state());
    if (s.ph === "end" || HOLES.every(h => done.has(h))) break;
    if (s.busy) { await p.evaluate(() => window.__jm.scene.skip()); await wait(p, 60); continue; }
    if (s.ph === "trap") { await p.evaluate(() => window.__jm.autoTrap()); await wait(p, 80); continue; }
    if (s.ph === "play" && !(await p.evaluate(() => !!document.querySelector("#dock .res")))) {
      if (HOLES.includes(s.hole + 1) && !done.has(s.hole + 1)) {
        await wait(p, 1800);                                                  // kamera dojede za míček
        const bp = await p.evaluate(k => window.__jm.ballScreen(k), s.p), size = await p.evaluate(() => [innerWidth, innerHeight]);
        await p.mouse.move(bp.x, bp.y); await p.mouse.down();
        const tx = bp.x + 14, ty = Math.min(size[1] - 4, bp.y + 70);
        for (let i = 1; i <= 8; i++) { await p.mouse.move(bp.x + (tx - bp.x) * i / 8, bp.y + (ty - bp.y) * i / 8); await wait(p, 25); }
        await wait(p, 250);
        const f = path.join(OUT, `a-s${SEED}-${tagDev}-uder-j${s.hole + 1}.png`); await p.screenshot({ path: f }); console.log("  ", path.relative(path.join(__dirname, ".."), f));
        await p.mouse.up(); done.add(s.hole + 1); await wait(p, 200); continue;
      }
      await p.evaluate(() => { const bt = window.__jm.bot(); window.__jm.shoot(bt.A, bt.P); }); await wait(p, 60); continue;
    }
    await wait(p, 100);
  }
  await b.close();
  console.log(errs.length ? "CHYBY: " + errs.slice(0, 3).join(" | ") : "bez chyb v konzoli");
  process.exit(errs.length || done.size < HOLES.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
