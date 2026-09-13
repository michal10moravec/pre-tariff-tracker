import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Cache, validateIntervals } from '../model'
import { isDate } from '../time'
export function validateCache(value: unknown): asserts value is Cache {
    const c = value as Cache
    if (
        !c ||
        c.version !== 1 ||
        typeof c.source !== 'string' ||
        !c.days ||
        typeof c.days !== 'object' ||
        Array.isArray(c.days)
    )
        throw new Error('Neplatný formát cache')
    for (const [key, day] of Object.entries(c.days)) {
        if (
            !isDate(key) ||
            !day ||
            key !== day.date ||
            typeof day.fetchedAt !== 'string' ||
            !Number.isFinite(Date.parse(day.fetchedAt))
        )
            throw new Error('Neplatný záznam cache')
        validateIntervals(day.low)
    }
}
export class CacheStore {
    constructor(
        public file: string,
        public source: string
    ) {}
    async read(): Promise<Cache> {
        const empty: Cache = { version: 1, source: this.source, days: {} }
        try {
            const cache: unknown = JSON.parse(
                await fs.readFile(this.file, 'utf8')
            )
            validateCache(cache)
            if (cache.source === this.source) return cache
            await fs.rename(
                this.file,
                `${this.file}.source-${Date.now()}-${randomUUID()}`
            )
            console.warn(
                'Zdroj dat se změnil; původní cache byla odložena do souboru .source.'
            )
            return empty
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty
            if (
                error instanceof SyntaxError ||
                (error instanceof Error && !('code' in error))
            ) {
                // Keep the original bytes for recovery; never silently overwrite damaged history.
                await fs.rename(
                    this.file,
                    `${this.file}.corrupt-${Date.now()}-${randomUUID()}`
                )
                console.warn(
                    'Poškozená cache byla odložena do souboru .corrupt; data načteme z PRE znovu.'
                )
                return empty
            }
            throw error
        }
    }
    async write(cache: Cache) {
        validateCache(cache)
        await fs.mkdir(path.dirname(this.file), { recursive: true })
        const temp = `${this.file}.${randomUUID()}.tmp`
        try {
            await fs.writeFile(temp, JSON.stringify(cache, null, 2) + '\n', {
                mode: 0o600,
                flag: 'wx',
            })
            await fs.rename(temp, this.file)
        } finally {
            await fs.rm(temp, { force: true })
        }
    }
}
