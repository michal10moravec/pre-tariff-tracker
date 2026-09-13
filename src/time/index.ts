export const TIME_ZONE = 'Europe/Prague'
export function dateKey(now = new Date()) {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now)
}
export function addDays(date: string, count: number) {
    const d = new Date(`${date}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + count)
    return d.toISOString().slice(0, 10)
}
export const targetDates = (now = new Date()) => {
    const today = dateKey(now)
    return [today, addDays(today, 1)]
}
export function isDate(value: string) {
    return (
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
        new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
    )
}
export const displayDate = (date: string) =>
    new Intl.DateTimeFormat('cs-CZ', {
        timeZone: TIME_ZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    }).format(new Date(`${date}T12:00:00Z`))
export const displayTimestamp = (date: string) =>
    new Intl.DateTimeFormat('cs-CZ', {
        timeZone: TIME_ZONE,
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date))
export function currentMinute(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now)
    return (
        Number(parts.find((p) => p.type === 'hour')!.value) * 60 +
        Number(parts.find((p) => p.type === 'minute')!.value)
    )
}
