// Откуда пришёл игрок: метка первого визита (?from=, utm_source, внешний реферер) живёт 30 дней
// и уходит на бэкенд при регистрации — по ней «Воронка новичка» делит игроков по каналам.
const KEY = 'voidrp_attr_v1'
const TTL = 30 * 24 * 3600 * 1000
const OWN = /(^|\.)void-rp\.ru$/

function clean(v) {
  return String(v || '').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '').slice(0, 64)
}

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    return v && Date.now() - v.at < TTL ? v : null
  } catch { return null }
}

/** На старте сайта: запомнить метку первого визита (первая метка не перезаписывается). */
export function captureAttribution() {
  try {
    const q = new URLSearchParams(window.location.search)
    let source = clean(q.get('from') || q.get('utm_source'))
    if (!source && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '')
      if (host && !OWN.test(host)) source = clean(`ref:${host}`)
    }
    if (!source || read()) return
    localStorage.setItem(KEY, JSON.stringify({ source, landing: window.location.pathname.slice(0, 200), at: Date.now() }))
  } catch { /* storage blocked: no label, nothing breaks */ }
}

/** Для формы регистрации: { source, landing } или пусто. */
export function attribution() {
  const v = read()
  return v ? { source: v.source, landing: v.landing } : {}
}
