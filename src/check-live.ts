import { loadConfig } from './config'
import crawl from './crawler'
import { targetDates } from './time'
import { ScraperError } from './model'
async function main() {
    const config = loadConfig()
    const schedules = await crawl(config, targetDates())
    console.log(
        JSON.stringify(
            {
                source: config.hdoCode ? 'PREdistribuce' : 'Moje PRE',
                schedules,
            },
            null,
            2
        )
    )
}
void main().catch((error) => {
    console.error(
        error instanceof ScraperError
            ? `${error.code}: ${error.message}`
            : 'Ověření selhalo. Zkontrolujte .env.'
    )
    process.exitCode = 1
})
