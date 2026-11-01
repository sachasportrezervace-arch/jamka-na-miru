// SnÃ­mky novÃ½ch vÄ›cÃ­: fukar (natoÄenÃ½), vysavaÄ, zÃ¡bradlÃ­ mostu, mÃ­Å™enÃ­ s nÃ¡hledem drÃ¡hy, dopad Ãºderu. Seed 32 (jamka 1 s mostem).
const path = require("path"), fs = require("fs");
const pw = require(path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const OUT = process.env.OUT || path.join(__dirname, "..", "design", "kolo-1-11"), SEED = process.env.SEED || "32", DEV = (process.env.DEV || "desktop,iphone").split(",");
const wait = (p, ms) => p.waitForTimeout(ms);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const dev of DEV) {
    const b = dev === "desktop" ? await pw.chromium.launch() : await pw.webkit.launch();
    const opts = dev === "desktop" ? { viewport: { width: 1440, height: 900 } } : dev === "iphoneL" ? { ...pw.devices["iPhone 13 landscape"] } : { ...pw.devices["iPhone 13"] };
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch { } });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
    await p.goto(`http://127.0.0.1:8808/?mistni=${SEED}`);
    await p.waitForFunction(() => window.__jm && window.__jm.state() && window.__jm.state().ph === "trap");
    await wait(p, 1500);
    const shot = async n => { const f = path.join(OUT, `${dev}-${n}.png`); await p.screenshot({ path: f }); console.log(f); };
    await p.click('.tc[data-k="fukar"]'); await wait(p, 200);
    await wait(p, 400);                                   // výchozí natočení = kam fouká nejdál
    await shot("1-past-fukar");
    await p.click("#bPlace"); await wait(p, 600);
    await p.click('.tc[data-k="vysavac"]'); await wait(p, 500);
    await shot("2-past-vysavac");
    await p.click("#bPlace");
    await p.waitForFunction(() => { const s = window.__jm.state(); return s.ph === "play" && !s.busy; });
    await wait(p, 2600);
    await shot("3-pasti-venku");
    const s = await p.evaluate(() => window.__jm.state());
    const bp = await p.evaluate(k => window.__jm.ballScreen(k), s.p), size = await p.evaluate(() => [innerWidth, innerHeight]);
    console.log("bod", JSON.stringify(bp), await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (e.id || e.className || e.tagName); }, [bp.x, bp.y]));
    await p.mouse.move(bp.x, bp.y); await p.mouse.down();
    const tx = bp.x + 30, ty = Math.min(size[1] - 4, bp.y + (dev === "desktop" ? 160 : 110));
    for (let i = 1; i <= 10; i++) { await p.mouse.move(bp.x + (tx - bp.x) * i / 10, bp.y + (ty - bp.y) * i / 10); await wait(p, 30); }
    await wait(p, 250);
    await shot("4-mireni");
    await p.mouse.up(); await wait(p, 90);
    await shot("5-dopad");
    await wait(p, 4000);
    await shot("6-po-uderu"); console.log("n po Ãºderu", (await p.evaluate(() => window.__jm.state())).n);
    console.log(dev, errs.length ? "CHYBY: " + errs.slice(0, 3).join(" | ") : "bez chyb v konzoli");
    await b.close();
  }
})().catch(e => { console.error(e); process.exit(2); });
