// node tests/perf.cjs [URL]  – výkon, hlavní měření na WebKitu iPhone 13 (emulace v Playwrightu, ne skutečný telefon), místní režim ?mistni=
//  1) FPS během animace úderu: requestAnimationFrame spočítaný za 3 s od úderu (3 různé údery) + čas JS na jedno vykreslení
//  2) čas JM.hole() pro 6 jamek (generátor + bot + par), bez cache, ve WebKitu, 4 různé seedy
//  3) orientačně totéž FPS v Chromiu s emulací mobilu (SwiftShader), ať je vidět, kolik z FPS je prostředí a kolik naše scéna
// Pozor: WebKit v Playwrightu na Windows kreslí WebGL softwarově a snímky stejně neumí rychleji než ~15 za sekundu ani na scéně
// s 32 voláními kreslení a 1,5 tis. trojúhelníků; JS vykreslení zabere ~1 ms. Skutečný iPhone proto zůstává NEOVĚŘENÝ.
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { webkit, chromium, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8808/").replace(/\/?$/, "/");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errs = [];

async function open(browser, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch { } });
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text().slice(0, 160)));
  await p.goto(BASE + "?mistni=perf1");
  await p.waitForFunction(() => window.__jm && window.__jm.state());
  return p;
}
async function fpsRuns(p, label) {
  await p.evaluate(() => { window.__jm.autoTrap(); });
  await sleep(300);
  await p.evaluate(() => { window.__jm.autoTrap(); });
  await p.waitForFunction(() => { const s = window.__jm.state(); return s.ph === "play" && !s.busy; }, null, { timeout: 30000 });
  await sleep(2500);                                          // kamera dojede po pádu pastí
  await p.evaluate(() => {                                    // měř, kolik JS zabere jedno vykreslení
    const rd = window.__jm.scene.renderer, r0 = rd.render.bind(rd); window.__rt = [];
    rd.render = (s, c) => { const t = performance.now(); r0(s, c); window.__rt.push(performance.now() - t); };
  });
  const runs = [];
  for (let k = 0; k < 3; k++) {
    await p.waitForFunction(() => { const s = window.__jm.state(); return s.ph === "play" && !s.busy; }, null, { timeout: 30000 });
    await sleep(1200);
    const r = await p.evaluate(() => new Promise(res => {
      const j = window.__jm, s = j.state(), bot = j.bot();
      const P = [1000, 800, 650][s.n % 3];
      const times = []; let busyEnd = null; const t0 = performance.now();
      window.__rt.length = 0;
      j.shoot(bot.A, P);
      (function loop(now) {
        times.push(now);
        if (busyEnd === null && !j.state().busy && now - t0 > 200) busyEnd = now - t0;
        if (now - t0 < 3000) requestAnimationFrame(loop);
        else {
          const dts = []; for (let i = 1; i < times.length; i++) dts.push(times[i] - times[i - 1]);
          dts.sort((a, b) => a - b);
          const rt = window.__rt, jsMs = rt.length ? rt.reduce((a, b) => a + b, 0) / rt.length : 0;
          res({ frames: times.length, fps: Math.round(times.length / ((times[times.length - 1] - times[0]) / 1000) * 10) / 10, p95: Math.round(dts[Math.floor(dts.length * 0.95)] * 10) / 10, worst: Math.round(dts[dts.length - 1] * 10) / 10, animMs: busyEnd === null ? null : Math.round(busyEnd), jsMs: Math.round(jsMs * 100) / 100 });
        }
      })(t0);
    }));
    runs.push(r);
    console.log(`[${label}] úder ${k + 1}: ${r.frames} snímků za 3 s = ${r.fps} FPS, p95 snímku ${r.p95} ms, nejhorší ${r.worst} ms, JS vykreslení ${r.jsMs} ms, animace ${r.animMs == null ? ">3 s" : r.animMs + " ms"}`);
  }
  const fpsMin = Math.min(...runs.map(r => r.fps)), fpsAvg = Math.round(runs.reduce((a, r) => a + r.fps, 0) / runs.length * 10) / 10;
  console.log(`[${label}] FPS během úderu (rAF za 3 s): min ${fpsMin}, průměr ${fpsAvg}`);
  return { fpsMin, fpsAvg };
}

(async () => {
  const bw = await webkit.launch();
  const p = await open(bw, { ...devices["iPhone 13"] });
  console.log("zařízení:", JSON.stringify(await p.evaluate(() => ({ ua: navigator.userAgent.slice(0, 70), vp: [innerWidth, innerHeight], dpr: devicePixelRatio }))));

  // ---------- 2) JM.hole pro 6 jamek ----------
  const holes = await p.evaluate(() => {
    const out = [];
    for (const seed of [0x1234567, 0x7654321, 0x0badf00d, 0x2026103]) {
      const row = [];
      for (let i = 0; i < 6; i++) { const t = performance.now(); const c = JM.hole(seed + 99991, i); row.push({ ms: Math.round((performance.now() - t) * 10) / 10, par: c.par }); }
      out.push(row);
    }
    return out;
  });
  holes.forEach((row, i) => console.log(`JM.hole seed #${i + 1}: ${row.map(r => r.ms + " ms (par " + r.par + ")").join(", ")}  | celkem ${Math.round(row.reduce((a, r) => a + r.ms, 0))} ms`));
  const allMs = holes.flat().map(r => r.ms), tot = holes.map(r => r.reduce((a, x) => a + x.ms, 0));
  console.log(`JM.hole (WebKit iPhone 13): 6 jamek za ${Math.round(Math.min(...tot))}–${Math.round(Math.max(...tot))} ms (průměr ${Math.round(tot.reduce((a, b) => a + b, 0) / tot.length)} ms), nejdelší jamka ${Math.max(...allMs)} ms`);

  // ---------- 1) FPS během úderu ----------
  const w = await fpsRuns(p, "WebKit iPhone 13");
  await bw.close();

  // ---------- 3) orientačně Chromium ----------
  const bc = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const pc = await open(bc, { viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await fpsRuns(pc, "Chromium mobil, SwiftShader (orientačně)");
  await bc.close();
  console.log(errs.length ? "CHYBY V KONZOLI: " + errs.slice(0, 3).join(" | ") : "bez chyb v konzoli");
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
