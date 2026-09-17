# Vzhled domácích aplikací

Sjednoceno 17. 9. 2026: Pračka, PRE, Myčka a Rolety. Hlavička obsahuje pouze ikonu zařízení a krátký název, vedle zůstává dostupnost nebo navigace aplikace. Základ tvoří tmavá zelená #102e34, akcent #348779, pozadí #edf2f4, světlé karty a systémové písmo. Rozvržení respektuje rozdílné funkce aplikací.

Sdílený vzhled je uložen jako home-ui.css v každém projektu (PRE public/, Myčka src/client/public/, Pračka a Rolety web/). Při společné změně aktualizovat všechny čtyři kopie. SVG ikona patří do hlavičky/prohlížeče, PNG 180 do apple-touch-icon, PNG 192/512 do manifestu pro plochu telefonu. Manifest používá krátký název a režim standalone. Dostupnost instalace přes HTTP závisí na prohlížeči; nebyl přidán service worker ani offline cache stavů zařízení.

Nasazení všech aplikací je zálohované na Pi v /opt/lg-local/backups/home-design-20260917/apps.tar. Ověřeny názvy, ikonové HTTP odpovědi a PNG rozměry, mobilní šířka 390 px bez vodorovného přetékání, desktop 1200 px a absence chyb JavaScriptu. Testy: Pračka 25, PRE 24, Myčka 6, Rolety 13 backend + 7 frontend. Kontrola UI neposílala ovládací příkazy.

PRE generuje src/server/assets.ts při npm run build pomocí scripts/build-assets.mjs z public/. V Myčce balí public/ Vite. Pračka a Rolety mají explicitní seznam statických cest na serveru. Při aktualizaci starého zástupce na telefonu může být nutné odebrání a nové přidání na plochu.
