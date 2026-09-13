import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { loadConfig } from '../src/config'
import { CacheStore } from '../src/files'
import { ScheduleService } from '../src/service'
import { createServer } from '../src/server'
import { targetDates } from '../src/time'
import { getPage } from '../src/server/html'
function service() {
    const config = loadConfig({ HDO_CODE: '556' })
    const store = new CacheStore('unused-test-file', config.source)
    store.write = async () => {}
    return new ScheduleService(config, store, async (dates) =>
        dates.map((date) => ({
            date,
            low: [{ start: '01:00', end: '09:00' }],
            fetchedAt: new Date().toISOString(),
        }))
    )
}
test('HTTP routes, query strings, JSON, refresh origin and HTTP methods', async (t) => {
    const s = service()
    await s.refresh()
    const server = createServer(s)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    t.after(() => {
        server.closeAllConnections()
        server.close()
    })
    const base = `http://127.0.0.1:${(server.address() as any).port}`
    const index = await fetch(base + '/?hello=1')
    assert.equal(index.status, 200)
    const html = await index.text()
    assert.match(html, /name="viewport"/)
    assert.match(html, /01:00/)
    const api = await fetch(base + '/api/times')
    assert.equal(api.status, 200)
    assert.equal((await api.json()).days.length, 2)
    const history = await fetch(base + '/history')
    assert.equal(history.status, 200)
    assert.equal((await fetch(base + '/missing')).status, 404)
    assert.equal((await fetch(base + '/refresh')).status, 405)
    assert.equal(
        (
            await fetch(base + '/refresh', {
                method: 'POST',
                headers: { Origin: 'https://example.com' },
            })
        ).status,
        403
    )
    assert.equal(
        (
            await fetch(base + '/refresh', {
                method: 'POST',
                headers: { Origin: base },
                redirect: 'manual',
            })
        ).status,
        303
    )
    assert.equal((await fetch(base + '/', { method: 'PUT' })).status, 405)
    assert.equal(await (await fetch(base + '/', { method: 'HEAD' })).text(), '')
    assert.match(
        index.headers.get('content-security-policy')!,
        /frame-ancestors 'none'/
    )
})
test('renders unknown status and escapes errors instead of trusting upstream HTML', () => {
    const s = service()
    s.error = {
        code: 'TEST',
        message: '<img src=x onerror=alert(1)>',
        at: new Date().toISOString(),
    }
    const html = getPage(s)
    assert.match(html, /Aktuální tarif nelze ověřit/)
    assert.match(html, /&lt;img/)
    assert.doesNotMatch(html, /<img src=x/)
})
test('history sorts dates descending and handles variable interval counts', () => {
    const s = service(),
        dates = targetDates()
    for (const date of dates)
        s.cache.days[date] = {
            date,
            low: [
                { start: '00:00', end: '02:00' },
                { start: '04:00', end: '08:00' },
                { start: '12:00', end: '14:00' },
            ],
            fetchedAt: new Date().toISOString(),
        }
    const html = getPage(s, true)
    assert.ok(html.indexOf(dates[1]!.slice(0, 4)) > 0)
    assert.match(html, /12:00/)
    assert.match(html, /8 h/)
})
