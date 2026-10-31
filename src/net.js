// Jamka na míru – sdílená místnost na mantledb.sh (bez účtu, CORS), převzato z Ovocného souboje.
//
// Tahová hra, tři dokumenty, každý s jediným zapisovatelem (žádné kolize zápisů):
//   …/jamka-na-miru-<id>/hra  meta: jména, zařízení obou míst. Místo o se zabírá při přijetí výzvy (čti-ověř-zapiš).
//   …/jamka-na-miru-<id>/x    deník akcí hráče x: { gi: číslo partie, acts: [pasti a údery], hist: [výsledky partií] }
//   …/jamka-na-miru-<id>/o    totéž pro hráče o
// Stav hry je deterministické přehrání obou deníků (sim.js replay), takže oba prohlížeče vidí totéž.

export const API = (typeof window !== "undefined" && window.JM_API) || "https://mantledb.sh/v2/";
const APP = "jamka-na-miru";
export const metaUrl = id => `${API}${APP}-${id}/hra`;
export const seatUrl = (id, seat) => `${API}${APP}-${id}/${seat}`;

async function req(url, opt = {}) {
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 8000);
  try { return await fetch(url, { ...opt, cache: "no-store", signal: ac.signal }); } finally { clearTimeout(timer); }
}
export async function load(url) {
  const r = await req(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("load " + r.status);
  return r.json();
}
export async function save(url, d) {
  const r = await req(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, u: Date.now() }) });
  if (!r.ok) throw new Error("save " + r.status);
}

const attempt = (fn, fb) => { try { return fn(); } catch { return fb; } };
export const store = {
  get: k => attempt(() => localStorage.getItem(k), null),
  set: (k, v) => attempt(() => localStorage.setItem(k, v)),
};
export const randId = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => (b % 36).toString(36)).join("");
export const device = store.get("jm-dev") || randId(16);
store.set("jm-dev", device);

// čti, ověř, zapiš; ok(doc) vrací nový dokument nebo null, když se zápis už nehodí
export async function commitMeta(id, ok) {
  const d = await load(metaUrl(id));
  const next = ok(d);
  if (!next) return { d, ok: false };
  const out = { ...next, v: (d ? d.v : 0) + 1 };
  await save(metaUrl(id), out);
  return { d: out, ok: true };
}

// vlastní dokument hráče: zápisy sloučené, nejvýš jeden na cestě, mezi nimi aspoň `gap` ms
export function seatWriter(id, seat, initial) {
  let doc = { ...initial }, dirty = false, flying = false, last = 0, timer = null, fails = 0;
  const w = {
    doc: () => doc,
    set(patch, urgent) { doc = { ...doc, ...patch }; dirty = true; w.kick(urgent); },
    gap: 350,
    kick(urgent) {
      if (flying || !dirty) return;
      const wait = urgent ? 0 : Math.max(0, last + w.gap - Date.now());
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (flying || !dirty) return;
        flying = true; dirty = false; last = Date.now();
        const snap = doc;
        try { await save(seatUrl(id, seat), snap); fails = 0; w.onNet && w.onNet(""); }
        catch { dirty = true; fails++; if (fails >= 2 && w.onNet) w.onNet("Spojení vázne, zkouším to znovu…"); }
        flying = false;
        if (dirty) setTimeout(() => w.kick(), fails ? Math.min(4000, 400 * 2 ** fails) : 0);
        else w.onSaved && w.onSaved(snap);
      }, wait);
    },
    pending: () => dirty || flying,
    stop() { clearTimeout(timer); dirty = false; },
  };
  return w;
}
