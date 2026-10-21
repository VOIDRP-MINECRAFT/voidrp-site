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
        { label: 'Игры', data: d.map((x) => x.games), backgroundColor: '#ff6b3dcc', borderColor: '#ff6b3d', borderWidth: 1, borderRadius: 5, order: 2 },
        { label: 'Игроки', data: d.map((x) => x.players), type: 'line', borderColor: '#a78bfa', backgroundColor: '#a78bfa22', borderWidth: 2, pointRadius: 0, tension: 0.4, yAxisID: 'y2', order: 1, fill: true },
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
        backgroundColor: ['#ff6b3d', '#a78bfa', '#4ade80', '#38bdf8', '#ffb84d', '#f472b6', '#2dd4bf'], borderWidth: 0 }] },
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
        <button v-for="d in [7, 30, 90]" :key="d" class="ra-pill" :class="{ 'ra-pill--on': days === d }" @click="setDays(d)">{{ d }} дней</button>
      </div>
      <div class="ra-kpis">
        <span class="ra-kpi"><b>{{ data.games }}</b> игр</span>
        <span class="ra-kpi"><b>{{ data.duration_avg ? clock(data.duration_avg) : '—' }}</b> ср. игра</span>
        <span class="ra-kpi"><b>{{ data.duration_max ? clock(data.duration_max) : '—' }}</b> макс.</span>
      </div>
    </div>

    <div class="ra-card">
      <div class="ra-h">Игры и игроки по дням</div>
      <div class="ra-chart"><canvas ref="dayCanvas" /></div>
    </div>

    <div class="ra-cols">
      <div class="ra-card">
        <div class="ra-h">Популярность карт</div>
        <div class="ra-chart ra-chart--sm"><canvas ref="mapCanvas" /></div>
      </div>
      <div class="ra-card">
        <div class="ra-h">Размер команд</div>
        <div class="ra-chart ra-chart--sm"><canvas ref="teamCanvas" /></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ra { display: flex; flex-direction: column; gap: 16px; }
.ra-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.ra-period { display: flex; gap: 6px; }
.ra-pill { padding: 7px 15px; border-radius: 999px; font-size: .85rem; font-weight: 600; cursor: pointer;
  border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.03); color: #b8b8c2; transition: all .12s; }
.ra-pill:hover { background: rgba(255,255,255,.08); }
.ra-pill--on { border-color: transparent; color: #1a0f08; background: linear-gradient(135deg, #ff8a3d, #ff5a9e); }
.ra-kpis { display: flex; gap: 10px; flex-wrap: wrap; }
.ra-kpi { font-size: .85rem; color: #8a8a96; padding: 6px 14px; border-radius: 999px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); }
.ra-kpi b { color: #fff; font-weight: 800; }
.ra-card { border-radius: 20px; border: 1px solid rgba(255,255,255,.07); background: #0e0e13; padding: 20px 22px; }
.ra-h { font-weight: 800; font-size: 1.05rem; margin-bottom: 14px; }
.ra-chart { height: 300px; }
.ra-chart--sm { height: 240px; }
.ra-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 760px) { .ra-cols { grid-template-columns: 1fr; } }
</style>
