import http from 'node:http'
import { assets } from './assets'
import { getPage, getScript, getStyles } from './html'
import { ScheduleService } from '../service'
export function createServer(service: ScheduleService) {
    return http.createServer((req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Referrer-Policy', 'no-referrer')
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
        )
        const send = (status: number, type: string, body: string) => {
            res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` })
            res.end(req.method === 'HEAD' ? undefined : body)
        }
        try {
            const url = new URL(req.url || '/', 'http://localhost')
            if (url.pathname === '/refresh') {
                if (req.method !== 'POST') {
                    res.setHeader('Allow', 'POST')
                    send(405, 'text/plain', 'Použijte POST.')
                    return
                }
                const origin = req.headers.origin
                if (
                    !origin ||
                    !req.headers.host ||
                    origin !== `http://${req.headers.host}` ||
                    req.headers['sec-fetch-site'] === 'cross-site'
                ) {
                    send(
                        403,
                        'text/plain',
                        'Aktualizaci spusťte ze stránky aplikace.'
                    )
                    return
                }
                void service.refresh(true)
                res.writeHead(303, { Location: '/' })
                res.end()
                return
            }
            if (!['GET', 'HEAD'].includes(req.method || '')) {
                res.setHeader('Allow', 'GET, HEAD')
                send(405, 'text/plain', 'Nepodporovaná metoda.')
                return
            }
            const asset = Object.hasOwn(assets, url.pathname) ? assets[url.pathname] : undefined
            if (asset) {
                res.writeHead(200, {'Content-Type': asset.type})
                res.end(req.method === 'HEAD' ? undefined : asset.body)
                return
            }
            switch (url.pathname) {
                case '/':
                    void service.refresh()
                    send(200, 'text/html', getPage(service))
                    break
                case '/history':
                    send(200, 'text/html', getPage(service, true))
                    break
                case '/styles.css':
                    send(200, 'text/css', getStyles())
                    break
                case '/app.js':
                    send(200, 'text/javascript', getScript())
                    break
                case '/favicon.ico':
                    res.writeHead(204)
                    res.end()
                    break
                case '/api/times': {
                    void service.refresh()
                    const state = service.snapshot()
                    send(
                        state.days.every(Boolean) ? 200 : 503,
                        'application/json',
                        JSON.stringify(state)
                    )
                    break
                }
                case '/health':
                    send(
                        200,
                        'application/json',
                        JSON.stringify({ status: 'ok', ...service.snapshot() })
                    )
                    break
                default:
                    send(404, 'text/plain', 'Stránka nenalezena.')
            }
        } catch {
            send(
                500,
                'text/plain',
                'Stránku se nepodařilo zobrazit. Zkontrolujte protokol aplikace.'
            )
        }
    })
}
