// Jamka na míru – 3D low-poly scéna (three.js). Svět: x = sloupec mřížky, z = řádek mřížky, y = výška.
// Ploché barvy, málo prvků, žádné stíny z mapy (jen měkká skvrna pod míčkem), ať to jede plynule na iPhonu.
import * as THREE from "three";

const J = self.JM;
export const PLAYER = { x: { ball: "#FF6A3D", deep: "#D9461F" }, o: { ball: "#3E8BFF", deep: "#1F5FD6" } };
const THEME = {
  zahrada: { sky: "#CFEBD9", ground: "#9CCB72", ground2: "#8DBF63", turfA: "#57B947", turfB: "#4DAE3F", wall: "#F6E7C8", wallSide: "#E3C99B", post: "#E9D3A6",
    skirt: "#7E5B3A", water: "#47B6E0", waterDeep: "#2E93C4", plank: "#C98A4B", plank2: "#B87A3E", tree: "#3F9A4E", tree2: "#2F8540", trunk: "#8A5A35", rock: "#B7B9A8", flag: "#FFD23F", accent: "#F25F5C" },
  plaz: { sky: "#BFE6F2", ground: "#F3DDA4", ground2: "#EBCF8E", turfA: "#3FBF9A", turfB: "#36B08D", wall: "#FFFFFF", wallSide: "#D8E6EE", post: "#FF8A5B",
    skirt: "#B58546", water: "#2FB6DE", waterDeep: "#1F92BE", plank: "#D9A066", plank2: "#C58C55", tree: "#39A86B", tree2: "#2C9058", trunk: "#B07A47", rock: "#E6D2A8", flag: "#FF5D73", accent: "#FF8A5B" },
  zima: { sky: "#DCE8F5", ground: "#F4F8FB", ground2: "#E6EEF5", turfA: "#5DB88E", turfB: "#52AC82", wall: "#E8584A", wallSide: "#B03A30", post: "#FFFFFF",
    skirt: "#566F8C", water: "#7FC4E8", waterDeep: "#5AA6D4", plank: "#A7774E", plank2: "#956844", tree: "#2F7D5B", tree2: "#25694C", trunk: "#6E4A32", rock: "#C9D3DE", flag: "#3E8BFF", accent: "#E8584A" },
};
const col = h => new THREE.Color(h);

// ---------- geometrie z trojúhelníků s barvou ve vrcholech (ploché stínování) ----------
class Mesher {
  constructor() { this.p = []; this.c = []; }
  tri(a, b, c, color) { const k = col(color); for (const v of [a, b, c]) { this.p.push(v[0], v[1], v[2]); this.c.push(k.r, k.g, k.b); } }
  quad(a, b, c, d, color) { this.tri(a, b, c, color); this.tri(a, c, d, color); }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }
}
// DoubleSide: zkosené rohy a mantinely mají trojúhelníky navinuté různým směrem; bez toho se z části ploch vykreslí jen tenká hrana
const flatMat = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
function lowMat(color, extra) { return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }); }

// ---------- obličeje míčků (kreslené na plátno, jako sprite přes míček) ----------
const faceCache = new Map();
function faceTex(kind) {
  if (faceCache.has(kind)) return faceCache.get(kind);
  const S = 128, cv = document.createElement("canvas"); cv.width = cv.height = S;
  const g = cv.getContext("2d");
  g.lineCap = "round"; g.lineJoin = "round";
  const ink = "#1E1B2E";
  const eye = (x, y, r, look = [0, 0], lid = 0) => {
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(x, y, r, r * 1.12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink; g.beginPath(); g.arc(x + look[0] * r * 0.35, y + look[1] * r * 0.35, r * 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(x + look[0] * r * 0.35 - r * 0.18, y + look[1] * r * 0.35 - r * 0.2, r * 0.16, 0, Math.PI * 2); g.fill();
    if (lid) { g.fillStyle = "rgba(0,0,0,0.0)"; }
  };
  const lidLine = (x, y, r, tilt) => { g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.moveTo(x - r - 2, y - r * 0.55 + tilt); g.lineTo(x + r + 2, y - r * 0.55 - tilt); g.stroke(); };
  const arcEye = (x, y, r, up) => { g.strokeStyle = ink; g.lineWidth = 8; g.beginPath(); if (up) g.arc(x, y + r * 0.4, r, Math.PI * 1.15, Math.PI * 1.85); else g.arc(x, y - r * 0.5, r, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); };
  const L = 42, Rr = 86, Y = 58, er = 17;
  switch (kind) {
    case "aim": eye(L, Y, er, [0.2, -0.3]); eye(Rr, Y, er, [0.2, -0.3]); lidLine(L, Y, er, -4); lidLine(Rr, Y, er, 4);
      g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(54, 96); g.lineTo(76, 94); g.stroke(); break;
    case "fast": eye(L, Y - 2, er + 3, [0, 0]); eye(Rr, Y - 2, er + 3, [0, 0]);
      g.fillStyle = ink; g.beginPath(); g.ellipse(64, 99, 8, 10, 0, 0, Math.PI * 2); g.fill(); break;
    case "dizzy": for (const x of [L, Rr]) { g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); for (let a = 0; a < 12; a += 0.3) { const rr = a * 1.5; g.lineTo(x + Math.cos(a) * rr, Y + Math.sin(a) * rr); } g.stroke(); }
      g.lineWidth = 6; g.beginPath(); g.moveTo(48, 98); g.quadraticCurveTo(56, 90, 64, 98); g.quadraticCurveTo(72, 106, 80, 98); g.stroke(); break;
    case "wet": eye(L, Y + 2, er, [0, 0.5]); eye(Rr, Y + 2, er, [0, 0.5]);
      g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(26, 36); g.lineTo(52, 42); g.moveTo(102, 36); g.lineTo(76, 42); g.stroke();
      g.beginPath(); g.arc(64, 108, 13, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      g.fillStyle = "#7FD3FF"; g.beginPath(); g.moveTo(104, 64); g.quadraticCurveTo(112, 78, 104, 84); g.quadraticCurveTo(96, 78, 104, 64); g.fill(); break;
    case "happy": arcEye(L, Y, 15, true); arcEye(Rr, Y, 15, true);
      g.fillStyle = ink; g.beginPath(); g.moveTo(44, 86); g.quadraticCurveTo(64, 116, 84, 86); g.closePath(); g.fill();
      g.fillStyle = "#FF8FA3"; g.beginPath(); g.ellipse(64, 99, 9, 5, 0, 0, Math.PI * 2); g.fill(); break;
    case "smug": eye(L, Y, er, [0.6, 0]); eye(Rr, Y, er, [0.6, 0]); lidLine(L, Y + 6, er, 0); lidLine(Rr, Y + 6, er, 0);
      g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(50, 94); g.quadraticCurveTo(68, 102, 82, 88); g.stroke(); break;
    case "worry": eye(L, Y, er, [0, 0.2]); eye(Rr, Y, er, [0, 0.2]);
      g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(26, 30); g.lineTo(50, 24); g.moveTo(102, 30); g.lineTo(78, 24); g.stroke();
      g.beginPath(); g.moveTo(50, 98); g.lineTo(58, 94); g.lineTo(66, 98); g.lineTo(74, 94); g.lineTo(80, 98); g.stroke(); break;
    case "peek": eye(L, Y, er, [0.7, -0.75]); eye(Rr, Y, er, [0.7, -0.75]);   // kouká nahoru k jamce
      g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(26, 30); g.lineTo(50, 28); g.moveTo(102, 30); g.lineTo(78, 28); g.stroke();
      g.beginPath(); g.arc(64, 90, 12, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); break;
    case "sad": eye(L, Y + 4, er, [0, 0.9]); eye(Rr, Y + 4, er, [0, 0.9]);
      g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(26, 40); g.lineTo(50, 28); g.moveTo(102, 40); g.lineTo(78, 28); g.stroke();
      g.beginPath(); g.arc(64, 112, 14, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); break;
    case "sleep": g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.moveTo(L - 14, Y + 2); g.lineTo(L + 14, Y + 2); g.moveTo(Rr - 14, Y + 2); g.lineTo(Rr + 14, Y + 2); g.stroke();
      g.lineWidth = 5; g.beginPath(); g.arc(64, 94, 6, 0, Math.PI * 2); g.stroke(); break;
    default: eye(L, Y, er, [0, 0.1]); eye(Rr, Y, er, [0, 0.1]);
      g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.arc(64, 84, 16, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  faceCache.set(kind, t);
  return t;
}
function blobTex() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, "rgba(20,30,40,0.42)"); gr.addColorStop(1, "rgba(20,30,40,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); return t;
}

export function createScene(canvas) {
  // Výkon na mobilu: na hustém displeji (DPR ≥ 2) vyhlazování MSAA skoro nevidět, ale stojí plnění pixelů; vypnuté.
  const dpr0 = Math.min(devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr0 < 2, powerPreference: "high-performance" });
  renderer.setPixelRatio(dpr0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a7a, 1.55);
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.5); sun.position.set(-6, 14, 8);
  scene.add(hemi, sun);
  const world = new THREE.Group(); scene.add(world);
  const trapG = new THREE.Group(); scene.add(trapG);
  const fx = new THREE.Group(); scene.add(fx);
  const blob = blobTex();

  let c = null, th = THEME.zahrada, traps = [], meSeat = null, ghost = null, cupMesh = null, flag = null;
  const balls = {}, aim = {};
  // ---------- míčky ----------
  for (const k of ["x", "o"]) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(J.R, 2), lowMat(PLAYER[k].ball));
    const face = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTex("idle"), transparent: true, depthWrite: false }));
    face.scale.set(J.R * 1.9, J.R * 1.9, 1);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(J.R * 3.2, J.R * 3.2), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(J.R * 1.55, J.R * 1.85, 24), new THREE.MeshBasicMaterial({ color: PLAYER[k].ball, transparent: true, opacity: 0.0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    g.add(body, face); scene.add(g, sh, ring);
    balls[k] = { g, body, face, sh, ring, kind: "idle", x: 0, y: 0, vis: false, squash: 0, face0: "idle", until: 0, sink: 0, party: false };
  }
  // ---------- míření: tečkovaná čára a prstenec síly ----------
  const dots = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); dots.push(m); }
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), new THREE.MeshBasicMaterial({ color: 0xffffff })); arrow.visible = false; scene.add(arrow);

  // ---------- stavba jamky ----------
  // uvolní geometrie i materiály (textury obličejů jsou sdílené v faceCache a zůstávají)
  function disposeTree(o) { o.traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material) for (const mm of Array.isArray(q.material) ? q.material : [q.material]) mm.dispose(); }); }
  function clear(g) { for (const o of [...g.children]) { g.remove(o); disposeTree(o); } }
  const H = (X, Y) => c.hc[Y * (c.W + 1) + X];
  function setHole(course) {
    c = course; th = THEME[c.th] || THEME.zahrada;
    clear(world); clear(trapG); clear(fx); clear(decoG); traps = []; ghost = null; cupSp = null; decoKey = "";
    scene.background = col(th.sky);
    scene.fog = new THREE.Fog(col(th.sky), 30, 70);
    hemi.groundColor = col(th.ground);
    const GROUND = -0.55, WATER_D = 0.2;
    const m = new Mesher(), W = c.W, Hh = c.H;
    // podklad: velká plocha s jemnými záhony
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), lowMat(th.ground)); gr.rotation.x = -Math.PI / 2; gr.position.set(W / 2, GROUND, Hh / 2); world.add(gr);
    const r = J.rng(c.seed ^ (c.hi * 7919 + 13));
    // trávník, mosty a voda
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, t = c.type[i]; if (!t) continue;
      const a = [x, H(x, y), y], b = [x + 1, H(x + 1, y), y], cc = [x + 1, H(x + 1, y + 1), y + 1], d = [x, H(x, y + 1), y + 1];
      const leg = c.legs[c.legOf[i]], vert = leg && (leg.d === 0 || leg.d === 2);
      if (t === J.FLOOR) {
        const stripe = ((vert ? y : x) & 1) ? th.turfA : th.turfB;
        const cu = c.cut[i];
        if (cu === 1) m.tri(a, cc, d, stripe); else if (cu === 4) m.tri(a, b, cc, stripe);
        else if (cu === 2) m.tri(b, cc, d, stripe); else if (cu === 3) m.tri(a, b, d, stripe);
        else m.quad(a, d, cc, b, stripe);
      } else if (t === J.BRIDGE) {
        // prkna napříč směrem nohy
        for (let q = 0; q < 4; q++) {
          const f0 = q / 4, f1 = (q + 1) / 4, sh = q & 1 ? th.plank : th.plank2, h = a[1] + 0.02;
          if (vert) m.quad([x, h, y + f0], [x, h, y + f1], [x + 1, h, y + f1], [x + 1, h, y + f0], sh);
          else m.quad([x + f0, h, y], [x + f0, h, y + 1], [x + f1, h, y + 1], [x + f1, h, y], sh);
        }
      } else if (t === J.WATER) {
        const h = a[1] - WATER_D;
        m.quad([x, h, y], [x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], ((x + y) & 1) ? th.water : th.waterDeep);
      }
      // břeh: kde trávník nebo most končí u vody
      if (t !== J.WATER) {
        const nb = [[0, -1, a, b], [1, 0, b, cc], [0, 1, cc, d], [-1, 0, d, a]];
        for (const [dx, dy, p, q] of nb) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= Hh || c.type[ny * W + nx] !== J.WATER) continue;
          const lo = Math.min(p[1], q[1]) - WATER_D - 0.02;
          m.quad(p, q, [q[0], lo, q[2]], [p[0], lo, p[2]], t === J.BRIDGE ? th.plank2 : th.skirt);
        }
      }
    }
    // mantinely: vnitřní stěna, horní hrana, vnější stěna až k zemi
    const WH = 0.26, WT = 0.16, posts = new Map();
    for (const s of c.segs) {
      const dx = s[2] - s[0], dz = s[3] - s[1], l = Math.sqrt(dx * dx + dz * dz), nx = dz / l, nz = -dx / l;
      if (s[6]) {                                   // zábradlí mostu: nízká lať na dvou kolících, mírně nad vodou
        const RH = 0.15, RT = 0.05, h0 = s[4] + 0.02;
        const P = (f, o, y) => [s[0] + dx * f + nx * o, h0 + y, s[1] + dz * f + nz * o];
        m.quad(P(0, -RT, RH), P(0, RT, RH), P(1, RT, RH), P(1, -RT, RH), th.plank);
        m.quad(P(0, -RT, RH - 0.06), P(0, -RT, RH), P(1, -RT, RH), P(1, -RT, RH - 0.06), th.plank2);
        m.quad(P(1, RT, RH - 0.06), P(1, RT, RH), P(0, RT, RH), P(0, RT, RH - 0.06), th.plank2);
        for (const f of [0.12, 0.88]) {
          const q = 0.035, cx = s[0] + dx * f, cz = s[1] + dz * f;
          for (const [ax, az, bx, bz] of [[-q, -q, q, -q], [q, -q, q, q], [q, q, -q, q], [-q, q, -q, -q]])
            m.quad([cx + ax, h0, cz + az], [cx + bx, h0, cz + bz], [cx + bx, h0 + RH - 0.06, cz + bz], [cx + ax, h0 + RH - 0.06, cz + az], th.plank2);
        }
        continue;
      }
      const a0 = [s[0], s[4], s[1]], b0 = [s[2], s[5], s[3]];
      const a1 = [s[0], s[4] + WH, s[1]], b1 = [s[2], s[5] + WH, s[3]];
      const a2 = [s[0] + nx * WT, s[4] + WH, s[1] + nz * WT], b2 = [s[2] + nx * WT, s[5] + WH, s[3] + nz * WT];
      const a3 = [a2[0], GROUND, a2[2]], b3 = [b2[0], GROUND, b2[2]];
      m.quad(a0, a1, b1, b0, th.wallSide);
      m.quad(a1, a2, b2, b1, th.wall);
      m.quad(a2, a3, b3, b2, th.skirt);
      for (const p of [[s[0], s[1], s[4], dx / l, dz / l], [s[2], s[3], s[5], dx / l, dz / l]]) {
        const k = p[0] + "," + p[1], e = posts.get(k);
        if (e) e.dirs.push([p[3], p[4]]); else posts.set(k, { p, dirs: [[p[3], p[4]]] });
      }
    }
    // sloupek jen tam, kde zeď mění směr (roh) nebo končí; na rovné zdi žádný
    const corners = [];
    for (const { p, dirs } of posts.values()) {
      let corner = dirs.length < 2;
      for (let i = 1; i < dirs.length && !corner; i++) if (Math.abs(dirs[0][0] * dirs[i][1] - dirs[0][1] * dirs[i][0]) > 0.2) corner = true;
      if (corner) corners.push([p[0], p[1], p[2]]);
    }
    for (const [px, pz, h] of corners) {
      const s = 0.085, t = h + WH + 0.05;
      const A = [px - s, t, pz - s], B = [px + s, t, pz - s], C = [px + s, t, pz + s], D = [px - s, t, pz + s];
      m.quad(A, D, C, B, th.post);
      const low = h + WH - 0.06;
      m.quad(A, B, [B[0], low, B[2]], [A[0], low, A[2]], th.post); m.quad(B, C, [C[0], low, C[2]], [B[0], low, B[2]], th.post);
      m.quad(C, D, [D[0], low, D[2]], [C[0], low, C[2]], th.post); m.quad(D, A, [A[0], low, A[2]], [D[0], low, D[2]], th.post);
    }
    world.add(m.mesh(flatMat()));
    // kolíky
    for (const p of c.posts) {
      const h = J.surf(c, p.x, p.y).h;
      const k = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.36, 7), lowMat(th.post)); k.position.set(p.x, h + 0.18, p.y); world.add(k);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.7, p.r, 0.08, 7), lowMat(th.accent)); cap.position.set(p.x, h + 0.4, p.y); world.add(cap);
    }
    // ostrůvky: keř nebo kámen
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (c.island[y * W + x]) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), lowMat(th.skirt)); base.position.set(x + 0.5, GROUND + 0.5, y + 0.5); world.add(base);
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), lowMat(r() < 0.5 ? th.tree : th.tree2)); b.position.set(x + 0.5, 0.5, y + 0.5); b.scale.set(1, 0.8, 1); b.rotation.y = r() * 3; world.add(b);
    }
    // odpaliště
    const tee = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.8), lowMat(th.turfB)); const th0 = J.surf(c, c.tee[0], c.tee[1]).h;
    tee.position.set(c.tee[0], th0 + 0.02, c.tee[1]); world.add(tee);
    const teeLine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), lowMat(0xffffff)); teeLine.position.set(c.tee[0], th0 + 0.03, c.tee[1] + 0.25); world.add(teeLine);
    // jamka a vlajka
    const ch = J.surf(c, c.cup[0], c.cup[1]).h, cupR = J.CUP_R * (c.mod === "velka" ? 1.45 : c.mod === "mala" ? 0.8 : 1);
    cupMesh = new THREE.Mesh(new THREE.CircleGeometry(cupR, 18), new THREE.MeshBasicMaterial({ color: 0x1b2a22 })); cupMesh.rotation.x = -Math.PI / 2; cupMesh.position.set(c.cup[0], ch + 0.006, c.cup[1]); world.add(cupMesh);
    const rim = new THREE.Mesh(new THREE.RingGeometry(cupR, cupR + 0.05, 18), new THREE.MeshBasicMaterial({ color: 0xffffff })); rim.rotation.x = -Math.PI / 2; rim.position.set(c.cup[0], ch + 0.008, c.cup[1]); world.add(rim);
    flag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5), lowMat(0xffffff)); pole.position.y = 0.65;
    const fm = new Mesher(); fm.tri([0, 1.3, 0], [0, 0.95, 0], [0.5, 1.13, 0], th.flag); fm.tri([0, 1.3, 0], [0.5, 1.13, 0], [0, 0.95, 0], th.flag);
    const cloth = fm.mesh(flatMat());
    flag.add(pole, cloth); flag.position.set(c.cup[0], ch, c.cup[1]); flag.userData.cloth = cloth; world.add(flag);
    fitHole();
    redecorate(true);
  }
  // Ozdoba: jen 2-3 klidné prvky podle tématu (zahrada: kulatý strom, pláž: slunečník, zima: smrček).
  // Stojí vedle trati nebo za ní, v záběru celé jamky a NIKDY v záběru výsledku jamky (kamera u jamky) ani v zákrytu mezi kamerou a dráhou.
  // Rozhoduje se podle poměru stran (ne podle výšky panelu), ať ozdoby neblikají při změně HUD.
  const decoG = new THREE.Group(); scene.add(decoG);
  const GROUND_Y = -0.55;
  const decoM = () => ({ t: Math.max(hudPad.t + 0.14, aspect < 1 ? 0.4 : 0.22), b: aspect < 1 ? 0.4 : 0.3, l: 0.04, r: 0.04 });   // nad skutečnou horní lištou + rezerva
  let decoKey = "";
  function redecorate(force) {
    if (!c) return;
    const key = c.seed + ":" + c.hi + ":" + (aspect < 1 ? "p" : "d") + Math.round(aspect * 10) + ":" + Math.round(hudPad.t * 20);
    if (!force && key === decoKey) return;
    decoKey = key; clear(decoG); decorate();
  }
  function bboxOutside(x, y, camNdcOut) {            // celá ozdoba (kvádr 1,6 × 1,6 × 1,7) je mimo obrazovku aktuální kamery
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const dx of [-0.8, 0.8]) for (const dz of [-0.8, 0.8]) for (const hy of [GROUND_Y, GROUND_Y + 1.7]) {
      const q = new THREE.Vector3(x + dx, hy, y + dz).project(camera);
      if (q.z > 1) return false;
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    return x1 < -1 - camNdcOut || x0 > 1 + camNdcOut || y1 < -1 - camNdcOut || y0 > 1 + camNdcOut;
  }
  function decorate() {
    const W = c.W, Hh = c.H, r = J.rng(c.seed ^ (c.hi * 7919 + 13) ^ 0x51ed27);
    const near = (x, y, rad) => { for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) { const X = Math.floor(x) + a, Y = Math.floor(y) + b; if (X >= 0 && Y >= 0 && X < W && Y < Hh && (c.type[Y * W + X] || c.island[Y * W + X])) return true; } return false; };
    const blocks = (x, y) => { for (let Y = 0; Y < Math.floor(y); Y++) for (let a = -1; a <= 1; a++) { const X = Math.floor(x) + a; if (X >= 0 && X < W && c.type[Y * W + X]) return true; } return false; };   // dráha leží severněji ve stejných sloupcích
    const want = 2 + (r() < 0.5 ? 1 : 0), chosen = [], m = decoM();
    const raw = [];
    for (let y = -4; y <= Hh + 4; y += 0.5) for (let x = -4; x <= W + 4; x += 0.5) raw.push([x, y]);
    // krok 1: mimo trať, mimo zákryt a mimo záběr výsledku jamky (kamera u jamky)
    placeCupCam(fitCupDist(cupPts(null), m));
    const away = raw.filter(([x, y]) => !near(x, y, 1) && !blocks(x, y) && bboxOutside(x, y, 0.08));
    // krok 2: uvnitř záběru celé jamky
    holeCam();
    for (const rad of [2, 1]) {
      const cand = away.filter(([x, y]) => {
        if (near(x, y, rad)) return false;
        const q = new THREE.Vector3(x, GROUND_Y + 0.8, y).project(camera);
        return !(q.z > 1 || q.x < -0.84 + m.l || q.x > 0.84 - m.r || q.y < -0.84 + m.b || q.y > 0.84 - m.t);
      });
      while (cand.length && chosen.length < want) {
        const i = Math.floor(r() * cand.length), p = cand.splice(i, 1)[0];
        if (chosen.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 2.6)) chosen.push(p);
      }
      if (chosen.length >= want) break;
    }
    for (const [x, y] of chosen) decoG.add(prop(x, y, GROUND_Y, r));
  }
  function prop(x, y, base, r) {
    const g = new THREE.Group(), s = 0.85 + r() * 0.45;
    if (c.th === "zima") {                         // smrček se sněhem
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.4 * s, 5), lowMat(th.trunk)); t.position.y = 0.2 * s; g.add(t);
      for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(new THREE.ConeGeometry((0.55 - i * 0.14) * s, 0.55 * s, 6), lowMat(i === 2 ? "#FFFFFF" : th.tree)); k.position.y = (0.55 + i * 0.32) * s; g.add(k); }
    } else if (c.th === "plaz") {                  // slunečník
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.04 * s, 1.15 * s, 6), lowMat("#F4F1EA")); pole.position.y = 0.575 * s; g.add(pole);
      const um = new Mesher(), n = 8, R0 = 0.62 * s, top = 1.32 * s, rim = 1.05 * s;
      for (let i = 0; i < n; i++) {
        const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
        um.tri([0, top, 0], [Math.cos(a0) * R0, rim, Math.sin(a0) * R0], [Math.cos(a1) * R0, rim, Math.sin(a1) * R0], i & 1 ? "#FFFFFF" : th.accent);
      }
      g.add(um.mesh(flatMat()));
    } else {                                       // kulatý strom
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 0.6 * s, 6), lowMat(th.trunk)); t.position.y = 0.3 * s; g.add(t);
      const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 1), lowMat(r() < 0.5 ? th.tree : th.tree2)); k.position.y = 1.0 * s; k.scale.set(1, 0.92, 1); g.add(k);
    }
    g.position.set(x, base, y); g.rotation.y = r() * 6;
    return g;
  }

  // ---------- pasti ----------
  function trapMesh(t, ghostMode) {
    const g = new THREE.Group(), geo = J.trapGeom(t), h = J.surf(c, geo.x, geo.y).h;
    const owner = t.by ? PLAYER[t.by].ball : "#ffffff";
    const ringR = t.k === "mlyn" ? J.MLYN_R + 0.08 : t.k === "louze" ? J.LOUZE_R : t.k === "kopec" ? J.KOPEC_R : t.k === "vysavac" ? J.VYS_R : 0.32;
    const ring = new THREE.Mesh(new THREE.RingGeometry(ringR - 0.05, ringR, 28), new THREE.MeshBasicMaterial({ color: owner, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; g.add(ring);
    if (t.k === "mlyn") {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 8), lowMat("#F6E7C8")); hub.position.y = 0.21; g.add(hub);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 8), lowMat(th.accent)); roof.position.y = 0.57; g.add(roof);
      const rot = new THREE.Group(); rot.position.y = 0.14;
      for (let q = 0; q < 4; q++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(J.MLYN_R - 0.2, 0.18, 0.08), lowMat(q & 1 ? "#FFFFFF" : th.accent));
        const piv = new THREE.Group(); piv.rotation.y = -q * Math.PI / 2; b.position.x = 0.2 + (J.MLYN_R - 0.2) / 2; piv.add(b); rot.add(piv);
      }
      g.add(rot); g.userData.rot = rot;
    } else if (t.k === "louze") {
      const pts = [], rr = J.rng(t.x * 31 + t.y);
      for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, q = J.LOUZE_R * (0.86 + rr() * 0.14); pts.push(new THREE.Vector2(Math.cos(a) * q, Math.sin(a) * q)); }
      const pud = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), lowMat("#6FA6C4")); pud.rotation.x = -Math.PI / 2; pud.position.y = 0.02; g.add(pud);
      const shine = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.33, 14, 1, 0.4, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); shine.rotation.x = -Math.PI / 2; shine.position.y = 0.03; g.add(shine);
      // kachnička
      const duck = new THREE.Group();
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), lowMat("#FFD23F")); body.scale.set(1.25, 0.8, 1); duck.add(body);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), lowMat("#FFD23F")); head.position.set(0.14, 0.15, 0); duck.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 4), lowMat("#FF8A3D")); beak.rotation.z = -Math.PI / 2; beak.position.set(0.26, 0.14, 0); duck.add(beak);
      const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), lowMat("#1E1B2E")); e1.position.set(0.2, 0.19, 0.06); duck.add(e1);
      const e2 = e1.clone(); e2.position.z = -0.06; duck.add(e2);
      duck.position.set(-0.25, 0.12, 0.2); duck.rotation.y = 0.6; g.add(duck); g.userData.duck = duck;
    } else if (t.k === "stena") {
      const wall = new Mesher(), L = J.STENA_H, n = 6;
      for (let i = 0; i < n; i++) {
        const x0 = -L + i * 2 * L / n, x1 = x0 + 2 * L / n, cl = i & 1 ? "#FFFFFF" : th.accent;
        const A = [x0, 0, -0.07], B = [x1, 0, -0.07], C = [x1, 0.3, -0.07], D = [x0, 0.3, -0.07], A2 = [x0, 0, 0.07], B2 = [x1, 0, 0.07], C2 = [x1, 0.3, 0.07], D2 = [x0, 0.3, 0.07];
        wall.quad(A, D, C, B, cl); wall.quad(B2, C2, D2, A2, cl); wall.quad(D, D2, C2, C, cl);
        if (i === 0) wall.quad(A2, D2, D, A, cl); if (i === n - 1) wall.quad(B, C, C2, B2, cl);
      }
      const wm = wall.mesh(flatMat()); g.add(wm);
      for (const s of [-1, 1]) for (const side of [-1, 1]) {
        const sp = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 4, 8), lowMat("#9AA4B2")); sp.position.set(s * L * 0.55, 0.15, side * 0.13); sp.rotation.y = Math.PI / 2; g.add(sp);
      }
      g.rotation.y = -t.a * Math.PI * 2 / J.ROT;
    } else if (t.k === "kopec") {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), lowMat("#8C6142"));
      dome.scale.set(J.KOPEC_R * 0.62, J.KOPEC_H, J.KOPEC_R * 0.62); g.add(dome);
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(J.KOPEC_R * 0.62, J.KOPEC_R, 0.1, 12, 1, true), lowMat("#7A5236")); skirt.position.y = 0.0; g.add(skirt);
      const mole = new THREE.Group();
      const hd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), lowMat("#3B3346")); mole.add(hd);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), lowMat("#FF8FA3")); nose.position.set(0, -0.02, 0.17); mole.add(nose);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), lowMat("#FFFFFF")); e.position.set(s * 0.07, 0.06, 0.14); mole.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), lowMat("#1E1B2E")); p.position.set(s * 0.07, 0.06, 0.17); mole.add(p); }
      mole.position.set(0, J.KOPEC_H + 0.05, 0); g.add(mole); g.userData.mole = mole;
    } else if (t.k === "fukar") {
      // obláček s nafouknutými tvářemi fouká po místní ose +x; před ním pruhy proudu
      const cloud = new THREE.Group();
      for (const [x, y, z, r] of [[0, 0.3, 0, 0.24], [-0.14, 0.24, 0.15, 0.16], [-0.14, 0.24, -0.15, 0.16], [-0.2, 0.42, 0, 0.15]]) {
        const p = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), lowMat("#FFFFFF", { emissive: 0x4a4a4a })); p.position.set(x, y, z); cloud.add(p);
      }
      cloud.scale.setScalar(1.3); cloud.userData.s = 1.3;
      for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), lowMat("#1E1B2E")); e.position.set(0.2, 0.38, s * 0.08); cloud.add(e);
        const ch = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), lowMat("#FF8FA3")); ch.position.set(0.18, 0.28, s * 0.15); ch.scale.set(0.5, 1, 1); cloud.add(ch);
      }
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.018, 5, 10), lowMat("#1E1B2E")); mouth.position.set(0.235, 0.27, 0); mouth.rotation.y = Math.PI / 2; cloud.add(mouth);
      g.add(cloud); g.userData.cloud = cloud;
      const streaks = [];
      for (let i = 0; i < 6; i++) {
        const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.045), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
        sm.rotation.x = -Math.PI / 2; sm.userData.z = (i % 3 - 1) * J.FUK_W * 0.6; sm.userData.ph = i / 6; sm.position.set(0, 0.03, sm.userData.z); g.add(sm); streaks.push(sm);
      }
      g.userData.streaks = streaks; g.userData.reach = J.fukReach(c, t);
      g.rotation.y = -t.a * Math.PI * 2 / J.ROT;
    } else if (t.k === "vysavac") {
      // robotí vysavač: placka s nárazníkem, očima a kartáčkem
      const bot = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.09, 16), lowMat("#4A4458")); body.position.y = 0.045; bot.add(body);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.03, 16), lowMat("#6E6784")); top.position.y = 0.1; bot.add(top);
      const bump = new THREE.Mesh(new THREE.CylinderGeometry(0.405, 0.405, 0.04, 16, 1, true, -0.9, 1.8), lowMat(th.accent)); bump.position.y = 0.05; bot.add(bump);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 5), lowMat("#9FF0FF", { emissive: 0x2a8fa0 })); e.position.set(0.2, 0.115, s * 0.1); e.scale.set(1, 0.5, 1); bot.add(e); }
      const brush = new THREE.Group(); brush.position.set(0.24, 0.02, 0.24);
      for (let q = 0; q < 3; q++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.015), lowMat("#FFFFFF")); b.position.x = 0.08; const piv = new THREE.Group(); piv.rotation.y = q * 2.09; piv.add(b); brush.add(piv); }
      bot.add(brush); g.add(bot); g.userData.bot = bot; g.userData.brush = brush;
      const swirl = new THREE.Mesh(new THREE.RingGeometry(J.VYS_R * 0.55, J.VYS_R * 0.6, 24, 1, 0, 4.2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }));
      swirl.rotation.x = -Math.PI / 2; swirl.position.y = 0.015; g.add(swirl); g.userData.swirl = swirl;
    }
    g.position.set(geo.x, h, geo.y);
    if (ghostMode) g.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false; } });
    g.userData.t = t; g.userData.ring = ring;
    return g;
  }
  function setTraps(list, mine, nShot) {
    clear(trapG); traps = [];
    for (const t of list) { const m = trapMesh(t); trapG.add(m); traps.push(m); m.userData.drop = 0; }
    meSeat = mine; setBlades(nShot || 0, 0);
  }
  function dropTraps() { for (const m of traps) m.userData.drop = performance.now(); }
  function setBlades(n, tick) { for (const m of traps) if (m.userData.rot) m.userData.rot.rotation.y = -J.bladeAngle(n, tick); }
  // past patří někomu: na tahu jejího majitele je průsvitná (jeho míček nechá být)
  function fadeOwn(shooter) {
    for (const m of traps) {
      const own = m.userData.t.by === shooter;
      m.traverse(o => { if (o.material && o !== m.userData.ring) { o.material.transparent = true; o.material.opacity = own ? 0.35 : 1; o.material.depthWrite = !own; } });
    }
  }
  function setGhost(t, ok) {
    if (ghost) { trapG.remove(ghost); disposeTree(ghost); ghost = null; }
    if (!t) return;
    ghost = trapMesh(t, true);
    ghost.userData.ring.material.color = col(ok ? "#FFFFFF" : "#FF3B30"); ghost.userData.ring.material.opacity = 1;
    trapG.add(ghost);
  }

  // ---------- míčky ----------
  function ballZ(k, x, y) { return J.surf(c, x, y).h + J.trapHeight(trapsData(), x, y, k) + J.R; }
  const trapsData = () => traps.map(m => m.userData.t);
  function setBall(k, b, show) {
    const o = balls[k];
    o.sink = 0; o.party = false; o.hop = 0;
    o.vis = !!(show && b && b.on && !b.in);
    o.g.visible = o.sh.visible = o.vis; o.ring.visible = o.vis;
    if (!o.vis) return;
    o.x = b.x; o.y = b.y; place(k);
  }
  // míček dohrané jamky: stojí vedle jamky (mimo tyč praporku), veselý, poskakuje (výsledek jamky)
  function sinkBall(k, x, y, face, sink) {
    const o = balls[k];
    o.vis = true; o.x = x; o.y = y; o.sink = sink || 0; o.party = true;
    o.g.visible = true; o.sh.visible = !sink; o.ring.visible = false;
    setFace(k, face || "happy"); place(k);
  }
  function place(k) {
    const o = balls[k], z = ballZ(k, o.x, o.y);
    o.g.position.set(o.x, z + o.hop + o.sink, o.y);
    o.sh.position.set(o.x, z - J.R + 0.015, o.y);
    o.ring.position.set(o.x, z - J.R + 0.02, o.y);
    // obličej natočený ke kameře, kousek před míčkem
    const v = camera.position.clone().sub(o.g.position).normalize().multiplyScalar(J.R * 1.04);
    o.face.position.copy(v);
  }
  for (const k of ["x", "o"]) balls[k].hop = 0;
  function setFace(k, kind, ms) {
    const o = balls[k];
    if (ms) { o.until = performance.now() + ms; o.tmp = kind; } else { o.face0 = kind; if (!o.until) o.tmp = null; }
    o.face.material.map = faceTex(ms ? kind : (o.until > performance.now() ? o.tmp : kind)); o.face.material.needsUpdate = true;
  }
  function turnRing(k) { for (const q of ["x", "o"]) balls[q].ring.material.opacity = q === k ? 0.9 : 0; }

  // ---------- míření ----------
  // path: body předpovězené dráhy [x0, y0, x1, y1, …] ze skutečné fyziky (main.js, jen začátek a první odraz); bez ní rovná čára
  const aimCol = [col("#FFFFFF"), col("#FFD23F"), col("#FF6A3D")], tmpC = new THREE.Color();
  function setAim(k, ang, pow, path) {
    const o = balls[k];
    o.aimSq = pow > 0.02 ? pow : 0;
    if (pow == null || pow <= 0.02) { dots.forEach(d => d.visible = false); arrow.visible = false; return; }
    if (!path || path.length < 4) path = [o.x, o.y, o.x + Math.cos(ang) * 4, o.y + Math.sin(ang) * 4];
    const len = 1.0 + pow * 2.9, gap = len / dots.length;
    // barva podle síly: bílá → žlutá → oranžová
    if (pow < 0.6) tmpC.copy(aimCol[0]).lerp(aimCol[1], pow / 0.6); else tmpC.copy(aimCol[1]).lerp(aimCol[2], (pow - 0.6) / 0.4);
    let seg = 0, acc = 0, want = gap * 0.8, px = path[0], pz = path[1], ex = px, ez = pz, dx = 1, dz = 0;
    dots.forEach((d, i) => {
      while (seg + 3 < path.length) {
        const ax = path[seg], az = path[seg + 1], bx = path[seg + 2], bz = path[seg + 3], l = Math.hypot(bx - ax, bz - az);
        if (acc + l >= want) { const f = l ? (want - acc) / l : 0; px = ax + (bx - ax) * f; pz = az + (bz - az) * f; if (l) { dx = (bx - ax) / l; dz = (bz - az) / l; } break; }
        acc += l; seg += 2;
      }
      const out = seg + 3 >= path.length || want > len;
      d.visible = !out && J.where(c, px, pz) !== J.VOID;
      if (d.visible) { ex = px; ez = pz; }
      const f = (i + 1) / dots.length;
      d.position.set(px, J.surf(c, px, pz).h + 0.03, pz); d.material.opacity = 0.95 - f * 0.6; d.material.color.copy(tmpC); d.scale.setScalar(1 + pow * 0.7 * (1 - f));
      want += gap;
    });
    const x = ex + dx * 0.15, z = ez + dz * 0.15;
    arrow.visible = J.where(c, x, z) !== J.VOID; arrow.position.set(x, J.surf(c, x, z).h + 0.06, z);
    arrow.rotation.set(-Math.PI / 2, 0, -Math.atan2(dz, dx) - Math.PI / 2);
    arrow.material.color.copy(tmpC);
  }
  // náraz: míček se na chvíli zmáčkne (úder, zeď, pérovačka); s > 0,5 přidá obláček prachu
  function kick(k, s) {
    const o = balls[k]; o.squash = Math.max(o.squash || 0, Math.min(1, s));
    if (s > 0.5 && o.vis) puff(o.x, o.y, s);
  }
  function puff(x, y, s) {
    const z = J.surf(c, x, y).h, n = Math.round(4 + s * 4);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(partGeo.chip, new THREE.MeshBasicMaterial({ color: th.puff || "#FFFFFF", transparent: true, opacity: 0.8 }));
      const a = i / n * Math.PI * 2 + Math.random() * 0.5;
      m.position.set(x, z + 0.05, y); m.scale.setScalar(0.7 + Math.random() * 0.5);
      m.userData.v = new THREE.Vector3(Math.cos(a) * 0.018 * s, 0.018 + Math.random() * 0.012, Math.sin(a) * 0.018 * s);
      m.userData.life = 0.7; fx.add(m); parts.push(m);
    }
  }

  // ---------- efekty ----------
  const parts = [], partGeo = { confetti: new THREE.PlaneGeometry(0.09, 0.05), chip: new THREE.TetrahedronGeometry(0.06) };   // sdílené geometrie částic (nedisposují se po kusech)
  function burst(x, y, kind) {
    const z = J.surf(c, x, y).h;
    const n = kind === "voda" ? 10 : kind === "jamka" ? 14 : 6;
    const colors = kind === "voda" ? ["#FFFFFF", "#9FE0FF"] : kind === "jamka" ? ["#FFD23F", "#FF6A3D", "#3E8BFF", "#57B947", "#FFFFFF"] : ["#FFFFFF"];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(kind === "jamka" ? partGeo.confetti : partGeo.chip, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true }));
      const a = i / n * Math.PI * 2;
      m.position.set(x, z + 0.15, y);
      m.userData.v = new THREE.Vector3(Math.cos(a) * (0.02 + Math.random() * 0.025), 0.05 + Math.random() * 0.04, Math.sin(a) * (0.02 + Math.random() * 0.025));
      m.userData.life = 1; fx.add(m); parts.push(m);
    }
  }

  // ---------- kamera ----------
  const cam = { mode: "hole", tx: 0, ty: 0, tz: 0, dist: 20, yaw: 0, pitch: 1.0, zoom: 1, want: null, follow: null, panX: 0, panZ: 0 };
  let aspect = 1, holeFit = { tx: 0, tz: 0, ty: 0, dist: 20, pitch: 1.0 };
  function camPos(tx, ty, tz, dist, yaw, pitch) {
    const cp = Math.cos(pitch);
    return new THREE.Vector3(tx + Math.sin(yaw) * cp * dist, ty + Math.sin(pitch) * dist, tz + Math.cos(yaw) * cp * dist);
  }
  function fitHole() {
    if (!c) return;
    let maxH = 0; for (const h of c.hc) if (h > maxH) maxH = h;
    // oblast trati (bez prázdného okraje)
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) if (c.type[y * c.W + x]) { x0 = Math.min(x0, x); z0 = Math.min(z0, y); x1 = Math.max(x1, x + 1); z1 = Math.max(z1, y + 1); }
    const pitch = aspect > 1.2 ? 1.12 : 0.98;
    const tx = (x0 + x1) / 2, tz = (z0 + z1) / 2 + 0.6, ty = maxH / 2;
    const pts = [];
    for (const x of [x0 - 0.3, x1 + 0.3]) for (const z of [z0 - 0.3, z1 + 0.3]) for (const y of [0, maxH + 0.5]) pts.push(new THREE.Vector3(x, y, z));
    pts.push(new THREE.Vector3(c.cup[0], J.surf(c, c.cup[0], c.cup[1]).h + 1.4, c.cup[1]));
    const m = margins(); applyOffset(offFor("x"));
    let lo = 4, hi = 80;
    for (let it = 0; it < 24; it++) {
      const d = (lo + hi) / 2;
      camera.position.copy(camPos(tx, ty, tz, d, 0, pitch)); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      let ok = true;
      for (const p of pts) { const q = p.clone().project(camera); if (q.x < -1 + m.l || q.x > 1 - m.r || q.y < -1 + m.b || q.y > 1 - m.t || q.z > 1) { ok = false; break; } }
      if (ok) hi = d; else lo = d;
    }
    camera.position.copy(camPos(tx, ty, tz, hi, 0, pitch)); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    holeFit = { tx, ty, tz: tz, dist: hi, pitch };
  }
  // místo pro HUD v jednotkách NDC (0..2) – nastavuje main podle rozvržení
  let hudPad = { t: 0.16, b: 0.22, l: 0.04, r: 0.04 };
  const margins = () => hudPad;
  // Nízký displej na šířku (iPhone): v módu „míček“ je panel jen malé obdélníky (hudRects), ne pruh přes celou šířku; obraz se posune
  // doleva (xs v px), ať míček sedí vedle panelu a před ním je vidět víc dráhy. ballPad = { t, b, l, r, xs } nebo null.
  let ballPad = null;
  const padFor = mode => mode === "ball" && ballPad ? ballPad : hudPad;
  const offFor = mode => { const pd = padFor(mode); return { x: mode === "ball" && ballPad ? ballPad.xs : 0, y: (pd.b - pd.t) * H0 / 4 }; };
  // další tlačítka HUD mimo pruhy (nabídka vpravo nahoře, Oddálit vpravo dole), v CSS pixelech: [x0, y0, x1, y1]
  let hudRects = [];
  const rectHit = q => { const px = (q.x + 1) / 2 * W0, py = (1 - q.y) / 2 * H0; for (const r of hudRects) if (px >= r[0] - 6 && px <= r[2] + 6 && py >= r[1] - 6 && py <= r[3] + 6) return true; return false; };
  function setMode(mode) { cam.mode = mode; cam.zoom = 1; cam.panX = cam.panZ = 0; }
  function followYaw(k) {
    const o = balls[k]; if (!c) return 0;
    // směr k jamce po dráze: pár kroků z vzdálenostního pole
    let x = Math.floor(o.x), y = Math.floor(o.y);
    for (let s = 0; s < 4; s++) {
      let best = null;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const X = x + a, Y = y + b; if (X < 0 || Y < 0 || X >= c.W || Y >= c.H) continue; const d = c.df[Y * c.W + X]; if (d < 1e8 && (!best || d < best.d)) best = { d, X, Y }; }
      if (!best || (best.X === x && best.Y === y)) break; x = best.X; y = best.Y;
    }
    let fx = x + 0.5 - o.x, fz = y + 0.5 - o.y;
    const dc = Math.hypot(c.cup[0] - o.x, c.cup[1] - o.y); if (dc < 4) { fx = c.cup[0] - o.x; fz = c.cup[1] - o.y; }
    if (Math.abs(fx) + Math.abs(fz) < 1e-3) return 0;
    return Math.atan2(-fx, -fz);
  }
  // Cesta z míčku k jamce podle vzdálenostního pole: body do délky maxLen políček (celá cesta, když je jamka blíž).
  function pathAhead(o, maxLen) {
    const pts = []; let x = Math.floor(o.x), y = Math.floor(o.y), len = 0, px = o.x, py = o.y, reached = false;
    const inside = (X, Y) => X >= 0 && Y >= 0 && X < c.W && Y < c.H;
    for (let s = 0; s < 80 && len < maxLen; s++) {
      let best = null;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const X = x + a, Y = y + b; if (!inside(X, Y)) continue; const d = c.df[Y * c.W + X]; if (d < 1e8 && (!best || d < best.d)) best = { d, X, Y }; }
      if (!best || (best.X === x && best.Y === y)) { reached = c.df[y * c.W + x] === 0 || Math.hypot(c.cup[0] - px, c.cup[1] - py) < 1.2; break; }
      x = best.X; y = best.Y;
      const qx = x + 0.5, qy = y + 0.5; len += Math.hypot(qx - px, qy - py); px = qx; py = qy; pts.push([qx, qy, len]);
      if (best.d === 0) { reached = true; break; }
    }
    if (reached) pts.push([c.cup[0], c.cup[1], len + Math.hypot(c.cup[0] - px, c.cup[1] - py)]);
    return { pts, reached };
  }
  // Body jamky, které se nesmí useknout: obrys jamky (s rezervou), špička tyče a konec látky praporku.
  function cupAllPts() {
    const [cx, cz] = c.cup, ch = J.surf(c, cx, cz).h, r = J.CUP_R * (c.mod === "velka" ? 1.45 : c.mod === "mala" ? 0.8 : 1) + 0.14, pts = [];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; pts.push(new THREE.Vector3(cx + Math.cos(a) * r, ch, cz + Math.sin(a) * r)); }
    pts.push(new THREE.Vector3(cx, ch + 1.4, cz), new THREE.Vector3(cx + 0.58, ch + 1.12, cz), new THREE.Vector3(cx + 0.58, ch + 1.34, cz));
    return pts;
  }
  // Záběr za míčkem: míček v dolní třetině volné plochy (mezi HUD nahoře a panelem dole), před ním cesta k jamce.
  // Pravidlo: jamka s praporkem je buď CELÁ ve volné ploše (celá cesta + jamka), nebo CELÁ mimo obrazovku (pak míček sedí
  // v dolní třetině a kamera kouká k jamce). Nikdy napůl pod HUD ani uříznutá okrajem. Zkouší se postupně: celá cesta
  // + jamka při přijatelném odstupu kamery, pak zkracovaná cesta (jamka mimo obrazovku), pak vyšší poloha míčku.
  function fitBall(k) {
    if (!c) return;
    const o = balls[k], pitch0 = aspect < 1 ? 1.12 : 1.0, dMax = ballPad ? H0 * 0.05 : Math.min(aspect < 1 ? 24 : 25, H0 * 0.037);   // míček má mít aspoň ~12 px (na šířku iPhonu je obraz nízký, tam se víc neoddaluje)
    let pitch = pitch0;
    const pitches = ballPad ? [pitch0, 0.82, 0.66] : [pitch0];     // nízký displej na šířku: i plošší pohled podél dráhy
    const yaw1 = cam.want ? (cam.want.base != null ? cam.want.base : cam.want.yaw) : 0;
    // kandidáti na natočení: po směru cesty (jako dosud), pak přímo k jamce, pak něco mezi (vejde se víc, hlavně na výšku)
    const yawCup = Math.atan2(-(c.cup[0] - o.x), -(c.cup[1] - o.y)), dy = Math.atan2(Math.sin(yawCup - yaw1), Math.cos(yawCup - yaw1));
    const yaws = ballPad ? [yaw1, yaw1 + dy / 3, yaw1 + dy / 2, yaw1 + dy * 2 / 3, yaw1 + dy] : [yaw1, yaw1 + dy / 2, yaw1 + dy];
    const crit = v => { v.crit = true; return v; };
    const full = pathAhead(o, 80), m = padFor("ball");
    const gh = (x, y) => J.surf(c, x, y).h, ty = gh(o.x, o.y);
    const ball = new THREE.Vector3(o.x, ty + J.R, o.y), tmp = new THREE.Vector3();
    const ylo = -1 + m.b + 0.05, yhi = 1 - m.t - 0.05, xl = -1 + m.l + 0.05, xr = 1 - m.r - 0.05;
    applyOffset(offFor("ball"));
    const cupAll = cupAllPts();
    const inBand = q => q.z < 1 && q.x >= xl && q.x <= xr && q.y <= yhi && q.y >= ylo, inFree = q => inBand(q) && !rectHit(q), onScr = q => q.z < 1 && Math.abs(q.x) < 1.02 && Math.abs(q.y) < 1.02;
    const cupOk = () => { let any = false, all = true; for (const p of cupAll) { const q = tmp.copy(p).project(camera); if (onScr(q)) any = true; if (!inFree(q)) all = false; } return all || !any; };
    // Pro dané natočení a polohu míčku najde nejmenší vzdálenost kamery, při které jsou všechny body ve volné ploše;
    // když jamka není mezi body, hledá se (od té vzdálenosti nahoru) takové d, kdy je jamka celá ve volné ploše nebo celá mimo obrazovku.
    const solve = (P, yaw, cupIn, ybf, dLim) => {
      const yb = ylo + (yhi - ylo) * ybf, f = [-Math.sin(yaw), -Math.cos(yaw)];
      const put = (d, s) => { const tx = o.x + f[0] * s, tz = o.y + f[1] * s; camera.position.copy(camPos(tx, ty, tz, d, yaw, pitch)); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
      const at = d => {
        let sl = 0, sh = 24;
        for (let j = 0; j < 14; j++) { const s = (sl + sh) / 2; put(d, s); if (tmp.copy(ball).project(camera).y > yb) sl = s; else sh = s; }
        const s = (sl + sh) / 2; put(d, s);
        let okP = true;
        for (const p of P) { const q = tmp.copy(p).project(camera); if (p.crit ? !inFree(q) : !inBand(q)) { okP = false; break; } }   // křehké body (míček, jamka) i mimo tlačítka; cesta jen v pruhu
        return { okP, s };
      };
      if (!at(dLim).okP) return null;
      let lo = 4.8, hi = dLim;
      for (let it = 0; it < 16; it++) { const d = (lo + hi) / 2; if (at(d).okP) hi = d; else lo = d; }
      const N = cupIn ? 0 : 24;
      for (let i = 0; i <= N; i++) {
        const d = hi + (dLim - hi) * i / Math.max(1, N), r = at(d);
        if (r.okP && (cupIn || cupOk())) return { d, s: r.s, yaw, off: [f[0] * r.s, f[1] * r.s] };
      }
      return null;
    };
    const pathP = cut => {
      const P = [crit(new THREE.Vector3(o.x, ty + 2 * J.R + 0.1, o.y))];
      let complete = true;
      for (const p of full.pts) { if (p[2] > cut) { complete = false; break; } P.push(new THREE.Vector3(p[0], gh(p[0], p[1]) + 0.3, p[1])); }
      const cupIn = complete && full.reached;
      if (cupIn) for (const p of cupAll) P.push(crit(p));
      return { P, cupIn };
    };
    const stages = ballPad
      ? [{ cuts: [Infinity], ybs: [0.3, 0.2, 0.12], dLim: dMax * 0.84, name: "cela" },
        { cuts: [20, 17, 14, 11, 9.5, 8.5, 8], ybs: [0.3, 0.12], dLim: dMax, name: "kratsi" },
        { cuts: [Infinity], ybs: [0.3, 0.2, 0.12], dLim: dMax, name: "cela2" },                           // nízký displej: raději drobnější míček než jamka těsně za okrajem
        { cuts: [7, 6], ybs: [0.3, 0.12], dLim: dMax, name: "kratsi2" },
        { cuts: [Infinity], ybs: [0.5, 0.7], dLim: dMax, name: "vys" }]
      : aspect >= 1
        ? [{ cuts: [Infinity], ybs: [0.3, 0.2, 0.12], dLim: dMax * 0.84, name: "cela" },      // celá cesta + jamka, jen když při tom nejsou objekty drobné
          { cuts: [20, 17, 14, 11, 8, 6], ybs: [0.3, 0.12], dLim: dMax, name: "kratsi" },                   // jamka celá mimo obrazovku
          { cuts: [Infinity], ybs: [0.5, 0.7], dLim: dMax, name: "vys" }]
        : [{ cuts: [Infinity], ybs: [0.3, 0.2, 0.12], dLim: dMax * 0.84, name: "cela" },      // na výšku: celá cesta + jamka
          { cuts: [20, 17, 14, 11, 9.5, 8.5, 8], ybs: [0.3, 0.12], dLim: dMax, name: "kratsi" },            // jamka celá mimo obrazovku, vidět aspoň 8 políček cesty
          { cuts: [Infinity], ybs: [0.3, 0.2, 0.12], dLim: dMax, name: "cela2" },                           // raději drobnější míček než jen kousek cesty
          { cuts: [Infinity, 20, 17, 14, 11, 9.5, 8.5, 8], ybs: [0.3, 0.12], dLim: dMax, pit: [0.92, 0.8], name: "plosi" },   // dlouhá cesta se při dolním panelu na výšku jinak nevejde: plošší pohled vloží do výšky víc políček
          { cuts: [7, 6], ybs: [0.3, 0.12], dLim: dMax, name: "kratsi2" },
          { cuts: [Infinity], ybs: [0.5, 0.7], dLim: dMax, name: "vys" }];
    let best = null;
    for (const st of stages) {
      for (const cut of st.cuts) {
        const { P, cupIn } = pathP(cut);
        if (cut === Infinity && !cupIn) continue;
        for (const pt of st.pit || pitches) { pitch = pt; for (const yw of yaws) { for (const ybf of st.ybs) { best = solve(P, yw, cupIn, ybf, st.dLim); if (best) { best.how = `${st.name} cut ${cut} pitch ${pt} yaw ${yaws.indexOf(yw)} yb ${ybf}`; best.pitch = pt; break; } } if (best) break; } if (best) break; }
        if (best) break;
      }
      if (best) break;
    }
    if (!best) {                                         // nouzově: míček + pár políček cesty, jamka musí být celá mimo nebo celá uvnitř
      const { P } = pathP(2);
      for (const pt of pitches) { pitch = pt; for (const yw of yaws) { for (const ybf of [0.3, 0.12, 0.5]) { best = solve(P, yw, false, ybf, dMax); if (best) { best.how = `nouze pitch ${pt} yaw ${yaws.indexOf(yw)} yb ${ybf}`; best.pitch = pt; break; } } if (best) break; } if (best) break; }
      best = best || { d: dMax, s: 4, yaw: yaw1, pitch: pitch0, off: [-Math.sin(yaw1) * 4, -Math.cos(yaw1) * 4] };
    }
    if (cam.want) cam.want.yaw = best.yaw;
    cam.fr = { off: best.off, dist: best.d, pitch: best.pitch || pitch0, how: best.how || "FALLBACK dMax" };
  }
  function frameBall(k, snap) {
    cam.follow = k; const o = balls[k];
    const base = followYaw(k);
    cam.want = { yaw: base, base };
    fitBall(k);                                          // může natočit kameru k jamce (cam.want.yaw)
    if (snap) { cam.yaw = cam.want.yaw; cam.tx = o.x; cam.tz = o.y; cam.cur = null; }
  }
  // Místa pro míčky vedle jamky: nejdřív vlevo (od praporku), pak vpravo, pak dopředu; jen na rovném trávníku a mimo zeď.
  function cupSpots(n) {
    const cupR = J.CUP_R * (c.mod === "velka" ? 1.45 : c.mod === "mala" ? 0.8 : 1), d = cupR + J.R + 0.34, ch = J.surf(c, c.cup[0], c.cup[1]).h, out = [];
    const okAt = a => {
      const x = c.cup[0] + Math.cos(a) * d, z = c.cup[1] + Math.sin(a) * d;
      for (const [ex, ez] of [[0, 0], [J.R, 0], [-J.R, 0], [0, J.R], [0, -J.R]]) if (J.where(c, x + ex, z + ez) !== J.FLOOR) return null;
      if (Math.abs(J.surf(c, x, z).h - ch) > 0.15) return null;
      return [x, z, a];
    };
    for (const a of [Math.PI, 0, Math.PI / 2, Math.PI * 0.75, Math.PI * 0.25, -Math.PI * 0.75]) {   // dozadu doprava nikdy: tam visí látka praporku
      if (out.length >= n) break;
      const q = okAt(a); if (!q) continue;
      if (out.every(o => Math.abs(Math.atan2(Math.sin(o[2] - a), Math.cos(o[2] - a))) > 1.0)) out.push(q);
    }
    while (out.length < n) out.push([c.cup[0], c.cup[1], 0, 1]);      // nouzově v jamce (zapuštěný)
    return out;
  }
  let cupSp = null, cupFitD = 6;
  function cupPts(sp, withTraps) {
    const [cx, cz] = c.cup, ch = J.surf(c, cx, cz).h, pts = [];
    pts.push(new THREE.Vector3(cx, ch, cz), new THREE.Vector3(cx, ch + 1.4, cz));
    // kus okolí jamky: na šířku (desktop) víc, ať je vidět trať kolem jamky a ne jen prázdný plac; pasti poblíž celé, i s prstenci
    const kx = aspect > 1.2 ? 1.5 : 1, kz = aspect > 1.2 ? 1.4 : 1;
    for (const [dx, dz] of [[2.8, 1.9], [-2.8, 1.9], [2.8, -1.5], [-2.8, -1.5]]) pts.push(new THREE.Vector3(cx + dx * kx, ch, cz + dz * kz));
    for (const t of withTraps ? traps.map(m => m.userData.t) : []) {
      const tx = t.x / 20, tz = t.y / 20;
      if (Math.hypot(tx - cx, tz - cz) > 9) continue;
      const r = (J.TRAPS[t.k].foot || 0.9) + 0.35, th = J.surf(c, tx, tz).h;
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pts.push(new THREE.Vector3(tx + ux * r, th, tz + uz * r));
    }
    const list = sp || cupSpots(2);
    for (const q of list) { const h = J.surf(c, q[0], q[1]).h; pts.push(new THREE.Vector3(q[0], h + 2 * J.R + 0.12, q[1]), new THREE.Vector3(q[0] - J.R, h, q[1] + J.R), new THREE.Vector3(q[0] + J.R, h, q[1] + J.R)); }
    return pts;
  }
  function placeCupCam(d) {
    const ch = J.surf(c, c.cup[0], c.cup[1]).h;
    applyOffset(offFor("x"));
    camera.position.copy(camPos(c.cup[0], ch, c.cup[1], d, 0, 1.0)); camera.lookAt(c.cup[0], ch, c.cup[1]); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  }
  function holeCam() {
    applyOffset(offFor("x"));
    camera.position.copy(camPos(holeFit.tx, holeFit.ty, holeFit.tz, holeFit.dist, 0, holeFit.pitch)); camera.lookAt(holeFit.tx, holeFit.ty, holeFit.tz); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  }
  // vzdálenost kamery u jamky, při které jsou jamka, praporek a míčky celé ve volné ploše (mezi HUD nahoře a panelem dole)
  function fitCupDist(pts, m) {
    m = m || margins();
    let lo = 3.5, hi = 40; const tmp = new THREE.Vector3();
    for (let it = 0; it < 22; it++) {
      const d = (lo + hi) / 2; placeCupCam(d);
      let ok = true;
      for (const p of pts) { const q = tmp.copy(p).project(camera); if (q.z > 1 || q.x < -1 + m.l + 0.04 || q.x > 1 - m.r - 0.04 || q.y < -1 + m.b + 0.04 || q.y > 1 - m.t - 0.04 || rectHit(q)) { ok = false; break; } }
      if (ok) hi = d; else lo = d;
    }
    return hi;
  }
  // pasti poblíž jamky se do záběru přidají celé (i s prstenci), ale jen když kvůli nim kamera neodjede víc než o polovinu
  function fitCup() { if (!c) return; const a = fitCupDist(cupPts(cupSp, false)), b = fitCupDist(cupPts(cupSp, true)); cupFitD = b <= a * 1.5 ? b : a; }
  function showCup(items) {
    const holed = items.filter(i => i.holed), sp = cupSpots(holed.length);
    cupSp = sp;
    holed.forEach((it, n) => sinkBall(it.k, sp[n][0], sp[n][1], it.face || "happy", sp[n][3] ? -J.R * 0.62 : 0));
    for (const it of items.filter(i => !i.holed)) { setBall(it.k, { x: it.x, y: it.y, on: true, in: false }, true); setFace(it.k, it.face || "sad"); }
    if (holed.length) burst(c.cup[0], c.cup[1], "jamka");
    setMode("cup"); fitCup();
  }
  function updateCam(dt) {
    let tx, ty, tz, dist, yaw, pitch;
    const toYaw0 = () => { if (cam.yaw !== 0) { let d = -cam.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; cam.yaw += d * (1 - Math.pow(0.01, dt)); } return cam.yaw; };
    if (cam.mode === "ball" && cam.follow) {
      const o = balls[cam.follow], fr = cam.fr || { off: [0, 0], dist: 8, pitch: 1.0 };
      const k = 1 - Math.pow(0.002, dt);
      cam.tx += (o.x - cam.tx) * k; cam.tz += (o.y - cam.tz) * k;
      if (cam.want) { let d = cam.want.yaw - cam.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; cam.yaw += d * (1 - Math.pow(0.01, dt)); }
      tx = cam.tx + fr.off[0] + cam.panX; tz = cam.tz + fr.off[1] + cam.panZ; ty = J.surf(c, cam.tx, cam.tz).h; dist = fr.dist * cam.zoom; yaw = cam.yaw; pitch = fr.pitch;
    } else if (cam.mode === "cup") {
      tx = c.cup[0] + cam.panX; tz = c.cup[1] + cam.panZ; ty = J.surf(c, c.cup[0], c.cup[1]).h; dist = cupFitD * cam.zoom; yaw = toYaw0(); pitch = 1.0;
    } else {
      tx = holeFit.tx + cam.panX; ty = holeFit.ty; tz = holeFit.tz + cam.panZ; dist = holeFit.dist * cam.zoom; pitch = holeFit.pitch; yaw = toYaw0();
    }
    const p = camPos(tx, ty, tz, dist, yaw, pitch);
    if (!cam.cur) cam.cur = { p: p.clone(), t: new THREE.Vector3(tx, ty, tz) };
    const k2 = 1 - Math.pow(0.0005, dt);
    cam.cur.p.lerp(p, k2); cam.cur.t.lerp(new THREE.Vector3(tx, ty, tz), k2);
    camera.position.copy(cam.cur.p); camera.lookAt(cam.cur.t);
    // HUD posun: optický střed mezi lištami (a v módu míček na nízkém displeji i do strany); plynule při změně módu
    const tg = offFor(cam.mode === "ball" && cam.follow ? "ball" : "x");
    if (!cam.off || !cam.curSnap) { cam.off = { ...tg }; cam.curSnap = true; }
    cam.off.x += (tg.x - cam.off.x) * k2; cam.off.y += (tg.y - cam.off.y) * k2;
    applyOffset(cam.off);
  }
  function snapCam() { cam.cur = null; cam.curSnap = false; }
  // optický střed mezi horní a spodní lištou HUDu
  function applyOffset(o) { o = o || offFor(cam.mode === "ball" ? "ball" : "x"); camera.setViewOffset(W0, H0, o.x, o.y, W0, H0); }

  // ---------- přepočet obrazovky na dráhu ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function groundAt(px, py, h) {
    const r = canvas.getBoundingClientRect();
    ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let y = h == null ? 0 : h, hit = null;
    for (let i = 0; i < (h == null ? 3 : 1); i++) {
      const o = ray.ray.origin, d = ray.ray.direction;
      if (Math.abs(d.y) < 1e-6) return null;
      const t = (y - o.y) / d.y; if (t < 0) return null;
      hit = { x: o.x + d.x * t, y: o.z + d.z * t };
      if (h == null && c) y = J.surf(c, hit.x, hit.y).h;
    }
    return hit;
  }
  function toScreen(x, y, h) {
    const v = new THREE.Vector3(x, h, y).project(camera), r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  // ---------- přehrání úderu ----------
  let anim = null;
  function playFrames(fr, n, onEv, done) {
    anim = { fr, n, t0: performance.now(), i: 0, onEv, done, speed: 1 };
  }
  function skip() { if (anim) anim.speed = 4; }

  // fukar: pruhy proudu ujíždějí od hubice a mizí, obláček se nafukuje; vysavač: kartáček a vír
  function idleTrap(u, now) {
    if (u.streaks) for (const s of u.streaks) {           // proud končí u zdi (stejný dosah jako ve fyzice)
      const f = (now / 900 + s.userData.ph) % 1, L = Math.max(0, u.reach - 0.25);
      s.position.x = J.FUK_B + 0.2 + f * L; s.material.opacity = L > 0.1 ? 0.6 * Math.sin(f * Math.PI) : 0;
    }
    if (u.cloud) { const s0 = u.cloud.userData.s, p = 1 + Math.sin(now / 260) * 0.05; u.cloud.scale.set(s0, s0 * p, s0 * p); }
    if (u.brush) u.brush.rotation.y = now / 120;
    if (u.swirl) u.swirl.rotation.z = now / 700;
  }

  // ---------- smyčka ----------
  let W0 = 1, H0 = 1, last = performance.now(), running = true;
  // V klidu (nic se nehýbe kromě praporku a kachny) se kreslí každý druhý snímek. Když telefon při pohybu dlouho nestíhá
  // (víc než 60 % snímků přes 28 ms), sníží se rozlišení o stupeň (2 → 1,65 → 1,3 → 1). Pod Playwrightem (navigator.webdriver) ne, ať rendery zůstanou ostré.
  const perf = { odd: 0, n: 0, slow: 0, wasActive: false, camP: new THREE.Vector3(), pr: dpr0, adapt: !navigator.webdriver };
  function adaptPR(dtRaw, active) {
    if (!perf.adapt || document.hidden) return;
    if (active && perf.wasActive) { perf.n++; if (dtRaw > 0.028) perf.slow++; }
    perf.wasActive = active;
    if (perf.n < 90) return;
    if (perf.slow > perf.n * 0.6 && perf.pr > 1.01) { perf.pr = Math.max(1, perf.pr - 0.35); renderer.setPixelRatio(perf.pr); renderer.setSize(W0, H0, false); }
    perf.n = perf.slow = 0;
  }
  function resize() {
    const r = canvas.getBoundingClientRect(); W0 = Math.max(1, r.width); H0 = Math.max(1, r.height);
    renderer.setSize(W0, H0, false); aspect = W0 / H0; camera.aspect = aspect; camera.clearViewOffset(); camera.updateProjectionMatrix(); fitHole(); redecorate(); if (cam.mode === "ball" && cam.follow) fitBall(cam.follow); if (cam.mode === "cup") fitCup();
  }
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dtRaw = Math.max(0, (now - last) / 1000), dt = Math.min(0.05, dtRaw); last = now;
    if (!c) return;
    if (anim) {
      const tick = Math.floor((now - anim.t0) / 1000 * 60 * anim.speed);
      const fr = anim.fr, N = fr.x.length / 2;
      const i = Math.max(0, Math.min(N - 1, tick));   // tick může být záporný: rAF čas je z počátku snímku, t0 vznikl později
      for (const k of ["x", "o"]) if (balls[k].vis) { balls[k].x = fr[k][i * 2]; balls[k].y = fr[k][i * 2 + 1]; }
      setBlades(anim.n, i);
      while (anim.i <= i && anim.onEv) { anim.onEv(anim.i); anim.i++; }
      if (tick >= N - 1) { const d = anim.done; anim = null; d && d(); }
    }
    for (const k of ["x", "o"]) {
      const o = balls[k];
      if (o.until && now > o.until) { o.until = 0; o.face.material.map = faceTex(o.face0); o.face.material.needsUpdate = true; }
      if (o.party) o.hop = Math.abs(Math.sin(now / 240 + (k === "o" ? 1.4 : 0))) * 0.12;
      if (o.vis) place(k);
      // zmáčknutí: náraz rychle odezní, při míření se míček „napíná“ podle síly
      const sq = Math.max(o.squash || 0, (o.aimSq || 0) * 0.35);
      o.body.scale.set(1 + sq * 0.3, 1 - sq * 0.4, 1 + sq * 0.3);
      if (sq && o.vis) o.g.position.y -= J.R * sq * 0.4;
      if (o.squash) { o.squash *= Math.pow(0.0004, dt); if (o.squash < 0.01) o.squash = 0; }
    }
    // pasti: kachna se pohupuje, krtek kouká, pád při odhalení
    for (const m of traps) {
      const u = m.userData, base = J.surf(c, J.trapGeom(u.t).x, J.trapGeom(u.t).y).h;
      if (u.drop) { const t = Math.min(1, (now - u.drop) / 650), e = t < 1 ? (1 - t) * (1 - t) * 3 - Math.sin(t * Math.PI) * 0.15 : 0; m.position.y = base + Math.max(-0.05, e); if (t >= 1) u.drop = 0; }
      if (u.duck) u.duck.position.y = 0.1 + Math.sin(now / 420) * 0.02;
      if (u.mole) u.mole.position.y = J.KOPEC_H + 0.02 + Math.max(0, Math.sin(now / 900)) * 0.06;
      idleTrap(u, now);
    }
    if (ghost && ghost.userData.rot) ghost.userData.rot.rotation.y = -now / 1000 * 1.8;
    if (ghost) idleTrap(ghost.userData, now);
    if (flag) flag.userData.cloth.rotation.y = Math.sin(now / 700) * 0.25;
    for (let i = parts.length - 1; i >= 0; i--) {
      const m = parts[i], u = m.userData;
      m.position.add(u.v); u.v.y -= 0.004; u.life -= dt * 1.2; m.rotation.x += 0.2; m.rotation.y += 0.13;
      m.material.opacity = Math.max(0, u.life);
      if (u.life <= 0) { fx.remove(m); m.material.dispose(); parts.splice(i, 1); }
    }
    updateCam(dt);
    const camMoved = camera.position.distanceToSquared(perf.camP) > 1e-7; perf.camP.copy(camera.position);
    const active = !!anim || parts.length > 0 || camMoved || !!ghost || balls.x.squash > 0 || balls.o.squash > 0 || balls.x.aimSq > 0 || balls.o.aimSq > 0 || balls.x.party || balls.o.party;
    adaptPR(dtRaw, active);
    if (!active && (perf.odd++ & 1)) return;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  addEventListener("resize", resize);
  resize();

  return {
    setHole, setTraps, dropTraps, sinkBall, showCup, setBlades, fadeOwn, setGhost, setBall, setFace, turnRing, setAim, burst, kick,
    setMode, frameBall, snapCam, groundAt, toScreen, playFrames, skip, resize,
    get mode() { return cam.mode; }, get pads() { return { hudPad, ballPad, hudRects }; }, cam, balls, get busy() { return !!anim; },
    setHudRects(r) { hudRects = r || []; },
    setHudPad(p, bp) { hudPad = p; ballPad = bp || null; fitHole(); redecorate(); if (cam.mode === "ball" && cam.follow) fitBall(cam.follow); if (cam.mode === "cup") fitCup(); },
    zoomBy(f) { cam.zoom = Math.max(0.45, Math.min(cam.mode === "ball" ? 1.7 : 1.5, cam.zoom * f)); },
    pan(dx, dz) { cam.panX += dx; cam.panZ += dz; },
    stop() { running = false; },
    renderer, camera, root: scene,
  };
}
