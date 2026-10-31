# Worklog – Jamka na míru

## 2026-10-31 ~20:00 – první spuštění v prohlížeči (session účtu P)
- Hra poběžela napoprvé: celá partie (6 jamek, oba hráči, pasti, údery přes `__jm`) projde v Chromiu 1440x900 i WebKitu iPhone 13
  bez chyb v konzoli; skóre je v obou prohlížečích totožné (determinismus sedí na `sc` celé partie).
- Opraveno: (1) `scene.js` frame(): záporný `tick` na začátku animace úderu (rAF čas < t0) dal `undefined` souřadnice míčku, NaN v kameře
  a prázdnou scénu po prvním úderu; (2) obličej míčku seděl uvnitř koule (vidět jen zorničky), teď před povrchem; (3) kamera za míčkem
  dál a výš (`dist` 7,4 / 9 na výšku, pitch 0,85); (4) `main.js`: karta pasti se po výběru nezvýrazňovala (pickTrap nepřekresloval dock),
  nadpis „Postav Radka past“ (skloňování) → „Mark staví past soupeři“; (5) CSS: iOS nápověda zakrývala dock (jen v menu), karty pastí
  na mobilu ve 2 sloupcích, ukazatel síly nepřekrývá „Oddálit“, B: skórkarta jako panel / na mobilu níž pod pill, tabulka bez flex na `th`.
- Přidáno: `manifest.webmanifest`, `icons/` (+ `tools/make-icons.cjs`), `tests/rendery.cjs` (rendery A/B do `design/`).
- Rendery: `design/{a,b}-{desktop,iphone}-{past,uder,vysledek,konec}.png`. Spuštění: server na 8808 + `node tests/rendery.cjs [a|b|ab]` (~4,5 min).
- Zbývá: výběr návrhu (design-eye), smazání druhého návrhu z CSS, testy (`tests/duel.cjs` vzor Ovocný souboj, 2 prohlížeče bit po bitu,
  divák, 3 partie se liší, výkon iPhone), design-eye „profi indie hra“, repo + Pages + živý test. NEOVĚŘENO: online režim přes mantledb
  (jen `?mistni=`), skutečný iPhone (jen emulace WebKit), zvuk, fullscreen, zatáčky/svahy všech témat v animaci úderu (zkontrolovány jen statické pohledy 12 jamek).

## 2026-10-31 ~19:30 – předávka (kontext plný), session účtu P (local_b92f…)

Zadání (od řídicí session): minigolf pro dva na jednom odkazu, 6 jamek, méně ran vyhrává. Twist: před jamkou
postavíš soupeři past (mlýnek, louže, pérovačka, krtinec) a on tobě. Jamky ze seedu (generátor ověří hratelnost,
spočítá par, nehratelné zahodí; zatáčky, svahy, můstky, ostrůvky). 3D low-poly three.js, míčky s obličeji,
kamera za míčkem / celá jamka, zoom + tlačítko Oddálit. Deterministická fyzika (test ve 2 prohlížečích), plynule na iPhonu.
Postup: 2 návrhy obrazovky → design-eye vybere → hra → testy → design-eye „profi indie hra“ → repo + Pages + živý test.
Společná pravidla: `../HRY-PREVZETI-2026-10-31.md`. Port **8808**. Commity bez Co-Authored-By.

### Hotovo (nic z toho zatím nespuštěno v prohlížeči!)
- `src/sim.js` – NOVÉ jádro (starý 2D kód je v `src/sim-old-2d.js`, `src/art-old-2d.js`, jen pro inspiraci):
  plán hry ze seedu (`plan`), stavba tratě z nohou na mřížce (`build`: svah/most/ostrov, zkosené rohy, mantinely,
  vzdálenostní pole), `hole(seed, i)` = stavba + greedy bot (`botPar`, 64 směrů × 9 sil) → par = bot+1 (2–5),
  nehratelné pokusy zahodí. Fyzika `shoot` (sklon povrchu, voda = návrat + trestná rána, pasti působí jen na soupeře),
  pravidla: pasti naslepo naráz (`placeTrap`), údery (`playShot`), `replay(seed, first, logs)` z deníků obou hráčů, `titles`.
  Ověřeno v node: 6 jamek za 0,1–0,3 s, pary hlavně 3–4, `shoot` deterministický (stejný JSON), ~0,1 ms/úder.
- `src/scene.js` – three.js scéna: mřížka → low-poly trávník (pruhy), mantinely se sloupky, voda, prkenné můstky,
  ostrůvky (keře), stromy podle tématu (zahrada/pláž/zima), jamka s vlajkou, míčky (ikosaedr + sprite obličeje:
  idle/aim/fast/dizzy/wet/happy/smug/worry), pasti (mlýnek s lopatkami, louže s kachničkou, pruhovaná pérovačka,
  krtinec s krtkem), tečkovaná mířící čára, kamera režim `hole`/`ball`, zoom, pan, `groundAt`, přehrání snímků.
- `src/main.js` – UI: místnost na mantledb (vzor Ovocný souboj: meta /hra, deníky /x a /o, `introMine` = tlačítko
  „Jsem X, výzvu jsem založil(a) já“, divák), přehrávací fronta animací, míření tažením zpět, stavění pasti
  (karty, ghost, Otočit, Postavit), výsledek jamky, konec partie + odveta + série, zvuk, fullscreen, iOS nápověda,
  `?mistni=<seed>` = hra na jednom zařízení (pro testy a návrhy), háčky `window.__jm`.
- `src/net.js` (z Ovocného souboje), `index.html` (CSS pro **návrh A** „čistý stůl“ a **návrh B** „kartička“,
  přepínání `?navrh=a|b`), `vendor/three.module.min.js` (r170), fonty Baloo 2 + Onest.
- Git: lokální repo, WIP commit převzetí + commit této předávky. Remote zatím není.

### Chybí / další kroky (v tomto pořadí)
1. Spustit statický server na 8808 (`python -m http.server 8808` ve složce, PID si poznamenat, cizí procesy nezabíjet),
   otevřít `/?mistni=1&navrh=a` a `&navrh=b`, opravit chyby v konzoli (kód je napsaný naslepo).
2. Chybí `manifest.webmanifest` a `icons/` (icon.svg, apple-touch-icon.png, 192, 512, maskable) – vzor `../ovocny-souboj/tools/make-icons.cjs`.
3. Rendery návrhů A a B (desktop 1440×900 + iPhone 13) ve fázi pasti i úderu → design-eye vybere, druhý návrh smazat z CSS.
4. Testy: node test simulace + determinismus; `tests/duel.cjs` vzor `../ovocny-souboj/tests/duel.cjs` (Chromium desktop +
   WebKit iPhone, Playwright z `%APPDATA%/npm/node_modules/playwright`): výzva → přijetí → pasti → údery přes `__jm.bot()`,
   oba prohlížeče musí mít stejné `__jm.state().balls` bit po bitu; regresní test „nevyzvu sám sebe“; divák; 3 partie se liší; výkon iPhone.
5. design-eye „profi indie hra“ (max 3 kola), pak veřejné repo `sachasportrezervace-arch/jamka-na-miru`, Pages z `main`, živý test.

### Otevřená rozhodnutí (předpoklady)
- Pasti se staví naráz a naslepo (oba hned, bez čekání na sebe), odhalí se, až stojí obě. Komeback: kdo ztrácí ≥2 rány, vybírá ze 3 pastí místo ze 2.
- Strop jamky: par+3 ran, pak se zapíše par+4. Čest odpalu: kdo jamku zahrál líp, začíná další.
