# Worklog – Jamka na míru

## 2026-10-31 ~22:00 – návrh A vybrán, opravy design-eye, testy (session účtu P)
Rozhodnutí: návrh A („čistý stůl“) je jediný. Návrh B odstraněn (CSS `.navrh-b`, `#side`, `?navrh`, `design/b-*`), `body.navrh-a` je výchozí.
Hotovo (opravy v pořadí zadání):
1. Šikmé mantinely: příčina byla navinutí trojúhelníků (vnitřní stěna, horní hrana i zkosené podlahové trojúhelníky mířily dolů, stejné jako u rovných zdí, jen u zkosení to bylo vidět nejvíc). Materiál tratě je `DoubleSide`, zdi i zkosení jsou plné.
2. Kamera `ball`: míček v dolní třetině volné plochy, před ním cesta k jamce (celá, když je jamka do 8 políček, jinak prvních 8), sklon 1,0 / 1,12 na výšku; `fitBall` dopočítá vzdálenost projekcí. Oddálit a zoom zůstaly (zoom v módu míček max 1,7×).
3. Výsledek jamky je v panelu `#dock` (`.res`), scéna najede na jamku (`cam.mode = "cup"`), míčky zapuštěné v jamce, veselé, poskakují, konfety. Lišta „Jamka N“ ukazuje dohranou jamku.
4. HUD z jednoho stavu: `G = st.g` hned po doběhu úderu, štítky (`statusOf`, `onTurn`, `faceOf`) i výsledek čtou jen `G`; duel test porovnává součty ve štítcích se `state().sc` po každém úderu.
5. Výrazy: štítky mění obličej (staví past = škodolibý, chytila past = zamračený, voda = smutný, vedu = spokojený, v jamce = veselý); konec partie: veselý vítěz a zkroušený poražený vedle sebe; ve fázi pasti jsou oba míčky na odpališti (škodolibý, po postavení „koukají“).
6. Štítky: druhý řádek nikdy prázdný, na iPhonu kompaktní 44 px (jméno + součet).
7. Spodek mobilu: síla úderu je v panelu, `#tools` nahrazen jedním tlačítkem s nabídkou (skórkarta, zvuk, celá obrazovka). Na výšku vpravo nahoře, na šířku vlevo (jinak ho kryje panel).
8. Dekorace: pryč palmy a kameny, 2–3 klidné prvky na jamku (kulatý strom, slunečník, smrček) vedle nebo za tratí, mimo zákryt. Tah hlásí jen štítek (kroužek), panel bez kroužku. Z návrhu B: žluté primární tlačítko `--sun` a žlutá vybraná karta pasti.
Mimo zadání: `createRoom` zakládá i prázdný deník `o` (jinak 404 v konzoli při načtení místnosti); `__jm.viewInfo`.

Testy (server `python -m http.server 8808`):
- `node tests/sim.test.cjs` → exit 0, 14/14 PASS (~10 s): shoot deterministický 60/60, replay shodný, 300 jamek hratelných (par 2:15, 3:182, 4:100, 5:3, nejdéle 55 ms), 3 partie za sebou (3 místnosti) bez shodné jamky.
- `node tests/duel.cjs` → exit 0, 36/36 PASS, celá partie 6 jamek, 41 úderů, 196 s, skutečný mantledb. Bit po bitu stejný stav ve 3 prohlížečích po každém úderu (41 porovnání, 0 rozdílů), průměr 2,8 s od úderu do shody. Pojistka introMine ověřena (nový kontext nesedne na místo zakladatele, přijetí pod jeho jménem odmítnuto i `  mark `). První běh `MAXHOLES=2` měl 1 FAIL (404 pro deník `o`), opraveno.
- `node tests/perf.cjs` → exit 0. WebKit iPhone 13 (emulace): `JM.hole` 6 jamek za 98–250 ms (průměr 195 ms, nejdelší jamka 93 ms), FPS při úderu 15,9–16,3 (rAF za 3 s), JS vykreslení 0,9 ms, scéna 32 draw calls a 1 452 trojúhelníků. FPS nezávisí na rozlišení (DPR 2, 1, 0,5 stejně ~15), `about:blank` ve stejném WebKitu 62 FPS, Chromium SwiftShader 31–35 FPS: úzké hrdlo je softwarové WebGL v Playwright WebKitu na Windows, ne naše scéna.
- `node tests/rendery.cjs` → exit 0, bez chyb v konzoli. Rendery `design/a-{desktop,iphone}-{past,uder,vysledek,konec}.png`.
Zbývá: design-eye „profi indie hra“ (max 3 kola), repo `sachasportrezervace-arch/jamka-na-miru` + Pages + živý test, push až po verdiktu.
NEOVĚŘENO: skutečný iPhone (FPS, dotyky, Přidat na plochu, safe-area), zvuk, fullscreen, pinch zoom, zatáčky/svahy všech témat za pohybu, iPhone na šířku (jen snímek menu a pasti, scéna jamky je tam malá), dekorace u všech témat (viděny pláž a zima), hra přes skutečné mobilní sítě.

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
