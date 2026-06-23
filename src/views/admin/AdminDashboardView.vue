<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getDashboardStats, getServerStatus, getRecentUsers, getMetrikaStats } from '../../services/adminApi'
import { authState } from '../../stores/authStore'

const token = () => authState.accessToken

const stats = ref(null)
const server = ref(null)
const recentUsers = ref([])
const metrika = ref(null)
const loading = ref(true)
const serverLoading = ref(true)
const metrikaLoading = ref(true)

// ── Helpers ────────────────────────────────────────────────────
function fmt(n) { return (n ?? 0).toLocaleString('ru') }

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return Math.floor(diff / 60) + ' мин назад'
  if (diff < 86400) return Math.floor(diff / 3600) + ' ч назад'
  return Math.floor(diff / 86400) + ' дн назад'
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Sparkline SVG ──────────────────────────────────────────────
function sparkline(data, color = '#7c3aed', w = 80, h = 28) {
  if (!data?.length) return ''
  const vals = data.map(d => d.count)
  const max = Math.max(...vals, 1)
  const min = Math.min(...vals)
  const range = max - min || 1
  const step = w / (vals.length - 1)
  const pts = vals.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${pts.join(' ')}" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`
}

const regSparkline = computed(() => sparkline(stats.value?.users?.reg_trend, '#7c3aed'))

// ── Load ───────────────────────────────────────────────────────
async function loadAll() {
  loading.value = true
  serverLoading.value = true
  metrikaLoading.value = true

  const [statsRes, serverRes, recentRes, metrikaRes] = await Promise.allSettled([
    getDashboardStats(token()),
    getServerStatus(token()),
    getRecentUsers(token()),
    getMetrikaStats(token()),
  ])

  stats.value = statsRes.status === 'fulfilled' ? statsRes.value : null
  server.value = serverRes.status === 'fulfilled' ? serverRes.value : { online: false }
  recentUsers.value = recentRes.status === 'fulfilled' ? (recentRes.value?.users || []) : []
  metrika.value = metrikaRes.status === 'fulfilled' ? metrikaRes.value : null

  loading.value = false
  serverLoading.value = false
  metrikaLoading.value = false
}

onMounted(loadAll)

// ── Quick links ────────────────────────────────────────────────
const quickLinks = [
  { to: '/admin/players', label: 'Игроки', sub: 'Поиск, блокировка, BP', iconClass: 'bg-blue-500/10 text-blue-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>' },
  { to: '/admin/donate', label: 'Донаты', sub: 'Платежи, выручка', iconClass: 'bg-violet-500/10 text-violet-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33"/></svg>' },
  { to: '/admin/battlepass', label: 'Battle Pass', sub: 'Premium, прогресс', iconClass: 'bg-yellow-500/10 text-yellow-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>' },
  { to: '/admin/market', label: 'Рынок', sub: 'Цены, товары', iconClass: 'bg-teal-500/10 text-teal-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  { to: '/admin/server', label: 'Сервер', sub: 'Онлайн, пинг', iconClass: 'bg-emerald-500/10 text-emerald-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>' },
  { to: '/admin/nations', label: 'Государства', sub: 'Альянсы, участники', iconClass: 'bg-orange-500/10 text-orange-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  { to: '/admin/mod-suggestions', label: 'Предложения', sub: 'Моды от игроков', iconClass: 'bg-pink-500/10 text-pink-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>' },
  { to: '/admin/metrika', label: 'Метрика', sub: 'Яндекс.Метрика', iconClass: 'bg-red-500/10 text-red-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
]
</script>

<template>
  <div class="p-4 md:p-6 space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-black text-slate-100">Дашборд</h1>
        <p class="text-sm text-slate-500">Обзор состояния проекта</p>
      </div>
      <button
        class="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition"
        :disabled="loading" @click="loadAll"
      >
        <svg class="h-3.5 w-3.5" :class="loading ? 'animate-spin' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
        Обновить
      </button>
    </div>

    <!-- Server status -->
    <div
      class="flex items-center gap-3 rounded-[14px] border px-4 py-3 transition"
      :class="server?.online
        ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(34,197,94,0.05)]'
        : 'bg-red-500/5 border-red-500/15'"
    >
      <div class="h-2.5 w-2.5 shrink-0 rounded-full" :class="server?.online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.7)] animate-pulse' : 'bg-red-400'" />
      <div class="flex-1 min-w-0">
        <span class="text-sm font-black" :class="server?.online ? 'text-emerald-300' : 'text-red-300'">
          {{ server?.online ? 'Сервер онлайн' : 'Сервер офлайн' }}
        </span>
        <span v-if="server?.online" class="ml-2 text-xs text-slate-500">
          {{ server.players_online }}/{{ server.players_max }} игроков · {{ server.version }} · {{ server.latency_ms }}мс
        </span>
        <span v-else class="ml-2 text-xs text-slate-600">{{ server?.reason || '—' }}</span>
      </div>
      <!-- Online players list -->
      <div v-if="server?.online && server.players_sample?.length" class="hidden sm:flex items-center gap-1">
        <span v-for="p in server.players_sample.slice(0, 5)" :key="p.id"
          class="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">{{ p.name }}</span>
        <span v-if="server.players_sample.length > 5" class="text-xs text-slate-600">+{{ server.players_sample.length - 5 }}</span>
      </div>
      <RouterLink to="/admin/server" class="shrink-0 text-xs font-bold text-slate-600 hover:text-slate-400 transition">Подробнее →</RouterLink>
    </div>

    <!-- User stats -->
    <div>
      <div class="dash-section-label">Пользователи</div>
      <div v-if="loading" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="skeleton h-24 rounded-[14px]" />
      </div>
      <div v-else-if="stats" class="grid grid-cols-2 gap-3 lg:grid-cols-4">

        <div class="dash-stat">
          <div class="dash-stat__icon bg-blue-500/10 text-blue-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="dash-stat__val">{{ fmt(stats.users.total) }}</div>
            <div class="dash-stat__label">Аккаунтов</div>
            <div class="dash-stat__sub">активных {{ fmt(stats.users.active) }}</div>
          </div>
        </div>

        <div class="dash-stat dash-stat--accent">
          <div class="dash-stat__icon bg-violet-500/10 text-violet-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-end gap-2">
              <div class="dash-stat__val text-violet-300">+{{ fmt(stats.users.new_last_7d) }}</div>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span v-if="stats.users.reg_trend" class="mb-0.5 opacity-60" v-html="regSparkline" />
            </div>
            <div class="dash-stat__label">За 7 дней</div>
            <div class="dash-stat__sub">+{{ fmt(stats.users.new_last_30d) }} за 30 дней</div>
          </div>
        </div>

        <div class="dash-stat">
          <div class="dash-stat__icon bg-emerald-500/10 text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <div class="dash-stat__val">{{ fmt(stats.users.verified) }}</div>
            <div class="dash-stat__label">Подтверждены</div>
            <div class="dash-stat__sub">{{ stats.users.total > 0 ? Math.round(stats.users.verified / stats.users.total * 100) : 0 }}% от всех</div>
          </div>
        </div>

        <div class="dash-stat">
          <div class="dash-stat__icon bg-cyan-500/10 text-cyan-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"/></svg>
          </div>
          <div>
            <div class="dash-stat__val">{{ fmt(stats.players.total) }}</div>
            <div class="dash-stat__label">Игровых аккаунтов</div>
            <div class="dash-stat__sub">привязанных ников</div>
          </div>
        </div>

      </div>
    </div>

    <!-- Content stats -->
    <div>
      <div class="dash-section-label">Контент</div>
      <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div v-for="i in 6" :key="i" class="skeleton h-20 rounded-[14px]" />
      </div>
      <div v-else-if="stats" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

        <RouterLink to="/admin/nations" class="dash-mini-stat group">
          <div class="dash-mini-stat__icon bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/15 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          </div>
          <div class="dash-mini-stat__val">{{ fmt(stats.nations.total) }}</div>
          <div class="dash-mini-stat__label">Государств</div>
        </RouterLink>

        <RouterLink to="/admin/nations" class="dash-mini-stat group">
          <div class="dash-mini-stat__icon bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/15 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>
          </div>
          <div class="dash-mini-stat__val">{{ fmt(stats.alliances.total) }}</div>
          <div class="dash-mini-stat__label">Альянсов</div>
        </RouterLink>

        <RouterLink to="/admin/battlepass" class="dash-mini-stat group">
          <div class="dash-mini-stat__icon bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/15 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
          </div>
          <div class="dash-mini-stat__val text-violet-300">{{ fmt(stats.battlepass.active_premium) }}</div>
          <div class="dash-mini-stat__label">BP Premium</div>
        </RouterLink>

        <RouterLink to="/admin/battlepass" class="dash-mini-stat group">
          <div class="dash-mini-stat__icon bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/15 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
          </div>
          <div class="dash-mini-stat__val">{{ fmt(stats.battlepass.progress_count) }}</div>
          <div class="dash-mini-stat__label">BP игроков</div>
        </RouterLink>

        <RouterLink to="/admin/market" class="dash-mini-stat group">
          <div class="dash-mini-stat__icon bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/15 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75"/></svg>
          </div>
          <div class="dash-mini-stat__val">{{ fmt(stats.market.enabled_items) }}</div>
          <div class="dash-mini-stat__label">Товаров рынка</div>
        </RouterLink>

        <RouterLink to="/admin/mod-suggestions" class="dash-mini-stat group">
          <div class="dash-mini-stat__icon bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/15 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>
          </div>
          <div class="dash-mini-stat__val">{{ fmt(stats.mod_suggestions.total) }}</div>
          <div class="dash-mini-stat__label">Предложений модов</div>
        </RouterLink>

      </div>
    </div>

    <!-- Two-column: Quick links + Metrika -->
    <div class="grid gap-5 lg:grid-cols-2">

      <!-- Quick links -->
      <div>
        <div class="dash-section-label">Быстрый доступ</div>
        <div class="grid grid-cols-2 gap-2">
          <RouterLink v-for="link in quickLinks" :key="link.to" :to="link.to" class="quick-card group">
            <div class="quick-card__icon" :class="link.iconClass">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span v-html="link.icon" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-slate-200 group-hover:text-violet-300 transition">{{ link.label }}</div>
              <div class="text-xs text-slate-600 truncate mt-0.5">{{ link.sub }}</div>
            </div>
            <svg class="h-4 w-4 shrink-0 text-slate-700 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
          </RouterLink>
        </div>
      </div>

      <!-- Metrika -->
      <div>
        <div class="dash-section-label">Яндекс.Метрика — 30 дней</div>
        <div v-if="metrikaLoading" class="grid grid-cols-2 gap-2">
          <div v-for="i in 4" :key="i" class="skeleton h-20 rounded-[14px]" />
        </div>
        <div v-else-if="metrika" class="grid grid-cols-2 gap-2">
          <div class="dash-stat">
            <div class="dash-stat__icon bg-blue-500/10 text-blue-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
            </div>
            <div>
              <div class="dash-stat__val">{{ fmt(metrika.visits) }}</div>
              <div class="dash-stat__label">Визиты</div>
            </div>
          </div>
          <div class="dash-stat">
            <div class="dash-stat__icon bg-emerald-500/10 text-emerald-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
            </div>
            <div>
              <div class="dash-stat__val">{{ fmt(metrika.users) }}</div>
              <div class="dash-stat__label">Посетители</div>
            </div>
          </div>
          <div class="dash-stat">
            <div class="dash-stat__icon bg-cyan-500/10 text-cyan-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>
            </div>
            <div>
              <div class="dash-stat__val">{{ fmt(metrika.pageviews) }}</div>
              <div class="dash-stat__label">Просмотры</div>
            </div>
          </div>
          <div class="dash-stat">
            <div class="dash-stat__icon bg-red-500/10 text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>
            </div>
            <div>
              <div class="dash-stat__val">{{ metrika.bounce_rate }}%</div>
              <div class="dash-stat__label">Отказы</div>
            </div>
          </div>
        </div>
        <div v-else class="rounded-[14px] border border-slate-800 p-6 text-center text-xs text-slate-600">Метрика недоступна</div>
      </div>

    </div>

    <!-- Recent registrations -->
    <div>
      <div class="dash-section-label">Последние регистрации</div>
      <div v-if="loading" class="skeleton h-48 rounded-[14px]" />
      <div v-else-if="recentUsers.length" class="overflow-hidden rounded-[14px] border border-slate-800 bg-slate-900/60">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-800">
                <th class="dash-th">Игрок</th>
                <th class="dash-th">Почта</th>
                <th class="dash-th">Статус</th>
                <th class="dash-th">Зарегистрирован</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr v-for="u in recentUsers" :key="u.id" class="hover:bg-slate-800/30 transition">
                <td class="dash-td">
                  <div class="flex items-center gap-2">
                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-xs font-black text-violet-300">
                      {{ (u.site_login || '?')[0].toUpperCase() }}
                    </div>
                    <div>
                      <div class="font-bold text-slate-100">{{ u.site_login }}</div>
                      <div v-if="u.minecraft_nickname" class="text-xs text-slate-600">{{ u.minecraft_nickname }}</div>
                    </div>
                  </div>
                </td>
                <td class="dash-td text-xs text-slate-600">{{ u.email }}</td>
                <td class="dash-td">
                  <span class="rounded-full border px-2 py-0.5 text-xs font-semibold"
                    :class="u.email_verified
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'"
                  >{{ u.email_verified ? 'Подтверждён' : 'Ожидает' }}</span>
                </td>
                <td class="dash-td">
                  <div class="text-xs text-slate-400">{{ formatDate(u.created_at) }}</div>
                  <div class="text-xs text-slate-600">{{ timeAgo(u.created_at) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="rounded-[14px] border border-slate-800 p-8 text-center text-xs text-slate-600">Нет данных</div>
    </div>

  </div>
</template>

<style scoped>
.dash-section-label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #2d3e58;
  margin-bottom: 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.dash-section-label::before {
  content: '';
  width: 3px; height: 12px; border-radius: 2px;
  background: linear-gradient(180deg, #7c3aed, #4f46e5);
  flex-shrink: 0;
}

.dash-stat {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.9rem;
  background: rgba(15,23,42,0.7);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  transition: border-color 0.15s, transform 0.15s;
}
.dash-stat:hover { transform: translateY(-1px); border-color: rgba(255,255,255,0.09); }
.dash-stat--accent { border-color: rgba(124,58,237,0.2); background: rgba(19,15,34,0.8); }
.dash-stat--accent:hover { border-color: rgba(124,58,237,0.35); }

.dash-stat__icon {
  width: 2rem; height: 2rem; border-radius: 9px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.dash-stat__icon svg { width: 1rem; height: 1rem; }
.dash-stat__val { font-size: 1.35rem; font-weight: 900; color: #e2e8f0; line-height: 1; }
.dash-stat__label { font-size: 0.72rem; font-weight: 700; color: #475569; margin-top: 0.2rem; }
.dash-stat__sub { font-size: 0.68rem; color: #2d3e58; margin-top: 0.1rem; }

.dash-mini-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.8rem;
  background: rgba(15,23,42,0.7);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  text-decoration: none;
  transition: border-color 0.15s, transform 0.15s;
}
.dash-mini-stat:hover { transform: translateY(-1px); border-color: rgba(124,58,237,0.25); }
.dash-mini-stat__icon {
  width: 1.75rem; height: 1.75rem; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.dash-mini-stat__icon svg { width: 0.95rem; height: 0.95rem; }
.dash-mini-stat__val { font-size: 1.2rem; font-weight: 900; color: #e2e8f0; line-height: 1; }
.dash-mini-stat__label { font-size: 0.68rem; font-weight: 700; color: #475569; }

.quick-card {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.8rem 0.9rem;
  background: rgba(15,23,42,0.7);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  text-decoration: none;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.quick-card:hover {
  transform: translateY(-1px);
  border-color: rgba(124,58,237,0.3);
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}
.quick-card__icon {
  width: 2rem; height: 2rem; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.dash-th {
  padding: 0.55rem 1rem;
  text-align: left;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #2d3e58;
}
.dash-td { padding: 0.6rem 1rem; vertical-align: middle; }
</style>
