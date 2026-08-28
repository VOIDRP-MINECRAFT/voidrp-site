<script setup>
import { computed, defineComponent, h, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import {
  getServerMetrics,
  getServerLive,
  runRconCommand,
  moderatePlayer,
  serverPowerAction,
  getServerLogs,
  getServerHangs,
  getServerChat,
} from '../../services/adminServerOpsApi.js'
import { authState, hasPermission } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { toastError, toastSuccess } from '../../services/toast'
import { confirmDialog } from '../../composables/useConfirm'

const token = () => authState.accessToken

// ── Inline sparkline (interactive) ──────────────────────────────────────────
// Compact filled trend line from a numeric series. Auto-scales unless an explicit
// min/max is given (util % use 0..100 so the band is stable). Hovering shows a
// crosshair + dot + value tooltip so you can read any point; the peak sample is
// always marked with a dot so spikes are visible at a glance.
const Spark = defineComponent({
  props: {
    values: { type: Array, default: () => [] },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    klass: { type: String, default: '' },
    // Value formatting in the tooltip: 'pct' → «57%», 'tps' → «19.8», 'raw' → int.
    unit: { type: String, default: 'pct' },
  },
  setup(props) {
    const W = 100
    const H = 26
    const hover = ref(-1) // hovered sample index, -1 = none

    const data = computed(() => (props.values || []).filter((v) => v != null && !Number.isNaN(v)))
    const bounds = computed(() => {
      const vals = data.value
      const min = props.min ?? (vals.length ? Math.min(...vals) : 0)
      const max = props.max ?? (vals.length ? Math.max(...vals) : 1)
      return { min, max, span: max - min || 1 }
    })
    // Index of the peak (max) sample — always highlighted so spikes stand out.
    const peakIdx = computed(() => {
      const vals = data.value
      let idx = -1
      let best = -Infinity
      vals.forEach((v, i) => { if (v > best) { best = v; idx = i } })
      return idx
    })

    const xFrac = (i, n) => (n <= 1 ? 0 : i / (n - 1)) // 0..1 across width
    const yFrac = (v) => {
      const { min, max, span } = bounds.value
      return (H - ((Math.min(Math.max(v, min), max) - min) / span) * H) / H // 0..1 top→bottom
    }
    function fmt(v) {
      if (v == null) return '—'
      if (props.unit === 'tps') return v.toFixed(1)
      if (props.unit === 'raw') return String(Math.round(v))
      return `${Math.round(v)}%`
    }

    function onMove(e) {
      const vals = data.value
      if (vals.length < 2) return
      const rect = e.currentTarget.getBoundingClientRect()
      const frac = (e.clientX - rect.left) / (rect.width || 1)
      hover.value = Math.min(vals.length - 1, Math.max(0, Math.round(frac * (vals.length - 1))))
    }
    function onLeave() { hover.value = -1 }

    // All styles are inline: elements built in a render function don't inherit
    // the SFC's scoped data-v attribute, so scoped `.ops-spark*` selectors would
    // never match them (only the component root does). Inline is the reliable path.
    const WRAP_STYLE = { position: 'relative', width: '100%', height: `${H}px` }
    const SVG_STYLE = { width: '100%', height: `${H}px`, display: 'block', overflow: 'visible', cursor: 'crosshair', touchAction: 'none' }

    return () => {
      const vals = data.value
      const color = { 'is-ok': 'var(--adm-ok)', 'is-warn': 'var(--adm-warn)', 'is-crit': 'var(--adm-err)' }[props.klass]
        || 'var(--adm-acc)'

      if (vals.length < 2) {
        return h('div', { style: WRAP_STYLE }, [
          h('svg', { style: SVG_STYLE, viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' }),
        ])
      }

      const n = vals.length
      const pts = vals.map((v, i) => `${(xFrac(i, n) * W).toFixed(1)},${(yFrac(v) * H).toFixed(1)}`).join(' ')
      const hi = hover.value
      const children = [
        h('svg', {
          style: SVG_STYLE,
          viewBox: `0 0 ${W} ${H}`,
          preserveAspectRatio: 'none',
          onPointermove: onMove,
          onPointerleave: onLeave,
        }, [
          h('polygon', { points: `0,${H} ${pts} ${W},${H}`, style: { fill: color, opacity: '0.12', stroke: 'none' } }),
          h('polyline', {
            points: pts,
            style: { fill: 'none', stroke: color, strokeWidth: '1.5', vectorEffect: 'non-scaling-stroke' },
          }),
        ]),
      ]

      // Peak marker (round HTML dot — SVG circles distort under preserveAspectRatio="none").
      if (peakIdx.value >= 0) {
        children.push(h('span', {
          style: {
            position: 'absolute', pointerEvents: 'none', width: '5px', height: '5px',
            borderRadius: '50%', transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 2px var(--adm-card)', background: color,
            left: `${xFrac(peakIdx.value, n) * 100}%`, top: `${yFrac(vals[peakIdx.value]) * 100}%`,
          },
        }))
      }

      // Hover crosshair + dot + value tooltip.
      if (hi >= 0) {
        const leftPct = xFrac(hi, n) * 100
        children.push(h('span', {
          style: {
            position: 'absolute', pointerEvents: 'none', top: '0', bottom: '0', width: '1px',
            opacity: '0.55', transform: 'translateX(-50%)', background: color, left: `${leftPct}%`,
          },
        }))
        children.push(h('span', {
          style: {
            position: 'absolute', pointerEvents: 'none', width: '7px', height: '7px', borderRadius: '50%',
            background: 'var(--adm-card)', border: `1.5px solid ${color}`, transform: 'translate(-50%, -50%)',
            left: `${leftPct}%`, top: `${yFrac(vals[hi]) * 100}%`,
          },
        }))
        children.push(h('span', {
          style: {
            position: 'absolute', pointerEvents: 'none', bottom: 'calc(100% + 5px)',
            transform: 'translateX(-50%)', left: `${Math.min(90, Math.max(10, leftPct))}%`,
            padding: '0.12rem 0.4rem', borderRadius: '6px', background: 'var(--adm-card-2)',
            border: '1px solid var(--adm-line-strong)', boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
            fontSize: '0.68rem', fontWeight: '800', lineHeight: '1', color: 'var(--adm-text)',
            whiteSpace: 'nowrap', zIndex: '5',
          },
        }, fmt(vals[hi])))
      }

      return h('div', { style: WRAP_STYLE, onPointerleave: onLeave }, children)
    }
  },
})

// ── Rolling history (client-side ring buffer, no backend/DB) ────────────────
const HIST = 60
const cpuHist = ref([])
const ramHist = ref([])
const procHist = ref([])
const tpsHist = ref([])
const heapHist = ref([])
function pushHist(buf, v) {
  if (v == null || Number.isNaN(v)) return
  buf.value.push(v)
  if (buf.value.length > HIST) buf.value.splice(0, buf.value.length - HIST)
}

const canRcon = hasPermission('monitoring.rcon')
const canPower = hasPermission('monitoring.restart')
const canViewPlayers = hasPermission('players.online.view')
const canModerate = hasPermission('players.online.moderate')
const serverName = computed(() => activeServer.value?.name || 'сервер')

// ── State ───────────────────────────────────────────────────────────────────
const metrics = ref(null)
const live = ref(null)
const metricsErr = ref('')
const firstLoad = ref(true)
const autoRefresh = ref(true)
const lastUpdated = ref(0)
const nowTick = ref(Date.now())

const updatedAgo = computed(() => {
  if (!lastUpdated.value) return null
  const s = Math.max(0, Math.round((nowTick.value - lastUpdated.value) / 1000))
  if (s < 5) return 'только что'
  if (s < 60) return `${s} сек назад`
  return `${Math.floor(s / 60)} мин назад`
})

let metricsTimer = null
let liveTimer = null
let tickTimer = null
let hangsTimer = null

// ── Formatters ──────────────────────────────────────────────────────────────
function fmtBytes(n) {
  if (n == null) return '—'
  const u = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}
function fmtDuration(sec) {
  if (sec == null) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}д ${h}ч`
  if (h > 0) return `${h}ч ${m}м`
  return `${m}м`
}
function pct(v) { return v == null ? '—' : `${Math.round(v)}%` }

// Color band for a 0..100 utilization value (green→amber→red).
function utilClass(v) {
  if (v == null) return ''
  if (v >= 90) return 'is-crit'
  if (v >= 75) return 'is-warn'
  return 'is-ok'
}

// ── Derived ─────────────────────────────────────────────────────────────────
const host = computed(() => metrics.value?.host || null)
const proc = computed(() => metrics.value?.process || null)
const disk = computed(() => metrics.value?.disk || null)
const jvm = computed(() => metrics.value?.jvm || null)
const unitState = computed(() => metrics.value?.unit_state || null)
const notConfigured = computed(() => !firstLoad.value && metrics.value && !metrics.value.unit)

// ── Power control (start / restart / stop the systemd unit) ─────────────────
// Buttons enable per current state: start only when the unit is down, restart /
// stop only when it's up. Any in-flight action disables all three.
const powerBusy = ref(false)
const canStart = computed(() => !!unitState.value && unitState.value !== 'active')
const canRestartUnit = computed(() => unitState.value === 'active')
const canStopUnit = computed(() => unitState.value === 'active')

async function powerAction(action) {
  const meta = {
    start: { verb: 'Запустить', confirm: false, danger: false },
    restart: { verb: 'Перезапустить', confirm: true, danger: true },
    stop: { verb: 'Остановить', confirm: true, danger: true },
  }[action]
  if (!meta || powerBusy.value) return
  if (meta.confirm) {
    const ok = await confirmDialog({
      title: `${meta.verb} сервер`,
      message: action === 'stop'
        ? `Остановить сервер «${serverName.value}»? Все игроки будут отключены, автозапуск службы не сработает.`
        : `Перезапустить сервер «${serverName.value}»? Все игроки будут отключены на время перезапуска.`,
      confirmLabel: meta.verb,
      danger: meta.danger,
    })
    if (!ok) return
  }
  powerBusy.value = true
  try {
    await serverPowerAction(token(), action)
    toastSuccess(`${meta.verb}: команда отправлена`)
    // The job is queued (--no-block); poll a couple of times to catch the flip.
    setTimeout(loadMetrics, 1500)
    setTimeout(loadMetrics, 5000)
  } catch (e) {
    toastError(e?.message || 'Не удалось выполнить действие')
  } finally {
    powerBusy.value = false
  }
}

// Process CPU is per-core (can exceed 100%). Normalize to a share of all cores.
const procCpuOfHost = computed(() => {
  if (!proc.value || !host.value?.cpu_count) return null
  return Math.min(100, proc.value.cpu_percent / host.value.cpu_count)
})

const tps = computed(() => live.value?.tps || null)
function tpsClass(v) {
  if (v == null) return ''
  if (v >= 19.5) return 'is-ok'
  if (v >= 15) return 'is-warn'
  return 'is-crit'
}

// Per-dimension TPS (NeoForge), worst first — pinpoints which world is lagging.
// Strip the redundant `minecraft:` namespace for compactness in the UI.
const tpsDims = computed(() => {
  const d = tps.value?.dimensions
  if (!d?.length) return []
  return [...d]
    .sort((a, b) => a.tps - b.tps)
    .map((x) => ({ ...x, label: (x.dim || '').replace(/^minecraft:/, '') }))
})

// ── Threshold alerts ────────────────────────────────────────────────────────
// Fire a toast when TPS or host RAM crosses a danger line, but throttle each
// alert to once per 2 min so a sustained problem doesn't spam the operator.
const ALERT_COOLDOWN = 120000
const lastAlert = { tps: 0, ram: 0 }
function maybeAlert(key, cond, msg) {
  if (!cond) return
  const now = Date.now()
  if (now - lastAlert[key] < ALERT_COOLDOWN) return
  lastAlert[key] = now
  toastError(msg)
}
watch(() => live.value?.tps?.tps, (v) => {
  if (v != null) maybeAlert('tps', v < 12, `⚠️ TPS упал до ${v.toFixed(1)} на «${activeServer.value?.name || 'сервере'}»`)
})
watch(() => metrics.value?.host?.mem_percent, (v) => {
  if (v != null) maybeAlert('ram', v > 92, `⚠️ RAM хоста ${Math.round(v)}% на «${activeServer.value?.name || 'сервере'}»`)
})

// ── Loaders (in-flight guards prevent poll pile-up on a slow server) ─────────
let metricsBusy = false
let liveBusy = false

async function loadMetrics() {
  if (metricsBusy) return
  metricsBusy = true
  try {
    metrics.value = await getServerMetrics(token())
    metricsErr.value = ''
    lastUpdated.value = Date.now()
    pushHist(cpuHist, metrics.value?.host?.cpu_percent)
    pushHist(ramHist, metrics.value?.host?.mem_percent)
    pushHist(procHist, procCpuOfHost.value)
    pushHist(heapHist, metrics.value?.jvm?.heap_percent)
  } catch (e) {
    metricsErr.value = e.message || 'Ошибка загрузки метрик'
  } finally {
    metricsBusy = false
    firstLoad.value = false
  }
}
async function loadLive() {
  if (liveBusy) return
  liveBusy = true
  try {
    live.value = await getServerLive(token())
    pushHist(tpsHist, live.value?.tps?.tps)
  } catch {
    /* live is best-effort */
  } finally {
    liveBusy = false
  }
}
async function refreshAll() {
  await Promise.all([loadMetrics(), loadLive()])
}

// ── RCON console ────────────────────────────────────────────────────────────
const consoleLines = ref([]) // {cmd, out, ts, error}
const rconInput = ref('')
const rconBusy = ref(false)
const consoleRef = ref(null)

// Weather/time are intercepted by Bukkit on the hybrid Mohist server (youer),
// where the `minecraft:` prefix forces the vanilla command — but on pure
// NeoForge (abyss) that namespaced form is "unknown". Both servers report
// loader=neoforge, so we can't tell them apart by config: send the `minecraft:`
// form first (works + correct behaviour on Mohist), and on an "unknown command"
// error fall back to the bare form (NeoForge). Both commands are idempotent, so
// the failed first attempt has no side effect.
const quickCmds = [
  { label: 'save-all', cmd: 'save-all' },
  { label: 'Список', cmd: 'list' },
  { label: 'День', cmd: 'minecraft:time set day', alt: 'time set day' },
  { label: 'Ночь', cmd: 'minecraft:time set night', alt: 'time set night' },
  { label: 'Ясно', cmd: 'minecraft:weather clear', alt: 'weather clear' },
  { label: 'TPS', cmd: 'neoforge tps' },
]

// Response text that means the command form wasn't understood → try the fallback.
const CMD_ERR_RE = /Unknown or incomplete command|<--\[HERE\]|usage is|^Ошибка/i

function pushConsole(cmd, out, error = false) {
  consoleLines.value.push({ cmd, out, ts: Date.now(), error })
  if (consoleLines.value.length > 100) consoleLines.value.splice(0, consoleLines.value.length - 100)
  nextTick(() => { if (consoleRef.value) consoleRef.value.scrollTop = consoleRef.value.scrollHeight })
}

// Run one command, returning { out, error } without touching the console log.
async function execRcon(command) {
  try {
    const res = await runRconCommand(token(), command)
    return { out: res.output || '(пусто)', error: false }
  } catch (e) {
    return { out: e.message || 'Ошибка RCON', error: true }
  }
}

async function sendRcon(cmd) {
  const command = (cmd ?? rconInput.value).trim()
  if (!command || rconBusy.value) return
  rconBusy.value = true
  try {
    const r = await execRcon(command)
    pushConsole(command, r.out, r.error)
    if (cmd == null) rconInput.value = ''
  } finally {
    rconBusy.value = false
  }
}

// Quick button: try the primary form, fall back to the alt form on an
// "unknown command" style response (Bukkit-hybrid vs pure-NeoForge syntax).
async function runQuick(q) {
  if (rconBusy.value) return
  if (!q.alt) return sendRcon(q.cmd)
  rconBusy.value = true
  try {
    let { out, error } = await execRcon(q.cmd)
    let used = q.cmd
    if (error || CMD_ERR_RE.test(out)) {
      const retry = await execRcon(q.alt)
      out = retry.out; error = retry.error; used = q.alt
    }
    pushConsole(used, out, error)
  } finally {
    rconBusy.value = false
  }
}

const broadcast = ref('')
async function sendBroadcast() {
  const t = broadcast.value.trim()
  if (!t) return
  await sendRcon(`say ${t}`)
  broadcast.value = ''
}

// ── Player moderation ───────────────────────────────────────────────────────
const players = computed(() => live.value?.players?.players || [])

async function moderate(action, name) {
  const verbs = { kick: 'кикнуть', ban: 'забанить', op: 'выдать OP' }
  if (action === 'ban' || action === 'op') {
    const ok = await confirmDialog({
      title: `${verbs[action][0].toUpperCase()}${verbs[action].slice(1)} игрока`,
      message: `Точно ${verbs[action]} игрока ${name}?`,
      confirmLabel: verbs[action][0].toUpperCase() + verbs[action].slice(1),
      danger: action === 'ban',
    })
    if (!ok) return
  }
  // Dedicated moderation endpoint (permission players.online.moderate) — not the
  // general RCON console, so a moderator can kick/ban/op without full RCON.
  try {
    const res = await moderatePlayer(token(), action, name)
    toastSuccess(`${verbs[action]}: ${name}`)
    if (canRcon) pushConsole(`${action} ${name}`, res.output, false)
    if (action !== 'op') setTimeout(loadLive, 800)
  } catch (e) {
    toastError(e?.message || 'Не удалось выполнить действие')
  }
}

// ── Log viewer ──────────────────────────────────────────────────────────────
const logSource = ref('server')
const logLines = ref([])
const logPath = ref('')
const logAvailable = ref(true)
const logBusy = ref(false)
const logAuto = ref(true)
const logFilter = ref('')
const logRef = ref(null)
let logTimer = null

const filteredLog = computed(() => {
  const f = logFilter.value.trim().toLowerCase()
  if (!f) return logLines.value
  return logLines.value.filter((l) => l.toLowerCase().includes(f))
})

function logLevelClass(line) {
  if (/\/(ERROR|FATAL)\]/.test(line) || /\bERROR\b/.test(line)) return 'lg-error'
  if (/\/WARN\]/.test(line) || /\bWARN\b/.test(line)) return 'lg-warn'
  if (/HUNG|Watchdog|crash/i.test(line)) return 'lg-warn'
  return ''
}

async function loadLogs() {
  if (logBusy.value) return
  logBusy.value = true
  try {
    const res = await getServerLogs(token(), { source: logSource.value, lines: 300 })
    logLines.value = res.lines || []
    logPath.value = res.path || ''
    logAvailable.value = res.available !== false
    if (logAuto.value) {
      await nextTick()
      if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight
    }
  } catch (e) {
    logAvailable.value = false
  } finally {
    logBusy.value = false
  }
}
function switchLogSource(s) {
  logSource.value = s
  loadLogs()
}

// ── In-game chat feed ───────────────────────────────────────────────────────
const chatMsgs = ref([])
const chatAvailable = ref(true)
const chatAuto = ref(true)
const chatFilter = ref('')
const chatRef = ref(null)
let chatTimer = null
let chatBusy = false

const filteredChat = computed(() => {
  const f = chatFilter.value.trim().toLowerCase()
  if (!f) return chatMsgs.value
  return chatMsgs.value.filter((m) => m.text.toLowerCase().includes(f))
})

async function loadChat() {
  if (chatBusy) return
  chatBusy = true
  try {
    const res = await getServerChat(token(), { limit: 250 })
    chatMsgs.value = res.messages || []
    chatAvailable.value = res.available !== false
    if (chatAuto.value) {
      await nextTick()
      if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight
    }
  } catch {
    chatAvailable.value = false
  } finally {
    chatBusy = false
  }
}

// ── Recent hangs (watchdog / HUNG_TICK summary lines) ───────────────────────
const hangs = ref([])
const hangsAvailable = ref(true)
let hangsBusy = false
async function loadHangs() {
  if (hangsBusy) return
  hangsBusy = true
  try {
    const res = await getServerHangs(token(), { limit: 50 })
    // Newest first for display; backend returns oldest→newest.
    hangs.value = (res.hangs || []).slice().reverse()
    hangsAvailable.value = res.available !== false
  } catch {
    /* best-effort */
  } finally {
    hangsBusy = false
  }
}
// Severity band by stalled tick duration (seconds). Watchdog fires past ~60s.
function hangClass(sec) {
  if (sec == null) return ''
  if (sec >= 60) return 'is-crit'
  if (sec >= 15) return 'is-warn'
  return ''
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
function startTimers() {
  stopTimers()
  metricsTimer = setInterval(loadMetrics, 4000)
  liveTimer = setInterval(loadLive, 6000)
  logTimer = setInterval(() => { if (logAuto.value) loadLogs() }, 5000)
  chatTimer = setInterval(() => { if (chatAuto.value) loadChat() }, 5000)
  hangsTimer = setInterval(loadHangs, 20000)
  tickTimer = setInterval(() => { nowTick.value = Date.now() }, 1000)
}
function stopTimers() {
  clearInterval(metricsTimer); clearInterval(liveTimer); clearInterval(logTimer)
  clearInterval(chatTimer); clearInterval(hangsTimer); clearInterval(tickTimer)
  metricsTimer = liveTimer = logTimer = chatTimer = hangsTimer = tickTimer = null
}
function toggleAuto() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) { refreshAll(); startTimers() }
  else stopTimers()
}

// Pause polling while the tab is hidden — no point hammering RCON / the CPU
// sampler in a background tab. Resume (with an immediate refresh) on return.
function onVisibility() {
  if (document.hidden) {
    stopTimers()
  } else if (autoRefresh.value) {
    refreshAll()
    if (logAuto.value) loadLogs()
    if (chatAuto.value) loadChat()
    loadHangs()
    startTimers()
  }
}

onMounted(async () => {
  await refreshAll()
  await loadLogs()
  loadChat()
  loadHangs()
  if (autoRefresh.value) startTimers()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  stopTimers()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Мониторинг · {{ serverName }}</h1>
        <p class="adm-sub">Ресурсы хоста, процесс сервера, RCON-консоль и логи выбранного сервера</p>
      </div>
      <div class="adm-head-actions">
        <span v-if="updatedAgo" class="ops-updated adm-mono">обновлено {{ updatedAgo }}</span>
        <span v-if="unitState" class="adm-badge" :class="unitState === 'active' ? 'adm-badge--ok' : 'adm-badge--err'">
          <span class="adm-dot" :class="unitState === 'active' ? 'adm-dot--ok' : 'adm-dot--err'" />
          {{ unitState === 'active' ? 'служба активна' : unitState }}
        </span>
        <div v-if="canPower && unitState" class="ops-power">
          <button class="adm-btn adm-btn--ok" :disabled="powerBusy || !canStart" @click="powerAction('start')" title="Запустить службу сервера">Запустить</button>
          <button class="adm-btn" :disabled="powerBusy || !canRestartUnit" @click="powerAction('restart')" title="Перезапустить службу сервера">Перезапустить</button>
          <button class="adm-btn adm-btn--danger" :disabled="powerBusy || !canStopUnit" @click="powerAction('stop')" title="Остановить службу сервера">Остановить</button>
        </div>
        <button class="adm-btn" :class="autoRefresh ? 'adm-btn--ok' : ''" @click="toggleAuto" :title="autoRefresh ? 'Поставить авто-обновление на паузу' : 'Возобновить авто-обновление'">
          <span class="adm-dot" :class="autoRefresh ? 'adm-dot--ok' : 'adm-dot--warn'" />
          {{ autoRefresh ? 'Авто-обновление' : 'На паузе' }}
        </button>
        <button class="adm-btn adm-btn--acc" @click="refreshAll">Обновить</button>
      </div>
    </div>

    <div v-if="notConfigured" class="adm-empty">
      <div class="adm-empty__title">Мониторинг не настроен для этого сервера</div>
      <div class="adm-empty__sub">
        Укажите systemd-юнит и RCON в разделе «Серверы» → редактирование сервера
        (блок «Мониторинг и RCON»), чтобы включить метрики и консоль.
      </div>
    </div>

    <!-- ── Метрики ──────────────────────────────────────────────── -->
    <div class="ops-grid">
      <!-- CPU хоста -->
      <div class="adm-card adm-card--pad ops-metric">
        <div class="ops-metric__top">
          <span class="ops-metric__label">CPU хоста</span>
          <span class="ops-metric__val adm-num" :class="utilClass(host?.cpu_percent)">{{ pct(host?.cpu_percent) }}</span>
        </div>
        <div class="ops-bar"><span class="ops-bar__fill" :class="utilClass(host?.cpu_percent)" :style="{ width: `${host?.cpu_percent || 0}%` }" /></div>
        <Spark :values="cpuHist" :min="0" :max="100" :klass="utilClass(host?.cpu_percent)" />
        <div class="ops-metric__meta adm-mono">
          {{ host?.cpu_count || '—' }} ядер · load {{ host?.load_avg?.map(x => x.toFixed(1)).join(' / ') || '—' }}
        </div>
      </div>

      <!-- RAM хоста -->
      <div class="adm-card adm-card--pad ops-metric">
        <div class="ops-metric__top">
          <span class="ops-metric__label">RAM хоста</span>
          <span class="ops-metric__val adm-num" :class="utilClass(host?.mem_percent)">{{ pct(host?.mem_percent) }}</span>
        </div>
        <div class="ops-bar"><span class="ops-bar__fill" :class="utilClass(host?.mem_percent)" :style="{ width: `${host?.mem_percent || 0}%` }" /></div>
        <Spark :values="ramHist" :min="0" :max="100" :klass="utilClass(host?.mem_percent)" />
        <div class="ops-metric__meta adm-mono">{{ fmtBytes(host?.mem_used) }} / {{ fmtBytes(host?.mem_total) }}</div>
      </div>

      <!-- Диск -->
      <div class="adm-card adm-card--pad ops-metric">
        <div class="ops-metric__top">
          <span class="ops-metric__label">Диск сервера</span>
          <span class="ops-metric__val adm-num" :class="utilClass(disk?.percent)">{{ pct(disk?.percent) }}</span>
        </div>
        <div class="ops-bar"><span class="ops-bar__fill" :class="utilClass(disk?.percent)" :style="{ width: `${disk?.percent || 0}%` }" /></div>
        <div class="ops-metric__meta adm-mono">
          {{ fmtBytes(disk?.used) }} / {{ fmtBytes(disk?.total) }}
          <template v-if="disk"> · {{ disk.device || disk.mountpoint }} <span v-if="disk.fstype">({{ disk.fstype }})</span></template>
        </div>
      </div>

      <!-- Процесс JVM -->
      <div class="adm-card adm-card--pad ops-metric">
        <div class="ops-metric__top">
          <span class="ops-metric__label">Процесс сервера</span>
          <span class="ops-metric__val adm-num" :class="utilClass(procCpuOfHost)">{{ pct(procCpuOfHost) }}</span>
        </div>
        <div class="ops-bar"><span class="ops-bar__fill" :class="utilClass(procCpuOfHost)" :style="{ width: `${procCpuOfHost || 0}%` }" /></div>
        <Spark :values="procHist" :min="0" :max="100" :klass="utilClass(procCpuOfHost)" />
        <div class="ops-metric__meta adm-mono">
          <template v-if="proc">RAM {{ fmtBytes(proc.mem_rss) }} · {{ proc.threads }} потоков · pid {{ proc.pid }}</template>
          <template v-else>процесс не найден</template>
        </div>
      </div>

      <!-- JVM heap / GC -->
      <div v-if="jvm" class="adm-card adm-card--pad ops-metric">
        <div class="ops-metric__top">
          <span class="ops-metric__label">JVM Heap</span>
          <span class="ops-metric__val adm-num" :class="utilClass(jvm.heap_percent)">{{ pct(jvm.heap_percent) }}</span>
        </div>
        <div class="ops-bar"><span class="ops-bar__fill" :class="utilClass(jvm.heap_percent)" :style="{ width: `${jvm.heap_percent || 0}%` }" /></div>
        <Spark :values="heapHist" :min="0" :max="100" :klass="utilClass(jvm.heap_percent)" />
        <div class="ops-metric__meta adm-mono">
          {{ fmtBytes(jvm.heap_used) }} / {{ fmtBytes(jvm.heap_max) }}
          <template v-if="jvm.meta_used"> · Meta {{ fmtBytes(jvm.meta_used) }}</template>
        </div>
      </div>

      <!-- TPS -->
      <div class="adm-card adm-card--pad ops-metric ops-metric--accent">
        <div class="ops-metric__top">
          <span class="ops-metric__label">TPS</span>
          <span class="ops-metric__val adm-num" :class="tpsClass(tps?.tps)">{{ tps?.tps != null ? tps.tps.toFixed(1) : '—' }}</span>
        </div>
        <Spark :values="tpsHist" :min="0" :max="20" :klass="tpsClass(tps?.tps)" unit="tps" />
        <div v-if="tps?.windows" class="ops-tps-windows adm-mono">
          <span v-for="(v, k) in tps.windows" :key="k"><b>{{ k }}</b> {{ v }}</span>
        </div>
        <div v-else class="ops-metric__meta adm-mono">
          {{ tps?.mspt != null ? `${tps.mspt} мс/такт` : (live?.rcon_configured ? 'нет данных' : 'RCON не настроен') }}
        </div>
        <div v-if="tpsDims.length" class="ops-tps-dims adm-mono">
          <div v-for="d in tpsDims" :key="d.dim" class="ops-tps-dim" :class="tpsClass(d.tps)">
            <span class="ops-tps-dim__name">{{ d.label }}</span>
            <span class="ops-tps-dim__val">{{ d.tps.toFixed(1) }}<template v-if="d.mspt != null"> · {{ d.mspt }}мс</template></span>
          </div>
        </div>
      </div>

      <!-- Игроки / аптайм -->
      <div class="adm-card adm-card--pad ops-metric">
        <div class="ops-metric__top">
          <span class="ops-metric__label">Онлайн</span>
          <span class="ops-metric__val adm-num">
            {{ live?.players?.online ?? '—' }}<span v-if="live?.players?.max" class="ops-metric__val-sub">/{{ live.players.max }}</span>
          </span>
        </div>
        <div class="ops-metric__meta adm-mono">
          аптайм сервера {{ fmtDuration(proc?.uptime_seconds) }} · хост {{ fmtDuration(host?.uptime_seconds) }}
        </div>
      </div>
    </div>

    <!-- ── Консоль + игроки ─────────────────────────────────────── -->
    <div class="ops-cols">
      <!-- RCON console -->
      <div v-if="canRcon" class="adm-card ops-console">
        <div class="adm-card__head">
          <h3 class="adm-card__title">RCON-консоль</h3>
          <div class="ops-quick">
            <button v-for="q in quickCmds" :key="q.cmd" class="adm-btn adm-btn--sm" :disabled="rconBusy" @click="runQuick(q)">{{ q.label }}</button>
          </div>
        </div>
        <div ref="consoleRef" class="ops-console__out">
          <div v-if="!consoleLines.length" class="ops-console__empty">Выполните команду — вывод появится здесь</div>
          <div v-for="(l, i) in consoleLines" :key="i" class="ops-console__entry">
            <div class="ops-console__cmd">&gt; {{ l.cmd }}</div>
            <pre class="ops-console__res" :class="{ 'is-error': l.error }">{{ l.out }}</pre>
          </div>
        </div>
        <form class="ops-console__bar" @submit.prevent="sendRcon()">
          <input v-model="rconInput" class="adm-input adm-mono" placeholder="команда без /  напр. give Steve diamond 1" :disabled="rconBusy" />
          <button type="submit" class="adm-btn adm-btn--acc" :disabled="rconBusy || !rconInput.trim()">Отправить</button>
        </form>
        <form class="ops-console__bar" @submit.prevent="sendBroadcast">
          <input v-model="broadcast" class="adm-input" placeholder="Объявление всем игрокам (say)" />
          <button type="submit" class="adm-btn" :disabled="!broadcast.trim()">Объявить</button>
        </form>
      </div>

      <!-- Players -->
      <div v-if="canViewPlayers" class="adm-card ops-players">
        <div class="adm-card__head">
          <h3 class="adm-card__title">Игроки онлайн</h3>
          <span class="adm-badge">{{ players.length }}</span>
        </div>
        <div class="ops-players__list">
          <div v-if="!players.length" class="ops-console__empty">Никого онлайн</div>
          <div v-for="p in players" :key="p" class="ops-player">
            <span class="adm-avatar ops-player__ava">{{ p.charAt(0).toUpperCase() }}</span>
            <RouterLink class="ops-player__name adm-mono" :to="`/admin/players/${p}`" title="Открыть карточку игрока">{{ p }}</RouterLink>
            <div v-if="canModerate" class="ops-player__acts">
              <button class="adm-btn adm-btn--sm" title="Кик" @click="moderate('kick', p)">Кик</button>
              <button class="adm-btn adm-btn--sm adm-btn--danger" title="Бан" @click="moderate('ban', p)">Бан</button>
              <button class="adm-btn adm-btn--sm adm-btn--ok" title="Выдать OP" @click="moderate('op', p)">OP</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Недавние зависания (Watchdog / HUNG_TICK) ─────────────── -->
    <div class="adm-card ops-hangs">
      <div class="adm-card__head">
        <h3 class="adm-card__title">Недавние зависания</h3>
        <div class="ops-hangs__head-r">
          <span class="adm-badge" :class="hangs.length ? 'adm-badge--err' : 'adm-badge--ok'">{{ hangs.length }}</span>
          <button class="adm-btn adm-btn--sm" @click="loadHangs">Обновить</button>
        </div>
      </div>
      <div class="ops-hangs__body">
        <div v-if="!hangsAvailable" class="ops-console__empty">Лог недоступен</div>
        <div v-else-if="!hangs.length" class="ops-console__empty">Зависаний в логе не найдено — сервер стабилен</div>
        <div v-for="(hg, i) in hangs" :key="i" class="ops-hang" :class="hangClass(hg.seconds)">
          <span class="ops-hang__time adm-mono">{{ hg.time || '—' }}</span>
          <span v-if="hg.seconds != null" class="ops-hang__dur adm-mono">{{ hg.seconds.toFixed(1) }}с</span>
          <span class="ops-hang__text adm-mono">{{ hg.text }}</span>
        </div>
      </div>
    </div>

    <!-- ── Игровой чат ───────────────────────────────────────────── -->
    <div class="adm-card ops-chat">
      <div class="adm-card__head ops-chat__head">
        <h3 class="adm-card__title">Игровой чат</h3>
        <div class="ops-chat__tools">
          <input v-model="chatFilter" class="adm-input adm-input--sm" placeholder="поиск по чату…" />
          <label class="adm-check"><input v-model="chatAuto" type="checkbox" /> авто</label>
          <button class="adm-btn adm-btn--sm" @click="loadChat">Обновить</button>
        </div>
      </div>
      <div ref="chatRef" class="ops-chat__body">
        <div v-if="!chatAvailable" class="ops-console__empty">Файл лога недоступен</div>
        <div v-else-if="!filteredChat.length" class="ops-console__empty">Пока нет сообщений</div>
        <div v-for="(m, i) in filteredChat" :key="i" class="ops-chat__line" :class="`is-${m.type}`">
          <span class="ops-chat__time adm-mono">{{ m.time }}</span>
          <span class="ops-chat__text">{{ m.text }}</span>
        </div>
      </div>
    </div>

    <!-- ── Логи ──────────────────────────────────────────────────── -->
    <div class="adm-card ops-logs">
      <div class="adm-card__head ops-logs__head">
        <div class="adm-tabs">
          <button class="adm-tab" :class="{ 'adm-tab--active': logSource === 'server' }" @click="switchLogSource('server')">Лог сервера</button>
          <button class="adm-tab" :class="{ 'adm-tab--active': logSource === 'watchdog' }" @click="switchLogSource('watchdog')">Watchdog</button>
        </div>
        <div class="ops-logs__tools">
          <input v-model="logFilter" class="adm-input adm-input--sm" placeholder="фильтр…" />
          <label class="adm-check"><input v-model="logAuto" type="checkbox" /> авто</label>
          <button class="adm-btn adm-btn--sm" :disabled="logBusy" @click="loadLogs">Обновить</button>
        </div>
      </div>
      <div v-if="logPath" class="ops-logs__path adm-mono">{{ logPath }}</div>
      <div ref="logRef" class="ops-logs__body">
        <div v-if="!logAvailable" class="ops-console__empty">Файл лога недоступен для этого источника</div>
        <div v-else-if="!filteredLog.length" class="ops-console__empty">Пусто</div>
        <div v-for="(line, i) in filteredLog" :key="i" class="ops-logs__line" :class="logLevelClass(line)">{{ line }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ops-power { display: flex; gap: 0.35rem; padding-right: 0.5rem; margin-right: 0.25rem; border-right: 1px solid var(--adm-line); }
@media (max-width: 640px) { .ops-power { border-right: none; padding-right: 0; } }

.ops-updated { font-size: 0.68rem; color: var(--adm-dim); font-weight: 600; white-space: nowrap; }
@media (max-width: 560px) { .ops-updated { display: none; } }

/* ── Метрики ─────────────────────────────────────────────────────── */
.ops-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 0.85rem;
}
.ops-metric { display: flex; flex-direction: column; gap: 0.55rem; }
.ops-metric--accent { border-color: var(--adm-acc-line); background: linear-gradient(150deg, var(--adm-acc-soft), var(--adm-card) 60%); }
.ops-metric__top { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
.ops-metric__label { font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--adm-dim); }
.ops-metric__val { font-size: 1.55rem; font-weight: 700; letter-spacing: -0.02em; color: var(--adm-text); line-height: 1; }
.ops-metric__val-sub { font-size: 0.9rem; color: var(--adm-dim); }
.ops-metric__val.is-ok { color: var(--adm-ok); }
.ops-metric__val.is-warn { color: var(--adm-warn); }
.ops-metric__val.is-crit { color: var(--adm-err); }
.ops-metric__meta { font-size: 0.68rem; color: var(--adm-dim); }

.ops-bar { height: 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.12); overflow: hidden; }
.ops-bar__fill { display: block; height: 100%; border-radius: 4px; background: var(--adm-acc); transition: width 0.5s ease, background-color 0.3s; }
.ops-bar__fill.is-ok { background: var(--adm-ok); }
.ops-bar__fill.is-warn { background: var(--adm-warn); }
.ops-bar__fill.is-crit { background: var(--adm-err); }

.ops-tps-windows { display: flex; flex-wrap: wrap; gap: 0.6rem; font-size: 0.68rem; color: var(--adm-mut); }
.ops-tps-windows b { color: var(--adm-dim); font-weight: 700; margin-right: 0.15rem; }

/* ── Sparkline ──────────────────────────────────────────────────────
   The chart is built in a render function, so its elements don't inherit
   this SFC's scoped data-v attribute — all sparkline styling (wrap, svg,
   markers, tooltip) is set inline in the render fn, not here. */

/* ── Per-dimension TPS ────────────────────────────────────────────── */
.ops-tps-dims { display: flex; flex-direction: column; gap: 0.15rem; margin-top: 0.15rem; padding-top: 0.4rem; border-top: 1px solid var(--adm-line); }
.ops-tps-dim { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.66rem; color: var(--adm-mut); }
.ops-tps-dim__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops-tps-dim__val { font-weight: 700; white-space: nowrap; }
.ops-tps-dim.is-warn .ops-tps-dim__val { color: var(--adm-warn); }
.ops-tps-dim.is-crit .ops-tps-dim__val { color: var(--adm-err); }

/* ── Недавние зависания ───────────────────────────────────────────── */
.ops-hangs__head-r { display: flex; align-items: center; gap: 0.5rem; }
.ops-hangs__body { max-height: 280px; overflow-y: auto; padding: 0.4rem 0.5rem; }
.ops-hang { display: flex; align-items: baseline; gap: 0.6rem; padding: 0.3rem 0.5rem; border-radius: var(--adm-r-sm); border-left: 2px solid transparent; font-size: 0.72rem; }
.ops-hang:hover { background: rgba(148, 163, 184, 0.05); }
.ops-hang.is-warn { border-left-color: var(--adm-warn); }
.ops-hang.is-crit { border-left-color: var(--adm-err); }
.ops-hang__time { color: var(--adm-dim); font-weight: 700; white-space: nowrap; }
.ops-hang__dur { color: var(--adm-err); font-weight: 700; white-space: nowrap; }
.ops-hang__text { color: var(--adm-mut); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }

/* ── Колонки консоль/игроки ──────────────────────────────────────── */
.ops-cols { display: grid; grid-template-columns: 1.7fr 1fr; gap: 0.85rem; }
@media (max-width: 960px) { .ops-cols { grid-template-columns: 1fr; } }

.ops-console { display: flex; flex-direction: column; }
.ops-quick { display: flex; flex-wrap: wrap; gap: 0.3rem; justify-content: flex-end; }
.ops-console__out {
  flex: 1;
  min-height: 220px;
  max-height: 340px;
  overflow-y: auto;
  padding: 0.8rem 1rem;
  background: #05070d;
  font-size: 0.76rem;
}
.ops-console__empty { color: var(--adm-faint); font-size: 0.78rem; text-align: center; padding: 1.5rem 0; }
.ops-console__entry { margin-bottom: 0.7rem; }
.ops-console__cmd { font-family: var(--adm-mono); color: var(--adm-acc-text); font-size: 0.76rem; margin-bottom: 0.15rem; }
.ops-console__res {
  margin: 0;
  font-family: var(--adm-mono);
  font-size: 0.74rem;
  line-height: 1.45;
  color: var(--adm-mut);
  white-space: pre-wrap;
  word-break: break-word;
}
.ops-console__res.is-error { color: var(--adm-err); }
.ops-console__bar { display: flex; gap: 0.5rem; padding: 0.6rem 1rem; border-top: 1px solid var(--adm-line); }
.ops-console__bar .adm-input { flex: 1; }

/* ── Игроки ──────────────────────────────────────────────────────── */
.ops-players { display: flex; flex-direction: column; }
.ops-players__list { padding: 0.5rem; overflow-y: auto; max-height: 470px; }
.ops-player { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.5rem; border-radius: var(--adm-r-sm); transition: background-color 0.12s; }
.ops-player:hover { background: rgba(148, 163, 184, 0.05); }
.ops-player__ava { width: 1.7rem; height: 1.7rem; font-size: 0.72rem; }
.ops-player__name { flex: 1; min-width: 0; font-size: 0.82rem; font-weight: 600; color: var(--adm-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops-player__acts { display: flex; gap: 0.25rem; }

/* ── Логи ────────────────────────────────────────────────────────── */
.ops-logs__head { flex-wrap: wrap; gap: 0.5rem; }
.ops-logs__tools { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.adm-input--sm { width: 150px; padding: 0.32rem 0.55rem; font-size: 0.75rem; }
.ops-logs__path { padding: 0.35rem 1.2rem; font-size: 0.66rem; color: var(--adm-faint); border-bottom: 1px solid var(--adm-line); }
.ops-logs__body {
  max-height: 420px;
  overflow: auto;
  padding: 0.6rem 1rem;
  background: #05070d;
  font-family: var(--adm-mono);
  font-size: 0.72rem;
  line-height: 1.5;
}
.ops-logs__line { white-space: pre-wrap; word-break: break-word; color: var(--adm-dim); }
.ops-logs__line.lg-warn { color: var(--adm-warn); }
.ops-logs__line.lg-error { color: var(--adm-err); }

/* In-game chat feed */
.ops-chat__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
.ops-chat__tools { display: flex; align-items: center; gap: 0.5rem; }
.ops-chat__body {
  max-height: 420px;
  overflow: auto;
  padding: 0.5rem 0.9rem;
  background: #05070d;
  font-size: 0.8rem;
  line-height: 1.55;
}
.ops-chat__line { display: flex; gap: 0.6rem; align-items: baseline; padding: 0.12rem 0; }
.ops-chat__time { color: var(--adm-faint); font-size: 0.66rem; flex-shrink: 0; opacity: 0.75; }
.ops-chat__text { white-space: pre-wrap; word-break: break-word; color: var(--adm-text); min-width: 0; }
.ops-chat__line.is-join .ops-chat__text { color: var(--adm-ok, #4ade80); font-style: italic; }
.ops-chat__line.is-leave .ops-chat__text { color: var(--adm-faint); font-style: italic; }
.ops-chat__line.is-system .ops-chat__text { color: var(--adm-dim); font-style: italic; }
</style>
