<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getMyNation, getNationsList } from '../services/nationsApi'
import { useAuthStore } from '../stores/authStore'
import { formatNumber } from '../utils/formatters'
import { usePageMeta } from '../composables/usePageMeta.js'

usePageMeta({
  title: 'Государства',
  description: 'Список всех государств сервера VoidRP. Смотри состав, казну и статистику каждого государства. Создай своё или вступи в существующее.',
  url: 'https://void-rp.ru/nations',
  breadcrumbs: [
    { name: 'Главная', url: '/' },
    { name: 'Государства' },
  ],
})

const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(true)
const error = ref('')
const search = ref('')
const recruitmentFilter = ref('all')
const sortMode = ref('recommended')
const nations = ref({ total: 0, items: [] })
const myNation = ref(null)

const allItems = computed(() => Array.isArray(nations.value?.items) ? nations.value.items : [])

const filteredNations = computed(() => {
  const q = search.value.trim().toLowerCase()
  let items = [...allItems.value]

  if (recruitmentFilter.value !== 'all') {
    items = items.filter((item) => item.recruitment_policy === recruitmentFilter.value)
  }

  if (q) {
    items = items.filter((item) => {
      const haystack = [item.title, item.tag, item.slug, item.short_description]
        .map((v) => String(v || '').toLowerCase()).join(' ')
      return haystack.includes(q)
    })
  }

  items.sort((a, b) => {
    if (sortMode.value === 'members')
      return Number(b?.stats?.members_count || 0) - Number(a?.stats?.members_count || 0)
    if (sortMode.value === 'newest')
      return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime()

    const weight = (item) => {
      let s = 0
      if (item?.recruitment_policy === 'open') s += 40
      if (item?.recruitment_policy === 'request') s += 20
      if (item?.viewer_request_status === 'pending') s -= 10
      s += Number(item?.stats?.members_count || 0) * 2
      if (myNation.value?.slug === item?.slug) s += 1000
      return s
    }
    return weight(b) - weight(a)
  })

  return items
})

const counters = computed(() => [
  { label: t('nationsList.totalAll'), value: allItems.value.length },
  { label: t('nationsList.totalOpen'), value: allItems.value.filter((i) => i.recruitment_policy === 'open').length },
  { label: t('nationsList.totalRequest'), value: allItems.value.filter((i) => i.recruitment_policy === 'request').length },
  { label: t('nationsList.totalInvite'), value: allItems.value.filter((i) => i.recruitment_policy === 'invite_only').length },
])

async function loadPage() {
  loading.value = true
  error.value = ''
  try {
    const [listPayload, myPayload] = await Promise.all([
      getNationsList(auth.accessToken || null),
      auth.isAuthenticated.value ? getMyNation(auth.accessToken) : Promise.resolve(null),
    ])
    nations.value = listPayload || { total: 0, items: [] }
    myNation.value = myPayload || null
  } catch (err) {
    error.value = err.message || t('nationsList.loadError')
  } finally {
    loading.value = false
  }
}

function policyLabel(value) {
  if (value === 'open') return t('nationsList.policyOpen')
  if (value === 'request') return t('nationsList.policyRequest')
  return t('nationsList.policyClosed')
}

function policyClass(value) {
  if (value === 'open') return 'badge-open'
  if (value === 'request') return 'badge-req'
  return 'badge-closed'
}

function iconUrl(nation) {
  return nation.assets?.icon_url || nation.assets?.icon_preview_url || ''
}

function bannerUrl(nation) {
  return nation.assets?.banner_url || nation.assets?.banner_preview_url || ''
}

function cta(nation) {
  if (!auth.isAuthenticated.value) {
    return { label: t('nationsList.ctaLogin'), to: '/login', style: 'outline' }
  }
  if (myNation.value?.slug === nation.slug) {
    return {
      label: myNation.value.viewer_can_manage ? t('nationsList.ctaManage') : t('nationsList.ctaOpen'),
      to: myNation.value.viewer_can_manage ? '/nation/studio' : `/nation/${nation.slug}`,
      style: 'mine',
    }
  }
  if (myNation.value?.slug && myNation.value.slug !== nation.slug) {
    return { label: t('nationsList.ctaMyNation'), to: myNation.value.viewer_can_manage ? '/nation/studio' : `/nation/${myNation.value.slug}`, style: 'outline' }
  }
  if (nation.viewer_request_status === 'pending') {
    return { label: t('nationsList.ctaPending'), to: `/nation/${nation.slug}`, style: 'muted' }
  }
  if (nation.recruitment_policy === 'invite_only') {
    return { label: t('nationsList.ctaInviteOnly'), to: `/nation/${nation.slug}`, style: 'muted' }
  }
  if (nation.recruitment_policy === 'open') {
    return { label: t('nationsList.ctaJoin'), to: `/nation/${nation.slug}`, style: 'accent' }
  }
  return { label: t('nationsList.ctaRequest'), to: `/nation/${nation.slug}`, style: 'accent' }
}

onMounted(loadPage)
</script>

<template>
  <section class="nl py-3 md:py-4 auth-page">
    <div class="container-shell max-w-[1380px] space-y-3 page-entry">

      <!-- header + controls -->
      <header class="nl-header">
        <div class="nl-header__title">
          <p class="nl-eyebrow">{{ t('nationsList.eyebrow') }}</p>
          <h1 class="nl-h1">{{ t('nationsList.title') }}</h1>
        </div>
        <div class="nl-controls">
          <div class="nl-search">
            <svg class="nl-search__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
            <input v-model="search" class="nl-search__input" :placeholder="t('nationsList.searchPlaceholder')" />
            <span v-if="search" class="nl-search__count">{{ filteredNations.length }}</span>
          </div>
          <select v-model="recruitmentFilter" class="nl-select">
            <option value="all">{{ t('nationsList.allTypes') }}</option>
            <option value="open">{{ t('nationsList.filterOpen') }}</option>
            <option value="request">{{ t('nationsList.filterRequest') }}</option>
            <option value="invite_only">{{ t('nationsList.filterClosed') }}</option>
          </select>
          <select v-model="sortMode" class="nl-select">
            <option value="recommended">{{ t('nationsList.sortRelevance') }}</option>
            <option value="members">{{ t('nationsList.sortMembers') }}</option>
            <option value="newest">{{ t('nationsList.sortNewest') }}</option>
          </select>
          <RouterLink to="/nations/rankings" class="nl-btn-link">{{ t('nationsList.rankingLink') }}</RouterLink>
          <RouterLink v-if="auth.isAuthenticated.value" to="/nation/studio" class="nl-btn-accent">
            {{ myNation ? t('nationsList.myNation') : t('nationsList.create') }}
          </RouterLink>
          <RouterLink v-else to="/login" class="nl-btn-accent">{{ t('nationsList.loginBtn') }}</RouterLink>
        </div>
      </header>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <!-- stats strip -->
      <div class="nl-stats">
        <div v-for="c in counters" :key="c.label" class="nl-stat">
          <span>{{ c.label }}</span>
          <strong>{{ c.value }}</strong>
        </div>
      </div>

      <!-- my nation banner -->
      <div v-if="myNation" class="nl-mine" :style="{ borderColor: myNation.accent_color || 'rgba(139,92,246,.3)' }">
        <div class="nl-mine__icon" :style="{ background: (myNation.accent_color || '#6d5df6') + '22' }">
          <img v-if="iconUrl(myNation)" :src="iconUrl(myNation)" :alt="myNation.tag" />
          <span v-else>{{ myNation.tag?.slice(0,2).toUpperCase() }}</span>
        </div>
        <div class="nl-mine__info">
          <strong>{{ myNation.title }}</strong>
          <small>[{{ myNation.tag }}] · {{ myNation.short_description || t('nationsList.noDescFilled') }}</small>
        </div>
        <div class="nl-mine__actions">
          <RouterLink v-if="myNation.viewer_can_manage" to="/nation/studio" class="btn btn-sm btn-outline" style="min-height:2.2rem">{{ t('nationsList.manage') }}</RouterLink>
          <RouterLink :to="`/nation/${myNation.slug}`" class="btn btn-sm btn-outline" style="min-height:2.2rem">{{ t('nationsList.page') }}</RouterLink>
        </div>
      </div>

      <!-- loading -->
      <div v-if="loading" class="nl-grid">
        <div v-for="i in 8" :key="i" class="skeleton nl-card-skeleton"></div>
      </div>

      <!-- empty -->
      <div v-else-if="!allItems.length" class="surface-card nl-empty">
        <h2>{{ t('nationsList.noNations') }}</h2>
        <p>{{ auth.isAuthenticated.value ? t('nationsList.noNationsAuth') : t('nationsList.noNationsGuest') }}</p>
      </div>

      <!-- no results -->
      <div v-else-if="!filteredNations.length" class="surface-card nl-empty">
        <h2>{{ t('nationsList.noResults') }}</h2>
        <p>{{ t('nationsList.noResultsHint') }}</p>
      </div>

      <!-- grid -->
      <div v-else class="nl-grid">
        <article
          v-for="nation in filteredNations"
          :key="nation.id || nation.slug"
          class="nl-card"
        >
          <!-- banner/accent strip -->
          <div class="nl-card__banner" :style="{ background: bannerUrl(nation) ? undefined : (nation.accent_color || '#6d5df6') + '18' }">
            <img v-if="bannerUrl(nation)" :src="bannerUrl(nation)" :alt="nation.title" class="nl-card__banner-img" />
            <div v-if="bannerUrl(nation)" class="nl-card__banner-overlay"></div>
            <div class="nl-card__banner-top">
              <span class="nl-policy-badge" :class="policyClass(nation.recruitment_policy)">
                {{ policyLabel(nation.recruitment_policy) }}
              </span>
              <span v-if="nation.viewer_request_status === 'pending'" class="nl-policy-badge nl-policy-badge--amber">
                {{ t('nationsList.pendingBadge') }}
              </span>
              <span v-if="myNation?.slug === nation.slug" class="nl-policy-badge nl-policy-badge--mine">
                {{ t('nationsList.mineBadge') }}
              </span>
            </div>
            <div class="nl-card__accent-bar" :style="{ background: nation.accent_color || '#6d5df6' }"></div>
          </div>

          <div class="nl-card__body">
            <!-- identity row -->
            <div class="nl-card__identity">
              <div class="nl-card__icon" :style="{ borderColor: (nation.accent_color || '#6d5df6') + '55' }">
                <img v-if="iconUrl(nation)" :src="iconUrl(nation)" :alt="nation.tag" />
                <span v-else :style="{ color: nation.accent_color || '#8b5cf6' }">{{ nation.tag?.slice(0,2).toUpperCase() }}</span>
              </div>
              <div class="nl-card__name-block">
                <h2 class="nl-card__name">{{ nation.title }}</h2>
                <span class="nl-card__tag" :style="{ color: nation.accent_color || '#8b5cf6', borderColor: (nation.accent_color || '#8b5cf6') + '44', background: (nation.accent_color || '#8b5cf6') + '14' }">[{{ nation.tag }}]</span>
              </div>
            </div>

            <!-- description -->
            <p class="nl-card__desc">{{ nation.short_description || t('nationsList.noDesc') }}</p>

            <!-- stats row -->
            <div class="nl-card__stats">
              <span>
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                {{ formatNumber(nation.stats?.members_count ?? 0) }}
              </span>
              <span v-if="nation.stats?.pending_requests_count > 0">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                {{ nation.stats.pending_requests_count }}
              </span>
              <span v-if="nation.stats?.territory_points > 0">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
                {{ formatNumber(nation.stats.territory_points) }}
              </span>
            </div>

            <!-- cta -->
            <RouterLink :to="`/nation/${nation.slug}`" class="nl-card__view">{{ t('nationsList.openPage') }}</RouterLink>
            <RouterLink
              :to="cta(nation).to"
              class="nl-card__cta"
              :class="`nl-cta--${cta(nation).style}`"
            >{{ cta(nation).label }}</RouterLink>
          </div>
        </article>
      </div>

    </div>
  </section>
</template>

<style scoped>
/* ─── Header ─── */
.nl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.nl-eyebrow {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .15rem;
}

.nl-h1 {
  font-size: 1.5rem;
  font-weight: 900;
  color: #f8fbff;
  margin: 0;
  letter-spacing: -.03em;
}

.nl-controls {
  display: flex;
  align-items: center;
  gap: .5rem;
  flex-wrap: wrap;
}

/* ─── Search ─── */
.nl-search {
  position: relative;
  display: flex;
  align-items: center;
}

.nl-search__icon {
  position: absolute;
  left: .65rem;
  width: 1rem;
  height: 1rem;
  color: rgb(100 116 139);
  pointer-events: none;
}

.nl-search__input {
  width: 200px;
  min-height: 2.35rem;
  padding: 0 2rem 0 2.2rem;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(6,10,19,.7);
  color: #f8fbff;
  font: inherit;
  font-size: .875rem;
}

.nl-search__input:focus {
  outline: none;
  border-color: rgba(139,92,246,.34);
  box-shadow: 0 0 0 3px rgba(139,92,246,.1);
}

.nl-search__input::placeholder { color: rgb(100 116 139); }

.nl-search__count {
  position: absolute;
  right: .55rem;
  font-size: .75rem;
  font-weight: 700;
  color: rgb(139 92 246);
}

.nl-select {
  min-height: 2.35rem;
  padding: 0 .7rem;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(6,10,19,.7);
  color: #f8fbff;
  font: inherit;
  font-size: .875rem;
  cursor: pointer;
}

.nl-btn-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.35rem;
  padding: 0 .85rem;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(6,10,19,.7);
  color: rgb(148 163 184);
  font-size: .875rem;
  font-weight: 700;
  transition: border-color .15s, color .15s;
}

.nl-btn-link:hover { border-color: rgba(139,92,246,.3); color: #fff; }

.nl-btn-accent {
  display: inline-flex;
  align-items: center;
  min-height: 2.35rem;
  padding: 0 .9rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff;
  font-size: .875rem;
  font-weight: 800;
  transition: filter .15s;
}

.nl-btn-accent:hover { filter: brightness(1.06); }

/* ─── Stats strip ─── */
.nl-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: .5rem;
}

.nl-stat {
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 14px;
  background: rgba(5,10,20,.6);
  padding: .6rem .85rem;
  display: flex;
  flex-direction: column;
  gap: .2rem;
}

.nl-stat span {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
}

.nl-stat strong {
  font-size: 1.2rem;
  font-weight: 900;
  color: #f8fbff;
  letter-spacing: -.03em;
}

/* ─── My nation banner ─── */
.nl-mine {
  display: flex;
  align-items: center;
  gap: .85rem;
  border: 1px solid rgba(139,92,246,.22);
  border-left-width: 3px;
  border-radius: 14px;
  background: rgba(139,92,246,.06);
  padding: .75rem .9rem;
  flex-wrap: wrap;
}

.nl-mine__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .85rem;
  font-weight: 900;
  color: #fff;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,.1);
}

.nl-mine__icon img { width: 100%; height: 100%; object-fit: cover; }

.nl-mine__info { min-width: 0; flex: 1; }
.nl-mine__info strong { display: block; font-size: .92rem; font-weight: 800; color: #f0f4ff; }
.nl-mine__info small { display: block; font-size: .78rem; color: rgb(100 116 139); margin-top: .1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.nl-mine__actions { display: flex; gap: .4rem; flex-shrink: 0; }

/* ─── Grid ─── */
.nl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: .65rem;
}

.nl-card-skeleton { height: 280px; border-radius: 18px; }

/* ─── Empty ─── */
.nl-empty {
  padding: 2rem;
  text-align: center;
}

.nl-empty h2 {
  font-size: 1.1rem;
  font-weight: 800;
  color: rgb(203 213 225);
  margin: 0 0 .5rem;
}

.nl-empty p {
  font-size: .88rem;
  color: rgb(100 116 139);
  margin: 0;
}

/* ─── Nation Card ─── */
.nl-card {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(148,163,184,.1);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,.012), rgba(255,255,255,.004)), rgba(13,19,36,.84);
  overflow: hidden;
  transition: border-color .15s, transform .15s;
}

.nl-card:hover {
  border-color: rgba(148,163,184,.18);
  transform: translateY(-1px);
}

/* banner */
.nl-card__banner {
  position: relative;
  height: 72px;
  overflow: hidden;
  flex-shrink: 0;
}

.nl-card__banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.nl-card__banner-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.5));
}

.nl-card__banner-top {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.nl-card__accent-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  opacity: .7;
}

/* policy badges */
.nl-policy-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.4);
  backdrop-filter: blur(8px);
  padding: .18rem .55rem;
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: rgba(255,255,255,.75);
}

.nl-policy-badge.badge-open {
  border-color: rgba(52,211,153,.24);
  background: rgba(52,211,153,.14);
  color: rgb(110 231 183);
}

.nl-policy-badge.badge-req {
  border-color: rgba(139,92,246,.24);
  background: rgba(139,92,246,.14);
  color: rgb(196 181 253);
}

.nl-policy-badge.nl-policy-badge--amber {
  border-color: rgba(251,191,36,.22);
  background: rgba(251,191,36,.12);
  color: rgb(253 230 138);
}

.nl-policy-badge.nl-policy-badge--mine {
  border-color: rgba(99,102,241,.24);
  background: rgba(99,102,241,.14);
  color: rgb(165 180 252);
}

/* body */
.nl-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: .6rem;
  padding: .85rem;
}

/* identity */
.nl-card__identity {
  display: flex;
  align-items: center;
  gap: .6rem;
  min-width: 0;
}

.nl-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(10,15,30,.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .9rem;
  font-weight: 900;
  overflow: hidden;
  flex-shrink: 0;
}

.nl-card__icon img { width: 100%; height: 100%; object-fit: cover; }

.nl-card__name-block { min-width: 0; }

.nl-card__name {
  font-size: .97rem;
  font-weight: 900;
  color: #f0f4ff;
  margin: 0 0 .25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -.02em;
}

.nl-card__tag {
  display: inline-block;
  border-radius: 999px;
  border: 1px solid;
  padding: .1rem .45rem;
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
}

/* desc */
.nl-card__desc {
  font-size: .82rem;
  color: rgb(100 116 139);
  line-height: 1.55;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.5em;
}

/* stats row */
.nl-card__stats {
  display: flex;
  gap: .85rem;
  flex-wrap: wrap;
}

.nl-card__stats span {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  font-size: .78rem;
  font-weight: 600;
  color: rgb(100 116 139);
}

.nl-card__stats svg {
  width: .85rem;
  height: .85rem;
  flex-shrink: 0;
}

/* buttons */
.nl-card__view {
  display: block;
  text-align: center;
  padding: .45rem;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,.12);
  background: rgba(255,255,255,.03);
  font-size: .82rem;
  font-weight: 700;
  color: rgb(148 163 184);
  transition: background .12s, color .12s;
  margin-top: auto;
}

.nl-card__view:hover { background: rgba(255,255,255,.06); color: #fff; }

.nl-card__cta {
  display: block;
  text-align: center;
  padding: .5rem;
  border-radius: 10px;
  font-size: .82rem;
  font-weight: 800;
  transition: filter .12s, opacity .12s;
}

.nl-cta--accent {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff;
}

.nl-cta--accent:hover { filter: brightness(1.07); }

.nl-cta--outline {
  border: 1px solid rgba(148,163,184,.16);
  background: rgba(255,255,255,.04);
  color: rgb(203 213 225);
}

.nl-cta--outline:hover { border-color: rgba(148,163,184,.28); }

.nl-cta--mine {
  border: 1px solid rgba(99,102,241,.24);
  background: rgba(99,102,241,.1);
  color: rgb(165 180 252);
}

.nl-cta--muted {
  border: 1px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.03);
  color: rgb(71 85 105);
  cursor: default;
  pointer-events: none;
}

/* ─── Responsive ─── */
@media (max-width: 700px) {
  .nl-stats { grid-template-columns: repeat(2, 1fr); }
  .nl-header { flex-direction: column; align-items: flex-start; }
  .nl-controls { width: 100%; }
  .nl-search { flex: 1; }
  .nl-search__input { width: 100%; }
}
</style>
