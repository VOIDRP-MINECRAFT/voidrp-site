<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useAuthStore } from '../../stores/authStore'
import { adminGetDonateOverview, adminGetDonatePayments } from '../../services/adminDonateApi'

Chart.register(...registerables)

const auth = useAuthStore()

// ── State ──────────────────────────────────────────────────────
const overviewLoading = ref(true)
const paymentsLoading = ref(false)
const error = ref('')

const stats = ref(null)
const allPayments = ref([])
const payments = ref([])
const paymentsMeta = ref({ total: 0, current_page: 1, last_page: 1, per_page: 20 })
const products = ref([])

const page = ref(1)
const perPage = ref(20)

// ── Chart refs ─────────────────────────────────────────────────
const revenueCanvas = ref(null)
const methodCanvas = ref(null)
let revenueChart = null
let methodChart = null

// ── Helpers ────────────────────────────────────────────────────
function fmt(n) { return Number(n).toLocaleString('ru') }

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  return d.toLocaleString('ru', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(s) {
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T') + 'Z')
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return Math.floor(diff / 60) + ' мин назад'
  if (diff < 86400) return Math.floor(diff / 3600) + ' ч назад'
  return Math.floor(diff / 86400) + ' дн назад'
}

function pmLabel(type) {
  return { sbp: 'СБП', card: 'Карта', qiwi: 'QIWI', yoomoney: 'ЮMoney' }[type] || (type || '').toUpperCase()
}

function pmClass(type) {
  return {
    sbp: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    card: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    yoomoney: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  }[type] || 'text-slate-400 bg-slate-700/40 border-slate-600/30'
}

function statusLabel(s) {
  return { 0: 'Создан', 1: 'В обработке', 2: 'Оплачен', 3: 'Отменён', 4: 'Возврат' }[s] ?? String(s)
}

function statusClass(s) {
  return {
    2: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    3: 'text-red-400 bg-red-500/10 border-red-500/20',
    4: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  }[s] || 'text-slate-400 bg-slate-700/40 border-slate-600/30'
}

const pages = computed(() => {
  const total = paymentsMeta.value.last_page
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const cur = page.value
  const set = new Set([1, total, cur, cur - 1, cur + 1].filter(p => p >= 1 && p <= total))
  return [...set].sort((a, b) => a - b)
})

// ── Charts ─────────────────────────────────────────────────────
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f172a',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      titleColor: '#94a3b8',
      bodyColor: '#e2e8f0',
      padding: 10,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#475569', font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#475569', font: { size: 11 } },
      beginAtZero: true,
    },
  },
}

function buildRevenueData(pays) {
  // Group by day (UTC date)
  const map = {}
  for (const p of pays) {
    if (!p.created_at) continue
    const day = p.created_at.slice(0, 10) // "YYYY-MM-DD"
    if (!map[day]) map[day] = { revenue: 0, count: 0 }
    map[day].revenue += Number(p.cost || 0)
    map[day].count++
  }
  const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  return {
    labels: sorted.map(([d]) => {
      const [, m, day] = d.split('-')
      return `${day}.${m}`
    }),
    revenue: sorted.map(([, v]) => v.revenue),
    count: sorted.map(([, v]) => v.count),
  }
}

function buildMethodData(pays) {
  const map = {}
  for (const p of pays) {
    const k = p.payment_type || 'other'
    map[k] = (map[k] || 0) + Number(p.cost || 0)
  }
  const entries = Object.entries(map).sort(([, a], [, b]) => b - a)
  const colors = {
    sbp: '#10b981',
    card: '#3b82f6',
    yoomoney: '#8b5cf6',
    other: '#64748b',
  }
  return {
    labels: entries.map(([k]) => pmLabel(k)),
    values: entries.map(([, v]) => v),
    colors: entries.map(([k]) => colors[k] || '#64748b'),
  }
}

function destroyCharts() {
  if (revenueChart) { revenueChart.destroy(); revenueChart = null }
  if (methodChart) { methodChart.destroy(); methodChart = null }
}

async function renderCharts(pays) {
  destroyCharts()
  await nextTick()
  const revData = buildRevenueData(pays)
  const mthData = buildMethodData(pays)

  if (revenueCanvas.value && revData.labels.length) {
    revenueChart = new Chart(revenueCanvas.value, {
      type: 'bar',
      data: {
        labels: revData.labels,
        datasets: [
          {
            label: 'Выручка ₽',
            data: revData.revenue,
            backgroundColor: 'rgba(124,58,237,0.7)',
            borderColor: '#7c3aed',
            borderWidth: 1,
            borderRadius: 5,
            hoverBackgroundColor: 'rgba(124,58,237,0.9)',
          },
          {
            label: 'Платежи',
            data: revData.count,
            backgroundColor: 'rgba(6,182,212,0.3)',
            borderColor: '#06b6d4',
            borderWidth: 1,
            borderRadius: 5,
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: {
            display: true,
            labels: { color: '#64748b', font: { size: 11 }, boxWidth: 12, padding: 12 },
          },
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              label: (ctx) => ctx.datasetIndex === 0
                ? ` ${fmt(ctx.raw)} ₽`
                : ` ${ctx.raw} шт.`,
            },
          },
        },
        scales: {
          x: CHART_DEFAULTS.scales.x,
          y: { ...CHART_DEFAULTS.scales.y, position: 'left' },
          y2: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#475569', font: { size: 11 } },
            beginAtZero: true,
          },
        },
      },
    })
  }

  if (methodCanvas.value && mthData.labels.length) {
    methodChart = new Chart(methodCanvas.value, {
      type: 'doughnut',
      data: {
        labels: mthData.labels,
        datasets: [{
          data: mthData.values,
          backgroundColor: mthData.colors.map(c => c + 'cc'),
          borderColor: mthData.colors,
          borderWidth: 1.5,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: '#64748b', font: { size: 11 }, padding: 12, boxWidth: 12 },
          },
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${fmt(ctx.raw)} ₽ (${Math.round(ctx.raw / mthData.values.reduce((a, b) => a + b, 0) * 100)}%)`,
            },
          },
        },
      },
    })
  }
}

// ── Load ───────────────────────────────────────────────────────
async function loadOverview() {
  overviewLoading.value = true
  error.value = ''
  try {
    const res = await adminGetDonateOverview(auth.accessToken)
    stats.value = res.stats
    products.value = Array.isArray(res.products) ? res.products : []
    allPayments.value = Array.isArray(res.chart_payments) ? res.chart_payments : []
    const p = res.payments
    payments.value = Array.isArray(p) ? p : (p?.data ?? [])
    if (p && !Array.isArray(p)) {
      paymentsMeta.value = {
        total: p.total ?? 0,
        current_page: p.current_page ?? 1,
        last_page: p.last_page ?? 1,
        per_page: p.per_page ?? perPage.value,
      }
    }
    await renderCharts(allPayments.value)
  } catch (e) {
    error.value = e.message
  } finally {
    overviewLoading.value = false
  }
}

async function loadPayments() {
  paymentsLoading.value = true
  try {
    const res = await adminGetDonatePayments(auth.accessToken, { page: page.value, per_page: perPage.value })
    payments.value = Array.isArray(res) ? res : (res?.data ?? [])
    if (res && !Array.isArray(res)) {
      paymentsMeta.value = {
        total: res.total ?? 0,
        current_page: res.current_page ?? 1,
        last_page: res.last_page ?? 1,
        per_page: res.per_page ?? perPage.value,
      }
    }
  } catch (e) {
    error.value = e.message
  } finally {
    paymentsLoading.value = false
  }
}

function goPage(p) {
  if (p < 1 || p > paymentsMeta.value.last_page || p === page.value) return
  page.value = p
}

watch(page, loadPayments)

onMounted(loadOverview)

onUnmounted(destroyCharts)
</script>

<template>
  <div class="p-4 md:p-6 space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-black text-slate-100">Донаты</h1>
        <p class="text-sm text-slate-500">Отчётность EasyDonate — платежи, выручка, товары</p>
      </div>
      <button
        class="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition"
        @click="loadOverview"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
        Обновить
      </button>
    </div>

    <div v-if="error" class="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{{ error }}</div>

    <!-- Stats grid -->
    <div class="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <template v-if="overviewLoading">
        <div v-for="i in 6" :key="i" class="skeleton h-24 rounded-xl" />
      </template>
      <template v-else-if="stats">
        <div class="adm-stat-card">
          <div class="adm-stat-card__icon bg-violet-500/10 text-violet-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33"/></svg>
          </div>
          <div>
            <div class="adm-stat-card__value">{{ fmt(stats.total_revenue) }} ₽</div>
            <div class="adm-stat-card__label">Общая выручка</div>
          </div>
        </div>
        <div class="adm-stat-card">
          <div class="adm-stat-card__icon bg-emerald-500/10 text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"/></svg>
          </div>
          <div>
            <div class="adm-stat-card__value">{{ fmt(stats.month_revenue) }} ₽</div>
            <div class="adm-stat-card__label">Выручка за месяц</div>
          </div>
        </div>
        <div class="adm-stat-card">
          <div class="adm-stat-card__icon bg-blue-500/10 text-blue-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>
          </div>
          <div>
            <div class="adm-stat-card__value">{{ fmt(stats.total_payments) }}</div>
            <div class="adm-stat-card__label">Всего платежей</div>
          </div>
        </div>
        <div class="adm-stat-card">
          <div class="adm-stat-card__icon bg-amber-500/10 text-amber-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
          </div>
          <div>
            <div class="adm-stat-card__value">{{ fmt(stats.month_payments) }}</div>
            <div class="adm-stat-card__label">Платежей за месяц</div>
          </div>
        </div>
        <div class="adm-stat-card">
          <div class="adm-stat-card__icon bg-pink-500/10 text-pink-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
          </div>
          <div>
            <div class="adm-stat-card__value">{{ fmt(stats.unique_buyers) }}</div>
            <div class="adm-stat-card__label">Уникальных покупателей</div>
          </div>
        </div>
        <div class="adm-stat-card">
          <div class="adm-stat-card__icon bg-indigo-500/10 text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>
          </div>
          <div>
            <div class="adm-stat-card__value">{{ fmt(stats.products_count) }}</div>
            <div class="adm-stat-card__label">Товаров в каталоге</div>
          </div>
        </div>
      </template>
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">

      <!-- Revenue bar chart (2/3) -->
      <div class="adm-card p-4 lg:col-span-2">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="adm-section-title !mb-0">Выручка по дням</h2>
          <span class="text-xs text-slate-600">последние 100 платежей</span>
        </div>
        <div class="relative h-52">
          <canvas ref="revenueCanvas" />
          <div v-if="!allPayments.length" class="absolute inset-0 flex items-center justify-center text-xs text-slate-600">Нет данных</div>
        </div>
      </div>

      <!-- Method doughnut (1/3) -->
      <div class="adm-card p-4">
        <h2 class="adm-section-title mb-3">Методы оплаты</h2>
        <div class="relative h-52">
          <canvas ref="methodCanvas" />
          <div v-if="!allPayments.length" class="absolute inset-0 flex items-center justify-center text-xs text-slate-600">Нет данных</div>
        </div>
      </div>

    </div>

    <!-- Products -->
    <div v-if="!overviewLoading && products.length">
      <h2 class="adm-section-title">Товары</h2>
      <div class="adm-card overflow-hidden p-0">
        <div class="divide-y divide-slate-700/30">
          <div v-for="p in products" :key="p.id" class="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition">
            <img v-if="p.image" :src="p.image" :alt="p.name" class="h-10 w-10 rounded-lg object-cover shrink-0 bg-slate-900" />
            <div v-else class="h-10 w-10 rounded-lg bg-slate-800 shrink-0 flex items-center justify-center">
              <svg class="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-slate-100 truncate">{{ p.name }}</p>
              <p class="text-xs text-slate-500">ID: {{ p.id }}</p>
            </div>
            <div class="text-right shrink-0">
              <div class="text-sm font-black text-slate-100">{{ fmt(p.price) }} ₽</div>
              <div v-if="p.old_price && Number(p.old_price) > Number(p.price)" class="text-xs text-slate-600 line-through">{{ fmt(p.old_price) }} ₽</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payments table -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <h2 class="adm-section-title !mb-0">
          Платежи
          <span v-if="paymentsMeta.total" class="ml-2 text-xs font-normal text-slate-500">всего {{ fmt(paymentsMeta.total) }}</span>
        </h2>
      </div>

      <div v-if="paymentsLoading" class="adm-card p-4 space-y-3">
        <div v-for="i in 5" :key="i" class="skeleton h-12 rounded-lg" />
      </div>

      <div v-else-if="!payments.length" class="adm-card p-8 text-center text-sm text-slate-500">
        Платежей нет
      </div>

      <div v-else class="adm-card overflow-hidden p-0">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-700/50">
                <th class="adm-th">ID</th>
                <th class="adm-th">Игрок</th>
                <th class="adm-th">Товары</th>
                <th class="adm-th text-right">Сумма</th>
                <th class="adm-th">Метод</th>
                <th class="adm-th">Статус</th>
                <th class="adm-th">Дата</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700/20">
              <tr v-for="pay in payments" :key="pay.id" class="hover:bg-slate-800/30 transition">
                <td class="adm-td text-slate-500 font-mono text-xs">#{{ pay.id }}</td>
                <td class="adm-td">
                  <div class="flex items-center gap-2">
                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-xs font-black text-violet-300">
                      {{ (pay.customer || '?')[0].toUpperCase() }}
                    </div>
                    <div>
                      <div class="font-semibold text-slate-100">{{ pay.customer }}</div>
                      <div v-if="pay.email" class="text-xs text-slate-600 truncate max-w-[120px]">{{ pay.email }}</div>
                    </div>
                  </div>
                </td>
                <td class="adm-td max-w-[180px]">
                  <p class="truncate text-xs text-slate-400">{{ (pay.products || []).map(p => p.name).join(', ') || '—' }}</p>
                </td>
                <td class="adm-td text-right">
                  <span class="font-black text-violet-400">{{ fmt(pay.cost) }} ₽</span>
                </td>
                <td class="adm-td">
                  <span v-if="pay.payment_type" class="rounded-full border px-2 py-0.5 text-xs font-semibold" :class="pmClass(pay.payment_type)">{{ pmLabel(pay.payment_type) }}</span>
                  <span v-else class="text-slate-600">—</span>
                </td>
                <td class="adm-td">
                  <span class="rounded-full border px-2 py-0.5 text-xs font-semibold" :class="statusClass(pay.status)">{{ statusLabel(pay.status) }}</span>
                </td>
                <td class="adm-td">
                  <div class="text-xs text-slate-400">{{ fmtDate(pay.created_at) }}</div>
                  <div class="text-xs text-slate-600">{{ timeAgo(pay.created_at) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="paymentsMeta.last_page > 1" class="flex items-center justify-between border-t border-slate-700/40 px-4 py-3">
          <span class="text-xs text-slate-500">Стр. {{ paymentsMeta.current_page }} из {{ paymentsMeta.last_page }}</span>
          <div class="flex items-center gap-1">
            <button class="adm-page-btn" :class="page === 1 ? 'opacity-30 cursor-default' : 'hover:bg-slate-700'" @click="goPage(page - 1)">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
            </button>
            <template v-for="(p, i) in pages" :key="p">
              <span v-if="i > 0 && pages[i-1] < p - 1" class="px-1 text-slate-600 text-xs">…</span>
              <button class="adm-page-btn" :class="p === page ? 'bg-violet-600 text-white' : 'hover:bg-slate-700 text-slate-400'" @click="goPage(p)">{{ p }}</button>
            </template>
            <button class="adm-page-btn" :class="page === paymentsMeta.last_page ? 'opacity-30 cursor-default' : 'hover:bg-slate-700'" @click="goPage(page + 1)">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.adm-section-title {
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #475569;
  margin-bottom: 0.6rem;
}
.adm-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
}
.adm-stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
}
.adm-stat-card__icon {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.adm-stat-card__icon svg { width: 1.1rem; height: 1.1rem; }
.adm-stat-card__value { font-size: 1.15rem; font-weight: 900; color: #e2e8f0; line-height: 1.2; }
.adm-stat-card__label { font-size: 0.72rem; color: #475569; font-weight: 600; margin-top: 1px; }
.adm-th {
  padding: 0.6rem 1rem;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #475569;
  white-space: nowrap;
}
.adm-td { padding: 0.65rem 1rem; vertical-align: middle; }
.adm-page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  height: 1.75rem;
  padding: 0 0.3rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.13s, color 0.13s;
}
</style>
