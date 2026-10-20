<script setup>
// Analytics: games & players per day, map popularity, team-size split, player-count histogram.
import { Chart, registerables } from 'chart.js'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { authState } from '../../../stores/authStore'
import { toastError } from '../../../services/toast'
import { royaleAnalytics } from '../../../services/royaleAdminApi'
import { clock } from './royaleUi'

Chart.register(...registerables)
const token = () => authState.accessToken
const data = ref(null)
const days = ref(30)
const dayCanvas = ref(null)
const mapCanvas = ref(null)
const teamCanvas = ref(null)
let charts = []

function acc() {
  const shell = document.querySelector('.adm-shell')
  return (shell && getComputedStyle(shell).getPropertyValue('--adm-acc').trim()) || '#7c3aed'
}
function destroy() { charts.forEach((c) => c.destroy()); charts = [] }

async function load() {
  try { data.value = await royaleAnalytics(token(), days.value) } catch (e) { toastError(e.message || 'Не удалось'); return }
  await nextTick(); render()
}
onMounted(load)
onUnmounted(destroy)

function setDays(d) { days.value = d; load() }

function render() {
  destroy()
  if (!data.value) return
  const a = acc()
  const grid = 'rgba(255,255,255,.06)'
  const tick = '#8a8a96'
  const base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { x: { grid: { color: grid }, ticks: { color: tick, maxRotation: 0, autoSkip: true } }, y: { grid: { color: grid }, ticks: { color: tick }, beginAtZero: true } } }

  // Games + players per day
  if (dayCanvas.value) {
    const d = data.value.days
    const labels = d.map((x) => { const [, m, day] = x.date.split('-'); return `${day}.${m}` })
    charts.push(new Chart(dayCanvas.value, {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Игры', data: d.map((x) => x.games), backgroundColor: a + 'cc', borderRadius: 4, order: 2 },
        { label: 'Игроки', data: d.map((x) => x.players), type: 'line', borderColor: '#ffb84d', backgroundColor: '#ffb84d22', borderWidth: 2, pointRadius: 0, tension: 0.4, yAxisID: 'y2', order: 1 },
      ] },
      options: { ...base, plugins: { legend: { display: true, labels: { color: tick } } },
        scales: { ...base.scales, y2: { position: 'right', grid: { display: false }, ticks: { color: '#ffb84d' }, beginAtZero: true } } },
    }))
  }
  // Map popularity
  if (mapCanvas.value) {
    const m = data.value.maps
    charts.push(new Chart(mapCanvas.value, {
      type: 'doughnut',
      data: { labels: m.map((x) => x.name), datasets: [{ data: m.map((x) => x.count),
        backgroundColor: [a, '#ff6b3d', '#ffb84d', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6'] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: tick, boxWidth: 12 } } } },
    }))
  }
  // Team-size split
  if (teamCanvas.value) {
    const t = data.value.team_sizes
    charts.push(new Chart(teamCanvas.value, {
      type: 'bar',
      data: { labels: t.map((x) => `по ${x.size}`), datasets: [{ data: t.map((x) => x.count), backgroundColor: '#a78bfacc', borderRadius: 4 }] },
      options: base,
    }))
  }
}
</script>

<template>
  <div v-if="!data" class="adm-skel" style="height: 360px" />
  <div v-else class="ra">
    <div class="ra-bar">
      <div class="ra-period">
        <button v-for="d in [7, 30, 90]" :key="d" class="adm-btn adm-btn--sm" :class="{ 'adm-btn--acc': days === d }" @click="setDays(d)">{{ d }} дней</button>
      </div>
      <div class="ra-kpis">
        <span>Игр: <b>{{ data.games }}</b></span>
        <span>Средняя игра: <b>{{ data.duration_avg ? clock(data.duration_avg) : '—' }}</b></span>
        <span>Самая долгая: <b>{{ data.duration_max ? clock(data.duration_max) : '—' }}</b></span>
      </div>
    </div>

    <div class="adm-card adm-card--pad">
      <div class="ra-h">Игры и игроки по дням</div>
      <div class="ra-chart"><canvas ref="dayCanvas" /></div>
    </div>

    <div class="ra-cols">
      <div class="adm-card adm-card--pad">
        <div class="ra-h">Популярность карт</div>
        <div class="ra-chart ra-chart--sm"><canvas ref="mapCanvas" /></div>
      </div>
      <div class="adm-card adm-card--pad">
        <div class="ra-h">Размер команд</div>
        <div class="ra-chart ra-chart--sm"><canvas ref="teamCanvas" /></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ra { display: flex; flex-direction: column; gap: 14px; }
.ra-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.ra-period { display: flex; gap: 4px; }
.ra-kpis { display: flex; gap: 16px; flex-wrap: wrap; color: var(--adm-muted, #9aa); font-size: .9rem; }
.ra-h { font-weight: 800; margin-bottom: 10px; }
.ra-chart { height: 300px; }
.ra-chart--sm { height: 240px; }
.ra-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 760px) { .ra-cols { grid-template-columns: 1fr; } }
</style>
