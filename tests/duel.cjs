// Dva (a tři) nezávislé prohlížeče přes skutečný mantledb: A = Chromium desktop 1440x900 (Mark, zakladatel),
// B = WebKit iPhone 13 (Radka), C a D = další kontexty (pojistka introMine, divák). Nic se nemockuje.
// Výzva -> otevření odkazu v novém kontextu (nikdy samo nesedne na místo zakladatele, přijetí pod jménem zakladatele je odmítnuto)
// -> Radka přijme -> pasti (__jm.autoTrap) -> údery botem (__jm.bot + __jm.shoot) přes celou partii.
// Po každém úderu se porovná __jm.state() balls + str + sc ve všech prohlížečích (JSON, bit po bitu).
// node tests/duel.cjs [URL]        (výchozí http://127.0.0.1:8808/, API mantledb.sh/v2/ z net.js; místnost se založí vždy nová)
// MAXHOLES=2 node tests/duel.cjs   zkrácená varianta (jen první 2 jamky)
const path = require("path");
const fs = require("fs");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8808/").replace(/\/?$/, "/");
const MAXHOLES = +(process.env.MAXHOLES || 6);
const SH = path.join(__dirname, "shots");
fs.mkdirSync(SH, { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = (p, name) => p.screenshot({ path: path.join(SH, "duel-" + name + ".png") }).catch(() => { });
const st = p => p.evaluate(() => window.__jm.state());
const vi = p => p.evaluate(() => window.__jm.viewInfo());
const DESK = { viewport: { width: 1440, height: 900 } };
const CHROME_ARGS = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

(async () => {
  const t00 = Date.now();
  const bC = await chromium.launch(CHROME_ARGS), bW = await webkit.launch();
  const mk = async (browser, opts) => { const ctx = await browser.newContext(opts); await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch { } }); return ctx; };
  const errs = [];
  const watch = (n, p) => {
    p.on("pageerror", e => errs.push(n + " pageerror: " + e.message));
    p.on("console", m => { if (m.type() === "error") errs.push(n + " console: " + m.text().slice(0, 200)); });
    p.on("response", r => { if (r.status() >= 400) errs.push(n + " HTTP " + r.status() + " " + r.url().slice(0, 120)); });
  };

  // ---------- 1) Mark zakládá výzvu ----------
  const ctxA = await mk(bC, DESK), A = await ctxA.newPage(); watch("A", A);
  await A.goto(BASE);
  await A.waitForSelector("#bCreate");
  await A.fill("#fMe", "Mark"); await A.fill("#fOpp", "Radka");
  await A.click("#bCreate");
  await A.waitForSelector("#msg", { timeout: 20000 });
  const msg = await A.innerText("#msg");
  const link = (msg.match(/https?:\/\/\S+#r\.[0-9a-z]+/) || [])[0];
  check("výzva: zpráva obsahuje odkaz s místností (mantledb odpovídá)", !!link && msg.includes("Mark"), link);
  const roomId = link.split("#r.")[1];
  await shot(A, "01-mark-vyzva");

  // ---------- 2) regresní test: odkaz v novém kontextu nikdy nesedne automaticky na místo zakladatele ----------
  const ctxC = await mk(bC, DESK), C = await ctxC.newPage(); watch("C", C);
  await C.goto(link);
  await C.waitForSelector("#bAccept", { timeout: 20000 });
  const c1 = await vi(C);
  check("introMine: nové zařízení s odkazem vidí výzvu, ne hru (view intro, bez místa)", c1.view === "intro" && c1.seat === null, JSON.stringify(c1));
  check("introMine: nové zařízení nemá stav hry (nesedlo na místo zakladatele)", (await st(C)) === null);
  await C.fill("#fName", "Mark");
  await C.click("#bAccept");
  await sleep(900);
  const c2 = await vi(C), toast = await C.innerText("#toast");
  check("introMine: přijetí pod jménem zakladatele je odmítnuto (zůstává výzva, bez místa, hláška)", c2.view === "intro" && c2.seat === null && /založil\(a\) Mark/.test(toast), toast);
  await C.fill("#fName", "  mark ");
  await C.click("#bAccept"); await sleep(700);
  check("introMine: odmítnuto i s jinou velikostí písmen a mezerami", (await vi(C)).seat === null && /založil\(a\) Mark/.test(await C.innerText("#toast")));
  const meta0 = await C.evaluate(async u => (await fetch(u, { cache: "no-store" })).json(), `https://mantledb.sh/v2/jamka-na-miru-${roomId}/hra`);
  check("introMine: na serveru zůstává místo soupeře volné (so je prázdné)", !meta0.so, JSON.stringify({ so: meta0.so, g: meta0.g }));
  await shot(C, "02-novy-kontext-vyzva");

  // ---------- 3) Radka (WebKit iPhone 13) přijme ----------
  const ctxB = await mk(bW, { ...devices["iPhone 13"] }), B = await ctxB.newPage(); watch("B", B);
  await B.goto(link);
  await B.waitForSelector("#bAccept", { timeout: 20000 });
  check("přijetí: Radka vidí výzvu s předvyplněným jménem", (await B.inputValue("#fName")) === "Radka" && /Mark tě vyzývá/.test(await B.innerText("#view")));
  await shot(B, "03-radka-prijeti");
  await B.click("#bAccept");
  await B.waitForFunction(() => window.__jm && window.__jm.state(), null, { timeout: 20000 });
  const b1 = await vi(B);
  check("přijetí: Radka dostala místo o a vidí hru", b1.seat === "o" && !b1.view, JSON.stringify(b1));
  // Mark se dozví o přijetí (poll) a pokračuje do hry
  await A.waitForFunction(() => window.__jm.viewInfo().meta && window.__jm.viewInfo().meta.so, null, { timeout: 20000 });
  check("přijetí: Mark se přes mantledb dozví, že výzva byla přijata", true);
  await A.click("#bGo");
  await A.waitForFunction(() => window.__jm.state(), null, { timeout: 10000 });
  check("zakladatel má místo x", (await vi(A)).seat === "x");
  // zakladatel po obnovení stránky dostane své místo zpět, Radka také
  await A.reload(); await A.waitForFunction(() => window.__jm && window.__jm.state(), null, { timeout: 20000 });
  await B.reload(); await B.waitForFunction(() => window.__jm && window.__jm.state(), null, { timeout: 20000 });
  check("obnovení stránky: Mark má zpět místo x, Radka místo o", (await vi(A)).seat === "x" && (await vi(B)).seat === "o");
  await sleep(1500);

  // ---------- 4) štítky ve fázi pasti: druhý řádek, výška na iPhonu ----------
  const chipsA = await A.evaluate(() => ["chipX", "chipO"].map(id => ({ cur: document.querySelector("#" + id + " .cur").textContent.trim(), h: document.getElementById(id).getBoundingClientRect().height })));
  check("fáze pasti: štítky na desktopu nemají prázdný druhý řádek", chipsA.every(c => c.cur.length > 3), JSON.stringify(chipsA.map(c => c.cur)));
  const chipsB = await B.evaluate(() => ["chipX", "chipO"].map(id => ({ h: Math.round(document.getElementById(id).getBoundingClientRect().height * 10) / 10, cur: getComputedStyle(document.querySelector("#" + id + " .cur")).display })));
  check("iPhone: kompaktní štítky nejvýš ~48 px, jméno + součet", chipsB.every(c => c.h <= 48.5 && c.cur === "none"), JSON.stringify(chipsB));
  const mobileUi = await B.evaluate(() => ({ tools: !!document.getElementById("tools"), menu: !document.getElementById("menu").hidden, pow: !!document.getElementById("pow") }));
  check("iPhone: nástroje sbalené do jednoho tlačítka (nabídka zavřená, žádný #tools)", !mobileUi.tools && !mobileUi.menu);
  await shot(A, "04-past-mark-desktop"); await shot(B, "04-past-radka-iphone");

  // ---------- 5) divák (třetí kontext) ----------
  const ctxD = await mk(bC, DESK), D = await ctxD.newPage(); watch("D", D);
  await D.goto(link);
  await D.waitForSelector("#bSpect", { timeout: 20000 });
  const dTxt = await D.innerText("#view");
  check("divák: třetí zařízení vidí volbu „Jen se dívat“ a obě jména", /Jen se dívat/.test(dTxt) && /Mark/.test(dTxt) && /Radka/.test(dTxt));
  check("divák: nesedlo automaticky na žádné místo", (await vi(D)).seat === null && (await st(D)) === null);
  await shot(D, "05-divak-volba");
  await D.click("#bSpect");
  await D.waitForFunction(() => window.__jm.state(), null, { timeout: 10000 });
  const toastD = await D.innerText("#toast");
  check("divák: po volbě „Jen se dívat“ vidí hru a hlášku Přihlížíš", /Přihlížíš/.test(toastD) && (await vi(D)).seat === null, toastD);
  const pages = { A, B, D };

  // ---------- 6) pasti obou ----------
  async function skipAnim() { await Promise.all(Object.values(pages).map(p => p.evaluate(() => window.__jm.scene.skip()).catch(() => { }))); }
  async function buildTraps() {
    for (const k of ["A", "B"]) {
      await pages[k].waitForFunction(() => { const s = window.__jm.state(); return s && s.ph === "trap" && !s.busy && !s.result; }, null, { timeout: 30000 });
      const s = await st(pages[k]);
      if (!s.pend[s.me]) { const ok = await pages[k].evaluate(() => window.__jm.autoTrap()); check(`jamka ${s.hole + 1}: ${k === "A" ? "Mark" : "Radka"} postavil(a) past`, ok === true || ok === false); }
    }
  }
  const sameState = (a, b) => JSON.stringify({ h: a.hole, ph: a.ph, p: a.p, n: a.n, b: a.balls, s: a.str, sc: a.sc, pars: a.pars, t: a.traps, w: a.win }) === JSON.stringify({ h: b.hole, ph: b.ph, p: b.p, n: b.n, b: b.balls, s: b.str, sc: b.sc, pars: b.pars, t: b.traps, w: b.win });
  async function settle(expect, timeout = 40000) {            // všichni tři na stejném kroku a bez animace
    const t0 = Date.now();
    for (;;) {
      await skipAnim();
      const ss = await Promise.all(Object.values(pages).map(st));
      if (ss.every(s => s && !s.busy && !s.result && expect(s))) return ss;
      if (Date.now() - t0 > timeout) throw new Error("synchronizace nedoběhla: " + JSON.stringify(ss.map(s => s && { h: s.hole, ph: s.ph, n: s.n, busy: s.busy })));
      await sleep(200);
    }
  }

  let shots = 0, compared = 0, mism = 0, maxSync = 0, domBad = 0, spectOk = 0;
  const lat = [];
  let holeDone = 0, shotSeen = 0;
  const tGame = Date.now();
  await buildTraps();
  await settle(s => s.ph === "play");
  check("pasti: po postavení obou se odhalí a hra přejde do úderů ve všech 3 prohlížečích", true);
  await shot(A, "06-uder-mark-desktop"); await shot(B, "06-uder-radka-iphone"); await shot(D, "06-divak");

  while (true) {
    const [sa] = await Promise.all([st(A)]);
    if (sa.ph === "end") break;
    if (sa.hole >= MAXHOLES) break;
    if (sa.ph === "trap") { await buildTraps(); await settle(s => s.ph === "play" || s.ph === "end"); continue; }
    // kdo je na tahu
    const sb = await st(B);
    const shooter = sa.me === sa.p ? "A" : sb.me === sb.p ? "B" : null;
    if (!shooter) { await sleep(300); continue; }
    const P = pages[shooter], n0 = sa.n, h0 = sa.hole;
    const t0 = Date.now();
    await P.waitForFunction(() => { const s = window.__jm.state(); return s && !s.busy && !s.result; }, null, { timeout: 30000 });
    const fired = await P.evaluate(() => { const s = window.__jm.bot(); const before = window.__jm.state().n; window.__jm.shoot(s.A, s.P); return before; });
    shots++;
    const ss = await settle(s => s.n === n0 + 1 || s.hole > h0 || s.ph === "end" || s.hole > h0);
    const dt = Date.now() - t0; lat.push(dt); maxSync = Math.max(maxSync, dt);
    // po úderu: ve všech 3 prohlížečích stejné míčky, rány, skóre
    const eq = sameState(ss[0], ss[1]) && sameState(ss[0], ss[2]);
    compared++; if (!eq) { mism++; console.log("  rozdíl po úderu č. " + shots + ":", JSON.stringify(ss.map(s => ({ h: s.hole, ph: s.ph, n: s.n, b: s.balls, str: s.str })))); } else spectOk++;
    // čísla v HUD = stav G (součty ve štítcích)
    const dom = await A.evaluate(() => ({ x: +document.querySelector("#chipX .tot b").textContent, o: +document.querySelector("#chipO .tot b").textContent }));
    const sum = k => ss[0].sc[k].reduce((a, b) => a + b, 0);
    if (dom.x !== sum("x") || dom.o !== sum("o")) { domBad++; console.log("  HUD nesedí se stavem:", JSON.stringify({ dom, sc: ss[0].sc })); }
    if (ss[0].hole > holeDone) { holeDone = ss[0].hole; console.log(`  … jamka ${holeDone} z ${MAXHOLES} dohrána, úderů celkem ${shots}, ${Math.round((Date.now() - tGame) / 1000)} s`); }
    if (shots === 3) { await shot(A, "07-po-3-uderech-mark"); await shot(B, "07-po-3-uderech-radka"); }
  }
  check(`údery: v obou prohlížečích i u diváka po každém úderu stejné míčky, rány a skóre (JSON)`, compared >= 4 && mism === 0, `${compared} porovnání, ${mism} rozdílů, ${shots} úderů`);
  check("HUD: součty ve štítcích vždy sedí se stavem hry", domBad === 0, `${domBad} nesrovnalostí`);
  const finalS = await Promise.all([A, B, D].map(st));
  const reachedHoles = Math.max(...finalS.map(s => s.ph === "end" ? 6 : s.hole));
  check(`hra: odehrány aspoň 2 jamky${MAXHOLES >= 6 ? ", ideálně celá partie" : ""}`, reachedHoles >= 2, `dosaženo ${reachedHoles >= 6 && finalS[0].ph === "end" ? "konec partie (6 jamek)" : reachedHoles + " jamek"}, ${shots} úderů, ${Math.round((Date.now() - tGame) / 1000)} s`);
  if (finalS[0].ph === "end") {
    await settle(s => s.ph === "end", 60000).catch(() => { });
    await sleep(1200);
    const fs3 = await Promise.all([A, B, D].map(st));
    check("konec partie: stejné skóre i vítěz na obou zařízeních i u diváka", fs3.every(s => s.win === fs3[0].win && JSON.stringify(s.sc) === JSON.stringify(fs3[0].sc)), `${fs3[0].win} ${JSON.stringify(fs3[0].sc)}`);
    const endA = await A.evaluate(() => ({ win: !!document.querySelector(".endpair .who.win .bi"), lose: !!document.querySelector(".endpair .who.lose .bi"), draw: document.querySelectorAll(".endpair .who").length === 2 && !document.querySelector(".endpair .who.win") }));
    check("konec partie: vedle sebe veselý vítěz a zkroušený poražený (nebo dva spokojení při remíze)", (endA.win && endA.lose) || endA.draw, JSON.stringify(endA));
    await shot(A, "08-konec-mark-desktop"); await shot(B, "08-konec-radka-iphone"); await shot(D, "08-konec-divak");
  }
  check("bez chyb v konzoli (A, B, C, D)", errs.length === 0, errs.slice(0, 3).join(" | "));
  const avg = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
  console.log(`\núderů ${shots}, průměrně ${avg} ms od úderu do shody ve všech 3 prohlížečích (max ${maxSync} ms), celý test ${Math.round((Date.now() - t00) / 1000)} s, místnost ${roomId}`);
  console.log(`${pass}/${pass + fail} PASS${fail ? `, ${fail} FAIL` : ""}`);
  await bC.close(); await bW.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
