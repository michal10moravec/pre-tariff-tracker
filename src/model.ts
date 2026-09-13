export type Interval = { start: string; end: string }
export type DaySchedule = {
    date: string
    low: Interval[]
    fetchedAt: string
}
export type Cache = {
    version: 1
    source: string
    days: Record<string, DaySchedule>
}
export class ScraperError extends Error {
    constructor(
        public code: string,
        message: string
    ) {
        super(message)
    }
}
export const minutes = (time: string) => {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(time))
        throw new Error('Neplatný čas')
    const [hours, mins] = time.split(':').map(Number)
    return hours! * 60 + mins!
}
export function validateIntervals(value: unknown): asserts value is Interval[] {
    if (!Array.isArray(value)) throw new Error('Neplatné intervaly')
    let end = 0
    for (const interval of value) {
        if (
            !interval ||
            typeof interval.start !== 'string' ||
            typeof interval.end !== 'string'
        )
            throw new Error('Neplatný interval')
        const start = minutes(interval.start),
            next = minutes(interval.end)
        if (start < end || start >= next)
            throw new Error('Překrývající se nebo neplatné intervaly')
        end = next
    }
}
