import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { loadConfig, PRE_LOGIN_PAGE } from '../../src/config'
import login from '../../src/crawler/login'
import dismissCookies from '../../src/crawler/cookies'
import { extractAccountDays } from '../../src/crawler'
const loginHtml = `<div role="dialog" id="cookie-dialog"><button id="CybotCookiebotDialogBodyButtonDecline" onclick="document.getElementById('cookie-dialog').remove()">Odmítnout volitelné cookies</button></div><form action="/cs/moje-pre/prihlaseny-uzivatel/uvod-prehled-uctu/"><label for="changed-user-id">Přihlašovací jméno</label><input id="changed-user-id" name="login_name"><label for="changed-password-id">Heslo</label><input id="changed-password-id" name="login_password" type="password"><button>Přihlásit</button></form>`
test('real browser: cookies before login, changed IDs, existing day panels', async () => {
    const browser = await chromium.launch()
    try {
        const page = await browser.newPage()
        const today = await fs.readFile(
                'tests/fixtures/account-today.html',
                'utf8'
            ),
            tomorrow = await fs.readFile(
                'tests/fixtures/account-tomorrow.html',
                'utf8'
            )
        await page.route('https://www.pre.cz/**', (route) =>
            route.fulfill({
                contentType: 'text/html',
                body: route.request().url().includes('/neprihlaseny-uzivatel/')
                    ? loginHtml
                    : `<section id="component-hdo"><h3>Časy spínání</h3><a href="#">Dnes</a><a href="#">Zítra</a>${today}${tomorrow}</section>`,
            })
        )
        await page.goto(PRE_LOGIN_PAGE)
        await login(
            page,
            loadConfig({
                PRE_USERNAME: 'fixture-user',
                PRE_PASSWORD: 'fixture-password',
            })
        )
        assert.equal(await page.locator('#cookie-dialog').count(), 0)
        const days = await extractAccountDays(page, [
            '2026-09-13',
            '2026-09-14',
        ])
        assert.deepEqual(days[0]!.low, [
            { start: '03:40', end: '06:40' },
            { start: '12:40', end: '17:40' },
        ])
        assert.equal(days[1]!.low[0]!.start, '01:00')
        await page.setContent('<h1>Bez dialogu cookies</h1>')
        await dismissCookies(page)
    } finally {
        await browser.close()
    }
})
