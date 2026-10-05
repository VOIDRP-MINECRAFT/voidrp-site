<script setup>
// Публичный статус сервера: /status/<slug>. Без входа, RU/EN, обновляется каждые 30 с.
// ?embed=1 — компактный виджет для iframe на сайте партнёра (?theme=light, ?lang=en).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiRequest } from '../services/apiBase'
import { setLocale } from '../i18n'

const route = useRoute()
const { t, locale } = useI18n()
const slug = computed(() => String(route.params.slug || '').toLowerCase())
const embed = computed(() => route.query.embed === '1' || route.query.embed === 'true')
const light = computed(() => route.query.theme === 'light')

const data = ref(null)
const error = ref(null)
const now = ref(Date.now())
const copied = ref(false)
let timer = null
let clock = null

async function load() {
  try {
    data.value = await apiRequest(`/status/${encodeURIComponent(slug.value)}`, { serverScope: false, toast: false })
    error.value = null
    document.title = `${data.value.name} — ${t('statusPage.title')}`
  } catch (e) {
    error.value = e?.status === 404 || /не публичный/.test(e?.message || '') ? 'private' : 'failed'
  }
}

const onResize = () => { narrow.value = window.innerWidth < 600 }
onMounted(() => {
  window.addEventListener('resize', onResize)
  if (route.query.lang === 'en' || route.query.lang === 'ru') setLocale(route.query.lang)
  load()
  timer = setInterval(load, 30000)
  clock = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { clearInterval(timer); clearInterval(clock); window.removeEventListener('resize', onResize) })

const state = computed(() => {
  const d = data.value
  if (!d) return 'loading'
  if (d.maintenance) return 'maint'
  return d.online ? 'up' : 'down'
})
const stateLabel = computed(() => ({ up: t('statusPage.online'), down: t('statusPage.offline'), maint: t('statusPage.maintenance') }[state.value] || ''))
const pct = (v) => (v == null ? t('statusPage.noData') : `${v >= 99.995 ? '100' : v.toFixed(v >= 99 ? 2 : 1)}%`)
const barKind = (u) => (u == null ? 'empty' : u >= 99.5 ? 'good' : u >= 95 ? 'partial' : 'bad')
const bars = computed(() => (data.value?.bars_30d || []).map((b) => ({ ...b, kind: barKind(b.uptime) })))
const fmtDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(locale.value === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short' })
const fmtDateTime = (iso) => new Date(iso).toLocaleString(locale.value === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dur = (m) => (m < 60 ? `${m} ${t('statusPage.min')}` : `${Math.floor(m / 60)} ${t('statusPage.h')} ${m % 60} ${t('statusPage.min')}`)
const updatedAgo = computed(() => {
  if (!data.value?.updated_at) return null
  const s = Math.max(0, Math.round((now.value - new Date(data.value.updated_at).getTime()) / 1000))
  return s < 120 ? t('statusPage.secondsAgo', { n: s }) : t('statusPage.minutesAgo', { n: Math.round(s / 60) })
})
const hoverBar = ref(null)

// Игроки за сутки — одна серия, перекрестие с подсказкой.
const narrow = ref(typeof window !== 'undefined' && window.innerWidth < 600)
const W = computed(() => (narrow.value ? 360 : 640))
const H = 140
const P = { l: 30, r: 8, t: 12, b: 20 }
const series = computed(() => data.value?.series_24h || [])
const hasSeries = computed(() => series.value.some((p) => p.online != null))
const maxY = computed(() => {
  const m = Math.max(1, ...series.value.map((p) => p.online || 0))
  return [2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((s) => s >= m * 1.1) || Math.ceil(m * 1.2)
})
const px = (i) => P.l + (i / Math.max(1, series.value.length - 1)) * (W.value - P.l - P.r)
const py = (v) => P.t + (1 - v / maxY.value) * (H - P.t - P.b)
const runs = computed(() => {
  const out = []
  let run = []
  series.value.forEach((p, i) => { if (p.online == null) { if (run.length) out.push(run); run = [] } else run.push([i, p.online]) })
  if (run.length) out.push(run)
  return out
})
const linePath = computed(() => runs.value.map((r) => r.map(([i, v], k) => `${k ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ')).join(' '))
const areaPath = computed(() => runs.value.filter((r) => r.length > 1).map((r) => `M${px(r[0][0])} ${py(0)} ${r.map(([i, v]) => `L${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ')} L${px(r[r.length - 1][0])} ${py(0)} Z`).join(' '))
const hover = ref(null)
function move(ev) {
  const r = ev.currentTarget.getBoundingClientRect()
  const x = ((ev.clientX - r.left) / r.width) * W.value
  const i = Math.round(((x - P.l) / (W.value - P.l - P.r)) * (series.value.length - 1))
  hover.value = i >= 0 && i < series.value.length ? i : null
}
const hp = computed(() => (hover.value == null ? null : series.value[hover.value]))
const fmtT = (iso) => new Date(iso).toLocaleTimeString(locale.value === 'en' ? 'en-GB' : 'ru-RU', { hour: '2-digit', minute: '2-digit' })
const ticks = computed(() => {
  if (!series.value.length) return []
  const t0 = new Date(series.value[0].t).getTime()
  const out = []
  const start = new Date(t0)
  start.setMinutes(0, 0, 0)
  for (let ms = start.getTime() + 3600e3 * 2; ms < t0 + 864e5; ms += 3600e3 * (narrow.value ? 8 : 6)) {
    out.push({ x: P.l + ((ms - t0) / 864e5) * (W.value - P.l - P.r), label: fmtT(new Date(ms).toISOString()) })
  }
  return out
})

async function copyAddress() {
  try {
    await navigator.clipboard.writeText(data.value.address)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1600)
  } catch { /* clipboard blocked — the address is on screen anyway */ }
}
</script>

<template>
  <div class="st" :class="{ 'st--embed': embed, 'st--light': light }" :style="data?.accent_color ? { '--st-acc': data.accent_color } : null">
    <!-- Ошибки -->
    <div v-if="error && !data" class="st-msg">
      <div class="st-msg__title">{{ error === 'private' ? t('statusPage.notPublic') : t('statusPage.loadError') }}</div>
      <div class="st-muted">{{ error === 'private' ? t('statusPage.notPublicHint') : '' }}</div>
      <button v-if="error === 'failed'" class="st-btn" @click="load">{{ t('statusPage.retry') }}</button>
    </div>

    <div v-else-if="!data" class="st-skel" />

    <!-- Виджет для iframe -->
    <a v-else-if="embed" class="sw" :href="data.page_url" target="_blank" rel="noopener">
      <img v-if="data.icon_url" :src="data.icon_url" alt="" class="sw-icon" />
      <div class="sw-main">
        <div class="sw-name">{{ data.name }}</div>
        <div class="sw-line">
          <span class="st-pill" :class="`st-pill--${state}`"><i />{{ stateLabel }}</span>
          <span v-if="state === 'up' && data.players != null" class="sw-players"><b>{{ data.players }}</b>/{{ data.max_players || '?' }}</span>
          <span v-if="data.uptime_30d != null" class="st-muted">{{ pct(data.uptime_30d) }} · {{ t('statusPage.month') }}</span>
        </div>
        <div class="sw-bars" :aria-label="t('statusPage.bars')">
          <span v-for="b in bars" :key="b.day" class="st-bar" :class="`st-bar--${b.kind}`" :title="`${fmtDay(b.day)}: ${b.uptime == null ? t('statusPage.noData') : pct(b.uptime)}`" />
        </div>
      </div>
    </a>

    <!-- Полная страница -->
    <main v-else class="st-page">
      <header class="st-hero">
        <div class="st-hero__bg" :style="data.banner_url ? { backgroundImage: `url(${data.banner_url})` } : null" />
        <div class="st-hero__shade" />
        <div class="st-hero__body">
          <img v-if="data.icon_url" :src="data.icon_url" alt="" class="st-hero__icon" />
          <div class="st-hero__text">
            <div class="st-kicker">{{ t('statusPage.title') }}</div>
            <h1 class="st-hero__name">{{ data.name }}</h1>
            <p v-if="data.description" class="st-hero__desc">{{ data.description }}</p>
          </div>
          <div class="st-state" :class="`st-state--${state}`">
            <span class="st-state__dot" />
            <span>{{ stateLabel }}</span>
          </div>
        </div>
      </header>

      <section class="st-facts">
        <div class="st-fact">
          <div class="st-fact__label">{{ t('statusPage.players') }}</div>
          <div class="st-fact__value">{{ state === 'up' && data.players != null ? data.players : '—' }}<small v-if="data.max_players"> / {{ data.max_players }}</small></div>
        </div>
        <div class="st-fact">
          <div class="st-fact__label">{{ t('statusPage.tps') }}</div>
          <div class="st-fact__value" :class="{ 'st-warn': data.tps != null && data.tps < 15 }">{{ state === 'up' && data.tps != null ? data.tps : '—' }}<small v-if="state === 'up' && data.tps != null"> / 20</small></div>
        </div>
        <div class="st-fact">
          <div class="st-fact__label">{{ t('statusPage.version') }}</div>
          <div class="st-fact__value">{{ data.mc_version || '—' }}</div>
        </div>
        <div v-if="data.address" class="st-fact st-fact--addr">
          <div class="st-fact__label">{{ t('statusPage.address') }}</div>
          <button class="st-addr" :title="t('statusPage.copy')" @click="copyAddress">
            <code>{{ data.address }}</code><span>{{ copied ? t('statusPage.copied') : t('statusPage.copy') }}</span>
          </button>
        </div>
      </section>

      <section class="st-card">
        <div class="st-card__head">
          <h2>{{ t('statusPage.uptime') }}</h2>
          <span v-if="data.grade" class="st-grade" :title="t('statusPage.grade')">{{ data.grade }}</span>
        </div>
        <div class="st-uptime">
          <div v-for="u in [['day', data.uptime_24h], ['week', data.uptime_7d], ['month', data.uptime_30d]]" :key="u[0]" class="st-up">
            <div class="st-up__value" :class="u[1] == null ? '' : `st-up--${barKind(u[1])}`">{{ pct(u[1]) }}</div>
            <div class="st-muted">{{ t(`statusPage.${u[0]}`) }}</div>
          </div>
        </div>
        <div class="st-bars-head">
          <span>{{ t('statusPage.bars') }}</span>
          <span class="st-muted">{{ hoverBar ? `${fmtDay(hoverBar.day)} — ${hoverBar.uptime == null ? t('statusPage.noData') : pct(hoverBar.uptime)}` : t('statusPage.barsHint') }}</span>
        </div>
        <div class="st-bars" @mouseleave="hoverBar = null">
          <span v-for="b in bars" :key="b.day" class="st-bar" :class="[`st-bar--${b.kind}`, { 'st-bar--hover': hoverBar?.day === b.day }]"
                :title="`${fmtDay(b.day)}: ${b.uptime == null ? t('statusPage.noData') : pct(b.uptime)}`" @mouseenter="hoverBar = b" />
        </div>
        <div class="st-legend">
          <span><i class="st-bar st-bar--good" />{{ t('statusPage.good') }}</span>
          <span><i class="st-bar st-bar--partial" />{{ t('statusPage.partial') }}</span>
          <span><i class="st-bar st-bar--bad" />{{ t('statusPage.bad') }}</span>
          <span><i class="st-bar st-bar--empty" />{{ t('statusPage.empty') }}</span>
        </div>
      </section>

      <section v-if="hasSeries" class="st-card">
        <div class="st-card__head">
          <h2>{{ t('statusPage.chart') }}</h2>
          <span class="st-muted">
            <template v-if="hp"><b class="st-strong">{{ fmtT(hp.t) }}</b> · {{ hp.online ?? '—' }}</template>
            <template v-else-if="data.peak_24h != null">{{ t('statusPage.peak') }}: {{ data.peak_24h }}</template>
          </span>
        </div>
        <svg :viewBox="`0 0 ${W} ${H}`" class="st-chart" @mousemove="move" @mouseleave="hover = null">
          <line v-for="v in [0, maxY / 2, maxY]" :key="v" :x1="P.l" :x2="W - P.r" :y1="py(v)" :y2="py(v)" class="st-grid" />
          <text v-for="v in [0, maxY / 2, maxY]" :key="`y${v}`" :x="P.l - 6" :y="py(v) + 3" text-anchor="end" class="st-axis">{{ Math.round(v) }}</text>
          <text v-for="tk in ticks" :key="tk.x" :x="tk.x" :y="H - 5" text-anchor="middle" class="st-axis">{{ tk.label }}</text>
          <path :d="areaPath" class="st-area" />
          <path :d="linePath" class="st-line" />
          <template v-if="hp">
            <line :x1="px(hover)" :x2="px(hover)" :y1="P.t" :y2="H - P.b" class="st-cross" />
            <circle v-if="hp.online != null" :cx="px(hover)" :cy="py(hp.online)" r="4" class="st-dot" />
          </template>
        </svg>
      </section>

      <section class="st-card">
        <div class="st-card__head"><h2>{{ t('statusPage.incidents') }}</h2></div>
        <div v-if="!data.incidents.length" class="st-calm">✓ {{ t('statusPage.noIncidents') }}</div>
        <ul v-else class="st-inc">
          <li v-for="(i, k) in data.incidents" :key="k" :class="{ 'st-inc--open': !i.ended_at }">
            <span class="st-inc__mark" :class="i.kind === 'down' ? 'st-inc__mark--down' : 'st-inc__mark--slow'" />
            <span class="st-inc__what">{{ i.kind === 'down' ? t('statusPage.down') : t('statusPage.slow') }}</span>
            <span class="st-muted">{{ fmtDateTime(i.started_at) }} · {{ i.ended_at ? dur(i.minutes) : `${t('statusPage.ongoing')} ${dur(i.minutes)}` }}</span>
          </li>
        </ul>
      </section>

      <footer class="st-foot">
        <span v-if="updatedAgo" class="st-muted">{{ t('statusPage.updated') }}: {{ updatedAgo }}</span>
        <a href="https://void-rp.ru" target="_blank" rel="noopener" class="st-powered">{{ t('statusPage.poweredBy') }}</a>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.st {
  --st-bg: #0a0d18; --st-card: rgba(19, 25, 43, 0.85); --st-line: rgba(148, 163, 184, 0.14);
  --st-text: #eef2ff; --st-dim: #94a3c4; --st-faint: #66728f; --st-acc: #8b5cf6;
  --st-good: #22c55e; --st-partial: #eab308; --st-bad: #ef4444; --st-empty: rgba(148, 163, 184, 0.22);
  min-height: 100vh; background: radial-gradient(1200px 500px at 50% -10%, rgba(139, 92, 246, 0.16), transparent), var(--st-bg);
  color: var(--st-text); font-family: inherit;
}
.st--light {
  --st-bg: #f6f7fb; --st-card: #ffffff; --st-line: rgba(15, 23, 42, 0.1);
  --st-text: #0f172a; --st-dim: #475569; --st-faint: #64748b; --st-empty: rgba(15, 23, 42, 0.12);
  background: var(--st-bg);
}
.st--embed { min-height: 0; background: transparent; }
.st-muted { color: var(--st-dim); font-size: 0.85rem; }
.st-strong { color: var(--st-text); }
.st-warn { color: var(--st-partial); }
.st-btn { margin-top: 0.8rem; padding: 0.5rem 1rem; border-radius: 10px; border: 1px solid var(--st-line); background: var(--st-card); color: var(--st-text); cursor: pointer; }
.st-msg { max-width: 30rem; margin: 0 auto; padding: 6rem 1rem; text-align: center; }
.st--embed .st-msg { padding: 1rem; }
.st-msg__title { font-size: 1.2rem; font-weight: 800; margin-bottom: 0.4rem; }
.st-skel { height: 320px; max-width: 880px; margin: 2rem auto; border-radius: 20px; background: var(--st-card); opacity: 0.5; animation: st-pulse 1.4s ease-in-out infinite; }
.st--embed .st-skel { height: 96px; margin: 0; }
@keyframes st-pulse { 50% { opacity: 0.25; } }

.st-page { max-width: 880px; margin: 0 auto; padding: 1.5rem 16px 3rem; display: flex; flex-direction: column; gap: 1rem; }

.st-hero { position: relative; border-radius: 22px; overflow: hidden; border: 1px solid var(--st-line); min-height: 190px; display: flex; align-items: flex-end; }
.st-hero__bg { position: absolute; inset: 0; background: linear-gradient(135deg, #241a5c, #12152b 60%, #0b0e1c); background-size: cover; background-position: center; }
.st-hero__shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10, 13, 24, 0.1), rgba(10, 13, 24, 0.85)); }
.st-hero__body { position: relative; display: flex; align-items: flex-end; gap: 1rem; padding: 1.3rem; width: 100%; flex-wrap: wrap; }
.st-hero__icon { width: 72px; height: 72px; border-radius: 18px; object-fit: cover; border: 2px solid rgba(255, 255, 255, 0.15); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); }
.st-hero__text { flex: 1; min-width: 12rem; }
.st-kicker { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #c4b5fd; }
.st-hero__name { margin: 0.15rem 0 0; font-size: clamp(1.4rem, 4vw, 2rem); font-weight: 900; color: #fff; }
.st-hero__desc { margin: 0.3rem 0 0; color: #cbd5f5; font-size: 0.9rem; }
.st-state { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.9rem; border-radius: 999px; font-weight: 800; font-size: 0.9rem; background: rgba(6, 9, 17, 0.7); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; }
.st-state__dot { width: 10px; height: 10px; border-radius: 50%; background: var(--st-faint); }
.st-state--up .st-state__dot { background: var(--st-good); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); animation: st-ping 2s infinite; }
.st-state--down .st-state__dot { background: var(--st-bad); }
.st-state--maint .st-state__dot { background: var(--st-partial); }
@keyframes st-ping { 70% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }

.st-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 0.7rem; }
.st-fact { padding: 0.85rem 1rem; border-radius: 16px; background: var(--st-card); border: 1px solid var(--st-line); min-width: 0; }
.st-fact--addr { grid-column: span 2; }
@media (max-width: 520px) { .st-fact--addr { grid-column: 1 / -1; } }
.st-fact__label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--st-faint); font-weight: 700; }
.st-fact__value { font-size: 1.5rem; font-weight: 900; margin-top: 0.15rem; font-variant-numeric: tabular-nums; }
.st-fact__value small { font-size: 0.85rem; color: var(--st-dim); font-weight: 600; }
.st-addr { margin-top: 0.3rem; display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.45rem 0.6rem; border-radius: 10px; border: 1px dashed var(--st-line); background: transparent; color: var(--st-text); cursor: pointer; text-align: left; }
.st-addr code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.95rem; font-weight: 700; }
.st-addr span { font-size: 0.75rem; color: var(--st-acc); font-weight: 700; white-space: nowrap; }
.st-addr:hover { border-color: var(--st-acc); }

.st-card { padding: 1rem 1.1rem 1.1rem; border-radius: 18px; background: var(--st-card); border: 1px solid var(--st-line); }
.st-card__head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem; margin-bottom: 0.8rem; }
.st-card__head h2 { margin: 0; font-size: 1rem; font-weight: 800; }
.st-grade { font-weight: 900; font-size: 0.85rem; padding: 0.15rem 0.55rem; border-radius: 8px; color: var(--st-good); border: 1px solid color-mix(in srgb, var(--st-good) 45%, transparent); }
.st-uptime { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-bottom: 1rem; }
.st-up { text-align: center; padding: 0.6rem; border-radius: 12px; background: color-mix(in srgb, var(--st-text) 4%, transparent); }
.st-up__value { font-size: 1.35rem; font-weight: 900; font-variant-numeric: tabular-nums; }
.st-up--good { color: var(--st-good); }
.st-up--partial { color: var(--st-partial); }
.st-up--bad { color: var(--st-bad); }
.st-bars-head { display: flex; justify-content: space-between; gap: 0.6rem; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.4rem; flex-wrap: wrap; }
.st-bars, .sw-bars { display: flex; gap: 3px; }
.st-bars { height: 38px; }
.st-bar { flex: 1; border-radius: 3px; background: var(--st-empty); transition: transform 0.12s; display: inline-block; }
.st-bars .st-bar:hover, .st-bar--hover { transform: scaleY(1.12); }
.st-bar--good { background: var(--st-good); }
.st-bar--partial { background: var(--st-partial); }
.st-bar--bad { background: var(--st-bad); }
.st-legend { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin-top: 0.7rem; font-size: 0.78rem; color: var(--st-dim); }
.st-legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
.st-legend .st-bar { flex: none; width: 10px; height: 10px; }

.st-chart { width: 100%; height: auto; display: block; cursor: crosshair; }
.st-grid { stroke: var(--st-line); }
.st-axis { fill: var(--st-faint); font-size: 10px; }
.st-area { fill: var(--st-acc); opacity: 0.16; }
.st-line { fill: none; stroke: var(--st-acc); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.st-cross { stroke: var(--st-faint); stroke-width: 1; }
.st-dot { fill: var(--st-acc); stroke: var(--st-bg); stroke-width: 2; }

.st-calm { color: var(--st-good); font-weight: 700; font-size: 0.9rem; }
.st-inc { list-style: none; margin: 0; padding: 0; }
.st-inc li { display: flex; align-items: baseline; gap: 0.6rem; padding: 0.5rem 0; border-bottom: 1px solid var(--st-line); flex-wrap: wrap; }
.st-inc li:last-child { border-bottom: 0; }
.st-inc__mark { width: 8px; height: 8px; border-radius: 50%; flex: none; align-self: center; }
.st-inc__mark--down { background: var(--st-bad); }
.st-inc__mark--slow { background: var(--st-partial); }
.st-inc__what { flex: 1; min-width: 10rem; font-weight: 600; font-size: 0.9rem; }
.st-inc--open .st-inc__what { color: var(--st-bad); }

.st-foot { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: 0.4rem 0.2rem; }
.st-powered { color: var(--st-dim); font-size: 0.82rem; text-decoration: none; font-weight: 700; }
.st-powered:hover { color: var(--st-acc); }

/* виджет */
.sw { display: flex; gap: 0.8rem; align-items: center; padding: 0.75rem 0.9rem; border-radius: 16px; background: var(--st-card); border: 1px solid var(--st-line); text-decoration: none; color: var(--st-text); max-width: 460px; }
.st:not(.st--light) .sw { background: rgba(15, 19, 34, 0.95); }
.sw:hover { border-color: var(--st-acc); }
.sw-icon { width: 52px; height: 52px; border-radius: 13px; object-fit: cover; flex: none; }
.sw-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.sw-name { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sw-line { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-size: 0.8rem; }
.sw-players { font-variant-numeric: tabular-nums; color: var(--st-dim); }
.sw-players b { color: var(--st-text); }
.sw-bars { height: 14px; }
.st-pill { display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 800; font-size: 0.78rem; }
.st-pill i { width: 8px; height: 8px; border-radius: 50%; background: var(--st-faint); }
.st-pill--up { color: var(--st-good); } .st-pill--up i { background: var(--st-good); }
.st-pill--down { color: var(--st-bad); } .st-pill--down i { background: var(--st-bad); }
.st-pill--maint { color: var(--st-partial); } .st-pill--maint i { background: var(--st-partial); }
@media (prefers-reduced-motion: reduce) { .st-state--up .st-state__dot { animation: none; } }
</style>
