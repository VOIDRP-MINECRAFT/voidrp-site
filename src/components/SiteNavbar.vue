<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '../config.site'
import { logoutCurrentSession, useAuthStore } from '../stores/authStore'
import { setLocale, getLocale } from '../i18n'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const mobileOpen = ref(false)
const openGroup = ref(null)
const navRef = ref(null)

const isAuthenticated = computed(() => auth.isAuthenticated.value)
const isAdmin = computed(() => auth.isAdmin.value)
const displayName = computed(() => auth.displayName.value || t('auth.profile'))
const minecraftNick = computed(() => auth.state.playerAccount?.minecraft_nickname || null)
const avatarUrl = computed(() => auth.avatarUrl.value)
const userInitial = computed(() => {
  const name = auth.displayName.value || ''
  return name.charAt(0).toUpperCase() || '?'
})

const currentLang = ref(getLocale())
function switchLang(lang) {
  setLocale(lang)
  currentLang.value = lang
}

const navItems = computed(() => [
  {
    label: t('nav.home'),
    to: '/',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>',
  },
  {
    label: t('nav.guide'),
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    children: [
      { label: t('nav.guideModpack'), to: '/guide', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', desc: t('nav.guideModpackDesc') },
      { label: t('nav.recipes'), to: '/recipes', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>', desc: t('nav.recipesDesc') },
    ],
  },
  {
    label: t('nav.economy'),
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    children: [
      { label: t('nav.market'), to: '/market', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>', desc: t('nav.marketDesc') },
      { label: t('nav.shop'), to: '/shop', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>', desc: t('nav.shopDesc') },
    ],
  },
  {
    label: t('nav.factions'),
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    children: [
      { label: t('nav.nations'), to: '/nations', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', desc: t('nav.nationsDesc') },
      { label: t('nav.alliances'), to: '/alliances', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>', desc: t('nav.alliancesDesc') },
    ],
  },
  {
    label: t('nav.rankings'),
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    children: [
      { label: t('nav.topPlayers'), to: '/players/top', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', desc: t('nav.topPlayersDesc') },
      { label: t('nav.ageProgress'), to: '/leaderboard', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>', desc: t('nav.ageProgressDesc') },
      { label: t('nav.nationsRanking'), to: '/nations/rankings', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>', desc: t('nav.nationsRankingDesc') },
    ],
  },
])

const externalItems = computed(() => [
  { label: t('nav.map'), href: siteConfig.bluemapUrl },
  { label: t('nav.discord'), href: siteConfig.discordUrl },
])

function isLeafActive(item) {
  if (!item.to) return false
  if (item.to === '/') return route.path === '/'
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}

function isActive(item) {
  if (item.to) return isLeafActive(item)
  return item.children?.some((c) => isLeafActive(c)) ?? false
}

function toggleGroup(label) {
  openGroup.value = openGroup.value === label ? null : label
}

function handleOutsideClick(e) {
  if (navRef.value && !navRef.value.contains(e.target)) {
    openGroup.value = null
  }
}

function closeDropdown() {
  openGroup.value = null
}

onMounted(() => document.addEventListener('mousedown', handleOutsideClick))
onUnmounted(() => document.removeEventListener('mousedown', handleOutsideClick))

watch(() => route.fullPath, () => {
  mobileOpen.value = false
  openGroup.value = null
})

async function handleLogout() {
  mobileOpen.value = false
  await logoutCurrentSession()
}
</script>

<template>
  <header class="site-navbar" ref="navRef">
    <div class="container-shell">
      <div class="site-navbar__shell">

        <!-- Brand -->
        <RouterLink to="/" class="site-navbar__brand">
          <div class="site-navbar__logo">
            <img src="/logo.jpg" alt="VoidRP" class="site-navbar__logo-image" />
          </div>
          <div class="site-navbar__brand-text">
            <div class="site-navbar__title">{{ siteConfig.serverName }}</div>
            <div class="site-navbar__meta">MC {{ siteConfig.serverVersion }} · {{ siteConfig.serverIp }}</div>
          </div>
        </RouterLink>

        <!-- Desktop nav -->
        <nav class="site-navbar__desktop-nav">
          <template v-for="item in navItems" :key="item.label">

            <!-- Simple link -->
            <RouterLink
              v-if="item.to"
              :to="item.to"
              class="site-navbar__link"
              :class="{ 'site-navbar__link--active': isActive(item) }"
            >
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span v-if="item.icon" class="site-navbar__link-icon" v-html="item.icon" />
              {{ item.label }}
            </RouterLink>

            <!-- Dropdown group -->
            <div v-else class="site-navbar__dropdown-wrap">
              <button
                type="button"
                class="site-navbar__link site-navbar__dropdown-btn"
                :class="{ 'site-navbar__link--active': isActive(item) || openGroup === item.label }"
                @click="toggleGroup(item.label)"
              >
                <!-- eslint-disable-next-line vue/no-v-html -->
                <span v-if="item.icon" class="site-navbar__link-icon" v-html="item.icon" />
                {{ item.label }}
                <svg
                  class="site-navbar__chevron"
                  :class="{ 'site-navbar__chevron--open': openGroup === item.label }"
                  xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              <!-- Dropdown panel -->
              <Transition name="dropdown">
                <div v-if="openGroup === item.label" class="site-navbar__dropdown">
                  <RouterLink
                    v-for="child in item.children"
                    :key="child.to"
                    :to="child.to"
                    class="site-navbar__dropdown-item"
                    :class="{ 'site-navbar__dropdown-item--active': isLeafActive(child) }"
                    @click="closeDropdown"
                  >
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <span class="site-navbar__dropdown-item-icon" v-html="child.icon" />
                    <span class="site-navbar__dropdown-item-text">
                      <span class="site-navbar__dropdown-item-label">{{ child.label }}</span>
                      <span v-if="child.desc" class="site-navbar__dropdown-item-desc">{{ child.desc }}</span>
                    </span>
                  </RouterLink>
                </div>
              </Transition>
            </div>

          </template>
        </nav>

        <!-- Right: external + auth -->
        <div class="site-navbar__actions site-navbar__actions--desktop">
          <a
            v-for="item in externalItems"
            :key="item.href"
            :href="item.href"
            target="_blank"
            rel="noreferrer"
            class="site-navbar__ext-link"
          >
            {{ item.label }}
          </a>

          <div class="site-navbar__divider" />

          <template v-if="isAuthenticated">
            <RouterLink v-if="isAdmin" to="/admin" class="site-navbar__admin-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Админ
            </RouterLink>
            <RouterLink to="/profile" class="site-navbar__avatar-btn">
              <span class="site-navbar__avatar">
                <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="site-navbar__avatar-img" />
                <template v-else>{{ userInitial }}</template>
              </span>
              <span class="site-navbar__avatar-name">{{ minecraftNick || displayName }}</span>
            </RouterLink>
            <button type="button" class="btn btn-ghost btn-sm" @click="handleLogout">
              Выйти
            </button>
          </template>

          <template v-else>
            <RouterLink to="/login" class="btn btn-outline btn-sm">Войти</RouterLink>
            <RouterLink to="/register" class="btn btn-primary btn-sm">Создать</RouterLink>
          </template>
        </div>

        <!-- Mobile toggle -->
        <button
          type="button"
          class="btn btn-outline btn-sm site-navbar__menu-toggle"
          :aria-expanded="mobileOpen ? 'true' : 'false'"
          @click="mobileOpen = !mobileOpen"
        >
          <svg v-if="!mobileOpen" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

      </div>

      <!-- Mobile panel -->
      <transition name="fade">
        <div v-if="mobileOpen" class="site-navbar__mobile-panel surface-card">
          <div class="site-navbar__mobile-links">
            <template v-for="item in navItems" :key="item.label">
              <!-- Simple link -->
              <RouterLink
                v-if="item.to"
                :to="item.to"
                class="site-navbar__mobile-link"
              >
                <!-- eslint-disable-next-line vue/no-v-html -->
                <span v-if="item.icon" class="site-navbar__link-icon" v-html="item.icon" />
                {{ item.label }}
              </RouterLink>

              <!-- Group: label + children -->
              <template v-else>
                <div class="site-navbar__mobile-group-label">
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <span v-if="item.icon" class="site-navbar__link-icon" v-html="item.icon" />
                  {{ item.label }}
                </div>
                <RouterLink
                  v-for="child in item.children"
                  :key="child.to"
                  :to="child.to"
                  class="site-navbar__mobile-link site-navbar__mobile-link--child"
                >
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <span v-if="child.icon" class="site-navbar__link-icon" v-html="child.icon" />
                  {{ child.label }}
                </RouterLink>
              </template>
            </template>

            <a
              v-for="item in externalItems"
              :key="item.href"
              :href="item.href"
              target="_blank"
              rel="noreferrer"
              class="site-navbar__mobile-link"
            >
              {{ item.label }}
            </a>
          </div>

          <div class="site-navbar__mobile-actions">
            <template v-if="isAuthenticated">
              <RouterLink to="/profile" class="btn btn-outline">
                <span class="site-navbar__avatar site-navbar__avatar--sm">
                  <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="site-navbar__avatar-img" />
                  <template v-else>{{ userInitial }}</template>
                </span>
                {{ minecraftNick || displayName }}
              </RouterLink>
              <button type="button" class="btn btn-ghost" @click="handleLogout">Выйти</button>
            </template>

            <template v-else>
              <RouterLink to="/login" class="btn btn-outline">Войти</RouterLink>
              <RouterLink to="/register" class="btn btn-primary">Создать аккаунт</RouterLink>
            </template>
          </div>
        </div>
      </transition>
    </div>
  </header>
</template>

<style scoped>
.site-navbar__link-icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.75;
}
.site-navbar__link:hover .site-navbar__link-icon,
.site-navbar__link--active .site-navbar__link-icon {
  opacity: 1;
}
.site-navbar__link {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
}
.site-navbar__mobile-link {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.75rem;
  padding: 0.5rem 0.95rem;
}

/* ── Dropdown trigger ─────────────────── */
.site-navbar__dropdown-wrap {
  position: relative;
}
.site-navbar__dropdown-btn {
  cursor: pointer;
  background: none;
  border: none;
  gap: 0.38rem;
}
.site-navbar__chevron {
  margin-left: 0.1rem;
  flex-shrink: 0;
  transition: transform 0.18s ease;
  opacity: 0.6;
}
.site-navbar__chevron--open {
  transform: rotate(180deg);
  opacity: 1;
}

/* ── Dropdown panel ───────────────────── */
.site-navbar__dropdown {
  position: absolute;
  top: calc(100% + 0.6rem);
  left: 50%;
  transform: translateX(-50%);
  min-width: 13rem;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(7, 11, 20, 0.92);
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  padding: 0.45rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.site-navbar__dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 0.75rem;
  border-radius: 12px;
  text-decoration: none;
  transition: background 0.15s ease;
}
.site-navbar__dropdown-item:hover {
  background: rgba(255, 255, 255, 0.07);
}
.site-navbar__dropdown-item--active {
  background: rgba(139, 92, 246, 0.15);
}
.site-navbar__dropdown-item-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: #8b9fc8;
  opacity: 0.8;
}
.site-navbar__dropdown-item--active .site-navbar__dropdown-item-icon {
  color: #a78bfa;
  opacity: 1;
}
.site-navbar__dropdown-item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.site-navbar__dropdown-item-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: #dbe7ff;
  white-space: nowrap;
}
.site-navbar__dropdown-item--active .site-navbar__dropdown-item-label {
  color: #c4b5fd;
}
.site-navbar__dropdown-item-desc {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
}

/* ── Dropdown transition ──────────────── */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}

/* ── Admin button ────────────────────── */
.site-navbar__admin-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 800;
  color: #c4b5fd;
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.2);
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.site-navbar__admin-btn:hover {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.35);
}

/* ── External link ────────────────────── */
.site-navbar__ext-link {
  padding: 0.45rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: #8ea0c4;
  border-radius: 999px;
  transition: color 0.2s ease, background 0.2s ease;
}
.site-navbar__ext-link:hover {
  color: #cbd5ea;
  background: rgba(255, 255, 255, 0.05);
}

.site-navbar__divider {
  width: 1px;
  height: 1.4rem;
  background: rgba(148, 163, 184, 0.16);
  flex-shrink: 0;
}

/* ── Avatar button ────────────────────── */
.site-navbar__avatar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.3rem 0.75rem 0.3rem 0.3rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.04);
  transition: border-color 0.2s ease, background 0.2s ease;
  text-decoration: none;
}
.site-navbar__avatar-btn:hover {
  border-color: rgba(139, 92, 246, 0.28);
  background: rgba(139, 92, 246, 0.08);
}
.site-navbar__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 900;
  flex-shrink: 0;
  line-height: 1;
}
.site-navbar__avatar--sm {
  width: 1.6rem;
  height: 1.6rem;
  font-size: 0.75rem;
}
.site-navbar__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 999px;
}
.site-navbar__avatar-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #e5eefc;
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Mobile group label ───────────────── */
.site-navbar__mobile-group-label {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.95rem 0.2rem;
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}
.site-navbar__mobile-link--child {
  padding-left: 2.2rem;
  font-size: 0.87rem;
}
</style>
