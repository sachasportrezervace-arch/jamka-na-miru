// node tests/solo.cjs [URL]  – sólo režim „Zkusit sám“ (#solo): celá partie proti botovi, Chromium desktop 1440×900 + WebKit iPhone 13.
// Ověřuje: tlačítko „Zkusit sám“ na úvodní obrazovce vede na #solo; ve hře je vidět „Trénink“; žádné chyby v konzoli;
// ŽÁDNÝ síťový požadavek mimo statické soubory (nic na mantledb, žádné POST); bot staví past i střílí sám a partii dohraje;
// na konci „Znovu“ (nová partie, jiné jamky) a „Vyzvat soupeře“ (přechod do normální výzvy).
// Potřebuje server na 8808 (python -m http.server 8808). Hráč hraje skriptem (__jm.bot + __jm.shoot, past __jm.autoTrap).
// ONLY=desktop nebo ONLY=iphone spustí jen jedno zařízení.
const path = require("path"), fs = require("fs");
const pw = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const BASE = (process.argv[2] || "http://127.0.0.1:8808/").replace(/\/?$/, "/");
const SH = path.join(__dirname, "shots"); fs.mkdirSync(SH, { recursive: true });
const DEVICES = [
  { name: "desktop", engine: "chromium", opts: { viewport: { width: 1440, height: 900 } } },
  { name: "iphone", engine: "webkit", opts: { ...pw.devices["iPhone 13"] } },
];
const launchOpts = e => e === "chromium" ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } : {};
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const st = p => p.evaluate(() => window.__jm.state());

// hráč „x“ hraje skriptem, bot odpovídá sám; vrací počet vlastních úderů a čas. `until(s)` může partii ukončit dřív.
async function playOut(p, maxMs, until) {
  const t0 = Date.now(); let mine = 0, last = null, stuck = 0;
  while (Date.now() - t0 < maxMs) {
    const s = await st(p);
    if (s.ph === "end" || (until && until(s))) return { mine, ms: Date.now() - t0 };
    if (s.busy || s.result) { await p.evaluate(() => window.__jm.scene.skip()); await sleep(80); continue; }
    if (s.ph === "trap" && s.me === "x" && !s.pend.x) { await p.evaluate(() => window.__jm.autoTrap()); await sleep(150); continue; }
    if (s.ph === "play" && s.p === "x") { await p.evaluate(() => { const b = window.__jm.bot(); window.__jm.shoot(b.A, b.P); }); mine++; await sleep(120); continue; }
    const key = JSON.stringify([s.ph, s.hole, s.p, s.n, s.pend]);
    stuck = key === last ? stuck + 1 : 0; last = key;
    if (stuck > 400) throw new Error("hra se zasekla: " + key);        // 400 × 150 ms: bot musí táhnout během pár vteřin
    await sleep(150);
  }
  throw new Error("partie nedoběhla do " + maxMs + " ms");
}

async function runDev(browser, dev) {
  const ctx = await browser.newContext(dev.opts);
  await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch { } });
  const p = await ctx.newPage(), errs = [], reqs = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  p.on("response", r => { if (r.status() >= 400) errs.push("HTTP " + r.status() + " " + r.url().slice(0, 100)); });
  p.on("request", r => reqs.push({ m: r.method(), u: r.url() }));
  const tag = n => `[${dev.name}] ${n}`;

  // 1) úvodní obrazovka: „Zkusit sám“ je sekundární tlačítko vedle hlavní výzvy
  await p.goto(BASE);
  await p.waitForSelector("#bCreate");
  check(tag("úvod: je tlačítko „Zkusit sám“ a hlavní výzva zůstává"), (await p.locator("#bSolo").count()) === 1 && /Zkusit sám/.test(await p.innerText("#bSolo")) && /Připravit výzvu/.test(await p.innerText("#bCreate")));
  const cls = await p.evaluate(() => [document.getElementById("bCreate").className, document.getElementById("bSolo").className]);
  check(tag("úvod: „Zkusit sám“ je sekundární (btn alt), hlavní výzva primární"), /\balt\b/.test(cls[1]) && !/\balt\b/.test(cls[0]), cls.join(" | "));
  await p.screenshot({ path: path.join(SH, `solo-${dev.name}-uvod.png`) });
  const reqBefore = reqs.length;
  await p.fill("#fMe", "Mark");                      // jméno z úvodu se použije i ve hře
  await p.click("#bSolo");
  await p.waitForFunction(() => window.__jm && window.__jm.state(), null, { timeout: 15000 });
  check(tag("klik na „Zkusit sám“ nastaví adresu #solo"), new URL(p.url()).hash === "#solo", p.url());
  check(tag("hra se spustila bez zobrazení výzvy (žádný view)"), !(await p.evaluate(() => window.__jm.viewInfo().view)));
  check(tag("v liště jamky je vidět „Trénink“"), /trénink/i.test(await p.innerText("#holePill")));
  const names = await p.evaluate(() => [document.querySelector("#chipX .nm").textContent.trim(), document.querySelector("#chipO .nm").textContent.trim()]);
  check(tag("hráč se jmenuje podle úvodu, soupeř je Bot"), /^Mark/.test(names[0]) && /^Bot/.test(names[1]), names.join(" / "));
  await sleep(1200);
  await p.screenshot({ path: path.join(SH, `solo-${dev.name}-start.png`) });

  // 2) celá partie proti botovi
  const r = await playOut(p, 14 * 60 * 1000);
  const fin = await st(p);
  check(tag("partie došla do konce (6 jamek, oba mají skóre)"), fin.ph === "end" && fin.sc.x.length === 6 && fin.sc.o.length === 6, `x ${fin.sc.x} / o ${fin.sc.o}, ${r.mine} úderů hráče, ${(r.ms / 1000).toFixed(0)} s`);
  check(tag("bot hrál sám: v každé jamce má aspoň 1 ránu"), fin.sc.o.every(v => v >= 1), fin.sc.o.join(","));
  await p.waitForSelector("#bAgain", { timeout: 20000 });      // výsledek poslední jamky (3 s) a pak karta konce
  await sleep(900);
  await p.screenshot({ path: path.join(SH, `solo-${dev.name}-konec.png`) });
  const endTxt = await p.innerText("#view");
  check(tag("konec: je „Znovu“ a „Vyzvat soupeře“, žádná série"), (await p.locator("#bAgain").count()) === 1 && /Znovu/.test(await p.innerText("#bAgain")) && (await p.locator("#bChallenge").count()) === 1 && !/Série/.test(endTxt), endTxt.slice(0, 80).replace(/\n/g, " "));
  const seedA = fin.seed;

  // 3) síť: za celou partii nesmí odejít žádný požadavek mimo statické soubory z našeho serveru
  const origin = new URL(BASE).origin;
  const foreign = reqs.filter(q => !q.u.startsWith(origin) && !q.u.startsWith("data:") && !q.u.startsWith("blob:"));
  const posts = reqs.filter(q => q.m !== "GET");
  const mdb = reqs.filter(q => /mantledb/.test(q.u));
  check(tag("síť: žádný požadavek mimo náš server (celá partie)"), foreign.length === 0, foreign.slice(0, 3).map(q => q.u).join(" "));
  check(tag("síť: žádný POST ani zápis, nic na mantledb"), posts.length === 0 && mdb.length === 0, `${posts.length} POST, ${mdb.length} mantledb, ${reqs.length - reqBefore} požadavků po startu`);

  // 4) „Znovu“: nová partie, jiné jamky, stále sólo
  await p.click("#bAgain");
  await sleep(900);
  const s2 = await st(p);
  check(tag("Znovu: nová partie (jiný seed, skóre od nuly, hash #solo)"), s2.seed !== seedA && s2.sc.x.length === 0 && s2.ph === "trap" && new URL(p.url()).hash === "#solo", `seed ${seedA} → ${s2.seed}`);
  await playOut(p, 6 * 60 * 1000, s => s.hole >= 1);
  check(tag("Znovu: druhá partie jede (jamka 1 dohrána s botem)"), true);

  // 5) „Vyzvat soupeře“ z konce partie → normální výzva (setup), bez #solo
  await playOut(p, 14 * 60 * 1000);
  await p.waitForSelector("#bChallenge", { timeout: 20000 });
  await sleep(500);
  await p.click("#bChallenge");
  await p.waitForSelector("#bCreate", { timeout: 8000 });
  check(tag("Vyzvat soupeře: přechod do normální výzvy (setup), hash už není #solo"), !/solo/.test(new URL(p.url()).hash) && (await p.locator("#fMe").count()) === 1, p.url());
  const myName = await p.inputValue("#fMe");
  check(tag("Vyzvat soupeře: jméno hráče se předvyplní"), myName === "Mark", myName);
  const mdb2 = reqs.filter(q => /mantledb/.test(q.u));
  check(tag("Vyzvat soupeře: dosud žádný požadavek na sync (ten začne až po „Připravit výzvu“)"), mdb2.length === 0, String(mdb2.length));

  check(tag("žádné chyby v konzoli ani HTTP chyby"), errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

(async () => {
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  for (const dev of DEVICES) {
    if (only && !only.includes(dev.name)) continue;
    console.log(`--- ${dev.name}`);
    const browser = await pw[dev.engine].launch(launchOpts(dev.engine));
    try { await runDev(browser, dev); } catch (e) { check(`[${dev.name}] běh bez výjimky`, false, e.message); }
    await browser.close();
  }
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
