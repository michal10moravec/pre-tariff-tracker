import dotenv from 'dotenv'
import path from 'node:path'
import { createHash } from 'node:crypto'
dotenv.config({ path: process.env.ENV_FILE || '.env' })
function integer(
    env: NodeJS.ProcessEnv,
    name: string,
    fallback: number,
    min: number,
    max: number
) {
    const raw = env[name]?.trim()
    const value = raw ? Number(raw) : fallback
    if (!Number.isInteger(value) || value < min || value > max)
        throw new Error(`${name} musí být celé číslo ${min}–${max}.`)
    return value
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
    const username = env.PRE_USERNAME?.trim() || ''
    const password = env.PRE_PASSWORD || ''
    const hdoCode = env.HDO_CODE?.trim() || ''
    if (hdoCode && !/^\d{3}$/.test(hdoCode))
        throw new Error('HDO_CODE musí být třímístný povel přijímače HDO.')
    if (
        env.BROWSER_HEADLESS &&
        !['true', 'false'].includes(env.BROWSER_HEADLESS)
    )
        throw new Error('BROWSER_HEADLESS musí být true nebo false.')
    return {
        username,
        password,
        hdoCode,
        source: hdoCode
            ? `hdo:${hdoCode}`
            : `account:${createHash('sha256').update(username).digest('hex')}`,
        host: env.SERVER_HOST?.trim() || '127.0.0.1',
        port: integer(env, 'SERVER_PORT', 3000, 1, 65535),
        timeoutMs: integer(env, 'REQUEST_TIMEOUT_SECONDS', 45, 5, 180) * 1000,
        refreshMs: integer(env, 'REFRESH_MINUTES', 60, 5, 1440) * 60_000,
        retryMs: integer(env, 'RETRY_MINUTES', 5, 1, 1440) * 60_000,
        cachePath: path.resolve(env.CACHE_FILE || 'data/schedules.json'),
        executablePath: env.BROWSER_EXECUTABLE_PATH || undefined,
        headless: env.BROWSER_HEADLESS !== 'false',
    }
}
export type Config = ReturnType<typeof loadConfig>
export const PRE_LOGIN_PAGE =
    'https://www.pre.cz/cs/moje-pre/neprihlaseny-uzivatel/prihlaseni-uzivatele/'
export const HDO_PAGE =
    'https://www.predistribuce.cz/cs/potrebuji-zaridit/zakaznici/stav-hdo/'
