// Jamka na míru – UI, místnost a přehrávání. Stav hry = přehrání deníků obou hráčů (sim.js), nic dalšího.
import * as Net from "./net.js";
import { createScene, PLAYER } from "./scene.js";
const J = self.JM;
const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const LOCAL = Q.has("mistni");                                   // hra na jednom zařízení (testy, návrhy)
const BASE = location.origin + location.pathname;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const clampName = s => (s || "").replace(/\s+/g, " ").trim().slice(0, 16);
const sameName = (a, b) => !!a && !!b && a.toLocaleLowerCase("cs") === b.toLocaleLowerCase("cs");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const other = J.other;

const sc = createScene($("cv"));
let room = null;                 // { id, meta, seat, docs: {x, o}, w, local }
let G = null, shown = 0, queue = [], busy = false, gameKey = "", holeOn = -1, fresh = true;
let herna = null;                // { m, r, seat, names, zaklada } v režimu Herny (protokol react-apps/HERNA-PROTOKOL.md), jinak null
const ui = { sel: null, ghost: null, rot: 0, aim: null, camAuto: true, mood: { x: null, o: null }, result: null };

// ---------- toast ----------
let toastT = 0;
function toast(t, ms = 2600) { const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), ms); }

// ---------- zvuk: syntetizovaný, zapne se po prvním dotyku ----------
const sound = (() => {
  let ac = null, on = Net.store.get("jm-sound") !== "0";
  const ctx = () => { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { } if (ac && ac.state === "suspended") ac.resume(); return ac; };
  addEventListener("pointerdown", ctx, { once: true });
  const tone = (f, d, type = "sine", v = 0.2, slide = 0) => {
    const a = on && ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02);
  };
  const noise = (d, v = 0.25, f = 900) => {
    const a = on && ctx(); if (!a) return;
    const b = a.createBuffer(1, Math.floor(a.sampleRate * d), a.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    fl.type = "lowpass"; fl.frequency.value = f; g.gain.value = v; s.buffer = b; s.connect(fl).connect(g).connect(a.destination); s.start();
  };
  return {
    get on() { return on; }, toggle() { on = !on; Net.store.set("jm-sound", on ? "1" : "0"); return on; },
    putt: p => tone(380 + p * 200, 0.08, "triangle", 0.25 + p * 0.15, 0.6),
    wall: v => tone(220 + Math.min(1, v / 200) * 160, 0.05, "square", 0.05 + Math.min(0.1, v / 2500)),
    spring: () => tone(300, 0.25, "sine", 0.22, 3.2),
    mill: () => tone(160, 0.09, "sawtooth", 0.08, 0.7),
    splash: () => { noise(0.45, 0.35, 1400); tone(500, 0.25, "sine", 0.12, 0.4); },
    cup: () => { tone(660, 0.12, "sine", 0.2); setTimeout(() => tone(990, 0.22, "sine", 0.18), 110); },
    trap: () => { tone(520, 0.1, "triangle", 0.15, 1.5); setTimeout(() => tone(780, 0.14, "triangle", 0.13), 90); },
    lip: () => tone(700, 0.07, "triangle", 0.12, 0.8),
  };
})();
// nabídka: skórkarta, zvuk, celá obrazovka v jednom tlačítku
function closeMenu() { $("menu").hidden = true; $("bMenu").setAttribute("aria-expanded", "false"); }
$("bMenu").addEventListener("click", () => {
  const open = $("menu").hidden; $("menu").hidden = !open; $("bMenu").setAttribute("aria-expanded", open ? "true" : "false");
  if (open) document.body.classList.remove("cardOpen");
});
document.addEventListener("pointerdown", e => { if (!$("menu").hidden && !$("menu").contains(e.target) && !$("bMenu").contains(e.target)) closeMenu(); }, true);
$("bCard").addEventListener("click", () => { closeMenu(); document.body.classList.toggle("cardOpen"); });
$("card").addEventListener("click", () => document.body.classList.remove("cardOpen"));
$("bSound").addEventListener("click", () => { const on = sound.toggle(); paintSound(); closeMenu(); toast(on ? "Zvuk zapnutý." : "Zvuk vypnutý."); });
function paintSound() { $("bSound").classList.toggle("off", !sound.on); $("bSound").querySelector("span").textContent = sound.on ? "Zvuk zapnutý" : "Zvuk vypnutý"; }
paintSound();

// ---------- celá obrazovka / plocha na iPhonu ----------
const platform = (() => {
  const ua = navigator.userAgent, iphone = /iPhone|iPod/.test(ua), ipad = /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const r = document.documentElement, api = !!(r.requestFullscreen || r.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
  return { ios: iphone || ipad, canFs: api && !iphone, standalone: !!navigator.standalone || matchMedia("(display-mode: standalone)").matches };
})();
(() => {
  const btn = $("bFs");
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (platform.canFs && !platform.standalone) {
    btn.hidden = false;
    btn.addEventListener("click", async () => {
      closeMenu();
      try { if (isFs()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { const r = document.documentElement; await (r.requestFullscreen || r.webkitRequestFullscreen).call(r, { navigationUI: "hide" }); } }
      catch { toast("Prohlížeč celou obrazovku nepustil."); }
    });
    for (const ev of ["fullscreenchange", "webkitfullscreenchange"]) document.addEventListener(ev, () => { btn.classList.toggle("on", isFs()); setTimeout(layout, 60); });
  }
  if (platform.ios && !platform.standalone && Net.store.get("jm-ioshint") !== "1") {
    $("iosHint").hidden = false;
    $("iosHintX").addEventListener("click", () => { $("iosHint").hidden = true; Net.store.set("jm-ioshint", "1"); });
  }
})();

// ---------- rozvržení: kolik místa zabírá HUD (pro rámování kamery) ----------
function layout() {
  sc.resize();
  const h = innerHeight, top = $("topbar").getBoundingClientRect().bottom, bot = h - $("dock").getBoundingClientRect().top;
  document.body.style.setProperty("--dockOH", $("dock").offsetHeight + "px");
  document.body.style.setProperty("--dockH", ($("dock").offsetHeight && getComputedStyle($("dock")).opacity !== "0" ? $("dock").offsetHeight + 8 : 0) + "px");
  const box = id => { const e = $(id); if (!e || e.hidden) return null; const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return null; const r = e.getBoundingClientRect(); return r.width ? [r.left, r.top, r.right, r.bottom] : null; };
  sc.setHudRects([box("bMenu"), box("bCam")].filter(Boolean));
  const pad = { t: Math.min(0.5, (top + 8) / h * 2), b: Math.min(0.95, (bot + 8) / h * 2), l: 0.04, r: 0.04 };
  // iPhone na šířku: v záběru za míčkem je panel jen obdélník vpravo dole, míček sedí vedle něj (obraz se posune doleva)
  const w = innerWidth, low = h <= 500 && w > h * 1.5;
  let bp = null;
  if (low) {
    const dk = $("dock"), dr = box("dock"), aimW = Math.min(400, w * 0.56), xb = Math.max(0.28, (w - 12 - aimW - 64) / w);
    if (dr && !dk.classList.contains("quiet")) sc.setHudRects([box("bMenu"), box("bCam"), dr].filter(Boolean));
    bp = { t: pad.t, b: Math.min(0.3, 12 / h * 2), l: 0.04, r: 0.04, xs: (1 - 2 * xb) * w / 2 };
  }
  sc.setHudPad(pad, bp);
}
addEventListener("resize", () => setTimeout(layout, 30));

// ---------- jména a pomocné texty ----------
const nameOf = p => room && room.meta ? (p === "x" ? room.meta.g.a : (room.meta.g.b || "Soupeř")) : p;
const me = () => room ? (room.solo ? "x" : room.local ? localMe() : room.seat) : null;      // sólo: hráč je vždy x, bot je o
function localMe() { if (!G) return "x"; if (G.ph === "trap") return G.pend.x === null ? "x" : "o"; return G.p || "x"; }
const isMe = p => !room.local && p === room.seat;
const you = p => room.solo ? p === "x" : isMe(p);                // pro texty „stavíš“ / „tvůj tah“ (v sólu hraje „ty“ i bez štítku)
const who = p => room.local ? nameOf(p) : isMe(p) ? "Ty" : nameOf(p);
const course = () => G && G.ph !== "end" ? J.hole(G.seed, G.hole) : null;
const rel = n => n === 0 ? "par" : n > 0 ? "+" + n : "−" + -n;
function totals(p) {
  if (!G) return { s: 0, par: 0 };
  let s = 0, par = 0;
  G.sc[p].forEach((v, i) => { s += v; par += G.pars[i]; });
  return { s, par };
}
const INK = "#1E1B2E";
const EYE = (dy = 0, px = 0.5, py = 0.8) => `<ellipse cx="14" cy="${18 + dy}" rx="4.3" ry="4.8" fill="#fff"/><ellipse cx="26" cy="${18 + dy}" rx="4.3" ry="4.8" fill="#fff"/><circle cx="${14 + px}" cy="${18 + dy + py}" r="2.3" fill="${INK}"/><circle cx="${26 + px}" cy="${18 + dy + py}" r="2.3" fill="${INK}"/>`;
const STROKE = (d, w = 2.4) => `<path d="${d}" stroke="${INK}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const FACES = {
  idle: () => EYE() + STROKE("M15 26q5 4 10 0"),
  content: () => EYE(0, 0, 0.3) + STROKE("M12.5 25q7.5 7 15 0") + '<ellipse cx="9" cy="24" rx="2.2" ry="1.4" fill="#FF8FA3" opacity=".75"/><ellipse cx="31" cy="24" rx="2.2" ry="1.4" fill="#FF8FA3" opacity=".75"/>',
  happy: () => STROKE("M11 18q3-4 6 0M23 18q3-4 6 0", 2.6) + `<path d="M13 24q7 8 14 0z" fill="${INK}"/>`,
  smug: () => `<ellipse cx="14" cy="19.5" rx="4.3" ry="3.4" fill="#fff"/><ellipse cx="26" cy="19.5" rx="4.3" ry="3.4" fill="#fff"/><circle cx="16" cy="19.8" r="2.1" fill="${INK}"/><circle cx="28" cy="19.8" r="2.1" fill="${INK}"/>` + STROKE("M8.5 14l10 3.2M31.5 14l-10 3.2", 2.7) + STROKE("M14 26.5q7 4 13-3.5"),
  grr: () => `<ellipse cx="14" cy="19.5" rx="3.9" ry="3.9" fill="#fff"/><ellipse cx="26" cy="19.5" rx="3.9" ry="3.9" fill="#fff"/><circle cx="14.4" cy="20.2" r="2.1" fill="${INK}"/><circle cx="25.6" cy="20.2" r="2.1" fill="${INK}"/>` + STROKE("M8.5 12.5l10.5 5.5M31.5 12.5L21 18", 3) + STROKE("M14 29q6-5.5 12 0", 2.6),
  sad: () => EYE(1.5, 0, 1.6) + STROKE("M8.5 16.5l9.5-4.5M31.5 16.5L22 12", 2.6) + STROKE("M14 29.5q6-5.5 12 0", 2.6) + `<path d="M32.5 23q3 4.2 0 6.2q-3-2 0-6.2z" fill="#7FD3FF"/>`,
};
FACES.wet = FACES.sad;
const ballSvg = (p, face = "idle") => `<svg viewBox="0 0 40 40" class="bi" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="${PLAYER[p].ball}"/><circle cx="20" cy="20" r="18" fill="none" stroke="${PLAYER[p].deep}" stroke-width="2.4" opacity=".5"/>${(FACES[face] || FACES.idle)()}</svg>`;
const TRAP_ICON = {
  mlyn: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#F25F5C" opacity=".14"/><g transform="rotate(20 24 24)"><rect x="22" y="5" width="4" height="38" rx="2" fill="#F25F5C"/><rect x="5" y="22" width="38" height="4" rx="2" fill="#F25F5C"/></g><circle cx="24" cy="24" r="6.5" fill="#F6E7C8" stroke="#1E1B2E" stroke-width="2"/></svg>',
  louze: '<svg viewBox="0 0 48 48"><path d="M7 27c0-8 9-12 17-12s18 3 18 11-9 12-18 12S7 35 7 27z" fill="#6FA6C4"/><path d="M15 25q4-4 9-3" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="30" cy="24" rx="6" ry="4" fill="#FFD23F"/><circle cx="34" cy="19" r="3.2" fill="#FFD23F"/><path d="M37 19l3 .8-3 1z" fill="#FF8A3D"/></svg>',
  stena: '<svg viewBox="0 0 48 48"><g transform="rotate(-18 24 24)"><rect x="6" y="19" width="36" height="10" rx="2" fill="#fff" stroke="#1E1B2E" stroke-width="2"/><rect x="12" y="19" width="6" height="10" fill="#F25F5C"/><rect x="24" y="19" width="6" height="10" fill="#F25F5C"/><rect x="36" y="19" width="5" height="10" fill="#F25F5C"/></g><path d="M8 40q3-3 6 0t6 0" stroke="#9AA4B2" stroke-width="2.4" fill="none"/></svg>',
  kopec: '<svg viewBox="0 0 48 48"><path d="M4 38q20-32 40 0z" fill="#8C6142"/><circle cx="24" cy="19" r="7" fill="#3B3346"/><circle cx="21.3" cy="17.5" r="1.6" fill="#fff"/><circle cx="26.7" cy="17.5" r="1.6" fill="#fff"/><circle cx="24" cy="21.5" r="2" fill="#FF8FA3"/></svg>',
};

// ---------- HUD: všechna čísla a texty z jednoho stavu G ----------
const rany = n => n === 1 ? "rána" : n >= 2 && n <= 4 ? "rány" : "ran";
// výraz podle stavu: stavím past = škodolibý, chytila mě past = zamračený, vedu = spokojený, na konci veselý a zkroušený
function faceOf(p) {
  if (!G) return "idle";
  if (ui.result) return ui.result.face[p];
  if (G.ph === "end") return G.win === "=" ? "content" : G.win === p ? "happy" : "sad";
  if (ui.mood[p]) return ui.mood[p];
  if (G.ph === "trap") return G.pend[p] === null ? "smug" : "idle";
  if (G.done[p]) return "happy";
  if (G.pars.length && totals(p).s < totals(other(p)).s) return "content";
  return "idle";
}
// druhý řádek štítku: nikdy prázdný
function statusOf(p) {
  const joined = p === "x" || !!room.meta.so || room.local;
  if (!joined) return "čeká na přijetí";
  if (ui.result) return `jamka · ${ui.result.v[p]} ${rany(ui.result.v[p])}`;
  if (G.ph === "end") return G.win === "=" ? "remíza" : G.win === p ? "vítěz" : "druhý";
  if (G.ph === "trap") return G.pend[p] === null ? (you(p) ? "stavíš past" : "staví past") : "past stojí";
  if (G.done[p]) return `v jamce · ${G.str[p]} ${rany(G.str[p])}`;
  if (G.p === p) return `na tahu · ${G.str[p] + 1}. rána`;
  return G.str[p] ? `čeká · ${G.str[p]} ${rany(G.str[p])}` : "čeká na odpališti";
}
// kdo je teď na řadě (jeden zvýrazněný štítek)
function onTurn(p) {
  if (ui.result) return false;
  if (G.ph === "play") return G.p === p;
  if (G.ph === "trap") return G.pend[p] === null && (!room.local || p === me());
  return false;
}
function paintHud() {
  if (!room || !G) return;
  for (const p of ["x", "o"]) {
    const t = totals(p), el = $("chip" + p.toUpperCase());
    el.classList.toggle("turn", onTurn(p));
    el.innerHTML = `${ballSvg(p, faceOf(p))}<span class="nm">${esc(nameOf(p))}${isMe(p) ? ' <i>ty</i>' : ""}</span>
      <span class="tot"><b>${t.s}</b><em>${G.pars.length ? rel(t.s - t.par) : "ran"}</em></span>
      <span class="cur">${statusOf(p)}</span>`;
  }
  const c = ui.result ? J.hole(G.seed, ui.result.h) : course();     // při výsledku jamky ukazuje lišta jamku, která se právě dohrála
  if (c) {
    const m = J.MODS[c.mod], hn = ui.result ? ui.result.h : G.hole;
    $("holePill").innerHTML = `<b>Jamka ${hn + 1}<span>/6</span></b><span class="par">Par ${c.par}</span>${c.mod !== "klid" ? `<span class="mod">${esc(m.name)}</span>` : ""}${room.solo ? '<span class="trn">Trénink</span>' : ""}`;
  } else $("holePill").innerHTML = `<b>Konec partie</b>`;
  paintCard();
}
function paintCard() {
  const rows = ["x", "o"].map(p => `<tr class="r-${p}"><th>${ballSvg(p)}<span>${esc(nameOf(p))}</span></th>${[0, 1, 2, 3, 4, 5].map(i => {
    const v = G.sc[p][i], par = G.pars[i];
    const cls = v == null ? "" : v === 1 ? "eso" : v < par ? "pod" : v > par ? "nad" : "par";
    const live = v == null && i === G.hole && G.ph === "play" && G.str[p] ? `<i>${G.str[p]}</i>` : "";
    return `<td class="${cls}${i === G.hole && G.ph !== "end" ? " now" : ""}">${v == null ? live : v}</td>`;
  }).join("")}<td class="sum">${totals(p).s}</td></tr>`).join("");
  const pars = [0, 1, 2, 3, 4, 5].map(i => `<td${i === G.hole && G.ph !== "end" ? ' class="now"' : ""}>${G.pars[i] != null ? G.pars[i] : i === G.hole && G.ph !== "end" ? J.hole(G.seed, i).par : ""}</td>`).join("");
  $("card").innerHTML = `<table><thead><tr><th></th>${[1, 2, 3, 4, 5, 6].map(i => `<td>${i}</td>`).join("")}<td class="sum">Σ</td></tr></thead>
    <tbody><tr class="r-par"><th>Par</th>${pars}<td class="sum">${G.pars.reduce((a, b) => a + b, 0) || ""}</td></tr>${rows}</tbody></table>`;
}
// spodní lišta: co teď dělat (a výsledek jamky)
function paintDock() { paintDock0(); camVis(); document.body.classList.toggle("dockQuiet", $("dock").classList.contains("quiet")); document.body.style.setProperty("--dockOH", $("dock").offsetHeight + "px"); requestAnimationFrame(layout); }
function resultHtml(r) {
  const win = r.v.x < r.v.o ? "x" : r.v.o < r.v.x ? "o" : "=";
  const head = win === "=" ? "Remíza na jamce" : (room.local && !room.solo) || !room.seat ? `Jamku bere ${esc(nameOf(win))}` : win === room.seat ? "Jamku bereš ty" : `Jamku bere ${esc(nameOf(win))}`;
  const rows = ["x", "o"].map(p => `<div class="rl r-${p}${win === p ? " w" : ""}">${ballSvg(p, r.face[p])}<span>${esc(nameOf(p))}</span><b>${r.v[p]}</b><em>${r.v[p] === 1 ? "eso!" : rel(r.v[p] - r.par)}</em></div>`).join("");
  return `<div class="res"><div class="rh"><b>${head}</b><span>jamka ${r.h + 1} · par ${r.par}</span></div>${rows}</div>`;
}
function paintDock0() {
  const d = $("dock"), m = me();
  d.className = "";
  if (!room || !G) { d.innerHTML = ""; return; }
  if (ui.result) { d.innerHTML = resultHtml(ui.result); return; }
  if (busy) { d.innerHTML = '<div class="say"></div>'; d.classList.add("quiet"); return; }
  if (G.ph === "trap") {
    const mine = m && G.pend[m];
    if (m && G.pend[m] === null) {
      const opts = J.offer(G, m), trailing = J.trailing(G, m);
      d.classList.add("traps");
      d.innerHTML = `<div class="say"><b>${room.local && !room.solo ? `${esc(nameOf(m))} staví past soupeři` : "Postav soupeři past"}</b><span>${trailing ? "Ztrácíš, tak vybíráš ze tří pastí." : "Past chytí jen soupeře, tebe nechá být."}</span></div>
        <div class="cards">${opts.map(k => `<button class="tc${ui.sel === k ? " on" : ""}" data-k="${k}">${TRAP_ICON[k]}<b>${J.TRAPS[k].name}</b><span>${J.TRAPS[k].desc}</span></button>`).join("")}</div>
        <div class="row">${ui.sel && J.TRAPS[ui.sel].rot ? '<button class="btn alt" id="bRot">Otočit</button>' : ""}<button class="btn" id="bPlace" ${ui.sel && ui.ghost && ui.ghost.ok ? "" : "disabled"}>${ui.sel ? (ui.ghost && ui.ghost.ok ? "Postavit sem" : "Klepni do dráhy") : "Vyber past"}</button></div>`;
      d.querySelectorAll(".tc").forEach(b => b.addEventListener("click", () => pickTrap(b.dataset.k)));
      $("bRot")?.addEventListener("click", () => { ui.rot = (ui.rot + 2) % J.ROT; if (ui.ghost) moveGhost(ui.ghost.x / 20, ui.ghost.y / 20); });
      $("bPlace").addEventListener("click", placeTrap);
    } else if (m && mine !== null) {
      const opp = other(m), joined = room.meta.so || room.local;
      d.innerHTML = `<div class="say"><b>Past stojí</b><span>${joined ? `Čekáš, až ${esc(nameOf(opp))} postaví past tobě. Pak se odhalí obě.` : `${esc(nameOf(opp))} ještě nepřijal(a) výzvu.`}</span></div>${!joined ? '<div class="row"><button class="btn" id="bShare2">Poslat výzvu znovu</button></div>' : ""}`;
      $("bShare2")?.addEventListener("click", shareLink);
    } else d.innerHTML = `<div class="say"><b>Stavějí se pasti</b><span>Přihlížíš. Obě pasti se ukážou naráz.</span></div>`;
    return;
  }
  if (G.ph === "play") {
    const p = G.p, n = G.str[p] + 1;
    if (m === p) {
      d.classList.add("aim");
      d.innerHTML = `<div class="aimrow"><div class="say"><b>${room.local && !room.solo ? esc(nameOf(p)) : "Tvůj tah"} · ${n}. rána</b><span>Táhni zpátky od míčku a pusť.</span></div><div id="pow"><i></i><b>0 %</b></div></div>`;
    } else { d.classList.add("aim"); d.innerHTML = `<div class="say"><b>Hraje ${esc(nameOf(p))} · ${n}. rána</b><span>${!room.seat ? "Přihlížíš." : G.done[m] ? "Ty už jsi v jamce." : "Potom jsi na řadě ty."}</span></div>`; }
    return;
  }
  d.innerHTML = "";
}

// ---------- přehrávání kroků ----------
function gameInfo() {
  const dx = room.docs.x || { gi: 0, acts: [] }, dy = room.docs.o || { gi: 0, acts: [] };
  const gi = Math.min(dx.gi || 0, dy.gi || 0);
  return { gi, seed: J.hashStr(room.id + ":" + gi), first: gi % 2 ? "o" : "x", logs: { x: (dx.gi || 0) === gi ? dx.acts || [] : [], o: (dy.gi || 0) === gi ? dy.acts || [] : [] } };
}
function sync() {
  if (!room) return;
  const info = gameInfo(), key = room.id + ":" + info.gi;
  if (key !== gameKey) { gameKey = key; shown = 0; queue = []; G = null; holeOn = -1; }
  const r = J.replay(info.seed, info.first, info.logs);
  if (fresh || !G) {               // první načtení: bez animací, rovnou aktuální stav
    fresh = false; shown = r.steps.length; G = r.g; enterState(true); return;
  }
  for (let i = shown; i < r.steps.length; i++) queue.push(r.steps[i]);
  shown = r.steps.length;
  pump();
}
async function pump() {
  if (busy) return;
  while (queue.length) {
    busy = true; paintDock();
    const st = queue.shift();
    try { await animate(st); } catch (e) { console.error(e); }
    G = st.g;
  }
  busy = false;
  enterState(false);
}
// zobrazení stavu G: jamka, pasti, míčky, kamera, HUD
function enterState(snap) {
  if (!G) return;
  if (G.ph === "end") { hernaStav("konec"); paintHud(); paintDock(); showEnd(); return; }
  hernaStav("hraje");
  hideView();
  const c = course();
  if (holeOn !== G.hole) {
    holeOn = G.hole; sc.setHole(c); sc.setMode("hole"); sc.snapCam(); ui.sel = null; ui.ghost = null; ui.mood = { x: null, o: null };
    if (!snap) holeIntro(c);
  }
  const m = me();
  sc.setTraps(G.ph === "play" ? G.traps : (m && G.pend[m] ? [G.pend[m]] : []), m, G.n);
  for (const k of ["x", "o"]) {
    const b = G.balls[k], trap = G.ph === "trap";
    // ve fázi pasti stojí oba míčky na odpališti vedle sebe a koukají (škodolibě, dokud staví)
    const show = trap || (G.ph === "play" && (b.on ? !b.in : G.p === k));
    const tee = { x: c.tee[0] + (trap ? (k === "x" ? -1 : 1) * J.R * 1.5 : 0), y: c.tee[1], on: true, in: false };
    sc.setBall(k, b.on ? b : tee, show);
    sc.setFace(k, trap ? (G.pend[k] === null ? "smug" : "peek") : "idle");
  }
  sc.turnRing(G.ph === "play" ? G.p : null);
  if (G.ph === "play") {
    sc.fadeOwn(G.p);
    if (ui.camAuto) { sc.setMode("ball"); sc.frameBall(G.p, snap); }
    if (m === G.p) sc.setFace(G.p, "idle");
  } else { sc.setMode("hole"); sc.setGhost(null); }
  paintCam(); paintHud(); paintDock();
  if (G.ph === "trap" && m && G.pend[m] === null && !ui.sel) { const o = J.offer(G, m); if (o.length) pickTrap(o[0], true); }
  botMaybe();
}
function holeIntro(c) {
  const m = J.MODS[c.mod], el = $("intro");
  el.innerHTML = `<div class="hi"><span class="no">Jamka ${G.hole + 1}</span><b>Par ${c.par}</b><span class="th">${esc(J.THEME_NAMES[c.th])}</span>${c.mod !== "klid" ? `<p><b>${esc(m.name)}.</b> ${esc(m.desc)}</p>` : ""}</div>`;
  el.classList.add("on"); clearTimeout(holeIntro.t); holeIntro.t = setTimeout(() => el.classList.remove("on"), 2200);
}
async function animate(st) {
  if (st.kind === "t") {
    const opp = st.by;
    if (st.g.ph === "play") {
      if (holeOn !== st.g0.hole) enterStateFor(st.g0);
      sc.setTraps(st.g.traps, me(), st.g.n); sc.dropTraps(); sound.trap();
      const bad = ["x", "o"].filter(p => st.g.pend[p] === false);
      toast(bad.length ? "Jedna past se nevešla a propadla." : st.g.moved ? "Pasti jsou venku! Jedna se kousek posunula, aby se nekryly." : "Pasti jsou venku!", st.g.moved ? 2800 : 2000);
      sc.setMode("hole");
      await sleep(room.solo ? 750 : 1100);
    } else if (!room.local && opp !== room.seat) toast(`${nameOf(opp)} už past postavil(a). Je schovaná, dokud nepostavíš svou.`, 3200);
    return;
  }
  // úder: přepočítej snímky ze stavu před úderem (stejné vstupy = stejný výsledek jako v replay)
  const g0 = st.g0, c = J.hole(g0.seed, g0.hole);
  ui.mood[st.by] = null;
  if (holeOn !== g0.hole) enterStateFor(g0);
  sc.setTraps(g0.traps, me(), g0.n); sc.fadeOwn(st.by);
  const fr = { x: [], o: [] }, by = st.by;
  const b0 = { x: { ...g0.balls.x }, o: { ...g0.balls.o } };
  if (!b0[by].on) b0[by] = { x: c.tee[0], y: c.tee[1], on: true, in: false };
  fr.x.push(b0.x.x, b0.x.y); fr.o.push(b0.o.x, b0.o.y);
  const res = J.shoot({ c, traps: g0.traps, balls: g0.balls, n: g0.n }, { by, A: st.a.A, P: st.a.P }, (t, bx, bo) => { fr.x.push(bx.x, bx.y); fr.o.push(bo.x, bo.y); });
  for (const k of ["x", "o"]) sc.setBall(k, b0[k], b0[k].on && !b0[k].in);
  sc.turnRing(null); sc.setAim(by, 0, 0);
  if (sc.mode === "ball" || ui.camAuto) { sc.setMode("ball"); sc.frameBall(by); }
  sound.putt(st.a.P / 1000);
  sc.setFace(by, st.a.P > 700 ? "fast" : "aim", 700);
  const evs = res.ev.slice();
  let ei = 0;
  const vis = { x: b0.x.on && !b0.x.in, o: b0.o.on && !b0.o.in };
  await new Promise(done => sc.playFrames(fr, g0.n, tick => {
    while (ei < evs.length && evs[ei].t + 1 <= tick) {
      const e = evs[ei++], bx = fr[e.b][(e.t + 1) * 2], by2 = fr[e.b][(e.t + 1) * 2 + 1];
      if (e.e === "zed") sound.wall(e.v || 60);
      else if (e.e === "pero") { sound.spring(); sc.setFace(e.b, "fast", 700); }
      else if (e.e === "mlyn") { sound.mill(); sc.setFace(e.b, "dizzy", 1300); }
      else if (e.e === "past") { sc.setFace(e.b, e.k === "louze" ? "worry" : "dizzy", 1300); if (e.by) sc.setFace(e.by, "smug", 1800); ui.mood[e.b] = "grr"; if (e.by) ui.mood[e.by] = "smug"; paintHud(); }
      else if (e.e === "voda") { sound.splash(); sc.burst(e.x, e.y, "voda"); sc.setFace(e.b, "wet", 1800); ui.mood[e.b] = "sad"; paintHud(); toast(e.b === by ? "Žbluňk! Zpátky na místo a rána navíc." : "Žbluňk!", 2200); }
      else if (e.e === "jamka") { sound.cup(); sc.burst(c.cup[0], c.cup[1], "jamka"); vis[e.b] = false; sc.setBall(e.b, null, false); }
      else if (e.e === "lip") { sound.lip(); sc.setFace(e.b, "worry", 900); }
      else if (e.e === "srazka") sound.wall(120);
      void bx; void by2;
    }
  }, done));
  sc.setBlades(g0.n, res.ticks);
  G = st.g; paintHud();                                  // od teď všude čísla po úderu (jeden stav)
  // konec jamky / partie: výsledek v panelu dole, scéna ukáže míček v jamce
  if (st.g.hole !== g0.hole || st.g.ph === "end") {
    const h = g0.hole, par = c.par, v = { x: st.g.sc.x[h], o: st.g.sc.o[h] }, cap = J.capOf(c);
    await sleep(450);
    const best = Math.min(v.x, v.o);
    const face = {}, items = [];
    for (const p of ["x", "o"]) {
      const holed = v[p] <= cap;
      face[p] = !holed ? "sad" : v[p] === best ? "happy" : v[p] - best >= 2 ? "sad" : "idle";
      const last = fr[p];
      items.push({ k: p, holed, face: face[p], x: last[last.length - 2], y: last[last.length - 1] });
    }
    ui.result = { h, par, v, face };
    sc.showCup(items); sound.cup();
    paintHud(); paintDock();
    await sleep(room.solo ? 2200 : 3000);        // sólo: kratší pauza, hráč čeká na dalšího bota
    ui.result = null; paintHud(); paintDock();
    await sleep(250);
  } else await sleep(room.solo ? 200 : 350);
}
// když animace začíná na jiné jamce, než je zobrazená (pozdní načtení), nejdřív ji postav
function enterStateFor(g) { holeOn = g.hole; sc.setHole(J.hole(g.seed, g.hole)); sc.snapCam(); }

// ---------- pasti: výběr, posun, postavení ----------
function pickTrap(k, quiet) {
  ui.sel = k; ui.rot = 0;
  const c = course();
  // výchozí místo: platné políčko zhruba v půlce cesty
  const dTee = c.df[Math.floor(c.tee[1]) * c.W + Math.floor(c.tee[0])];
  const cand = [];
  for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) { const d = c.df[y * c.W + x]; if (d < 1e8) cand.push({ x: x + 0.5, y: y + 0.5, s: Math.abs(d - dTee * 0.5) }); }
  cand.sort((a, b) => a.s - b.s);
  const keep = ui.ghost && ui.ghost.ok ? ui.ghost : null;
  let spot = keep ? { x: keep.x / 20, y: keep.y / 20 } : null;
  if (!spot || !J.trapValid(c, { k, x: keep.x, y: keep.y, a: 0, by: me() })) spot = cand.find(q => J.trapValid(c, { k, x: Math.round(q.x * 20), y: Math.round(q.y * 20), a: 0 })) || cand[0];
  moveGhost(spot.x, spot.y);
  if (G && G.ph === "trap") paintDock();      // zvýrazní vybranou kartu a tlačítka
  if (!quiet) sound.lip();
}
function moveGhost(x, y) {
  const c = course(), m = me();
  const t = { by: m, k: ui.sel, x: Math.round(x * 20), y: Math.round(y * 20), a: J.TRAPS[ui.sel].rot ? ui.rot : 0 };
  t.ok = J.trapValid(c, t);
  ui.ghost = t; sc.setGhost(t, t.ok);
  const b = $("bPlace"); if (b) { b.disabled = !t.ok; b.textContent = t.ok ? "Postavit sem" : "Sem ne, zkus jinam"; }
}
function placeTrap() {
  const t = ui.ghost; if (!t || !t.ok) return;
  act({ t: "t", h: G.hole, k: t.k, x: t.x, y: t.y, a: t.a });
  ui.sel = null; ui.ghost = null; sc.setGhost(null); sound.trap();
}
function act(a, who) {
  const m = who || me();
  if (room.local) { room.docs[m].acts = [...room.docs[m].acts, a]; }
  else { const d = room.w.doc(); room.w.set({ acts: [...(d.acts || []), a] }, true); room.docs[m] = room.w.doc(); }
  sync();
}
function fire(A, P) {
  if (!G || G.ph !== "play" || G.p !== me() || busy) return;
  act({ t: "s", n: G.n + 1, A, P });
}

// ---------- vstup: míření, posun ghostu, pinch zoom, posun kamery ----------
const cv = $("cv"), pts = new Map();
let pinch = null, pan = null;
cv.addEventListener("pointerdown", e => {
  cv.setPointerCapture(e.pointerId);
  document.body.classList.remove("cardOpen");
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; ui.aim = null; sc.setAim(me() || "x", 0, 0); pan = null; return; }
  if (!G || busy) return startPan(e);
  const m = me();
  if (G.ph === "trap" && m && G.pend[m] === null && ui.sel) { const g = sc.groundAt(e.clientX, e.clientY); if (g) moveGhost(g.x, g.y); ui.drag = true; return; }
  if (G.ph === "play" && G.p === m) { ui.aim = { sx: e.clientX, sy: e.clientY, pow: 0, ang: 0 }; sc.setFace(m, "aim"); return; }
  startPan(e);
});
function startPan(e) { pan = { x: e.clientX, y: e.clientY }; }
cv.addEventListener("pointermove", e => {
  if (!pts.has(e.pointerId)) return;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); sc.zoomBy(pinch.d / d); pinch.d = d; return; }
  if (ui.drag) { const g = sc.groundAt(e.clientX, e.clientY); if (g) moveGhost(g.x, g.y); return; }
  if (ui.aim) {
    const m = me(), b = sc.balls[m], h = b.g.position.y;
    const g0 = sc.groundAt(ui.aim.sx, ui.aim.sy, h), g1 = sc.groundAt(e.clientX, e.clientY, h);
    const px = Math.hypot(e.clientX - ui.aim.sx, e.clientY - ui.aim.sy), full = Math.max(150, Math.min(innerWidth, innerHeight) * 0.34);
    if (!g0 || !g1) return;
    ui.aim.pow = Math.min(1, px / full); ui.aim.ang = Math.atan2(g0.y - g1.y, g0.x - g1.x);
    sc.setAim(m, ui.aim.ang, ui.aim.pow);
    const pw = $("pow");
    if (pw) { pw.style.setProperty("--p", ui.aim.pow.toFixed(3)); pw.classList.toggle("on", ui.aim.pow > 0.02); pw.querySelector("b").textContent = Math.round(ui.aim.pow * 100) + " %"; }
    return;
  }
  if (pan) {
    const g0 = sc.groundAt(pan.x, pan.y, 0), g1 = sc.groundAt(e.clientX, e.clientY, 0);
    if (g0 && g1) sc.pan(g0.x - g1.x, g0.y - g1.y);
    pan = { x: e.clientX, y: e.clientY };
  }
});
function endPtr(e) {
  pts.delete(e.pointerId);
  if (pts.size < 2) pinch = null;
  if (ui.drag) { ui.drag = false; return; }
  if (ui.aim) {
    const a = ui.aim; ui.aim = null; const m = me();
    sc.setAim(m, 0, 0); $("pow")?.classList.remove("on");
    if (e.type === "pointercancel" || a.pow < 0.05) { sc.setFace(m, "idle"); return; }
    let A = Math.round(a.ang / (Math.PI * 2) * J.ANG); A = ((A % J.ANG) + J.ANG) % J.ANG;
    fire(A, Math.max(40, Math.round(a.pow * 1000)));
  }
  pan = null;
}
cv.addEventListener("pointerup", endPtr); cv.addEventListener("pointercancel", endPtr);
cv.addEventListener("wheel", e => { e.preventDefault(); sc.zoomBy(e.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false });
cv.addEventListener("dblclick", () => sc.skip());
$("bCam").addEventListener("click", () => {
  const m = G && G.ph === "play" ? G.p : null;
  if (sc.mode === "ball" || !m) { sc.setMode("hole"); ui.camAuto = false; }
  else { sc.setMode("ball"); sc.frameBall(m); ui.camAuto = true; }
  paintCam();
});
function paintCam() {
  const hole = sc.mode === "hole";
  $("bCam").innerHTML = hole
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3M11 8v6M8 11h6"/></svg><span>K míčku</span>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3M8 11h6"/></svg><span>Oddálit</span>';
  camVis();
}
// Oddálit je vidět při hře (ne při výsledku jamky); na mobilu sedí v panelu, ten pak dostane místo vpravo (body.camOn)
function camVis() {
  const on = !!G && G.ph === "play" && !ui.result;
  $("bCam").hidden = !on; document.body.classList.toggle("camOn", on);
}

// ---------- sólo režim „Zkusit sám“ (#solo): bot hraje za „o“, vše jen lokálně (žádná síť, místnost ani série) ----------
let botT = 0;
function botMaybe() {
  clearTimeout(botT);
  if (!room || !room.solo || !G || busy || ui.result) return;
  const rid = room;
  if (G.ph === "trap" && G.pend.o === null) botT = setTimeout(() => { if (room === rid && G && G.ph === "trap" && G.pend.o === null && !busy) botTrap(); }, 500);
  else if (G.ph === "play" && G.p === "o" && !G.done.o) botT = setTimeout(() => { if (room === rid && G && G.ph === "play" && G.p === "o" && !busy && !ui.result) botShoot(); }, 550);   // bot střílí ~0,75 s po doběhu úderu hráče (200 ms pauza + 550 ms)
}
// Past bota: náhodný druh z nabídky a jedno z prvních šesti platných míst kolem poloviny cesty (deterministicky z místnosti, partie a jamky)
function botTrap() {
  const c = course(), r = J.rng(J.hashStr(room.id + ":" + gameInfo().gi + ":bt:" + G.hole)), opts = J.offer(G, "o"), k = opts[Math.floor(r() * opts.length)];
  const dTee = c.df[Math.floor(c.tee[1]) * c.W + Math.floor(c.tee[0])], want = dTee * (0.3 + 0.4 * r()), cand = [];
  for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) { const d = c.df[y * c.W + x]; if (d < 1e8) cand.push({ x: x + 0.5, y: y + 0.5, s: Math.abs(d - want) }); }
  cand.sort((a, b) => a.s - b.s || a.y - b.y || a.x - b.x);
  const a = J.TRAPS[k].rot ? Math.floor(r() * J.ROT) : 0, ok = [];
  for (const q of cand) { const t = { by: "o", k, x: Math.round(q.x * 20), y: Math.round(q.y * 20), a }; if (J.trapValid(c, t)) { ok.push(t); if (ok.length >= 6) break; } }
  const t = ok.length ? ok[Math.floor(r() * ok.length)] : { k, x: 0, y: 0, a: 0 };
  act({ t: "t", h: G.hole, k, x: t.x, y: t.y, a: t.a }, "o");
}
// Úder bota: J.botHuman vybírá z nejlepších ran a přidává chybu úhlu i síly (jde ho porazit)
function botShoot() {
  const c = course(), balls = G.balls.o.on ? G.balls : { ...G.balls, o: { x: c.tee[0], y: c.tee[1], on: true, in: false } };
  const b = J.botHuman(c, balls, "o", G.traps, G.n, room.id + ":" + gameInfo().gi + ":" + G.hole + ":" + G.n);
  act({ t: "s", n: G.n + 1, A: b.A, P: b.P }, "o");
}
function startSolo() {
  stopPoll(); clearTimeout(botT);
  const name = clampName(Net.store.get("jm-name") || "") || "Ty";
  room = { id: "solo-" + Net.randId(8), local: true, solo: true, meta: { g: { a: name, b: "Bot" }, so: "o" }, seat: "x", docs: { x: seatDoc(), o: seatDoc() } };
  G = null; gameKey = ""; fresh = true; queue = []; shown = 0; ui.result = null; ui.sel = null; ui.ghost = null; ui.mood = { x: null, o: null };
  hideView(); sync(); layout();
}
// z konce sólo partie do normální výzvy (jméno zůstane předvyplněné z úvodu)
function leaveSolo() {
  clearTimeout(botT);
  history.replaceState(null, "", location.pathname + location.search);
  room = null; G = null; gameKey = ""; ui.result = null; sc.setGhost(null);
  viewSetup();
}

// ---------- napojení na Hernu (protokol verze 1): #herna=1&m=…&r=…&seat=0|1&names=A,B&zaklada=0|1 ----------
function hernaParams() {
  if (LOCAL) return null;
  const raw = {};
  for (const kv of (location.hash || "").slice(1).split("&")) { const i = kv.indexOf("="); if (i > 0) raw[kv.slice(0, i)] = kv.slice(i + 1); }
  if (raw.herna !== "1" || !/^[0-9a-z]{12,16}$/.test(raw.r || "") || (raw.seat !== "0" && raw.seat !== "1") || (raw.zaklada !== "0" && raw.zaklada !== "1")) return null;
  const parts = (raw.names || "").split(",");
  if (parts.length !== 2) return null;
  let names; try { names = parts.map(x => clampName(decodeURIComponent(x))); } catch { return null; }
  if (!names[0] || !names[1]) return null;
  return { m: /^[0-9a-z]{1,16}$/.test(raw.m || "") ? raw.m : "", r: raw.r, seat: +raw.seat, names, zaklada: raw.zaklada === "1" };
}
const doHerny = z => { if (herna && window.parent !== window) window.parent.postMessage({ herna: 1, ...z }, "*"); };
let hernaFaze = "", hernaTok = 0;
const hernaStav = f => { if (herna && f !== hernaFaze) { hernaFaze = f; doHerny({ typ: "stav", faze: f }); } };
const hernaSent = new Set();
function hernaResult() {                  // jednou na konci každé partie (i odvety); vitez = sedadlo v Herně, ne vnitřní x/o
  if (!herna || !room || !G || G.ph !== "end") return;
  const key = room.id + ":" + gameInfo().gi; if (hernaSent.has(key)) return; hernaSent.add(key);
  const hx = room.meta.hx === 1 ? 1 : 0;      // sedadlo v Herně hráče x (zakladatele)
  doHerny({ typ: "vysledek", partie: key, vitez: G.win === "x" ? hx : G.win === "o" ? 1 - hx : null });
}
async function startHerna(h) {
  stopPoll(); clearTimeout(botT);
  herna = h; hernaFaze = ""; const tok = ++hernaTok;
  document.body.classList.add("herna");
  doHerny({ typ: "pripraveno" });
  room = null; G = null;
  showView("loading", `<h2>Čeká se, až hra naskočí</h2>`); hernaStav("ceka");
  let meta = null;
  while (tok === hernaTok) {
    try {
      meta = await Net.load(Net.metaUrl(h.r));
      if (!meta && h.zaklada) {          // zakládá ten, kdo hru v Herně vybral: dokument rovnou se jmény; meta je poslední, ať ho druhý nevidí napůl
        const nm = { app: "jamka-na-miru", v: 1, sx: Net.device, so: "herna", hx: h.seat, herna: 1, g: { a: h.names[h.seat], b: h.names[1 - h.seat] } };
        await Net.save(Net.seatUrl(h.r, "x"), seatDoc()); await Net.save(Net.seatUrl(h.r, "o"), seatDoc());
        await Net.save(Net.metaUrl(h.r), nm); meta = nm;
      }
    } catch { meta = null; }
    if (meta && meta.app === "jamka-na-miru" && meta.g) break;
    meta = null; await sleep(1200);
  }
  if (!meta || tok !== hernaTok) return;
  const seat = h.zaklada ? "x" : "o";
  room = { id: h.r, meta, seat, docs: { x: null, o: null }, w: null };
  fresh = true; gameKey = "";
  try { const [dx, dy] = await Promise.all([Net.load(Net.seatUrl(h.r, "x")), Net.load(Net.seatUrl(h.r, "o"))]); room.docs.x = dx; room.docs.o = dy; } catch { }
  attachSeat(); hideView(); hernaStav("hraje"); startPoll(); sync(); layout();
}

// ---------- výsledek partie a odveta ----------
function series() {
  const h = (room.docs[room.seat || "x"] || {}).hist || [];
  let wx = 0, wo = 0; for (const r of h) { if (r.x < r.o) wx++; else if (r.o < r.x) wo++; }
  return [wx, wo];
}
function showEnd() {
  const tx = totals("x").s, to = totals("o").s, m = me();
  const [wx0, wo0] = series(), info = gameInfo();
  const mine = room.docs[room.seat] || {}, logged = (mine.hist || []).some(r => r.gi === info.gi);
  const ser = room.solo ? [0, 0] : logged ? [wx0, wo0] : [wx0 + (G.win === "x" ? 1 : 0), wo0 + (G.win === "o" ? 1 : 0)];
  const tl = J.titles(G, room.solo ? null : ser);
  const head = G.win === "=" ? "Remíza!" : room.solo ? (G.win === "x" ? "Vyhráváš!" : `Vyhrává ${esc(nameOf("o"))}`) : room.local ? `Vyhrává ${esc(nameOf(G.win))}` : G.win === room.seat ? "Vyhráváš!" : room.seat ? `Vyhrává ${esc(nameOf(G.win))}` : `Vyhrává ${esc(nameOf(G.win))}`;
  const oppDoc = room.seat ? room.docs[other(room.seat)] || {} : {};
  const myNext = room.seat && (mine.gi || 0) > info.gi, oppNext = room.seat && (oppDoc.gi || 0) > info.gi;
  showView("end", `<div class="endcard">
    <div class="endpair">${G.win === "=" ? ["x", "o"].map(p => `<div class="who">${ballSvg(p, "content")}<span>${esc(nameOf(p))}</span></div>`).join("") : `<div class="who win">${ballSvg(G.win, "happy")}<span>${esc(nameOf(G.win))}</span></div><div class="who lose">${ballSvg(other(G.win), "sad")}<span>${esc(nameOf(other(G.win)))}</span></div>`}</div>
    <h2>${head}</h2>
    <p class="score"><span class="c-x">${esc(nameOf("x"))} ${tx}</span> : <span class="c-o">${to} ${esc(nameOf("o"))}</span></p>
    ${ser[0] + ser[1] ? `<p class="ser">Série ${ser[0]} : ${ser[1]}</p>` : ""}
    <div class="cardwrap">${$("card").innerHTML}</div>
    ${tl.length ? `<ul class="titles">${tl.map(t => `<li class="c-${t.p}"><b>${esc(t.t)}</b><span>${esc(nameOf(t.p))} · ${esc(t.d)}</span></li>`).join("")}</ul>` : ""}
    ${room.solo ? '<button class="btn" id="bAgain">Znovu</button><button class="btn alt" id="bChallenge">Vyzvat soupeře</button><p class="trn-note">Trénink se nepočítá do série.</p>' : room.local ? '<button class="btn" id="bAgain">Nová partie</button>' : room.seat ? (myNext ? `<p class="wait">Čekáš, až ${esc(nameOf(other(room.seat)))} kývne na odvetu.</p>` : `<button class="btn" id="bAgain">${oppNext ? `Přijmout odvetu` : "Odveta"}</button>`) : '<p class="wait">Přihlížíš.</p>'}
    ${oppNext && !myNext ? `<p class="wait">${esc(nameOf(other(room.seat)))} chce odvetu. Nové jamky, nové pasti.</p>` : ""}
  </div>`);
  if (herna) $("bAgain")?.insertAdjacentHTML("afterend", '<button class="btn alt" id="bOther">Jiná hra</button>');
  $("bAgain")?.addEventListener("click", rematch);
  $("bChallenge")?.addEventListener("click", leaveSolo);
  $("bOther")?.addEventListener("click", () => doHerny({ typ: "jina-hra" }));
  hernaResult();
}
function rematch() {
  const info = gameInfo();
  if (room.local) { for (const p of ["x", "o"]) room.docs[p] = { gi: info.gi + 1, acts: [], hist: [...(room.docs[p].hist || []), { gi: info.gi, x: totals("x").s, o: totals("o").s }] }; sync(); return; }
  const d = room.w.doc(), hist = (d.hist || []).some(r => r.gi === info.gi) ? d.hist : [...(d.hist || []), { gi: info.gi, x: totals("x").s, o: totals("o").s }];
  room.w.set({ gi: info.gi + 1, acts: [], hist: hist.slice(-40) }, true); room.docs[room.seat] = room.w.doc();
  sync(); if (G && G.ph === "end") showEnd();      // soupeř už odvetu přijal: sync spustil novou partii, karta konce by padla na prázdném G.win
}

// ---------- obrazovky mimo hru ----------
let view = "";
function showView(name, html) { view = name; const v = $("view"); v.innerHTML = `<div class="panel ${name}">${html}</div>`; v.hidden = false; document.body.classList.add("menu"); }
function hideView() { if (!view) return; view = ""; $("view").hidden = true; $("view").innerHTML = ""; document.body.classList.remove("menu"); }
const HOW = `<ul class="how"><li><b>6 jamek</b>, každá partie jiná. Vyhrává, kdo má míň ran.</li><li>Před jamkou postavíš soupeři <b>past</b> a on tobě. Tvoje past tě nechá být.</li><li>Táhni od míčku zpátky a pusť. Voda = rána navíc.</li></ul>`;
function viewSetup() {
  room = null; G = null;
  showView("setup", `<div class="logo">${ballSvg("x")}${ballSvg("o")}</div><h1>Jamka na míru</h1>
    <p class="lead">Minigolf pro dva na jednom odkazu. Každý hraje na svém mobilu, kdy má chvilku.</p>
    ${HOW}
    <label for="fMe">Tvoje jméno</label><input id="fMe" maxlength="16" autocomplete="nickname" value="${esc(Net.store.get("jm-name") || "")}" placeholder="jak ti říkat">
    <label for="fOpp">Koho vyzýváš <i>(nepovinné)</i></label><input id="fOpp" maxlength="16" placeholder="jméno soupeře">
    <button class="btn" id="bCreate">Připravit výzvu</button>
    <button class="btn alt" id="bSolo">Zkusit sám</button>`);
  $("bSolo").addEventListener("click", () => { const a = clampName($("fMe").value); if (a) Net.store.set("jm-name", a); if (location.hash === "#solo") startSolo(); else location.hash = "#solo"; });
  $("bCreate").addEventListener("click", async () => {
    const a = clampName($("fMe").value), b = clampName($("fOpp").value);
    if (!a) { $("fMe").focus(); toast("Napiš svoje jméno, ať soupeř ví, kdo ho vyzývá."); return; }
    if (sameName(a, b)) { $("fOpp").focus(); toast("Soupeř nemůže mít stejné jméno jako ty."); return; }
    Net.store.set("jm-name", a);
    $("bCreate").disabled = true; $("bCreate").textContent = "Chystám výzvu…";
    try { await createRoom(a, b); } catch { $("bCreate").disabled = false; $("bCreate").textContent = "Připravit výzvu"; toast("Spojení nevyšlo, zkus to znovu."); }
  });
}
const linkFor = () => BASE + "#r." + room.id;
const message = () => `${room.meta.g.a} tě vyzývá na Jamku na míru: 6 jamek minigolfu a před každou si navzájem postavíte past. Hraj tady: ${linkFor()}`;
async function shareLink() {
  try { if (navigator.share) await navigator.share({ text: message() }); else { await navigator.clipboard.writeText(message()); toast("Odkaz zkopírovaný, vlož ho do chatu."); } } catch { }
}
function viewShare() {
  const g = room.meta.g;
  showView("share", `<h2>Pošli výzvu${g.b ? ` pro ${esc(g.b)}` : ""}</h2>
    <p>Odkaz posíláš jen jednou, hrajete na něm i všechny odvety.</p>
    <p class="msg" id="msg">${esc(message())}</p>
    <div class="row">${navigator.share ? '<button class="btn" id="bShare">Poslat</button>' : ""}<button class="btn ${navigator.share ? "alt" : ""}" id="bCopy">Kopírovat</button></div>
    <button class="btn alt" id="bGo">Postavit první past</button>`);
  $("bShare")?.addEventListener("click", async () => { try { await navigator.share({ text: message() }); } catch { } });
  $("bCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(message()); toast("Zkopírováno, vlož to do chatu."); } catch { getSelection().selectAllChildren($("msg")); toast("Označeno, zkopíruj to ručně."); } });
  $("bGo").addEventListener("click", () => { hideView(); fresh = true; sync(); layout(); });
}
function viewIntro() {
  const g = room.meta.g;
  showView("intro", `<div class="logo">${ballSvg("x")}${ballSvg("o")}</div><h1>${esc(g.a)} tě vyzývá</h1>
    <p class="lead">na Jamku na míru. Hrajete každý na svém, kdy máte chvilku.</p>${HOW}
    <label for="fName">Tvoje jméno</label><input id="fName" maxlength="16" value="${esc(g.b || Net.store.get("jm-name") || "")}" placeholder="jak ti říkat">
    <button class="btn" id="bAccept">Přijmout výzvu</button>
    <button class="btn alt" id="bMine">Jsem ${esc(g.a)}, výzvu jsem založil(a) já</button>`);
  $("bAccept").addEventListener("click", accept);
  $("bMine").addEventListener("click", () => takeSeat("x"));
}
function viewWatch() {
  const g = room.meta.g;
  showView("watch", `<h2>Tuhle partii hrají ${esc(g.a)} a ${esc(g.b)}</h2><p>Jsi jeden z nich na jiném zařízení? Vyber se a hra se přesune sem.</p>
    <button class="btn" id="bAsX">Jsem ${esc(g.a)}</button><button class="btn alt" id="bAsO">Jsem ${esc(g.b)}</button>
    <button class="btn alt" id="bSpect">Jen se dívat</button><button class="btn alt" id="bNew">Založit vlastní partii</button>`);
  $("bAsX").addEventListener("click", () => takeSeat("x"));
  $("bAsO").addEventListener("click", () => takeSeat("o"));
  $("bSpect").addEventListener("click", () => { hideView(); fresh = true; sync(); layout(); toast("Přihlížíš."); });
  $("bNew").addEventListener("click", () => { history.replaceState(null, "", location.pathname + location.search); stopPoll(); viewSetup(); });
}
function viewError(t, text, retry) {
  showView("error", `<h2>${esc(t)}</h2><p>${esc(text || "Odkaz může být neúplný. Zkus ho otevřít znovu, nebo založ novou partii.")}</p>
    ${retry ? '<button class="btn" id="bRetry">Zkusit znovu</button>' : ""}<button class="btn ${retry ? "alt" : ""}" id="bNew">Založit novou partii</button>`);
  $("bRetry")?.addEventListener("click", openFromHash);
  $("bNew").addEventListener("click", () => { history.replaceState(null, "", location.pathname + location.search); viewSetup(); });
}

// ---------- místnost ----------
const seatKey = id => "jm-seat-" + id;
const seatDoc = () => ({ gi: 0, acts: [], hist: [] });
async function createRoom(a, b) {
  const id = Net.randId(10);
  const meta = { app: "jamka-na-miru", v: 1, sx: Net.device, so: "", g: { a, b } };
  await Net.save(Net.metaUrl(id), meta);
  await Net.save(Net.seatUrl(id, "x"), seatDoc());
  await Net.save(Net.seatUrl(id, "o"), seatDoc());      // prázdný deník soupeře hned, ať načtení nevrací 404 (zbytečná chyba v konzoli)
  Net.store.set(seatKey(id), "x");
  history.replaceState(null, "", location.pathname + location.search + "#r." + id);
  await enterRoom(id, meta);
  viewShare();
}
async function openFromHash() {
  const hp = hernaParams();
  if (hp) { startHerna(hp); return; }
  if ((location.hash || "") === "#solo") { startSolo(); return; }
  const m = /^#r\.([0-9a-z]{6,16})$/.exec(location.hash || "");
  if (!m) { viewSetup(); return; }
  showView("loading", `<h2>Otevírám partii…</h2>`);
  let meta;
  try { meta = await Net.load(Net.metaUrl(m[1])); }
  catch { viewError("Spojení nevyšlo.", "Nedaří se dovolat ke hře. Zkontroluj signál a zkus to znovu.", true); return; }
  if (!meta || meta.app !== "jamka-na-miru") { viewError("Tahle partie neexistuje."); return; }
  await enterRoom(m[1], meta);
  if (!room.seat) { if (!meta.so) { viewIntro(); return; } viewWatch(); return; }
  hideView(); sync(); layout();
}
async function enterRoom(id, meta) {
  stopPoll();
  let seat = Net.store.get(seatKey(id));
  if (meta.sx === Net.device) seat = "x"; else if (meta.so === Net.device) seat = "o";
  else if (seat && meta["s" + seat] !== Net.device) seat = null;
  room = { id, meta, seat, docs: { x: null, o: null }, w: null };
  fresh = true; gameKey = "";
  try { const [dx, dy] = await Promise.all([Net.load(Net.seatUrl(id, "x")), Net.load(Net.seatUrl(id, "o"))]); room.docs.x = dx; room.docs.o = dy; } catch { }
  if (seat) attachSeat();
  startPoll();
}
function attachSeat() {
  const d = room.docs[room.seat] || seatDoc();
  room.w = Net.seatWriter(room.id, room.seat, d);
  room.w.onNet = t => setNet(t);
  if (!room.docs[room.seat]) room.w.set({}, true);
  room.docs[room.seat] = room.w.doc();
  Net.store.set(seatKey(room.id), room.seat);
}
async function accept() {
  const name = clampName($("fName").value);
  if (!name) { $("fName").focus(); toast("Napiš svoje jméno."); return; }
  if (sameName(name, room.meta.g.a)) { $("fName").focus(); toast(`Výzvu založil(a) ${room.meta.g.a}. Jsi to ty? Klepni na „Jsem ${room.meta.g.a}“, jinak napiš svoje jméno.`, 4200); return; }
  Net.store.set("jm-name", name);
  $("bAccept").disabled = true; $("bAccept").textContent = "Přijímám…";
  try {
    const r = await Net.commitMeta(room.id, d => d && !d.so ? { ...d, so: Net.device, g: { ...d.g, b: name } } : null);
    if (!r.ok) { toast("Výzvu už mezitím přijal někdo jiný."); room.meta = r.d || room.meta; viewWatch(); return; }
    room.meta = r.d; room.seat = "o"; attachSeat();
    hideView(); fresh = true; sync(); layout();
  } catch { $("bAccept").disabled = false; $("bAccept").textContent = "Přijmout výzvu"; toast("Spojení nevyšlo, zkus to znovu."); }
}
async function takeSeat(seat) {
  try {
    const r = await Net.commitMeta(room.id, d => d ? { ...d, ["s" + seat]: Net.device } : null);
    room.meta = r.d; room.seat = seat; attachSeat(); hideView(); fresh = true; sync(); layout();
  } catch { toast("Spojení nevyšlo, zkus to znovu."); }
}
function setNet(t) { $("net").textContent = t || ""; $("net").hidden = !t; }

// ---------- polling ----------
let pollT = 0, pollSeq = 0, fails = 0;
function stopPoll() { clearTimeout(pollT); pollSeq++; }
function startPoll() { stopPoll(); poll(); }
async function poll() {
  clearTimeout(pollT);
  if (!room || room.local || document.hidden) return;
  const seq = ++pollSeq, id = room.id;
  const waitingOn = G && G.ph === "play" && G.p !== room.seat;
  try {
    const opp = room.seat ? other(room.seat) : null;
    const [meta, a, b] = await Promise.all([
      !room.meta.so || !room.seat ? Net.load(Net.metaUrl(id)) : null,
      room.seat ? Net.load(Net.seatUrl(id, opp)) : Net.load(Net.seatUrl(id, "x")),
      room.seat ? null : Net.load(Net.seatUrl(id, "o")),
    ]);
    if (!room || room.id !== id || seq !== pollSeq) return;
    fails = 0; setNet("");
    if (meta) room.meta = meta;
    if (room.seat) { if (a) room.docs[opp] = a; } else { room.docs.x = a; room.docs.o = b; }
    if (room.seat && room.w) room.docs[room.seat] = room.w.doc();
    const before = shown;
    if (!view || view === "end") sync();
    if (G && G.ph === "end" && !busy && before === shown) showEnd();
    paintHud();
  } catch { fails++; if (fails >= 3) setNet("Spojení vázne, zkouším to znovu…"); }
  if (seq === pollSeq) pollT = setTimeout(poll, fails ? Math.min(6000, 1500 * 2 ** Math.min(fails, 2)) : waitingOn ? 1200 : 2500);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && room) startPoll(); });
addEventListener("online", () => room && startPoll());
addEventListener("hashchange", () => { if (!LOCAL) openFromHash(); });

// ---------- start ----------
if (LOCAL) {
  const seed = Q.get("mistni") || "demo";
  room = { id: "mistni-" + seed, local: true, meta: { g: { a: Q.get("a") || "Mark", b: Q.get("b") || "Radka" }, so: "o" }, seat: null, docs: { x: seatDoc(), o: seatDoc() } };
  hideView(); sync();
} else openFromHash();
requestAnimationFrame(layout);

// ---------- háčky pro testy ----------
window.__jm = {
  state: () => G && { ph: G.ph, hole: G.hole, p: G.p, n: G.n, me: me(), seat: room && room.seat, busy, view, result: !!ui.result, faces: { x: faceOf("x"), o: faceOf("o") }, balls: G.balls, str: G.str, sc: G.sc, pars: G.pars, pend: G.pend && { x: G.pend.x !== null, o: G.pend.o !== null }, traps: G.traps, win: G.win, seed: G.seed },
  info: () => room && gameInfo(),
  mode: () => ({ solo: !!(room && room.solo), herna: !!herna, local: !!(room && room.local) }),
  viewInfo: () => ({ view, seat: room ? room.seat : null, room: !!room, meta: room && room.meta ? { a: room.meta.g.a, b: room.meta.g.b, so: !!room.meta.so } : null, id: room ? room.id : null }),
  trap(k, x, y, a = 0) { if (!ui.sel || ui.sel !== k) pickTrap(k, true); if (x != null) { ui.rot = a; moveGhost(x, y); } const ok = ui.ghost && ui.ghost.ok; placeTrap(); return ok; },
  autoTrap() { const m = me(), o = J.offer(G, m); pickTrap(o[0], true); const ok = ui.ghost && ui.ghost.ok; placeTrap(); return ok; },
  bot() { const c = course(); const m = me(); const balls = G.balls[m].on ? G.balls : { ...G.balls, [m]: { x: c.tee[0], y: c.tee[1], on: true, in: false } }; const b = J.botShot({ ...c, }, balls, m); return { A: b.A, P: b.P }; },
  shoot: (A, P) => fire(A, P),
  ballScreen(k) { const b = sc.balls[k]; return sc.toScreen(b.x, b.y, b.g.position.y); },
  scene: sc,
};
