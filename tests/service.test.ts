import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { CacheStore } from '../src/files'
import { loadConfig } from '../src/config'
import { ScheduleService } from '../src/service'
import { ScraperError } from '../src/model'
const baseTime = '2026-09-13T10:00:00Z'
const schedules = (stamp = baseTime) =>
    ['2026-09-13', '2026-09-14'].map((date) => ({
        date,
        low: [{ start: '01:00', end: '09:00' }],
        fetchedAt: stamp,
    }))
async function setup(t: any, crawler: any, clock = () => new Date(baseTime)) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pre-tests-'))
    t.after(() => fs.rm(dir, { recursive: true, force: true }))
    const config = loadConfig({
        HDO_CODE: '556',
        CACHE_FILE: path.join(dir, 'data/cache.json'),
    })
    const store = new CacheStore(config.cachePath, config.source)
    const service = new ScheduleService(config, store, crawler, clock)
    await service.init()
    return { service, store, dir }
}
test('coalesces concurrent refreshes and uses cache until expiry', async (t) => {
    let calls = 0
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const { service, store } = await setup(t, async () => {
        calls++
        await gate
        return schedules()
    })
    const requests = [
        service.refresh(),
        service.refresh(),
        service.refresh(true),
    ]
    assert.equal(calls, 1)
    release()
    await Promise.all(requests)
    await service.refresh()
    assert.equal(calls, 1)
    assert.equal(
        (await store.read()).days['2026-09-13']?.low[0]?.start,
        '01:00'
    )
})
test('retains last good schedules on outage and throttles retries even when forced', async (t) => {
    let now = Date.parse(baseTime),
        calls = 0
    const { service } = await setup(
        t,
        async () => {
            calls++
            if (calls > 1) throw new ScraperError('PRE_UNAVAILABLE', 'Výpadek')
            return schedules()
        },
        () => new Date(now)
    )
    await service.refresh()
    now += 61 * 60_000
    await service.refresh()
    await service.refresh(true)
    await service.refresh()
    assert.equal(calls, 2)
    assert.equal(service.snapshot().stale, true)
    assert.equal(service.cache.days['2026-09-13']?.low.length, 1)
    assert.equal(service.error?.code, 'PRE_UNAVAILABLE')
    now += 5 * 60_000
    await service.refresh()
    assert.equal(calls, 3)
})
test('does not persist incomplete or wrong-date results', async (t) => {
    const { service, store } = await setup(t, async () =>
        schedules().slice(0, 1)
    )
    await service.refresh()
    assert.equal(service.error?.code, 'INVALID_SCHEDULE')
    assert.deepEqual((await store.read()).days, {})
})
test('clears error after recovery and reloads saved history after restart', async (t) => {
    let now = Date.parse(baseTime),
        calls = 0
    const { service, store } = await setup(
        t,
        async () => {
            if (++calls === 1) throw new Error('secret in third-party error')
            return schedules(new Date(now).toISOString())
        },
        () => new Date(now)
    )
    await service.refresh()
    assert.equal(service.error?.message.includes('secret'), false)
    now += 5 * 60_000
    await service.refresh()
    assert.equal(service.error, undefined)
    assert.equal(Object.keys((await store.read()).days).length, 2)
})
test('quarantines malformed cache, preserves original bytes, and recovers', async (t) => {
    const { store } = await setup(t, async () => schedules())
    await fs.mkdir(path.dirname(store.file), { recursive: true })
    await fs.writeFile(store.file, 'broken json')
    assert.deepEqual((await store.read()).days, {})
    const names = await fs.readdir(path.dirname(store.file))
    const backup = names.find((n) => n.includes('.corrupt-'))!
    assert.equal(
        await fs.readFile(path.join(path.dirname(store.file), backup), 'utf8'),
        'broken json'
    )
    await store.write({
        version: 1,
        source: store.source,
        days: Object.fromEntries(schedules().map((x) => [x.date, x])),
    })
    assert.equal(Object.keys((await store.read()).days).length, 2)
    assert.equal(
        (await fs.readdir(path.dirname(store.file))).filter((n) =>
            n.endsWith('.tmp')
        ).length,
        0
    )
})
test('does not mix schedules from different accounts or HDO commands', async (t) => {
    const { store } = await setup(t, async () => schedules())
    await store.write({
        version: 1,
        source: 'hdo:485',
        days: Object.fromEntries(schedules().map((x) => [x.date, x])),
    })
    assert.deepEqual((await store.read()).days, {})
})
test('cache write failure leaves the previous in-memory data intact', async (t) => {
    let now = Date.parse(baseTime)
    const { service, store } = await setup(
        t,
        async () => schedules(new Date(now).toISOString()),
        () => new Date(now)
    )
    await service.refresh()
    now += 61 * 60_000
    store.write = async () => {
        throw new Error('disk full')
    }
    await service.refresh()
    assert.equal(
        Date.parse(service.cache.days['2026-09-13']!.fetchedAt),
        Date.parse(baseTime)
    )
    assert.equal(service.error?.code, 'UPDATE_FAILED')
})
