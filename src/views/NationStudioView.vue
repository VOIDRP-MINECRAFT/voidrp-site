<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import NationActivityFeed from '../features/nations/components/NationActivityFeed.vue'
import NationTerritoryCard from '../features/nations/components/NationTerritoryCard.vue'
import { useNationTerritory } from '../features/nations/composables/useNationTerritory.js'
import {
  approveNationRequest,
  createNation,
  deleteNationBackground,
  deleteNationBanner,
  deleteNationIcon,
  disbandMyNation,
  getMyNation,
  leaveMyNation,
  rejectNationRequest,
  removeNationMember,
  transferNationLeadership,
  updateMyNation,
  updateNationMemberPrefix,
  updateNationMemberRole,
  uploadNationBackground,
  uploadNationBanner,
  uploadNationIcon,
} from '../services/nationsApi'
import { toastError, toastSuccess } from '../services/toast'
import { getMyNationActivity } from '../services/nationActivityApi'
import { getNationStatsBySlug, getNationTopDonors, getNationTreasuryTransactions } from '../services/nationStatsApi'
import { useAuthStore } from '../stores/authStore'
import { accentVars } from '../utils/accentColor.js'
import { formatNumber } from '../utils/formatters'

const { t, locale } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const MIN_CREATE_NATION_BALANCE = 300_000
// Limits mirror NationCreateRequest / NationUpdateRequest and NationMediaService on the backend.
const LIMITS = { title: 64, titleMin: 3, tag: 8, tagMin: 2, motto: 140, slugMin: 3, slugMax: 64 }
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/
const MEDIA = {
  icon: { maxBytes: 512 * 1024, minW: 256, minH: 256, upload: uploadNationIcon, remove: deleteNationIcon },
  banner: { maxBytes: 2 * 1024 * 1024, minW: 1280, minH: 320, upload: uploadNationBanner, remove: deleteNationBanner },
  background: { maxBytes: 3 * 1024 * 1024, minW: 1600, minH: 900, upload: uploadNationBackground, remove: deleteNationBackground },
}
const ACCEPT = 'image/png,image/jpeg,image/webp'
const COLOR_PRESETS = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#f5f5f4', '#64748b']
const POLICIES = ['open', 'request', 'invite_only']
const TABS = ['overview', 'look', 'members', 'treasury']

const loading = ref(true)
const saving = ref(false)
const actionLoading = ref(false)
const activityLoading = ref(true)
const nation = ref(null)
const activity = ref([])
const stats = ref(null)
const treasuryLoading = ref(true)
const donorsLoading = ref(true)
const transactions = ref([])
const donors = ref([])
const memberSearch = ref('')
const busy = reactive({ icon: false, banner: false, background: false })
const fileInputs = { icon: ref(null), banner: ref(null), background: ref(null) }
const snapshot = ref('')
const copied = ref('')

const emptyForm = () => ({ slug: '', title: '', tag: '', short_description: '', description: '', accent_color: '#8b5cf6', recruitment_policy: 'request', is_public: true })
const form = reactive(emptyForm())

// ── mode & tabs ─────────────────────────────────────────────
const isEditMode = computed(() => Boolean(nation.value))
const viewerRole = computed(() => nation.value?.viewer_role || null)
const canManage = computed(() => Boolean(nation.value?.viewer_can_manage))
const isLeader = computed(() => viewerRole.value === 'leader')
const isReadOnlyMember = computed(() => isEditMode.value && !canManage.value)
const requests = computed(() => nation.value?.join_requests || [])

const tab = computed({
  get: () => (TABS.includes(route.query.tab) ? route.query.tab : 'overview'),
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'overview' ? undefined : value } }),
})

// ── look ────────────────────────────────────────────────────
const accent = computed(() => (/^#[0-9a-f]{6}$/i.test(form.accent_color) ? form.accent_color : '#8b5cf6'))
const pageVars = computed(() => accentVars(isEditMode.value && !dirty.value ? nation.value?.accent_color || accent.value : accent.value, '--na'))
const assets = computed(() => ({
  icon: nation.value?.assets?.icon_url || nation.value?.assets?.icon_preview_url || '',
  banner: nation.value?.assets?.banner_url || nation.value?.assets?.banner_preview_url || '',
  background: nation.value?.assets?.background_url || nation.value?.assets?.background_preview_url || '',
}))
const origin = typeof window !== 'undefined' ? window.location.host : 'void-rp.ru'
const slugClean = computed(() => form.slug.trim().toLowerCase())
const publicUrl = computed(() => (nation.value?.slug ? `/nation/${nation.value.slug}` : ''))
const previewTitle = computed(() => form.title.trim() || t('nationStudio.previewTitleFallback'))
const previewTag = computed(() => form.tag.trim().toUpperCase() || 'TAG')

const errors = computed(() => {
  const e = {}
  const title = form.title.trim()
  if (title && (title.length < LIMITS.titleMin)) e.title = t('nationStudio.errTitle')
  const tag = form.tag.trim()
  if (tag && tag.length < LIMITS.tagMin) e.tag = t('nationStudio.errTag')
  if (slugClean.value && !SLUG_RE.test(slugClean.value)) e.slug = t('nationStudio.errSlug')
  return e
})
const createReady = computed(() => form.title.trim().length >= LIMITS.titleMin && form.tag.trim().length >= LIMITS.tagMin && SLUG_RE.test(slugClean.value))

function serialize() {
  return JSON.stringify(form)
}
const dirty = computed(() => isEditMode.value && Boolean(snapshot.value) && serialize() !== snapshot.value)
const canSave = computed(() => dirty.value && !saving.value && !Object.keys(errors.value).length && form.title.trim().length >= LIMITS.titleMin && form.tag.trim().length >= LIMITS.tagMin)

// ── territory ───────────────────────────────────────────────
const { territory, mainArea, mapTarget, mapUrl, miniMap, load: loadTerritory } = useNationTerritory(() => nation.value?.slug, nation)
// A capital marked far away from the claimed land usually means it was set before the nation moved.
const capitalFar = computed(() => {
  const n = nation.value
  const a = mainArea.value
  if (!a || n?.capital_x == null || n?.capital_z == null) return false
  return Math.hypot(n.capital_x - a.center.x, n.capital_z - a.center.z) > 1000
})

// ── numbers ─────────────────────────────────────────────────
const numLocale = computed(() => (String(locale.value).startsWith('en') ? 'en-US' : 'ru-RU'))
const money = (v) => new Intl.NumberFormat(numLocale.value, { maximumFractionDigits: 0 }).format(Number(v ?? 0) || 0)
const TX_TYPES = ['tax', 'season_reward', 'capital_reward', 'interest', 'research', 'market_fee', 'nation_market_sale', 'player_donation', 'deposit', 'withdraw', 'alliance_transfer_in', 'alliance_transfer_out', 'alliance_fee_income']
function txLabel(item) {
  const type = String(item?.transaction_type || '').toLowerCase()
  const base = TX_TYPES.includes(type) ? t(`nationPublic.tx.${type}`) : t('nationPublic.tx.other')
  const who = item?.metadata_json?.minecraft_nickname
  return type === 'player_donation' && who ? `${base}: ${who}` : base
}
const roleLabel = (role) => t(`nationPublic.role.${['leader', 'officer', 'member'].includes(role) ? role : 'member'}`)

const ROLE_ORDER = { leader: 0, officer: 1, member: 2 }
const members = computed(() => {
  const q = memberSearch.value.trim().toLowerCase()
  return [...(nation.value?.members || [])]
    .filter((m) => !q || String(m.site_login || '').toLowerCase().includes(q) || String(m.minecraft_nickname || '').toLowerCase().includes(q))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3))
})

// ── loading ─────────────────────────────────────────────────
function hydrate(payload) {
  nation.value = payload
  if (!payload) return
  Object.assign(form, {
    slug: payload.slug || '',
    title: payload.title || '',
    tag: payload.tag || '',
    short_description: payload.short_description || '',
    description: payload.description || '',
    accent_color: payload.accent_color || '#8b5cf6',
    recruitment_policy: payload.recruitment_policy || 'request',
    is_public: Boolean(payload.is_public),
  })
  snapshot.value = serialize()
}

// Asset uploads return the whole nation; keep unsaved text edits on top of it.
function applyNation(payload) {
  if (!payload) return
  const pending = dirty.value ? JSON.parse(serialize()) : null
  hydrate(payload)
  if (pending) {
    const base = snapshot.value
    Object.assign(form, pending)
    snapshot.value = base
  }
}

async function loadNation() {
  loading.value = true
  try {
    hydrate(await getMyNation(auth.accessToken))
  } catch (err) {
    nation.value = null
    if (!String(err?.message || '').toLowerCase().includes('not found')) toastError(err.message || t('nationStudio.loadError'))
  } finally {
    loading.value = false
  }
}
async function loadActivity() {
  activityLoading.value = true
  try { activity.value = (await getMyNationActivity(auth.accessToken))?.items || [] } catch { activity.value = [] } finally { activityLoading.value = false }
}
async function loadTreasury() {
  if (!nation.value?.slug) { transactions.value = []; treasuryLoading.value = false; return }
  treasuryLoading.value = true
  try { transactions.value = (await getNationTreasuryTransactions(nation.value.slug, auth.accessToken))?.items || [] } catch { transactions.value = [] } finally { treasuryLoading.value = false }
}
async function loadDonors() {
  if (!nation.value?.slug) { donors.value = []; donorsLoading.value = false; return }
  donorsLoading.value = true
  try { donors.value = (await getNationTopDonors(nation.value.slug, auth.accessToken))?.items || [] } catch { donors.value = [] } finally { donorsLoading.value = false }
}
async function loadStats() {
  if (!nation.value?.slug) { stats.value = null; return }
  try { stats.value = await getNationStatsBySlug(nation.value.slug, auth.accessToken) } catch { stats.value = null }
}
async function loadExtras() {
  await Promise.all([loadActivity(), loadTreasury(), loadDonors(), loadStats(), loadTerritory()])
}

// ── actions ─────────────────────────────────────────────────
async function run(fn, okKey, errKey) {
  actionLoading.value = true
  try {
    const payload = await fn()
    if (payload && payload.slug) applyNation(payload)
    if (okKey) toastSuccess(t(okKey))
    await loadActivity()
    return true
  } catch (err) {
    toastError(err.message || t(errKey))
    return false
  } finally {
    actionLoading.value = false
  }
}

async function submitCreate() {
  if (!createReady.value) return
  saving.value = true
  try {
    const payload = await createNation(auth.accessToken, {
      slug: slugClean.value,
      title: form.title.trim(),
      tag: form.tag.trim(),
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      accent_color: accent.value,
      recruitment_policy: form.recruitment_policy,
      is_public: form.is_public,
    })
    hydrate(payload)
    toastSuccess(t('nationStudio.created'))
    tab.value = 'look'
    await loadExtras()
  } catch (err) {
    toastError(err.message || t('nationStudio.createError'))
  } finally {
    saving.value = false
  }
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    const payload = await updateMyNation(auth.accessToken, {
      slug: slugClean.value,
      title: form.title.trim(),
      tag: form.tag.trim(),
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      accent_color: accent.value,
      recruitment_policy: form.recruitment_policy,
      is_public: form.is_public,
    })
    hydrate(payload)
    toastSuccess(t('nationStudio.saved'))
    await Promise.all([loadActivity(), loadTerritory()])
  } catch (err) {
    toastError(err.message || t('nationStudio.saveError'))
  } finally {
    saving.value = false
  }
}
function discard() {
  if (nation.value) hydrate(nation.value)
}

function pick(slot) {
  fileInputs[slot].value?.click()
}
function imageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}
// Picking a file uploads it right away; size and resolution are checked first with a clear message.
async function onPicked(slot, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const rules = MEDIA[slot]
  if (!ACCEPT.split(',').includes(file.type)) { toastError(t('nationStudio.badType')); return }
  if (file.size > rules.maxBytes) { toastError(t('nationStudio.tooBig', { size: rules.maxBytes >= 1024 * 1024 ? `${rules.maxBytes / 1048576} MB` : `${rules.maxBytes / 1024} KB` })); return }
  const dim = await imageSize(file)
  if (dim && (dim.w < rules.minW || dim.h < rules.minH)) { toastError(t('nationStudio.tooSmall', { w: rules.minW, h: rules.minH, aw: dim.w, ah: dim.h })); return }
  busy[slot] = true
  try {
    applyNation(await rules.upload(auth.accessToken, file))
    toastSuccess(t('nationStudio.imageUpdated'))
    loadActivity()
  } catch (err) {
    toastError(err.message || t('nationStudio.imageUploadError'))
  } finally {
    busy[slot] = false
  }
}
async function removeMedia(slot) {
  busy[slot] = true
  try {
    applyNation(await MEDIA[slot].remove(auth.accessToken))
    toastSuccess(t('nationStudio.imageDeleted'))
  } catch (err) {
    toastError(err.message || t('nationStudio.imageDeleteError'))
  } finally {
    busy[slot] = false
  }
}

const setRole = (userId, role) => run(() => updateNationMemberRole(auth.accessToken, nation.value.slug, userId, role), 'nationStudio.roleUpdated', 'nationStudio.roleUpdateError')
const approve = (id) => run(() => approveNationRequest(auth.accessToken, nation.value.slug, id), 'nationStudio.requestApproved', 'nationStudio.requestApproveError')
const reject = (id) => run(() => rejectNationRequest(auth.accessToken, nation.value.slug, id), 'nationStudio.requestRejected', 'nationStudio.requestRejectError')
function kick(member) {
  if (!window.confirm(t('nationStudio.kickConfirm', { name: member.minecraft_nickname || member.site_login }))) return
  run(() => removeNationMember(auth.accessToken, nation.value.slug, member.user_id), 'nationStudio.kicked', 'nationStudio.kickError')
}
function passLeadership(member) {
  if (!window.confirm(t('nationStudio.transferLeadershipConfirm', { name: member.minecraft_nickname || member.site_login }))) return
  run(() => transferNationLeadership(auth.accessToken, nation.value.slug, member.user_id), 'nationStudio.leadershipTransferred', 'nationStudio.leadershipTransferError')
}

const editingPrefix = ref(null)
const prefixValue = ref('')
function startPrefix(member) {
  editingPrefix.value = member.user_id
  prefixValue.value = member.custom_prefix || ''
}
function canSetPrefix(member) {
  if (!canManage.value) return false
  if (isLeader.value) return true
  return member.role === 'member'
}
async function savePrefix(member) {
  const ok = await run(() => updateNationMemberPrefix(auth.accessToken, nation.value.slug, member.user_id, prefixValue.value.trim() || null), 'nationStudio.prefixUpdated', 'nationStudio.prefixUpdateError')
  if (ok) editingPrefix.value = null
}
// Minecraft colour codes (&a, &l …) are shown stripped in the list.
const plainPrefix = (p) => String(p || '').replace(/[&§][0-9a-fk-or]/gi, '')

async function leave() {
  if (!window.confirm(t('nationStudio.leaveConfirm'))) return
  actionLoading.value = true
  try {
    await leaveMyNation(auth.accessToken)
    hydrate(null)
    Object.assign(form, emptyForm())
    snapshot.value = ''
    toastSuccess(t('nationStudio.left'))
  } catch (err) {
    toastError(err.message || t('nationStudio.leaveError'))
  } finally {
    actionLoading.value = false
  }
}
async function disband() {
  const name = nation.value?.title || ''
  const typed = window.prompt(t('nationStudio.disbandPrompt', { name }))
  if (typed === null) return
  if (typed.trim() !== name) { toastError(t('nationStudio.disbandMismatch')); return }
  actionLoading.value = true
  try {
    await disbandMyNation(auth.accessToken)
    hydrate(null)
    Object.assign(form, emptyForm())
    snapshot.value = ''
    tab.value = 'overview'
    toastSuccess(t('nationStudio.disbanded'))
  } catch (err) {
    toastError(err.message || t('nationStudio.disbandError'))
  } finally {
    actionLoading.value = false
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = text
    setTimeout(() => { if (copied.value === text) copied.value = '' }, 1600)
  } catch { /* clipboard unavailable */ }
}

function beforeUnload(e) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}
onBeforeRouteLeave(() => (dirty.value ? window.confirm(t('nationStudio.leavePageConfirm')) : true))
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  await loadNation()
  if (nation.value) await loadExtras()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
watch(() => nation.value?.slug, (s, old) => { if (s && old && s !== old) loadTerritory() })
</script>

<template>
  <section class="st-page">
    <div class="container-shell st" :style="pageVars">
      <div v-if="loading" class="st-skel">
        <div class="skeleton st-skel__head"></div>
        <div class="skeleton st-skel__body"></div>
      </div>

      <!-- ── create ─────────────────────────────────────── -->
      <template v-else-if="!isEditMode">
        <header class="st-intro">
          <h1 class="st-title">{{ t('nationStudio.createTitle') }}</h1>
          <p class="st-sub">{{ t('nationStudio.createSub') }}</p>
        </header>

        <div class="st-grid">
          <div class="st-main">
            <p class="st-warn">{{ t('nationStudio.balanceWarning', { amount: formatNumber(MIN_CREATE_NATION_BALANCE) }) }}</p>
            <section class="st-card">
              <h2 class="st-h">{{ t('nationStudio.identityTitle') }}</h2>
              <div class="st-fields">
                <div class="st-two">
                  <label class="st-field">
                    <span class="st-field__top"><span class="st-label">{{ t('nationStudio.titleLabel') }}</span><span class="st-count">{{ form.title.length }}/{{ LIMITS.title }}</span></span>
                    <input v-model="form.title" :maxlength="LIMITS.title" class="st-input" :class="{ err: errors.title }" :placeholder="t('nationStudio.titlePlaceholder')" />
                    <span v-if="errors.title" class="st-err">{{ errors.title }}</span>
                  </label>
                  <label class="st-field">
                    <span class="st-field__top"><span class="st-label">{{ t('nationStudio.tagLabel') }}</span><span class="st-count">{{ form.tag.length }}/{{ LIMITS.tag }}</span></span>
                    <input v-model="form.tag" :maxlength="LIMITS.tag" class="st-input st-input--tag" :class="{ err: errors.tag }" placeholder="FLC" />
                    <span v-if="errors.tag" class="st-err">{{ errors.tag }}</span>
                    <span v-else class="st-hint">{{ t('nationStudio.tagHint') }}</span>
                  </label>
                </div>
                <label class="st-field">
                  <span class="st-label">{{ t('nationStudio.slugLabel') }}</span>
                  <span class="st-prefixed" :class="{ err: errors.slug }">
                    <span class="st-prefix">{{ origin }}/nation/</span>
                    <input v-model="form.slug" :maxlength="LIMITS.slugMax" class="st-input st-input--bare" autocapitalize="off" spellcheck="false" />
                  </span>
                  <span v-if="errors.slug" class="st-err">{{ errors.slug }}</span>
                  <span v-else class="st-hint">{{ t('nationStudio.slugHint') }}</span>
                </label>
                <label class="st-field">
                  <span class="st-field__top"><span class="st-label">{{ t('nationStudio.mottoLabel') }}</span><span class="st-count">{{ form.short_description.length }}/{{ LIMITS.motto }}</span></span>
                  <input v-model="form.short_description" :maxlength="LIMITS.motto" class="st-input" :placeholder="t('nationStudio.mottoPlaceholder')" />
                </label>
              </div>
            </section>

            <section class="st-card">
              <h2 class="st-h">{{ t('nationStudio.recruitTitle') }}</h2>
              <div class="st-policies" role="radiogroup">
                <label v-for="p in POLICIES" :key="p" class="st-policy" :class="{ on: form.recruitment_policy === p }">
                  <input v-model="form.recruitment_policy" type="radio" :value="p" />
                  <b>{{ t(`nationPublic.recruitment.${p}`) }}</b>
                  <span>{{ t(`nationStudio.policyDesc.${p}`) }}</span>
                </label>
              </div>
              <h2 class="st-h st-h--gap">{{ t('nationStudio.accentTitle') }}</h2>
              <div class="st-swatches">
                <button v-for="c in COLOR_PRESETS" :key="c" type="button" class="st-swatch" :class="{ on: accent.toLowerCase() === c }" :style="{ '--sw': c }" :aria-label="c" @click="form.accent_color = c"></button>
                <label class="st-swatch st-swatch--custom" :class="{ on: !COLOR_PRESETS.includes(accent.toLowerCase()) }" :style="{ '--sw': accent }"><input v-model="form.accent_color" type="color" :aria-label="t('nationStudio.customColor')" /></label>
              </div>
            </section>

            <button type="button" class="st-btn st-btn--primary st-btn--wide" :disabled="saving || !createReady" @click="submitCreate">
              <span v-if="saving" class="spinner"></span>
              {{ t('nationStudio.submitCreate') }}
            </button>
            <p class="st-hint st-center">{{ t('nationStudio.afterCreate') }}</p>
          </div>

          <aside class="st-aside">
            <div class="st-sticky">
              <p class="st-aside__label">{{ t('nationStudio.previewLabel') }}</p>
              <div class="pv">
                <div class="pv-banner"></div>
                <div class="pv-row">
                  <div class="pv-emblem">{{ previewTag.slice(0, 2) }}</div>
                  <span class="pv-join">{{ t('nationPublic.joinBtn') }}</span>
                </div>
                <div class="pv-body">
                  <p class="pv-title">{{ previewTitle }} <span>{{ previewTag }}</span></p>
                  <p v-if="form.short_description.trim()" class="pv-motto">{{ form.short_description }}</p>
                  <span class="pv-chip">{{ t(`nationPublic.recruitment.${form.recruitment_policy}`) }}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </template>

      <!-- ── existing nation ─────────────────────────────── -->
      <template v-else>
        <header class="st-head">
          <div class="st-head__emblem">
            <img v-if="assets.icon" :src="assets.icon" alt="" />
            <span v-else>{{ (nation.tag || nation.title).slice(0, 2).toUpperCase() }}</span>
          </div>
          <div class="st-head__text">
            <p class="st-kicker">{{ canManage ? t('nationStudio.manageKicker') : t('nationStudio.memberKicker') }}</p>
            <h1 class="st-title">{{ nation.title }} <span class="st-title__tag">{{ nation.tag }}</span></h1>
            <p class="st-sub">{{ t('nationStudio.yourRole', { role: roleLabel(viewerRole) }) }}</p>
          </div>
          <div class="st-head__actions">
            <RouterLink :to="publicUrl" class="st-btn">
              <svg class="st-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              {{ t('nationStudio.openPage') }}
            </RouterLink>
          </div>
        </header>

        <nav v-if="canManage" class="st-tabs" role="tablist">
          <button v-for="key in TABS" :key="key" type="button" role="tab" class="st-tab" :class="{ on: tab === key }" :aria-selected="tab === key" @click="tab = key">
            {{ t(`nationStudio.tabs.${key}`) }}
            <span v-if="key === 'members' && requests.length" class="st-tab__badge">{{ requests.length }}</span>
          </button>
        </nav>

        <!-- overview (also the whole page for plain members) -->
        <div v-if="!canManage || tab === 'overview'" class="st-grid">
          <div class="st-main">
            <section v-if="canManage && requests.length" class="st-card st-card--attn">
              <div class="st-card__top">
                <h2 class="st-h">{{ t('nationStudio.requestsTitle') }}</h2>
                <button type="button" class="st-link" @click="tab = 'members'">{{ t('nationStudio.allRequests') }}</button>
              </div>
              <ul class="st-requests">
                <li v-for="r in requests.slice(0, 3)" :key="r.id">
                  <span class="st-requests__text"><b>{{ r.minecraft_nickname || r.site_login }}</b><span>{{ r.message || t('nationStudio.noMessage') }}</span></span>
                  <span class="st-row">
                    <button type="button" class="st-btn st-btn--sm st-btn--primary" :disabled="actionLoading" @click="approve(r.id)">{{ t('nationStudio.approve') }}</button>
                    <button type="button" class="st-btn st-btn--sm" :disabled="actionLoading" @click="reject(r.id)">{{ t('nationStudio.reject') }}</button>
                  </span>
                </li>
              </ul>
            </section>

            <NationTerritoryCard :slug="nation.slug" :territory="territory" :main-area="mainArea" :mini-map="miniMap" :map-url="mapUrl" :map-target="mapTarget">
              <div class="st-capital">
                <p v-if="capitalFar && canManage" class="st-hint st-hint--warn">
                  {{ t('nationStudio.capitalFar', { x: nation.capital_x, z: nation.capital_z }) }}
                  <button v-if="isLeader" type="button" class="st-cmd" @click="copy('/nsetcapital')">/nsetcapital<span v-if="copied === '/nsetcapital'" class="st-cmd__ok">{{ t('nationStudio.copied') }}</span></button>
                </p>
                <p v-else-if="nation.capital_x != null" class="st-hint">{{ t('nationStudio.capitalSet', { x: nation.capital_x, z: nation.capital_z }) }}</p>
                <p v-else-if="isLeader" class="st-hint">
                  {{ t('nationStudio.capitalHint') }}
                  <button type="button" class="st-cmd" @click="copy('/nsetcapital')">/nsetcapital<span v-if="copied === '/nsetcapital'" class="st-cmd__ok">{{ t('nationStudio.copied') }}</span></button>
                </p>
              </div>
            </NationTerritoryCard>

            <NationActivityFeed class="st-feed" :items="activity" :loading="activityLoading" :title="t('nationStudio.activityTitle')" />
          </div>

          <aside class="st-side">
            <section class="st-card">
              <h2 class="st-h">{{ t('nationStudio.summaryTitle') }}</h2>
              <dl class="st-facts">
                <div><dt>{{ t('nationPublic.statTreasury') }}</dt><dd>{{ stats ? money(stats.treasury_balance) : '—' }}</dd></div>
                <div><dt>{{ t('nationPublic.statMembers') }}</dt><dd>{{ nation.members.length }}</dd></div>
                <div><dt>{{ t('nationPublic.statTerritory') }}</dt><dd>{{ territory ? t('nationPublic.chunks', { n: formatNumber(territory.chunks) }) : '—' }}</dd></div>
                <div><dt>{{ t('nationPublic.statPrestige') }}</dt><dd>{{ stats ? formatNumber(stats.prestige_score) : '—' }}</dd></div>
                <div><dt>{{ t('nationStudio.recruitShort') }}</dt><dd>{{ t(`nationPublic.recruitment.${nation.recruitment_policy}`) }}</dd></div>
              </dl>
            </section>

            <section class="st-card">
              <h2 class="st-h">{{ t('nationPublic.allianceTitle') }}</h2>
              <template v-if="nation.alliance_summary">
                <p class="st-strong">{{ nation.alliance_summary.title }} <span class="st-dim">{{ nation.alliance_summary.tag }}</span></p>
                <p class="st-hint">{{ t('nationStudio.allianceStats', { n: nation.alliance_summary.members_count, fee: nation.alliance_summary.transfer_fee_percent }) }}</p>
              </template>
              <p v-else class="st-hint">{{ t('nationStudio.noAlliance') }}</p>
              <div class="st-row st-row--top"><RouterLink to="/alliances" class="st-btn st-btn--sm">{{ t('nationStudio.openAllianceCenter') }}</RouterLink></div>
            </section>

            <section v-if="!canManage" class="st-card">
              <h2 class="st-h">{{ t('nationPublic.membersTitle') }}</h2>
              <ul class="st-mini-members">
                <li v-for="m in members" :key="m.user_id"><b>{{ m.minecraft_nickname || m.site_login }}</b><span>{{ roleLabel(m.role) }}</span></li>
              </ul>
            </section>

            <section v-if="!isLeader" class="st-card st-card--danger">
              <h2 class="st-h">{{ t('nationStudio.leaveTitle') }}</h2>
              <p class="st-hint">{{ t('nationStudio.leaveDesc') }}</p>
              <div class="st-row st-row--top"><button type="button" class="st-btn st-btn--sm st-btn--danger" :disabled="actionLoading" @click="leave">{{ t('nationStudio.leaveBtn') }}</button></div>
            </section>
          </aside>
        </div>

        <!-- look -->
        <div v-else-if="tab === 'look'" class="st-grid">
          <div class="st-main">
            <section class="st-card">
              <h2 class="st-h">{{ t('nationStudio.imagesTitle') }}</h2>
              <p class="st-hint">{{ t('nationStudio.imagesHint') }}</p>
              <div class="st-cover" :class="{ empty: !assets.banner }" :style="assets.banner ? { backgroundImage: `url(${assets.banner})` } : null">
                <button type="button" class="st-cover__hit" :disabled="busy.banner" :aria-label="t('nationStudio.changeBanner')" @click="pick('banner')"></button>
                <div class="st-cover__actions">
                  <button type="button" class="st-chipbtn" :disabled="busy.banner" @click="pick('banner')">
                    <span v-if="busy.banner" class="spinner"></span>
                    {{ assets.banner ? t('nationStudio.changeBanner') : t('nationStudio.addBanner') }}
                  </button>
                  <button v-if="assets.banner" type="button" class="st-chipbtn" :disabled="busy.banner" @click="removeMedia('banner')">{{ t('nationStudio.remove') }}</button>
                </div>
                <p v-if="!assets.banner" class="st-cover__empty">{{ t('nationStudio.bannerRec') }}</p>
              </div>
              <div class="st-under">
                <button type="button" class="st-emblem" :disabled="busy.icon" :aria-label="t('nationStudio.changeIcon')" @click="pick('icon')">
                  <img v-if="assets.icon" :src="assets.icon" alt="" />
                  <span v-else class="st-emblem__plus">+</span>
                  <span class="st-emblem__over"><span v-if="busy.icon" class="spinner"></span><template v-else>{{ t('nationStudio.change') }}</template></span>
                </button>
                <div class="st-under__text">
                  <p class="st-label">{{ t('nationStudio.iconTitle') }}</p>
                  <p class="st-hint">{{ t('nationStudio.iconRec') }}</p>
                  <div class="st-row st-row--top">
                    <button type="button" class="st-btn st-btn--sm" :disabled="busy.icon" @click="pick('icon')">{{ assets.icon ? t('nationStudio.change') : t('nationStudio.upload') }}</button>
                    <button v-if="assets.icon" type="button" class="st-btn st-btn--sm st-btn--danger" :disabled="busy.icon" @click="removeMedia('icon')">{{ t('nationStudio.remove') }}</button>
                  </div>
                </div>
                <p v-if="assets.banner" class="st-hint st-under__rec">{{ t('nationStudio.bannerRec') }}</p>
              </div>
              <div class="st-bg">
                <div class="st-bg__thumb" :style="assets.background ? { backgroundImage: `url(${assets.background})` } : null"><span v-if="!assets.background">—</span></div>
                <div class="st-bg__text">
                  <p class="st-label">{{ t('nationStudio.backgroundTitle') }} <span class="st-optional">{{ t('nationStudio.optional') }}</span></p>
                  <p class="st-hint">{{ t('nationStudio.backgroundRec') }}</p>
                </div>
                <div class="st-row">
                  <button type="button" class="st-btn st-btn--sm" :disabled="busy.background" @click="pick('background')"><span v-if="busy.background" class="spinner"></span>{{ assets.background ? t('nationStudio.change') : t('nationStudio.upload') }}</button>
                  <button v-if="assets.background" type="button" class="st-btn st-btn--sm st-btn--danger" :disabled="busy.background" @click="removeMedia('background')">{{ t('nationStudio.remove') }}</button>
                </div>
              </div>
              <input :ref="fileInputs.icon" type="file" :accept="ACCEPT" hidden @change="onPicked('icon', $event)" />
              <input :ref="fileInputs.banner" type="file" :accept="ACCEPT" hidden @change="onPicked('banner', $event)" />
              <input :ref="fileInputs.background" type="file" :accept="ACCEPT" hidden @change="onPicked('background', $event)" />
            </section>

            <section class="st-card">
              <h2 class="st-h">{{ t('nationStudio.identityTitle') }}</h2>
              <div class="st-fields">
                <div class="st-two">
                  <label class="st-field">
                    <span class="st-field__top"><span class="st-label">{{ t('nationStudio.titleLabel') }}</span><span class="st-count">{{ form.title.length }}/{{ LIMITS.title }}</span></span>
                    <input v-model="form.title" :maxlength="LIMITS.title" class="st-input" :class="{ err: errors.title }" />
                    <span v-if="errors.title" class="st-err">{{ errors.title }}</span>
                  </label>
                  <label class="st-field">
                    <span class="st-field__top"><span class="st-label">{{ t('nationStudio.tagLabel') }}</span><span class="st-count">{{ form.tag.length }}/{{ LIMITS.tag }}</span></span>
                    <input v-model="form.tag" :maxlength="LIMITS.tag" class="st-input st-input--tag" :class="{ err: errors.tag }" />
                    <span v-if="errors.tag" class="st-err">{{ errors.tag }}</span>
                  </label>
                </div>
                <label class="st-field">
                  <span class="st-label">{{ t('nationStudio.slugLabel') }}</span>
                  <span class="st-prefixed" :class="{ err: errors.slug }">
                    <span class="st-prefix">{{ origin }}/nation/</span>
                    <input v-model="form.slug" :maxlength="LIMITS.slugMax" class="st-input st-input--bare" autocapitalize="off" spellcheck="false" />
                  </span>
                  <span v-if="errors.slug" class="st-err">{{ errors.slug }}</span>
                  <span v-else-if="slugClean !== nation.slug" class="st-warn-text">{{ t('nationStudio.slugChangeWarn') }}</span>
                </label>
                <label class="st-field">
                  <span class="st-field__top"><span class="st-label">{{ t('nationStudio.mottoLabel') }}</span><span class="st-count">{{ form.short_description.length }}/{{ LIMITS.motto }}</span></span>
                  <input v-model="form.short_description" :maxlength="LIMITS.motto" class="st-input" :placeholder="t('nationStudio.mottoPlaceholder')" />
                </label>
                <label class="st-field">
                  <span class="st-label">{{ t('nationStudio.descLabel') }}</span>
                  <textarea v-model="form.description" rows="6" class="st-input st-textarea" :placeholder="t('nationStudio.descPlaceholder')"></textarea>
                </label>
              </div>
            </section>

            <section class="st-card">
              <h2 class="st-h">{{ t('nationStudio.accentTitle') }}</h2>
              <p class="st-hint">{{ t('nationStudio.accentHint') }}</p>
              <div class="st-swatches">
                <button v-for="c in COLOR_PRESETS" :key="c" type="button" class="st-swatch" :class="{ on: accent.toLowerCase() === c }" :style="{ '--sw': c }" :aria-label="c" @click="form.accent_color = c"></button>
                <label class="st-swatch st-swatch--custom" :class="{ on: !COLOR_PRESETS.includes(accent.toLowerCase()) }" :style="{ '--sw': accent }"><input v-model="form.accent_color" type="color" :aria-label="t('nationStudio.customColor')" /></label>
                <input v-model="form.accent_color" maxlength="7" class="st-input st-hex" spellcheck="false" aria-label="HEX" />
              </div>
            </section>

            <section class="st-card">
              <h2 class="st-h">{{ t('nationStudio.recruitTitle') }}</h2>
              <div class="st-policies" role="radiogroup">
                <label v-for="p in POLICIES" :key="p" class="st-policy" :class="{ on: form.recruitment_policy === p }">
                  <input v-model="form.recruitment_policy" type="radio" :value="p" />
                  <b>{{ t(`nationPublic.recruitment.${p}`) }}</b>
                  <span>{{ t(`nationStudio.policyDesc.${p}`) }}</span>
                </label>
              </div>
              <label class="st-toggle">
                <span><b>{{ t('nationStudio.isPublicLabel') }}</b><span>{{ t('nationStudio.isPublicDesc') }}</span></span>
                <input v-model="form.is_public" type="checkbox" class="st-switch" />
              </label>
            </section>

            <section v-if="isLeader" class="st-card st-card--danger">
              <h2 class="st-h">{{ t('nationStudio.dangerZone') }}</h2>
              <p class="st-hint">{{ t('nationStudio.disbandWarning') }}</p>
              <div class="st-row st-row--top"><button type="button" class="st-btn st-btn--sm st-btn--danger" :disabled="actionLoading" @click="disband">{{ t('nationStudio.disbandBtn') }}</button></div>
            </section>
          </div>

          <aside class="st-aside">
            <div class="st-sticky">
              <p class="st-aside__label">{{ t('nationStudio.previewLabel') }}</p>
              <div class="pv" :style="assets.background ? { '--pv-bg': `url(${assets.background})` } : null">
                <div class="pv-banner" :style="assets.banner ? { backgroundImage: `url(${assets.banner})` } : null"></div>
                <div class="pv-row">
                  <div class="pv-emblem"><img v-if="assets.icon" :src="assets.icon" alt="" /><template v-else>{{ previewTag.slice(0, 2) }}</template></div>
                  <span class="pv-join">{{ t('nationPublic.joinBtn') }}</span>
                </div>
                <div class="pv-body">
                  <p class="pv-title">{{ previewTitle }} <span>{{ previewTag }}</span></p>
                  <p v-if="form.short_description.trim()" class="pv-motto">{{ form.short_description }}</p>
                  <span class="pv-chip">{{ t(`nationPublic.recruitment.${form.recruitment_policy}`) }}</span>
                </div>
                <p v-if="!form.is_public" class="pv-private">{{ t('nationStudio.previewHidden') }}</p>
              </div>
            </div>
          </aside>
        </div>

        <!-- members -->
        <div v-else-if="tab === 'members'" class="st-stack">
          <section v-if="requests.length" class="st-card st-card--attn">
            <h2 class="st-h">{{ t('nationStudio.requestsTitle') }} <span class="st-badge">{{ requests.length }}</span></h2>
            <ul class="st-requests">
              <li v-for="r in requests" :key="r.id">
                <span class="st-requests__text"><b>{{ r.minecraft_nickname || r.site_login }}</b><span>{{ r.message || t('nationStudio.noMessage') }}</span></span>
                <span class="st-row">
                  <button type="button" class="st-btn st-btn--sm st-btn--primary" :disabled="actionLoading" @click="approve(r.id)">{{ t('nationStudio.approve') }}</button>
                  <button type="button" class="st-btn st-btn--sm" :disabled="actionLoading" @click="reject(r.id)">{{ t('nationStudio.reject') }}</button>
                </span>
              </li>
            </ul>
          </section>

          <section class="st-card">
            <div class="st-card__top">
              <h2 class="st-h">{{ t('nationStudio.teamTitle') }} <span class="st-badge st-badge--dim">{{ nation.members.length }}</span></h2>
              <input v-if="nation.members.length > 6" v-model="memberSearch" class="st-input st-search" :placeholder="t('nationStudio.membersSearch')" />
            </div>
            <p class="st-hint">{{ t('nationStudio.rolesHint') }}</p>
            <ul class="st-members">
              <li v-for="m in members" :key="m.user_id" class="st-member" :class="`st-member--${m.role}`">
                <span class="st-member__head">
                  <img v-if="m.minecraft_nickname" :src="`/api/v1/public/player-head/${encodeURIComponent(m.minecraft_nickname)}`" alt="" loading="lazy"
                       @error="(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://mc-heads.net/avatar/${encodeURIComponent(m.minecraft_nickname)}/40` }" />
                </span>
                <span class="st-member__text">
                  <b>{{ m.minecraft_nickname || m.site_login }}<span v-if="m.user_id === auth.state.user?.id" class="st-you">{{ t('nationStudio.you') }}</span></b>
                  <span><span class="st-role" :class="`st-role--${m.role}`">{{ roleLabel(m.role) }}</span><span v-if="m.custom_prefix" class="st-prefix-view">{{ plainPrefix(m.custom_prefix) }}</span></span>
                </span>
                <span v-if="editingPrefix !== m.user_id" class="st-member__actions">
                  <button v-if="canSetPrefix(m)" type="button" class="st-btn st-btn--xs" :disabled="actionLoading" @click="startPrefix(m)">{{ t('nationStudio.prefixBtn') }}</button>
                  <template v-if="m.user_id !== auth.state.user?.id && m.role !== 'leader'">
                    <button v-if="m.role === 'member'" type="button" class="st-btn st-btn--xs" :disabled="actionLoading" @click="setRole(m.user_id, 'officer')">{{ t('nationStudio.makeOfficer') }}</button>
                    <button v-if="m.role === 'officer' && isLeader" type="button" class="st-btn st-btn--xs" :disabled="actionLoading" @click="setRole(m.user_id, 'member')">{{ t('nationStudio.makeMember') }}</button>
                    <button v-if="isLeader" type="button" class="st-btn st-btn--xs" :disabled="actionLoading" @click="passLeadership(m)">{{ t('nationStudio.transfer') }}</button>
                    <button type="button" class="st-btn st-btn--xs st-btn--danger" :disabled="actionLoading" @click="kick(m)">{{ t('nationStudio.kick') }}</button>
                  </template>
                </span>
                <span v-else class="st-member__prefix">
                  <input v-model="prefixValue" maxlength="64" class="st-input st-input--sm" :placeholder="t('nationStudio.prefixPlaceholder')" @keydown.enter="savePrefix(m)" @keydown.esc="editingPrefix = null" />
                  <button type="button" class="st-btn st-btn--xs st-btn--primary" :disabled="actionLoading" @click="savePrefix(m)">{{ t('nationStudio.save') }}</button>
                  <button type="button" class="st-btn st-btn--xs" @click="editingPrefix = null">{{ t('nationStudio.cancel') }}</button>
                </span>
              </li>
            </ul>
            <p class="st-hint st-hint--gap">{{ t('nationStudio.prefixHint') }}</p>
          </section>
        </div>

        <!-- treasury -->
        <div v-else-if="tab === 'treasury'" class="st-grid">
          <div class="st-main">
            <section class="st-card st-balance">
              <p class="st-hint">{{ t('nationPublic.statTreasury') }}</p>
              <p class="st-balance__value">{{ stats ? money(stats.treasury_balance) : '—' }}</p>
              <div class="st-cmds">
                <div class="st-cmdcard">
                  <b>{{ t('nationStudio.depositTitle') }}</b>
                  <span>{{ t('nationStudio.depositHow') }}</span>
                  <button type="button" class="st-cmd st-cmd--big" @click="copy('/ndonate ')">/ndonate {{ t('nationStudio.amountArg') }}<span v-if="copied === '/ndonate '" class="st-cmd__ok">{{ t('nationStudio.copied') }}</span></button>
                </div>
                <div class="st-cmdcard">
                  <b>{{ t('nationStudio.withdrawTitle') }}</b>
                  <span>{{ t('nationStudio.withdrawHow') }}</span>
                  <button type="button" class="st-cmd st-cmd--big" @click="copy('/nwithdraw ')">/nwithdraw {{ t('nationStudio.amountArg') }}<span v-if="copied === '/nwithdraw '" class="st-cmd__ok">{{ t('nationStudio.copied') }}</span></button>
                </div>
              </div>
              <p class="st-hint st-hint--gap">{{ t('nationStudio.treasuryIncomeHint') }}</p>
            </section>

            <section class="st-card">
              <h2 class="st-h">{{ t('nationStudio.recentOpsTitle') }}</h2>
              <div v-if="treasuryLoading" class="st-skel-lines"><div v-for="i in 4" :key="i" class="skeleton"></div></div>
              <p v-else-if="!transactions.length" class="st-hint">{{ t('nationStudio.noOps') }}</p>
              <ul v-else class="st-tx">
                <li v-for="item in transactions" :key="item.id">
                  <span class="st-tx__text"><b>{{ txLabel(item) }}</b><span>{{ item.comment || new Date(item.created_at).toLocaleString(numLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</span></span>
                  <strong :class="Number(item.net_amount) >= 0 ? 'plus' : 'minus'">{{ Number(item.net_amount) >= 0 ? '+' : '' }}{{ money(item.net_amount) }}</strong>
                </li>
              </ul>
            </section>
          </div>
          <aside class="st-side">
            <section class="st-card">
              <h2 class="st-h">{{ t('nationStudio.donorsTitle') }}</h2>
              <div v-if="donorsLoading" class="st-skel-lines"><div v-for="i in 3" :key="i" class="skeleton"></div></div>
              <p v-else-if="!donors.length" class="st-hint">{{ t('nationStudio.noDonors') }}</p>
              <ol v-else class="st-donors">
                <li v-for="(d, i) in donors" :key="d.minecraft_nickname || i">
                  <span class="st-donors__place">{{ i + 1 }}</span>
                  <span class="st-donors__text"><b>{{ d.minecraft_nickname || d.site_login }}</b><span>{{ t('nationStudio.donationsCount', { n: formatNumber(d.donations_count) }) }}</span></span>
                  <strong>{{ money(d.total_amount) }}</strong>
                </li>
              </ol>
            </section>
          </aside>
        </div>
      </template>
    </div>

    <Transition name="st-bar">
      <div v-if="dirty" class="st-savebar" role="region" :aria-label="t('nationStudio.unsaved')">
        <div class="st-savebar__inner">
          <span class="st-savebar__text">{{ Object.keys(errors).length ? t('nationStudio.fixErrors') : t('nationStudio.unsaved') }}</span>
          <button type="button" class="st-btn st-btn--sm" :disabled="saving" @click="discard">{{ t('nationStudio.cancel') }}</button>
          <button type="button" class="st-btn st-btn--sm st-btn--primary" :disabled="!canSave" @click="save">
            <span v-if="saving" class="spinner"></span>{{ saving ? t('nationStudio.saving') : t('nationStudio.save') }}
          </button>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.st-page { padding-block: 24px 120px; }
.st {
  --s-surface: rgba(19, 16, 33, 0.8);
  --s-line: rgba(255, 255, 255, 0.08);
  --s-line-2: rgba(255, 255, 255, 0.14);
  --s-text: #eeecf7;
  --s-muted: #9d99b6;
  --s-gold: #f2c14e;
  color: var(--s-text);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.st-skel { display: flex; flex-direction: column; gap: 16px; }
.st-skel__head { height: 140px; border-radius: 22px; }
.st-skel__body { height: 560px; border-radius: 20px; }
.st-skel-lines { display: flex; flex-direction: column; gap: 8px; }
.st-skel-lines .skeleton { height: 38px; border-radius: 10px; }

/* head */
.st-intro, .st-head { padding: 4px 0; }
.st-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 20px; align-items: center; padding: 20px 24px; border-radius: 22px; border: 1px solid var(--s-line); background: radial-gradient(90% 160% at 0% 0%, var(--na-accent-soft), transparent 60%), var(--s-surface); backdrop-filter: blur(18px); }
.st-head__emblem { width: 84px; height: 84px; border-radius: 20px; overflow: hidden; display: grid; place-items: center; background: #15122a; box-shadow: 0 0 0 1px var(--na-accent-line); font-size: 1.8rem; font-weight: 900; color: var(--na-accent-ui); }
.st-head__emblem img { width: 100%; height: 100%; object-fit: cover; }
.st-kicker { margin: 0; font-size: 0.88rem; font-weight: 700; color: var(--s-muted); }
.st-title { margin: 2px 0 0; font-size: clamp(1.7rem, 1.2rem + 1.2vw, 2.4rem); font-weight: 900; line-height: 1.05; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.st-title__tag { font-size: 0.95rem; font-weight: 800; color: var(--s-muted); letter-spacing: 0.04em; }
.st-sub { margin: 6px 0 0; font-size: 0.95rem; line-height: 1.5; color: var(--s-muted); max-width: 62ch; }

.st-tabs { display: flex; gap: 6px; padding: 5px; border-radius: 14px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--s-line); width: fit-content; max-width: 100%; overflow-x: auto; }
.st-tab { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: 10px; border: 0; background: transparent; font: inherit; font-size: 0.93rem; font-weight: 700; color: var(--s-muted); cursor: pointer; white-space: nowrap; }
.st-tab:hover { color: var(--s-text); background: rgba(255, 255, 255, 0.05); }
.st-tab.on { color: var(--s-text); background: rgba(255, 255, 255, 0.1); box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset; }
.st-tab__badge { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center; font-size: 0.74rem; font-weight: 800; color: #1b1405; background: var(--s-gold); }

/* layout */
.st-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
.st-main, .st-side, .st-stack { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.st-card { border-radius: 20px; border: 1px solid var(--s-line); background: var(--s-surface); padding: 22px 24px; backdrop-filter: blur(18px); min-width: 0; }
.st-card--attn { border-color: rgba(242, 193, 78, 0.3); background: radial-gradient(90% 140% at 0% 0%, rgba(242, 193, 78, 0.08), transparent 60%), var(--s-surface); }
.st-card--danger { border-color: rgba(248, 113, 113, 0.22); }
.st-card__top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.st-h { margin: 0 0 12px; font-size: 1.12rem; font-weight: 800; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
.st-card__top .st-h { margin: 0; }
.st-h--gap { margin-top: 22px; }
.st-hint { margin: 4px 0 0; font-size: 0.87rem; line-height: 1.5; color: var(--s-muted); }
.st-hint--gap { margin-top: 14px; }
.st-hint--warn { color: #fde68a; }
.st-center { text-align: center; }
.st-label { margin: 0; font-size: 0.92rem; font-weight: 700; }
.st-strong { margin: 0; font-weight: 800; }
.st-dim { color: var(--s-muted); font-weight: 700; font-size: 0.85rem; }
.st-optional { margin-left: 6px; font-size: 0.76rem; font-weight: 700; color: var(--s-muted); padding: 2px 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); }
.st-row { display: flex; flex-wrap: wrap; gap: 8px; }
.st-row--top { margin-top: 12px; }
.st-badge { font-size: 0.76rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; color: #1b1405; background: var(--s-gold); }
.st-badge--dim { color: var(--s-muted); background: rgba(255, 255, 255, 0.07); }
.st-link { font: inherit; font-size: 0.88rem; font-weight: 700; color: var(--na-accent-ui); background: none; border: 0; cursor: pointer; padding: 0; }
.st-warn { margin: 0; padding: 12px 16px; border-radius: 14px; font-size: 0.92rem; line-height: 1.5; color: #fde68a; background: rgba(242, 193, 78, 0.08); border: 1px solid rgba(242, 193, 78, 0.28); }

/* buttons */
.st-ico { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.st-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 16px; border-radius: 12px; font: inherit; font-size: 0.92rem; font-weight: 700; color: var(--s-text); text-decoration: none; white-space: nowrap; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--s-line-2); cursor: pointer; transition: background-color 0.15s, border-color 0.15s, filter 0.15s; }
.st-btn:hover { background: rgba(255, 255, 255, 0.1); }
.st-btn:disabled { opacity: 0.55; cursor: default; }
.st-btn--sm { height: 36px; padding: 0 14px; font-size: 0.86rem; border-radius: 10px; }
.st-btn--xs { height: 30px; padding: 0 10px; font-size: 0.8rem; border-radius: 8px; }
.st-btn--wide { width: 100%; height: 48px; font-size: 1rem; }
.st-btn--primary { color: var(--na-on-accent); background: var(--na-accent); border-color: transparent; box-shadow: 0 10px 28px -12px var(--na-accent-glow); }
.st-btn--primary:hover { background: var(--na-accent); filter: brightness(1.08); }
.st-btn--danger { color: #fca5a5; border-color: rgba(248, 113, 113, 0.3); background: transparent; }
.st-btn--danger:hover { background: rgba(248, 113, 113, 0.1); }
.st-btn:focus-visible, .st-tab:focus-visible, .st-swatch:focus-visible, .st-swatch:focus-within, .st-policy:focus-within, .st-emblem:focus-visible, .st-cmd:focus-visible, .st-link:focus-visible { outline: 2px solid var(--na-accent-ui); outline-offset: 2px; }

/* fields */
.st-fields { display: grid; gap: 16px; }
.st-two { display: grid; grid-template-columns: minmax(0, 1fr) 160px; gap: 14px; }
.st-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.st-field__top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.st-count { font-size: 0.78rem; color: var(--s-muted); font-variant-numeric: tabular-nums; }
.st-input { width: 100%; height: 44px; padding: 0 14px; border-radius: 12px; font: inherit; font-size: 0.95rem; color: var(--s-text); background: rgba(0, 0, 0, 0.28); border: 1px solid var(--s-line-2); outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
.st-input::placeholder { color: rgba(157, 153, 182, 0.6); }
.st-input:focus { border-color: var(--na-accent-line); box-shadow: 0 0 0 3px var(--na-accent-soft); }
.st-input.err, .st-prefixed.err { border-color: rgba(248, 113, 113, 0.6); }
.st-input--tag { text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
.st-input--sm { height: 32px; font-size: 0.86rem; border-radius: 8px; padding: 0 10px; }
.st-textarea { height: auto; padding: 12px 14px; line-height: 1.55; resize: vertical; min-height: 130px; }
.st-prefixed { display: flex; align-items: center; height: 44px; border-radius: 12px; background: rgba(0, 0, 0, 0.28); border: 1px solid var(--s-line-2); overflow: hidden; }
.st-prefixed:focus-within { border-color: var(--na-accent-line); box-shadow: 0 0 0 3px var(--na-accent-soft); }
.st-prefix { padding: 0 2px 0 14px; font-size: 0.95rem; color: var(--s-muted); white-space: nowrap; }
.st-input--bare { height: 100%; border: 0; background: transparent; padding-left: 2px; box-shadow: none !important; }
.st-err { font-size: 0.84rem; color: #fca5a5; }
.st-warn-text { font-size: 0.84rem; color: #fde68a; }
.st-search { width: 260px; height: 38px; }

/* colour & policy */
.st-swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 14px; }
.st-swatch { position: relative; width: 36px; height: 36px; border-radius: 999px; padding: 0; cursor: pointer; background: var(--sw); border: 2px solid rgba(255, 255, 255, 0.12); transition: transform 0.12s; }
.st-swatch:hover { transform: scale(1.08); }
.st-swatch.on { box-shadow: 0 0 0 3px #15122a, 0 0 0 5px var(--sw); }
.st-swatch--custom { background: conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #ec4899, #ef4444); }
.st-swatch--custom.on { background: var(--sw); }
.st-swatch--custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
.st-hex { width: 110px; height: 36px; }
.st-policies { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.st-policy { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 14px; cursor: pointer; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--s-line); transition: border-color 0.15s, background-color 0.15s; }
.st-policy:hover { border-color: var(--s-line-2); }
.st-policy.on { border-color: var(--na-accent-line); background: var(--na-accent-soft); }
.st-policy input { position: absolute; opacity: 0; pointer-events: none; }
.st-policy b { font-size: 0.93rem; }
.st-policy span { font-size: 0.82rem; line-height: 1.4; color: var(--s-muted); }
.st-toggle { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--s-line); cursor: pointer; }
.st-toggle > span { display: flex; flex-direction: column; gap: 3px; }
.st-toggle > span > span { font-size: 0.86rem; color: var(--s-muted); }
.st-switch { appearance: none; flex: none; position: relative; width: 46px; height: 26px; border-radius: 999px; cursor: pointer; background: rgba(255, 255, 255, 0.12); border: 1px solid var(--s-line-2); transition: background-color 0.15s; }
.st-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 999px; background: #cbc7dd; transition: transform 0.15s; }
.st-switch:checked { background: var(--na-accent); border-color: transparent; }
.st-switch:checked::after { transform: translateX(20px); background: var(--na-on-accent); }
.st-switch:focus-visible { outline: 2px solid var(--na-accent-ui); outline-offset: 2px; }

/* images */
.st-cover { position: relative; margin-top: 16px; aspect-ratio: 4 / 1; min-height: 130px; border-radius: 16px; overflow: hidden; background-size: cover; background-position: center; border: 1px solid var(--s-line); }
.st-cover.empty { background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.025) 0 12px, transparent 12px 24px), rgba(0, 0, 0, 0.25); border-style: dashed; border-color: var(--s-line-2); }
.st-cover__hit { position: absolute; inset: 0; width: 100%; border: 0; padding: 0; background: transparent; cursor: pointer; }
.st-cover__hit:hover { background: rgba(8, 6, 16, 0.18); }
.st-cover__actions { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; z-index: 1; }
.st-cover__empty { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 0 20px; text-align: center; font-size: 0.88rem; color: var(--s-muted); pointer-events: none; }
.st-chipbtn { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border-radius: 10px; font: inherit; font-size: 0.84rem; font-weight: 700; color: #fff; cursor: pointer; background: rgba(10, 8, 18, 0.75); border: 1px solid rgba(255, 255, 255, 0.18); backdrop-filter: blur(8px); }
.st-chipbtn:hover { background: rgba(10, 8, 18, 0.9); }
.st-under { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 18px; align-items: start; padding: 0 8px; }
.st-emblem { position: relative; width: 112px; height: 112px; margin-top: -44px; border-radius: 24px; overflow: hidden; padding: 0; cursor: pointer; display: grid; place-items: center; background: #1a1530; border: 4px solid #15122a; box-shadow: 0 0 0 1px var(--na-accent-line), 0 16px 32px rgba(0, 0, 0, 0.45); }
.st-emblem img { width: 100%; height: 100%; object-fit: cover; }
.st-emblem__plus { font-size: 2.4rem; font-weight: 300; color: var(--s-muted); }
.st-emblem__over { position: absolute; inset: 0; display: grid; place-items: center; font-size: 0.82rem; font-weight: 700; color: #fff; background: rgba(8, 6, 16, 0.6); opacity: 0; transition: opacity 0.15s; }
.st-emblem:hover .st-emblem__over, .st-emblem:focus-visible .st-emblem__over, .st-emblem:disabled .st-emblem__over { opacity: 1; }
.st-under__text { padding-top: 12px; min-width: 0; }
.st-under__rec { margin-top: 12px; text-align: right; max-width: 230px; }
.st-bg { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; gap: 16px; align-items: center; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--s-line); }
.st-bg__thumb { width: 112px; aspect-ratio: 16 / 9; border-radius: 10px; background-size: cover; background-position: center; background-color: rgba(0, 0, 0, 0.25); border: 1px solid var(--s-line-2); display: grid; place-items: center; color: var(--s-muted); }

/* preview */
.st-aside { min-width: 0; }
.st-sticky { position: sticky; top: 100px; display: flex; flex-direction: column; gap: 10px; }
.st-aside__label { margin: 0; font-size: 0.88rem; font-weight: 700; color: var(--s-muted); }
.pv { position: relative; border-radius: 20px; overflow: hidden; border: 1px solid var(--s-line); background: linear-gradient(180deg, rgba(10, 8, 18, 0.74), rgba(10, 8, 18, 0.95)), var(--pv-bg, none) center / cover, #0f0c1c; box-shadow: 0 24px 60px -30px var(--na-accent-glow); }
.pv-banner { aspect-ratio: 4 / 1; background: radial-gradient(120% 140% at 0% 0%, var(--na-accent-line), transparent 60%), linear-gradient(135deg, #1a1530, #0d0b17); background-size: cover; background-position: center; }
.pv-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; padding: 0 16px; margin-top: -30px; }
.pv-emblem { width: 72px; height: 72px; border-radius: 18px; overflow: hidden; display: grid; place-items: center; background: #15122a; border: 3px solid #15122a; box-shadow: 0 0 0 1px var(--na-accent-line); font-size: 1.4rem; font-weight: 900; color: var(--na-accent-ui); }
.pv-emblem img { width: 100%; height: 100%; object-fit: cover; }
.pv-join { font-size: 0.8rem; font-weight: 700; padding: 7px 14px; border-radius: 9px; color: var(--na-on-accent); background: var(--na-accent); }
.pv-body { padding: 10px 16px 18px; }
.pv-title { margin: 0; font-size: 1.35rem; font-weight: 900; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.pv-title span { font-size: 0.8rem; color: var(--s-muted); letter-spacing: 0.04em; }
.pv-motto { margin: 6px 0 0; font-size: 0.88rem; line-height: 1.45; font-style: italic; color: #d6d2ea; overflow-wrap: anywhere; }
.pv-chip { display: inline-flex; margin-top: 10px; height: 24px; align-items: center; padding: 0 9px; border-radius: 7px; font-size: 0.76rem; font-weight: 700; border: 1px solid var(--s-line-2); background: rgba(255, 255, 255, 0.05); }
.pv-private { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 20px; text-align: center; font-weight: 700; background: rgba(8, 6, 16, 0.78); }

/* overview */
.st-capital { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--s-line); }
.st-cmd { position: relative; display: inline-flex; align-items: center; margin-left: 4px; padding: 2px 8px; border-radius: 7px; font: inherit; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.84rem; color: #ddd6fe; background: rgba(139, 92, 246, 0.16); border: 1px solid rgba(167, 139, 250, 0.3); cursor: pointer; }
.st-cmd:hover { background: rgba(139, 92, 246, 0.26); }
.st-cmd--big { margin: 10px 0 0; height: 38px; padding: 0 12px; font-size: 0.92rem; }
.st-cmd__ok { position: absolute; left: 50%; bottom: calc(100% + 6px); transform: translateX(-50%); padding: 3px 8px; border-radius: 6px; font-family: inherit; font-size: 0.74rem; white-space: nowrap; color: #a7f3d0; background: #15122a; border: 1px solid rgba(52, 211, 153, 0.35); }
.st-feed { border-radius: 20px !important; border: 1px solid var(--s-line) !important; background: var(--s-surface) !important; padding: 22px 24px !important; box-shadow: none !important; }
.st-feed :deep(.naf__title) { font-size: 1.12rem; color: var(--s-text); margin-bottom: 12px; }
.st-feed :deep(.naf__msg) { font-size: 0.92rem; color: #d6d2ea; }
.st-feed :deep(.naf__time) { font-size: 0.8rem; color: var(--s-muted); }
.st-feed :deep(.naf__list li) { padding: 8px 0; border-bottom-color: var(--s-line); }
.st-facts { margin: 0; display: flex; flex-direction: column; }
.st-facts > div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 0; border-top: 1px solid var(--s-line); }
.st-facts > div:first-child { border-top: 0; padding-top: 0; }
.st-facts dt { font-size: 0.9rem; color: var(--s-muted); }
.st-facts dd { margin: 0; font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
.st-mini-members { list-style: none; margin: 0; padding: 0; }
.st-mini-members li { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-top: 1px solid var(--s-line); font-size: 0.92rem; }
.st-mini-members li:first-child { border-top: 0; }
.st-mini-members span { color: var(--s-muted); }

/* requests & members */
.st-requests { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.st-requests li { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; background: rgba(255, 255, 255, 0.035); border: 1px solid var(--s-line); }
.st-requests__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.st-requests__text span { font-size: 0.86rem; color: #cfcbe3; overflow-wrap: anywhere; }
.st-members { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.st-member { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; background: rgba(255, 255, 255, 0.025); border: 1px solid var(--s-line); }
.st-member--leader { border-color: rgba(242, 193, 78, 0.3); background: linear-gradient(135deg, rgba(242, 193, 78, 0.07), transparent 60%); }
.st-member__head { width: 42px; height: 42px; border-radius: 10px; overflow: hidden; background: #1a1530; }
.st-member__head img { width: 100%; height: 100%; image-rendering: pixelated; }
.st-member__text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.st-member__text > b { font-size: 0.97rem; display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-member__text > span { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.st-you { font-size: 0.72rem; font-weight: 800; color: var(--s-muted); padding: 1px 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.07); }
.st-role { font-size: 0.78rem; font-weight: 700; color: var(--s-muted); }
.st-role--leader { color: var(--s-gold); }
.st-role--officer { color: #c4b5fd; }
.st-prefix-view { font-size: 0.76rem; font-weight: 700; padding: 1px 7px; border-radius: 6px; color: #e9d5ff; background: rgba(139, 92, 246, 0.14); }
.st-member__actions, .st-member__prefix { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.st-member__prefix .st-input { width: 220px; }

/* treasury */
.st-balance__value { margin: 2px 0 0; font-size: 2.6rem; font-weight: 900; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.st-cmds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
.st-cmdcard { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 14px; border-radius: 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--s-line); }
.st-cmdcard > span { font-size: 0.85rem; line-height: 1.4; color: var(--s-muted); }
.st-tx { list-style: none; margin: 0; padding: 0; }
.st-tx li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 0; border-top: 1px solid var(--s-line); }
.st-tx li:first-child { border-top: 0; padding-top: 0; }
.st-tx__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.st-tx__text span { font-size: 0.82rem; color: var(--s-muted); overflow-wrap: anywhere; }
.st-tx strong { white-space: nowrap; font-variant-numeric: tabular-nums; }
.st-tx .plus { color: #6ee7b7; }
.st-tx .minus { color: #fca5a5; }
.st-donors { list-style: none; margin: 0; padding: 0; }
.st-donors li { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--s-line); }
.st-donors li:first-child { border-top: 0; }
.st-donors__place { width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; font-size: 0.78rem; font-weight: 800; background: rgba(255, 255, 255, 0.07); }
.st-donors li:first-child .st-donors__place { color: #1b1405; background: linear-gradient(135deg, #f7d27a, #e0a526); }
.st-donors__text { display: flex; flex-direction: column; min-width: 0; }
.st-donors__text span { font-size: 0.8rem; color: var(--s-muted); }

/* save bar */
.st-savebar { position: fixed; left: 0; right: 0; bottom: 20px; z-index: 40; display: flex; justify-content: center; padding: 0 12px; pointer-events: none; }
.st-savebar__inner { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 18px; border-radius: 16px; background: rgba(22, 18, 40, 0.94); border: 1px solid rgba(167, 139, 250, 0.35); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); backdrop-filter: blur(14px); }
.st-savebar__text { font-size: 0.92rem; font-weight: 600; margin-right: 8px; }
.st-bar-enter-active, .st-bar-leave-active { transition: opacity 0.2s, transform 0.2s; }
.st-bar-enter-from, .st-bar-leave-to { opacity: 0; transform: translateY(16px); }

@media (max-width: 1100px) {
  .st-grid { grid-template-columns: minmax(0, 1fr); }
  .st-aside { order: -1; }
  .st-sticky { position: static; }
  .pv { max-width: 460px; }
}
@media (max-width: 760px) {
  .st-policies, .st-cmds { grid-template-columns: minmax(0, 1fr); }
  .st-member { grid-template-columns: 42px minmax(0, 1fr); }
  .st-member__actions, .st-member__prefix { grid-column: 1 / -1; justify-content: flex-start; }
  .st-member__prefix .st-input { width: 100%; }
}
@media (max-width: 640px) {
  .st-page { padding-block: 12px 110px; }
  .st-head { grid-template-columns: auto minmax(0, 1fr); padding: 16px; }
  .st-head__emblem { width: 64px; height: 64px; border-radius: 16px; }
  .st-head__actions { grid-column: 1 / -1; }
  .st-head__actions .st-btn { width: 100%; }
  .st-tabs { width: 100%; }
  .st-tab { flex: 1; padding: 0 10px; font-size: 0.86rem; }
  .st-card { padding: 18px; }
  .st-two { grid-template-columns: minmax(0, 1fr); }
  .st-cover { aspect-ratio: 16 / 7; }
  .st-under { grid-template-columns: auto minmax(0, 1fr); padding: 0; gap: 14px; }
  .st-emblem { width: 88px; height: 88px; margin-top: -34px; }
  .st-under__rec { grid-column: 1 / -1; text-align: left; max-width: none; margin-top: 0; }
  .st-bg { grid-template-columns: 88px minmax(0, 1fr); }
  .st-bg__thumb { width: 88px; }
  .st-bg .st-row { grid-column: 1 / -1; }
  .st-requests li { flex-direction: column; align-items: stretch; }
  .st-search { width: 100%; }
  .st-prefix { font-size: 0.84rem; padding-left: 12px; }
  .st-savebar { bottom: 12px; }
  .st-savebar__inner { width: 100%; }
  .st-savebar__text { flex: 1; font-size: 0.85rem; }
}
@media (prefers-reduced-motion: reduce) {
  .st-bar-enter-active, .st-bar-leave-active, .st-btn, .st-swatch, .st-switch, .st-switch::after, .st-policy { transition: none; }
}
</style>
