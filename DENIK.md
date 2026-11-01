# Deník – Jamka na míru

PŘEVZATO 1. 11. – kolo vylepšení, session jamka-kolo (Claude); jiná session sem nepíše.
PŘEVZATO 31. 10. – dodělává session na účtu P, jiná session sem nepíše.

- 31. 10. ~19:30: jádro (sim.js), 3D scéna, UI a místnost napsané, zatím nespuštěné. Předávka v docs/worklog.md.
- 31. 10. ~20:00: první běh v prohlížeči, opravy, manifest + ikony, rendery A/B v design/. Detail v docs/worklog.md.
- 31. 10. ~22:00: návrh A vybrán, B smazán, opravy design-eye 1-8, testy sim/duel/perf, nové rendery. Detail v docs/worklog.md.
- 1. 11. nasazení: veřejné repo `sachasportrezervace-arch/jamka-na-miru`, větev `main`, GitHub Pages z `main` / root.
  **Živá URL: https://sachasportrezervace-arch.github.io/jamka-na-miru/**
  Ověřeno před pushem (lokálně, server 8808): `node tests/duel.cjs` exit 0 (36/36 PASS), `node tests/perf.cjs` exit 0 (bez chyb v konzoli).
  Ověřeno živě: `curl` 200 pro stránku, `src/sim.js`, `vendor/three.module.min.js`, `manifest.webmanifest`;
  `node tests/duel.cjs <živá URL>` exit 0 (36/36 PASS, 3 prohlížeče, skutečný mantledb); `node tests/solo.cjs <živá URL>` exit 0 (34 PASS, 0 FAIL).
  Kontrola repa: žádná tajemství ani `.env*`, největší soubor vendor/three.module.min.js 676 kB, `tests/shots` 3,6 MB a `design/` 6,3 MB zůstaly v repu; přidán `.gitignore`.
  Zbývá / NEOVĚŘENO: reálný iPhone (perf běžel jen v emulovaném WebKitu, ~18 FPS v softwarovém vykreslování, orientačně); instalace na plochu iOS; ostrá hra dvou lidí přes skutečnou síť mimo test.
