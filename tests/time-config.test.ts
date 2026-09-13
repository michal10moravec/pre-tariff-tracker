import { test } from 'node:test'
import assert from 'node:assert/strict'
import { targetDates, currentMinute, isDate } from '../src/time'
import { loadConfig } from '../src/config'
test('uses Prague date regardless of server timezone, including year boundary', () => {
    assert.deepEqual(targetDates(new Date('2026-12-31T23:30:00Z')), [
        '2027-01-01',
        '2027-01-02',
    ])
    assert.deepEqual(targetDates(new Date('2026-09-13T22:30:00Z')), [
        '2026-09-14',
        '2026-09-15',
    ])
})
test('calendar day arithmetic survives both DST changes', () => {
    assert.deepEqual(targetDates(new Date('2026-03-29T00:30:00Z')), [
        '2026-03-29',
        '2026-03-30',
    ])
    assert.deepEqual(targetDates(new Date('2026-10-25T00:30:00Z')), [
        '2026-10-25',
        '2026-10-26',
    ])
    assert.equal(currentMinute(new Date('2026-03-29T01:30:00Z')), 210)
})
test('validates calendar dates and numeric configuration', () => {
    assert.equal(isDate('2026-02-30'), false)
    assert.equal(isDate('2024-02-29'), true)
    for (const env of [
        { SERVER_PORT: 'hello' },
        { SERVER_PORT: '70000' },
        { REFRESH_MINUTES: '0' },
        { REQUEST_TIMEOUT_SECONDS: '-1' },
        { HDO_CODE: 'TOU123' },
        { BROWSER_HEADLESS: 'no' },
    ])
        assert.throws(() => loadConfig(env))
    assert.equal(loadConfig({}).host, '127.0.0.1')
    assert.equal(loadConfig({ HDO_CODE: '556' }).source, 'hdo:556')
    assert.notEqual(
        loadConfig({ PRE_USERNAME: 'a' }).source,
        loadConfig({ PRE_USERNAME: 'b' }).source
    )
})
