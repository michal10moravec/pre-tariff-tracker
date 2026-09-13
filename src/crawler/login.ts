import { Page } from 'playwright'
import { Config } from '../config'
import { ScraperError } from '../model'
import dismissCookies from './cookies'
export default async function login(page: Page, config: Config) {
    await dismissCookies(page)
    const username = page
        .getByLabel(/Přihlašovací jméno/i)
        .or(page.locator('input[name="login_name"]'))
        .first()
    const password = page
        .getByLabel(/^Heslo$/i)
        .or(page.locator('input[name="login_password"]'))
        .first()
    await username.fill(config.username)
    await password.fill(config.password)
    const submit = page
        .getByRole('button', { name: /^Přihlásit(?: se)?$/i })
        .or(
            page.locator(
                'form[name="pre_loginForm_subPage"] input[type="submit"]'
            )
        )
        .first()
    await submit.click()
    try {
        await page.waitForURL(
            (url) =>
                url.origin === 'https://www.pre.cz' &&
                url.pathname.includes('/prihlaseny-uzivatel/')
        )
    } catch {
        throw new ScraperError(
            'LOGIN_FAILED',
            'Přihlášení do PRE se nepodařilo. Zkontrolujte údaje v .env; pokud PRE vyžaduje CAPTCHA, přihlaste se ručně v režimu BROWSER_HEADLESS=false.'
        )
    }
}
