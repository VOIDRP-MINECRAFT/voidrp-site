<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { logoutCurrentSession, useAuthStore } from '../../stores/authStore'
import { serverState, activeServer, fetchServers, setActiveServer } from '../../stores/serverStore'

const auth = useAuthStore()
const route = useRoute()
const sidebarOpen = ref(false)
const serverMenuOpen = ref(false)
const serverMenuRef = ref(null)

// Активный сервер скоупит per-server разделы (рынок, нации, БП, античит,
// дашборд) через X-Server-Slug; смена ремаунтит страницы (App.vue key).
onMounted(() => {
  fetchServers()
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKey)
})

function onDocClick(e) {
  if (serverMenuOpen.value && serverMenuRef.value && !serverMenuRef.value.contains(e.target)) {
    serverMenuOpen.value = false
  }
}
function onDocKey(e) {
  if (e.key === 'Escape') serverMenuOpen.value = false
}

const sortedServers = computed(() =>
  [...serverState.list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
)

function pickServer(slug) {
  setActiveServer(slug)
  serverMenuOpen.value = false
}

// ── Акцент от активного сервера — админка перекрашивается как сайт/лаунчер ──
function parseHex(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const themeVars = computed(() => {
  const rgb = parseHex(activeServer.value?.accent_color) || [124, 58, 237]
  return {
    '--adm-acc': `rgb(${rgb.join(',')})`,
    '--adm-acc-rgb': rgb.join(','),
  }
})

const displayName = computed(() => auth.state.playerAccount?.minecraft_nickname || auth.state.user?.site_login || 'Админ')
const pageTitle = computed(() => (typeof route.meta?.title === 'string' ? route.meta.title : 'Панель управления'))

const srvOnline = computed(() => activeServer.value?.status?.online ?? null)
const srvPlayers = computed(() => activeServer.value?.status?.players_online ?? 0)

// ── Навигация: группы кодируют скоуп данных ─────────────────────
const icons = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  metrika: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  market: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  nations: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  battlepass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  anticheat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  players: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  donate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33"/></svg>',
  servers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
  suggestions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  feedback: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>',
  crashes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  landing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
}

const navGroups = computed(() => [
  {
    label: 'Обзор',
    items: [
      { to: '/admin', label: 'Дашборд', exact: true, icon: icons.dashboard },
      { to: '/admin/metrika', label: 'Метрика', icon: icons.metrika },
    ],
  },
  {
    // Разделы этой группы показывают данные ВЫБРАННОГО сервера
    label: activeServer.value?.name || 'Сервер',
    scoped: true,
    items: [
      { to: '/admin/market', label: 'Рынок', icon: icons.market },
      { to: '/admin/nations', label: 'Государства', icon: icons.nations },
      { to: '/admin/battlepass', label: 'Battle Pass', icon: icons.battlepass },
      { to: '/admin/anticheat', label: 'Античит', icon: icons.anticheat },
    ],
  },
  {
    label: 'Платформа',
    items: [
      { to: '/admin/players', label: 'Игроки', icon: icons.players },
      { to: '/admin/donate', label: 'Донаты', icon: icons.donate },
      { to: '/admin/server', label: 'Серверы', icon: icons.servers },
    ],
  },
  {
    label: 'Обратная связь',
    items: [
      { to: '/admin/mod-suggestions', label: 'Предложения модов', icon: icons.suggestions },
      { to: '/admin/feedback', label: 'Обращения', icon: icons.feedback },
      { to: '/admin/launcher-crashes', label: 'Краши лаунчера', icon: icons.crashes },
    ],
  },
  {
    label: 'Сайт',
    items: [
      { to: '/admin/landing', label: 'Главная страница', icon: icons.landing },
    ],
  },
])

function isActive(item) {
  if (item.exact) return route.path === item.to
  return route.path === item.to || route.path.startsWith(item.to + '/')
}

async function handleLogout() {
  sidebarOpen.value = false
  await logoutCurrentSession()
}
</script>

<template>
  <div class="adm-shell adm-root" :style="themeVars">
    <!-- Overlay (mobile) -->
    <Transition name="adm-fade">
      <div v-if="sidebarOpen" class="adm-overlay" @click="sidebarOpen = false" />
    </Transition>

    <!-- ── Sidebar ─────────────────────────────────────────────── -->
    <aside class="adm-sidebar" :class="{ 'adm-sidebar--open': sidebarOpen }">
      <RouterLink to="/admin" class="adm-brand" @click="sidebarOpen = false">
        <div class="adm-brand__icon">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div class="adm-brand__text">
          <span class="adm-brand__name">VoidRP</span>
          <span class="adm-brand__tag">Admin</span>
        </div>
      </RouterLink>

      <nav class="adm-nav">
        <div v-for="group in navGroups" :key="group.label" class="adm-nav__group" :class="{ 'adm-nav__group--scoped': group.scoped }">
          <div class="adm-nav__label">
            <span v-if="group.scoped" class="adm-nav__label-dot" :class="srvOnline ? 'is-on' : ''" />
            <span class="adm-nav__label-text">{{ group.label }}</span>
          </div>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="adm-nav__item"
            :class="{ 'adm-nav__item--active': isActive(item) }"
            @click="sidebarOpen = false"
          >
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span class="adm-nav__icon" v-html="item.icon" />
            <span class="adm-nav__text">{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>

      <div class="adm-sidebar__bottom">
        <RouterLink to="/" class="adm-back-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Вернуться на сайт
        </RouterLink>
      </div>
    </aside>

    <!-- ── Main ────────────────────────────────────────────────── -->
    <div class="adm-main">
      <header class="adm-topbar">
        <button class="adm-topbar__burger" aria-label="Меню" @click="sidebarOpen = !sidebarOpen">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>

        <h2 class="adm-topbar__title">{{ pageTitle }}</h2>

        <div class="adm-topbar__right">
          <!-- Переключатель сервера: скоупит рынок/нации/БП/античит/дашборд -->
          <div ref="serverMenuRef" class="adm-srv">
            <button
              class="adm-srv__btn"
              :aria-expanded="serverMenuOpen"
              title="Активный сервер — рынок, нации, БП, античит и дашборд показываются по нему"
              @click="serverMenuOpen = !serverMenuOpen"
            >
              <span class="adm-dot" :class="srvOnline ? 'adm-dot--ok' : srvOnline === false ? 'adm-dot--err' : ''" />
              <span class="adm-srv__name">{{ activeServer?.name || 'Сервер' }}</span>
              <span v-if="srvOnline" class="adm-srv__count adm-num">{{ srvPlayers }} онлайн</span>
              <svg class="adm-srv__chev" :class="{ 'is-open': serverMenuOpen }" width="10" height="10" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>

            <Transition name="adm-pop">
              <div v-if="serverMenuOpen" class="adm-srv__menu">
                <div class="adm-srv__menu-label">Активный сервер</div>
                <button
                  v-for="s in sortedServers"
                  :key="s.slug"
                  class="adm-srv__opt"
                  :class="{ 'is-active': s.slug === serverState.activeSlug }"
                  @click="pickServer(s.slug)"
                >
                  <span class="adm-dot" :class="s.status?.online ? 'adm-dot--ok' : 'adm-dot--err'" />
                  <span class="adm-srv__opt-body">
                    <span class="adm-srv__opt-name">{{ s.name }}</span>
                    <span class="adm-srv__opt-meta adm-mono">
                      {{ s.status?.online ? `${s.status.players_online ?? 0} онлайн` : 'офлайн' }}{{ s.maintenance ? ' · тех. работы' : '' }}
                    </span>
                  </span>
                  <svg v-if="s.slug === serverState.activeSlug" class="adm-srv__opt-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
                <div class="adm-srv__menu-hint">Рынок, нации, БП, античит и дашборд — по этому серверу</div>
              </div>
            </Transition>
          </div>

          <!-- Пользователь -->
          <div class="adm-user">
            <div class="adm-avatar">{{ displayName.charAt(0).toUpperCase() }}</div>
            <span class="adm-user__name">{{ displayName }}</span>
            <button class="adm-user__logout" title="Выйти из аккаунта" @click="handleLogout">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </header>

      <div class="adm-content">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.adm-root {
  display: flex;
  min-height: 100vh;
  overflow-x: hidden;
}

/* ── Sidebar ─────────────────────────────────────────────────── */
.adm-sidebar {
  width: 236px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--adm-bg-soft);
  border-right: 1px solid var(--adm-line);
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 50;
  transform: translateX(-100%);
  transition: transform 0.22s cubic-bezier(.4,0,.2,1);
  overflow-y: auto;
}
@media (min-width: 900px) {
  .adm-sidebar { position: sticky; top: 0; height: 100vh; transform: none; }
}
.adm-sidebar--open { transform: translateX(0); box-shadow: 8px 0 50px rgba(0,0,0,0.55); }

/* Бренд */
.adm-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1.05rem 1rem 0.95rem;
  text-decoration: none;
  border-bottom: 1px solid var(--adm-line);
}
.adm-brand__icon {
  width: 2rem;
  height: 2rem;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--adm-acc), rgba(var(--adm-acc-rgb), 0.55));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 18px rgba(var(--adm-acc-rgb), 0.35);
  transition: background 0.4s, box-shadow 0.4s;
}
.adm-brand__text { display: flex; align-items: baseline; gap: 0.35rem; }
.adm-brand__name { font-size: 0.95rem; font-weight: 900; letter-spacing: -0.01em; color: var(--adm-text); }
.adm-brand__tag {
  font-family: var(--adm-mono);
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--adm-acc-text);
  transition: color 0.4s;
}

/* Навигация */
.adm-nav { flex: 1; padding: 0.75rem 0.65rem 1rem; display: flex; flex-direction: column; gap: 0.9rem; }

.adm-nav__group { display: flex; flex-direction: column; gap: 0.1rem; }

/* Группа выбранного сервера: акцентная рейка кодирует «данные по серверу» */
.adm-nav__group--scoped {
  position: relative;
  padding-left: 0.55rem;
  margin-left: 0.15rem;
}
.adm-nav__group--scoped::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.2rem;
  bottom: 0.2rem;
  width: 2px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--adm-acc), rgba(var(--adm-acc-rgb), 0.15));
  transition: background 0.4s;
}

.adm-nav__label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.7rem 0.3rem;
  font-size: 0.585rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.13em;
  color: var(--adm-faint);
  white-space: nowrap;
  overflow: hidden;
}
.adm-nav__group--scoped .adm-nav__label { color: var(--adm-acc-text); transition: color 0.4s; }
.adm-nav__label-text { overflow: hidden; text-overflow: ellipsis; }
.adm-nav__label-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--adm-faint); flex-shrink: 0; }
.adm-nav__label-dot.is-on { background: var(--adm-ok); box-shadow: 0 0 5px rgba(52,211,153,0.7); }

.adm-nav__item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.7rem;
  border-radius: 9px;
  font-size: 0.83rem;
  font-weight: 600;
  color: var(--adm-dim);
  text-decoration: none;
  transition: background-color 0.14s, color 0.14s;
}
.adm-nav__item:hover { background: rgba(148,163,184,0.07); color: var(--adm-mut); }
.adm-nav__item--active {
  background: var(--adm-acc-soft);
  color: var(--adm-acc-text);
  transition: background-color 0.4s, color 0.4s;
}
.adm-nav__icon { display: flex; align-items: center; flex-shrink: 0; opacity: 0.7; }
.adm-nav__icon :deep(svg) { width: 15px; height: 15px; }
.adm-nav__item--active .adm-nav__icon, .adm-nav__item:hover .adm-nav__icon { opacity: 1; }
.adm-nav__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Низ сайдбара */
.adm-sidebar__bottom { padding: 0.7rem 0.65rem; border-top: 1px solid var(--adm-line); }
.adm-back-link {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.7rem;
  border-radius: 8px;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--adm-dim);
  text-decoration: none;
  transition: color 0.13s, background-color 0.13s;
}
.adm-back-link:hover { color: var(--adm-mut); background: rgba(148,163,184,0.06); }

/* ── Overlay ─────────────────────────────────────────────────── */
.adm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2,4,9,0.65);
  z-index: 49;
  backdrop-filter: blur(2px);
}
@media (min-width: 900px) { .adm-overlay { display: none; } }

/* ── Main / Topbar ───────────────────────────────────────────── */
.adm-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.adm-topbar {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem 1.4rem;
  min-height: 54px;
  background: rgba(9, 13, 24, 0.82);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--adm-line);
  position: sticky;
  top: 0;
  z-index: 40;
}
@media (max-width: 640px) { .adm-topbar { padding: 0.55rem 0.85rem; } }

.adm-topbar__burger {
  display: none;
  background: none;
  border: none;
  color: var(--adm-mut);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 7px;
}
.adm-topbar__burger:hover { color: var(--adm-text); }
@media (max-width: 899px) { .adm-topbar__burger { display: flex; } }

.adm-topbar__title {
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--adm-text);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adm-topbar__right { margin-left: auto; display: flex; align-items: center; gap: 0.6rem; }

/* ── Переключатель сервера ───────────────────────────────────── */
.adm-srv { position: relative; }
.adm-srv__btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.42rem 0.7rem;
  border-radius: 10px;
  border: 1px solid var(--adm-acc-line);
  background: var(--adm-acc-soft);
  color: var(--adm-text);
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 0.4s, background-color 0.4s, filter 0.13s;
  max-width: 300px;
}
.adm-srv__btn:hover { filter: brightness(1.15); }
.adm-srv__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adm-srv__count {
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--adm-mut);
  padding-left: 0.5rem;
  border-left: 1px solid var(--adm-line-strong);
  white-space: nowrap;
}
@media (max-width: 520px) { .adm-srv__count { display: none; } }
.adm-srv__chev { color: var(--adm-dim); flex-shrink: 0; transition: transform 0.18s; }
.adm-srv__chev.is-open { transform: rotate(180deg); }

.adm-srv__menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 60;
  width: 268px;
  padding: 0.5rem;
  background: var(--adm-card-2);
  border: 1px solid var(--adm-line-strong);
  border-radius: 14px;
  box-shadow: 0 22px 60px rgba(0,0,0,0.55);
}
.adm-srv__menu-label {
  padding: 0.25rem 0.6rem 0.45rem;
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.13em;
  color: var(--adm-dim);
}
.adm-srv__opt {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: none;
  border-radius: 9px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.13s;
}
.adm-srv__opt:hover { background: rgba(148,163,184,0.08); }
.adm-srv__opt.is-active { background: var(--adm-acc-soft); }
.adm-srv__opt-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.adm-srv__opt-name { font-size: 0.8rem; font-weight: 800; color: var(--adm-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adm-srv__opt-meta { font-size: 0.64rem; color: var(--adm-dim); }
.adm-srv__opt-check { color: var(--adm-acc-text); flex-shrink: 0; }
.adm-srv__menu-hint {
  margin-top: 0.35rem;
  padding: 0.5rem 0.6rem 0.25rem;
  border-top: 1px solid var(--adm-line);
  font-size: 0.63rem;
  line-height: 1.5;
  color: var(--adm-dim);
}

/* ── Пользователь ────────────────────────────────────────────── */
.adm-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.28rem 0.28rem 0.28rem 0.3rem;
  border-radius: 11px;
  border: 1px solid var(--adm-line);
  background: rgba(148,163,184,0.04);
}
.adm-user__name {
  font-size: 0.76rem;
  font-weight: 800;
  color: var(--adm-mut);
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 640px) { .adm-user__name { display: none; } }
.adm-user__logout {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--adm-faint);
  display: flex;
  align-items: center;
  padding: 0.3rem;
  border-radius: 7px;
  transition: color 0.13s, background-color 0.13s;
}
.adm-user__logout:hover { color: var(--adm-err); background: rgba(248,113,113,0.09); }

/* ── Content ─────────────────────────────────────────────────── */
.adm-content { flex: 1; overflow-x: hidden; }

/* ── Transitions ─────────────────────────────────────────────── */
.adm-fade-enter-active, .adm-fade-leave-active { transition: opacity 0.2s ease; }
.adm-fade-enter-from, .adm-fade-leave-to { opacity: 0; }

.adm-pop-enter-active { transition: opacity 0.16s ease, transform 0.16s cubic-bezier(.3,1.4,.6,1); }
.adm-pop-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.adm-pop-enter-from, .adm-pop-leave-to { opacity: 0; transform: translateY(-5px) scale(0.98); }
</style>
