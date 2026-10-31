# Jamka na míru

Minigolf pro dva na jednom odkazu. 6 jamek, vyhrává, kdo má míň ran. Před každou jamkou postavíš soupeři past (mlýnek, louže,
pérovačka, krtinec) a on tobě. Tvoje past tě nechá být. Každá partie má jiné jamky (generuje se ze seedu), takže se tři partie za sebou neopakují.

## Jak hrát

1. Napiš svoje jméno a (nepovinně) jméno soupeře, klepni na **Připravit výzvu** a pošli odkaz. Soupeř ho otevře, napíše jméno a **Přijme výzvu**.
2. **Pasti**: oba naráz a naslepo vyberou past (kdo ztrácí aspoň 2 rány, vybírá ze tří), táhnutím nebo klepnutím ji umístí, případně otočí, a klepnou na **Postavit sem**. Po postavení obou se pasti odhalí.
3. **Údery**: táhni prstem (myší) zpátky od míčku a pusť, čím dál, tím silněji. Síla je vidět v panelu dole. Voda znamená vrácení a ránu navíc. Strop jamky je par + 3 rány.
4. Kamera drží míček v dolní třetině a ukazuje cestu k jamce. **Oddálit** ukáže celou jamku, kolečko nebo štípnutí přibližuje. Tlačítko s třemi čárami otevře skórkartu, zvuk a celou obrazovku.
5. Po dohrání jamky se dole ukáže výsledek a míčky se zaradují v jamce. Kdo jamku zahrál líp, začíná další. Na konci je vítěz veselý a poražený zkroušený, a dá se hrát **odveta** na stejném odkazu.

Třetí zařízení s odkazem může **Jen se dívat**. Otevřít odkaz na novém zařízení nikdy samo nesedne na místo zakladatele.
Na iPhonu: Sdílet, Přidat na plochu, hra se pak otevře bez lišty prohlížeče.

## Spuštění a testy

Čistě statická stránka (three.js ve `vendor/`, fonty ve `fonts/`), žádný build.

```
python -m http.server 8808        # ve složce hry, pak http://127.0.0.1:8808/
http://127.0.0.1:8808/?mistni=1   # hra na jednom zařízení bez sítě (seed 1), pro testy a ladění
```

Playwright se bere z `%APPDATA%/npm/node_modules/playwright` (jinak proměnná `PW`). Server musí běžet na 8808.

| příkaz | co dělá |
|---|---|
| `node tests/sim.test.cjs` | jádro bez prohlížeče: determinismus `shoot` a `replay`, 50 seedů × 6 jamek hratelných, 3 partie se liší (~10 s) |
| `node tests/duel.cjs [URL]` | Chromium desktop (Mark) + WebKit iPhone 13 (Radka) + divák přes skutečný mantledb, celá partie, porovnání stavu po každém úderu (`MAXHOLES=2` zkrátí) |
| `node tests/perf.cjs [URL]` | WebKit iPhone 13: FPS během úderu a čas `JM.hole` pro 6 jamek |
| `node tests/rendery.cjs` | rendery vybraného návrhu do `design/a-*.png` (past, úder, výsledek, konec; desktop + iPhone, ~4 minuty) |

Snímky z `duel.cjs` jsou v `tests/shots/`. Háčky pro testy: `window.__jm` (`state`, `viewInfo`, `autoTrap`, `bot`, `shoot`, `scene`).

## Soubory

- `src/sim.js` deterministické jádro: generátor jamek, fyzika `shoot`, pravidla, `replay` z deníků obou hráčů
- `src/scene.js` 3D scéna (three.js), míčky s obličeji, pasti, kamera
- `src/main.js` UI, místnost přes mantledb (`src/net.js`), přehrávání úderů
- `index.html` styly a kostra, `docs/worklog.md` deník práce
