# Jamka na míru

Minigolf pro dva na jednom odkazu. 6 jamek, vyhrává, kdo má míň ran. Před každou jamkou postavíš soupeři past (mlýnek, louže,
pérovačka, krtinec) a on tobě. Tvoje past tě nechá být. Každá partie má jiné jamky (generuje se ze seedu), takže se tři partie za sebou neopakují.

## Jak hrát

1. Napiš svoje jméno a (nepovinně) jméno soupeře, klepni na **Připravit výzvu** a pošli odkaz. Soupeř ho otevře, napíše jméno a **Přijme výzvu**.
2. **Pasti**: oba naráz a naslepo vyberou past (kdo ztrácí aspoň 2 rány, vybírá ze tří), táhnutím nebo klepnutím ji umístí, případně otočí, a klepnou na **Postavit sem**. Po postavení obou se pasti odhalí.
3. **Údery**: táhni prstem (myší) zpátky od míčku a pusť, čím dál, tím silněji. Síla je vidět v panelu dole. Voda znamená vrácení a ránu navíc. Strop jamky je par + 3 rány.
4. Kamera drží míček v dolní třetině a ukazuje cestu k jamce. **Oddálit** ukáže celou jamku, kolečko nebo štípnutí přibližuje. Tlačítko **Oddálit** sedí v panelu vpravo. Tlačítko s třemi čárami otevře skórkartu, zvuk a celou obrazovku.
5. Po dohrání jamky se dole ukáže výsledek a míčky se zaradují v jamce. Kdo jamku zahrál líp, začíná další. Na konci je vítěz veselý a poražený zkroušený, a dá se hrát **odveta** na stejném odkazu.

**Zkusit sám** (na úvodní obrazovce, nebo přímo adresou `#solo`): trénink proti botovi, bez sítě, místnosti a série. Bot staví past i střílí „po lidsku“
(`J.botHuman`: jedna z pěti nejlepších ran s chybou úhlu a síly, deterministicky z místnosti a jamky), takže se dá porazit. Mapy, motivy a modifikátory
se losují jako v ostré hře, v liště jamky je nenápadně „Trénink“. Na konci „Znovu“ (nová partie) a „Vyzvat soupeře“ (přechod do normální výzvy se jménem z úvodu).

Třetí zařízení s odkazem může **Jen se dívat**. Otevřít odkaz na novém zařízení nikdy samo nesedne na místo zakladatele.
Na iPhonu: Sdílet, Přidat na plochu, hra se pak otevře bez lišty prohlížeče.

## Napojení na Hernu

Hra umí protokol místnosti Herny (`../HERNA-PROTOKOL.md`, verze 1): `<meta name="herna-protokol" content="1">` a adresa
`#herna=1&m=…&r=…&seat=0|1&names=A,B&zaklada=0|1`. V režimu Herny se přeskočí výzva i setup, zakladatel (`zaklada=1`) rovnou založí dokument `r` na mantledb
se jmény z `names` (hráč x = zakladatel, jeho jméno je `names[seat]`), druhý hráč čeká („Čeká se, až hra naskočí“) a po vzniku dokumentu si sám sedne na místo o.
Skryté je sdílení odkazu, „Vyzvat soupeře“, „Zkusit sám“, celá obrazovka a nápověda Přidat na plochu. Hra posílá rodiči `pripraveno`, `stav` (`ceka`, `hraje`, `konec`),
`vysledek` (`partie` = `r:číslo partie`, `vitez` = sedadlo v Herně nebo `null`) a po kliknutí na „Jiná hra“ zprávu `jina-hra`. Odveta jede dál na stejném dokumentu.
Bez platného `#herna=1` se hra chová jako dřív.

## Spuštění a testy

Čistě statická stránka (three.js ve `vendor/`, fonty ve `fonts/`), žádný build.

```
python -m http.server 8808        # ve složce hry, pak http://127.0.0.1:8808/
http://127.0.0.1:8808/?mistni=1   # hra na jednom zařízení bez sítě (seed 1), pro testy a ladění
```

Playwright se bere z `%APPDATA%/npm/node_modules/playwright` (jinak proměnná `PW`). Server musí běžet na 8808.

| příkaz | co dělá |
|---|---|
| `node tests/sim.test.cjs` | jádro bez prohlížeče: determinismus `shoot` a `replay`, 50 seedů × 6 jamek hratelných, pasti (velikost = kreslení, překryv), první jamka pestrá, 3 partie se liší (~1 min) |
| `node tests/duel.cjs [URL]` | Chromium desktop (Mark) + WebKit iPhone 13 (Radka) + divák přes skutečný mantledb, celá partie, porovnání stavu po každém úderu (`MAXHOLES=2` zkrátí) |
| `node tests/perf.cjs [URL]` | WebKit iPhone 13: FPS během úderu a čas `JM.hole` pro 6 jamek |
| `node tests/kamera.cjs [seed ...]` | kamera při úderu, projekcí do pixelů proti skutečným obdélníkům HUD: míček vždy ve volné ploše a v dolní části, jamka s praporkem buď celá ve volné ploše, nebo celá mimo obrazovku (nikdy napůl pod HUD), tlačítko Oddálit v panelu mimo dráhu. Seedy 3 7 11 21 2 5 9 13 17 25 30, hrají se celé partie (jamky 1–6, údery 1–`STROKES`), Chromium 1440×900 + WebKit iPhone 13 na výšku i na šířku. `SCAN=1` = rychlý režim bez hraní (odpaliště a dvě další místa každé jamky), `ONLY=desktop,iphone,iphone-sirka`, `SHOTS=1` ukládá snímky vad |
| `node tests/solo.cjs` | sólo režim: tlačítko „Zkusit sám“ → `#solo`, celá partie proti botovi v Chromiu i WebKitu iPhone 13, „Trénink“ v liště, žádná chyba v konzoli, žádný síťový požadavek mimo náš server (nic na mantledb), „Znovu“, „Vyzvat soupeře“ |
| `node tests/herna.cjs` | napojení na Hernu: hra v iframe `tests/herna-host.html` (maketa Herny) ve 2 prohlížečích přes živý mantledb, zprávy protokolu, jména a sedadla, celá partie, `vysledek` jednou na okno, `jina-hra`, odveta, bez `#herna` jako dřív (~4 min) |
| `node tests/pamet.cjs [seed]` | únik paměti scény (`renderer.info`) přes celou partii, výchozí WebKit iPhone na šířku |
| `SEED=7 node tests/rendery.cjs` | rendery do `design/a-s<seed>-<zařízení>-<záběr>.png` (past, úder, výsledek, konec; desktop + iPhone, ~4 minuty; `KRATKE=1` bez konce; `UVOD=1` přidá `a-uvod-*.png`, úvod s „Zkusit sám“) |

Snímky z `duel.cjs` jsou v `tests/shots/`. Háčky pro testy: `window.__jm` (`state`, `viewInfo`, `autoTrap`, `bot`, `shoot`, `scene`).

## Soubory

- `src/sim.js` deterministické jádro: generátor jamek, fyzika `shoot`, pravidla, `replay` z deníků obou hráčů, boti (`botShot` dokonalý pro testy, `botHuman` pro sólo)
- `src/scene.js` 3D scéna (three.js), míčky s obličeji, pasti, kamera
- `src/main.js` UI, místnost přes mantledb (`src/net.js`), přehrávání úderů
- `index.html` styly a kostra, `docs/worklog.md` deník práce
