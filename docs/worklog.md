# Worklog – Jamka na míru

## 2026-11-01 ~01:00 – iPhone na šířku (750×342, 844×390): rámování kamery, HUD, rychlejší sólo (session účtu P)
Příčina, proč starý test na šířku prošel: měřil přesně stejný rozměr (Playwright `iPhone 13 landscape` = 750×342), ale kritérium bylo slabé. Stačilo, aby jamka nebyla uříznutá (celá ve volné ploše NEBO celá mimo obrazovku) a míček byl ve volné ploše, velký a ne moc vysoko. „Míček + trocha dráhy, jamka nahoře mimo obraz“ proto prošlo jako „jamka mimo obrazovku“. Nikdo nekontroloval, kolik cesty k jamce je vidět. Navíc se na šířku počítal pruh volné plochy přes celou šířku výšky panelu (panel je jen vpravo dole), takže zbývalo ~200 px.
Hotovo:
1. `src/scene.js`: nízký displej na šířku má v módu „míček“ vlastní okraje (`ballPad`): panel je jen obdélník (`hudRects`), ne pruh, obraz se posune doleva (`xs`), ať míček sedí vedle panelu. `fitBall` zkouší navíc plošší sklony (1,0 / 0,82 / 0,66), víc natočení a větší odstup kamery (míček aspoň ~10 px). Posun obrazu se plynule dojíždí (`cam.off`). Ostatní zařízení beze změny (stejné fáze a meze).
2. `index.html` + `src/main.js` (`layout`, třída `aim`): štítky na šířku na jeden řádek („Radka · čeká na odpališti · 8 par“, nic se nezalamuje ani neuřezává), nižší pilulka, panel úderu 400 px s nápovědou na jednom řádku (výška ~50 px místo ~75 px), menší Oddálit.
3. `tests/kamera.cjs`: zařízení desktop, iPhone na výšku, iPhone na šířku 750×342 (přímo z Playwright devices) a 844×390; výchozí seedy 21, 44, 7, 3, jamky 1–6 (údery 1–2 na každé). Nová pravidla: když je jamka mimo obrazovku, je ve volné ploše míček a nepřerušený kus cesty min(celá cesta, 8 políček; na šířku 6, `REACH_LOW`); HUD texty na jeden řádek a neuříznuté; míček na šířku aspoň 10 px. `SHOTS=all` uloží všechny záběry.
4. Sólo: změřeno (`scratchpad/solotime.cjs`, WebKit 750×342, hráč hraje skriptem bez skipu): bot střílel 0,9 s (časovač) + 0,35 s (pauza po animaci) = ~1,3 s po doběhu úderu hráče, jedna jamka ~15–24 s (z toho přechod mezi jamkami 6 s: výsledek 3 s + 0,45 + 0,25 + úvod, past bota 0,9 s + odhalení 1,1 s). Design-eye nedošel za 150 s k jamce 3 hlavně kvůli vlastnímu skriptu (míření tažením, kroky mezi úhly). Zrychleno jen v sólu: bot střílí 0,55 s + 0,2 s = ~0,75 s po úderu, past bota po 0,5 s, odhalení pastí 0,75 s, výsledek jamky 2,2 s. Jamka 3 se v měření dostala na ~29 s (dřív ~35 s), jamka v průměru ~15 s. Online hra beze změn.
5. `tests/rendery-sirka.cjs` (nový): rendery úderu na šířku do `design/a-s21-iphoneL-uder-j1.png`, `...-j3.png`.
Testy (server `python -m http.server 8808`): `node tests/sim.test.cjs` exit 0 (29/29) · `node tests/herna.cjs` exit 0 (26 PASS) · `node tests/solo.cjs` exit 0 (34 PASS) · `node tests/kamera.cjs` (4 zařízení × seedy 21 44 7 3, 192 záběrů) exit 0 · `node tests/rendery-sirka.cjs` exit 0.
NEOVĚŘENO: skutečný iPhone (FPS, dotyk, safe-area na šířku s výřezem), tažení k míčku těsně u spodku na šířku (míček je ~100 px nad spodkem), jamky s hodně zalomenou cestou na 750×342 (jamka 3 seed 7: vidět jen ~5 políček cesty, protože míček je jinak menší než 10 px), jazyky/jména delší než „Radka“ ve štítcích na šířku, `duel.cjs`/`perf.cjs` po této změně nespuštěny.

## 2026-10-31 ~22:50 – kamera bez useknuté jamky, sólo „Zkusit sám“, napojení na Hernu (session účtu P)
Hotovo:
1. Kamera (`src/scene.js` `fitBall`, `cupAllPts`, `cupPts`, `fitCup`): celá sada bodů jamky (okraj, špička tyče, látka) je buď celá ve volné ploše mezi HUD a panelem, nebo celá mimo obrazovku; mimo obrazovku je míček v dolní třetině a kamera hledí k jamce. Zoom ven u výsledku jamky na desktopu (okolí 1,5/1,4, pasti do 9 políček). `#bCam` („Oddálit“) je v dolním panelu (`index.html`), nepřekrývá hřiště a nelepí se na panel; skrytý mimo úder.
2. První jamka lehčí (`src/sim.js` `plan`: 2 nebo 3 nohy, par 2–3 v ≥90/100 seedů). Nový `J.botHuman` (lidský bot: chyba úhlu a síly, nejlepší z pěti úderů vážené náhodně).
3. Sólo „Zkusit sám“ (`src/main.js`: `startSolo`, `botMaybe`, `botTrap`, `botShoot`, `leaveSolo`; hash `#solo`; „Trénink“ v liště jamky; konec „Znovu“ + „Vyzvat soupeře“; bez sítě a bez série).
4. Herna (`hernaParams`, `startHerna`, `doHerny`, `hernaStav`, `hernaResult`; `<meta name="herna-protokol">`; tlačítko „Jiná hra“; skryto sdílení a „Zkusit sám“). Bez `#herna` beze změny. Opraven pád `showEnd` po odvetě (rematch volal showEnd i když sync už spustil novou partii).
5. `tests/pamet.cjs`: textury obličejů se cachují líně (max 10), kritérium už nepočítá první růst jako únik (rozhodující je druhá půlka partie).
6. Doplnění od Herny (lišta 51 px, iframe na iPhonu 13 jen 390×613): `tests/herna-host.html` má lištu 51 px; `tests/herna.cjs` měří v WebKitu 390×613 (B = iPhone) výběr pasti (všechny tři karty), výsledek jamky, úder, kartu konce, nabídku odvety i nejhorší kartu konce (4 titulky + série + věta o odvetě): nic nesmí přesáhnout okno a nesmí scrollovat. Našlo 2 vady, obě opraveno: (a) karta konce s víc titulky měla 751 px a scrollovala; `index.html` má blok `@media (max-height: 700px)` (menší míčky, mezery, skórkarta, titulky, tlačítka), nejhorší karta je 573 px; (b) „Oddálit“ (`#bCam`) o jeden snímek přesahoval dolní okraj, dokud se po překreslení panelu nepřepočítalo `--dockOH`; `paintDock` ho teď nastavuje hned a CSS má `max(...)` jako spodní mez.
Rozhodnuto (předpoklady): vítěz v Herně se posílá podle sedadla Herny (`meta.hx`); odveta v Herně = standardní odveta hry; obtížnost bota je odhad (průměr 1,0–1,5× par).
Testy (server `python -m http.server 8808`, kořen hry): `node tests/sim.test.cjs` exit 0 (29/29) · `node tests/kamera.cjs` (desktop, iPhone na výšku, iPhone na šířku) exit 0 každý (132 snímků) · `node tests/pamet.cjs 3` exit 0 · `node tests/duel.cjs` (živý mantledb) exit 0 (36/36) · `node tests/perf.cjs` exit 0 · `node tests/solo.cjs` exit 0 (34/34, desktop i iPhone) · `node tests/herna.cjs` exit 0 (26/26, včetně měření 390×613) · po úpravě karty konce a `#bCam` znovu `ONLY=<zařízení> node tests/kamera.cjs` exit 0 (desktop, iPhone na výšku 132 snímků, iPhone na šířku) a `ONLY=iphone node tests/solo.cjs` exit 0 (17/17); jednorázový výpadek při čtyřech Playwright během zátěže se v samostatném běhu nezopakoval · `SEED=7 node tests/rendery.cjs` exit 0 · `SEED=21 UVOD=1 node tests/rendery.cjs` exit 0.
Rendery: `design/a-s7-*`, `design/a-s21-*`, `design/a-uvod-*`.
NEOVĚŘENO: skutečný iPhone, zvuk, celá obrazovka, pinch; živá Herna a Pages (nic nenasazeno ani nepushnuto); iPhone na šířku jen emulací Playwright; na desktopu u seedu 21 je daleký kruh pasti ve výsledku jamky částečně useknutý nahoře (přijato).

## 2026-10-31 ~23:30 – 2. kolo design-eye (NE-PROFI): blokující vady opraveny (session účtu P)
Opraveno (soubor):
1. Kamera při úderu (`src/scene.js` `fitBall`, `pathAhead`, `cupSpots`): míček, jamka a špička praporku se vejdou do volné plochy mezi horní HUD a dolní panel. `fitBall` zkouší celou cestu + jamku + praporek při kameře do 25 (na výšku 24), pak zkracuje cestu (20, 17, 14, 11, 8 políček), zkouší natočení (po cestě, k jamce, mezi) a polohu míčku ve volné ploše (30, 12, 50, 70 %). Daleká jamka je buď celá ve volné ploše, nebo celá mimo obrazovku, nikdy napůl pod HUD. Tlačítka mimo pruhy (nabídka, Oddálit) předává `main.js layout()` přes `setHudRects`.
2. Pasti (`src/sim.js`): `TRAPS[*].clear/foot` = viditelný poloměr (mlýnek 1,03, louže 0,8, krtinec 0,9 se zmenšenou sukní `KOPEC_R` 0,9 / `KOPEC_H` 0,3, pérovačka: obrys 0,3 + celá délka stěny). `trapValid` vzorkuje 48 bodů po obvodu. Překryv: `placeTrap` při dokončení dvojice posune past hráče `o` na nejbližší platné nepřekrývající se místo (spirála po dvacetinách, poloměr 3 políčka, jen součty a násobení), jinak propadne (`pend.o` false, hláška). Výsledek nezávisí na pořadí příchodu. Stav má `moved` (toast „Jedna se kousek posunula“).
3. Výsledek jamky na desktopu (`scene.js` `showCup`, `fitCupDist`, `decorate`): míčky stojí vedle jamky na trávě (vlevo / vpravo / dopředu, nikdy za tyčí vpravo, kde visí látka), kamera se dopočítá projekcí (jamka, praporek, míčky a kus okolí ve volné ploše), ozdoby se vybírají mimo trať a mimo záběr výsledku, ručník pryč.
4. Mantinely: sloupky jen v rozích (kde zeď mění směr), menší. Zima: boční stěna tmavá břidlicová `#566F8C`, vnitřní bok tmavší červená; pláž: tmavší bok `#B58546`.
5. HUD desktop ×1,3 (`index.html`, blok `@media (min-width: 561px)`): štítky 18 px / 15,5 px, součet 31 px, pilulka 23 px; „1/6“ stejným písmem a řezem (`font: inherit`). Konec partie: tmavší překryv `rgba(30,33,44,.46)` a blur 1,5 px. „Jamka remíza“ je „Remíza na jamce“.
Podezření seed: místní režim seed z `?mistni=` bere správně (`room.id = "mistni-" + seed`, seed `hashStr(room.id + ":" + gi)`, online `room.id` je různé). Seedy 3/7/11 mají různé jamky (pary 3,3,3,4,3,2 / 3,3,4,2,4,4 / 3,3,4,3,4,4); shoda parů u 7 a 11 je náhoda malého receptu. První jamka přesto zpestřena: `plan` dává i=0 3 nebo 4 nohy (dřív vždy 3) → tvar (zatáčky, rys, rozměr) se liší ve 20 z 20 seedů (test chce aspoň 15).
Crash WebKit iPhone na šířku, seed 3: nezopakoval se (4 běhy `tests/pamet.cjs`, celá partie, 53–58 s). Nalezen ale únik: duch pasti (`setGhost`) se při každém pohybu prstu znovu stavěl a starý se jen odebral, bez `dispose` (150 přestavění = +357 geometrií v rendereru, ověřeno testem vráceným do staré verze). Při tahu prstem to jsou stovky geometrií za pár sekund, což je věrohodná příčina pádu. Opraveno `disposeTree` v `setGhost`, `clear` uvolňuje i materiály, částice sdílejí geometrii. Po opravě 150 přestavění = +0.
Testy (server `python -m http.server 8808`, příkazy z kořene hry, exit kódy z `runall`):
- `node tests/sim.test.cjs` → exit 0, 25/25 PASS (nové: velikost pastí = kreslení, nic nepřečnívá (1664 míst), překryv posunut 110×, propadnutí pevný případ, nezávislost na pořadí, první jamka 20/20, seed z `?mistni=`).
- `node tests/kamera.cjs 3 7 11` (nový) → exit 0, 72 záběrů (Chromium 1440×900 + WebKit iPhone 13 na výšku), míček vždy ve volné ploše a ≥12 px, jamka+praporek ve volné ploše při cestě ≤12 políček (12 záběrů), u dalekých (60) nikdy napůl pod HUD. Před opravou 18 vad na dvou seedech.
- `node tests/pamet.cjs 3` ×3 → exit 0, geometrie stabilně 30–47, osiřelých 0.
- `node tests/duel.cjs` → exit 0, 36/36 PASS (celá partie, 26 úderů, 3 prohlížeče bit po bitu).
- `node tests/perf.cjs` → exit 0, WebKit iPhone 13 emulace 15–17 FPS (software WebGL), `JM.hole` 6 jamek 119–317 ms.
- `SEED=7 node tests/rendery.cjs` → exit 0; `SEED=3 KRATKE=1` a `SEED=11 KRATKE=1` → exit 0. Rendery `design/a-s7-*`, `a-s3-*`, `a-s11-*` ({desktop,iphone}-{past,uder,vysledek[,konec]}). Staré `a-desktop-*`, `a-iphone-*` jsou zastaralé.
NEOVĚŘENO: skutečný iPhone (FPS, dotyky, pád při tažení), zvuk, fullscreen, pinch zoom, iPhone na šířku v kameře (jen `pamet`, bez `kamera`), kamera u jamky když je hotová jen jedna z nich (druhý míček mimo záběr), všechny kombinace pastí a modifikátorů, nový rozestup ozdob na všech třech tématech za pohybu; nový kolo design-eye zatím neproběhlo.

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

## 1. 11. 2026 – nasazení
- Repo `sachasportrezervace-arch/jamka-na-miru` (veřejné), `master` přejmenována na `main`, push, Pages z `main` / root, build `built`.
- Živá URL: https://sachasportrezervace-arch.github.io/jamka-na-miru/
- Příkazy (exit 0): `node tests/duel.cjs` (lokálně, 36/36), `node tests/perf.cjs`, `curl` ×4 (200), `node tests/duel.cjs <živá URL>` (36/36), `node tests/solo.cjs <živá URL>` (34 PASS).
- Server 8808 (`python -m http.server`) zastaven podle PID. Do `.gitignore` přidáno node_modules, logy, .env*.
- Zbývá: ověření na skutečném iPhonu (NEOVĚŘENO).
