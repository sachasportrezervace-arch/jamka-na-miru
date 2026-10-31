// node tests/rendery.cjs  – rendery do design/a-s<seed>-<zařízení>-<záběr>.png (potřebuje server na 8808: python -m http.server 8808)
// SEED=7 (výchozí) | SEED=3 ... ; KRATKE=1 vynechá konec partie (past, úder, výsledek jamky 1 a hotovo)
// UVOD=1 přidá render úvodní obrazovky do design/a-uvod-<zařízení>.png (s tlačítkem „Zkusit sám“), UVOD=jen udělá jen ten
// Chromium desktop 1440x900 + WebKit iPhone 13 na výšku: past, úder (míření), výsledek jamky (panel dole + míček v jamce), konec partie.
// Hru hraje skriptem přes window.__jm (autoTrap, bot, shoot); míření simuluje tažením myší od míčku.
const path = require("path"), fs = require("fs");
const pw = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const OUT = path.join(__dirname, "..", "design");
const BASE = process.env.BASE || "http://127.0.0.1:8808/";
const SEED = process.env.SEED || "7";
const KRATKE = !!process.env.KRATKE;
const navrh = "a";
fs.mkdirSync(OUT, { recursive: true });

const DEVICES = [
  { name: "desktop", engine: "chromium", opts: { viewport: { width: 1440, height: 900 } } },
  { name: "iphone", engine: "webkit", opts: { ...pw.devices["iPhone 13"] } },
];
const launchOpts = e => e === "chromium" ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } : {};
const wait = (p, ms) => p.waitForTimeout(ms);

async function idle(p, max = 60000) {            // počká, až dohraje animace
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    await p.evaluate(() => window.__jm.scene.skip());
    const s = await p.evaluate(() => window.__jm.state());
    if (!s.busy) return s;
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error("busy timeout");
}

async function run(browser, dev, errs) {
  const ctx = await browser.newContext(dev.opts);
  await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch { } });
  const p = await ctx.newPage();
  p.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${navrh}/${dev.name}] ${m.type()}: ${m.text()}`); });
  p.on("pageerror", e => errs.push(`[${navrh}/${dev.name}] PAGEERROR: ${e.message}`));
  const shot = async (kind) => { const f = path.join(OUT, `${navrh}-s${SEED}-${dev.name}-${kind}.png`); await p.screenshot({ path: f }); console.log("  ", path.relative(path.join(__dirname, ".."), f)); };
  if (process.env.UVOD) {                                    // úvodní obrazovka s tlačítkem „Zkusit sám“
    await p.goto(BASE); await p.waitForSelector("#bSolo"); await wait(p, 500);
    const f = path.join(OUT, `a-uvod-${dev.name}.png`); await p.screenshot({ path: f }); console.log("  ", path.relative(path.join(__dirname, ".."), f));
    if (process.env.UVOD === "jen") { await ctx.close(); return; }
  }
  await p.goto(`${BASE}?mistni=${SEED}`);
  await p.waitForFunction(() => window.__jm && window.__jm.state());
  await wait(p, 1500);
  // (a) stavění pasti: vybraná past + duch na dráze
  await shot("past");
  await p.evaluate(() => window.__jm.autoTrap());            // x postaví past, hraje o
  await wait(p, 400);
  await p.evaluate(() => window.__jm.autoTrap());            // o postaví past, pasti se odhalí
  await idle(p);
  await wait(p, 1800);                                       // kamera dojede za míček
  // (b) míření: tažení od míčku dozadu (dolů po obrazovce = vpřed po dráze)
  const s0 = await p.evaluate(() => window.__jm.state());
  const bp = await p.evaluate(k => window.__jm.ballScreen(k), s0.p);
  const size = await p.evaluate(() => [innerWidth, innerHeight]);
  const full = Math.max(150, Math.min(size[0], size[1]) * 0.34);
  await p.mouse.move(bp.x, bp.y); await p.mouse.down();
  const tx = bp.x + full * 0.12, ty = Math.min(size[1] - 4, bp.y + full * 0.72);
  for (let i = 1; i <= 8; i++) { await p.mouse.move(bp.x + (tx - bp.x) * i / 8, bp.y + (ty - bp.y) * i / 8); await wait(p, 25); }
  await wait(p, 250);
  await shot("uder");
  await p.mouse.up();
  // dohraj skriptem; (c) výsledek jamky v okamžiku, kdy naskočí karta, a konec partie
  let gotRes = false;
  const tEnd = Date.now() + 300000;
  while (Date.now() < tEnd) {
    const s = await p.evaluate(() => window.__jm.state());
    if (s.ph === "end") break;
    if (!gotRes && await p.evaluate(() => !!document.querySelector("#dock .res"))) { await wait(p, 1300); await shot("vysledek"); gotRes = true; if (KRATKE) break; }
    if (s.busy) { await p.evaluate(() => window.__jm.scene.skip()); await wait(p, 60); continue; }
    if (s.ph === "trap") await p.evaluate(() => window.__jm.autoTrap());
    else if (s.ph === "play") await p.evaluate(() => { const b = window.__jm.bot(); window.__jm.shoot(b.A, b.P); });
    await wait(p, 60);
  }
  if (!gotRes) console.log("  (!) výsledek jamky se nepodařilo zachytit");
  if (KRATKE) { await ctx.close(); return; }
  await idle(p); await wait(p, 900);
  const fin0 = await p.evaluate(() => window.__jm.state());
  if (fin0.ph !== "end") throw new Error("partie nedošla do konce: " + JSON.stringify(fin0.sc));
  await shot("konec");
  const fin = await p.evaluate(() => window.__jm.state());
  console.log("  konec:", JSON.stringify({ sc: fin.sc, pars: fin.pars, win: fin.win }));
  await ctx.close();
}

(async () => {
  const errs = [];
  for (const dev of DEVICES) {
    const browser = await pw[dev.engine].launch(launchOpts(dev.engine));
    console.log(`${navrh} / ${dev.name}`); await run(browser, dev, errs);
    await browser.close();
  }
  console.log(errs.length ? "CHYBY:\n" + errs.join("\n") : "bez chyb v konzoli");
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
