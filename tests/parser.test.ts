import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseHdo } from '../src/crawler/parser'
const today = readFileSync('tests/fixtures/account-today.html', 'utf8')
const tomorrow = readFileSync('tests/fixtures/account-tomorrow.html', 'utf8')
const bar = (items: [string, string][]) =>
    `<div class="hdo-bar"><div>neděle 13.09.</div>${items.map(([tariff, time]) => `<span class="${tariff}"></span><span title="${time}"></span>`).join('')}</div>`
test('actual Moje PRE HTML: low tariff and midnight notation', () => {
    assert.deepEqual(parseHdo(today, '2026-09-13'), [
        { start: '03:40', end: '06:40' },
        { start: '12:40', end: '17:40' },
    ])
    assert.deepEqual(parseHdo(tomorrow, '2026-09-14'), [
        { start: '01:00', end: '06:00' },
        { start: '13:00', end: '16:00' },
    ])
})
test('does not assume two low intervals or start with high tariff', () => {
    assert.deepEqual(
        parseHdo(
            bar([
                ['hdont', '00:00 - 02:00'],
                ['hdovt', '02:00 - 03:00'],
                ['hdont', '03:00 - 06:00'],
                ['hdovt', '06:00 - 08:00'],
                ['hdont', '08:00 - 24:00'],
            ]),
            '2026-09-13'
        ),
        [
            { start: '00:00', end: '02:00' },
            { start: '03:00', end: '06:00' },
            { start: '08:00', end: '24:00' },
        ]
    )
})
test('handles moved tooltip attribute, wrapper and Unicode dash', () => {
    const html = bar([
        ['hdont', '0:00 – 8:00'],
        ['hdovt', '8:00 — 24:00'],
    ])
        .replaceAll('title=', 'data-original-title=')
        .replaceAll('<span class=', '<span data-extra="ignored" class=')
    assert.deepEqual(parseHdo(html), [{ start: '00:00', end: '08:00' }])
})
test('supports explicit whole-day high or low tariff', () => {
    assert.deepEqual(parseHdo(bar([['hdont', '00:00 - 00:00']])), [
        { start: '00:00', end: '24:00' },
    ])
    assert.deepEqual(parseHdo(bar([['hdovt', '00:00 - 24:00']])), [])
})
test('merges adjacent low intervals', () =>
    assert.deepEqual(
        parseHdo(
            bar([
                ['hdont', '00:00 - 10:00'],
                ['hdont', '10:00 - 24:00'],
            ])
        ),
        [{ start: '00:00', end: '24:00' }]
    ))
test('rejects unexpected markup, ambiguous days, missing tariff meaning, gaps, overlaps and invalid hours', () => {
    for (const html of [
        '<h1>Přihlaste se</h1>',
        today + tomorrow,
        today.replaceAll('hdont', 'new-class'),
        bar([['hdont', '00:00 - 12:00']]),
        bar([
            ['hdont', '00:00 - 12:00'],
            ['hdovt', '11:00 - 24:00'],
        ]),
        bar([['hdont', '00:00 - 25:00']]),
        bar([
            ['hdont', '00:00 - 12:00'],
            ['hdovt', '13:00 - 24:00'],
        ]),
    ])
        assert.throws(() => parseHdo(html))
})
test('rejects a different date or an inconsistent total', () => {
    assert.throws(() => parseHdo(today, '2026-09-14'), /Datum/)
    assert.throws(() => parseHdo(today.replace('8 h', '9 h')), /Součet/)
})
