import { Page, errors } from 'playwright'
export default async function dismissCookies(page: Page) {
    const decline = page
        .getByRole('button', {
            name: /^(Odmítnout(?: volitelné cookies)?|Pouze nezbytné|Reject all)$/i,
        })
        .or(page.locator('#CybotCookiebotDialogBodyButtonDecline'))
        .first()
    try {
        await decline.waitFor({ state: 'visible', timeout: 5000 })
    } catch (error) {
        if (error instanceof errors.TimeoutError) return
        throw error
    }
    await decline.click()
    await decline.waitFor({ state: 'hidden' })
}
