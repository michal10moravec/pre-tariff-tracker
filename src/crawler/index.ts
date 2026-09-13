import { chromium, Page } from 'playwright'
import { load } from 'cheerio'
import { Config, HDO_PAGE, PRE_LOGIN_PAGE } from '../config'
import { DaySchedule, ScraperError } from '../model'
import { dateKey } from '../time'
import login from './login'
import { parseHdo } from './parser'

export async function extractAccountDays(
    page: Page,
    dates: string[]
): Promise<DaySchedule[]> {
    const component = page
        .locator('#component-hdo')
        .or(
            page.locator('.componentIdent').filter({
                has: page.getByRole('heading', { name: /Časy spínání/i }),
            })
        )
        .first()
    await component.waitFor({ state: 'visible' })
    await component
        .locator('.hdo-bar [title]')
        .first()
        .waitFor({ state: 'attached' })
    // Refuse an unrelated appliance command or ambiguous selection.
    const radios = component.locator('input[name="hdoInstruction"]')
    if (await radios.count()) {
        const selected = await radios.evaluateAll((inputs) =>
            inputs
                .filter((i) => (i as HTMLInputElement).checked)
                .map((i) => {
                    const label = document.querySelector(`label[for="${i.id}"]`)
                    return label?.textContent || ''
                })
        )
        if (selected.length !== 1 || !/\bNT\b|nízk/i.test(selected[0]!))
            throw new ScraperError(
                'TARIFF_SELECTION',
                'V Moje PRE není jednoznačně vybrán povel nízkého tarifu. Nastavte HDO_CODE podle povelu pro NT v účtu.'
            )
    }
    const output: DaySchedule[] = []
    for (let i = 0; i < dates.length; i++) {
        const day = i === 0 ? 'dnes' : 'zitra'
        // Prefer the tab's own target; retain existing IDs as a fallback.
        const tab = component
            .getByRole('link', { name: i === 0 ? /^Dnes$/ : /^Zítra$/ })
            .or(
                component.getByRole('tab', {
                    name: i === 0 ? /^Dnes$/ : /^Zítra$/,
                })
            )
            .first()
        let target = `component-hdo-${day}`
        if (await tab.count()) {
            const detected = await tab.evaluate(
                (el) =>
                    el.getAttribute('aria-controls') ||
                    el.closest('[data-tab]')?.getAttribute('data-tab')
            )
            if (detected && /^[\w-]+$/.test(detected)) target = detected
            // Both days are already rendered on current PRE. Click only for lazy loading.
            if (
                !(await component
                    .locator(`#${target} .hdo-bar [title]`)
                    .count())
            )
                await tab.click()
        }
        const panel = component.locator(`#${target}`)
        await panel
            .locator('.hdo-bar [title]')
            .first()
            .waitFor({ state: 'attached' })
        output.push({
            date: dates[i]!,
            low: parseHdo(await panel.innerHTML(), dates[i]),
            fetchedAt: new Date().toISOString(),
        })
    }
    return output
}

async function account(config: Config, dates: string[]) {
    if (!config.username || !config.password)
        throw new ScraperError(
            'CONFIG',
            'Doplňte PRE_USERNAME a PRE_PASSWORD nebo HDO_CODE do souboru .env.'
        )
    let browser
    try {
        browser = await chromium.launch({
            executablePath: config.executablePath,
            headless: config.headless,
            timeout: config.timeoutMs,
        })
    } catch {
        throw new ScraperError(
            'BROWSER',
            'Chromium nelze spustit. Spusťte npm run browser:install nebo nastavte BROWSER_EXECUTABLE_PATH. V omezeném prostředí spusťte aplikaci z běžného Terminálu.'
        )
    }
    // Absolute deadline also closes a browser stuck between multiple page waits.
    const deadline = setTimeout(() => {
        void browser.close().catch(() => {})
    }, config.timeoutMs * 3)
    try {
        const page = await browser.newPage({
            viewport: { width: 1440, height: 1000 },
            locale: 'cs-CZ',
            timezoneId: 'Europe/Prague',
        })
        page.setDefaultTimeout(config.timeoutMs)
        await page.goto(PRE_LOGIN_PAGE, { waitUntil: 'domcontentloaded' })
        await login(page, config)
        const schedules = await extractAccountDays(page, dates)
        if (dateKey() !== dates[0])
            throw new ScraperError(
                'DATE_CHANGED',
                'Během načítání nastal nový den; data se načtou znovu.'
            )
        return schedules
    } finally {
        clearTimeout(deadline)
        await browser.close()
    }
}

async function fetchText(url: string, config: Config, init: RequestInit = {}) {
    const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(config.timeoutMs),
        redirect: 'error',
    })
    if (!response.ok)
        throw new ScraperError(
            'PRE_UNAVAILABLE',
            `PREdistribuce odpověděla stavem HTTP ${response.status}.`
        )
    const text = await response.text()
    if (text.length > 2_000_000)
        throw new ScraperError(
            'HTML_CHANGED',
            'PRE vrátilo neobvykle velkou odpověď.'
        )
    return text
}
async function distribution(config: Config, dates: string[]) {
    const html = await fetchText(HDO_PAGE, config)
    const $ = load(html)
    const option = $('select[name="povel"] option').filter(
        (_i, e) => $(e).attr('value') === config.hdoCode
    )
    if (option.length !== 1)
        throw new ScraperError(
            'HDO_CODE',
            'Povel HDO není v nabídce PREdistribuce. Ověřte HDO_CODE; TOU/AMM tabulky tato volba nepodporuje.'
        )
    if (!/\bNT\b|tarif|Elektromobil|Emob/i.test(option.text()))
        throw new ScraperError(
            'HDO_CODE',
            'Vybraný povel patří spotřebiči. Použijte povel pro nízký tarif (NT).'
        )
    if (!html.includes('/com/PREdi/UI/Forms/Hdo/HdoForm:'))
        throw new ScraperError(
            'HTML_CHANGED',
            'Rozhraní PREdistribuce se změnilo.'
        )
    const result: DaySchedule[] = []
    for (const date of dates) {
        const [year, month, day] = date.split('-')
        const body = new URLSearchParams({
            datum: `${day}.${month}.${year}`,
            povel: config.hdoCode,
            povelTitle: option.text().trim(),
        })
        const raw = await fetchText(
            'https://www.predistribuce.cz/com/PREdi/UI/Forms/Hdo/HdoForm:hdoOneDayAjax',
            config,
            { method: 'POST', body }
        )
        let data: unknown
        try {
            data = JSON.parse(raw)
        } catch {
            throw new ScraperError(
                'HTML_CHANGED',
                'PREdistribuce nevrátila očekávanou odpověď JSON.'
            )
        }
        if (!data || typeof (data as { html?: unknown }).html !== 'string')
            throw new ScraperError(
                'HTML_CHANGED',
                'V odpovědi PREdistribuce chybí rozvrh.'
            )
        result.push({
            date,
            low: parseHdo((data as { html: string }).html, date),
            fetchedAt: new Date().toISOString(),
        })
    }
    return result
}
export default async function crawl(config: Config, dates: string[]) {
    try {
        return await (config.hdoCode
            ? distribution(config, dates)
            : account(config, dates))
    } catch (error) {
        if (error instanceof ScraperError) throw error
        // Never propagate Playwright call logs: they can contain fill() arguments.
        throw new ScraperError(
            'PRE_UNAVAILABLE',
            'Načítání PRE selhalo nebo vypršel časový limit. Zkuste to později; při trvalém problému ověřte strukturu webu a připojení.'
        )
    }
}
