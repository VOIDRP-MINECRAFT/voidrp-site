<script setup>
// «Таймлайн дня»: игроки и TPS за сутки двумя графиками с общей шкалой времени и общим
// перекрестием; полосы сбоев и отметки смен версий — на обоих. Точки — по 15 минут.
import { computed, ref } from 'vue'

const props = defineProps({
  status: { type: Object, required: true },
  incidents: { type: Array, default: () => [] },
  history: { type: Array, default: () => [] },
})

const W = 640
const H = 110
const PAD = { l: 34, r: 8, t: 10, b: 18 }
const series = computed(() => props.status?.series_24h || [])
const n = computed(() => series.value.length || 96)
const t0 = computed(() => (series.value[0] ? new Date(series.value[0].t).getTime() : Date.now() - 864e5))
const t1 = computed(() => t0.value + 864e5)
const x = (i) => PAD.l + (i / Math.max(1, n.value - 1)) * (W - PAD.l - PAD.r)
const xt = (ms) => PAD.l + ((ms - t0.value) / (t1.value - t0.value)) * (W - PAD.l - PAD.r)

const maxOnline = computed(() => {
  const m = Math.max(1, ...series.value.map((p) => p.online || 0))
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]
  return steps.find((s) => s >= m * 1.1) || Math.ceil(m * 1.2)
})
const yOnline = (v) => PAD.t + (1 - v / maxOnline.value) * (H - PAD.t - PAD.b)
const yTps = (v) => PAD.t + (1 - Math.min(20, Math.max(0, v)) / 20) * (H - PAD.t - PAD.b)

function path(get, y) {
  let d = ''
  let open = false
  series.value.forEach((p, i) => {
    const v = get(p)
    if (v == null) { open = false; return }
    d += `${open ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `
    open = true
  })
  return d
}
const onlineLine = computed(() => path((p) => p.online, yOnline))
const onlineArea = computed(() => {
  // closed areas per continuous run
  let d = ''
  let run = []
  const flush = () => {
    if (run.length > 1) {
      d += `M${x(run[0][0])} ${yOnline(0)} ` + run.map(([i, v]) => `L${x(i).toFixed(1)} ${yOnline(v).toFixed(1)}`).join(' ') + ` L${x(run[run.length - 1][0])} ${yOnline(0)} Z `
    }
    run = []
  }
  series.value.forEach((p, i) => { if (p.online == null) flush(); else run.push([i, p.online]) })
  flush()
  return d
})
const tpsLine = computed(() => path((p) => p.tps, yTps))
const hasTps = computed(() => series.value.some((p) => p.tps != null))
const hasOnline = computed(() => series.value.some((p) => p.online != null))

const bands = computed(() => props.incidents
  .filter((i) => new Date(i.ended_at || Date.now()).getTime() > t0.value)
  .map((i) => {
    const a = Math.max(t0.value, new Date(i.started_at).getTime())
    const b = Math.min(t1.value, new Date(i.ended_at || Date.now()).getTime())
    return { x: xt(a), w: Math.max(2, xt(b) - xt(a)), kind: i.kind, text: i.detail }
  }))
const marks = computed(() => props.history
  .filter((e) => e.kind === 'version' && new Date(e.at).getTime() > t0.value)
  .map((e) => ({ x: xt(new Date(e.at).getTime()), text: `${e.plugin}: ${e.detail}` })))

const hover = ref(null)
function move(ev) {
  const r = ev.currentTarget.getBoundingClientRect()
  const px = ((ev.clientX - r.left) / r.width) * W
  const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n.value - 1))
  hover.value = i >= 0 && i < n.value ? i : null
}
const hp = computed(() => (hover.value == null ? null : series.value[hover.value]))
const hourTicks = computed(() => {
  const out = []
  const start = new Date(t0.value)
  start.setMinutes(0, 0, 0)
  for (let ms = start.getTime() + 3600e3; ms < t1.value; ms += 3600e3 * 6) out.push({ x: xt(ms), label: new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) })
  return out
})
const fmtT = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="sc">
    <div v-if="!hasOnline && !hasTps" class="sc-empty">Данных за сутки пока нет — снимки пишутся раз в 5 минут из отчётов мониторинга.</div>
    <template v-else>
      <div v-for="chart in [{ key: 'online', title: 'Игроки', show: hasOnline }, { key: 'tps', title: 'TPS', show: hasTps }].filter((c) => c.show)" :key="chart.key" class="sc-chart">
        <div class="sc-title">{{ chart.title }} <span class="sc-muted">за сутки</span></div>
        <svg :viewBox="`0 0 ${W} ${H}`" class="sc-svg" @mousemove="move" @mouseleave="hover = null">
          <!-- сетка -->
          <template v-if="chart.key === 'online'">
            <line v-for="v in [0, maxOnline / 2, maxOnline]" :key="v" :x1="PAD.l" :x2="W - PAD.r" :y1="yOnline(v)" :y2="yOnline(v)" class="sc-grid" />
            <text v-for="v in [0, maxOnline / 2, maxOnline]" :key="`l${v}`" :x="PAD.l - 6" :y="yOnline(v) + 3" text-anchor="end" class="sc-axis">{{ Math.round(v) }}</text>
          </template>
          <template v-else>
            <line v-for="v in [0, 10, 20]" :key="v" :x1="PAD.l" :x2="W - PAD.r" :y1="yTps(v)" :y2="yTps(v)" class="sc-grid" />
            <text v-for="v in [0, 10, 20]" :key="`l${v}`" :x="PAD.l - 6" :y="yTps(v) + 3" text-anchor="end" class="sc-axis">{{ v }}</text>
            <line :x1="PAD.l" :x2="W - PAD.r" :y1="yTps(15)" :y2="yTps(15)" class="sc-thr" />
            <text :x="W - PAD.r" :y="yTps(15) - 4" text-anchor="end" class="sc-axis">15 — тормозит</text>
          </template>
          <!-- сбои и смены версий -->
          <rect v-for="(b, i) in bands" :key="`b${i}`" :x="b.x" :y="PAD.t" :width="b.w" :height="H - PAD.t - PAD.b" :class="b.kind === 'down' ? 'sc-band sc-band--down' : 'sc-band sc-band--tps'"><title>{{ b.text }}</title></rect>
          <g v-for="(m, i) in marks" :key="`m${i}`"><line :x1="m.x" :x2="m.x" :y1="PAD.t" :y2="H - PAD.b" class="sc-mark" /><title>{{ m.text }}</title></g>
          <!-- данные -->
          <template v-if="chart.key === 'online'">
            <path :d="onlineArea" class="sc-area" />
            <path :d="onlineLine" class="sc-line" />
          </template>
          <path v-else :d="tpsLine" class="sc-line" />
          <!-- время -->
          <text v-for="t in hourTicks" :key="t.x" :x="t.x" :y="H - 4" text-anchor="middle" class="sc-axis">{{ t.label }}</text>
          <!-- перекрестие -->
          <template v-if="hp">
            <line :x1="x(hover)" :x2="x(hover)" :y1="PAD.t" :y2="H - PAD.b" class="sc-cross" />
            <circle v-if="chart.key === 'online' && hp.online != null" :cx="x(hover)" :cy="yOnline(hp.online)" r="4" class="sc-dot" />
            <circle v-if="chart.key === 'tps' && hp.tps != null" :cx="x(hover)" :cy="yTps(hp.tps)" r="4" class="sc-dot" />
          </template>
          <rect :x="PAD.l" :y="0" :width="W - PAD.l - PAD.r" :height="H" fill="transparent" />
        </svg>
      </div>
      <div class="sc-tip" :class="{ 'sc-tip--on': hp }">
        <template v-if="hp">
          <b>{{ fmtT(hp.t) }}</b>
          <span>игроков: {{ hp.online ?? '—' }}</span>
          <span>TPS: {{ hp.tps ?? '—' }}</span>
          <span>{{ hp.up == null ? 'нет данных' : hp.up >= 1 ? 'на связи' : hp.up > 0 ? 'с перебоями' : 'недоступен' }}</span>
        </template>
        <template v-else>
          <span class="sc-muted">Наведите на график. </span>
          <span v-if="bands.length"><i class="sc-key sc-key--down" />сбой</span>
          <span v-if="marks.length"><i class="sc-key sc-key--mark" />смена версии плагина</span>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sc { display: flex; flex-direction: column; gap: 0.6rem; }
.sc-empty { color: var(--adm-dim); font-size: 0.84rem; padding: 0.4rem 0; }
.sc-chart { display: flex; flex-direction: column; gap: 0.2rem; }
.sc-title { font-size: 0.8rem; font-weight: 700; color: var(--adm-text); }
.sc-muted { color: var(--adm-faint); font-weight: 500; }
.sc-svg { width: 100%; height: auto; display: block; cursor: crosshair; }
.sc-grid { stroke: var(--adm-line); stroke-width: 1; }
.sc-thr { stroke: var(--adm-warn); stroke-width: 1; stroke-dasharray: 4 4; opacity: 0.7; }
.sc-axis { fill: var(--adm-faint); font-size: 9.5px; }
.sc-area { fill: var(--adm-acc); opacity: 0.14; }
.sc-line { fill: none; stroke: var(--adm-acc); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.sc-band--down { fill: var(--adm-err); opacity: 0.16; }
.sc-band--tps { fill: var(--adm-warn); opacity: 0.14; }
.sc-mark { stroke: var(--adm-info); stroke-width: 1.5; stroke-dasharray: 3 3; }
.sc-cross { stroke: var(--adm-line-strong); stroke-width: 1; }
.sc-dot { fill: var(--adm-acc); stroke: var(--adm-card); stroke-width: 2; }
.sc-tip { display: flex; gap: 0.9rem; flex-wrap: wrap; font-size: 0.78rem; color: var(--adm-text); min-height: 1.2rem; align-items: center; }
.sc-key { display: inline-block; width: 12px; height: 10px; border-radius: 2px; margin-right: 0.3rem; vertical-align: -1px; }
.sc-key--down { background: color-mix(in srgb, var(--adm-err) 40%, transparent); }
.sc-key--mark { border-left: 2px dashed var(--adm-info); width: 2px; }
</style>
