import { DaySchedule, minutes } from '../model'
import { ScheduleService } from '../service'
import { currentMinute, dateKey, displayDate, displayTimestamp } from '../time'
export const escapeHtml = (text: string) =>
    text.replace(
        /[&<>"']/g,
        (char) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[char]!
    )
const duration = (total: number) =>
    `${Math.floor(total / 60)} h${total % 60 ? ` ${total % 60} min` : ''}`
function card(
    date: string,
    schedule: DaySchedule | undefined,
    label: string,
    stale: boolean
) {
    const total =
        schedule?.low.reduce(
            (n, x) => n + minutes(x.end) - minutes(x.start),
            0
        ) || 0
    return `<article class="day-card"><div class="card-heading"><div><p class="eyebrow">${label}</p><h2>${escapeHtml(displayDate(date))}</h2></div>${schedule ? `<span class="hours">${duration(total)}<small>nízkého tarifu</small></span>` : ''}</div>
    ${
        schedule
            ? `<div class="timeline" role="img" aria-label="Rozložení nízkého tarifu během dne; přesné intervaly jsou uvedeny níže.">${schedule.low.map((x) => `<span style="left:${minutes(x.start) / 14.4}%;width:${(minutes(x.end) - minutes(x.start)) / 14.4}%"></span>`).join('')}</div><div class="axis" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    <ul class="intervals">${schedule.low.map((x, i) => `<li><span class="interval-number">${String(i + 1).padStart(2, '0')}</span><strong>${x.start} <span class="dash">—</span> ${x.end}</strong><span class="interval-duration">${duration(minutes(x.end) - minutes(x.start))}</span></li>`).join('') || '<li>V tento den není naplánován nízký tarif.</li>'}</ul>
    <p class="updated ${stale ? 'stale' : ''}">${stale ? 'Starší data · ' : ''}Načteno ${escapeHtml(displayTimestamp(schedule.fetchedAt))}</p>`
            : '<div class="empty">Časy zatím nejsou k dispozici.<p>Po úspěšném načtení z PRE se objeví zde.</p></div>'
    }</article>`
}
export function getPage(
    service: ScheduleService,
    history = false,
    now = new Date()
) {
    const state = service.snapshot(),
        today = service.cache.days[dateKey(now)]
    const minute = currentMinute(now)
    const active = today?.low.find(
        (x) => minutes(x.start) <= minute && minutes(x.end) > minute
    )
    const next = today?.low.find((x) => minutes(x.start) > minute)
    const reliable = today && !service.isStale(today) && !state.error
    const status = !reliable
        ? 'Aktuální tarif nelze ověřit'
        : active
          ? 'Právě je plánován nízký tarif'
          : 'Právě je plánován vysoký tarif'
    const detail = !reliable
        ? 'Zkontrolujte stav načtení níže.'
        : active
          ? `Podle rozvrhu do ${active.end}.`
          : next
            ? `Nízký tarif začne v ${next.start}.`
            : 'Dnešní intervaly nízkého tarifu už skončily.'
    const days = history
        ? Object.keys(service.cache.days).sort().reverse()
        : state.dates
    return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>PRE</title><link rel="stylesheet" href="/styles.css"><script src="/app.js" defer></script><link rel="icon" type="image/svg+xml" href="/icons/app.svg"><link rel="apple-touch-icon" sizes="180x180" href="/icons/app-180.png"><link rel="manifest" href="/manifest.webmanifest"><meta name="apple-mobile-web-app-title" content="PRE"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="#102e34"><link rel="stylesheet" href="/home-ui.css"></head>
    <body data-refreshing="${state.refreshing}"><a class="skip" href="#main">Přejít na obsah</a><div class="shell"><header class="home-header"><h1 class="app-title"><img src="/icons/app.svg" alt="">PRE</h1><nav aria-label="Hlavní navigace"><a href="/" ${!history ? 'aria-current="page"' : ''}>Přehled</a><a href="/history" ${history ? 'aria-current="page"' : ''}>Historie</a></nav></header>
    <main id="main"><div class="intro"><h2>${history ? 'Historie nízkého tarifu' : 'Časy nízkého tarifu'}</h2><form action="/refresh" method="post"><button type="submit">↻ &nbsp; Aktualizovat</button></form></div>
    ${!history ? `<section class="status-banner ${active && reliable ? 'is-low' : ''}" aria-label="Stav podle rozvrhu"><span class="status-dot" aria-hidden="true"></span><div><strong>${status}</strong><p>${detail}</p></div><span class="plan-label">PODLE PLÁNU PRE</span></section>` : ''}
    ${state.error ? `<div class="notice" role="status"><strong>Aktualizace se nepodařila</strong><p>${escapeHtml(state.error.message)}</p><p>Poslední pokus: ${escapeHtml(displayTimestamp(state.error.at))}. Další pokus proběhne automaticky.</p></div>` : state.refreshing ? '<p class="notice" role="status">Načítám aktuální rozvrh z PRE… Stránka se automaticky obnoví.</p>' : state.stale ? '<p class="notice" role="status">Některé časy chybí nebo jsou starší. Proběhne automatická aktualizace.</p>' : ''}
    <div class="cards">${days.map((date, i) => card(date, service.cache.days[date], history ? date.slice(0, 4) : i === 0 ? 'DNES' : 'ZÍTRA', !history && service.isStale(service.cache.days[date]))).join('') || '<p class="empty">Historie je zatím prázdná.</p>'}</div>
    <div class="legend"><span><i></i> Nízký tarif</span><span><i class="high"></i> Vysoký tarif</span><span>Časové pásmo: Praha</span></div></main>
    <footer><p>Informativní plán, nikoli měření skutečného sepnutí. Distributor může časy během dne změnit.</p><a href="https://www.predistribuce.cz/cs/potrebuji-zaridit/zakaznici/stav-hdo/" rel="noreferrer">Ověřit u PREdistribuce ↗</a></footer></div></body></html>`
}
export const getScript = () => `
setTimeout(() => { if (!document.hidden) location.reload(); }, document.body.dataset.refreshing === 'true' ? 3000 : 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) location.reload(); });
document.querySelector('form[action="/refresh"]').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    button.textContent = 'Načítám…';
    try {
        const response = await fetch('/refresh', { method: 'POST' });
        if (!response.ok) throw new Error('Aktualizace selhala');
        location.assign('/');
    } catch {
        button.disabled = false;
        button.textContent = 'Zkusit aktualizaci znovu';
        const notice = document.createElement('p');
        notice.setAttribute('role', 'status');
        notice.className = 'notice';
        notice.textContent = 'Aktualizaci se nepodařilo spustit. Ověřte spojení s aplikací.';
        document.querySelector('main').prepend(notice);
    }
});
`
export const getStyles = () => `
:root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#132c31;background:#edf2f4;font-synthesis:none;line-height:1.5}*{box-sizing:border-box}body{margin:0}a{color:inherit}button,a{-webkit-tap-highlight-color:transparent}a:focus-visible,button:focus-visible{outline:3px solid #348779;outline-offset:5px}.shell{max-width:1140px;padding:0 38px;margin:auto}header{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:32px 0;border-bottom:1px solid #dce2d9}.brand{display:flex;gap:12px;align-items:center;text-decoration:none;font-size:17px;font-weight:650;white-space:nowrap}.brand-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:#174f45;color:#d0eb99;font-size:31px}.brand small{display:block;font-size:9px;letter-spacing:2px;color:#61766b;margin-top:2px}nav{display:flex;gap:6px}nav a{text-decoration:none;font-size:14px;padding:10px 17px;border-radius:24px}nav a[aria-current]{background:#e5f1ee;font-weight:600}.intro{display:flex;justify-content:space-between;align-items:center;gap:24px;margin:52px 0 28px}.eyebrow{font-size:10px;letter-spacing:1.7px;font-weight:700;color:#567269;margin:0 0 12px}h1{font-size:clamp(29px,4vw,43px);line-height:1.17;font-weight:600;letter-spacing:-1.7px;margin:0 0 13px}.lead{color:#65766c;font-size:15px;margin:0}button{background:#fff;border:1px solid #d8e2e5;border-radius:9px;padding:12px 19px;color:#146c60;font-family:inherit;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;min-height:44px}button:hover{background:#e5f1ee}.status-banner{display:flex;gap:14px;align-items:center;border-radius:13px;padding:22px 25px;background:#e4eade;margin:0 0 28px}.status-banner.is-low{background:#102e34;color:#f4fbe9}.status-banner strong{font-size:16px;font-weight:600}.status-banner p{font-size:13px;margin:3px 0 0;opacity:.8}.status-dot{width:10px;height:10px;flex-shrink:0;border-radius:50%;background:#63766a}.is-low .status-dot{background:#c6e8a1;box-shadow:0 0 0 5px #ffffff12}.plan-label{margin-left:auto;font-size:9px;letter-spacing:1.3px;white-space:nowrap;opacity:.7}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}.day-card{padding:27px;border-radius:17px;border:1px solid #d8e2e5;background:#fff;min-width:0}.card-heading{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:28px}.card-heading .eyebrow{margin-bottom:6px}h2{font-weight:600;font-size:21px;letter-spacing:-.5px;margin:0}h2:first-letter{text-transform:uppercase}.hours{text-align:right;white-space:nowrap;font-size:23px;font-weight:600}.hours small{font-size:10px;display:block;font-weight:400;color:#738175}.timeline{height:18px;background:#edf0e8;position:relative;border-radius:5px;overflow:hidden}.timeline span{position:absolute;height:100%;background:#348779}.axis{display:flex;justify-content:space-between;color:#778479;font-size:10px;margin-top:7px}.intervals{list-style:none;margin:23px 0 18px;padding:0}.intervals li{display:flex;gap:15px;align-items:center;border-top:1px solid #eef1ea;padding:16px 0;font-size:15px}.intervals strong{font-size:20px;letter-spacing:-.5px;font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums}.interval-number{font-size:10px;color:#75897b}.dash{color:#879e8c;padding:0 5px}.interval-duration{margin-left:auto;font-size:12px;color:#65776b;white-space:nowrap}.updated{font-size:10px;color:#6a7c6f;margin:0}.stale{color:#926323}.legend{display:flex;flex-wrap:wrap;gap:22px;font-size:11px;color:#65776b;margin:24px 0 48px}.legend span{display:flex;align-items:center;gap:7px}.legend span:last-child{margin-left:auto}.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;background:#348779}.legend .high{background:#e1e6d9}.notice{background:#fff2d9;border:1px solid #e9d6b1;padding:17px 20px;border-radius:12px;font-size:13px;margin:0 0 23px;color:#705121}.notice p{margin:5px 0 0}.empty{font-size:15px;color:#708175;padding:24px 0}.empty p{font-size:12px}footer{display:flex;justify-content:space-between;gap:20px;border-top:1px solid #dce2d9;padding:23px 0 34px;color:#6e7d70;font-size:11px}footer p{margin:0;max-width:630px}footer a{white-space:nowrap;text-underline-offset:3px}.skip{position:absolute;left:-9999px}.skip:focus{left:20px;top:10px;background:white;padding:10px;z-index:5}
@media(max-width:700px){.shell{padding:0 20px}header{padding:21px 0}.brand{font-size:14px;gap:9px}.brand-icon{width:36px;height:36px}nav a{font-size:12px;padding:10px 12px}.intro{margin:34px 0 24px;display:block}h1{letter-spacing:-1px}.intro form{margin-top:20px}.lead{font-size:14px}.status-banner{padding:18px;gap:12px}.status-banner strong{font-size:14px}.plan-label{display:none}.cards{grid-template-columns:1fr;gap:18px}.day-card{padding:22px}h2{font-size:20px}.legend{gap:14px;margin-bottom:30px}.legend span:last-child{margin-left:0}footer{display:block}footer a{display:inline-block;margin-top:14px}.intervals strong{font-size:21px}.card-heading{margin-bottom:25px}}
@media(max-width:360px){.shell{padding:0 14px}.brand small{font-size:8px}nav a{padding:9px}.day-card{padding:18px}.intervals li{gap:10px}.intervals strong{font-size:18px}.hours{font-size:20px}h2{font-size:18px}}
.shell{max-width:1060px;padding:48px 28px 24px}.shell main{padding:0}.intro{margin:24px 0;display:flex;flex-wrap:wrap}.intro h2{font-size:20px}.intro form{margin:0}.status-banner{border-radius:16px}@media(max-width:640px){.shell{padding:28px 18px 18px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`
