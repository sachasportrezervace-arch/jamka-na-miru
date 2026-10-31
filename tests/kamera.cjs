// node tests/kamera.cjs [seed ...]  – kamera při úderu: jamka, praporek a míček musí být ve volné ploše mezi horním HUD a dolním panelem.
// Ověřuje se PROJEKCÍ do obrazovky (kamera scény → pixely), proti skutečným obdélníkům HUD z DOM, ne odhadem z nastavení kamery.
// Potřebuje server na 8808 (python -m http.server 8808). Výchozí seedy 3, 7, 11 (?mistni=), Chromium 1440×900 a WebKit iPhone 13 na výšku.
// Pravidla: míček je vždy ve volné ploše a má aspoň 12 px v průměru; jamka (podstava i špička praporku) je ve volné ploše, když je cesta k ní nejvýš 12 políček
// (df míčku, výchozí 12); když je dál, musí být v záběru aspoň míček (a nic z toho, co kreslíme, nesmí skončit pod HUD kvůli rámování).
const path = require("path"), fs = require("fs");
const pw = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const BASE = process.env.BASE || "http://127.0.0.1:8808/";
const SEEDS = process.argv.slice(2).length ? process.argv.slice(2) : ["3", "7", "11"];
const STROKES = +process.env.STROKES || 2;          // kolik úderů na jamku se měří (po prvním se míček posune)
const OUT = process.env.OUT || path.join(__dirname, "..", "design");
const DEVICES = [
  { name: "desktop", engine: "chromium", opts: { viewport: { width: 1440, height: 900 } } },
  { name: "iphone", engine: "webkit", opts: { ...pw.devices["iPhone 13"] } },
];
if (process.env.LANDSCAPE) DEVICES.push({ name: "iphone-sirka", engine: "webkit", opts: { ...pw.devices["iPhone 13 landscape"] } });
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
// měření v prohlížeči: body v pixelech a obdélníky HUD
function measure() {
  const m = window.__jm, sc = m.scene, J = window.JM, s = m.state();
  const c = J.hole(s.seed, s.hole), b = sc.balls[s.p];
  const h = J.surf(c, c.cup[0], c.cup[1]).h;
  const pt = (x, y, hh) => { const q = sc.toScreen(x, y, hh); return [q.x, q.y]; };
  const vis = e => { if (!e) return null; const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? [r.left, r.top, r.right, r.bottom] : null; };
  const rects = ["chipX", "chipO", "holePill", "bMenu", "dock", "bCam"].map(id => ({ id, r: vis(document.getElementById(id)) })).filter(q => q.r);
  const ci = Math.floor(b.y) * c.W + Math.floor(b.x);
  return {
    W: innerWidth, H: innerHeight, rects, df: c.df[ci],
    ball: pt(b.x, b.y, b.g.position.y), ballPx: Math.hypot(...[0, 1].map(i => sc.toScreen(b.x + 0.16, b.y, b.g.position.y)[i ? "y" : "x"] - sc.toScreen(b.x - 0.16, b.y, b.g.position.y)[i ? "y" : "x"])), cupBase: pt(c.cup[0], c.cup[1], h), cupTop: pt(c.cup[0], c.cup[1], h + 1.3),
    how: sc.cam.fr && sc.cam.fr.how, dist: sc.cam.fr && sc.cam.fr.dist, mode: sc.mode, p: s.p, hole: s.hole, n: s.n,
  };
}
const inRect = (q, r, pad) => q[0] >= r[0] - pad && q[0] <= r[2] + pad && q[1] >= r[1] - pad && q[1] <= r[3] + pad;
function judge(m) {
  const bad = [];
  const free = (q, name) => {
    if (q[0] < 6 || q[0] > m.W - 6 || q[1] < 0 || q[1] > m.H) return `${name} mimo obrazovku (${Math.round(q[0])},${Math.round(q[1])})`;
    for (const { id, r } of m.rects) if (inRect(q, r, 4)) return `${name} pod HUD #${id} (${Math.round(q[0])},${Math.round(q[1])})`;
    return null;
  };
  const e1 = free(m.ball, "míček"); if (e1) bad.push(e1);
  const near = m.df <= (+process.env.NEAR || 12);
  if (near) { const e2 = free(m.cupBase, "jamka"), e3 = free(m.cupTop, "praporek"); if (e2) bad.push(e2); if (e3) bad.push(e3); }
  if (!near) {                                    // daleká jamka: buď celá ve volné ploše, nebo celá mimo obrazovku; nikdy napůl pod HUD / uříznutá
    const onScr = q => q[0] >= 0 && q[0] <= m.W && q[1] >= 0 && q[1] <= m.H;
    if (onScr(m.cupBase)) { const e2 = free(m.cupBase, "jamka"), e3 = free(m.cupTop, "praporek"); if (e2) bad.push(e2); if (e3) bad.push(e3); }
    else if (onScr(m.cupTop)) { const e3 = free(m.cupTop, "praporek"); if (e3) bad.push(e3); }
  }
  if (m.ballPx < 12) bad.push(`míček je malý (${m.ballPx.toFixed(1)} px)`);
  return { bad, near };
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
        measured++; j.near ? nearSeen++ : farSeen++;
        const tag = `${dev.name} seed ${seed} jamka ${s.hole + 1} rána ${s.n + 1} (${s.p}) df ${m.df}`;
        if (j.bad.length) { out.bad.push(`${tag}: ${j.bad.join("; ")} [${m.how}, d ${m.dist && m.dist.toFixed(1)}]`); if (process.env.SHOTS) await p.screenshot({ path: path.join(OUT, `kamera-vada-${dev.name}-${seed}-${s.hole + 1}-${s.n + 1}.png`) }); }
        strokesHere++;
      }
      await p.evaluate(() => { const b = window.__jm.bot(); window.__jm.shoot(b.A, b.P); });
      await wait(p, 60);
      continue;
    }
    await wait(p, 120);
  }
  out.measured += measured; out.near += nearSeen; out.far += farSeen; out.errs.push(...errs.map(e => `[${dev.name}/${seed}] ${e}`));
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const out = { bad: [], measured: 0, near: 0, far: 0, errs: [] };
  for (const dev of DEVICES) {
    const browser = await pw[dev.engine].launch(launchOpts(dev.engine));
    for (const seed of SEEDS) { console.log(`${dev.name} seed ${seed}`); await run(browser, dev, seed, out); }
    await browser.close();
  }
  console.log(`měřeno ${out.measured} záběrů (jamka blízko: ${out.near}, daleko: ${out.far})`);
  for (const b of out.bad) console.log("VADA  " + b);
  for (const e of out.errs.slice(0, 5)) console.log("KONZOLE  " + e);
  const ok = !out.bad.length && !out.errs.length;
  console.log(ok ? "PASS  jamka, praporek i míček jsou vždy ve volné ploše" : `FAIL  ${out.bad.length} vad kamery, ${out.errs.length} chyb konzole`);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
