import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import crawl from '../src/crawler'
import { loadConfig } from '../src/config'
const config = loadConfig({ HDO_CODE: '556' })
const dates = ['2026-09-13', '2026-09-14']
const fixtures = ['account-today.html', 'account-tomorrow.html'].map((f) =>
    readFileSync(`tests/fixtures/${f}`, 'utf8')
)
const listing =
    '<select name="povel"><option value="556">556 - odblokování NT</option></select><script>"/com/PREdi/UI/Forms/Hdo/HdoForm:"</script>'
test('public provider requests exact dates and command and parses both responses', async (t) => {
    const requests: RequestInit[] = []
    t.mock.method(
        globalThis,
        'fetch',
        async (_url: string, init: RequestInit) => {
            requests.push(init)
            return new Response(
                requests.length === 1
                    ? listing
                    : JSON.stringify({ html: fixtures[requests.length - 2] })
            )
        }
    )
    const output = await crawl(config, dates)
    assert.equal(requests.length, 3)
    assert.equal(
        String(requests[1]!.body),
        'datum=13.09.2026&povel=556&povelTitle=556+-+odblokov%C3%A1n%C3%AD+NT'
    )
    assert.deepEqual(output[0]!.low, [
        { start: '03:40', end: '06:40' },
        { start: '12:40', end: '17:40' },
    ])
    assert.deepEqual(output[1]!.low, [
        { start: '01:00', end: '06:00' },
        { start: '13:00', end: '16:00' },
    ])
})
test('fails clearly on unavailable or changed public endpoint without leaking response', async (t) => {
    t.mock.method(
        globalThis,
        'fetch',
        async () => new Response('upstream private diagnostic', { status: 503 })
    )
    await assert.rejects(crawl(config, dates), /HTTP 503/)
})
test('rejects appliance commands and does not fetch their timetable', async (t) => {
    let calls = 0
    t.mock.method(globalThis, 'fetch', async () => {
        calls++
        return new Response(
            listing.replace('odblokování NT', 'odblokování spotřebiče')
        )
    })
    await assert.rejects(crawl(config, dates), /spotřebiči/)
    assert.equal(calls, 1)
})
test('rejects malformed JSON and wrong-date responses', async (t) => {
    let calls = 0
    t.mock.method(
        globalThis,
        'fetch',
        async () =>
            new Response(++calls === 1 ? listing : '<html>Service error</html>')
    )
    await assert.rejects(crawl(config, dates), /JSON/)
    calls = 0
    t.mock.method(
        globalThis,
        'fetch',
        async () =>
            new Response(
                ++calls === 1 ? listing : JSON.stringify({ html: fixtures[1] })
            )
    )
    await assert.rejects(crawl(config, dates), /Datum/)
})
