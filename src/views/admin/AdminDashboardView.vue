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
function sparkline(data, color = 'currentColor', w = 80, h = 28) {
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

const regSparkline = computed(() => sparkline(stats.value?.users?.reg_trend, 'var(--adm-acc)'))

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
  { to: '/admin/server', label: 'Серверы', sub: 'Онлайн, модпаки', iconClass: 'bg-emerald-500/10 text-emerald-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>' },
  { to: '/admin/nations', label: 'Государства', sub: 'Альянсы, участники', iconClass: 'bg-orange-500/10 text-orange-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  { to: '/admin/mod-suggestions', label: 'Предложения', sub: 'Моды от игроков', iconClass: 'bg-pink-500/10 text-pink-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>' },
  { to: '/admin/metrika', label: 'Метрика', sub: 'Яндекс.Метрика', iconClass: 'bg-red-500/10 text-red-400', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
]
</script>

<template>
  <div class="adm-page">

    <!-- Header -->
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Дашборд</h1>
        <p class="adm-sub">Игровые показатели — по выбранному серверу, аккаунты — по всей платформе</p>
      </div>
      <button class="adm-btn" :disabled="loading" @click="loadAll">
        <svg :class="loading ? 'animate-spin' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
        Обновить
      </button>
    </div>

    <!-- Server status -->
    <div
      class="flex items-center gap-3 rounded-[14px] border px-4 py-3"
      :class="server?.online ? 'srv-strip--on' : 'srv-strip--off'"
    >
      <span class="adm-dot" :class="server?.online ? 'adm-dot--ok' : 'adm-dot--err'" />
      <div class="flex-1 min-w-0">
        <span class="text-sm font-black" :class="server?.online ? 'text-emerald-300' : 'text-red-300'">
          {{ server?.online ? 'Сервер онлайн' : 'Сервер офлайн' }}
        </span>
        <span v-if="server?.online" class="ml-2 text-xs adm-num" style="color: var(--adm-dim)">
          {{ server.players_online }}/{{ server.players_max }} игроков · {{ server.version }} · {{ server.latency_ms }}мс
        </span>
        <span v-else class="ml-2 text-xs" style="color: var(--adm-faint)">{{ server?.reason || '—' }}</span>
      </div>
      <div v-if="server?.online && server.players_sample?.length" class="hidden sm:flex items-center gap-1">
        <span v-for="p in server.players_sample.slice(0, 5)" :key="p.id" class="adm-badge adm-mono">{{ p.name }}</span>
        <span v-if="server.players_sample.length > 5" class="text-xs" style="color: var(--adm-faint)">+{{ server.players_sample.length - 5 }}</span>
      </div>
      <RouterLink to="/admin/server" class="shrink-0 text-xs font-bold transition srv-strip__more">Подробнее →</RouterLink>
    </div>

    <!-- User stats -->
    <div>
      <div class="adm-label">Пользователи · вся платформа</div>
      <div v-if="loading" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="adm-skel h-24" />
      </div>
      <div v-else-if="stats" class="grid grid-cols-2 gap-3 lg:grid-cols-4">

        <div class="adm-kpi">
          <div class="adm-kpi__icon bg-blue-500/10 text-blue-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="adm-kpi__val">{{ fmt(stats.users.total) }}</div>
            <div class="adm-kpi__label">Аккаунтов</div>
            <div class="adm-kpi__sub">активных {{ fmt(stats.users.active) }}</div>
          </div>
        </div>

        <div class="adm-kpi adm-kpi--acc">
          <div class="adm-kpi__icon" style="background: var(--adm-acc-soft); color: var(--adm-acc-text)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-end gap-2">
              <div class="adm-kpi__val" style="color: var(--adm-acc-text)">+{{ fmt(stats.users.new_last_7d) }}</div>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span v-if="stats.users.reg_trend" class="mb-0.5 opacity-70" v-html="regSparkline" />
            </div>
            <div class="adm-kpi__label">За 7 дней</div>
            <div class="adm-kpi__sub">+{{ fmt(stats.users.new_last_30d) }} за 30 дней</div>
          </div>
        </div>

        <div class="adm-kpi">
          <div class="adm-kpi__icon bg-emerald-500/10 text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <div class="adm-kpi__val">{{ fmt(stats.users.verified) }}</div>
            <div class="adm-kpi__label">Подтверждены</div>
            <div class="adm-kpi__sub">{{ stats.users.total > 0 ? Math.round(stats.users.verified / stats.users.total * 100) : 0 }}% от всех</div>
          </div>
        </div>

        <div class="adm-kpi">
          <div class="adm-kpi__icon bg-cyan-500/10 text-cyan-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"/></svg>
          </div>
          <div>
            <div class="adm-kpi__val">{{ fmt(stats.players.total) }}</div>
            <div class="adm-kpi__label">Игровых аккаунтов</div>
            <div class="adm-kpi__sub">привязанных ников</div>
          </div>
        </div>

      </div>
    </div>

    <!-- Content stats (per-server) -->
    <div>
      <div class="adm-label">Контент · выбранный сервер</div>
      <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div v-for="i in 6" :key="i" class="adm-skel h-20" />
      </div>
      <div v-else-if="stats" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

        <RouterLink to="/admin/nations" class="mini-kpi">
          <div class="mini-kpi__icon bg-orange-500/10 text-orange-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          </div>
          <div class="mini-kpi__val adm-num">{{ fmt(stats.nations.total) }}</div>
          <div class="mini-kpi__label">Государств</div>
        </RouterLink>

        <RouterLink to="/admin/nations" class="mini-kpi">
          <div class="mini-kpi__icon bg-amber-500/10 text-amber-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>
          </div>
          <div class="mini-kpi__val adm-num">{{ fmt(stats.alliances.total) }}</div>
          <div class="mini-kpi__label">Альянсов</div>
        </RouterLink>

        <RouterLink to="/admin/battlepass" class="mini-kpi">
          <div class="mini-kpi__icon" style="background: var(--adm-acc-soft); color: var(--adm-acc-text)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
          </div>
          <div class="mini-kpi__val adm-num" style="color: var(--adm-acc-text)">{{ fmt(stats.battlepass.active_premium) }}</div>
          <div class="mini-kpi__label">BP Premium</div>
        </RouterLink>

        <RouterLink to="/admin/battlepass" class="mini-kpi">
          <div class="mini-kpi__icon bg-indigo-500/10 text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
          </div>
          <div class="mini-kpi__val adm-num">{{ fmt(stats.battlepass.progress_count) }}</div>
          <div class="mini-kpi__label">BP игроков</div>
        </RouterLink>

        <RouterLink to="/admin/market" class="mini-kpi">
          <div class="mini-kpi__icon bg-teal-500/10 text-teal-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75"/></svg>
          </div>
          <div class="mini-kpi__val adm-num">{{ fmt(stats.market.enabled_items) }}</div>
          <div class="mini-kpi__label">Товаров рынка</div>
        </RouterLink>

        <RouterLink to="/admin/mod-suggestions" class="mini-kpi">
          <div class="mini-kpi__icon bg-pink-500/10 text-pink-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>
          </div>
          <div class="mini-kpi__val adm-num">{{ fmt(stats.mod_suggestions.total) }}</div>
          <div class="mini-kpi__label">Предложений модов</div>
        </RouterLink>

      </div>
    </div>

    <!-- Two-column: Quick links + Metrika -->
    <div class="grid gap-5 lg:grid-cols-2">

      <!-- Quick links -->
      <div>
        <div class="adm-label">Быстрый доступ</div>
        <div class="grid grid-cols-2 gap-2">
          <RouterLink v-for="link in quickLinks" :key="link.to" :to="link.to" class="quick-card group">
            <div class="quick-card__icon" :class="link.iconClass">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span v-html="link.icon" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="quick-card__label">{{ link.label }}</div>
              <div class="quick-card__sub">{{ link.sub }}</div>
            </div>
            <svg class="quick-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
          </RouterLink>
        </div>
      </div>

      <!-- Metrika -->
      <div>
        <div class="adm-label">Яндекс.Метрика — 30 дней</div>
        <div v-if="metrikaLoading" class="grid grid-cols-2 gap-2">
          <div v-for="i in 4" :key="i" class="adm-skel h-20" />
        </div>
        <div v-else-if="metrika" class="grid grid-cols-2 gap-2">
          <div class="adm-kpi">
            <div class="adm-kpi__icon bg-blue-500/10 text-blue-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
            </div>
            <div>
              <div class="adm-kpi__val">{{ fmt(metrika.visits) }}</div>
              <div class="adm-kpi__label">Визиты</div>
            </div>
          </div>
          <div class="adm-kpi">
            <div class="adm-kpi__icon bg-emerald-500/10 text-emerald-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
            </div>
            <div>
              <div class="adm-kpi__val">{{ fmt(metrika.users) }}</div>
              <div class="adm-kpi__label">Посетители</div>
            </div>
          </div>
          <div class="adm-kpi">
            <div class="adm-kpi__icon bg-cyan-500/10 text-cyan-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>
            </div>
            <div>
              <div class="adm-kpi__val">{{ fmt(metrika.pageviews) }}</div>
              <div class="adm-kpi__label">Просмотры</div>
            </div>
          </div>
          <div class="adm-kpi">
            <div class="adm-kpi__icon bg-red-500/10 text-red-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>
            </div>
            <div>
              <div class="adm-kpi__val">{{ metrika.bounce_rate }}%</div>
              <div class="adm-kpi__label">Отказы</div>
            </div>
          </div>
        </div>
        <div v-else class="adm-empty">
          <div class="adm-empty__title">Метрика недоступна</div>
          <div class="adm-empty__sub">Проверь токен Яндекс.Метрики в настройках бэкенда</div>
        </div>
      </div>

    </div>

    <!-- Recent registrations -->
    <div>
      <div class="adm-label">Последние регистрации</div>
      <div v-if="loading" class="adm-skel h-48" />
      <div v-else-if="recentUsers.length" class="adm-table-wrap">
        <div class="adm-table-scroll">
          <table class="adm-table">
            <thead>
              <tr>
                <th>Игрок</th>
                <th>Почта</th>
                <th>Статус</th>
                <th>Зарегистрирован</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in recentUsers" :key="u.id">
                <td>
                  <div class="flex items-center gap-2">
                    <div class="adm-avatar" style="width: 1.75rem; height: 1.75rem; font-size: 0.7rem">
                      {{ (u.site_login || '?')[0].toUpperCase() }}
                    </div>
                    <div>
                      <div class="font-bold" style="color: var(--adm-text)">{{ u.site_login }}</div>
                      <div v-if="u.minecraft_nickname" class="text-xs adm-mono" style="color: var(--adm-dim)">{{ u.minecraft_nickname }}</div>
                    </div>
                  </div>
                </td>
                <td class="text-xs" style="color: var(--adm-dim)">{{ u.email }}</td>
                <td>
                  <span class="adm-badge" :class="u.email_verified ? 'adm-badge--ok' : 'adm-badge--warn'">
                    {{ u.email_verified ? 'Подтверждён' : 'Ожидает' }}
                  </span>
                </td>
                <td>
                  <div class="text-xs adm-num" style="color: var(--adm-mut)">{{ formatDate(u.created_at) }}</div>
                  <div class="text-xs" style="color: var(--adm-dim)">{{ timeAgo(u.created_at) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="adm-empty">
        <div class="adm-empty__title">Пока нет регистраций</div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Статус-полоса сервера */
.srv-strip--on { background: rgba(52, 211, 153, 0.05); border-color: rgba(52, 211, 153, 0.2); }
.srv-strip--off { background: rgba(248, 113, 113, 0.05); border-color: rgba(248, 113, 113, 0.16); }
.srv-strip__more { color: var(--adm-dim); }
.srv-strip__more:hover { color: var(--adm-mut); }

/* Мини-KPI (вертикальная карточка-ссылка) */
.mini-kpi {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.8rem;
  background: var(--adm-card);
  border: 1px solid var(--adm-line);
  border-radius: var(--adm-r);
  text-decoration: none;
  transition: border-color 0.16s, transform 0.16s;
}
.mini-kpi:hover { transform: translateY(-1px); border-color: var(--adm-acc-line); }
.mini-kpi__icon {
  width: 1.75rem; height: 1.75rem; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.mini-kpi__icon svg { width: 0.95rem; height: 0.95rem; }
.mini-kpi__val { font-size: 1.2rem; font-weight: 700; color: var(--adm-text); line-height: 1; }
.mini-kpi__label { font-size: 0.68rem; font-weight: 700; color: var(--adm-mut); }

/* Карточка быстрого доступа */
.quick-card {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.8rem 0.9rem;
  background: var(--adm-card);
  border: 1px solid var(--adm-line);
  border-radius: var(--adm-r);
  text-decoration: none;
  transition: border-color 0.16s, transform 0.16s, box-shadow 0.16s;
}
.quick-card:hover {
  transform: translateY(-1px);
  border-color: var(--adm-acc-line);
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}
.quick-card__icon {
  width: 2rem; height: 2rem; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.quick-card__label { font-size: 0.84rem; font-weight: 800; color: var(--adm-text); transition: color 0.14s; }
.quick-card:hover .quick-card__label { color: var(--adm-acc-text); }
.quick-card__sub { font-size: 0.7rem; color: var(--adm-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.1rem; }
.quick-card__arrow { width: 1rem; height: 1rem; flex-shrink: 0; color: var(--adm-faint); transition: color 0.14s, transform 0.14s; }
.quick-card:hover .quick-card__arrow { color: var(--adm-acc-text); transform: translateX(2px); }
</style>
