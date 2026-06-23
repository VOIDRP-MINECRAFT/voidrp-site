<script setup>
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import { authState } from '../../stores/authStore'
import { getMetrikaFull } from '../../services/adminApi'

Chart.register(...registerables)

const token = () => authState.accessToken

const days = ref(30)
const loading = ref(true)
const error = ref(null)
const data = ref(null)

let lineChart = null
let devicesChart = null
const lineCanvas = ref(null)
const devicesCanvas = ref(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await getMetrikaFull(token(), days.value)
  } catch (e) {
    error.value = 'Не удалось загрузить данные Метрики'
  } finally {
    loading.value = false
  }
  if (data.value) await nextTick(() => renderCharts())
}

function destroyCharts() {
  if (lineChart) { lineChart.destroy(); lineChart = null }
  if (devicesChart) { devicesChart.destroy(); devicesChart = null }
}

function renderCharts() {
  destroyCharts()
  if (!data.value) return
  renderLine()
  renderDevices()
}

function renderLine() {
  if (!lineCanvas.value) return
  const byDay = data.value.by_day
  const labels = byDay.map(d => {
    const [, m, day] = d.date.split('-')
    return `${day}.${m}`
  })
  lineChart = new Chart(lineCanvas.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Визиты',
          data: byDay.map(d => d.visits),
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124,58,237,0.08)',
          borderWidth: 2,
          pointRadius: byDay.length > 60 ? 0 : 3,
          pointHoverRadius: 5,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Посетители',
          data: byDay.map(d => d.users),
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6,182,212,0.06)',
          borderWidth: 2,
          pointRadius: byDay.length > 60 ? 0 : 3,
          pointHoverRadius: 5,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Просмотры',
          data: byDay.map(d => d.pageviews),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.05)',
          borderWidth: 2,
          pointRadius: byDay.length > 60 ? 0 : 3,
          pointHoverRadius: 5,
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#64748b', font: { size: 12, weight: '700' }, boxWidth: 12, padding: 20 },
        },
        tooltip: {
          backgroundColor: '#0d1422',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          padding: 12,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#334155', font: { size: 11 }, maxTicksLimit: 15 },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#334155', font: { size: 11 } },
          beginAtZero: true,
        },
      },
    },
  })
}

function renderDevices() {
  if (!devicesCanvas.value || !data.value.devices.length) return
  const COLORS = ['#7c3aed', '#06b6d4', '#22c55e', '#f97316']
  devicesChart = new Chart(devicesCanvas.value, {
    type: 'doughnut',
    data: {
      labels: data.value.devices.map(d => d.name),
      datasets: [{
        data: data.value.devices.map(d => d.visits),
        backgroundColor: COLORS,
        borderColor: '#070b14',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#64748b', font: { size: 12, weight: '700' }, boxWidth: 12, padding: 16 },
        },
        tooltip: {
          backgroundColor: '#0d1422',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          padding: 12,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString('ru')} визитов`,
          },
        },
      },
    },
  })
}

function formatDuration(secs) {
  if (!secs) return '0:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function sourceIcon(key) {
  const icons = {
    organic: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    direct: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
    referral: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    social: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    ad: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  }
  return icons[key] || icons.referral
}

const SOURCE_COLORS = {
  organic: '#22c55e',
  direct: '#7c3aed',
  referral: '#06b6d4',
  social: '#f97316',
  ad: '#ec4899',
  email: '#eab308',
  internal: '#64748b',
  messenger: '#a78bfa',
}

watch(days, load)
onMounted(load)
onUnmounted(destroyCharts)
</script>

<template>
  <div class="mk">
    <!-- Header -->
    <div class="mk__header">
      <div>
        <h1 class="mk__title">Яндекс.Метрика</h1>
        <p class="mk__sub" v-if="data">{{ data.period.date1 }} — {{ data.period.date2 }}</p>
      </div>
      <div class="mk__controls">
        <div class="period-tabs">
          <button v-for="d in [7,30,90]" :key="d" class="period-tab" :class="{ 'period-tab--active': days === d }" @click="days = d">
            {{ d }}д
          </button>
        </div>
        <button class="btn-refresh" :disabled="loading" @click="load" title="Обновить">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" :class="{ spin: loading }"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="mk-error">{{ error }}</div>

    <!-- Loading -->
    <template v-if="loading">
      <div class="skel skel--totals" />
      <div class="skel skel--chart" />
      <div class="skel skel--bottom" />
    </template>

    <template v-else-if="data">
      <!-- Totals -->
      <div class="totals">
        <div class="total-card">
          <div class="total-card__label">Визиты</div>
          <div class="total-card__value">{{ data.totals.visits.toLocaleString('ru') }}</div>
          <div class="total-card__icon total-card__icon--violet">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
        </div>
        <div class="total-card">
          <div class="total-card__label">Посетители</div>
          <div class="total-card__value">{{ data.totals.users.toLocaleString('ru') }}</div>
          <div class="total-card__icon total-card__icon--cyan">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
        </div>
        <div class="total-card">
          <div class="total-card__label">Просмотры страниц</div>
          <div class="total-card__value">{{ data.totals.pageviews.toLocaleString('ru') }}</div>
          <div class="total-card__icon total-card__icon--green">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
        </div>
        <div class="total-card">
          <div class="total-card__label">Отказы</div>
          <div class="total-card__value">{{ data.totals.bounce_rate }}%</div>
          <div class="total-card__icon total-card__icon--orange">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
          </div>
        </div>
      </div>

      <!-- Line chart -->
      <div class="panel">
        <div class="panel__head">
          <span class="panel__title">Динамика посещаемости</span>
        </div>
        <div class="chart-wrap">
          <canvas ref="lineCanvas" />
        </div>
      </div>

      <!-- Sources + Devices -->
      <div class="two-col">
        <!-- Sources -->
        <div class="panel">
          <div class="panel__head">
            <span class="panel__title">Источники трафика</span>
          </div>
          <div class="sources">
            <div v-for="src in data.sources" :key="src.key" class="source-row">
              <div class="source-row__icon" :style="{ color: SOURCE_COLORS[src.key] || '#64748b' }" v-html="sourceIcon(src.key)" />
              <div class="source-row__name">{{ src.name }}</div>
              <div class="source-row__bar-wrap">
                <div
                  class="source-row__bar"
                  :style="{
                    width: data.sources[0]?.visits ? (src.visits / data.sources[0].visits * 100) + '%' : '0%',
                    background: SOURCE_COLORS[src.key] || '#334155',
                  }"
                />
              </div>
              <div class="source-row__visits">{{ src.visits.toLocaleString('ru') }}</div>
            </div>
            <div v-if="!data.sources.length" class="no-data">Нет данных</div>
          </div>
        </div>

        <!-- Devices -->
        <div class="panel">
          <div class="panel__head">
            <span class="panel__title">Устройства</span>
          </div>
          <div class="devices-wrap">
            <div class="devices-chart">
              <canvas ref="devicesCanvas" />
            </div>
            <div class="devices-list">
              <div v-for="(dev, i) in data.devices" :key="dev.key" class="devices-list__row">
                <span class="devices-list__dot" :style="{ background: ['#7c3aed','#06b6d4','#22c55e','#f97316'][i] }" />
                <span class="devices-list__name">{{ dev.name }}</span>
                <span class="devices-list__val">{{ dev.visits.toLocaleString('ru') }}</span>
              </div>
              <div v-if="!data.devices.length" class="no-data">Нет данных</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top pages -->
      <div class="panel">
        <div class="panel__head">
          <span class="panel__title">Топ страниц</span>
          <span class="panel__badge">{{ data.top_pages.length }} страниц</span>
        </div>
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Страница</th>
                <th>Просмотры</th>
                <th>Ср. время</th>
                <th>Отказы</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(page, i) in data.top_pages" :key="page.path">
                <td class="tbl__num">{{ i + 1 }}</td>
                <td class="tbl__path">{{ page.path }}</td>
                <td class="tbl__views">{{ page.pageviews.toLocaleString('ru') }}</td>
                <td class="tbl__dur">{{ formatDuration(page.avg_duration) }}</td>
                <td>
                  <span class="bounce-badge" :class="page.bounce_rate > 60 ? 'bounce-badge--red' : page.bounce_rate > 35 ? 'bounce-badge--yellow' : 'bounce-badge--green'">
                    {{ page.bounce_rate }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!data.top_pages.length" class="no-data no-data--pad">Нет данных</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.mk { padding: 1.75rem 1.5rem 3rem; max-width: 100%; }

/* Header */
.mk__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.mk__title { font-size: 1.4rem; font-weight: 800; color: #e2e8f0; margin: 0; }
.mk__sub { font-size: 0.75rem; color: #475569; margin: 0.15rem 0 0; }

.mk__controls { display: flex; align-items: center; gap: 0.5rem; }

.period-tabs {
  display: flex;
  gap: 0.2rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 9px;
  padding: 0.2rem;
}
.period-tab {
  border: none;
  background: none;
  color: #475569;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.28rem 0.65rem;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.13s;
}
.period-tab:hover { color: #94a3b8; }
.period-tab--active { background: rgba(124,58,237,0.25); color: #c4b5fd; }

.btn-refresh {
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.13s;
}
.btn-refresh:hover:not(:disabled) { color: #94a3b8; background: rgba(255,255,255,0.08); }
.btn-refresh:disabled { opacity: 0.4; cursor: not-allowed; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

/* Error */
.mk-error {
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 12px;
  color: #fca5a5;
  padding: 1rem 1.2rem;
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
}

/* Totals */
.totals {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.total-card {
  background: linear-gradient(145deg, #0f1628 0%, #0a1020 100%);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 1.2rem 1.2rem 1rem;
  position: relative;
  overflow: hidden;
  transition: transform 0.15s, border-color 0.15s;
}
.total-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.11); }

.total-card__label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
}
.total-card__value {
  font-size: 1.9rem;
  font-weight: 900;
  color: #e2e8f0;
  line-height: 1;
}

.total-card__icon {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.total-card__icon--violet { background: rgba(124,58,237,0.15); color: #c4b5fd; }
.total-card__icon--cyan { background: rgba(6,182,212,0.12); color: #67e8f9; }
.total-card__icon--green { background: rgba(34,197,94,0.12); color: #86efac; }
.total-card__icon--orange { background: rgba(249,115,22,0.12); color: #fdba74; }

/* Panel */
.panel {
  background: linear-gradient(145deg, #0f1628 0%, #0a1020 100%);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  margin-bottom: 1.25rem;
  overflow: hidden;
}

.panel__head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 1.25rem 0.85rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.panel__title { font-size: 0.85rem; font-weight: 800; color: #94a3b8; }
.panel__badge {
  font-size: 0.7rem;
  font-weight: 700;
  background: rgba(124,58,237,0.15);
  color: #c4b5fd;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
}

/* Line chart */
.chart-wrap { padding: 1.25rem 1rem 1rem; height: 280px; }

/* Two col */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}
@media (max-width: 780px) { .two-col { grid-template-columns: 1fr; } }

/* Sources */
.sources { padding: 0.75rem 1.25rem 1rem; display: flex; flex-direction: column; gap: 0.55rem; }

.source-row {
  display: grid;
  grid-template-columns: 18px 1fr 120px 60px;
  align-items: center;
  gap: 0.6rem;
}
.source-row__icon { display: flex; align-items: center; justify-content: center; }
.source-row__name { font-size: 0.8rem; font-weight: 600; color: #64748b; }
.source-row__bar-wrap {
  height: 5px;
  background: rgba(255,255,255,0.05);
  border-radius: 999px;
  overflow: hidden;
}
.source-row__bar { height: 100%; border-radius: 999px; transition: width 0.4s ease; opacity: 0.6; }
.source-row__visits { font-size: 0.8rem; font-weight: 800; color: #94a3b8; text-align: right; }

/* Devices */
.devices-wrap { padding: 1rem 1.25rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.devices-chart { width: 180px; height: 180px; flex-shrink: 0; }

.devices-list { width: 100%; display: flex; flex-direction: column; gap: 0.45rem; }
.devices-list__row { display: flex; align-items: center; gap: 0.6rem; }
.devices-list__dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.devices-list__name { font-size: 0.8rem; color: #64748b; flex: 1; }
.devices-list__val { font-size: 0.8rem; font-weight: 700; color: #94a3b8; }

/* Table */
.table-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 0.8rem; white-space: nowrap; }
.tbl thead th {
  padding: 0.55rem 1rem;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #2d3e5c;
  background: rgba(0,0,0,0.2);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.tbl tbody tr { border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.1s; }
.tbl tbody tr:last-child { border-bottom: none; }
.tbl tbody tr:hover { background: rgba(124,58,237,0.04); }
.tbl td { padding: 0.6rem 1rem; color: #475569; vertical-align: middle; }

.tbl__num { color: #2d3e5c !important; font-weight: 700; width: 2.5rem; }
.tbl__path { font-family: monospace; font-size: 0.78rem; color: #c4b5fd !important; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
.tbl__views { font-weight: 800; color: #94a3b8 !important; }
.tbl__dur { color: #475569 !important; }

.bounce-badge {
  display: inline-block;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}
.bounce-badge--green { background: rgba(34,197,94,0.1); color: #86efac; }
.bounce-badge--yellow { background: rgba(234,179,8,0.1); color: #fde047; }
.bounce-badge--red { background: rgba(239,68,68,0.1); color: #fca5a5; }

/* Skeleton */
.skel {
  border-radius: 16px;
  background: linear-gradient(90deg, #0d1422 25%, #121929 50%, #0d1422 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  margin-bottom: 1.25rem;
}
.skel--totals { height: 96px; }
.skel--chart { height: 340px; }
.skel--bottom { height: 260px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.no-data { color: #2d3e5c; font-size: 0.82rem; padding: 1rem 0; text-align: center; }
.no-data--pad { padding: 1.5rem; }

@media (max-width: 600px) { .mk { padding: 1rem 0.75rem 2rem; } }
</style>
