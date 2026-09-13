import { Config } from '../config'
import { CacheStore } from '../files'
import { Cache, DaySchedule, ScraperError, validateIntervals } from '../model'
import { targetDates } from '../time'
export type Status = { code: string; message: string; at: string }
export class ScheduleService {
    cache: Cache
    error?: Status
    private inFlight?: Promise<void>
    private retryAt = 0
    private lastAttempt = 0
    constructor(
        private config: Config,
        private store: CacheStore,
        private crawler: (dates: string[]) => Promise<DaySchedule[]>,
        private now = () => new Date()
    ) {
        this.cache = { version: 1, source: config.source, days: {} }
    }
    async init() {
        this.cache = await this.store.read()
    }
    isStale(day: DaySchedule | undefined) {
        return (
            !day ||
            this.now().getTime() - Date.parse(day.fetchedAt) >=
                this.config.refreshMs ||
            Date.parse(day.fetchedAt) > this.now().getTime() + 60_000
        )
    }
    snapshot() {
        const dates = targetDates(this.now())
        return {
            dates,
            days: dates.map((date) => this.cache.days[date] || null),
            stale: dates.some((date) => this.isStale(this.cache.days[date])),
            refreshing: !!this.inFlight,
            error: this.error || null,
        }
    }
    refresh(force = false): Promise<void> {
        if (this.inFlight) return this.inFlight
        const now = this.now().getTime()
        if (now < this.retryAt || (force && now - this.lastAttempt < 60_000))
            return Promise.resolve()
        if (!force && !this.snapshot().stale) return Promise.resolve()
        this.lastAttempt = now
        this.inFlight = this.performRefresh().finally(() => {
            this.inFlight = undefined
        })
        return this.inFlight
    }
    private async performRefresh() {
        const dates = targetDates(this.now())
        try {
            const result = await this.crawler(dates)
            if (
                result.length !== dates.length ||
                new Set(result.map((x) => x.date)).size !== dates.length ||
                !dates.every((date) => result.some((x) => x.date === date))
            )
                throw new ScraperError(
                    'INVALID_SCHEDULE',
                    'PRE nevrátilo oba požadované dny.'
                )
            for (const day of result) validateIntervals(day.low)
            const cache: Cache = {
                ...this.cache,
                days: {
                    ...this.cache.days,
                    ...Object.fromEntries(result.map((day) => [day.date, day])),
                },
            }
            await this.store.write(cache)
            this.cache = cache
            this.error = undefined
            this.retryAt = 0
        } catch (error) {
            this.error = {
                code:
                    error instanceof ScraperError
                        ? error.code
                        : 'UPDATE_FAILED',
                message:
                    error instanceof ScraperError
                        ? error.message
                        : 'Aktualizace nebo uložení dat selhalo. Poslední uložená data zůstávají dostupná.',
                at: this.now().toISOString(),
            }
            this.retryAt = this.now().getTime() + this.config.retryMs
            console.warn(
                `[${this.error.at}] ${this.error.code}: ${this.error.message}`
            )
        }
    }
    async settle() {
        await this.inFlight
    }
}
