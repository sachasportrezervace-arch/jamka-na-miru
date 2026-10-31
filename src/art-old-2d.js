// Jamka na míru – plochý vektor na canvasu: postavičky, dráhy, pasti, míčky.
// Styl: čisté ploché tvary bez obrysů, jeden plochý stín, velké hlavy a výrazy. Žádné bitmapy.
(function (root) {
  "use strict";
  const PI = Math.PI, TAU = PI * 2;

  const INK = "#1E2235";
  const PLAYER = {
    k: { name: "Kluk", ball: "#FFC02E", ballDk: "#D9921A", main: "#FFB627", mainDk: "#E5951A", skin: "#F0B489", skinDk: "#D8936A", hair: "#5A3422", cap: "#2D3A78", capDk: "#1F2A5C", pants: "#2D3A78", shoe: "#FFFFFF", sole: "#2D3A78" },
    h: { name: "Holka", ball: "#FF6A55", ballDk: "#D9473A", main: "#FF6A55", mainDk: "#E04B3B", skin: "#F6C7A0", skinDk: "#E0A47C", hair: "#2B1E2E", cap: "#FFFFFF", capDk: "#E3E6EE", pants: "#26A38C", shoe: "#FFFFFF", sole: "#26A38C" },
  };
  const THEME = {
    zahrada: { bg: "#8DCB63", bg2: "#7BBE52", deco: "#5FA845", deco2: "#4C9238", flower: "#FFF2C7", flower2: "#FF8F7A", turf: "#3BA55C", turf2: "#43AF64", rail: "#F5EAD2", railDk: "#D7C7A6", shadow: "rgba(30,60,20,.28)", tee: "#2E8A4B" },
    plaz: { bg: "#F4D9A2", bg2: "#ECCB8C", deco: "#5CC8DA", deco2: "#3FB3C9", flower: "#FFFFFF", flower2: "#FF8A6E", turf: "#25A58C", turf2: "#2CB096", rail: "#FFFFFF", railDk: "#DCE3E6", shadow: "rgba(120,80,20,.25)", tee: "#1C8A74" },
    obyvak: { bg: "#C98F5E", bg2: "#BD8352", deco: "#E6B27F", deco2: "#A86F42", flower: "#FFE8C8", flower2: "#3D5BC9", turf: "#3E63CF", turf2: "#4570DA", rail: "#F6EFE3", railDk: "#D9CDB9", shadow: "rgba(60,30,10,.30)", tee: "#2F4FAE" },
  };

  // ---------- pomocníci ----------
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function fillEll(c, x, y, rx, ry, col, rot = 0) { c.fillStyle = col; ell(c, x, y, rx, ry, rot); c.fill(); }
  function polyPath(c, p) { c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]); c.closePath(); }
  // měkký obrys polygonu (zaoblené rohy) – pro dráhu i ostrůvky
  function softPoly(c, p, r) {
    c.beginPath();
    const n = p.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = mid(p[n - 1], p[0]);
    c.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) { const q = p[i], nx = p[(i + 1) % n], m = mid(q, nx); c.arcTo(q[0], q[1], m[0], m[1], r); }
    c.closePath();
  }
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------- postavičky ----------
  // výrazy: klid, soustredeni, radost, sok, smutek, mazany, strach, spanek
  function face(c, who, ex, t) {
    const P = PLAYER[who];
    const blink = ex === "klid" && (t % 4.2) > 4.05;
    c.save();
    // tvářičky
    c.fillStyle = "rgba(255,110,110,.32)";
    ell(c, -30, 14, 10, 6); c.fill(); ell(c, 30, 14, 10, 6); c.fill();
    const eyeY = -4, ex1 = -17, ex2 = 17;
    c.fillStyle = INK; c.strokeStyle = INK; c.lineCap = "round"; c.lineJoin = "round";
    const dot = (x, y, rx = 5.2, ry = 7) => { fillEll(c, x, y, rx, ry, INK); fillEll(c, x + 1.8, y - 2.6, 1.7, 1.9, "#fff"); };
    const arc = (x, y, w, up) => { c.lineWidth = 4.2; c.beginPath(); if (up) c.arc(x, y + 3, w, PI * 1.15, PI * 1.85); else c.arc(x, y - 3, w, PI * 0.15, PI * 0.85); c.stroke(); };
    const brow = (x, y, a, w = 9) => { c.lineWidth = 4.5; c.beginPath(); c.moveTo(x - w * Math.cos(a), y - w * Math.sin(a)); c.lineTo(x + w * Math.cos(a), y + w * Math.sin(a)); c.stroke(); };
    switch (ex) {
      case "radost":
        arc(ex1, eyeY, 7, true); arc(ex2, eyeY, 7, true);
        c.fillStyle = "#7A2433"; c.beginPath(); c.moveTo(-17, 13); c.quadraticCurveTo(0, 15, 17, 13); c.quadraticCurveTo(14, 36, 0, 36); c.quadraticCurveTo(-14, 36, -17, 13); c.fill();
        c.fillStyle = "#FF8B8B"; ell(c, 0, 30, 8, 5); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.moveTo(-14, 14); c.lineTo(14, 14); c.lineTo(12, 19); c.lineTo(-12, 19); c.fill();
        break;
      case "sok":
        fillEll(c, ex1, eyeY - 2, 10, 12, "#fff"); fillEll(c, ex2, eyeY - 2, 10, 12, "#fff");
        fillEll(c, ex1, eyeY - 1, 3.2, 3.6, INK); fillEll(c, ex2, eyeY - 1, 3.2, 3.6, INK);
        brow(ex1, eyeY - 21, -0.25); brow(ex2, eyeY - 21, 0.25);
        fillEll(c, 0, 25, 8, 10, "#7A2433");
        // kapka potu
        c.fillStyle = "#8FD3FF"; c.beginPath(); c.moveTo(44, -26); c.quadraticCurveTo(52, -12, 44, -8); c.quadraticCurveTo(36, -12, 44, -26); c.fill();
        break;
      case "smutek":
        c.lineWidth = 4.2; c.beginPath(); c.moveTo(ex1 - 7, eyeY + 1); c.lineTo(ex1 + 7, eyeY - 1); c.moveTo(ex2 - 7, eyeY - 1); c.lineTo(ex2 + 7, eyeY + 1); c.stroke();
        brow(ex1, eyeY - 14, 0.4, 8); brow(ex2, eyeY - 14, -0.4, 8);
        c.lineWidth = 4; c.beginPath(); c.moveTo(-12, 24); c.quadraticCurveTo(-6, 18, 0, 22); c.quadraticCurveTo(6, 26, 12, 20); c.stroke();
        break;
      case "mazany":
        // přivřené oči, zvednuté obočí, úšklebek do strany
        dot(ex1, eyeY + 1, 5, 5.5); dot(ex2, eyeY + 1, 5, 5.5);
        c.fillStyle = P.skin; c.fillRect(ex1 - 9, eyeY - 9, 18, 7); c.fillRect(ex2 - 9, eyeY - 9, 18, 7);
        c.lineWidth = 3.4; c.beginPath(); c.moveTo(ex1 - 8, eyeY - 2); c.lineTo(ex1 + 8, eyeY - 2); c.moveTo(ex2 - 8, eyeY - 2); c.lineTo(ex2 + 8, eyeY - 2); c.stroke();
        brow(ex1, eyeY - 14, 0.18); brow(ex2, eyeY - 19, -0.35);
        c.lineWidth = 4.2; c.beginPath(); c.moveTo(-10, 19); c.quadraticCurveTo(6, 25, 17, 13); c.stroke();
        break;
      case "strach":
        fillEll(c, ex1, eyeY, 8, 9.5, "#fff"); fillEll(c, ex2, eyeY, 8, 9.5, "#fff");
        fillEll(c, ex1 + 2, eyeY + 1, 3.4, 4, INK); fillEll(c, ex2 + 2, eyeY + 1, 3.4, 4, INK);
        brow(ex1, eyeY - 15, 0.45, 8); brow(ex2, eyeY - 15, -0.45, 8);
        c.fillStyle = "#fff"; rr(c, -12, 17, 24, 10, 4); c.fill();
        c.lineWidth = 2; c.strokeStyle = INK; c.beginPath(); for (let i = -8; i <= 8; i += 4) { c.moveTo(i, 17); c.lineTo(i, 27); } c.stroke();
        c.lineWidth = 3; rr(c, -12, 17, 24, 10, 4); c.stroke();
        break;
      case "soustredeni":
        dot(ex1, eyeY, 5, 6.5);
        c.lineWidth = 4.2; c.beginPath(); c.moveTo(ex2 - 8, eyeY); c.quadraticCurveTo(ex2, eyeY + 3, ex2 + 8, eyeY - 1); c.stroke();
        brow(ex1, eyeY - 13, 0.1); brow(ex2, eyeY - 11, 0.3);
        c.lineWidth = 4; c.beginPath(); c.moveTo(-9, 21); c.lineTo(9, 19); c.stroke();
        c.fillStyle = "#FF7F86"; c.beginPath(); c.ellipse(10, 24, 5, 6.5, -0.4, 0, TAU); c.fill();
        break;
      case "spanek":
        c.lineWidth = 4; c.beginPath(); c.arc(ex1, eyeY - 3, 6, PI * 0.15, PI * 0.85); c.arc(ex2, eyeY - 3, 6, PI * 0.15, PI * 0.85); c.stroke();
        fillEll(c, 2, 22, 5, 4, "#7A2433");
        c.font = "800 18px 'Baloo 2', sans-serif"; c.fillStyle = INK; c.fillText("z", 40, -30); c.font = "800 13px 'Baloo 2', sans-serif"; c.fillText("z", 54, -44);
        break;
      default:
        if (blink) { c.lineWidth = 4; c.beginPath(); c.moveTo(ex1 - 6, eyeY); c.lineTo(ex1 + 6, eyeY); c.moveTo(ex2 - 6, eyeY); c.lineTo(ex2 + 6, eyeY); c.stroke(); }
        else { dot(ex1, eyeY); dot(ex2, eyeY); }
        brow(ex1, eyeY - 15, 0.08, 7); brow(ex2, eyeY - 15, -0.08, 7);
        c.lineWidth = 4.2; c.beginPath(); c.arc(0, 10, 11, PI * 0.2, PI * 0.8); c.stroke();
    }
    c.restore();
  }

  // hlava (počátek = střed obličeje), velikost ~ 120 px šířky
  function head(c, who, ex, t) {
    const P = PLAYER[who];
    c.save();
    if (who === "h") {
      // culík za hlavou
      c.fillStyle = P.hair;
      c.save(); c.translate(48, -36); c.rotate(0.5 + Math.sin(t * 2.2) * 0.06); ell(c, 22, 0, 30, 17); c.fill(); fillEll(c, 46, 6, 16, 12, P.hair, 0.4); c.restore();
      fillEll(c, 44, -36, 9, 9, P.main);
    }
    // uši
    fillEll(c, -58, 4, 11, 14, P.skin); fillEll(c, 58, 4, 11, 14, P.skin);
    fillEll(c, -58, 5, 5, 8, P.skinDk); fillEll(c, 58, 5, 5, 8, P.skinDk);
    // hlava – lehce hruškovitá
    c.fillStyle = P.skin;
    c.beginPath(); c.moveTo(0, -60); c.bezierCurveTo(44, -60, 62, -30, 60, 8); c.bezierCurveTo(58, 42, 34, 56, 0, 56); c.bezierCurveTo(-34, 56, -58, 42, -60, 8); c.bezierCurveTo(-62, -30, -44, -60, 0, -60); c.fill();
    // plochý stín vpravo dole
    c.save(); c.clip();
    c.fillStyle = P.skinDk; c.globalAlpha = 0.45; ell(c, 40, 34, 44, 40); c.fill();
    c.restore();
    if (who === "k") {
      // vlasy čouhající pod kšiltovkou
      c.fillStyle = P.hair;
      c.beginPath(); c.moveTo(-56, -14); c.quadraticCurveTo(-60, -34, -44, -40); c.lineTo(-34, -24); c.quadraticCurveTo(-48, -22, -56, -14); c.fill();
      c.beginPath(); c.moveTo(56, -14); c.quadraticCurveTo(62, -32, 46, -40); c.lineTo(36, -26); c.quadraticCurveTo(50, -22, 56, -14); c.fill();
      // kšiltovka
      c.fillStyle = P.cap;
      c.beginPath(); c.moveTo(-54, -24); c.bezierCurveTo(-56, -76, 54, -80, 54, -24); c.quadraticCurveTo(0, -36, -54, -24); c.fill();
      c.fillStyle = P.capDk; c.beginPath(); c.moveTo(-58, -24); c.quadraticCurveTo(-10, -40, 38, -30); c.quadraticCurveTo(84, -24, 92, -14); c.quadraticCurveTo(40, -16, -58, -18); c.fill();
      fillEll(c, 0, -66, 5, 3.5, P.main);
      c.fillStyle = P.main; c.beginPath(); c.moveTo(-10, -56); c.quadraticCurveTo(0, -60, 12, -55); c.lineTo(10, -48); c.quadraticCurveTo(0, -51, -8, -49); c.fill();
      // pihy
      c.fillStyle = "rgba(150,80,40,.45)";
      for (const [x, y] of [[-34, 6], [-28, 10], [-38, 12], [34, 6], [28, 10], [38, 12]]) { ell(c, x, y, 1.6, 1.6); c.fill(); }
      // nos
      fillEll(c, 2, 6, 9, 7.5, P.skinDk);
      fillEll(c, 0, 4, 8, 6.5, "#F6C09A");
    } else {
      // vlasy s ofinou
      c.fillStyle = P.hair;
      c.beginPath(); c.moveTo(-62, 10); c.bezierCurveTo(-70, -50, -30, -72, 4, -68); c.bezierCurveTo(46, -68, 70, -44, 62, 8); c.quadraticCurveTo(58, -20, 40, -30);
      c.quadraticCurveTo(14, -16, -6, -34); c.quadraticCurveTo(-26, -18, -48, -26); c.quadraticCurveTo(-58, -12, -62, 10); c.fill();
      // kšilt (sluneční štítek)
      c.fillStyle = P.cap; c.beginPath(); c.moveTo(-60, -34); c.quadraticCurveTo(0, -52, 60, -34); c.lineTo(60, -26); c.quadraticCurveTo(0, -44, -60, -26); c.fill();
      c.fillStyle = P.main; c.beginPath(); c.moveTo(-62, -30); c.quadraticCurveTo(-4, -46, 52, -32); c.quadraticCurveTo(90, -26, 96, -16); c.quadraticCurveTo(30, -26, -62, -22); c.fill();
      // řasy
      c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = "round";
      if (ex === "klid" || ex === "mazany" || ex === "soustredeni") { c.beginPath(); c.moveTo(-23, -10); c.lineTo(-28, -15); c.moveTo(23, -10); c.lineTo(28, -15); c.stroke(); }
      fillEll(c, 0, 6, 6, 4.5, P.skinDk);
    }
    face(c, who, ex, t);
    c.restore();
  }

  // celá postava (pohled zepředu), měřítko s, výška ~ 300 px při s = 1; pose: stoji, mava, hura, zakryva
  function character(c, who, x, y, s, ex = "klid", t = 0, pose = "stoji", flip = false) {
    const P = PLAYER[who];
    c.save(); c.translate(x, y); c.scale(flip ? -s : s, s);
    const bob = Math.sin(t * 2.4) * 2;
    // stín na zemi
    fillEll(c, 0, 0, 64, 11, "rgba(20,25,40,.18)");
    // nohy
    c.fillStyle = P.skin; rr(c, -20, -78, 13, 70, 6); c.fill(); rr(c, 7, -78, 13, 70, 6); c.fill();
    // boty
    c.fillStyle = P.shoe; c.beginPath(); c.ellipse(-18, -6, 19, 10, 0, PI, TAU); c.fill(); c.beginPath(); c.ellipse(18, -6, 19, 10, 0, PI, TAU); c.fill();
    c.fillStyle = P.sole; c.fillRect(-37, -7, 38, 5); c.fillRect(-1, -7, 38, 5);
    c.translate(0, bob);
    // kraťasy / sukně
    c.fillStyle = P.pants;
    if (who === "k") { rr(c, -30, -112, 60, 44, 10); c.fill(); c.fillStyle = "rgba(0,0,0,.12)"; c.fillRect(-2, -92, 4, 24); }
    else { c.beginPath(); c.moveTo(-28, -112); c.lineTo(28, -112); c.lineTo(40, -70); c.quadraticCurveTo(0, -62, -40, -70); c.closePath(); c.fill(); }
    // tělo (polokošile)
    c.fillStyle = P.main; c.beginPath(); c.moveTo(-34, -176); c.quadraticCurveTo(0, -186, 34, -176); c.lineTo(38, -108); c.quadraticCurveTo(0, -100, -38, -108); c.closePath(); c.fill();
    c.fillStyle = P.mainDk; c.beginPath(); c.moveTo(10, -176); c.quadraticCurveTo(28, -178, 34, -176); c.lineTo(38, -108); c.quadraticCurveTo(26, -105, 14, -104); c.closePath(); c.fill();
    // límeček
    c.fillStyle = "#fff"; c.beginPath(); c.moveTo(-18, -180); c.lineTo(0, -166); c.lineTo(-6, -158); c.lineTo(-22, -172); c.fill(); c.beginPath(); c.moveTo(18, -180); c.lineTo(0, -166); c.lineTo(6, -158); c.lineTo(22, -172); c.fill();
    // ruce + hůl
    const arm = (sx, a, len = 54) => { c.save(); c.translate(sx, -170); c.rotate(a); c.fillStyle = P.main; rr(c, -11, -6, 22, 24, 9); c.fill(); c.fillStyle = P.skin; rr(c, -6.5, 10, 13, len - 10, 6); c.fill(); fillEll(c, 0, len + 2, 9, 9, P.skin); c.restore(); };
    if (pose === "hura") {
      arm(-32, PI * 0.82 + Math.sin(t * 9) * 0.1); arm(32, -PI * 0.82 - Math.sin(t * 9) * 0.1);
      club(c, 46, -258, -0.6);
    } else if (pose === "zakryva") {
      arm(-30, -0.5, 50); arm(30, 0.5, 50);
      club(c, -44, -96, 0.25);
    } else if (pose === "mava") {
      arm(-30, 0.25); arm(32, -PI * 0.7 + Math.sin(t * 8) * 0.35);
      club(c, -40, -118, 0.08);
    } else {
      arm(-30, 0.42); arm(30, -0.42);
      club(c, 0, -118, 0.0);
    }
    // hlava
    c.save(); c.translate(0, -238); c.rotate(Math.sin(t * 1.3) * 0.025);
    head(c, who, ex, t);
    c.restore();
    if (pose === "zakryva") {
      // dlaně přes oči
      c.fillStyle = P.skin; fillEll(c, -20, -244, 17, 13, P.skin); fillEll(c, 20, -244, 17, 13, P.skin);
      c.fillStyle = P.skinDk; c.globalAlpha = 0.5; fillEll(c, 22, -240, 11, 6, P.skinDk); c.globalAlpha = 1;
    }
    c.restore();
  }
  function club(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = "#3A3F55"; rr(c, -3, 0, 6, 112, 3); c.fill();
    c.fillStyle = "#1E2235"; rr(c, -4.5, -2, 9, 26, 4); c.fill();
    c.fillStyle = "#C9CFDB"; rr(c, -8, 108, 32, 12, 5); c.fill();
    c.fillStyle = "#9AA2B5"; c.fillRect(-8, 116, 32, 4);
    c.restore();
  }
  // busta do HUDu / reakce: hlava + ramena, vykreslí se do kruhu nebo bez ořezu
  function bust(c, who, x, y, s, ex, t) {
    const P = PLAYER[who];
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = P.main; c.beginPath(); c.moveTo(-62, 120); c.quadraticCurveTo(-58, 58, 0, 52); c.quadraticCurveTo(58, 58, 62, 120); c.closePath(); c.fill();
    c.fillStyle = "#fff"; c.beginPath(); c.moveTo(-18, 52); c.lineTo(0, 68); c.lineTo(-6, 76); c.lineTo(-24, 60); c.fill(); c.beginPath(); c.moveTo(18, 52); c.lineTo(0, 68); c.lineTo(6, 76); c.lineTo(24, 60); c.fill();
    head(c, who, ex, t);
    c.restore();
  }

  // ---------- dráha ----------
  function drawSurround(c, theme, bb, seed) {
    const T = THEME[theme], r = seeded(seed);
    const pad = 900, x0 = bb.x0 - pad, y0 = bb.y0 - pad, w = bb.w + pad * 2, h = bb.h + pad * 2;
    c.fillStyle = T.bg; c.fillRect(x0, y0, w, h);
    if (theme === "obyvak") {
      // parkety
      c.fillStyle = T.bg2;
      for (let yy = y0; yy < y0 + h; yy += 60) for (let xx = x0 + ((yy / 60) % 2) * 120; xx < x0 + w; xx += 240) c.fillRect(xx, yy, 236, 56);
      // kus koberce a pantofle (vtip pro pozorné)
      c.fillStyle = "#E7D9C1"; rr(c, bb.x1 + 90, bb.y0 + 120, 380, 260, 24); c.fill();
      c.fillStyle = "#D24B4B"; for (let i = 0; i < 5; i++) { c.fillRect(bb.x1 + 110 + i * 72, bb.y0 + 140, 30, 220); }
      slipper(c, bb.x0 - 120, bb.y1 - 160, 0.4);
      slipper(c, bb.x0 - 70, bb.y1 - 110, 0.1);
    } else if (theme === "plaz") {
      // moře na jedné straně, mušle
      c.fillStyle = T.deco; c.beginPath(); c.moveTo(bb.x1 + 140, y0); c.lineTo(x0 + w, y0); c.lineTo(x0 + w, y0 + h); c.lineTo(bb.x1 + 140, y0 + h);
      for (let yy = y0 + h; yy > y0; yy -= 80) c.quadraticCurveTo(bb.x1 + 110, yy - 40, bb.x1 + 140, yy - 80);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 6; c.lineCap = "round";
      for (let i = 0; i < 6; i++) { const yy = bb.y0 + r() * bb.h, xx = bb.x1 + 200 + r() * 200; c.beginPath(); c.moveTo(xx, yy); c.quadraticCurveTo(xx + 20, yy - 10, xx + 40, yy); c.stroke(); }
      c.fillStyle = T.bg2;
      for (let i = 0; i < 40; i++) { ell(c, x0 + r() * w, y0 + r() * h, 3 + r() * 4, 2 + r() * 2); c.fill(); }
      // ručník
      c.save(); c.translate(bb.x0 - 140, bb.y0 + 260); c.rotate(-0.18);
      c.fillStyle = "#fff"; rr(c, -60, -120, 120, 240, 10); c.fill();
      c.fillStyle = "#FF6A55"; for (let i = 0; i < 4; i++) c.fillRect(-60, -120 + 20 + i * 60, 120, 26);
      c.restore();
    } else {
      // tráva: keře a kvítky
      c.fillStyle = T.bg2;
      for (let i = 0; i < 30; i++) { ell(c, x0 + r() * w, y0 + r() * h, 40 + r() * 70, 26 + r() * 30); c.fill(); }
      for (let i = 0; i < 14; i++) {
        const px = bb.x0 - 60 - r() * 260, py = bb.y0 + r() * bb.h, side = r() < 0.5;
        bush(c, side ? px : bb.x1 + (bb.x0 - px), py, 34 + r() * 26, T);
      }
      for (let i = 0; i < 60; i++) { const fx = x0 + r() * w, fy = y0 + r() * h; fillEll(c, fx, fy, 4, 4, r() < 0.5 ? T.flower : T.flower2); }
    }
  }
  function bush(c, x, y, s, T) {
    fillEll(c, x + 8, y + 10, s * 1.05, s * 0.8, "rgba(30,60,20,.22)");
    fillEll(c, x, y, s, s * 0.82, T.deco2);
    fillEll(c, x - s * 0.18, y - s * 0.16, s * 0.72, s * 0.58, T.deco);
  }
  function slipper(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    fillEll(c, 6, 8, 34, 70, "rgba(60,30,10,.25)");
    fillEll(c, 0, 0, 32, 68, "#3D5BC9"); fillEll(c, 0, -26, 30, 34, "#fff");
    fillEll(c, 0, -30, 12, 9, "#FFC02E");
    c.restore();
  }

  function drawCourse(c, crs, theme, cupR, t) {
    const T = THEME[theme];
    // plochý stín pod mantinely
    c.save(); c.translate(10, 14); c.fillStyle = T.shadow; softPoly(c, crs.poly, 30); c.fill(); c.restore();
    // mantinel (rail)
    c.lineJoin = "round"; c.lineCap = "round";
    c.strokeStyle = T.rail; c.lineWidth = 34; softPoly(c, crs.poly, 30); c.stroke();
    // trávník
    c.save(); softPoly(c, crs.poly, 30); c.clip();
    c.fillStyle = T.turf; c.fillRect(crs.bb.x0 - 50, crs.bb.y0 - 50, crs.bb.w + 100, crs.bb.h + 100);
    c.fillStyle = T.turf2;
    for (let y = crs.bb.y0 - 50; y < crs.bb.y1 + 50; y += 96) c.fillRect(crs.bb.x0 - 50, y, crs.bb.w + 100, 48);
    // vnitřní stín pod mantinelem
    c.strokeStyle = "rgba(0,0,0,.14)"; c.lineWidth = 46; c.translate(4, 6); softPoly(c, crs.poly, 30); c.stroke();
    c.restore();
    c.strokeStyle = T.railDk; c.lineWidth = 6; c.save(); c.translate(0, 5); c.globalAlpha = 0.0; c.restore();
    // ostrůvky
    for (const b of crs.blocks) {
      c.save(); c.translate(6, 9); c.fillStyle = "rgba(0,0,0,.2)"; softPoly(c, b, 16); c.fill(); c.restore();
      c.fillStyle = T.railDk; softPoly(c, b, 16); c.fill();
      c.save(); c.translate(0, -4); c.fillStyle = T.rail; softPoly(c, b, 16); c.fill(); c.restore();
      if (theme === "zahrada") { const bb = bboxOf(b); bush(c, (bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2 - 4, Math.min(bb.w, bb.h) * 0.36, T); }
    }
    for (const u of crs.bumps) {
      fillEll(c, u.x + 5, u.y + 8, u.r, u.r, "rgba(0,0,0,.2)");
      fillEll(c, u.x, u.y, u.r, u.r, T.railDk);
      fillEll(c, u.x, u.y - 3, u.r, u.r - 1, T.rail);
      fillEll(c, u.x - u.r * 0.3, u.y - u.r * 0.4, u.r * 0.32, u.r * 0.22, "rgba(255,255,255,.8)");
    }
    // odpaliště
    const [tx, ty] = crs.tee;
    c.fillStyle = T.tee; rr(c, tx - 34, ty - 22, 68, 44, 12); c.fill();
    fillEll(c, tx - 24, ty, 4, 4, "rgba(255,255,255,.75)"); fillEll(c, tx + 24, ty, 4, 4, "rgba(255,255,255,.75)");
    // jamka
    cup(c, crs.cup[0], crs.cup[1], cupR, t);
  }
  function bboxOf(p) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
  // railStroke vrací cestu obrysu pro hit-test a kreslení mantinelu nad pastmi
  function drawRailTop(c, crs, theme) {
    const T = THEME[theme];
    c.lineJoin = "round";
    c.save(); softPoly(c, crs.poly, 30); c.rect(crs.bb.x0 - 200, crs.bb.y0 - 200, crs.bb.w + 400, crs.bb.h + 400); c.clip("evenodd");
    c.strokeStyle = T.railDk; c.lineWidth = 34; c.save(); c.translate(0, 5); softPoly(c, crs.poly, 30); c.stroke(); c.restore();
    c.strokeStyle = T.rail; c.lineWidth = 34; softPoly(c, crs.poly, 30); c.stroke();
    c.restore();
  }
  function cup(c, x, y, r, t) {
    fillEll(c, x, y + 1, r + 3, r + 2, "rgba(255,255,255,.35)");
    fillEll(c, x, y, r, r, "#16301F");
    fillEll(c, x, y + r * 0.25, r * 0.85, r * 0.7, "#0C1A12");
    // praporek: stín na trávě + tyčka nakloněná k divákovi
    const sw = Math.sin(t * 3) * 0.08;
    c.strokeStyle = "rgba(0,0,0,.2)"; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y + 10); c.stroke();
    c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.moveTo(x + 30, y + 10); c.lineTo(x + 54, y + 14); c.lineTo(x + 26, y + 24); c.fill();
    c.strokeStyle = "#F4F4F4"; c.lineWidth = 4; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 6, y - 64); c.stroke();
    c.save(); c.translate(x - 6, y - 64); c.rotate(sw);
    c.fillStyle = "#FF4D4D"; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(18, 4, 36, 8); c.quadraticCurveTo(18, 12, 2, 24); c.closePath(); c.fill();
    c.restore();
  }

  // ---------- míček ----------
  function ball(c, who, x, y, r, t, ghost) {
    const P = PLAYER[who];
    c.save(); if (ghost) c.globalAlpha = 0.45;
    fillEll(c, x + 3, y + 5, r, r * 0.85, "rgba(0,0,0,.25)");
    fillEll(c, x, y, r, r, P.ball);
    c.save(); ell(c, x, y, r, r); c.clip(); fillEll(c, x + r * 0.5, y + r * 0.6, r * 0.95, r * 0.9, P.ballDk); c.restore();
    fillEll(c, x - r * 0.35, y - r * 0.38, r * 0.32, r * 0.24, "rgba(255,255,255,.9)", -0.5);
    c.restore();
  }

  // ---------- pasti ----------
  function ownerPin(c, x, y, who) {
    const P = PLAYER[who];
    c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 24); c.stroke();
    c.fillStyle = P.main; c.beginPath(); c.moveTo(x, y - 24); c.lineTo(x + 16, y - 19); c.lineTo(x, y - 13); c.fill();
    fillEll(c, x, y, 3, 2, INK);
  }
  function blob(c, x, y, r, seed, wob = 0.18) {
    const rn = seeded(seed), n = 9, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (1 - wob / 2 + rn() * wob); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    c.beginPath();
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (!i) { const z = pts[n - 1]; c.moveTo((z[0] + p[0]) / 2, (z[1] + p[1]) / 2); } c.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
    c.closePath();
  }
  // t = čas v sekundách (animace), blade = úhel mlýnku ze simulace (deterministický), dim = past patří mně (pro mě neškodná)
  function trap(c, tr, t, blade, dim) {
    const g = JMgeom(tr);
    c.save();
    if (dim) c.globalAlpha = 0.55;
    switch (tr.k) {
      case "louze": {
        const sd = tr.x * 7 + tr.y * 13;
        c.save(); c.translate(3, 4); c.fillStyle = "rgba(0,0,0,.12)"; blob(c, tr.x, tr.y, 54, sd); c.fill(); c.restore();
        c.fillStyle = "#8A5A36"; blob(c, tr.x, tr.y, 54, sd); c.fill();
        c.fillStyle = "#6E4429"; blob(c, tr.x + 4, tr.y + 5, 40, sd + 1); c.fill();
        c.fillStyle = "rgba(255,255,255,.22)"; ell(c, tr.x - 18, tr.y - 18, 14, 6, -0.4); c.fill();
        c.strokeStyle = "rgba(255,255,255,.28)"; c.lineWidth = 2.5;
        const ph = (t * 0.6) % 1; c.beginPath(); c.ellipse(tr.x + 10, tr.y + 6, 6 + ph * 16, 3 + ph * 8, 0, 0, TAU); c.globalAlpha *= 1 - ph; c.stroke();
        break;
      }
      case "jezirko": {
        const sd = tr.x * 5 + tr.y * 11;
        c.fillStyle = "#E6D3A8"; blob(c, tr.x, tr.y, 50, sd, 0.12); c.fill();
        c.fillStyle = "#3FB8E0"; blob(c, tr.x, tr.y, 44, sd, 0.12); c.fill();
        c.fillStyle = "#2A9ACB"; blob(c, tr.x + 5, tr.y + 7, 32, sd + 3, 0.15); c.fill();
        c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 3; c.lineCap = "round";
        c.beginPath(); c.arc(tr.x - 6, tr.y - 8, 26, PI * 1.1, PI * 1.45); c.stroke();
        // leknín a gumová kachnička
        c.fillStyle = "#4CC46A"; c.beginPath(); c.moveTo(tr.x + 18, tr.y + 16); c.arc(tr.x + 18, tr.y + 16, 11, 0.4, TAU - 0.2); c.closePath(); c.fill();
        const dx = tr.x - 16 + Math.sin(t * 0.9) * 4, dy = tr.y + 10 + Math.cos(t * 0.7) * 2;
        fillEll(c, dx, dy + 2, 11, 8, "rgba(0,0,0,.15)"); fillEll(c, dx, dy, 11, 8, "#FFD43B"); fillEll(c, dx - 7, dy - 6, 6.5, 6.5, "#FFD43B");
        c.fillStyle = "#FF8A2B"; c.beginPath(); c.moveTo(dx - 12, dy - 7); c.lineTo(dx - 19, dy - 5); c.lineTo(dx - 12, dy - 3); c.fill();
        fillEll(c, dx - 8, dy - 8, 1.5, 1.5, INK);
        break;
      }
      case "kopec": {
        fillEll(c, tr.x + 6, tr.y + 9, 62, 60, "rgba(0,0,0,.12)");
        const cols = ["#58BD6F", "#6CC981", "#84D695", "#A2E2AE"];
        for (let i = 0; i < 4; i++) fillEll(c, tr.x - i * 3, tr.y - i * 4, 64 - i * 15, 62 - i * 15, cols[i]);
        fillEll(c, tr.x - 14, tr.y - 18, 9, 5, "rgba(255,255,255,.55)", -0.5);
        break;
      }
      case "stena": {
        const s = g.seg, nx = -g.uy, ny = g.ux;
        c.lineCap = "round";
        c.strokeStyle = "rgba(0,0,0,.2)"; c.lineWidth = 14; c.beginPath(); c.moveTo(s[0] + 4, s[1] + 7); c.lineTo(s[2] + 4, s[3] + 7); c.stroke();
        // pružiny (cikcak) z obou stran
        c.strokeStyle = "#8E97AD"; c.lineWidth = 3; c.lineJoin = "round";
        for (const side of [-1, 1]) {
          c.beginPath();
          for (let i = 0; i <= 12; i++) { const k = i / 12, px = s[0] + (s[2] - s[0]) * k, py = s[1] + (s[3] - s[1]) * k, o = side * (9 + (i % 2) * 6); i ? c.lineTo(px + nx * o, py + ny * o) : c.moveTo(px + nx * o, py + ny * o); }
          c.stroke();
        }
        c.strokeStyle = "#FF4D6D"; c.lineWidth = 11; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.stroke();
        c.strokeStyle = "#fff"; c.lineWidth = 11; c.setLineDash([10, 12]); c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.stroke(); c.setLineDash([]);
        fillEll(c, s[0], s[1], 7, 7, INK); fillEll(c, s[2], s[3], 7, 7, INK);
        break;
      }
      case "fukar": {
        const { ux, uy, hw, hl } = g;
        c.save(); c.translate(tr.x, tr.y); c.rotate(Math.atan2(uy, ux));
        c.fillStyle = "rgba(255,255,255,.14)"; rr(c, -hl, -hw, hl * 2, hw * 2, 18); c.fill();
        c.strokeStyle = "rgba(255,255,255,.75)"; c.lineWidth = 3; c.lineCap = "round";
        for (let i = 0; i < 5; i++) {
          const ph = ((t * 1.4 + i * 0.37) % 1), xx = -hl + 30 + ph * (hl * 2 - 50), yy = -hw + 10 + i * (hw * 2 - 20) / 4;
          c.globalAlpha = (dim ? 0.55 : 1) * Math.sin(ph * PI);
          c.beginPath(); c.moveTo(xx - 18, yy); c.lineTo(xx + 10, yy); c.stroke();
        }
        c.globalAlpha = dim ? 0.55 : 1;
        // ventilátor v zadní části
        c.fillStyle = "rgba(0,0,0,.2)"; rr(c, -hl - 22 + 4, -32 + 6, 30, 64, 8); c.fill();
        c.fillStyle = "#E8ECF4"; rr(c, -hl - 22, -32, 30, 64, 8); c.fill();
        c.fillStyle = "#9AA4BA"; for (let i = 0; i < 5; i++) c.fillRect(-hl - 10, -26 + i * 12, 6, 6);
        c.fillStyle = "#3E8EF7"; c.beginPath(); c.moveTo(-hl + 2, -12); c.lineTo(-hl + 16, 0); c.lineTo(-hl + 2, 12); c.fill();
        c.restore();
        break;
      }
      case "mlyn": {
        fillEll(c, tr.x + 5, tr.y + 8, 50, 50, "rgba(0,0,0,.1)");
        const a0 = blade;
        for (let q = 0; q < 4; q++) {
          const a = a0 + q * PI / 2;
          c.save(); c.translate(tr.x, tr.y); c.rotate(a);
          c.fillStyle = "rgba(0,0,0,.18)"; rr(c, 10 + 3, -7 + 5, 40, 14, 4); c.fill();
          c.fillStyle = "#B97A45"; rr(c, 9, -7, 41, 14, 4); c.fill();
          c.fillStyle = "#F3E3C4"; rr(c, 14, -4.5, 33, 9, 2); c.fill();
          c.strokeStyle = "#B97A45"; c.lineWidth = 1.8; c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(14 + i * 8.2, -4.5); c.lineTo(14 + i * 8.2, 4.5); } c.stroke();
          c.restore();
        }
        // střecha (pohled shora: čtyři trojúhelníky)
        const r = 15;
        const cols = ["#E8505B", "#C93E4B", "#E8505B", "#D54652"];
        for (let q = 0; q < 4; q++) { c.fillStyle = cols[q]; c.beginPath(); c.moveTo(tr.x, tr.y); const a = q * PI / 2 + PI / 4; c.lineTo(tr.x + Math.cos(a) * r * 1.41, tr.y + Math.sin(a) * r * 1.41); c.lineTo(tr.x + Math.cos(a + PI / 2) * r * 1.41, tr.y + Math.sin(a + PI / 2) * r * 1.41); c.fill(); }
        fillEll(c, tr.x, tr.y, 4, 4, "#FFE08A");
        break;
      }
    }
    c.restore();
    ownerPin(c, tr.x + (tr.k === "mlyn" ? 20 : tr.k === "stena" ? 0 : 26), tr.y - (tr.k === "stena" ? 14 : 20), tr.by === "x" ? figOf.x : figOf.o);
  }
  // mapování x/o → postavička (nastaví hra)
  const figOf = { x: "k", o: "h" };
  // geometrie pasti z JM (simulace) – pokud není k dispozici (náhledy), spočítá se lokálně
  function JMgeom(tr) {
    if (root.JM) return root.JM.trapGeom(tr);
    const a = tr.a * TAU / 16, ux = Math.cos(a), uy = Math.sin(a);
    if (tr.k === "stena") return { seg: [tr.x - ux * 46, tr.y - uy * 46, tr.x + ux * 46, tr.y + uy * 46], ux, uy };
    if (tr.k === "fukar") return { ux, uy, hw: 34, hl: 88 };
    return { ux, uy };
  }
  // ikona pasti do karty (čtverec s × s)
  function trapIcon(c, k, s, t = 0.4) {
    c.save(); c.scale(s / 160, s / 160);
    const fake = { k, x: 80, y: 84, a: k === "fukar" ? 0 : k === "stena" ? 14 : 0, by: "_" };
    if (k === "fukar") { c.translate(80, 84); c.scale(0.72, 0.72); c.translate(-80, -84); }
    const save = figOf._; figOf._ = null;
    const op = ownerPin; void op;
    trapNoPin(c, fake, t);
    figOf._ = save;
    c.restore();
  }
  function trapNoPin(c, tr, t) { const keep = ownerPinRef.fn; ownerPinRef.fn = () => {}; try { trapCore(c, tr, t); } finally { ownerPinRef.fn = keep; } }
  const ownerPinRef = { fn: ownerPin };
  const trapCore = (c, tr, t) => trap(c, tr, t, t * 1.2, false);

  root.JA = { INK, PLAYER, THEME, character, bust, head, drawSurround, drawCourse, drawRailTop, ball, trap, trapIcon, cup, figOf, rr, ell, fillEll, softPoly, seeded, ownerPinRef };
})(typeof self !== "undefined" ? self : this);
