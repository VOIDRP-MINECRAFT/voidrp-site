<script setup>
import { computed, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { logoutCurrentSession, useAuthStore } from '../../stores/authStore'

const auth = useAuthStore()
const route = useRoute()
const sidebarOpen = ref(false)

const displayName = computed(() => auth.state.playerAccount?.minecraft_nickname || auth.state.user?.site_login || 'Админ')

const navItems = [
  {
    to: '/admin',
    label: 'Дашборд',
    exact: true,
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  },
  {
    to: '/admin/players',
    label: 'Игроки',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  },
  {
    to: '/admin/market',
    label: 'Рынок',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  },
  {
    to: '/admin/server',
    label: 'Сервер',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  },
  {
    to: '/admin/nations',
    label: 'Государства',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  },
  {
    to: '/admin/battlepass',
    label: 'Battle Pass',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  },
  {
    to: '/admin/donate',
    label: 'Донаты',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33"/></svg>`,
  },
  {
    to: '/admin/mod-suggestions',
    label: 'Предложения модов',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  },
  {
    to: '/admin/feedback',
    label: 'Обращения',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>`,
  },
  {
    to: '/admin/launcher-crashes',
    label: 'Краши лаунчера',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  },
  {
    to: '/admin/metrika',
    label: 'Метрика',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  },
  {
    to: '/admin/anticheat',
    label: 'Античит',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  },
  {
    to: '/admin/landing',
    label: 'Главная страница',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  },
]

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
  <div class="adm-shell">
    <!-- Overlay -->
    <Transition name="fade">
      <div v-if="sidebarOpen" class="adm-overlay" @click="sidebarOpen = false" />
    </Transition>

    <!-- Sidebar -->
    <aside class="adm-sidebar" :class="{ 'adm-sidebar--open': sidebarOpen }">
      <div class="adm-sidebar__top">
        <RouterLink to="/admin" class="adm-brand" @click="sidebarOpen = false">
          <div class="adm-brand__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div class="adm-brand__name">VoidRP Admin</div>
            <div class="adm-brand__sub">Панель управления</div>
          </div>
        </RouterLink>
      </div>

      <nav class="adm-nav">
        <div class="adm-nav__section">Управление</div>
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="adm-nav__item"
          :class="{ 'adm-nav__item--active': isActive(item) }"
          @click="sidebarOpen = false"
        >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span class="adm-nav__icon" v-html="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="adm-sidebar__bottom">
        <RouterLink to="/" class="adm-back-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          На сайт
        </RouterLink>
        <div class="adm-user">
          <div class="adm-user__avatar">{{ displayName.charAt(0).toUpperCase() }}</div>
          <div class="adm-user__info">
            <div class="adm-user__name">{{ displayName }}</div>
            <div class="adm-user__role">Администратор</div>
          </div>
          <button class="adm-user__logout" title="Выйти" @click="handleLogout">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="adm-main">
      <!-- Mobile header -->
      <header class="adm-topbar">
        <button class="adm-topbar__btn" @click="sidebarOpen = !sidebarOpen">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span class="adm-topbar__title">VoidRP Admin</span>
      </header>

      <div class="adm-content">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.adm-shell {
  display: flex;
  min-height: 100vh;
  background: #070b14;
  overflow-x: hidden;
}

/* ── Sidebar ───────────── */
.adm-sidebar {
  width: 232px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(175deg, #0d1225 0%, #090e1a 60%, #060b17 100%);
  border-right: 1px solid rgba(255,255,255,0.06);
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 50;
  transform: translateX(-100%);
  transition: transform 0.22s cubic-bezier(.4,0,.2,1);
  overflow-y: auto;
  box-shadow: 4px 0 40px rgba(0,0,0,0.5);
}

@media (min-width: 860px) {
  .adm-sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    transform: none;
    flex-shrink: 0;
  }
}

.adm-sidebar--open { transform: translateX(0); }

.adm-sidebar__top {
  padding: 1.1rem 0.9rem 0.8rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.adm-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  text-decoration: none;
}

.adm-brand__icon {
  width: 2rem;
  height: 2rem;
  border-radius: 9px;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 20px rgba(124,58,237,0.4), 0 0 0 1px rgba(124,58,237,0.15);
}

.adm-brand__name {
  font-size: 0.87rem;
  font-weight: 800;
  color: #e2e8f0;
  line-height: 1.2;
}

.adm-brand__sub {
  font-size: .75rem;
  color: #475569;
  font-weight: 600;
}

/* ── Nav ───────────── */
.adm-nav {
  flex: 1;
  padding: 0.55rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.adm-nav__section {
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #1e2d45;
  padding: 0.3rem 0.75rem 0.2rem;
  margin-bottom: 0.1rem;
}

.adm-nav__item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.52rem 0.75rem;
  border-radius: 9px;
  font-size: 0.845rem;
  font-weight: 600;
  color: #64748b;
  text-decoration: none;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}

.adm-nav__item:hover {
  background: rgba(255,255,255,0.06);
  color: #94a3b8;
}

.adm-nav__item--active {
  background: linear-gradient(90deg, rgba(124,58,237,0.22) 0%, rgba(79,70,229,0.05) 100%);
  color: #c4b5fd;
  box-shadow: inset 3px 0 0 #7c3aed;
}

.adm-nav__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.65;
  transition: opacity 0.15s;
}

.adm-nav__item--active .adm-nav__icon,
.adm-nav__item:hover .adm-nav__icon {
  opacity: 1;
}

/* ── Sidebar bottom ───────────── */
.adm-sidebar__bottom {
  padding: 0.7rem 0.6rem;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.adm-back-link {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #475569;
  text-decoration: none;
  transition: color 0.13s, background 0.13s;
}

.adm-back-link:hover { color: #64748b; background: rgba(255,255,255,0.04); }

.adm-user {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
}

.adm-user__avatar {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 8px;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 900;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 12px rgba(124,58,237,0.35);
}

.adm-user__info { flex: 1; min-width: 0; }

.adm-user__name {
  font-size: 0.78rem;
  font-weight: 700;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adm-user__role {
  font-size: .75rem;
  color: #334155;
  font-weight: 600;
}

.adm-user__logout {
  background: none;
  border: none;
  cursor: pointer;
  color: #334155;
  display: flex;
  align-items: center;
  padding: 0.2rem;
  border-radius: 5px;
  transition: color 0.13s;
  flex-shrink: 0;
}

.adm-user__logout:hover { color: #ef4444; }

/* ── Overlay ───────────── */
.adm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 49;
  backdrop-filter: blur(2px);
}

@media (min-width: 860px) { .adm-overlay { display: none; } }

/* ── Main ───────────── */
.adm-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

/* ── Topbar (mobile) ───────────── */
.adm-topbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  background: #0b1020;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  position: sticky;
  top: 0;
  z-index: 10;
}

@media (min-width: 860px) { .adm-topbar { display: none; } }

.adm-topbar__btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0.2rem;
}

.adm-topbar__title {
  font-size: 0.87rem;
  font-weight: 800;
  color: #e2e8f0;
}

/* ── Content ───────────── */
.adm-content {
  flex: 1;
  overflow-x: hidden;
}

/* Transition */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
