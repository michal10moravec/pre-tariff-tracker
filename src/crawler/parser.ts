import { load } from 'cheerio'
import { Interval, minutes, ScraperError, validateIntervals } from '../model'

/** Read tariff meaning from PRE's NT/VT markers, never from alternating positions. */
export function parseHdo(html: string, expectedDate?: string): Interval[] {
    const $ = load(html)
    const bars = $('.hdo-bar')
    if (bars.length !== 1)
        throw new ScraperError(
            'HTML_CHANGED',
            'PRE nevrátilo jednoznačný rozvrh HDO. Struktura stránky se mohla změnit.'
        )
    if (expectedDate) {
        const label = bars.text().match(/\b(\d{1,2})\.(\d{1,2})\./)
        const [, month, day] = expectedDate.split('-')
        if (
            !label ||
            Number(label[1]) !== Number(day) ||
            Number(label[2]) !== Number(month)
        ) {
            throw new ScraperError(
                'WRONG_DATE',
                'Datum rozvrhu PRE neodpovídá požadovanému dni.'
            )
        }
    }
    const all: { start: string; end: string; low: boolean }[] = []
    let tariff: boolean | undefined
    bars.find('*').each((_index, element) => {
        const el = $(element)
        if (el.hasClass('hdont')) tariff = true
        else if (el.hasClass('hdovt')) tariff = false
        const raw =
            el.attr('title') ||
            el.attr('data-original-title') ||
            el.attr('data-bs-original-title') ||
            el.attr('aria-label')
        if (!raw || !/\d\s*:\s*\d/.test(raw)) return
        const range = raw.match(
            /^\s*(\d{1,2}):([0-5]\d)\s*[-–—]\s*(\d{1,2}):([0-5]\d)\s*$/
        )
        if (!range || tariff === undefined)
            throw new ScraperError(
                'HTML_CHANGED',
                'PRE obsahuje nerozpoznaný čas nebo označení tarifu.'
            )
        const start = `${range[1]!.padStart(2, '0')}:${range[2]}`
        let end = `${range[3]!.padStart(2, '0')}:${range[4]}`
        if (end === '00:00') end = '24:00'
        all.push({ start, end, low: tariff })
        // Each interval must have its own explicit tariff marker.
        tariff = undefined
    })
    try {
        validateIntervals(all)
        if (
            !all.length ||
            all[0]!.start !== '00:00' ||
            all.at(-1)!.end !== '24:00'
        )
            throw new Error('Neúplný den')
        for (let i = 1; i < all.length; i++)
            if (all[i]!.start !== all[i - 1]!.end)
                throw new Error('Mezera v rozvrhu')
    } catch {
        throw new ScraperError(
            'INVALID_SCHEDULE',
            'Rozvrh PRE nepokrývá celý den nebo obsahuje neplatné intervaly.'
        )
    }
    const low: Interval[] = []
    for (const interval of all.filter((x) => x.low)) {
        if (low.at(-1)?.end === interval.start) low.at(-1)!.end = interval.end
        else low.push({ start: interval.start, end: interval.end })
    }
    const declared = $.root()
        .text()
        .match(/Celkem doba nízkého tarifu:\s*(\d+)\s*h(?:\s*(\d+)\s*min)?/i)
    if (
        declared &&
        low.reduce((sum, x) => sum + minutes(x.end) - minutes(x.start), 0) !==
            Number(declared[1]) * 60 + Number(declared[2] || 0)
    ) {
        throw new ScraperError(
            'INVALID_SCHEDULE',
            'Součet intervalů nesouhlasí s dobou nízkého tarifu uvedenou PRE.'
        )
    }
    return low
}
