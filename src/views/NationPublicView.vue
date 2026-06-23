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
import { formatCompactHoursFromMinutes, formatNumber, formatRoleLabel, formatRecruitmentLabel } from '../utils/formatters'
import { usePageMeta } from '../composables/usePageMeta.js'

const { t } = useI18n()
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
const joinLoading = ref(false)
const requestMessage = ref('')

const nation = ref(null)
const currentNation = ref(null)
const stats = ref(null)
const activity = ref([])
const transactions = ref([])
const donors = ref([])

function bluemapUrl(x, z, world) {
  const base = siteConfig.bluemapUrl
  const w = world || 'world'
  return `${base}/#${w}:${x}:64:${z}:150:0:0:0:0:flat`
}

const dynmapIframeUrl = computed(() => {
  const n = nation.value
  if (n?.capital_x != null && n?.capital_z != null) {
    return bluemapUrl(n.capital_x, n.capital_z, n.capital_world)
  }
  return siteConfig.bluemapUrl
})

const dynmapOpenUrl = computed(() => {
  const n = nation.value
  if (n?.capital_x != null && n?.capital_z != null) {
    return bluemapUrl(n.capital_x, n.capital_z, n.capital_world)
  }
  return siteConfig.bluemapUrl
})

function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(109, 93, 246, ${alpha})`
  const value = hex.replace('#', '')
  const normalized = value.length === 3 ? value.split('').map((item) => item + item).join('') : value
  if (normalized.length !== 6) return `rgba(109, 93, 246, ${alpha})`
  const intValue = Number.parseInt(normalized, 16)
  const r = (intValue >> 16) & 255
  const g = (intValue >> 8) & 255
  const b = intValue & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function formatAllianceType(value) {
  switch (String(value || '').toLowerCase()) {
    case 'nato': return t('allianceHub.typeNato') || 'Military Alliance'
    case 'economic': return t('allianceHub.typeEconomic') || 'Economic Union'
    case 'un': return t('allianceHub.typeUn') || 'Political Union'
    default: return t('allianceHub.typeDefault') || 'Alliance'
  }
}

function txLabel(item) {
  const type = String(item?.transaction_type || '').toLowerCase()
  if (type === 'player_donation') return `Donation · ${item?.metadata_json?.minecraft_nickname || ''}`.trim()
  if (type === 'deposit') return 'Deposit'
  if (type === 'withdraw') return 'Withdrawal'
  if (type === 'alliance_transfer_out') return 'Transfer to ally'
  if (type === 'alliance_transfer_in') return 'From ally'
  if (type === 'alliance_fee_income') return 'Alliance commission'
  return item?.transaction_type || 'Operation'
}

function money(value) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
}

function avatarChar(member) {
  return ((member.minecraft_nickname || member.site_login || '?')[0]).toUpperCase()
}

const accent = computed(() => nation.value?.accent_color || '#6d5df6')
const iconUrl = computed(() => nation.value?.assets?.icon_url || nation.value?.assets?.icon_preview_url || '')
const bannerUrl = computed(() => nation.value?.assets?.banner_url || nation.value?.assets?.banner_preview_url || '')
const backgroundUrl = computed(() => nation.value?.assets?.background_url || nation.value?.assets?.background_preview_url || '')
const tagText = computed(() => nation.value?.tag || 'TAG')
const allianceSummary = computed(() => nation.value?.alliance_summary || null)

const allianceMembersPreview = computed(() => {
  const members = Array.isArray(allianceSummary.value?.members) ? allianceSummary.value.members : []
  return members.filter((item) => item.slug !== nation.value?.slug).slice(0, 5)
})

const routeBackground = computed(() => {
  const accentGlow = hexToRgba(accent.value, 0.2)
  if (!backgroundUrl.value) {
    return [
      `radial-gradient(circle at top left, ${accentGlow} 0%, transparent 26%)`,
      `radial-gradient(circle at top right, ${hexToRgba(accent.value, 0.14)} 0%, transparent 30%)`,
      'linear-gradient(180deg, #05070f 0%, #0a0f1c 48%, #10192c 100%)',
    ].join(', ')
  }
  return [
    'linear-gradient(180deg, rgba(4,6,11,0.62), rgba(4,6,11,0.9))',
    `radial-gradient(circle at top left, ${accentGlow} 0%, transparent 28%)`,
    `url(${backgroundUrl.value})`,
  ].join(', ')
})

const heroStyle = computed(() => {
  if (bannerUrl.value) {
    return {
      backgroundImage: [
        'linear-gradient(180deg, rgba(4,6,11,0.08) 0%, rgba(4,6,11,0.78) 100%)',
        `radial-gradient(circle at top left, ${hexToRgba(accent.value, 0.3)} 0%, transparent 36%)`,
        `url(${bannerUrl.value})`,
      ].join(', '),
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return {
    background: [
      `radial-gradient(ellipse at top left, ${hexToRgba(accent.value, 0.38)} 0%, transparent 40%)`,
      `radial-gradient(ellipse at bottom right, ${hexToRgba(accent.value, 0.14)} 0%, transparent 36%)`,
      'linear-gradient(135deg, rgba(8,12,24,0.98) 0%, rgba(14,20,36,1) 100%)',
    ].join(', '),
  }
})

const cardStyle = computed(() => ({
  borderColor: hexToRgba(accent.value, 0.16),
}))

const accentBtnStyle = computed(() => ({
  background: `linear-gradient(135deg, ${accent.value} 0%, ${hexToRgba(accent.value, 0.7)} 100%)`,
  borderColor: 'transparent',
  color: '#fff',
}))

const isAuthenticated = computed(() => auth.isAuthenticated.value)
const viewerHasPendingRequest = computed(() => nation.value?.viewer_request_status === 'pending')
const viewerIsMember = computed(() => Boolean(nation.value?.viewer_is_member))
const viewerCanManage = computed(() => Boolean(nation.value?.viewer_can_manage))
const viewerOwnsOtherNation = computed(() => {
  if (!currentNation.value?.slug || !nation.value?.slug) return false
  return currentNation.value.slug !== nation.value.slug
})

const canJoinDirectly = computed(() => {
  if (!nation.value || !isAuthenticated.value) return false
  if (viewerCanManage.value || viewerIsMember.value || viewerHasPendingRequest.value || viewerOwnsOtherNation.value) return false
  return nation.value.recruitment_policy === 'open'
})

const canRequestJoin = computed(() => {
  if (!nation.value || !isAuthenticated.value) return false
  if (viewerCanManage.value || viewerIsMember.value || viewerHasPendingRequest.value || viewerOwnsOtherNation.value) return false
  return nation.value.recruitment_policy === 'request'
})

const canShowJoinAction = computed(() => canJoinDirectly.value || canRequestJoin.value)

function applyRouteBackground(value) {
  document.documentElement.style.setProperty('--route-bg', value)
}

async function loadNation() {
  loading.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    nation.value = await getNationBySlug(route.params.slug, auth.accessToken || null)
    const n = nation.value
    usePageMeta({
      title: n.title,
      description: n.short_description || `Государство ${n.title} на сервере VoidRP.`,
      url: `https://void-rp.ru/nation/${n.slug}`,
      ...(n.assets?.icon_url ? { image: n.assets.icon_url } : {}),
      breadcrumbs: [
        { name: 'Главная', url: '/' },
        { name: 'Государства', url: '/nations' },
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
  try { currentNation.value = await getMyNation(auth.accessToken) }
  catch { currentNation.value = null }
  finally { currentNationLoading.value = false }
}

async function loadStats() {
  statsLoading.value = true
  try { stats.value = await getNationStatsBySlug(route.params.slug, auth.accessToken || null) }
  catch { stats.value = null }
  finally { statsLoading.value = false }
}

async function loadActivity() {
  activityLoading.value = true
  try {
    const payload = await getNationActivity(route.params.slug, auth.accessToken || null)
    activity.value = Array.isArray(payload?.items) ? payload.items : []
  } catch { activity.value = [] }
  finally { activityLoading.value = false }
}

async function loadTreasury() {
  treasuryLoading.value = true
  try {
    const payload = await getNationTreasuryTransactions(route.params.slug, auth.accessToken || null)
    transactions.value = payload?.items || []
  } catch { transactions.value = [] }
  finally { treasuryLoading.value = false }
}

async function loadDonors() {
  donorsLoading.value = true
  try {
    const payload = await getNationTopDonors(route.params.slug, auth.accessToken || null)
    donors.value = payload?.items || []
  } catch { donors.value = [] }
  finally { donorsLoading.value = false }
}

async function handleJoin() {
  if (!nation.value || !auth.accessToken || !canShowJoinAction.value) return
  joinLoading.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    const response = await joinNation(auth.accessToken, nation.value.slug, {
      message: canRequestJoin.value ? requestMessage.value || null : null,
    })
    nation.value = response?.nation || nation.value
    actionMessage.value = canJoinDirectly.value ? t('nationPublic.joinedSuccess') : t('nationPublic.requestSent')
    requestMessage.value = ''
    await Promise.all([loadActivity(), loadCurrentNation()])
  } catch (err) {
    error.value = err.message || t('nationPublic.actionError')
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
    error.value = err.message || t('nationPublic.actionError')
  }
}

async function handleReject(requestId) {
  try {
    nation.value = await rejectNationRequest(auth.accessToken, nation.value.slug, requestId)
    actionMessage.value = t('nationPublic.requestRejected')
    await loadActivity()
  } catch (err) {
    error.value = err.message || t('nationPublic.actionError')
  }
}

async function loadPage() {
  await Promise.all([loadNation(), loadCurrentNation(), loadStats(), loadActivity(), loadTreasury(), loadDonors()])
}

watch(() => route.params.slug, loadPage)
watch(routeBackground, (value) => applyRouteBackground(value), { immediate: true })
onMounted(loadPage)
onBeforeUnmount(() => { document.documentElement.style.removeProperty('--route-bg') })
</script>

<template>
  <section class="np py-3 md:py-4">
    <div class="container-shell max-w-[1380px] space-y-3">

      <!-- Loading -->
      <template v-if="loading">
        <div class="skeleton np-hero-skeleton"></div>
        <div class="np-stats-skeleton">
          <div v-for="i in 5" :key="i" class="skeleton" style="height:58px;border-radius:12px"></div>
        </div>
        <div class="np-grid">
          <div class="skeleton" style="height:320px;border-radius:20px"></div>
          <div class="skeleton" style="height:320px;border-radius:20px"></div>
        </div>
      </template>

      <div v-else-if="error" class="alert alert-error">{{ error }}</div>

      <template v-else-if="nation">

        <!-- ─── HERO ─── -->
        <header class="np-hero" :style="heroStyle">
          <div class="np-hero__top">
            <div class="np-chips">
              <span class="np-chip">{{ formatRecruitmentLabel(nation.recruitment_policy) }}</span>
              <span v-if="allianceSummary" class="np-chip">{{ allianceSummary.tag }}</span>
              <span v-if="viewerHasPendingRequest" class="np-chip np-chip--amber">{{ t('nationPublic.txPending') }}</span>
              <span v-if="viewerIsMember && !viewerCanManage" class="np-chip np-chip--green">{{ t('nationPublic.txMember') }}</span>
              <span v-if="viewerCanManage" class="np-chip np-chip--green">{{ t('nationPublic.txLeader') }}</span>
            </div>
          </div>

          <div class="np-hero__bottom">
            <div class="np-hero__identity">
              <div class="np-icon">
                <img v-if="iconUrl" :src="iconUrl" :alt="nation.tag" class="np-icon__img" />
                <span v-else>{{ tagText.slice(0, 2).toUpperCase() }}</span>
              </div>
              <div class="np-hero__text">
                <h1 class="np-hero__title">{{ nation.title }}</h1>
                <p class="np-hero__sub">[{{ nation.tag }}]<template v-if="nation.short_description"> · {{ nation.short_description }}</template></p>
              </div>
            </div>
            <div class="np-hero__actions">
              <RouterLink v-if="viewerCanManage" to="/nation/studio" class="btn btn-sm btn-light">{{ t('nationPublic.manage') }}</RouterLink>
              <RouterLink to="/nations" class="btn btn-sm np-btn-ghost">{{ t('nationPublic.allNations') }}</RouterLink>
            </div>
          </div>
        </header>

        <!-- ─── STATS STRIP ─── -->
        <div class="np-stats">
          <div class="np-stat">
            <span>{{ t('nationPublic.statTreasury') }}</span>
            <strong v-if="statsLoading" class="np-stat__loading">···</strong>
            <strong v-else>{{ money(stats?.treasury_balance ?? 0) }}</strong>
          </div>
          <div class="np-stat">
            <span>{{ t('nationPublic.statTerritory') }}</span>
            <strong v-if="statsLoading" class="np-stat__loading">···</strong>
            <strong v-else>{{ formatNumber(stats?.territory_points ?? 0) }}</strong>
          </div>
          <div class="np-stat">
            <span>{{ t('nationPublic.statOnline') }}</span>
            <strong v-if="statsLoading" class="np-stat__loading">···</strong>
            <strong v-else>{{ formatCompactHoursFromMinutes(stats?.total_playtime_minutes ?? 0) }}</strong>
          </div>
          <div class="np-stat">
            <span>{{ t('nationPublic.statPrestige') }}</span>
            <strong v-if="statsLoading" class="np-stat__loading">···</strong>
            <strong v-else>{{ formatNumber(stats?.prestige_score ?? 0) }}</strong>
          </div>
          <div class="np-stat">
            <span>{{ t('nationPublic.statMembers') }}</span>
            <strong>{{ nation.members.length }}</strong>
          </div>
        </div>

        <div v-if="actionMessage" class="alert alert-success">{{ actionMessage }}</div>

        <!-- ─── MAIN GRID ─── -->
        <div class="np-grid">

          <!-- Left column -->
          <div class="np-left">

            <!-- Description -->
            <section v-if="nation.description" class="surface-card np-card" :style="cardStyle">
              <h2 class="np-card__title">{{ t('nationPublic.aboutTitle') }}</h2>
              <p class="np-desc">{{ nation.description }}</p>
            </section>

            <!-- Members -->
            <section class="surface-card np-card" :style="cardStyle">
              <div class="np-card__header">
                <h2 class="np-card__title">{{ t('nationPublic.membersTitle') }}</h2>
                <span class="np-badge">{{ nation.members.length }}</span>
              </div>
              <div class="np-members">
                <div v-for="member in nation.members" :key="member.user_id" class="np-member">
                  <div class="np-member__av" :style="{ background: hexToRgba(accent, 0.28), color: accent }">
                    <img
                      v-if="member.minecraft_nickname"
                      :src="`/api/v1/public/player-head/${encodeURIComponent(member.minecraft_nickname)}`"
                      class="np-member__head"
                      alt=""
                      loading="lazy"
                      @error="e => { e.currentTarget.onerror = null; e.currentTarget.src = `https://mc-heads.net/avatar/${encodeURIComponent(member.minecraft_nickname)}/32` }"
                    />
                    <span class="np-member__letter">{{ avatarChar(member) }}</span>
                  </div>
                  <div class="np-member__info">
                    <strong>{{ member.minecraft_nickname || member.site_login }}</strong>
                    <small>{{ formatRoleLabel(member.role) }}</small>
                  </div>
                </div>
              </div>
            </section>

            <!-- Activity -->
            <NationActivityFeed
              :items="activity"
              :loading="activityLoading"
              :card-style="cardStyle"
            />
          </div>

          <!-- Sidebar -->
          <aside class="np-sidebar">

            <!-- Join / membership card -->
            <section class="surface-card np-card" :style="cardStyle">
              <!-- not authenticated -->
              <template v-if="!isAuthenticated">
                <h2 class="np-card__title">{{ t('nationPublic.joinTitle') }}</h2>
                <p class="np-sidebar__text">{{ t('nationPublic.joinDesc') }}</p>
                <div class="np-card__actions">
                  <RouterLink :to="`/login?redirect=${encodeURIComponent(`/nation/${nation.slug}`)}`" class="btn btn-primary w-full">{{ t('nationPublic.loginBtn') }}</RouterLink>
                  <RouterLink to="/register" class="btn btn-outline w-full">{{ t('nationPublic.registerBtn') }}</RouterLink>
                </div>
              </template>

              <!-- manager -->
              <template v-else-if="viewerCanManage">
                <h2 class="np-card__title">{{ t('nationPublic.myNationTitle') }}</h2>
                <p class="np-sidebar__text">{{ t('nationPublic.myNationDesc') }}</p>
                <RouterLink to="/nation/studio" class="btn btn-outline w-full mt-3" style="min-height:2.4rem">{{ t('nationPublic.openStudio') }}</RouterLink>
              </template>

              <!-- already a member -->
              <template v-else-if="viewerIsMember">
                <div class="np-status-row np-status-row--green">
                  <span class="np-status-dot"></span>
                  <strong>{{ t('nationPublic.isMember') }}</strong>
                </div>
              </template>

              <!-- owns another nation -->
              <template v-else-if="viewerOwnsOtherNation">
                <h2 class="np-card__title">{{ t('nationPublic.otherNationTitle') }}</h2>
                <p class="np-sidebar__text">
                  {{ t('nationPublic.otherNationDesc', { name: currentNation?.title || '' }) }}
                </p>
                <RouterLink to="/nation/studio" class="btn btn-outline w-full mt-3" style="min-height:2.4rem">{{ t('nationPublic.openMine') }}</RouterLink>
              </template>

              <!-- pending request -->
              <template v-else-if="viewerHasPendingRequest">
                <div class="np-status-row np-status-row--amber">
                  <span class="np-status-dot"></span>
                  <strong>{{ t('nationPublic.pendingTitle') }}</strong>
                </div>
                <p class="np-sidebar__text mt-2">{{ t('nationPublic.pendingDesc') }}</p>
              </template>

              <!-- invite only -->
              <template v-else-if="nation.recruitment_policy === 'invite_only'">
                <h2 class="np-card__title">{{ t('nationPublic.inviteOnlyTitle') }}</h2>
                <p class="np-sidebar__text">{{ t('nationPublic.inviteOnlyDesc') }}</p>
              </template>

              <!-- request join -->
              <template v-else-if="canRequestJoin">
                <h2 class="np-card__title">{{ t('nationPublic.requestTitle') }}</h2>
                <textarea
                  v-model="requestMessage"
                  rows="3"
                  class="textarea w-full mt-3"
                  :placeholder="t('nationPublic.requestPlaceholder')"
                ></textarea>
                <button type="button" class="btn w-full mt-2.5" style="min-height:2.4rem" :style="accentBtnStyle" :disabled="joinLoading || currentNationLoading" @click="handleJoin">
                  <span v-if="joinLoading" class="spinner mr-1.5"></span>
                  {{ joinLoading ? t('nationPublic.requesting') : t('nationPublic.requestBtn') }}
                </button>
              </template>

              <!-- open join -->
              <template v-else-if="canJoinDirectly">
                <h2 class="np-card__title">{{ t('nationPublic.openJoinTitle') }}</h2>
                <p class="np-sidebar__text">{{ t('nationPublic.openJoinDesc') }}</p>
                <button type="button" class="btn w-full mt-3" style="min-height:2.4rem" :style="accentBtnStyle" :disabled="joinLoading || currentNationLoading" @click="handleJoin">
                  <span v-if="joinLoading" class="spinner mr-1.5"></span>
                  {{ joinLoading ? t('nationPublic.joining') : t('nationPublic.joinBtn') }}
                </button>
              </template>
            </section>

            <!-- Alliance card -->
            <section class="surface-card np-card" :style="cardStyle">
              <div class="np-card__header">
                <h2 class="np-card__title">{{ t('nationPublic.allianceTitle') }}</h2>
                <span v-if="allianceSummary" class="np-badge">{{ allianceSummary.tag }}</span>
              </div>

              <div v-if="!allianceSummary" class="np-empty">{{ t('nationPublic.notInAlliance') }}</div>

              <template v-else>
                <p class="np-sidebar__text np-sidebar__text--name">{{ allianceSummary.title }}</p>
                <p class="np-sidebar__text">{{ formatAllianceType(allianceSummary.alliance_type) }} · {{ allianceSummary.members_count }} государств</p>
                <p v-if="allianceSummary.description" class="np-sidebar__text mt-2">{{ allianceSummary.description }}</p>

                <div v-if="allianceMembersPreview.length" class="np-allies">
                  <RouterLink
                    v-for="member in allianceMembersPreview"
                    :key="member.nation_id"
                    :to="`/nation/${member.slug}`"
                    class="np-ally"
                  >
                    <div class="np-ally__av">
                      <img v-if="member.icon_url || member.icon_preview_url" :src="member.icon_url || member.icon_preview_url" :alt="member.tag" />
                      <span v-else>{{ member.tag?.slice(0, 2).toUpperCase() }}</span>
                    </div>
                    <div>
                      <strong>{{ member.title }}</strong>
                      <small>[{{ member.tag }}]</small>
                    </div>
                  </RouterLink>
                </div>

                <RouterLink to="/alliances" class="btn btn-outline w-full mt-3" style="min-height:2.4rem;font-size:.83rem">
                  {{ t('nationPublic.allianceCenter') }}
                </RouterLink>
              </template>
            </section>

            <!-- Requests (manager only) -->
            <section v-if="viewerCanManage && nation.join_requests?.length" class="surface-card np-card" :style="cardStyle">
              <div class="np-card__header">
                <h2 class="np-card__title">{{ t('nationPublic.requestsTitle') }}</h2>
                <span class="np-badge np-badge--accent">{{ nation.join_requests.length }}</span>
              </div>
              <div class="np-requests">
                <div v-for="item in nation.join_requests" :key="item.id" class="np-request">
                  <div class="np-request__info">
                    <strong>{{ item.minecraft_nickname || item.site_login }}</strong>
                    <small>@{{ item.site_login }}</small>
                    <p v-if="item.message">{{ item.message }}</p>
                  </div>
                  <div class="np-request__btns">
                    <button type="button" class="btn btn-outline btn-sm" @click="handleReject(item.id)">{{ t('nationPublic.rejectBtn') }}</button>
                    <button type="button" class="btn btn-sm" :style="accentBtnStyle" @click="handleApprove(item.id)">{{ t('nationPublic.approveBtn') }}</button>
                  </div>
                </div>
              </div>
            </section>

            <!-- Map card -->
            <section class="surface-card np-card np-map-card" :style="cardStyle">
              <div class="np-card__header" style="margin-bottom:.5rem">
                <h2 class="np-card__title" style="margin-bottom:0">{{ t('nationPublic.mapTitle') }}</h2>
                <a :href="dynmapOpenUrl" target="_blank" rel="noreferrer" class="np-map-link">↗</a>
              </div>
              <div class="np-map-wrap">
                <iframe
                  :src="dynmapIframeUrl"
                  class="np-map-iframe"
                  title="Dynmap"
                  allowfullscreen
                  loading="lazy"
                  referrerpolicy="no-referrer"
                ></iframe>
                <div class="np-map-overlay">
                  <a :href="dynmapOpenUrl" target="_blank" rel="noreferrer" class="np-map-open-btn" :style="{ background: accent }">
                    {{ t('nationPublic.openMap') }}
                  </a>
                </div>
              </div>
            </section>

            <RouterLink to="/nations/rankings" class="btn btn-outline w-full" style="min-height:2.4rem;font-size:.83rem">
              {{ t('nationPublic.nationRanking') }}
            </RouterLink>
          </aside>
        </div>

        <!-- ─── BOTTOM: TREASURY + DONORS ─── -->
        <div class="np-bottom">
          <section class="surface-card np-card" :style="cardStyle">
            <h2 class="np-card__title">{{ t('nationPublic.treasuryTitle') }}</h2>
            <div v-if="treasuryLoading" class="np-skeletons mt-3">
              <div v-for="i in 4" :key="i" class="skeleton" style="height:32px;border-radius:8px"></div>
            </div>
            <div v-else-if="!transactions.length" class="np-empty mt-3">{{ t('nationPublic.noTransactions') }}</div>
            <ul v-else class="np-list mt-3">
              <li v-for="item in transactions.slice(0, 8)" :key="item.id">
                <div class="np-list__left">
                  <span>{{ txLabel(item) }}</span>
                  <small>{{ item.comment || '' }}</small>
                </div>
                <strong :class="Number(item.net_amount) >= 0 ? 'positive' : 'negative'">
                  {{ Number(item.net_amount) >= 0 ? '+' : '' }}{{ money(item.net_amount) }}
                </strong>
              </li>
            </ul>
          </section>

          <section class="surface-card np-card" :style="cardStyle">
            <h2 class="np-card__title">{{ t('nationPublic.donorsTitle') }}</h2>
            <div v-if="donorsLoading" class="np-skeletons mt-3">
              <div v-for="i in 4" :key="i" class="skeleton" style="height:32px;border-radius:8px"></div>
            </div>
            <div v-else-if="!donors.length" class="np-empty mt-3">{{ t('nationPublic.noDonors') }}</div>
            <ul v-else class="np-list mt-3">
              <li v-for="(item, idx) in donors.slice(0, 8)" :key="item.user_id || item.site_login">
                <div class="np-list__left">
                  <span>
                    <span class="np-rank">#{{ idx + 1 }}</span>
                    {{ item.minecraft_nickname || item.site_login }}
                  </span>
                  <small>@{{ item.site_login }}</small>
                </div>
                <strong class="positive">{{ money(item.total_amount ?? 0) }}</strong>
              </li>
            </ul>
          </section>
        </div>

      </template>
    </div>
  </section>
</template>

<style scoped>
/* ─── Hero ─── */
.np-hero {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.1);
  box-shadow: 0 20px 60px rgba(0,0,0,.3);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 200px;
  padding: 1.1rem 1.25rem 1.25rem;
}

.np-hero__top { display: flex; align-items: flex-start; justify-content: space-between; }

.np-chips {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
}

.np-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.35);
  backdrop-filter: blur(10px);
  padding: .22rem .7rem;
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(255,255,255,.8);
}

.np-chip--amber {
  border-color: rgba(251,191,36,.24);
  background: rgba(251,191,36,.12);
  color: rgb(253 230 138);
}

.np-chip--green {
  border-color: rgba(52,211,153,.24);
  background: rgba(52,211,153,.1);
  color: rgb(110 231 183);
}

.np-hero__bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2rem;
}

.np-hero__identity {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  min-width: 0;
}

.np-icon {
  flex-shrink: 0;
  width: 68px;
  height: 68px;
  border-radius: 16px;
  border: 2px solid rgba(255,255,255,.85);
  background: rgba(10,15,30,.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: 900;
  color: #f8fbff;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,.35);
}

.np-icon__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.np-hero__text { min-width: 0; padding-bottom: 2px; }

.np-hero__title {
  font-size: clamp(1.35rem, 3vw, 2rem);
  font-weight: 900;
  color: #fff;
  margin: 0;
  letter-spacing: -.03em;
  text-shadow: 0 2px 12px rgba(0,0,0,.4);
}

.np-hero__sub {
  margin: .3rem 0 0;
  font-size: .875rem;
  color: rgba(255,255,255,.68);
}

.np-hero__actions {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
  align-items: center;
}

.np-btn-ghost {
  border: 1px solid rgba(255,255,255,.16) !important;
  background: rgba(0,0,0,.2) !important;
  color: rgba(255,255,255,.8) !important;
  backdrop-filter: blur(8px);
}

/* ─── Stats strip ─── */
.np-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: .5rem;
}

.np-stat {
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 14px;
  background: rgba(5,10,20,.6);
  padding: .65rem .85rem;
  display: flex;
  flex-direction: column;
  gap: .2rem;
}

.np-stat span {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
}

.np-stat strong {
  font-size: 1.15rem;
  font-weight: 900;
  color: #f8fbff;
  letter-spacing: -.03em;
}

.np-stat__loading {
  color: rgb(71 85 105) !important;
  font-size: 1rem !important;
  letter-spacing: .1em !important;
}

/* ─── Layout ─── */
.np-grid {
  display: grid;
  gap: .75rem;
}

@media (min-width: 1100px) {
  .np-grid { grid-template-columns: minmax(0, 1fr) 300px; }
}

.np-left { display: flex; flex-direction: column; gap: .75rem; }
.np-sidebar { display: flex; flex-direction: column; gap: .75rem; }

.np-bottom {
  display: grid;
  gap: .75rem;
  grid-template-columns: 1fr;
}

@media (min-width: 860px) {
  .np-bottom { grid-template-columns: 1fr 1fr; }
}

/* ─── Cards ─── */
.np-card {
  padding: 1rem;
}

.np-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  margin-bottom: .75rem;
}

.np-card__title {
  font-size: .92rem;
  font-weight: 800;
  color: rgb(203 213 225);
  margin: 0 0 .65rem;
}

.np-card__header .np-card__title { margin-bottom: 0; }

.np-badge {
  font-size: .75rem;
  font-weight: 700;
  border-radius: 999px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(255,255,255,.05);
  padding: .2rem .55rem;
  color: rgb(148 163 184);
}

.np-badge--accent {
  border-color: rgba(251,191,36,.2);
  background: rgba(251,191,36,.1);
  color: rgb(253 230 138);
}

.np-card__actions {
  display: grid;
  gap: .5rem;
  margin-top: .85rem;
}

/* ─── Description ─── */
.np-desc {
  font-size: .88rem;
  line-height: 1.7;
  color: rgb(148 163 184);
  white-space: pre-line;
  margin: 0;
}

/* ─── Members ─── */
.np-members {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: .4rem;
}

.np-member {
  display: flex;
  align-items: center;
  gap: .6rem;
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 12px;
  background: rgba(255,255,255,.025);
  padding: .55rem .65rem;
}

.np-member__av {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .75rem;
  font-weight: 900;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.np-member__head {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.np-member__letter {
  position: relative;
  z-index: 0;
}

.np-member__info { min-width: 0; }

.np-member__info strong {
  display: block;
  font-size: .82rem;
  font-weight: 700;
  color: rgb(226 232 240);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.np-member__info small {
  display: block;
  font-size: .75rem;
  font-weight: 600;
  color: rgb(100 116 139);
  margin-top: .1rem;
}

/* ─── Sidebar text ─── */
.np-sidebar__text {
  font-size: .85rem;
  line-height: 1.6;
  color: rgb(148 163 184);
  margin: 0;
}

.np-sidebar__text + .np-sidebar__text { margin-top: .3rem; }
.np-sidebar__text.mt-2 { margin-top: .5rem; }

.np-sidebar__text--name {
  font-size: .92rem;
  font-weight: 700;
  color: rgb(226 232 240);
}

/* ─── Status rows ─── */
.np-status-row {
  display: flex;
  align-items: center;
  gap: .55rem;
  padding: .6rem .75rem;
  border-radius: 10px;
}

.np-status-row--green {
  background: rgba(52,211,153,.07);
  border: 1px solid rgba(52,211,153,.16);
}

.np-status-row--green strong { color: rgb(110 231 183); font-size: .88rem; }

.np-status-row--amber {
  background: rgba(251,191,36,.07);
  border: 1px solid rgba(251,191,36,.16);
}

.np-status-row--amber strong { color: rgb(253 230 138); font-size: .88rem; }

.np-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
  background: currentColor;
}

.np-status-row--green .np-status-dot { background: rgb(52 211 153); }
.np-status-row--amber .np-status-dot { background: rgb(251 191 36); }

/* ─── Alliance ─── */
.np-allies {
  display: flex;
  flex-direction: column;
  gap: .35rem;
  margin-top: .85rem;
}

.np-ally {
  display: flex;
  align-items: center;
  gap: .6rem;
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 10px;
  background: rgba(255,255,255,.025);
  padding: .45rem .6rem;
  transition: background .12s;
}

.np-ally:hover { background: rgba(255,255,255,.05); }

.np-ally__av {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(10,15,30,.7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .75rem;
  font-weight: 900;
  color: #f8fbff;
  flex-shrink: 0;
  overflow: hidden;
}

.np-ally__av img { width: 100%; height: 100%; object-fit: cover; }

.np-ally div:last-child { min-width: 0; }

.np-ally strong {
  display: block;
  font-size: .82rem;
  font-weight: 700;
  color: rgb(226 232 240);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.np-ally small {
  display: block;
  font-size: .75rem;
  color: rgb(100 116 139);
}

/* ─── Requests ─── */
.np-requests { display: flex; flex-direction: column; gap: .5rem; }

.np-request {
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  background: rgba(255,255,255,.025);
  padding: .7rem .75rem;
  display: flex;
  flex-wrap: wrap;
  gap: .75rem;
  align-items: flex-start;
  justify-content: space-between;
}

.np-request__info { min-width: 0; }

.np-request__info strong {
  display: block;
  font-size: .88rem;
  font-weight: 700;
  color: rgb(226 232 240);
}

.np-request__info small {
  display: block;
  font-size: .75rem;
  color: rgb(100 116 139);
  margin-top: .1rem;
}

.np-request__info p {
  font-size: .82rem;
  color: rgb(148 163 184);
  margin: .4rem 0 0;
}

.np-request__btns { display: flex; gap: .4rem; flex-shrink: 0; }

/* ─── List (treasury/donors) ─── */
.np-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.np-list li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .75rem;
  padding: .45rem 0;
  border-bottom: 1px solid rgba(255,255,255,.05);
}

.np-list li:last-child { border-bottom: none; }

.np-list__left { min-width: 0; }

.np-list__left span {
  display: block;
  font-size: .85rem;
  font-weight: 600;
  color: rgb(203 213 225);
}

.np-list__left small {
  display: block;
  font-size: .75rem;
  color: rgb(100 116 139);
  margin-top: .05rem;
}

.np-list li > strong {
  font-size: .85rem;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.positive { color: rgb(110 231 183); }
.negative { color: rgb(252 165 165); }

.np-rank {
  display: inline-block;
  font-size: .75rem;
  font-weight: 800;
  color: rgb(100 116 139);
  margin-right: .3rem;
}

/* ─── Map ─── */
.np-map-card { padding: .85rem !important; }

.np-map-link {
  font-size: .75rem;
  font-weight: 700;
  color: rgb(100 116 139);
  text-decoration: none;
  transition: color .12s;
}
.np-map-link:hover { color: rgb(226 232 240); }

.np-map-wrap {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  height: 220px;
  background: rgba(5,10,20,.8);
}

.np-map-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  pointer-events: none;
}

.np-map-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: .85rem;
  background: linear-gradient(to top, rgba(5,10,20,.7) 0%, transparent 60%);
}

.np-map-open-btn {
  display: inline-flex;
  align-items: center;
  border-radius: 10px;
  padding: .45rem 1rem;
  font-size: .78rem;
  font-weight: 700;
  color: #fff;
  text-decoration: none;
  transition: filter .15s;
}
.np-map-open-btn:hover { filter: brightness(1.15); }

/* ─── Misc ─── */
.np-empty {
  font-size: .85rem;
  color: rgb(100 116 139);
  padding: .5rem 0;
}

.np-skeletons { display: grid; gap: .35rem; }

.np-hero-skeleton {
  height: 200px;
  border-radius: 20px;
}

.np-stats-skeleton {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: .5rem;
}

/* ─── Responsive ─── */
@media (max-width: 860px) {
  .np-stats { grid-template-columns: repeat(3, 1fr); }
  .np-stats-skeleton { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 560px) {
  .np-stats { grid-template-columns: repeat(2, 1fr); }
  .np-stats-skeleton { grid-template-columns: repeat(2, 1fr); }
  .np-hero { min-height: 180px; }
  .np-icon { width: 54px; height: 54px; font-size: 1.1rem; }
}
</style>
