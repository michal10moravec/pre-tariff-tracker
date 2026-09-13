# PRE scraper

Malá aplikace pro přehled časů nízkého tarifu PRE. Zobrazuje dnešek, zítřek a uloženou historii. Funguje na Macu i jako dlouhodobě běžící služba na Raspberry Pi. Rozhraní je v češtině a přizpůsobuje se telefonu i počítači.

**Jde o plán spínání, nikoli měření skutečného stavu elektroměru.** PRE může časy během dne změnit. Označení „právě je plánován nízký tarif“ vychází z posledního aktuálního rozvrhu, nikoli ze signálu HDO.

## Dva způsoby načítání

| Režim | Co potřebuje | Jak funguje |
| --- | --- | --- |
| PREdistribuce, doporučeno pro známý povel HDO | `HDO_CODE` pro nízký tarif | Načítá veřejné rozhraní PREdistribuce přímo přes HTTP. Nepotřebuje přihlášení ani spuštěné Chromium. |
| Moje PRE | `PRE_USERNAME`, `PRE_PASSWORD`, Chromium | Přihlásí se přes Playwright a přečte rozvrhy z portálu Moje PRE. |

Vyplněný `HDO_CODE` má přednost před přihlašovacími údaji. Použijte **povel pro nízký tarif (NT)**, nikoli povel pro odblokování spotřebiče. Je uveden v Moje PRE u časů spínání nebo na přijímači HDO. Například `556` je jeden z povelů pro NT; použijte jej pouze tehdy, patří-li vašemu odběrnému místu.

Veřejné rozhraní je součást webu PREdistribuce, **není to garantované veřejné API**. Při změně jeho struktury aplikace zobrazí chybu a zachová poslední úspěšně uložená data. Nepřepíná automaticky na jiný povel nebo jiný zdroj.

Režim Moje PRE pracuje s odběrným místem, které portál po přihlášení zobrazí jako výchozí. Pokud máte více odběrných míst, použijte raději konkrétní povel `HDO_CODE`. Automatický výběr odběrného místa není implementován. TOU/AMM tabulky z Excelu nejsou podporovány veřejným HDO režimem; účetní režim umí jen rozvrh se stejným označením NT/VT jako HDO.

## Rychlé spuštění na Macu

Potřebujete Node.js **22 nebo novější** a npm. Soubor `.nvmrc` vybírá Node 22, pokud používáte nvm.

```sh
cd ~/Documents/pre-scraper
npm ci
```

Pokud ještě nemáte `.env`, vytvořte jej ze vzoru. Existující soubor nepřepisujte:

```sh
cp -n .env.example .env
```

V `.env` vyplňte jednu z variant. Pro známý povel stačí například:

```dotenv
HDO_CODE=556
```

Při použití účtu ponechte `HDO_CODE` prázdné a doplňte:

```dotenv
PRE_USERNAME="vaše přihlašovací jméno"
PRE_PASSWORD="vaše heslo"
```

Jen pro režim Moje PRE nainstalujte prohlížeč:

```sh
npm run browser:install
```

Ověřte připojení, sestavte aplikaci a spusťte ji:

```sh
npm run test:live
npm run build
npm start
```

Otevřete adresu vypsanou po spuštění, standardně **http://127.0.0.1:3000**. Pokud je port obsazený, nastavte v `.env` například `SERVER_PORT=3030` a aplikaci spusťte znovu. Zastavení: `Ctrl+C`.

Pro vývoj místo sestavení a startu použijte `npm run dev`. Změny TypeScriptu automaticky restartují server. Po změně `.env` restartujte aplikaci ručně.

## Ověření na telefonu

Pro přístup z telefonu ve stejné domácí síti nastavte `SERVER_HOST=0.0.0.0`, restartujte server a v telefonu otevřete `http://IP_ADRESA_MACU:PORT`. Telefon musí být ve stejné síti a firewall musí příchozí spojení umožňovat. `0.0.0.0` je adresa pro naslouchání serveru, nikoli adresa zadávaná do telefonu.

Aplikace nemá vlastní přihlášení ani HTTPS. Výchozí `127.0.0.1` zpřístupňuje data pouze na daném počítači; `0.0.0.0` je zpřístupní síti. Nevystavujte tento server přímo na internet. Pro vzdálený přístup použijte zabezpečenou privátní síť. Změna rozvrhů u PRE ani ovládání spotřebičů není součástí aplikace.

## Konfigurace

Proměnné nastavené v prostředí procesu mají přednost před `.env`. Prázdná volitelná hodnota použije výchozí nastavení.

| Proměnná | Výchozí hodnota | Význam |
| --- | --- | --- |
| `HDO_CODE` | prázdné | Třímístný povel pro NT; aktivuje veřejné načítání. |
| `PRE_USERNAME` | prázdné | Jméno pro Moje PRE. Nutné bez `HDO_CODE`. |
| `PRE_PASSWORD` | prázdné | Heslo pro Moje PRE. Nutné bez `HDO_CODE`. |
| `SERVER_HOST` | `127.0.0.1` | Adresa, na níž server naslouchá. |
| `SERVER_PORT` | `3000` | Port 1–65535. |
| `REFRESH_MINUTES` | `60` | Stáří dat, po kterém se mají obnovit; rozsah 5–1440 minut. |
| `RETRY_MINUTES` | `5` | Prodleva po neúspěšném pokusu; rozsah 1–1440 minut. |
| `REQUEST_TIMEOUT_SECONDS` | `45` | Limit jednoho HTTP požadavku / kroku prohlížeče; rozsah 5–180 sekund. Celý běh prohlížeče má limit trojnásobku. |
| `CACHE_FILE` | `data/schedules.json` | Soubor s rozvrhy a historií, relativně k pracovní složce procesu. |
| `BROWSER_HEADLESS` | `true` | `false` zobrazí okno Chromia pro diagnostiku přihlášení. |
| `BROWSER_EXECUTABLE_PATH` | prázdné | Vlastní Chromium, například `/usr/bin/chromium` na Raspberry Pi. |
| `ENV_FILE` | `.env` | Alternativní konfigurační soubor; nastavuje se v prostředí při spuštění. |

Datum, dnešek/zítřek a časy v UI se vždy počítají v pásmu **Europe/Prague**, včetně změny letního času. Hodiny počítače musí být správně nastavené. Záloha `data/` uchová historii. `.env`, data, diagnostické pracovní soubory a lokální prohlížeče se neukládají do Gitu. Hesla s `#` nebo mezerami uzavřete do uvozovek. Aplikace nevypisuje přihlašovací údaje ani syrové chyby Playwrightu a neukládá přihlášenou relaci.

## Aktualizace, cache a historie

- Server je dostupný ihned; data se načítají na pozadí při startu, při otevření přehledu a během kontroly každou minutu. PRE se kontaktuje pouze tehdy, když některý den chybí nebo vypršel interval obnovy.
- Tlačítko **Aktualizovat** požádá o nové načtení. Ruční pokusy mají minimální odstup jednu minutu a respektují prodlevu po chybě. Více současných návštěvníků sdílí jedno načítání.
- Při výpadku se zobrazí poslední data, čas jejich načtení a chyba. Neověřená data nejsou označena za aktuální. Chybějící den zůstane viditelně prázdný.
- Zápis proběhne až po ověření obou dnů, přes dočasný soubor a atomické přejmenování. Při chybě aktualizace se dobrá cache nenahrazuje chybnou odpovědí.
- Poškozená cache se odloží do souboru `.corrupt-*`. Při změně účtu nebo povelu se stará cache odloží do `.source-*`, aby se rozvrhy nesmíchaly.
- Historie se ukládá postupně od prvního běhu. Aplikace nedoplňuje starší dny zpětně a historii automaticky nemaže. Historický rozvrh je poslední uložená verze, nikoli potvrzení skutečného vysílání HDO.
- Pro jeden soubor cache spouštějte jen jednu instanci aplikace. Více nezávislých instancí musí mít různý `CACHE_FILE`.
- Otevřená stránka se obnovuje každou minutu, při probíhajícím načítání každé tři sekundy. Po návratu na skrytou kartu se také obnoví. Bez JavaScriptu lze stránku obnovit ručně.

Původní `times.json` z verze 2023 se **nepřepisuje ani automaticky neimportuje**. Obsahoval pouze textové intervaly bez informace o zdroji, stáří a ověření NT/VT; nová verze používá samostatný soubor `data/schedules.json`.

## Stránky a rozhraní

| Cesta | Metoda | Obsah |
| --- | --- | --- |
| `/` | GET | Dnes a zítra, stav podle plánu, čas aktualizace. |
| `/history` | GET | Uložené dny od nejnovějšího. |
| `/api/times` | GET | JSON: `dates`, `days`, `stale`, `refreshing`, `error`. Den obsahuje `date`, `low: [{start, end}]`, `fetchedAt`; chybějící den je `null`. |
| `/health` | GET | Živost serveru a aktuální stav dat. HTTP 200 znamená běžící server, ne nutně aktuální data. |
| `/refresh` | POST | Požadavek na aktualizaci a přesměrování zpět. Akceptuje pouze požadavky z vlastního HTTP původu aplikace. |

`/api/times` vrací HTTP 503, pokud chybí některý požadovaný den; u uložených, ale starých dat vrací 200 s `stale: true`. Před použitím dat pro další automatizaci kontrolujte také `error` a `fetchedAt`. `end: "24:00"` znamená konec dne. Prázdné `low` znamená ověřený celodenní vysoký tarif, nikoli chybějící data. Časy jsou místní časy Prahy; `fetchedAt` je ISO čas s časovým pásmem.

## Testování

```sh
npm run check       # kontrola TypeScriptu
npm test            # jednotkové a HTTP integrační testy; bez účtu, internetu a Chromia
npm run build       # sestavení do build/
npm run browser:install
npm run test:browser # prohlížečový test na lokálně podvržených stránkách, bez účtu PRE
npm run test:live    # skutečné načtení vybraným režimem; nezapisuje cache
```

Testy pokrývají skutečné anonymizované ukázky HTML z PRE, různé počty intervalů, půlnoc `00:00`/`24:00`, označení NT/VT, jiné tooltip atributy, neúplná data, datum a součet hodin. Dále ověřují souběžné požadavky, obnovování a výpadky, poškozenou cache, chybu zápisu, oddělení zdrojů, časové pásmo, přechody letního času, HTTP rozhraní a escapování chyb v HTML.

Prohlížečový test prověřuje cookies před přihlášením, změněná ID přihlašovacích polí, vyčtení obou panelů a nepřítomný cookie dialog. Síťové požadavky PRE v něm nahrazuje testovací HTML. Skutečné přihlášení se testuje odděleně:

```sh
HDO_CODE= BROWSER_HEADLESS=false npm run test:live
```

Při požadavku na CAPTCHA ji řeší uživatel v otevřeném okně; aplikace ji neobchází. Případně zvyšte `REQUEST_TIMEOUT_SECONDS` pro ruční interakci. Relace se po testu uzavře.

CI v `.github/workflows/test.yml` spouští kontrolu, sestavení, testy a prohlížečový test na Node 22 a 24. Nepotřebuje tajné údaje PRE. Test vůči živému webu je úmyslně ruční.

## Když něco nefunguje

| Problém | Co ověřit |
| --- | --- |
| Server nelze spustit | Správné `SERVER_HOST`, volný port a případný jiný běžící proces. |
| `CONFIG` | Doplňte `HDO_CODE` nebo oba přihlašovací údaje. |
| `BROWSER` | Nainstalujte Chromium, ověřte cestu. Pokud prostředí blokuje spuštění prohlížeče, spusťte test v běžném Terminálu; samotné `npm ci` prohlížeč nenainstaluje. |
| `LOGIN_FAILED` | Ověřte údaje přihlášením na webu PRE; zkuste viditelné Chromium kvůli CAPTCHA nebo novému dialogu. |
| `HDO_CODE` / `TARIFF_SELECTION` | Zkontrolujte správný povel pro nízký tarif, ne spotřebič či TOU ID. |
| `HTML_CHANGED`, `WRONG_DATE`, `INVALID_SCHEDULE` | Porovnejte s aktuálním webem PRE. Parser raději odmítne nejednoznačná data, než aby zobrazil nesprávné časy. |
| `PRE_UNAVAILABLE` | Připojení, dostupnost PRE, časový limit. Automatický další pokus respektuje `RETRY_MINUTES`. |
| `UPDATE_FAILED` | Dostatek místa a oprávnění pro soubor cache; dobrá data v paměti zůstávají. |

Po aktualizaci Playwrightu znovu spusťte `npm run browser:install`, pokud používáte účetní režim nebo prohlížečové testy.

## Raspberry Pi – příprava pro pozdější nasazení

Nejprve otestujte stejné nastavení na Macu. Na Pi použijte 64bitový systém, Node 22+ a kopii projektu například v `~/pre-scraper`. `.env` vytvořte zvlášť; není součástí Gitu. Pro známý povel stačí veřejný HDO režim bez Chromia, což šetří paměť a zjednodušuje provoz.

```sh
cd ~/pre-scraper
npm ci
npm run check
npm test
npm run build
npm run test:live
```

Pro režim Moje PRE musí být k dispozici Chromium kompatibilní s daným systémem. Pokud použijete systémový prohlížeč, ověřte `command -v chromium` a nastavte jeho absolutní cestu v `BROWSER_EXECUTABLE_PATH`. Přesný způsob instalace závisí na verzi Raspberry Pi OS; kompatibilitu je potřeba ověřit na konkrétním zařízení.

Soubor `pre.service` je **šablona uživatelské systemd služby**. Upravte `WorkingDirectory` a `ExecStart`: cesta k Node musí odpovídat výstupu `command -v node`, zvlášť při instalaci přes nvm. Potom:

```sh
mkdir -p ~/.config/systemd/user
cp pre.service ~/.config/systemd/user/pre-scraper.service
systemctl --user daemon-reload
systemctl --user enable --now pre-scraper
systemctl --user status pre-scraper
journalctl --user -u pre-scraper -f
```

Chcete-li službu provozovat po odhlášení a při startu zařízení, povolte pro daného uživatele linger: `sudo loginctl enable-linger "$USER"`. Zastavení: `systemctl --user stop pre-scraper`. Při aktualizaci nejprve službu zastavte, nainstalujte závislosti, spusťte testy, sestavte a poté ji znovu spusťte. Nevytvářejte zároveň druhou instanci sdílející cache.

Nasazení na Raspberry Pi není součástí lokálního spuštění a musí se ověřit přímo na Pi.

## Struktura projektu

- `src/config/` – načtení a ověření konfigurace.
- `src/crawler/` – přihlášení, cookies, oba zdroje dat a společný parser HTML.
- `src/service/` – obnova dat, sdílení probíhajícího požadavku a prodleva po chybách.
- `src/files/` – kontrola a atomický zápis cache.
- `src/time/` – kalendářní dny a časy v Praze.
- `src/server/` – HTTP rozhraní, responzivní HTML, CSS a malý skript pro obnovu.
- `tests/` – automatické testy a ukázky HTML bez přihlašovacích a zákaznických údajů.

Při opravě po změně webu nejprve zaznamenejte minimální anonymizovaný příklad HTML do `tests/fixtures`, napište regresní test a upravte parser nebo lokátory. Nikdy neukládejte celou přihlášenou stránku, cookies ani hesla do repozitáře. Parser se opírá o význam NT/VT, pokrytí celého dne a kontrolu součtu; nezávisí na pořadí dvou vybraných intervalů ani na pixelové poloze prvků.

## Zdroje a licence

- [PRE: časy spínání HDO](https://www.pre.cz/cs/domacnosti/sluzby-zakaznikum/co-delat-kdyz/hdo/)
- [PREdistribuce: HDO a TOU tabulky](https://www.predistribuce.cz/cs/potrebuji-zaridit/zakaznici/stav-hdo/)
- [Playwright: instalace prohlížečů](https://playwright.dev/docs/browsers)

Licenční text je v souboru `LICENSE`. Původní repozitář obsahoval Apache License 2.0, zatímco `package.json` uváděl MIT; metadata byla sjednocena s existujícím licenčním souborem.
