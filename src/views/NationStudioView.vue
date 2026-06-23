<script setup>
import {computed, onMounted, reactive, ref, watch} from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '../config.site.js'
import NationActivityFeed from '../features/nations/components/NationActivityFeed.vue'
import NationMediaSlotCard from '../features/nations/components/NationMediaSlotCard.vue'
import NationStudioPreview from '../features/nations/components/NationStudioPreview.vue'
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
import { depositNationTreasury, getNationTopDonors, getNationTreasuryTransactions, withdrawNationTreasury } from '../services/nationStatsApi'
import { useAuthStore } from '../stores/authStore'
import { formatNumber, formatRoleLabel, formatRecruitmentLabel } from '../utils/formatters'

const { t } = useI18n()
const auth = useAuthStore()
const MIN_CREATE_NATION_BALANCE = 300_000

const loading = ref(true)
const saving = ref(false)
const actionLoading = ref(false)
const activityLoading = ref(true)
const error = ref('')
const success = ref('')
const nation = ref(null)
const activity = ref([])
const treasuryLoading = ref(true)
const donorsLoading = ref(true)
const transactions = ref([])
const donors = ref([])
const memberSearch = ref('')

const treasuryForm = reactive({
  deposit_amount: 1000,
  deposit_comment: '',
  withdraw_amount: 1000,
  withdraw_comment: '',
})

const createForm = reactive({
  slug: '',
  title: '',
  tag: '',
  short_description: '',
  description: '',
  accent_color: '#6d5df6',
  recruitment_policy: 'request',
  is_public: true,
})

const editForm = reactive({
  slug: '',
  title: '',
  tag: '',
  short_description: '',
  description: '',
  accent_color: '#6d5df6',
  recruitment_policy: 'request',
  is_public: true,
})

const selectedFiles = reactive({
  icon: null,
  banner: null,
  background: null,
})

const uploadState = reactive({
  icon: false,
  banner: false,
  background: false,
})

const isEditMode = computed(() => Boolean(nation.value))
const viewerRole = computed(() => nation.value?.viewer_role || null)
const canManage = computed(() => Boolean(nation.value?.viewer_can_manage))
const canTransferLeadership = computed(() => viewerRole.value === 'leader')
const isReadOnlyMember = computed(() => isEditMode.value && !canManage.value)

const filteredMembers = computed(() => {
  const items = Array.isArray(nation.value?.members) ? nation.value.members : []
  const q = memberSearch.value.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => {
    const siteLogin = String(item.site_login || '').toLowerCase()
    const nickname = String(item.minecraft_nickname || '').toLowerCase()
    return siteLogin.includes(q) || nickname.includes(q)
  })
})

const assetUrls = computed(() => ({
  icon: nation.value?.assets?.icon_url || nation.value?.assets?.icon_preview_url || '',
  banner: nation.value?.assets?.banner_url || nation.value?.assets?.banner_preview_url || '',
  background: nation.value?.assets?.background_url || nation.value?.assets?.background_preview_url || '',
}))

const publicNationUrl = computed(() => (nation.value?.slug ? `/nation/${nation.value.slug}` : ''))
const allianceSummary = computed(() => nation.value?.alliance_summary || null)

const capitalMapUrl = computed(() => {
  const n = nation.value
  if (n?.capital_x == null || n?.capital_z == null) return null
  const world = n.capital_world || 'world'
  return `${siteConfig.bluemapUrl}/#${world}:${n.capital_x}:64:${n.capital_z}:150:0:0:0:0:flat`
})

function formatAllianceType(value) {
  switch (String(value || '').toLowerCase()) {
    case 'nato':
      return t('allianceHub.typeNato') || 'Военный блок'
    case 'economic':
      return t('allianceHub.typeEconomic') || 'Экономический союз'
    case 'un':
      return t('allianceHub.typeUn') || 'Политический союз'
    default:
      return t('allianceHub.typeDefault') || 'Альянс'
  }
}


function txLabel(item) {
  const type = String(item?.transaction_type || '').toLowerCase()
  if (type === 'player_donation') return `${t('nationStudio.txPlayerDonation')} ${item?.metadata_json?.minecraft_nickname || ''}`.trim()
  if (type === 'deposit') return t('nationStudio.txDeposit')
  if (type === 'withdraw') return t('nationStudio.txWithdraw')
  if (type === 'alliance_transfer_out') return t('nationStudio.txAllianceOut')
  if (type === 'alliance_transfer_in') return t('nationStudio.txAllianceIn')
  if (type === 'alliance_fee_income') return t('nationStudio.txAllianceFee')
  return item?.transaction_type || t('nationStudio.txOperation')
}

function hydrateForms(payload) {
  nation.value = payload

  if (!payload) return

  editForm.slug = payload.slug || ''
  editForm.title = payload.title || ''
  editForm.tag = payload.tag || ''
  editForm.short_description = payload.short_description || ''
  editForm.description = payload.description || ''
  editForm.accent_color = payload.accent_color || '#6d5df6'
  editForm.recruitment_policy = payload.recruitment_policy || 'request'
  editForm.is_public = Boolean(payload.is_public)
}

async function loadNation() {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await getMyNation(auth.accessToken)
    hydrateForms(payload)
  } catch (err) {
    nation.value = null
    if (String(err?.message || '').toLowerCase().includes('not found')) {
      error.value = ''
    } else {
      error.value = err.message || t('nationStudio.loadError')
    }
  } finally {
    loading.value = false
  }
}

async function loadActivity() {
  activityLoading.value = true
  try {
    const payload = await getMyNationActivity(auth.accessToken)
    activity.value = Array.isArray(payload?.items) ? payload.items : []
  } catch {
    activity.value = []
    transactions.value = []
    donors.value = []
  } finally {
    activityLoading.value = false
  }
}


async function loadTreasury() {
  if (!nation.value?.slug) {
    transactions.value = []
    treasuryLoading.value = false
    return
  }
  treasuryLoading.value = true
  try {
    const payload = await getNationTreasuryTransactions(nation.value.slug, auth.accessToken)
    transactions.value = payload?.items || []
  } catch {
    transactions.value = []
  } finally {
    treasuryLoading.value = false
  }
}

async function loadDonors() {
  if (!nation.value?.slug) {
    donors.value = []
    donorsLoading.value = false
    return
  }
  donorsLoading.value = true
  try {
    const payload = await getNationTopDonors(nation.value.slug, auth.accessToken)
    donors.value = payload?.items || []
  } catch {
    donors.value = []
  } finally {
    donorsLoading.value = false
  }
}

async function refreshTreasuryBlocks() {
  await Promise.all([loadTreasury(), loadDonors(), loadActivity(), loadNation()])
}

async function submitDeposit() {
  if (!nation.value?.slug) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await depositNationTreasury(auth.accessToken, nation.value.slug, {
      amount: treasuryForm.deposit_amount,
      comment: treasuryForm.deposit_comment || null,
    })
    success.value = t('nationStudio.depositSuccess')
    await refreshTreasuryBlocks()
  } catch (err) {
    error.value = err.message || t('nationStudio.depositError')
  } finally {
    saving.value = false
  }
}

async function submitWithdraw() {
  if (!nation.value?.slug) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await withdrawNationTreasury(auth.accessToken, nation.value.slug, {
      amount: treasuryForm.withdraw_amount,
      comment: treasuryForm.withdraw_comment || null,
    })
    success.value = t('nationStudio.withdrawSuccess')
    await refreshTreasuryBlocks()
  } catch (err) {
    error.value = err.message || t('nationStudio.withdrawError')
  } finally {
    saving.value = false
  }
}

async function submitCreate() {
  saving.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await createNation(auth.accessToken, {
      slug: createForm.slug,
      title: createForm.title,
      tag: createForm.tag,
      short_description: createForm.short_description || null,
      description: createForm.description || null,
      accent_color: createForm.accent_color || null,
      recruitment_policy: createForm.recruitment_policy,
      is_public: createForm.is_public,
    })

    hydrateForms(payload)
    success.value = t('nationStudio.created')
    await Promise.all([loadActivity(), loadTreasury(), loadDonors()])
  } catch (err) {
    error.value = err.message || t('nationStudio.createError')
  } finally {
    saving.value = false
  }
}

async function submitUpdate() {
  saving.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await updateMyNation(auth.accessToken, {
      slug: editForm.slug,
      title: editForm.title,
      tag: editForm.tag,
      short_description: editForm.short_description || null,
      description: editForm.description || null,
      accent_color: editForm.accent_color || null,
      recruitment_policy: editForm.recruitment_policy,
      is_public: editForm.is_public,
    })

    hydrateForms(payload)
    success.value = t('nationStudio.saved')
    await Promise.all([loadActivity(), loadTreasury(), loadDonors()])
  } catch (err) {
    error.value = err.message || t('nationStudio.saveError')
  } finally {
    saving.value = false
  }
}

function onFileSelected(slot, file) {
  selectedFiles[slot] = file || null
}

async function uploadSelected(slot) {
  const file = selectedFiles[slot]
  if (!file) return

  uploadState[slot] = true
  error.value = ''
  success.value = ''

  try {
    let payload = null

    if (slot === 'icon') payload = await uploadNationIcon(auth.accessToken, file)
    if (slot === 'banner') payload = await uploadNationBanner(auth.accessToken, file)
    if (slot === 'background') payload = await uploadNationBackground(auth.accessToken, file)

    selectedFiles[slot] = null
    if (payload) hydrateForms(payload)
    success.value = t('nationStudio.imageUpdated')
    await loadActivity()
  } catch (err) {
    error.value = err.message || t('nationStudio.imageUploadError')
  } finally {
    uploadState[slot] = false
  }
}

async function removeAsset(slot) {
  uploadState[slot] = true
  error.value = ''
  success.value = ''

  try {
    let payload = null

    if (slot === 'icon') payload = await deleteNationIcon(auth.accessToken)
    if (slot === 'banner') payload = await deleteNationBanner(auth.accessToken)
    if (slot === 'background') payload = await deleteNationBackground(auth.accessToken)

    selectedFiles[slot] = null
    if (payload) hydrateForms(payload)
    success.value = t('nationStudio.imageDeleted')
    await loadActivity()
  } catch (err) {
    error.value = err.message || t('nationStudio.imageDeleteError')
  } finally {
    uploadState[slot] = false
  }
}

async function promoteToOfficer(userId) {
  actionLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await updateNationMemberRole(auth.accessToken, nation.value.slug, userId, 'officer')
    hydrateForms(payload)
    success.value = t('nationStudio.roleUpdated')
    await loadActivity()
  } catch (err) {
    error.value = err.message || t('nationStudio.roleUpdateError')
  } finally {
    actionLoading.value = false
  }
}

async function demoteToMember(userId) {
  actionLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await updateNationMemberRole(auth.accessToken, nation.value.slug, userId, 'member')
    hydrateForms(payload)
    success.value = t('nationStudio.roleUpdated')
    await loadActivity()
  } catch (err) {
    error.value = err.message || t('nationStudio.roleUpdateError')
  } finally {
    actionLoading.value = false
  }
}

async function kickMember(userId) {
  const confirmed = window.confirm(t('nationStudio.kickConfirm'))
  if (!confirmed) return

  actionLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await removeNationMember(auth.accessToken, nation.value.slug, userId)
    hydrateForms(payload)
    success.value = t('nationStudio.kicked')
    await loadActivity()
  } catch (err) {
    error.value = err.message || t('nationStudio.kickError')
  } finally {
    actionLoading.value = false
  }
}

const copiedCommand = ref(false)

function copyCommand(text) {
  navigator.clipboard.writeText(text).then(() => {
    copiedCommand.value = true
    setTimeout(() => { copiedCommand.value = false }, 1800)
  })
}

const editingPrefixUserId = ref(null)
const editingPrefixValue = ref('')

function startEditPrefix(member) {
  editingPrefixUserId.value = member.user_id
  editingPrefixValue.value = member.custom_prefix || ''
}

function cancelEditPrefix() {
  editingPrefixUserId.value = null
  editingPrefixValue.value = ''
}

function canSetPrefix(member) {
  if (!canManage.value) return false
  if (member.user_id === auth.state.user?.id && viewerRole.value !== 'leader') return false
  if (viewerRole.value === 'leader') return true
  return member.role === 'member'
}

async function savePrefix(userId) {
  actionLoading.value = true
  error.value = ''
  success.value = ''
  try {
    const value = editingPrefixValue.value.trim() || null
    const payload = await updateNationMemberPrefix(auth.accessToken, nation.value.slug, userId, value)
    hydrateForms(payload)
    success.value = t('nationStudio.prefixUpdated')
    editingPrefixUserId.value = null
    editingPrefixValue.value = ''
  } catch (err) {
    error.value = err.message || t('nationStudio.prefixUpdateError')
  } finally {
    actionLoading.value = false
  }
}

async function approveRequest(requestId) {
  actionLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await approveNationRequest(auth.accessToken, nation.value.slug, requestId)
    hydrateForms(payload)
    success.value = t('nationStudio.requestApproved')
    await loadActivity()
  } catch (err) {
    error.value = err.message || t('nationStudio.requestApproveError')
  } finally {
    actionLoading.value = false
  }
}

async function rejectRequest(requestId) {
  actionLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await rejectNationRequest(auth.accessToken, nation.value.slug, requestId)
    hydrateForms(payload)
    success.value = t('nationStudio.requestRejected')
    await loadActivity()
  } catch (err) {
    error.value = err.message || t('nationStudio.requestRejectError')
  } finally {
    actionLoading.value = false
  }
}

async function passLeadership(userId) {
  const confirmed = window.confirm(t('nationStudio.transferLeadershipConfirm'))
  if (!confirmed) return

  actionLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await transferNationLeadership(auth.accessToken, nation.value.slug, userId)
    hydrateForms(payload)
    success.value = t('nationStudio.leadershipTransferred')
    await loadActivity()
  } catch (err) {
    error.value = err.message || t('nationStudio.leadershipTransferError')
  } finally {
    actionLoading.value = false
  }
}

async function handleLeaveNation() {
  const confirmed = window.confirm(t('nationStudio.leaveConfirm'))
  if (!confirmed) return

  actionLoading.value = true
  error.value = ''
  success.value = ''

  try {
    await leaveMyNation(auth.accessToken)
    nation.value = null
    success.value = t('nationStudio.left')
    activity.value = []
    transactions.value = []
    donors.value = []
  } catch (err) {
    error.value = err.message || t('nationStudio.leaveError')
  } finally {
    actionLoading.value = false
  }
}

async function handleDisbandNation() {
  const name = nation.value?.title || t('nationStudio.defaultNationName')
  const confirmed = window.confirm(t('nationStudio.disbandConfirm', { name }))
  if (!confirmed) return

  actionLoading.value = true
  error.value = ''
  success.value = ''

  try {
    await disbandMyNation(auth.accessToken)
    nation.value = null
    success.value = t('nationStudio.disbanded')
    activity.value = []
    transactions.value = []
    donors.value = []
  } catch (err) {
    error.value = err.message || t('nationStudio.disbandError')
  } finally {
    actionLoading.value = false
  }
}

onMounted(async () => {
  await loadNation()
  await Promise.all([loadActivity(), loadTreasury(), loadDonors()])
})
watch(error, (value) => { if (value) toastError(value) })
watch(success, (value) => { if (value) toastSuccess(value) })
</script>

<template>
  <section class="py-8 md:py-10">
    <div class="container-shell space-y-5">
      <section class="surface-card p-5 md:p-7">
        <div class="max-w-3xl">
          <div class="section-kicker !mb-2">{{ isEditMode ? t('nationStudio.editKicker') : t('nationStudio.createKicker') }}</div>
          <h1 class="text-3xl font-black tracking-tight text-slate-50 md:text-4xl">
            {{ isEditMode ? t('nationStudio.editTitle') : t('nationStudio.createTitle') }}
          </h1>
          <p class="mt-4 text-sm leading-7 text-slate-400 md:text-[15px]">
            {{ t('nationStudio.headerDesc') }}
          </p>
        </div>
      </section>


      <div v-if="loading" class="grid gap-5 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <div class="skeleton h-[540px] rounded-[28px]"></div>
        <div class="space-y-5">
          <div class="skeleton h-[260px] rounded-[28px]"></div>
          <div class="skeleton h-[560px] rounded-[28px]"></div>
        </div>
      </div>

      <div v-else-if="!isEditMode" class="grid gap-5 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <aside class="space-y-5">
          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.nextStepsKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.createTitle') }}</h2>
            <p class="mt-3 text-sm leading-7 text-slate-400">
              {{ t('nationStudio.nextStepsDesc') }}
            </p>
          </section>
        </aside>

        <section class="surface-card p-5 md:p-6">
          <div class="section-kicker !mb-2">{{ t('nationStudio.createKicker') }}</div>
          <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.mainDataTitle') }}</h2>

          <div class="mt-5 rounded-[20px] border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-amber-100">
            {{ t('nationStudio.balanceWarning', { amount: formatNumber(MIN_CREATE_NATION_BALANCE) }) }}
          </div>

          <div class="mt-5 grid gap-4">
            <input v-model="createForm.title" class="input rounded-2xl" :placeholder="t('nationStudio.titleLabel')" />
            <input v-model="createForm.slug" class="input rounded-2xl" :placeholder="t('nationStudio.slugLabel')" />
            <input v-model="createForm.tag" class="input rounded-2xl" :placeholder="t('nationStudio.tagLabel')" />
            <input v-model="createForm.short_description" class="input rounded-2xl" :placeholder="t('nationStudio.shortDescLabel')" />
            <textarea v-model="createForm.description" class="textarea rounded-2xl" rows="6" :placeholder="t('nationStudio.descLabel')"></textarea>
            <input v-model="createForm.accent_color" type="color" class="h-14 w-24 cursor-pointer rounded-2xl border border-white/10 bg-transparent p-1" />

            <select v-model="createForm.recruitment_policy" class="select rounded-2xl">
              <option value="open">{{ t('nationStudio.recruitOpen') }}</option>
              <option value="request">{{ t('nationStudio.recruitRequest') }}</option>
              <option value="invite_only">{{ t('nationStudio.recruitInvite') }}</option>
            </select>

            <label class="panel-card flex items-center justify-between gap-4 p-4">
              <div>
                <p class="font-semibold text-slate-100">{{ t('nationStudio.isPublicLabel') }}</p>
                <p class="mt-1 text-sm leading-6 text-slate-400">{{ t('nationStudio.isPublicDesc') }}</p>
              </div>
              <input v-model="createForm.is_public" type="checkbox" class="toggle" />
            </label>

            <button type="button" class="btn btn-primary" :disabled="saving" @click="submitCreate">
              <span v-if="saving" class="spinner"></span>
              <span v-else>{{ t('nationStudio.submitCreate') }}</span>
            </button>
          </div>
        </section>
      </div>

      <div v-else-if="isReadOnlyMember" class="grid gap-5 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <aside class="space-y-5">
          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.yourRoleKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.memberModeTitle') }}</h2>
            <p class="mt-3 text-sm leading-7 text-slate-400">
              {{ t('nationStudio.memberModeDesc') }}
            </p>

            <div class="mt-5 grid gap-3">
              <div class="action-card">
                <p class="metric-label">{{ t('nationStudio.nationLabel') }}</p>
                <p class="mt-2 text-sm font-semibold text-slate-100">{{ nation.title }}</p>
                <p class="mt-2 text-sm leading-6 text-slate-400">[{{ nation.tag }}] · {{ nation.short_description || t('nationStudio.noDescYet') }}</p>
              </div>
              <div class="action-card">
                <p class="metric-label">{{ t('nationStudio.roleLabel') }}</p>
                <p class="mt-2 text-sm font-semibold text-slate-100">{{ formatRoleLabel(viewerRole) }}</p>
              </div>
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <RouterLink :to="publicNationUrl" class="btn btn-primary">{{ t('nationStudio.publicPage') }}</RouterLink>
              <button type="button" class="btn btn-outline" :disabled="actionLoading" @click="handleLeaveNation">
                {{ t('nationStudio.leaveBtn') }}
              </button>
            </div>
          </section>

          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.allianceKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">
              {{ allianceSummary ? allianceSummary.title : t('nationStudio.allianceDefaultTitle') }}
            </h2>

            <div v-if="!allianceSummary" class="action-card mt-5 text-sm text-slate-400">
              {{ t('nationStudio.noAlliance') }}
            </div>

            <div v-else class="mt-5 space-y-3">
              <div class="action-card">
                <p class="font-semibold text-slate-100">[{{ allianceSummary.tag }}] · {{ formatAllianceType(allianceSummary.alliance_type) }}</p>
                <p class="mt-2 text-sm leading-6 text-slate-400">
                  {{ allianceSummary.description || t('nationStudio.noAllianceDesc') }}
                </p>
              </div>
              <RouterLink to="/alliances" class="btn btn-outline">{{ t('nationStudio.openAllianceCenter') }}</RouterLink>
            </div>
          </section>
        </aside>

        <div class="space-y-5">
          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.membersKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.membersTitle') }}</h2>

            <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div v-for="member in nation.members" :key="member.user_id" class="action-card">
                <p class="font-semibold text-slate-100">{{ member.minecraft_nickname || member.site_login }}</p>
                <p class="mt-1 text-sm text-slate-400">@{{ member.site_login }}</p>
                <p class="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  {{ formatRoleLabel(member.role) }}
                </p>
              </div>
            </div>
          </section>

          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.historyKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.historyTitle') }}</h2>
            <div class="mt-5">
              <NationActivityFeed :items="activity" :loading="activityLoading" />
            </div>
          </section>

          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.treasuryKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.recentOpsTitle') }}</h2>

            <div v-if="treasuryLoading" class="mt-5 space-y-3">
              <div class="skeleton h-16 rounded-[22px]"></div>
              <div class="skeleton h-16 rounded-[22px]"></div>
            </div>

            <div v-else-if="!transactions.length" class="action-card mt-5 text-sm text-slate-400">
              {{ t('nationStudio.noOps') }}
            </div>

            <div v-else class="mt-5 space-y-3">
              <div v-for="item in transactions.slice(0, 6)" :key="item.id" class="action-card">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-semibold text-slate-100">{{ txLabel(item) }}</p>
                  <span class="footer-chip">{{ formatNumber(item.net_amount) }}</span>
                </div>
                <p class="mt-2 text-sm leading-6 text-slate-400">{{ item.comment || t('nationStudio.noComment') }}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div v-else class="grid gap-5 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <div v-if="viewerRole === 'leader' && !nation.capital_world" class="xl:col-span-2 rounded-[20px] border border-violet-500/30 bg-violet-500/10 px-5 py-4 text-sm leading-7 text-violet-100">
          <p class="font-bold text-violet-200">{{ t('nationStudio.capitalNotSet') }}</p>
          <p class="mt-1 text-slate-300">
            {{ t('nationStudio.capitalHint') }}
            <span class="relative inline-block">
              <code
                class="cursor-pointer select-none rounded bg-black/40 px-1.5 py-0.5 font-mono text-violet-300 transition-colors hover:bg-black/60 hover:text-violet-200"
                :title="t('nationStudio.copyTooltip')"
                @click="copyCommand('/nsetcapital')"
              >/nsetcapital</code>
              <span
                v-if="copiedCommand"
                class="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 shadow-lg"
              >{{ t('nationStudio.copied') }}</span>
            </span>
            {{ t('nationStudio.capitalHint2') }}
            {{ t('nationStudio.capitalBonus') }}
          </p>
        </div>

        <aside class="space-y-5">
          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.previewKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.publicPage') }}</h2>

            <div class="mt-5">
              <NationStudioPreview :nation="nation" />
            </div>

            <div class="mt-5 flex flex-wrap gap-3">
              <RouterLink :to="publicNationUrl" class="btn btn-primary">{{ t('nationStudio.openPage') }}</RouterLink>
            </div>
          </section>

          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.allianceKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">
              {{ allianceSummary ? allianceSummary.title : t('nationStudio.allianceDefaultTitle') }}
            </h2>

            <div v-if="!allianceSummary" class="action-card mt-5 text-sm text-slate-400">
              {{ t('nationStudio.noAllianceFull') }}
            </div>

            <div v-else class="mt-5 space-y-4">
              <div class="action-card">
                <p class="font-semibold text-slate-100">[{{ allianceSummary.tag }}] · {{ formatAllianceType(allianceSummary.alliance_type) }}</p>
                <p class="mt-2 text-sm leading-6 text-slate-400">
                  {{ allianceSummary.description || t('nationStudio.noAllianceDesc') }}
                </p>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="metric-card text-center">
                  <p class="metric-value !text-[1.12rem]">{{ allianceSummary.members_count }}</p>
                  <p class="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{{ t('nationStudio.nationsLabel') }}</p>
                </div>
                <div class="metric-card text-center">
                  <p class="metric-value !text-[1.12rem]">{{ allianceSummary.transfer_fee_percent }}%</p>
                  <p class="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{{ t('nationStudio.feeLabel') }}</p>
                </div>
              </div>

              <div class="grid gap-3">
                <div v-for="member in allianceSummary.members" :key="member.nation_id" class="action-card">
                  <p class="font-semibold text-slate-100">{{ member.title }}</p>
                  <p class="mt-2 text-sm leading-6 text-slate-400">[{{ member.tag }}]</p>
                </div>
              </div>
            </div>

            <RouterLink to="/alliances" class="btn btn-primary mt-5">
              {{ t('nationStudio.openAllianceCenter') }}
            </RouterLink>
          </section>

          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.mediaKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.mediaTitle') }}</h2>

            <div class="mt-5 space-y-4">
              <NationMediaSlotCard
                :title="t('nationStudio.iconTitle')"
                :subtitle="t('nationStudio.iconSubtitle')"
                slot-name="icon"
                variant="icon"
                :preview-url="assetUrls.icon"
                :selected-file-name="selectedFiles.icon?.name || ''"
                :uploading="uploadState.icon"
                :has-asset="Boolean(assetUrls.icon)"
                :recommendation="t('nationStudio.iconRec')"
                @select-file="onFileSelected('icon', $event)"
                @upload="uploadSelected('icon')"
                @remove="removeAsset('icon')"
              />

              <NationMediaSlotCard
                :title="t('nationStudio.bannerTitle')"
                :subtitle="t('nationStudio.bannerSubtitle')"
                slot-name="banner"
                variant="banner"
                :preview-url="assetUrls.banner"
                :selected-file-name="selectedFiles.banner?.name || ''"
                :uploading="uploadState.banner"
                :has-asset="Boolean(assetUrls.banner)"
                :recommendation="t('nationStudio.bannerRec')"
                @select-file="onFileSelected('banner', $event)"
                @upload="uploadSelected('banner')"
                @remove="removeAsset('banner')"
              />

              <NationMediaSlotCard
                :title="t('nationStudio.backgroundTitle')"
                :subtitle="t('nationStudio.backgroundSubtitle')"
                slot-name="background"
                variant="background"
                :preview-url="assetUrls.background"
                :selected-file-name="selectedFiles.background?.name || ''"
                :uploading="uploadState.background"
                :has-asset="Boolean(assetUrls.background)"
                :recommendation="t('nationStudio.backgroundRec')"
                @select-file="onFileSelected('background', $event)"
                @upload="uploadSelected('background')"
                @remove="removeAsset('background')"
              />
            </div>
          </section>

          <section v-if="capitalMapUrl" class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.capitalKicker') }}</div>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-xl font-black text-slate-50">{{ t('nationStudio.mapTitle') }}</h2>
              <a :href="capitalMapUrl" target="_blank" rel="noreferrer" class="text-sm text-violet-400 hover:text-violet-300">↗ {{ t('nationStudio.openMap') }}</a>
            </div>
            <p class="mt-1 text-sm text-slate-400">
              {{ nation.capital_world || 'world' }} · {{ nation.capital_x }}, {{ nation.capital_z }}
            </p>
            <div class="relative mt-4 overflow-hidden rounded-[18px] border border-white/10" style="aspect-ratio:16/9">
              <iframe
                :src="capitalMapUrl"
                class="pointer-events-none h-full w-full"
                title="BlueMap"
                allowfullscreen
                loading="lazy"
                referrerpolicy="no-referrer"
              ></iframe>
              <a
                :href="capitalMapUrl"
                target="_blank"
                rel="noreferrer"
                class="absolute inset-0 flex items-end justify-center pb-4"
              >
                <span class="rounded-xl bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg hover:bg-violet-500">{{ t('nationStudio.openMap') }}</span>
              </a>
            </div>
          </section>
        </aside>

        <div class="space-y-5">
          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.paramsKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.paramsTitle') }}</h2>

            <div class="mt-5 grid gap-4">
              <input v-model="editForm.title" class="input rounded-2xl" :placeholder="t('nationStudio.titleLabel')" />
              <input v-model="editForm.slug" class="input rounded-2xl" :placeholder="t('nationStudio.slugLabel')" />
              <input v-model="editForm.tag" class="input rounded-2xl" :placeholder="t('nationStudio.tagLabel')" />
              <input v-model="editForm.short_description" class="input rounded-2xl" :placeholder="t('nationStudio.shortDescLabel')" />
              <textarea v-model="editForm.description" class="textarea rounded-2xl" rows="6" :placeholder="t('nationStudio.descLabel')"></textarea>
              <input v-model="editForm.accent_color" type="color" class="h-14 w-24 cursor-pointer rounded-2xl border border-white/10 bg-transparent p-1" />

              <select v-model="editForm.recruitment_policy" class="select rounded-2xl">
                <option value="open">{{ formatRecruitmentLabel('open') }}</option>
                <option value="request">{{ formatRecruitmentLabel('request') }}</option>
                <option value="invite_only">{{ formatRecruitmentLabel('invite_only') }}</option>
              </select>

              <label class="panel-card flex items-center justify-between gap-4 p-4">
                <div>
                  <p class="font-semibold text-slate-100">{{ t('nationStudio.isPublicLabel') }}</p>
                  <p class="mt-1 text-sm leading-6 text-slate-400">{{ t('nationStudio.isPublicCatalogDesc') }}</p>
                </div>
                <input v-model="editForm.is_public" type="checkbox" class="toggle" />
              </label>

              <div class="mt-2 flex flex-wrap gap-3">
                <button type="button" class="btn btn-primary" :disabled="saving" @click="submitUpdate">
                  <span v-if="saving" class="spinner"></span>
                  <span v-else>{{ t('nationStudio.submitSave') }}</span>
                </button>

                <button
                  v-if="viewerRole !== 'leader'"
                  type="button"
                  class="btn btn-outline"
                  :disabled="actionLoading"
                  @click="handleLeaveNation"
                >
                  {{ t('nationStudio.leaveBtn') }}
                </button>
              </div>

              <div v-if="viewerRole === 'leader'" class="mt-6 rounded-[18px] border border-red-500/20 bg-red-500/5 p-4">
                <p class="text-sm font-semibold text-red-300">{{ t('nationStudio.dangerZone') }}</p>
                <p class="mt-1 text-sm leading-6 text-slate-400">
                  {{ t('nationStudio.disbandWarning') }}
                </p>
                <button
                  type="button"
                  class="btn btn-outline mt-3 border-red-500/40 text-red-400 hover:border-red-500 hover:bg-red-500/10"
                  :disabled="actionLoading"
                  @click="handleDisbandNation"
                >
                  {{ t('nationStudio.disbandBtn') }}
                </button>
              </div>
            </div>
          </section>


          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.treasuryKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.treasuryManageTitle') }}</h2>

            <div class="mt-5 grid gap-4 md:grid-cols-2">
              <div class="action-card">
                <p class="font-semibold text-slate-100">{{ t('nationStudio.depositLabel') }}</p>
                <input v-model="treasuryForm.deposit_amount" type="number" class="input rounded-2xl mt-3" :placeholder="t('nationStudio.amountPlaceholder')" />
                <textarea v-model="treasuryForm.deposit_comment" class="textarea rounded-2xl mt-3" rows="3" :placeholder="t('nationStudio.commentLabel')"></textarea>
                <button type="button" class="btn btn-primary mt-3" :disabled="saving" @click="submitDeposit">
                  {{ t('nationStudio.deposit') }}
                </button>
              </div>

              <div class="action-card">
                <p class="font-semibold text-slate-100">{{ t('nationStudio.withdrawLabel') }}</p>
                <input v-model="treasuryForm.withdraw_amount" type="number" class="input rounded-2xl mt-3" :placeholder="t('nationStudio.amountPlaceholder')" />
                <textarea v-model="treasuryForm.withdraw_comment" class="textarea rounded-2xl mt-3" rows="3" :placeholder="t('nationStudio.commentLabel')"></textarea>
                <button type="button" class="btn btn-outline mt-3" :disabled="saving" @click="submitWithdraw">
                  {{ t('nationStudio.withdraw') }}
                </button>
              </div>
            </div>
          </section>

          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.donorsKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.donorsTitle') }}</h2>

            <div v-if="donorsLoading" class="mt-5 space-y-3">
              <div class="skeleton h-16 rounded-[22px]"></div>
              <div class="skeleton h-16 rounded-[22px]"></div>
            </div>

            <div v-else-if="!donors.length" class="action-card mt-5 text-sm text-slate-400">
              {{ t('nationStudio.noDonors') }}
            </div>

            <div v-else class="mt-5 grid gap-3 md:grid-cols-2">
              <div v-for="item in donors" :key="item.minecraft_nickname" class="action-card">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-semibold text-slate-100">{{ item.minecraft_nickname }}</p>
                  <span class="footer-chip">{{ formatNumber(item.total_amount) }}</span>
                </div>
                <p class="mt-2 text-sm leading-6 text-slate-400">{{ t('nationStudio.donationsCount') }}: {{ formatNumber(item.donations_count) }}</p>
              </div>
            </div>
          </section>

          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.treasuryLogKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.recentOpsTitle') }}</h2>

            <div v-if="treasuryLoading" class="mt-5 space-y-3">
              <div class="skeleton h-20 rounded-[22px]"></div>
              <div class="skeleton h-20 rounded-[22px]"></div>
            </div>

            <div v-else-if="!transactions.length" class="action-card mt-5 text-sm text-slate-400">
              {{ t('nationStudio.noOps') }}
            </div>

            <div v-else class="mt-5 space-y-3">
              <div v-for="item in transactions" :key="item.id" class="action-card">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <p class="font-semibold text-slate-100">{{ txLabel(item) }}</p>
                  <span class="footer-chip">{{ formatNumber(item.net_amount) }}</span>
                </div>
                <p class="mt-2 text-sm leading-6 text-slate-400">{{ item.comment || t('nationStudio.noComment') }}</p>
              </div>
            </div>
          </section>

          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.membersKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.teamTitle') }}</h2>

            <div class="mt-5">
              <input v-model="memberSearch" class="input rounded-2xl" :placeholder="t('nationStudio.membersSearch')" />
            </div>

            <div class="mt-5 grid gap-3">
              <article
                v-for="member in filteredMembers"
                :key="member.user_id"
                class="action-card"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate font-semibold text-slate-100">{{ member.minecraft_nickname || member.site_login }}</p>
                    <p class="mt-1 text-sm text-slate-400">@{{ member.site_login }}</p>
                    <p class="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      {{ formatRoleLabel(member.role) }}
                    </p>
                    <p v-if="member.custom_prefix" class="mt-1 text-xs text-violet-400">
                      {{ t('nationStudio.prefixLabel') }}: {{ member.custom_prefix }}
                    </p>
                  </div>

                  <div
                    v-if="viewerRole === 'leader' && member.user_id === auth.state.user?.id"
                    class="flex flex-wrap gap-2"
                  >
                    <button
                      type="button"
                      class="btn btn-outline btn-sm"
                      :disabled="actionLoading"
                      @click="startEditPrefix(member)"
                    >
                      {{ t('nationStudio.prefixBtn') }}
                    </button>
                  </div>

                  <div
                    v-if="canManage && member.user_id !== auth.state.user?.id"
                    class="flex flex-wrap gap-2"
                  >
                    <button
                      v-if="member.role === 'member'"
                      type="button"
                      class="btn btn-outline btn-sm"
                      :disabled="actionLoading"
                      @click="promoteToOfficer(member.user_id)"
                    >
                      {{ t('nationStudio.makeOfficer') }}
                    </button>

                    <button
                      v-if="member.role === 'officer'"
                      type="button"
                      class="btn btn-outline btn-sm"
                      :disabled="actionLoading"
                      @click="demoteToMember(member.user_id)"
                    >
                      {{ t('nationStudio.makeMember') }}
                    </button>

                    <button
                      v-if="canSetPrefix(member)"
                      type="button"
                      class="btn btn-outline btn-sm"
                      :disabled="actionLoading"
                      @click="startEditPrefix(member)"
                    >
                      {{ t('nationStudio.prefixBtn') }}
                    </button>

                    <button
                      v-if="canTransferLeadership"
                      type="button"
                      class="btn btn-outline btn-sm"
                      :disabled="actionLoading"
                      @click="passLeadership(member.user_id)"
                    >
                      {{ t('nationStudio.transfer') }}
                    </button>

                    <button
                      v-if="member.role !== 'leader'"
                      type="button"
                      class="btn btn-primary btn-sm"
                      :disabled="actionLoading"
                      @click="kickMember(member.user_id)"
                    >
                      {{ t('nationStudio.kick') }}
                    </button>
                  </div>
                </div>

                <div v-if="editingPrefixUserId === member.user_id" class="mt-3 flex gap-2">
                  <input
                    v-model="editingPrefixValue"
                    type="text"
                    maxlength="64"
                    :placeholder="t('nationStudio.prefixPlaceholder')"
                    class="input input-sm flex-1 bg-slate-800 text-slate-100 placeholder-slate-500"
                    @keydown.enter="savePrefix(member.user_id)"
                    @keydown.esc="cancelEditPrefix"
                  />
                  <button type="button" class="btn btn-sm btn-primary" :disabled="actionLoading" @click="savePrefix(member.user_id)">{{ t('nationStudio.submitSave') }}</button>
                  <button type="button" class="btn btn-sm btn-ghost" @click="cancelEditPrefix">{{ t('nationStudio.cancel') }}</button>
                </div>
              </article>
            </div>
          </section>

          <section class="surface-card p-5 md:p-6">
            <div class="section-kicker !mb-2">{{ t('nationStudio.requestsKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('nationStudio.requestsTitle') }}</h2>

            <div v-if="!nation?.join_requests?.length" class="action-card mt-5 text-sm text-slate-400">
              {{ t('nationStudio.noRequests') }}
            </div>

            <div v-else class="mt-5 space-y-3">
              <article
                v-for="item in nation.join_requests"
                :key="item.id"
                class="action-card"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-semibold text-slate-100">{{ item.minecraft_nickname || item.site_login }}</p>
                    <p class="mt-2 text-sm leading-6 text-slate-400">{{ item.message || t('nationStudio.noMessage') }}</p>
                  </div>

                  <div class="mt-3 flex flex-wrap gap-2">
                    <button type="button" class="btn btn-primary btn-sm" :disabled="actionLoading" @click="approveRequest(item.id)">
                      {{ t('nationStudio.approve') }}
                    </button>
                    <button type="button" class="btn btn-outline btn-sm" :disabled="actionLoading" @click="rejectRequest(item.id)">
                      {{ t('nationStudio.reject') }}
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <NationActivityFeed
            :items="activity"
            :loading="activityLoading"
            :title="t('nationStudio.activityTitle')"
            :subtitle="t('nationStudio.activitySubtitle')"
          />
        </div>
      </div>
    </div>
  </section>
</template>



