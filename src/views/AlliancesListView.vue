<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePageMeta } from '../composables/usePageMeta.js'
import { createAlliance, getAlliances } from '../services/alliancesApi'
import { getMyNation } from '../services/nationsApi'
import { toastError, toastSuccess } from '../services/toast'
import { useAuthStore } from '../stores/authStore'

usePageMeta({
  title: 'Альянсы',
  description: 'Межгосударственные альянсы сервера VoidRP — военные блоки, экономические союзы и политические федерации между государствами.',
  url: 'https://void-rp.ru/alliances',
  breadcrumbs: [
    { name: 'Главная', url: '/' },
    { name: 'Альянсы' },
  ],
})

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()

const loading = ref(true)
const error = ref('')
const search = ref('')
const sortMode = ref('recommended')
const alliances = ref([])
const myNation = ref(null)
const showCreateForm = ref(false)
const createLoading = ref(false)
const createForm = reactive({ slug: '', title: '', tag: '', alliance_type: 'un', description: '' })

const isAuthenticated = computed(() => auth.isAuthenticated.value)
const hasNation = computed(() => Boolean(myNation.value?.slug))
const canManageNation = computed(() => Boolean(myNation.value?.viewer_can_manage))
const myAllianceSlug = computed(() => myNation.value?.alliance_summary?.slug || '')

const allItems = computed(() => Array.isArray(alliances.value) ? alliances.value : [])

const filteredAlliances = computed(() => {
  const q = search.value.trim().toLowerCase()
  let items = [...allItems.value]
  if (q) {
    items = items.filter(item =>
      [item.title, item.tag, item.slug, item.description]
        .map(v => String(v || '').toLowerCase()).join(' ').includes(q)
    )
  }
  items.sort((a, b) => {
    if (sortMode.value === 'members') return (b.members_count ?? 0) - (a.members_count ?? 0)
    if (sortMode.value === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    const w = i => (i.members_count ?? 0) * 2 + (myAllianceSlug.value === i.slug ? 1000 : 0)
    return w(b) - w(a)
  })
  return items
})

const counters = computed(() => [
  { key: 'countersTotal', value: allItems.value.length },
  { key: 'countersMilitary', value: allItems.value.filter(i => i.alliance_type === 'nato').length },
  { key: 'countersEconomic', value: allItems.value.filter(i => i.alliance_type === 'economic').length },
  { key: 'countersPolitical', value: allItems.value.filter(i => i.alliance_type === 'un').length },
])

const showCreateEligible = computed(() =>
  isAuthenticated.value && hasNation.value && !myAllianceSlug.value && canManageNation.value
)

function typeColor(type) {
  if (type === 'nato') return '#ef4444'
  if (type === 'economic') return '#10b981'
  return '#6366f1'
}

function typeShortLabel(type) {
  if (type === 'nato') return 'Военный'
  if (type === 'economic') return 'Экономика'
  return 'Политика'
}

function money(value) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
}

async function loadPage() {
  loading.value = true
  error.value = ''
  try {
    const [listPayload, myPayload] = await Promise.all([
      getAlliances(auth.accessToken || null),
      auth.isAuthenticated.value ? getMyNation(auth.accessToken) : Promise.resolve(null),
    ])
    alliances.value = listPayload?.items || []
    myNation.value = myPayload || null
  } catch (err) {
    error.value = err.message || t('allianceHub.loadError')
  } finally {
    loading.value = false
  }
}

async function createAllianceAction() {
  createLoading.value = true
  try {
    const created = await createAlliance(auth.accessToken, { ...createForm })
    toastSuccess(t('allianceHub.allianceCreated'))
    showCreateForm.value = false
    router.push(`/alliances/${created?.slug || createForm.slug}`)
  } catch (err) {
    toastError(err?.message || t('allianceHub.allianceCreateError'))
  } finally {
    createLoading.value = false
  }
}

onMounted(loadPage)
</script>

<template>
  <section class="al py-3 md:py-4 auth-page">
    <div class="container-shell max-w-[1380px] space-y-3 page-entry">

      <!-- header -->
      <header class="al-header">
        <div>
          <p class="al-eyebrow">{{ t('allianceHub.eyebrow') }}</p>
          <h1 class="al-h1">{{ t('allianceHub.title') }}</h1>
        </div>
        <div class="al-controls">
          <div class="al-search">
            <svg class="al-search__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
            <input v-model="search" class="al-search__input" :placeholder="t('allianceHub.searchPlaceholder')" />
            <span v-if="search" class="al-search__count">{{ filteredAlliances.length }}</span>
          </div>
          <select v-model="sortMode" class="al-select">
            <option value="recommended">{{ t('allianceHub.sortRelevance') }}</option>
            <option value="members">{{ t('allianceHub.sortMembers') }}</option>
            <option value="newest">{{ t('allianceHub.sortNewest') }}</option>
          </select>
          <RouterLink to="/nations" class="al-btn-link">{{ t('allianceHub.nationsBtn') }}</RouterLink>
          <button v-if="showCreateEligible" type="button" class="al-btn-accent" @click="showCreateForm = !showCreateForm">
            {{ t('allianceHub.createAllianceTitle') }}
          </button>
          <RouterLink v-else-if="!isAuthenticated" to="/login" class="al-btn-accent">Войти</RouterLink>
        </div>
      </header>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <!-- create form -->
      <div v-if="showCreateForm && showCreateEligible" class="al-create-box">
        <h2 class="al-create-box__title">{{ t('allianceHub.createAllianceTitle') }}</h2>
        <div class="al-create-body">
          <input v-model="createForm.title" class="input" :placeholder="t('allianceHub.namePlaceholder')" />
          <div class="al-create-row">
            <input v-model="createForm.tag" class="input" :placeholder="t('allianceHub.tagPlaceholder')" />
            <input v-model="createForm.slug" class="input" :placeholder="t('allianceHub.slugPlaceholder')" />
          </div>
          <select v-model="createForm.alliance_type" class="select">
            <option value="un">{{ t('allianceHub.typePolitical') }}</option>
            <option value="nato">{{ t('allianceHub.typeMilitary') }}</option>
            <option value="economic">{{ t('allianceHub.typeEconomicOpt') }}</option>
          </select>
          <textarea v-model="createForm.description" class="textarea" rows="2" :placeholder="t('allianceHub.descPlaceholder')"></textarea>
          <div class="al-create-actions">
            <button type="button" class="btn btn-ghost btn-sm" @click="showCreateForm = false">Отмена</button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="createLoading" @click="createAllianceAction">
              {{ t('allianceHub.createBtn') }}
            </button>
          </div>
        </div>
      </div>

      <!-- stats -->
      <div class="al-stats">
        <div v-for="c in counters" :key="c.key" class="al-stat">
          <span>{{ t(`allianceHub.${c.key}`) }}</span>
          <strong>{{ c.value }}</strong>
        </div>
      </div>

      <!-- my alliance banner -->
      <div v-if="myAllianceSlug && myNation?.alliance_summary" class="al-mine">
        <div class="al-mine__strip" :style="{ background: typeColor(myNation.alliance_summary.alliance_type || 'un') }"></div>
        <div class="al-mine__icon" :style="{ color: typeColor(myNation.alliance_summary.alliance_type || 'un'), background: typeColor(myNation.alliance_summary.alliance_type || 'un') + '18', borderColor: typeColor(myNation.alliance_summary.alliance_type || 'un') + '40' }">
          {{ myNation.alliance_summary.tag?.slice(0, 3).toUpperCase() }}
        </div>
        <div class="al-mine__info">
          <strong>{{ myNation.alliance_summary.title }}</strong>
          <small>[{{ myNation.alliance_summary.tag }}] · {{ t('allianceHub.myAllianceLabel') }}</small>
        </div>
        <RouterLink :to="`/alliances/${myAllianceSlug}`" class="btn btn-sm btn-outline" style="flex-shrink:0;min-height:2.1rem">
          {{ t('allianceHub.openDetail') }}
        </RouterLink>
      </div>

      <!-- loading -->
      <div v-if="loading" class="al-grid">
        <div v-for="i in 6" :key="i" class="skeleton al-skeleton"></div>
      </div>

      <!-- empty -->
      <div v-else-if="!allItems.length" class="surface-card al-empty">
        <h2>{{ t('allianceHub.noAlliances') }}</h2>
      </div>

      <!-- no results -->
      <div v-else-if="!filteredAlliances.length" class="surface-card al-empty">
        <h2>Ничего не найдено</h2>
        <p>Попробуйте изменить запрос</p>
      </div>

      <!-- grid -->
      <div v-else class="al-grid">
        <article
          v-for="item in filteredAlliances"
          :key="item.id || item.slug"
          class="al-card"
          :class="{ 'al-card--mine': myAllianceSlug === item.slug }"
        >
          <!-- coloured banner with watermark tag -->
          <div
            class="al-card__banner"
            :style="{
              background: `linear-gradient(135deg, ${typeColor(item.alliance_type)}cc 0%, ${typeColor(item.alliance_type)}55 100%)`
            }"
          >
            <span class="al-card__wm">{{ item.tag?.slice(0, 4).toUpperCase() }}</span>
            <div class="al-card__banner-top">
              <span class="al-badge" :style="{ color: '#fff', borderColor: 'rgba(255,255,255,.25)', background: 'rgba(0,0,0,.28)' }">
                {{ typeShortLabel(item.alliance_type) }}
              </span>
              <span v-if="myAllianceSlug === item.slug" class="al-badge" style="color:#86efac;border-color:rgba(134,239,172,.3);background:rgba(134,239,172,.15)">
                Ваш
              </span>
            </div>
            <div class="al-card__banner-bar" :style="{ background: typeColor(item.alliance_type) }"></div>
          </div>

          <!-- body -->
          <div class="al-card__body">
            <div class="al-card__head-row">
              <div class="al-card__name-wrap">
                <h2 class="al-card__name">{{ item.title }}</h2>
                <span class="al-card__tag" :style="{ color: typeColor(item.alliance_type) }">[{{ item.tag }}]</span>
              </div>
            </div>

            <p class="al-card__desc">{{ item.description || t('allianceHub.noDesc') }}</p>

            <div class="al-card__meta">
              <span class="al-card__meta-item">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                {{ item.members_count ?? 0 }} уч.
              </span>
              <span v-if="item.allow_pvp_protection" class="al-card__meta-item al-card__meta-item--green">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                PvP
              </span>
              <span v-if="item.allow_joint_defense" class="al-card__meta-item al-card__meta-item--blue">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                Оборона
              </span>
            </div>

            <RouterLink :to="`/alliances/${item.slug}`" class="al-card__open">
              {{ t('allianceHub.openDetail') }}
            </RouterLink>
          </div>
        </article>
      </div>

    </div>
  </section>
</template>

<style scoped>
/* ─── Layout ─── */
.al-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.al-eyebrow {
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .15rem;
}

.al-h1 {
  font-size: 1.5rem;
  font-weight: 900;
  color: #f8fbff;
  margin: 0;
  letter-spacing: -.03em;
}

.al-controls {
  display: flex;
  align-items: center;
  gap: .45rem;
  flex-wrap: wrap;
}

/* search */
.al-search { position: relative; display: flex; align-items: center; }

.al-search__icon {
  position: absolute;
  left: .6rem;
  width: .95rem;
  height: .95rem;
  color: rgb(100 116 139);
  pointer-events: none;
}

.al-search__input {
  width: 200px;
  min-height: 2.3rem;
  padding: 0 2rem 0 2.1rem;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(6,10,19,.7);
  color: #f8fbff;
  font: inherit;
  font-size: .875rem;
}

.al-search__input:focus {
  outline: none;
  border-color: rgba(139,92,246,.34);
  box-shadow: 0 0 0 3px rgba(139,92,246,.1);
}

.al-search__input::placeholder { color: rgb(100 116 139); }

.al-search__count {
  position: absolute;
  right: .55rem;
  font-size: .72rem;
  font-weight: 700;
  color: rgb(139 92 246);
}

.al-select {
  min-height: 2.3rem;
  padding: 0 .65rem;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(6,10,19,.7);
  color: #f8fbff;
  font: inherit;
  font-size: .875rem;
  cursor: pointer;
}

.al-btn-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.3rem;
  padding: 0 .8rem;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(6,10,19,.7);
  color: rgb(148 163 184);
  font-size: .875rem;
  font-weight: 700;
  transition: border-color .15s, color .15s;
  white-space: nowrap;
}

.al-btn-link:hover { border-color: rgba(148,163,184,.28); color: #fff; }

.al-btn-accent {
  display: inline-flex;
  align-items: center;
  min-height: 2.3rem;
  padding: 0 .9rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff;
  font-size: .875rem;
  font-weight: 800;
  transition: filter .15s;
  cursor: pointer;
  border: none;
  white-space: nowrap;
}

.al-btn-accent:hover { filter: brightness(1.07); }

/* ─── Create box ─── */
.al-create-box {
  border: 1px solid rgba(99,102,241,.22);
  border-left: 3px solid #6366f1;
  border-radius: 14px;
  background: rgba(99,102,241,.06);
  padding: 1rem 1.1rem;
}

.al-create-box__title {
  font-size: .88rem;
  font-weight: 800;
  color: rgb(196 181 253);
  margin: 0 0 .75rem;
}

.al-create-body { display: flex; flex-direction: column; gap: .5rem; max-width: 540px; }

.al-create-row { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }

.al-create-actions { display: flex; gap: .4rem; justify-content: flex-end; padding-top: .2rem; }

/* ─── Stats strip ─── */
.al-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: .45rem;
}

.al-stat {
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  background: rgba(5,10,20,.65);
  padding: .55rem .8rem;
  display: flex;
  flex-direction: column;
  gap: .15rem;
}

.al-stat span {
  font-size: .7rem;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: rgb(100 116 139);
}

.al-stat strong {
  font-size: 1.15rem;
  font-weight: 900;
  color: #f8fbff;
  letter-spacing: -.03em;
}

/* ─── My alliance banner ─── */
.al-mine {
  display: flex;
  align-items: center;
  gap: .8rem;
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 14px;
  background: rgba(255,255,255,.03);
  padding: .7rem .9rem;
  flex-wrap: wrap;
  position: relative;
  overflow: hidden;
}

.al-mine__strip {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
}

.al-mine__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .8rem;
  font-weight: 900;
  flex-shrink: 0;
}

.al-mine__info { min-width: 0; flex: 1; }
.al-mine__info strong { display: block; font-size: .9rem; font-weight: 800; color: #f0f4ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.al-mine__info small { display: block; font-size: .76rem; color: rgb(100 116 139); }

/* ─── Grid ─── */
.al-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
  gap: .6rem;
}

.al-skeleton { height: 260px; border-radius: 16px; }

/* ─── Empty ─── */
.al-empty { padding: 2rem; text-align: center; }
.al-empty h2 { font-size: 1.05rem; font-weight: 800; color: rgb(203 213 225); margin: 0 0 .4rem; }
.al-empty p { font-size: .85rem; color: rgb(100 116 139); margin: 0; }

/* ─── Card ─── */
.al-card {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(148,163,184,.1);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(13,19,36,.88);
  transition: border-color .15s, transform .15s, box-shadow .15s;
  cursor: default;
}

.al-card:hover {
  border-color: rgba(148,163,184,.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0,0,0,.3);
}

.al-card--mine { border-color: rgba(139,92,246,.22); }

/* banner */
.al-card__banner {
  position: relative;
  height: 76px;
  flex-shrink: 0;
  overflow: hidden;
}

.al-card__wm {
  position: absolute;
  right: .6rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 2.8rem;
  font-weight: 900;
  color: rgba(255,255,255,.18);
  letter-spacing: -.06em;
  line-height: 1;
  user-select: none;
  pointer-events: none;
}

.al-card__banner-top {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 5px;
  align-items: center;
}

.al-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid;
  padding: .15rem .5rem;
  font-size: .72rem;
  font-weight: 700;
  white-space: nowrap;
  backdrop-filter: blur(6px);
}

.al-card__banner-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  opacity: .7;
}

/* body */
.al-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: .5rem;
  padding: .8rem;
}

.al-card__head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .4rem;
  min-width: 0;
}

.al-card__name-wrap { min-width: 0; flex: 1; }

.al-card__name {
  font-size: .97rem;
  font-weight: 900;
  color: #f0f4ff;
  margin: 0 0 .15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -.025em;
}

.al-card__tag {
  font-size: .75rem;
  font-weight: 700;
}

.al-card__desc {
  font-size: .8rem;
  color: rgb(100 116 139);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.4em;
}

.al-card__meta {
  display: flex;
  gap: .7rem;
  flex-wrap: wrap;
}

.al-card__meta-item {
  display: inline-flex;
  align-items: center;
  gap: .25rem;
  font-size: .76rem;
  font-weight: 600;
  color: rgb(100 116 139);
}

.al-card__meta-item svg { width: .8rem; height: .8rem; flex-shrink: 0; }
.al-card__meta-item--green { color: rgb(52 211 153); }
.al-card__meta-item--blue { color: rgb(99 102 241); }

.al-card__open {
  display: block;
  text-align: center;
  padding: .44rem;
  border-radius: 9px;
  border: 1px solid rgba(148,163,184,.12);
  background: rgba(255,255,255,.035);
  font-size: .8rem;
  font-weight: 700;
  color: rgb(148 163 184);
  margin-top: auto;
  transition: background .12s, color .12s, border-color .12s;
}

.al-card__open:hover {
  background: rgba(255,255,255,.07);
  border-color: rgba(255,255,255,.18);
  color: #fff;
}

/* ─── Responsive ─── */
@media (max-width: 700px) {
  .al-stats { grid-template-columns: repeat(2, 1fr); }
  .al-header { flex-direction: column; align-items: flex-start; }
  .al-controls { width: 100%; }
  .al-search { flex: 1; }
  .al-search__input { width: 100%; }
}
</style>
