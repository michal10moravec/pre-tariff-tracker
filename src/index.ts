import { loadConfig } from './config'
import { CacheStore } from './files'
import crawl from './crawler'
import { ScheduleService } from './service'
import { createServer } from './server'
async function main() {
    const config = loadConfig()
    const service = new ScheduleService(
        config,
        new CacheStore(config.cachePath, config.source),
        (dates) => crawl(config, dates)
    )
    await service.init()
    const server = createServer(service)
    server.on('error', () => {
        console.error(
            'Server nelze spustit. Ověřte SERVER_HOST, SERVER_PORT a zda port už nepoužívá jiný proces.'
        )
        process.exitCode = 1
    })
    server.listen(config.port, config.host, () => {
        console.log(
            `PRE scraper běží na http://${config.host}:${config.port} (${config.hdoCode ? 'PREdistribuce' : 'Moje PRE'}).`
        )
        void service.refresh()
    })
    const timer = setInterval(() => {
        if (server.listening) void service.refresh()
    }, 60_000)
    timer.unref()
    let closing = false
    const shutdown = () => {
        if (closing) return
        closing = true
        clearInterval(timer)
        server.close()
        const deadline = setTimeout(
            () => process.exit(1),
            config.timeoutMs * 3 + 5000
        )
        deadline.unref()
        void service.settle().then(() => {
            clearTimeout(deadline)
        })
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}
void main().catch(() => {
    console.error(
        'Spuštění selhalo. Ověřte konfiguraci .env a přístup k souboru cache.'
    )
    process.exitCode = 1
})
