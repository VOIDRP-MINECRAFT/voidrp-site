<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '../config.site'
import NationActivityFeed from '../features/nations/components/NationActivityFeed.vue'
import {
  approveNationRequest,
  getMyNation,
  getNationBySlug,
  joinNation,
  rejectNationRequest,
} from '../services/nationsApi'
import { getNationActivity } from '../services/nationActivityApi'
import { getNationStatsBySlug, getNationTopDonors, getNationTreasuryTransactions } from '../services/nationStatsApi'
import { useAuthStore } from '../stores/authStore'
import { accentVars } from '../utils/accentColor.js'
import { formatCompactHoursFromMinutes, formatNumber } from '../utils/formatters'
import { usePageMeta } from '../composables/usePageMeta.js'

const { t, locale } = useI18n()
const route = useRoute()
const auth = useAuthStore()

const loading = ref(true)
const statsLoading = ref(true)
const activityLoading = ref(true)
const treasuryLoading = ref(true)
const donorsLoading = ref(true)
const currentNationLoading = ref(false)

const error = ref('')
const actionMessage = ref('')
const actionError = ref('')
const joinLoading = ref(false)
const requestMessage = ref('')

const nation = ref(null)
const currentNation = ref(null)
const stats = ref(null)
const activity = ref([])
const transactions = ref([])
const donors = ref([])
const territory = ref(null)     // summary from the FTB claims export, null = no claims
const liveMap = ref(false)

// ── look ────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const v = String(hex || '').replace('#', '')
  const n = v.length === 3 ? v.split('').map((x) => x + x).join('') : v
  if (n.length !== 6) return `rgba(139, 92, 246, ${alpha})`
  const i = Number.parseInt(n, 16)
  return `rgba(${(i >> 16) & 255}, ${(i >> 8) & 255}, ${i & 255}, ${alpha})`
}

const accent = computed(() => nation.value?.accent_color || '#8b5cf6')
const pageVars = computed(() => accentVars(accent.value, '--na'))
const iconUrl = computed(() => nation.value?.assets?.icon_url || nation.value?.assets?.icon_preview_url || '')
const bannerUrl = computed(() => nation.value?.assets?.banner_url || nation.value?.assets?.banner_preview_url || '')
const backgroundUrl = computed(() => nation.value?.assets?.background_url || nation.value?.assets?.background_preview_url || '')
const allianceSummary = computed(() => nation.value?.alliance_summary || null)
const allies = computed(() => (allianceSummary.value?.members || []).filter((m) => m.slug !== nation.value?.slug).slice(0, 6))

const bannerStyle = computed(() => (bannerUrl.value
  ? { backgroundImage: `url(${bannerUrl.value})` }
  : { backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${hexToRgba(accent.value, 0.5)} 0%, transparent 55%), radial-gradient(90% 120% at 100% 100%, ${hexToRgba(accent.value, 0.22)} 0%, transparent 60%), linear-gradient(135deg, #1a1530, #0d0b17)` }))

// Page background covers the page once (no tiling) and is darkened so any picture reads as ambience.
const routeBackground = computed(() => {
  if (!backgroundUrl.value) {
    return `radial-gradient(circle at 15% 0%, ${hexToRgba(accent.value, 0.16)} 0%, transparent 32%), linear-gradient(180deg, #07060d 0%, #0d0b17 100%)`
  }
  return `linear-gradient(180deg, rgba(8,7,14,0.84) 0%, rgba(8,7,14,0.93) 40%, rgba(8,7,14,0.98) 100%), url(${backgroundUrl.value}) center top / cover no-repeat`
})

// ── numbers ─────────────────────────────────────────────────
const numLocale = computed(() => (String(locale.value).startsWith('en') ? 'en-US' : 'ru-RU'))
function money(value) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? new Intl.NumberFormat(numLocale.value, { maximumFractionDigits: 0 }).format(n) : '0'
}
function fmtDate(iso) {
  return iso ? new Intl.DateTimeFormat(numLocale.value, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)) : ''
}

const statTiles = computed(() => [
  { key: 'treasury', label: t('nationPublic.statTreasury'), value: statsLoading.value ? null : money(stats.value?.treasury_balance ?? 0) },
  {
    key: 'territory',
    label: t('nationPublic.statTerritory'),
    value: territory.value ? t('nationPublic.chunks', { n: formatNumber(territory.value.chunks) }) : statsLoading.value ? null : formatNumber(stats.value?.territory_points ?? 0),
  },
  { key: 'playtime', label: t('nationPublic.statPlaytime'), value: statsLoading.value ? null : formatCompactHoursFromMinutes(stats.value?.total_playtime_minutes ?? 0) },
  { key: 'prestige', label: t('nationPublic.statPrestige'), value: statsLoading.value ? null : formatNumber(stats.value?.prestige_score ?? 0) },
  { key: 'members', label: t('nationPublic.statMembers'), value: formatNumber(nation.value?.members?.length ?? 0) },
])

const ROLE_ORDER = { leader: 0, officer: 1, member: 2 }
const members = computed(() => [...(nation.value?.members || [])].sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3)))
const roleLabel = (role) => t(`nationPublic.role.${['leader', 'officer', 'member'].includes(role) ? role : 'member'}`)
const recruitmentLabel = computed(() => t(`nationPublic.recruitment.${nation.value?.recruitment_policy || 'request'}`))

const TX_TYPES = ['tax', 'season_reward', 'capital_reward', 'interest', 'research', 'market_fee', 'nation_market_sale', 'player_donation', 'deposit', 'withdraw', 'alliance_transfer_in', 'alliance_transfer_out', 'alliance_fee_income']
function txLabel(item) {
  const type = String(item?.transaction_type || '').toLowerCase()
  const base = TX_TYPES.includes(type) ? t(`nationPublic.tx.${type}`) : t('nationPublic.tx.other')
  const who = item?.metadata_json?.minecraft_nickname
  return type === 'player_donation' && who ? `${base}: ${who}` : base
}

// ── territory & map ─────────────────────────────────────────
function bluemapUrl(x, z, world, distance = 300) {
  return `${siteConfig.bluemapUrl}/#${world || 'world'}:${Math.round(x)}:64:${Math.round(z)}:${Math.round(distance)}:0:0:0:0:flat`
}
const mainArea = computed(() => territory.value?.areas?.[0] || null)
// Claims win over the manually entered capital: they are where the nation really is.
const mapTarget = computed(() => {
  const a = mainArea.value
  if (a) {
    const [x0, z0, x1, z1] = a.main_bbox || a.bbox
    return { x: a.center.x, z: a.center.z, world: a.map, distance: Math.min(3000, Math.max(220, Math.max(x1 - x0, z1 - z0) * 1.6)), auto: true }
  }
  const n = nation.value
  if (n?.capital_x != null && n?.capital_z != null) return { x: n.capital_x, z: n.capital_z, world: n.capital_world, distance: 400, auto: false }
  return null
})
const mapUrl = computed(() => (mapTarget.value ? bluemapUrl(mapTarget.value.x, mapTarget.value.z, mapTarget.value.world, mapTarget.value.distance) : siteConfig.bluemapUrl))

// Mini map: outline of the main piece of land, framed with a margin and a chunk grid.
const miniMap = computed(() => {
  const a = mainArea.value
  if (!a) return null
  const [x0, z0, x1, z1] = a.main_bbox || a.bbox
  const pad = Math.max(48, Math.max(x1 - x0, z1 - z0) * 0.18)
  let vx = x0 - pad, vz = z0 - pad, vw = x1 - x0 + pad * 2, vh = z1 - z0 + pad * 2
  // Keep a 16:10 frame so the card doesn't jump in height between nations.
  const ratio = 16 / 10
  if (vw / vh < ratio) { const nw = vh * ratio; vx -= (nw - vw) / 2; vw = nw } else { const nh = vw / ratio; vz -= (nh - vh) / 2; vh = nh }
  const path = a.loops.map((loop) => `M${loop.map(([x, z]) => `${x},${z}`).join('L')}Z`).join('')
  return { viewBox: `${vx} ${vz} ${vw} ${vh}`, path, cx: a.center.x, cz: a.center.z, r: Math.max(vw, vh) * 0.012, stroke: Math.max(vw, vh) * 0.004, grid: 16 * Math.max(1, Math.round(vw / 16 / 40)) }
})

// ── viewer state ────────────────────────────────────────────
const isAuthenticated = computed(() => auth.isAuthenticated.value)
const viewerHasPendingRequest = computed(() => nation.value?.viewer_request_status === 'pending')
const viewerIsMember = computed(() => Boolean(nation.value?.viewer_is_member))
const viewerCanManage = computed(() => Boolean(nation.value?.viewer_can_manage))
const viewerOwnsOtherNation = computed(() => Boolean(currentNation.value?.slug && nation.value?.slug && currentNation.value.slug !== nation.value.slug))
const blocked = computed(() => viewerCanManage.value || viewerIsMember.value || viewerHasPendingRequest.value || viewerOwnsOtherNation.value)
const canJoinDirectly = computed(() => Boolean(nation.value && isAuthenticated.value && !blocked.value && nation.value.recruitment_policy === 'open'))
const canRequestJoin = computed(() => Boolean(nation.value && isAuthenticated.value && !blocked.value && nation.value.recruitment_policy === 'request'))
const loginLink = computed(() => ({ path: '/login', query: { redirect: `/nation/${nation.value?.slug || ''}` } }))

function applyRouteBackground(value) {
  document.documentElement.style.setProperty('--route-bg', value)
}

// ── loading ─────────────────────────────────────────────────
async function loadNation() {
  loading.value = true
  error.value = ''
  try {
    nation.value = await getNationBySlug(route.params.slug, auth.accessToken || null)
    const n = nation.value
    usePageMeta({
      title: n.title,
      description: n.short_description || t('meta.nationDynamicDesc', { title: n.title }),
      url: `https://void-rp.ru/nation/${n.slug}`,
      ...(n.assets?.icon_url ? { image: n.assets.icon_url } : {}),
      breadcrumbs: [
        { name: t('nav.home'), url: '/' },
        { name: t('nav.nations'), url: '/nations' },
        { name: n.title },
      ],
    })
  } catch (err) {
    error.value = err.message || t('nationPublic.loadError')
  } finally {
    loading.value = false
  }
}

async function loadCurrentNation() {
  if (!auth.accessToken) { currentNation.value = null; return }
  currentNationLoading.value = true
  try { currentNation.value = await getMyNation(auth.accessToken) } catch { currentNation.value = null } finally { currentNationLoading.value = false }
}
async function loadStats() {
  statsLoading.value = true
  try { stats.value = await getNationStatsBySlug(route.params.slug, auth.accessToken || null) } catch { stats.value = null } finally { statsLoading.value = false }
}
async function loadActivity() {
  activityLoading.value = true
  try {
    const payload = await getNationActivity(route.params.slug, auth.accessToken || null)
    activity.value = Array.isArray(payload?.items) ? payload.items : []
  } catch { activity.value = [] } finally { activityLoading.value = false }
}
async function loadTreasury() {
  treasuryLoading.value = true
  try { transactions.value = (await getNationTreasuryTransactions(route.params.slug, auth.accessToken || null))?.items || [] } catch { transactions.value = [] } finally { treasuryLoading.value = false }
}
async function loadDonors() {
  donorsLoading.value = true
  try { donors.value = (await getNationTopDonors(route.params.slug, auth.accessToken || null))?.items || [] } catch { donors.value = [] } finally { donorsLoading.value = false }
}
// Written every 5 minutes by scripts/update_bluemap_ftb_claims.py next to the BlueMap web app.
async function loadTerritory() {
  try {
    const res = await fetch(`${siteConfig.bluemapUrl}/ftb-claims/nations.json`, { cache: 'no-cache' })
    const data = res.ok ? await res.json() : null
    territory.value = data?.nations?.[route.params.slug] || null
  } catch {
    territory.value = null
  }
}

async function handleJoin() {
  if (!nation.value || !auth.accessToken || !(canJoinDirectly.value || canRequestJoin.value)) return
  const direct = canJoinDirectly.value
  joinLoading.value = true
  actionError.value = ''
  actionMessage.value = ''
  try {
    const response = await joinNation(auth.accessToken, nation.value.slug, { message: direct ? null : requestMessage.value || null })
    nation.value = response?.nation || nation.value
    actionMessage.value = direct ? t('nationPublic.joinedSuccess') : t('nationPublic.requestSent')
    requestMessage.value = ''
    await Promise.all([loadActivity(), loadCurrentNation()])
  } catch (err) {
    actionError.value = err.message || t('nationPublic.actionError')
  } finally {
    joinLoading.value = false
  }
}
async function handleApprove(requestId) {
  try {
    nation.value = await approveNationRequest(auth.accessToken, nation.value.slug, requestId)
    actionMessage.value = t('nationPublic.requestApproved')
    await loadActivity()
  } catch (err) {
    actionError.value = err.message || t('nationPublic.actionError')
  }
}
async function handleReject(requestId) {
  try {
    nation.value = await rejectNationRequest(auth.accessToken, nation.value.slug, requestId)
    actionMessage.value = t('nationPublic.requestRejected')
    await loadActivity()
  } catch (err) {
    actionError.value = err.message || t('nationPublic.actionError')
  }
}

async function loadPage() {
  liveMap.value = false
  await Promise.all([loadNation(), loadCurrentNation(), loadStats(), loadActivity(), loadTreasury(), loadDonors(), loadTerritory()])
}

watch(() => route.params.slug, loadPage)
watch(routeBackground, (value) => applyRouteBackground(value), { immediate: true })
onMounted(loadPage)
onBeforeUnmount(() => document.documentElement.style.removeProperty('--route-bg'))
</script>

<template>
  <section class="na-page">
    <div class="container-shell">
      <div v-if="loading" class="na-skel">
        <div class="skeleton na-skel__hero"></div>
        <div class="na-skel__row">
          <div class="skeleton na-skel__main"></div>
          <div class="skeleton na-skel__side"></div>
        </div>
      </div>

      <div v-else-if="error" class="alert alert-error">{{ error }}</div>

      <article v-else-if="nation" class="na" :style="pageVars">
        <!-- cover, identity, numbers -->
        <header class="na-head">
          <div class="na-banner" :style="bannerStyle"></div>
          <div class="na-id">
            <div class="na-emblem">
              <img v-if="iconUrl" :src="iconUrl" :alt="nation.tag" />
              <span v-else>{{ (nation.tag || nation.title).slice(0, 2).toUpperCase() }}</span>
            </div>
            <div class="na-id__text">
              <div class="na-title-row">
                <h1 class="na-title">{{ nation.title }}</h1>
                <span class="na-tag">{{ nation.tag }}</span>
              </div>
              <p v-if="nation.short_description" class="na-motto">{{ nation.short_description }}</p>
              <div class="na-chips">
                <span class="na-chip" :class="`na-chip--${nation.recruitment_policy}`">{{ recruitmentLabel }}</span>
                <RouterLink v-if="allianceSummary" to="/alliances" class="na-chip">{{ t('nationPublic.inAlliance', { name: allianceSummary.title }) }}</RouterLink>
                <span v-if="viewerCanManage" class="na-chip na-chip--you">{{ t('nationPublic.youManage') }}</span>
                <span v-else-if="viewerIsMember" class="na-chip na-chip--you">{{ t('nationPublic.youMember') }}</span>
                <span v-else-if="viewerHasPendingRequest" class="na-chip na-chip--pending">{{ t('nationPublic.pendingTitle') }}</span>
                <span v-if="nation.created_at" class="na-since">{{ t('nationPublic.foundedAt', { date: fmtDate(nation.created_at) }) }}</span>
              </div>
            </div>
            <div class="na-actions">
              <RouterLink v-if="viewerCanManage" to="/nation/studio" class="na-btn na-btn--primary">{{ t('nationPublic.manage') }}</RouterLink>
              <a v-else-if="canJoinDirectly || canRequestJoin" href="#na-join" class="na-btn na-btn--primary">{{ canJoinDirectly ? t('nationPublic.joinBtn') : t('nationPublic.requestBtn') }}</a>
              <RouterLink v-else-if="!isAuthenticated && nation.recruitment_policy !== 'invite_only'" :to="loginLink" class="na-btn na-btn--primary">{{ t('nationPublic.joinBtn') }}</RouterLink>
              <a :href="mapUrl" target="_blank" rel="noopener" class="na-btn">
                <svg class="na-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>
                {{ t('nationPublic.onMap') }}
              </a>
            </div>
          </div>

          <dl class="na-stats">
            <div v-for="s in statTiles" :key="s.key" class="na-stat">
              <dt>{{ s.label }}</dt>
              <dd>
                <span v-if="s.value === null" class="na-stat__wait"></span>
                <template v-else>{{ s.value }}</template>
              </dd>
            </div>
          </dl>
        </header>

        <p v-if="actionMessage" class="na-note na-note--ok" role="status">{{ actionMessage }}</p>
        <p v-if="actionError" class="na-note na-note--err" role="alert">{{ actionError }}</p>

        <div class="na-grid">
          <div class="na-main">
            <section v-if="nation.description" class="na-card">
              <h2 class="na-h">{{ t('nationPublic.aboutTitle') }}</h2>
              <p class="na-desc">{{ nation.description }}</p>
            </section>

            <!-- territory -->
            <section class="na-card na-terr">
              <div class="na-card__top">
                <div>
                  <h2 class="na-h">{{ t('nationPublic.territoryTitle') }}</h2>
                  <p class="na-muted">{{ territory ? t('nationPublic.territoryAuto') : t('nationPublic.territoryNone') }}</p>
                </div>
                <a :href="mapUrl" target="_blank" rel="noopener" class="na-btn na-btn--sm">{{ t('nationPublic.openMap') }}</a>
              </div>

              <div v-if="miniMap || liveMap" class="na-terr__body">
                <div class="na-mini">
                  <iframe v-if="liveMap" :src="mapUrl" class="na-mini__frame" :title="t('nationPublic.territoryTitle')" loading="lazy" referrerpolicy="no-referrer"></iframe>
                  <template v-else-if="miniMap">
                    <svg class="na-mini__svg" :viewBox="miniMap.viewBox" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="t('nationPublic.territoryTitle')">
                      <defs>
                        <pattern :id="`na-grid-${nation.slug}`" :width="miniMap.grid" :height="miniMap.grid" patternUnits="userSpaceOnUse">
                          <path :d="`M${miniMap.grid} 0H0V${miniMap.grid}`" fill="none" stroke="rgba(255,255,255,0.05)" :stroke-width="miniMap.stroke * 0.5" />
                        </pattern>
                      </defs>
                      <rect x="-100000" y="-100000" width="200000" height="200000" :fill="`url(#na-grid-${nation.slug})`" />
                      <path :d="miniMap.path" fill-rule="evenodd" class="na-mini__land" :stroke-width="miniMap.stroke" />
                      <circle :cx="miniMap.cx" :cy="miniMap.cz" :r="miniMap.r * 2.2" class="na-mini__halo" />
                      <circle :cx="miniMap.cx" :cy="miniMap.cz" :r="miniMap.r" class="na-mini__dot" />
                    </svg>
                    <button type="button" class="na-mini__live" @click="liveMap = true">{{ t('nationPublic.liveMap') }}</button>
                  </template>
                </div>
                <dl v-if="mainArea" class="na-terr__facts">
                  <div><dt>{{ t('nationPublic.terrSize') }}</dt><dd>{{ t('nationPublic.chunks', { n: formatNumber(territory.chunks) }) }}</dd></div>
                  <div><dt>{{ t('nationPublic.terrArea') }}</dt><dd>{{ t('nationPublic.blocks', { n: formatNumber(territory.chunks * 256) }) }}</dd></div>
                  <div><dt>{{ t('nationPublic.terrCenter') }}</dt><dd class="na-mono na-coords"><span>X {{ mainArea.center.x }}</span><span>Z {{ mainArea.center.z }}</span></dd></div>
                  <div v-if="mainArea.parts > 1"><dt>{{ t('nationPublic.terrParts') }}</dt><dd>{{ mainArea.parts }}</dd></div>
                </dl>
              </div>
              <p v-else-if="mapTarget" class="na-muted na-terr__capital">{{ t('nationPublic.capitalAt', { x: mapTarget.x, z: mapTarget.z }) }}</p>
            </section>

            <!-- members -->
            <section class="na-card">
              <div class="na-card__top">
                <h2 class="na-h">{{ t('nationPublic.membersTitle') }}</h2>
                <span class="na-count">{{ members.length }}</span>
              </div>
              <ul class="na-members">
                <li v-for="m in members" :key="m.user_id">
                  <RouterLink :to="`/u/${encodeURIComponent(String(m.site_login || m.minecraft_nickname).toLowerCase())}`" class="na-member" :class="`na-member--${m.role}`">
                    <span class="na-member__head">
                      <img v-if="m.minecraft_nickname" :src="`/api/v1/public/player-head/${encodeURIComponent(m.minecraft_nickname)}`" alt="" loading="lazy"
                           @error="(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://mc-heads.net/avatar/${encodeURIComponent(m.minecraft_nickname)}/40` }" />
                    </span>
                    <span class="na-member__text">
                      <b>{{ m.minecraft_nickname || m.site_login }}</b>
                      <span>{{ roleLabel(m.role) }}</span>
                    </span>
                  </RouterLink>
                </li>
              </ul>
            </section>

            <NationActivityFeed class="na-feed" :items="activity" :loading="activityLoading" />
          </div>

          <aside class="na-side">
            <!-- membership -->
            <section id="na-join" class="na-card na-join">
              <template v-if="!isAuthenticated">
                <h2 class="na-h">{{ t('nationPublic.joinTitle') }}</h2>
                <p class="na-muted">{{ nation.recruitment_policy === 'invite_only' ? t('nationPublic.inviteOnlyDesc') : t('nationPublic.joinDesc') }}</p>
                <div v-if="nation.recruitment_policy !== 'invite_only'" class="na-stack">
                  <RouterLink :to="loginLink" class="na-btn na-btn--primary">{{ t('nationPublic.loginBtn') }}</RouterLink>
                  <RouterLink to="/register" class="na-btn">{{ t('nationPublic.registerBtn') }}</RouterLink>
                </div>
              </template>
              <template v-else-if="viewerCanManage">
                <h2 class="na-h">{{ t('nationPublic.myNationTitle') }}</h2>
                <p class="na-muted">{{ t('nationPublic.myNationDesc') }}</p>
                <div class="na-stack"><RouterLink to="/nation/studio" class="na-btn">{{ t('nationPublic.openStudio') }}</RouterLink></div>
              </template>
              <template v-else-if="viewerIsMember">
                <p class="na-state na-state--ok">{{ t('nationPublic.isMember') }}</p>
              </template>
              <template v-else-if="viewerOwnsOtherNation">
                <h2 class="na-h">{{ t('nationPublic.otherNationTitle') }}</h2>
                <p class="na-muted">{{ t('nationPublic.otherNationDesc', { name: currentNation?.title || '' }) }}</p>
                <div class="na-stack"><RouterLink :to="`/nation/${currentNation.slug}`" class="na-btn">{{ t('nationPublic.openMine') }}</RouterLink></div>
              </template>
              <template v-else-if="viewerHasPendingRequest">
                <p class="na-state na-state--wait">{{ t('nationPublic.pendingTitle') }}</p>
                <p class="na-muted">{{ t('nationPublic.pendingDesc') }}</p>
              </template>
              <template v-else-if="nation.recruitment_policy === 'invite_only'">
                <h2 class="na-h">{{ t('nationPublic.inviteOnlyTitle') }}</h2>
                <p class="na-muted">{{ t('nationPublic.inviteOnlyDesc') }}</p>
              </template>
              <template v-else-if="canRequestJoin">
                <h2 class="na-h">{{ t('nationPublic.requestTitle') }}</h2>
                <p class="na-muted">{{ t('nationPublic.requestDesc') }}</p>
                <textarea v-model="requestMessage" rows="3" maxlength="500" class="na-input" :placeholder="t('nationPublic.requestPlaceholder')"></textarea>
                <div class="na-stack">
                  <button type="button" class="na-btn na-btn--primary" :disabled="joinLoading || currentNationLoading" @click="handleJoin">
                    <span v-if="joinLoading" class="spinner"></span>
                    {{ joinLoading ? t('nationPublic.requesting') : t('nationPublic.requestBtn') }}
                  </button>
                </div>
              </template>
              <template v-else-if="canJoinDirectly">
                <h2 class="na-h">{{ t('nationPublic.openJoinTitle') }}</h2>
                <p class="na-muted">{{ t('nationPublic.openJoinDesc') }}</p>
                <div class="na-stack">
                  <button type="button" class="na-btn na-btn--primary" :disabled="joinLoading || currentNationLoading" @click="handleJoin">
                    <span v-if="joinLoading" class="spinner"></span>
                    {{ joinLoading ? t('nationPublic.joining') : t('nationPublic.joinBtn') }}
                  </button>
                </div>
              </template>
            </section>

            <!-- join requests for leaders -->
            <section v-if="viewerCanManage && nation.join_requests?.length" class="na-card">
              <div class="na-card__top">
                <h2 class="na-h">{{ t('nationPublic.requestsTitle') }}</h2>
                <span class="na-count na-count--accent">{{ nation.join_requests.length }}</span>
              </div>
              <ul class="na-requests">
                <li v-for="item in nation.join_requests" :key="item.id">
                  <b>{{ item.minecraft_nickname || item.site_login }}</b>
                  <p v-if="item.message">{{ item.message }}</p>
                  <div class="na-row">
                    <button type="button" class="na-btn na-btn--sm na-btn--primary" @click="handleApprove(item.id)">{{ t('nationPublic.approveBtn') }}</button>
                    <button type="button" class="na-btn na-btn--sm" @click="handleReject(item.id)">{{ t('nationPublic.rejectBtn') }}</button>
                  </div>
                </li>
              </ul>
            </section>

            <!-- alliance -->
            <section class="na-card">
              <h2 class="na-h">{{ t('nationPublic.allianceTitle') }}</h2>
              <p v-if="!allianceSummary" class="na-muted">{{ t('nationPublic.notInAlliance') }}</p>
              <template v-else>
                <p class="na-alliance">{{ allianceSummary.title }} <span>{{ allianceSummary.tag }}</span></p>
                <p v-if="allianceSummary.description" class="na-muted">{{ allianceSummary.description }}</p>
                <div v-if="allies.length" class="na-allies">
                  <RouterLink v-for="m in allies" :key="m.nation_id || m.slug" :to="`/nation/${m.slug}`" class="na-ally" :title="m.title">
                    <img v-if="m.icon_url || m.icon_preview_url" :src="m.icon_preview_url || m.icon_url" alt="" />
                    <span v-else>{{ (m.tag || m.title).slice(0, 2).toUpperCase() }}</span>
                    <b>{{ m.title }}</b>
                  </RouterLink>
                </div>
              </template>
            </section>

            <!-- treasury -->
            <section class="na-card">
              <h2 class="na-h">{{ t('nationPublic.treasuryTitle') }}</h2>
              <div v-if="treasuryLoading" class="na-skel-lines"><div v-for="i in 3" :key="i" class="skeleton"></div></div>
              <p v-else-if="!transactions.length" class="na-muted">{{ t('nationPublic.noTransactions') }}</p>
              <ul v-else class="na-tx">
                <li v-for="item in transactions.slice(0, 6)" :key="item.id">
                  <span class="na-tx__text">
                    <b>{{ txLabel(item) }}</b>
                    <span v-if="item.comment">{{ item.comment }}</span>
                  </span>
                  <strong :class="Number(item.net_amount) >= 0 ? 'plus' : 'minus'">{{ Number(item.net_amount) >= 0 ? '+' : '' }}{{ money(item.net_amount) }}</strong>
                </li>
              </ul>
            </section>

            <!-- donors -->
            <section v-if="donorsLoading || donors.length" class="na-card">
              <h2 class="na-h">{{ t('nationPublic.donorsTitle') }}</h2>
              <div v-if="donorsLoading" class="na-skel-lines"><div v-for="i in 3" :key="i" class="skeleton"></div></div>
              <ol v-else class="na-donors">
                <li v-for="(item, idx) in donors.slice(0, 5)" :key="item.user_id || item.site_login">
                  <span class="na-donors__place">{{ idx + 1 }}</span>
                  <b>{{ item.minecraft_nickname || item.site_login }}</b>
                  <strong>{{ money(item.total_amount ?? 0) }}</strong>
                </li>
              </ol>
            </section>

            <div class="na-links">
              <RouterLink to="/nations/rankings" class="na-link">{{ t('nationPublic.nationRanking') }}</RouterLink>
              <RouterLink to="/nations" class="na-link">{{ t('nationPublic.allNations') }}</RouterLink>
            </div>
          </aside>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.na-page { padding-block: 24px 48px; }
.na {
  --n-surface: rgba(19, 16, 33, 0.8);
  --n-line: rgba(255, 255, 255, 0.08);
  --n-line-2: rgba(255, 255, 255, 0.14);
  --n-text: #eeecf7;
  --n-muted: #9d99b6;
  --n-green: #34d399;
  --n-gold: #f2c14e;
  color: var(--n-text);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── head ─────────────────────────────────────────────── */
.na-head {
  border-radius: 26px; overflow: hidden; background: var(--n-surface); border: 1px solid var(--n-line);
  backdrop-filter: blur(18px); box-shadow: 0 30px 80px -40px var(--na-accent-glow);
}
.na-banner { position: relative; aspect-ratio: 4 / 1; min-height: 170px; max-height: 300px; background-size: cover; background-position: center; }
.na-banner::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(19, 16, 33, 0) 62%, rgba(19, 16, 33, 0.5) 100%); }
.na-id { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 24px; align-items: end; padding: 18px 32px 22px; }
.na-emblem {
  width: 144px; height: 144px; margin-top: -96px; border-radius: 30px; overflow: hidden; flex: none;
  display: grid; place-items: center; background: #15122a; border: 5px solid #15122a;
  box-shadow: 0 0 0 1px var(--na-accent-line), 0 24px 48px rgba(0, 0, 0, 0.5), 0 0 60px -10px var(--na-accent-glow);
  font-size: 2.8rem; font-weight: 900; color: var(--na-accent-ui);
}
.na-emblem img { width: 100%; height: 100%; object-fit: cover; }
.na-id__text { min-width: 0; }
.na-title-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
.na-title { margin: 0; font-size: clamp(2rem, 1.3rem + 1.8vw, 3.1rem); font-weight: 900; line-height: 1; letter-spacing: -0.025em; overflow-wrap: anywhere; }
.na-tag { font-size: 1rem; font-weight: 800; letter-spacing: 0.04em; color: var(--n-muted); }
.na-motto { margin: 10px 0 0; max-width: 64ch; font-size: 1.02rem; line-height: 1.5; color: #d6d2ea; font-style: italic; overflow-wrap: anywhere; }
.na-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; }
.na-chip { display: inline-flex; align-items: center; height: 28px; padding: 0 11px; border-radius: 8px; font-size: 0.84rem; font-weight: 700; white-space: nowrap; color: var(--n-text); text-decoration: none; border: 1px solid var(--n-line-2); background: rgba(255, 255, 255, 0.05); }
a.na-chip:hover { border-color: var(--na-accent-line); background: var(--na-accent-soft); }
.na-chip--open { color: #a7f3d0; border-color: rgba(52, 211, 153, 0.35); background: rgba(52, 211, 153, 0.1); }
.na-chip--invite_only { color: #fecaca; border-color: rgba(248, 113, 113, 0.3); background: rgba(248, 113, 113, 0.08); }
.na-chip--you { color: #ddd6fe; border-color: rgba(167, 139, 250, 0.45); background: rgba(139, 92, 246, 0.16); }
.na-chip--pending { color: #fde68a; border-color: rgba(242, 193, 78, 0.35); background: rgba(242, 193, 78, 0.1); }
.na-since { font-size: 0.86rem; color: var(--n-muted); margin-left: 4px; }
.na-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding-bottom: 4px; }

.na-ico { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.na-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 12px;
  font: inherit; font-size: 0.95rem; font-weight: 700; color: var(--n-text); text-decoration: none; white-space: nowrap;
  background: rgba(255, 255, 255, 0.06); border: 1px solid var(--n-line-2); cursor: pointer; transition: background-color 0.15s, border-color 0.15s, filter 0.15s;
}
.na-btn:hover { background: rgba(255, 255, 255, 0.1); }
.na-btn:disabled { opacity: 0.6; cursor: default; }
.na-btn--primary { min-width: 150px; color: var(--na-on-accent); background: var(--na-accent); border-color: transparent; box-shadow: 0 10px 30px -10px var(--na-accent-glow), 0 0 0 1px rgba(255, 255, 255, 0.12) inset; }
.na-btn--primary:hover { background: var(--na-accent); filter: brightness(1.08); }
.na-btn--sm { height: 36px; padding: 0 14px; font-size: 0.86rem; border-radius: 10px; min-width: 0; }
.na-btn:focus-visible, .na-chip:focus-visible, .na-member:focus-visible, .na-ally:focus-visible, .na-link:focus-visible, .na-mini__live:focus-visible { outline: 2px solid var(--na-accent-ui); outline-offset: 2px; }

.na-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0; border-top: 1px solid var(--n-line); background: rgba(0, 0, 0, 0.14); }
.na-stat { display: flex; flex-direction: column-reverse; gap: 4px; padding: 16px 24px; border-left: 1px solid var(--n-line); min-width: 0; }
.na-stat:first-child { border-left: 0; padding-left: 32px; }
.na-stat dd { margin: 0; font-size: 1.45rem; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.na-stat dt { font-size: 0.86rem; color: var(--n-muted); }
.na-stat__wait { display: inline-block; width: 70px; height: 20px; border-radius: 6px; background: rgba(255, 255, 255, 0.07); }

.na-note { margin: 0; padding: 10px 14px; border-radius: 12px; font-size: 0.92rem; border: 1px solid var(--n-line); }
.na-note--ok { background: rgba(52, 211, 153, 0.1); border-color: rgba(52, 211, 153, 0.35); color: #a7f3d0; }
.na-note--err { background: rgba(248, 113, 113, 0.1); border-color: rgba(248, 113, 113, 0.35); color: #fecaca; }

/* ── body ─────────────────────────────────────────────── */
.na-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
.na-main, .na-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.na-card { border-radius: 20px; border: 1px solid var(--n-line); background: var(--n-surface); padding: 22px 24px; backdrop-filter: blur(18px); min-width: 0; }
.na-card__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.na-card__top .na-h { margin: 0; }
.na-h { margin: 0 0 12px; font-size: 1.12rem; font-weight: 800; letter-spacing: -0.01em; }
.na-muted { margin: 4px 0 0; font-size: 0.9rem; line-height: 1.5; color: var(--n-muted); }
.na-desc { margin: 0; max-width: 72ch; font-size: 1rem; line-height: 1.65; white-space: pre-line; overflow-wrap: anywhere; color: #d9d6ea; }
.na-count { font-size: 0.82rem; font-weight: 800; color: var(--n-muted); padding: 3px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.07); }
.na-count--accent { color: var(--na-on-accent); background: var(--na-accent); }
.na-stack { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.na-row { display: flex; gap: 8px; margin-top: 10px; }
.na-mono { font-variant-numeric: tabular-nums; }

/* territory */
.na-terr__body { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 18px; align-items: stretch; }
.na-mini { position: relative; aspect-ratio: 16 / 10; border-radius: 14px; overflow: hidden; background: radial-gradient(120% 100% at 50% 50%, rgba(255, 255, 255, 0.03), transparent 70%), #0b0916; border: 1px solid var(--n-line); }
.na-mini__svg, .na-mini__frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
.na-mini__land { fill: var(--na-accent-soft); stroke: var(--na-accent-ui); stroke-linejoin: round; }
.na-mini__halo { fill: var(--na-accent-glow); }
.na-mini__dot { fill: var(--na-accent-ui); stroke: #0b0916; stroke-width: 0; }
.na-mini__live {
  position: absolute; right: 12px; bottom: 12px; height: 34px; padding: 0 12px; border-radius: 10px; cursor: pointer;
  font: inherit; font-size: 0.84rem; font-weight: 700; color: #fff; background: rgba(10, 8, 18, 0.75); border: 1px solid rgba(255, 255, 255, 0.18); backdrop-filter: blur(8px);
}
.na-mini__live:hover { background: rgba(10, 8, 18, 0.9); }
.na-terr__facts { margin: 0; display: flex; flex-direction: column; justify-content: center; }
.na-terr__facts > div { padding: 10px 0; border-top: 1px solid var(--n-line); }
.na-terr__facts > div:first-child { border-top: 0; }
.na-terr__facts dt { font-size: 0.84rem; color: var(--n-muted); }
.na-terr__facts dd { margin: 2px 0 0; font-size: 1.05rem; font-weight: 800; }
.na-terr__capital { margin-top: 0; }
.na-coords { display: flex; flex-wrap: wrap; gap: 0 12px; }
.na-coords span { white-space: nowrap; }

/* members */
.na-members { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.na-member { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; text-decoration: none; color: inherit; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--n-line); transition: background-color 0.15s, border-color 0.15s; }
.na-member:hover { background: rgba(255, 255, 255, 0.06); border-color: var(--na-accent-line); }
.na-member--leader { border-color: rgba(242, 193, 78, 0.35); background: linear-gradient(135deg, rgba(242, 193, 78, 0.08), transparent); }
.na-member__head { flex: none; width: 40px; height: 40px; border-radius: 10px; overflow: hidden; background: #1a1530; }
.na-member__head img { width: 100%; height: 100%; image-rendering: pixelated; }
.na-member__text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.na-member__text b { font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.na-member__text span { font-size: 0.8rem; color: var(--n-muted); }
.na-member--leader .na-member__text span { color: var(--n-gold); }

/* activity feed component, restyled to match the cards */
.na-feed { border-radius: 20px !important; border: 1px solid var(--n-line) !important; background: var(--n-surface) !important; padding: 22px 24px !important; box-shadow: none !important; }
.na-feed :deep(.naf__title) { font-size: 1.12rem; color: var(--n-text); margin-bottom: 12px; }
.na-feed :deep(.naf__msg) { font-size: 0.92rem; color: #d6d2ea; }
.na-feed :deep(.naf__time) { font-size: 0.8rem; color: var(--n-muted); }
.na-feed :deep(.naf__list li) { padding: 8px 0; border-bottom-color: var(--n-line); }

/* side */
.na-join { border-color: var(--na-accent-line); background: radial-gradient(120% 90% at 100% 0%, var(--na-accent-soft), transparent 60%), var(--n-surface); }
.na-input {
  width: 100%; margin-top: 12px; padding: 10px 12px; border-radius: 12px; resize: vertical;
  font: inherit; font-size: 0.92rem; color: var(--n-text); background: rgba(0, 0, 0, 0.28); border: 1px solid var(--n-line-2); outline: none;
}
.na-input:focus { border-color: var(--na-accent-line); box-shadow: 0 0 0 3px var(--na-accent-soft); }
.na-state { margin: 0; display: flex; align-items: center; gap: 10px; font-weight: 700; }
.na-state::before { content: ''; width: 10px; height: 10px; border-radius: 999px; flex: none; }
.na-state--ok::before { background: var(--n-green); box-shadow: 0 0 10px rgba(52, 211, 153, 0.6); }
.na-state--wait::before { background: var(--n-gold); }

.na-requests { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.na-requests li { padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--n-line); }
.na-requests p { margin: 4px 0 0; font-size: 0.86rem; color: #cfcbe3; overflow-wrap: anywhere; }

.na-alliance { margin: 0; font-size: 1.02rem; font-weight: 800; }
.na-alliance span { margin-left: 6px; font-size: 0.82rem; color: var(--n-muted); }
.na-allies { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.na-ally { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 10px; text-decoration: none; color: inherit; }
.na-ally:hover { background: rgba(255, 255, 255, 0.05); }
.na-ally img, .na-ally > span { width: 30px; height: 30px; border-radius: 8px; object-fit: cover; display: grid; place-items: center; font-size: 0.72rem; font-weight: 800; background: rgba(255, 255, 255, 0.07); }
.na-ally b { font-size: 0.9rem; }

.na-tx { list-style: none; margin: 0; padding: 0; }
.na-tx li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--n-line); }
.na-tx li:first-child { border-top: 0; padding-top: 0; }
.na-tx__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.na-tx__text b { font-size: 0.92rem; }
.na-tx__text span { font-size: 0.8rem; color: var(--n-muted); overflow-wrap: anywhere; }
.na-tx strong { font-size: 0.95rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.na-tx .plus { color: #6ee7b7; }
.na-tx .minus { color: #fca5a5; }

.na-donors { list-style: none; margin: 0; padding: 0; }
.na-donors li { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--n-line); }
.na-donors li:first-child { border-top: 0; }
.na-donors__place { width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; font-size: 0.78rem; font-weight: 800; background: rgba(255, 255, 255, 0.07); }
.na-donors li:first-child .na-donors__place { color: #1b1405; background: linear-gradient(135deg, #f7d27a, #e0a526); }
.na-donors b { font-size: 0.92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.na-donors strong { font-size: 0.92rem; font-variant-numeric: tabular-nums; }

.na-links { display: flex; gap: 8px; }
.na-link { flex: 1; text-align: center; padding: 10px; border-radius: 12px; font-size: 0.88rem; font-weight: 700; color: var(--n-muted); text-decoration: none; border: 1px solid var(--n-line); }
.na-link:hover { color: var(--n-text); background: rgba(255, 255, 255, 0.05); }

.na-skel { display: flex; flex-direction: column; gap: 16px; }
.na-skel__hero { height: 440px; border-radius: 26px; }
.na-skel__row { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; }
.na-skel__main { height: 420px; border-radius: 20px; }
.na-skel__side { height: 300px; border-radius: 20px; }
.na-skel-lines { display: flex; flex-direction: column; gap: 8px; }
.na-skel-lines .skeleton { height: 34px; border-radius: 8px; }

@media (max-width: 1100px) {
  .na-id { grid-template-columns: auto minmax(0, 1fr); }
  .na-actions { grid-column: 1 / -1; justify-content: flex-start; }
  .na-grid, .na-skel__row { grid-template-columns: minmax(0, 1fr); }
  .na-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .na-stat:nth-child(4) { border-left: 0; padding-left: 32px; }
  .na-stat:nth-child(n + 4) { border-top: 1px solid var(--n-line); }
}
@media (max-width: 640px) {
  .na-page { padding-block: 12px 32px; }
  .na-head { border-radius: 20px; }
  .na-banner { aspect-ratio: 16 / 7; min-height: 0; }
  .na-id { grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 0 18px 18px; }
  .na-emblem { width: 104px; height: 104px; margin-top: -52px; border-radius: 24px; border-width: 4px; }
  .na-actions .na-btn { flex: 1; }
  .na-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .na-stat, .na-stat:first-child, .na-stat:nth-child(4) { padding: 14px 18px; border-left: 0; }
  .na-stat:nth-child(even) { border-left: 1px solid var(--n-line); }
  .na-stat:nth-child(n + 3) { border-top: 1px solid var(--n-line); }
  .na-stat dd { font-size: 1.2rem; }
  .na-card { padding: 18px; }
  .na-terr__body { grid-template-columns: minmax(0, 1fr); }
  .na-terr__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
  .na-terr__facts > div:nth-child(2) { border-top: 0; }
  .na-card__top { flex-wrap: wrap; }
  .na-since { margin-left: 0; flex-basis: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .na-btn, .na-member, .na-chip { transition: none; }
}
</style>
