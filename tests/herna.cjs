// node tests/herna.cjs [URL]  – napojení na místnost Herny podle react-apps/HERNA-PROTOKOL.md (verze 1).
// Hra běží v iframe stránky tests/herna-host.html, která plní roli Herny (sbírá postMessage z vlastního iframe, lišta 48 px).
// Dva nezávislé prohlížeče přes skutečný mantledb (Chromium desktop = zakladatel, WebKit iPhone 13 = čeká a sedne si sám).
// Ověřuje: meta řádek herna-protokol, zprávy pripraveno / stav / vysledek / jina-hra, oba sednou bez výzvy a bez setupu, jména podle
// names (i s diakritikou a oběma pořadími sedadel), skryté sdílení a „Zkusit sám“, výsledek partie dojde jednou na okno se stejným
// `partie` a správným vítězným sedadlem, odveta (nová partie = nové `partie`), a že bez platného #herna=1 se hra chová jako dřív.
// Potřebuje server na 8808. MAXHOLES nelze zkrátit: hraje se celá partie (6 jamek, ~3 minuty).
const path = require("path"), fs = require("fs");
const pw = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const BASE = (process.argv[2] || "http://127.0.0.1:8808/").replace(/\/?$/, "/");
const SH = path.join(__dirname, "shots"); fs.mkdirSync(SH, { recursive: true });
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rid = () => [...Array(12)].map(() => "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 36)]).join("");
const CHROME = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };
const gameUrl = (r, seat, names, zaklada) => `${BASE}#herna=1&m=test000000&r=${r}&seat=${seat}&names=${names.map(encodeURIComponent).join(",")}&zaklada=${zaklada}`;
const hostUrl = g => `${BASE}tests/herna-host.html?g=${encodeURIComponent(g)}`;

class Side {
  constructor(name, page) { this.name = name; this.page = page; this.errs = []; }
  frame() { return this.page.frames().find(f => /herna=1/.test(f.url())) || null; }
  msgs() { return this.page.evaluate(() => window.__msgs.slice()); }
  async st() { const f = this.frame(); return f ? f.evaluate(() => window.__jm && window.__jm.state()).catch(() => null) : null; }
  async ev(fn, arg) { return this.frame().evaluate(fn, arg); }
}
async function open(browser, opts, name, g) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem("jm-ioshint", "1"); } catch { } });
  const page = await ctx.newPage(), s = new Side(name, page);
  page.on("pageerror", e => s.errs.push(name + " pageerror: " + e.message + " @ " + String(e.stack || "").split(/\r?\n/).slice(1, 4).join(" | ")));
  // 404 na dokument místnosti je očekávaná (hra se ptá, jestli už existuje, než ho založí / než naskočí); jiné chyby ne
  page.on("console", m => { if (m.type() === "error" && !/status of 404/.test(m.text())) s.errs.push(name + " console: " + m.text().slice(0, 160)); });
  page.on("response", r => { if (r.status() >= 400 && !(r.status() === 404 && /\/hra$/.test(r.url()))) s.errs.push(name + " HTTP " + r.status() + " " + r.url().slice(0, 100)); });
  await page.goto(hostUrl(g));
  return s;
}
// Vejde se obrazovka do iframe 390×613 (iPhone 13 = 664 px výšky − lišta Herny 51 px) bez scrollu a bez useknutých prvků?
const FIT_SELS = ["#topbar .chip", "#holePill", "#bMenu", "#dock", "#dock button", "#dock .say", "#bCam", "#view .panel", "#view button", ".endcard h2", ".endcard .score", ".endcard .cardwrap", ".endcard .titles", ".endcard .wait", ".endcard .trn-note"];
const fitBad = new Map(), fitSeen = new Set(); let fitN = 0;
async function probe(S, tag) {
  if (fitSeen.has(tag)) return; fitSeen.add(tag);
  const f = await S.ev(sels => {
    const W = innerWidth, H = innerHeight, bad = [], v = document.getElementById("view"), d = document.documentElement;
    for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") continue;
      if (r.top < -1 || r.bottom > H + 1 || r.left < -1 || r.right > W + 1) bad.push(`${sel} ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    if (!v.hidden && v.scrollHeight > v.clientHeight + 1) bad.push(`#view scrolluje ${v.scrollHeight}>${v.clientHeight}`);
    if (d.scrollHeight > H + 1 || d.scrollWidth > W + 1) bad.push(`stránka scrolluje ${d.scrollWidth}×${d.scrollHeight} > ${W}×${H}`);
    return { W, H, bad };
  }, FIT_SELS);
  fitN++; if (f.bad.length) fitBad.set(`${tag} [${f.W}×${f.H}]`, f.bad.slice(0, 4).join("; "));
  if (/konec|vysledek\/2|past\/2\/vyber/.test(tag)) await S.page.screenshot({ path: path.join(SH, `herna-fit-${tag.replace(/\W+/g, "-")}.png`) });
}
async function until(fn, ms, what) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(250); }
  throw new Error("timeout: " + what);
}

(async () => {
  const bC = await pw.chromium.launch(CHROME), bW = await pw.webkit.launch();
  const DESK = { viewport: { width: 1440, height: 900 } }, IPH = { ...pw.devices["iPhone 13"] };
  const html = await (await fetch(BASE)).text();
  check("index.html: <meta name=\"herna-protokol\" content=\"1\">", /<meta name="herna-protokol" content="1">/.test(html));

  // ---------- scénář 1: zakladatel = sedadlo 0 (Mark), celá partie, odveta ----------
  const r1 = rid();
  const B = await open(bW, IPH, "B", gameUrl(r1, 1, ["Mark", "Radka"], 0));            // Radka (sedadlo 1) čeká, až hra naskočí
  await until(async () => (await B.msgs()).some(m => m.typ === "pripraveno"), 15000, "B pripraveno");
  await sleep(600);
  const bw = await B.frame().evaluate(() => ({ view: document.getElementById("view").hidden ? "" : document.getElementById("view").innerText, solo: !!document.getElementById("bSolo") }));
  check("B (zaklada=0): čeká s hláškou „Čeká se, až hra naskočí“, bez výzvy a bez „Zkusit sám“", /Čeká se, až hra naskočí/.test(bw.view) && !bw.solo, bw.view.replace(/\n/g, " ").slice(0, 60));
  check("B: zprávy pripraveno a stav ceka", (await B.msgs()).some(m => m.typ === "stav" && m.faze === "ceka"), JSON.stringify(await B.msgs()));
  const A = await open(bC, DESK, "A", gameUrl(r1, 0, ["Mark", "Radka"], 1));            // Mark (sedadlo 0) hru vybral a zakládá
  await until(async () => (await A.st()) && (await B.st()), 30000, "A i B ve hře");
  const sa = await A.st(), sb = await B.st();
  const names = async S => S.ev(() => [document.querySelector("#chipX .nm").textContent.replace(/\s+/g, " ").trim(), document.querySelector("#chipO .nm").textContent.replace(/\s+/g, " ").trim()]);
  const va = await A.ev(() => ({ view: window.__jm.viewInfo().view, solo: !!document.getElementById("bSolo"), setup: !!document.getElementById("bCreate"), share: !!document.getElementById("bShare") || !!document.getElementById("bCopy") || !!document.getElementById("bShare2") }));
  const vb = await B.ev(() => ({ view: window.__jm.viewInfo().view, solo: !!document.getElementById("bSolo"), setup: !!document.getElementById("bCreate") }));
  check("A i B sedí hned ve hře: žádná výzva, žádný setup, žádný view", !va.view && !vb.view && !va.setup && !vb.setup, JSON.stringify({ va, vb }));
  check("sdílení odkazu, „Vyzvat soupeře“ a „Zkusit sám“ jsou skryté", !va.share && !va.solo && !vb.solo);
  check("místa: zakladatel A je x (sedadlo 0), B je o; stav fáze trap", sa.me === "x" && sb.me === "o" && sa.ph === "trap" && sb.ph === "trap", `${sa.me}/${sb.me}`);
  const na = await names(A), nb = await names(B);
  check("jména podle names: x = Mark, o = Radka na obou zařízeních", /^Mark/.test(na[0]) && /^Radka/.test(na[1]) && /^Mark/.test(nb[0]) && /^Radka/.test(nb[1]), JSON.stringify([na, nb]));
  check("zprávy: obě okna poslala pripraveno a stav hraje", (await A.msgs()).some(m => m.typ === "pripraveno") && (await A.msgs()).some(m => m.typ === "stav" && m.faze === "hraje") && (await B.msgs()).some(m => m.typ === "stav" && m.faze === "hraje"));
  await A.page.screenshot({ path: path.join(SH, "herna-A-start.png") });
  await B.page.screenshot({ path: path.join(SH, "herna-B-start.png") });

  // celá partie: oba hrají skriptem
  const step = async S => {
    const s = await S.st(); if (!s || s.ph === "end") return s;
    if (s.busy || s.result) { await S.ev(() => window.__jm.scene.skip()); return s; }
    if (s.ph === "trap" && s.me && !s.pend[s.me]) await S.ev(() => window.__jm.autoTrap());
    else if (s.ph === "play" && s.p === s.me) await S.ev(() => { const b = window.__jm.bot(); window.__jm.shoot(b.A, b.P); });
    return s;
  };
  // B (WebKit iPhone 13, iframe 390×613) se při hře průběžně měří: výběr pasti (všechny tři karty), výsledek jamky, úder
  const stepB = async S => {
    const s = await S.st();
    if (s && !s.busy && s.ph === "trap" && s.me && !s.pend[s.me] && !s.result && !fitSeen.has(`past/${s.hole}/vyber`)) {
      await probe(S, `past/${s.hole}/vyber`);
      for (const k of await S.ev(() => [...document.querySelectorAll("#dock .tc")].map(b => b.dataset.k))) {
        await S.ev(k => document.querySelector(`#dock .tc[data-k="${k}"]`).click(), k); await sleep(300); await probe(S, `past/${s.hole}/${k}`);
      }
    } else if (s && s.result) await probe(S, `vysledek/${s.hole}`);
    else if (s && !s.busy && s.ph === "play" && s.p === s.me) await probe(S, `uder/${s.hole}`);
    return step(S);
  };
  const t0 = Date.now();
  while (Date.now() - t0 < 12 * 60 * 1000) {
    const [x, y] = [await step(A), await stepB(B)];
    if (x && y && x.ph === "end" && y.ph === "end") break;
    await sleep(250);
  }
  const ea = await A.st(), eb = await B.st();
  check("partie došla do konce na obou zařízeních se stejným skóre", ea.ph === "end" && eb.ph === "end" && JSON.stringify(ea.sc) === JSON.stringify(eb.sc), `${(Date.now() - t0) / 1000 | 0} s, x ${ea.sc.x} / o ${ea.sc.o}`);
  await until(async () => (await A.ev(() => !!document.getElementById("bAgain"))) && (await B.ev(() => !!document.getElementById("bAgain"))), 40000, "karta konce partie (po výsledku poslední jamky)");
  await sleep(800);
  await probe(B, "konec/karta");
  const tot = a =>a.reduce((s, v) => s + v, 0);
  const expect = tot(ea.sc.x) < tot(ea.sc.o) ? 0 : tot(ea.sc.o) < tot(ea.sc.x) ? 1 : null;      // x je sedadlo 0 (Mark)
  for (const S of [A, B]) {
    const m = (await S.msgs()).filter(q => q.typ === "vysledek");
    check(`${S.name}: přesně jedna zpráva vysledek, partie "${r1}:0", vitez = sedadlo vítěze`, m.length === 1 && m[0].partie === `${r1}:0` && m[0].vitez === expect, JSON.stringify(m));
    check(`${S.name}: stav konec odeslán`, (await S.msgs()).some(q => q.typ === "stav" && q.faze === "konec"));
  }
  const endBtns = await A.ev(() => [...document.querySelectorAll("#view button")].map(b => b.textContent.trim()));
  check("konec partie: vedle Odveta je „Jiná hra“ (sekundární), žádné „Vyzvat soupeře“", endBtns.includes("Odveta") && endBtns.includes("Jiná hra") && !endBtns.includes("Vyzvat soupeře"), endBtns.join(" | "));
  await A.page.screenshot({ path: path.join(SH, "herna-A-konec.png") });
  await B.ev(() => document.getElementById("bOther").click());
  await sleep(500);
  check("klik na „Jiná hra“ pošle zprávu jina-hra", (await B.msgs()).filter(q => q.typ === "jina-hra").length === 1, JSON.stringify((await B.msgs()).filter(q => q.typ === "jina-hra")));
  // odveta: A navrhne, B přijme, nová partie má nové `partie` a stav hraje
  await A.ev(() => document.getElementById("bAgain").click());
  await until(async () => (await B.ev(() => !!document.getElementById("bAgain") && /Přijmout odvetu/.test(document.getElementById("bAgain").textContent))), 20000, "B vidí nabídku odvety");
  await probe(B, "konec/nabidka-odvety");
  // nejhorší případ karty konce: 4 titulky (víc hra nevypíše), řádek série a věta o odvetě; karta se v 390×613 musí pořád vejít
  await B.ev(() => {
    const ul = document.querySelector(".endcard .titles") || document.querySelector(".endcard .cardwrap").insertAdjacentElement("afterend", Object.assign(document.createElement("ul"), { className: "titles" }));
    if (!ul.children.length) ul.innerHTML = '<li class="c-x"><b>Eso</b><span>Mark · Jamka jednou ranou.</span></li>';
    while (ul.children.length < 4) ul.appendChild(ul.lastElementChild.cloneNode(true));
    if (!document.querySelector(".endcard .ser")) document.querySelector(".endcard .score").insertAdjacentHTML("afterend", '<p class="ser">Série 3 : 1</p>');
    if (!document.querySelector(".endcard .wait")) document.querySelector(".endcard").insertAdjacentHTML("beforeend", '<p class="wait">Mark chce odvetu. Nové jamky, nové pasti.</p>');
  });
  await probe(B, "konec/nejhorsi-4-titulky");
  await B.ev(() => document.getElementById("bAgain").click());
  await until(async () => { const x = await A.st(), y = await B.st(); return x && y && x.ph === "trap" && y.ph === "trap" && x.sc.x.length === 0 && y.sc.x.length === 0 && x.seed === y.seed && x.seed !== ea.seed; }, 30000, "obě okna v nové partii");
  check("odveta: obě okna jsou v nové partii (jiný seed), stav hraje odeslán znovu", (await A.msgs()).filter(q => q.typ === "stav" && q.faze === "hraje").length >= 1);
  check(`iPhone 13 v iframe 390×613 (lišta Herny 51 px): vše vejde bez scrollu a bez useknutí (past, výsledek jamky, úder, konec, nabídka odvety; ${fitN} měření)`, fitN >= 20 && fitBad.size === 0, [...fitBad].map(([k, v]) => `${k}: ${v}`).slice(0, 6).join(" | "));
  const errs1 = [...A.errs, ...B.errs];
  check("scénář 1: žádné chyby v konzoli ani HTTP chyby", errs1.length === 0, errs1.slice(0, 3).join(" | "));

  // ---------- scénář 2: zakladatel = sedadlo 1 (Čeněk), jména s diakritikou, obě okna sednou a zahrají první past + ránu ----------
  const r2 = rid(), nm = ["Žaneta Č.", "Čeněk"];
  const C = await open(bW, IPH, "C", gameUrl(r2, 1, nm, 1));                    // sedadlo 1 zakládá
  const D = await open(bC, DESK, "D", gameUrl(r2, 0, nm, 0));                   // sedadlo 0 čeká
  await until(async () => (await C.st()) && (await D.st()), 30000, "C i D ve hře");
  const nc = await names(C), nd = await names(D), sc = await C.st(), sd = await D.st();
  check("sedadlo 1 zakládá: x = jméno zakladatele (Čeněk), o = Žaneta Č., diakritika projde", /^Čeněk/.test(nc[0]) && /^Žaneta Č\./.test(nc[1]) && JSON.stringify(nc.map(x => x.replace(/ ty$/, ""))) === JSON.stringify(nd.map(x => x.replace(/ ty$/, ""))), JSON.stringify([nc, nd]));
  check("sedadlo 1 zakládá: C je x, D je o", sc.me === "x" && sd.me === "o");
  for (let i = 0; i < 60; i++) { await step(C); await step(D); const a = await C.st(), b = await D.st(); if (a.n >= 2 && b.n >= 2) break; await sleep(300); }
  const c2 = await C.st(), d2 = await D.st();
  check("scénář 2: oba vidí tytéž údery po pasti (stav bit po bitu)", c2.n >= 2 && JSON.stringify(c2.balls) === JSON.stringify(d2.balls) && JSON.stringify(c2.str) === JSON.stringify(d2.str), `n ${c2.n}/${d2.n}`);
  const errs2 = [...C.errs, ...D.errs];
  check("scénář 2: žádné chyby v konzoli", errs2.length === 0, errs2.slice(0, 3).join(" | "));

  // ---------- bez platného #herna=1 se hra chová jako dřív ----------
  for (const h of ["", "#herna=1&m=x", "#herna=1&m=test000000&r=abc&seat=0&names=A,B&zaklada=1", "#herna=0&r=" + rid() + "&seat=0&names=A,B&zaklada=1"]) {
    const ctx = await bC.newContext(DESK), p = await ctx.newPage(), e = [];
    p.on("pageerror", x => e.push(x.message));
    await p.goto(BASE + h);
    await p.waitForSelector("#bCreate", { timeout: 8000 }).catch(() => { });
    const ok = (await p.locator("#bCreate").count()) === 1 && (await p.locator("#bSolo").count()) === 1;
    check(`bez platného herna=1 (${h || "bez hashe"}): úvod s výzvou a „Zkusit sám“ jako dřív`, ok && !e.length);
    await ctx.close();
  }
  await bC.close(); await bW.close();
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
