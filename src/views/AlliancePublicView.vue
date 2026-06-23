<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AllianceProposalFeed from '../features/alliances/components/AllianceProposalFeed.vue'
import {
  applyToAlliance,
  createAllianceProposal,
  getAllianceBySlug,
  getAllianceProposals,
  getAllianceTransactions,
  leaveAlliance,
  transferAllianceFunds,
  updateAlliancePolicies,
  voteAllianceProposal,
} from '../services/alliancesApi'
import { toastError, toastSuccess } from '../services/toast'
import { useAuthStore } from '../stores/authStore'
import { formatRoleLabel } from '../utils/formatters'
import { usePageMeta } from '../composables/usePageMeta.js'

usePageMeta({
  title: 'Альянс',
  breadcrumbs: [
    { name: 'Главная', url: '/' },
    { name: 'Альянсы', url: '/alliances' },
    { name: 'Альянс' },
  ],
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const actionLoading = ref(false)
const error = ref('')
const alliance = ref(null)
const proposals = ref([])
const transactions = ref([])

const proposalForm = reactive({
  proposal_type: 'set_policy',
  title: '',
  description: '',
  payload_json: '{\n  "field": "allow_trade_bonus",\n  "value": true\n}',
})
const policyForm = reactive({
  transfer_fee_percent: 5,
  allow_internal_transfers: true,
  allow_joint_defense: true,
  allow_trade_bonus: false,
  allow_pvp_protection: false,
})
const transferForm = reactive({ to_nation_slug: '', amount: 1000, comment: '' })

const viewer = computed(() => alliance.value?.viewer || {})
const isMember = computed(() => Boolean(viewer.value?.is_member))
const canApply = computed(() => Boolean(viewer.value?.can_apply ?? viewer.value?.can_join))
const hasPending = computed(() => Boolean(viewer.value?.has_pending_application))
const canLeave = computed(() => Boolean(viewer.value?.can_leave))
const canManagePolicies = computed(() => Boolean(viewer.value?.can_manage_policies))
const canCreateProposals = computed(() => Boolean(viewer.value?.can_create_proposals))
const canVote = computed(() => Boolean(viewer.value?.can_vote))
const canTransfer = computed(() => Boolean(viewer.value?.can_transfer))
const isAuthenticated = computed(() => auth.isAuthenticated.value)
const hasNation = computed(() => Boolean(viewer.value?.has_nation))

const members = computed(() => Array.isArray(alliance.value?.members) ? alliance.value.members : [])
const memberTargets = computed(() => {
  const srcId = viewer.value?.nation_id
  return members.value.map(m => m?.nation).filter(n => n?.slug && n?.id !== srcId)
})

function typeColor(type) {
  if (type === 'nato') return '#ef4444'
  if (type === 'economic') return '#10b981'
  return '#6366f1'
}

function typeLabel(type) {
  if (type === 'nato') return 'Военный союз'
  if (type === 'economic') return 'Экономический союз'
  return 'Политический союз'
}

function money(value) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })
}

function txLabel(item) {
  const type = String(item?.transaction_type || '').toLowerCase()
  if (type === 'alliance_transfer_out') return t('allianceHub.txAllianceOut')
  if (type === 'alliance_transfer_in') return t('allianceHub.txAllianceIn')
  if (type === 'alliance_fee_income') return t('allianceHub.txAllianceFee')
  return t('allianceHub.txOther')
}

function hydrate(data) {
  policyForm.transfer_fee_percent = Number(data?.transfer_fee_percent ?? 5)
  policyForm.allow_internal_transfers = Boolean(data?.allow_internal_transfers)
  policyForm.allow_joint_defense = Boolean(data?.allow_joint_defense)
  policyForm.allow_trade_bonus = Boolean(data?.allow_trade_bonus)
  policyForm.allow_pvp_protection = Boolean(data?.allow_pvp_protection)
}

async function loadPage(slug) {
  loading.value = true
  error.value = ''
  try {
    const data = await getAllianceBySlug(slug, auth.accessToken || null)
    alliance.value = data
    hydrate(data)
    if (data?.viewer?.is_member) {
      const [pp, tp] = await Promise.all([
        getAllianceProposals(slug, auth.accessToken),
        getAllianceTransactions(slug, auth.accessToken),
      ])
      proposals.value = pp?.items || []
      transactions.value = tp?.items || []
    }
  } catch (err) {
    error.value = err.message || t('allianceHub.loadError')
  } finally {
    loading.value = false
  }
}

async function applyAction() {
  actionLoading.value = true
  try {
    await applyToAlliance(auth.accessToken, alliance.value.slug)
    toastSuccess(t('allianceHub.appliedSuccess'))
    await loadPage(alliance.value.slug)
  } catch (err) {
    toastError(err?.message || t('allianceHub.applyError'))
  } finally {
    actionLoading.value = false
  }
}

async function leaveAction() {
  actionLoading.value = true
  try {
    const result = await leaveAlliance(auth.accessToken)
    toastSuccess(t('allianceHub.leftSuccess'))
    if (result?.dissolved) router.push('/alliances')
    else await loadPage(alliance.value.slug)
  } catch (err) {
    toastError(err?.message || t('allianceHub.leaveError'))
  } finally {
    actionLoading.value = false
  }
}

async function savePolicies() {
  actionLoading.value = true
  try {
    const res = await updateAlliancePolicies(auth.accessToken, alliance.value.slug, { ...policyForm })
    alliance.value = res
    hydrate(res)
    toastSuccess(t('allianceHub.policiesSaved'))
  } catch (err) {
    toastError(err?.message || t('allianceHub.policiesError'))
  } finally {
    actionLoading.value = false
  }
}

async function createProposalAction() {
  actionLoading.value = true
  try {
    let payloadJson = {}
    try { payloadJson = proposalForm.payload_json?.trim() ? JSON.parse(proposalForm.payload_json) : {} }
    catch { throw new Error(t('allianceHub.jsonError')) }
    await createAllianceProposal(auth.accessToken, alliance.value.slug, {
      proposal_type: proposalForm.proposal_type,
      title: proposalForm.title,
      description: proposalForm.description || null,
      payload_json: payloadJson,
    })
    toastSuccess(t('allianceHub.proposalCreated'))
    await loadPage(alliance.value.slug)
  } catch (err) {
    toastError(err?.message || t('allianceHub.proposalError'))
  } finally {
    actionLoading.value = false
  }
}

async function castVote({ id, vote }) {
  actionLoading.value = true
  try {
    await voteAllianceProposal(auth.accessToken, id, { vote })
    toastSuccess(t('allianceHub.voteCast'))
    await loadPage(alliance.value.slug)
  } catch (err) {
    toastError(err?.message || t('allianceHub.voteError'))
  } finally {
    actionLoading.value = false
  }
}

async function sendTransfer() {
  actionLoading.value = true
  try {
    await transferAllianceFunds(auth.accessToken, alliance.value.slug, {
      from_nation_slug: viewer.value?.nation_slug,
      to_nation_slug: transferForm.to_nation_slug,
      amount: Number(transferForm.amount),
      comment: transferForm.comment || null,
    })
    toastSuccess(t('allianceHub.transferSent'))
    await loadPage(alliance.value.slug)
  } catch (err) {
    toastError(err?.message || t('allianceHub.transferError'))
  } finally {
    actionLoading.value = false
  }
}

watch(() => route.params.slug, s => { if (s) loadPage(s) })
onMounted(() => loadPage(route.params.slug))
</script>

<template>
  <section class="ap py-3 md:py-4 auth-page">
    <div class="container-shell max-w-[1060px] space-y-4 page-entry">

      <!-- back -->
      <RouterLink to="/alliances" class="ap-back">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        {{ t('allianceHub.backToList') }}
      </RouterLink>

      <!-- loading -->
      <template v-if="loading">
        <div class="skeleton" style="height:220px;border-radius:20px"></div>
        <div class="skeleton" style="height:140px;border-radius:14px"></div>
        <div class="skeleton" style="height:220px;border-radius:14px"></div>
      </template>

      <!-- error -->
      <div v-else-if="error" class="alert alert-error">{{ error }}</div>

      <template v-else-if="alliance">

        <!-- ─── HERO ─── -->
        <div
          class="ap-hero"
          :style="{
            borderColor: typeColor(alliance.alliance_type) + '30',
            background: `linear-gradient(160deg, ${typeColor(alliance.alliance_type)}18 0%, rgba(8,12,25,.95) 55%)`
          }"
        >
          <!-- top color bar -->
          <div class="ap-hero__topbar" :style="{ background: `linear-gradient(90deg, ${typeColor(alliance.alliance_type)}, ${typeColor(alliance.alliance_type)}55)` }"></div>

          <div class="ap-hero__inner">
            <!-- icon + name -->
            <div class="ap-hero__id">
              <div
                class="ap-hero__icon"
                :style="{ background: typeColor(alliance.alliance_type) + '20', borderColor: typeColor(alliance.alliance_type) + '50', color: typeColor(alliance.alliance_type) }"
              >
                {{ alliance.tag?.slice(0, 3).toUpperCase() }}
              </div>
              <div class="ap-hero__name-col">
                <div class="ap-hero__chips">
                  <span class="ap-chip" :style="{ color: typeColor(alliance.alliance_type), borderColor: typeColor(alliance.alliance_type) + '44', background: typeColor(alliance.alliance_type) + '15' }">
                    {{ typeLabel(alliance.alliance_type) }}
                  </span>
                  <span v-if="isMember" class="ap-chip ap-chip--member">Ваш альянс</span>
                </div>
                <h1 class="ap-hero__title">{{ alliance.title }}</h1>
                <p class="ap-hero__sub">[{{ alliance.tag }}] · Основан {{ formatDate(alliance.created_at) }}</p>
              </div>
            </div>

            <!-- stats row -->
            <div class="ap-hero__stats">
              <div class="ap-sstat">
                <span class="ap-sstat__val">{{ alliance.members_count ?? members.length }}</span>
                <span class="ap-sstat__lbl">участников</span>
              </div>
              <div v-if="Number(alliance.treasury_balance) > 0" class="ap-sstat">
                <span class="ap-sstat__val">{{ money(alliance.treasury_balance) }}</span>
                <span class="ap-sstat__lbl">в казне</span>
              </div>
              <div v-if="Number(alliance.transfer_fee_percent) > 0" class="ap-sstat">
                <span class="ap-sstat__val">{{ alliance.transfer_fee_percent }}%</span>
                <span class="ap-sstat__lbl">комиссия</span>
              </div>
            </div>

            <!-- policy flags -->
            <div class="ap-flags">
              <span v-if="alliance.allow_pvp_protection" class="ap-flag ap-flag--green">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                PvP защита
              </span>
              <span v-if="alliance.allow_joint_defense" class="ap-flag ap-flag--blue">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                Взаимооборона
              </span>
              <span v-if="alliance.allow_trade_bonus" class="ap-flag ap-flag--amber">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.077 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.077-2.354-1.253V5z" clip-rule="evenodd"/></svg>
                Торговый бонус
              </span>
              <span v-if="alliance.allow_internal_transfers" class="ap-flag">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/></svg>
                Внутренние переводы
              </span>
            </div>

            <!-- description -->
            <p v-if="alliance.description" class="ap-hero__desc">{{ alliance.description }}</p>
          </div>

          <!-- action bar -->
          <div class="ap-hero__actions">
            <button v-if="canApply && !hasPending" type="button" class="ap-btn ap-btn--primary" :disabled="actionLoading" @click="applyAction">
              {{ t('allianceHub.applyToAlliance') }}
            </button>
            <div v-if="hasPending" class="ap-pending">
              ⏳ {{ t('allianceHub.applicationPending') }}
            </div>
            <button v-if="canLeave" type="button" class="ap-btn ap-btn--danger" :disabled="actionLoading" @click="leaveAction">
              {{ t('allianceHub.leaveAlliance') }}
            </button>
            <RouterLink v-if="!isAuthenticated" to="/login" class="ap-btn ap-btn--outline">Войти</RouterLink>
            <p v-else-if="!hasNation && !isMember" class="ap-hero__hint">{{ t('allianceHub.noNationHint') }}</p>
          </div>
        </div>

        <!-- ─── MEMBERS ─── -->
        <div class="ap-block">
          <h2 class="ap-block__title">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
            {{ t('allianceHub.membersSection') }}
            <span class="ap-block__count">{{ members.length }}</span>
          </h2>
          <div v-if="!members.length" class="ap-empty">{{ t('allianceHub.noMembersYet') }}</div>
          <div v-else class="ap-members">
            <RouterLink
              v-for="m in members"
              :key="m.id"
              :to="`/nation/${m.nation?.slug}`"
              class="ap-member"
            >
              <div class="ap-member__icon">
                <img v-if="m.nation?.icon_preview_url" :src="m.nation.icon_preview_url" :alt="m.nation.tag" />
                <span v-else>{{ m.nation?.tag?.slice(0, 2).toUpperCase() }}</span>
              </div>
              <div class="ap-member__info">
                <strong>{{ m.nation?.title }}</strong>
                <small>{{ formatRoleLabel(m.role) }}</small>
              </div>
            </RouterLink>
          </div>
        </div>

        <!-- ─── PROPOSALS (members only) ─── -->
        <template v-if="isMember">
          <div class="ap-block">
            <h2 class="ap-block__title">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
              {{ t('allianceHub.proposalsSection') }}
            </h2>

            <AllianceProposalFeed
              :items="proposals"
              :loading="false"
              :can-vote="canVote"
              :voting-disabled="actionLoading"
              @vote="castVote"
            />

            <div v-if="canCreateProposals" class="ap-subform">
              <h3 class="ap-subform__title">{{ t('allianceHub.newProposalTitle') }}</h3>
              <div class="ap-form">
                <select v-model="proposalForm.proposal_type" class="select">
                  <option value="set_policy">{{ t('allianceHub.proposalTypePolicy') }}</option>
                  <option value="transfer">{{ t('allianceHub.proposalTypeTransfer') }}</option>
                  <option value="accept_member">{{ t('allianceHub.proposalTypeAccept') }}</option>
                  <option value="remove_member">{{ t('allianceHub.proposalTypeRemove') }}</option>
                </select>
                <input v-model="proposalForm.title" class="input" :placeholder="t('allianceHub.titlePlaceholder')" />
                <textarea v-model="proposalForm.description" class="textarea" rows="2" :placeholder="t('allianceHub.descOptPlaceholder')"></textarea>
                <textarea v-model="proposalForm.payload_json" class="textarea font-mono text-xs" rows="4" placeholder='{"field":"allow_trade_bonus","value":true}'></textarea>
                <button type="button" class="btn btn-primary" :disabled="actionLoading" @click="createProposalAction">
                  {{ t('allianceHub.createProposalBtn') }}
                </button>
              </div>
            </div>
          </div>

          <!-- ─── MANAGE (founders/officers only) ─── -->
          <div v-if="canManagePolicies || canTransfer" class="ap-block">
            <h2 class="ap-block__title">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>
              {{ t('allianceHub.manageSection') }}
            </h2>

            <div class="ap-manage-cols">
              <!-- policies -->
              <div v-if="canManagePolicies" class="ap-manage-card">
                <h3 class="ap-manage-card__title">{{ t('allianceHub.rulesTitle') }}</h3>
                <div class="ap-form">
                  <label class="ap-toggle">
                    <input v-model="policyForm.allow_pvp_protection" type="checkbox" />
                    <span>{{ t('allianceHub.pvpProtection') }}</span>
                  </label>
                  <label class="ap-toggle">
                    <input v-model="policyForm.allow_joint_defense" type="checkbox" />
                    <span>{{ t('allianceHub.jointDefense') }}</span>
                  </label>
                  <label class="ap-toggle">
                    <input v-model="policyForm.allow_trade_bonus" type="checkbox" />
                    <span>{{ t('allianceHub.tradeBonus') }}</span>
                  </label>
                  <label class="ap-toggle">
                    <input v-model="policyForm.allow_internal_transfers" type="checkbox" />
                    <span>{{ t('allianceHub.internalTransfers') }}</span>
                  </label>
                  <div style="display:flex;flex-direction:column;gap:.3rem">
                    <label style="font-size:.75rem;font-weight:700;color:rgb(148 163 184)">{{ t('allianceHub.feePercent') }}</label>
                    <input v-model="policyForm.transfer_fee_percent" type="number" min="0" step="0.1" class="input" />
                  </div>
                  <button type="button" class="btn btn-primary w-full" :disabled="actionLoading" @click="savePolicies">{{ t('allianceHub.saveRulesBtn') }}</button>
                </div>
              </div>

              <!-- transfer -->
              <div v-if="canTransfer" class="ap-manage-card">
                <h3 class="ap-manage-card__title">{{ t('allianceHub.transferToTitle') }}</h3>
                <div class="ap-form">
                  <select v-model="transferForm.to_nation_slug" class="select">
                    <option disabled value="">{{ t('allianceHub.selectNationPlaceholder') }}</option>
                    <option v-for="n in memberTargets" :key="n.id" :value="n.slug">{{ n.title }} [{{ n.tag }}]</option>
                  </select>
                  <input v-model="transferForm.amount" type="number" min="1" step="1" class="input" :placeholder="t('allianceHub.amountPlaceholder')" />
                  <textarea v-model="transferForm.comment" class="textarea" rows="2" :placeholder="t('allianceHub.commentPlaceholder')"></textarea>
                  <button type="button" class="btn btn-primary w-full" :disabled="actionLoading || !transferForm.to_nation_slug" @click="sendTransfer">{{ t('allianceHub.sendBtn') }}</button>
                </div>
              </div>
            </div>

            <!-- transactions -->
            <div v-if="transactions.length" class="ap-tx-block">
              <h3 class="ap-manage-card__title" style="margin-bottom:.6rem">{{ t('allianceHub.txOpsTitle') }}</h3>
              <ul class="ap-tx-list">
                <li v-for="item in transactions.slice(0, 10)" :key="item.id">
                  <div class="ap-tx-left">
                    <span>{{ txLabel(item) }}</span>
                    <small>{{ item.comment || '' }}</small>
                  </div>
                  <strong :class="Number(item.net_amount ?? item.amount ?? 0) >= 0 ? 'ap-tx-pos' : 'ap-tx-neg'">
                    {{ money(item.net_amount ?? item.amount ?? 0) }}
                  </strong>
                </li>
              </ul>
            </div>
          </div>
        </template>

      </template>
    </div>
  </section>
</template>

<style scoped>
/* ─── Back ─── */
.ap-back {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  font-size: .8rem;
  font-weight: 700;
  color: rgb(100 116 139);
  transition: color .12s;
}

.ap-back svg { width: .85rem; height: .85rem; flex-shrink: 0; }
.ap-back:hover { color: #cdd9ea; }

/* ─── Hero ─── */
.ap-hero {
  border: 1px solid;
  border-radius: 20px;
  overflow: hidden;
  position: relative;
}

.ap-hero__topbar {
  height: 3px;
  width: 100%;
}

.ap-hero__inner {
  padding: 1.4rem 1.4rem .6rem;
  display: flex;
  flex-direction: column;
  gap: .9rem;
}

.ap-hero__id {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.ap-hero__icon {
  width: 60px;
  height: 60px;
  border-radius: 15px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 900;
  flex-shrink: 0;
  letter-spacing: -.04em;
}

.ap-hero__name-col { flex: 1; min-width: 0; }

.ap-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
  margin-bottom: .4rem;
}

.ap-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid;
  padding: .15rem .55rem;
  font-size: .74rem;
  font-weight: 700;
  white-space: nowrap;
}

.ap-chip--member {
  border-color: rgba(52,211,153,.28);
  background: rgba(52,211,153,.12);
  color: rgb(110 231 183);
}

.ap-hero__title {
  font-size: 1.55rem;
  font-weight: 900;
  color: #f0f6ff;
  margin: 0 0 .2rem;
  letter-spacing: -.04em;
  line-height: 1.15;
  word-break: break-word;
}

.ap-hero__sub {
  font-size: .8rem;
  color: rgb(100 116 139);
  margin: 0;
}

/* stats */
.ap-hero__stats {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}

.ap-sstat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: .45rem .8rem;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 10px;
  background: rgba(255,255,255,.04);
  min-width: 64px;
}

.ap-sstat__val {
  font-size: 1.1rem;
  font-weight: 900;
  color: #f0f6ff;
  letter-spacing: -.03em;
  line-height: 1;
}

.ap-sstat__lbl {
  font-size: .68rem;
  font-weight: 600;
  color: rgb(100 116 139);
  margin-top: .2rem;
  white-space: nowrap;
}

/* flags */
.ap-flags {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
}

.ap-flag {
  display: inline-flex;
  align-items: center;
  gap: .28rem;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.05);
  padding: .18rem .55rem;
  font-size: .74rem;
  font-weight: 700;
  color: rgb(148 163 184);
  white-space: nowrap;
}

.ap-flag svg { width: .78rem; height: .78rem; flex-shrink: 0; }
.ap-flag--green { border-color: rgba(52,211,153,.24); background: rgba(52,211,153,.1); color: rgb(110 231 183); }
.ap-flag--blue  { border-color: rgba(99,102,241,.24);  background: rgba(99,102,241,.1);  color: rgb(165 180 252); }
.ap-flag--amber { border-color: rgba(251,191,36,.22);  background: rgba(251,191,36,.1);  color: rgb(253 230 138); }

.ap-hero__desc {
  font-size: .86rem;
  color: rgb(148 163 184);
  line-height: 1.6;
  margin: 0;
  padding: .7rem .9rem;
  border-radius: 10px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.06);
}

/* action bar */
.ap-hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .5rem;
  padding: .85rem 1.4rem 1.1rem;
  border-top: 1px solid rgba(255,255,255,.07);
}

.ap-btn {
  display: inline-flex;
  align-items: center;
  padding: .5rem 1.1rem;
  border-radius: 10px;
  font-size: .85rem;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid transparent;
  transition: filter .15s, opacity .15s, background .12s;
}

.ap-btn:disabled { opacity: .5; cursor: default; }

.ap-btn--primary {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff;
}

.ap-btn--primary:not(:disabled):hover { filter: brightness(1.09); }

.ap-btn--danger {
  border-color: rgba(248,113,113,.24);
  background: rgba(248,113,113,.08);
  color: rgb(252 165 165);
}

.ap-btn--danger:not(:disabled):hover { background: rgba(248,113,113,.15); }

.ap-btn--outline {
  border-color: rgba(148,163,184,.18);
  background: rgba(255,255,255,.04);
  color: rgb(203 213 225);
}

.ap-pending {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  padding: .5rem .85rem;
  border-radius: 10px;
  border: 1px solid rgba(234,179,8,.22);
  background: rgba(234,179,8,.07);
  color: rgb(253 224 71);
  font-size: .82rem;
  font-weight: 700;
}

.ap-hero__hint {
  font-size: .8rem;
  color: rgb(100 116 139);
  margin: 0;
}

/* ─── Blocks ─── */
.ap-block {
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px;
  background: rgba(5,10,20,.6);
  padding: 1.2rem;
}

.ap-block__title {
  display: flex;
  align-items: center;
  gap: .4rem;
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 1rem;
}

.ap-block__title svg { width: .9rem; height: .9rem; flex-shrink: 0; }

.ap-block__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(255,255,255,.08);
  font-size: .72rem;
  font-weight: 800;
  color: rgb(148 163 184);
  padding: 0 .35rem;
}

.ap-empty {
  font-size: .83rem;
  color: rgb(100 116 139);
}

/* members grid */
.ap-members {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: .45rem;
}

.ap-member {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .55rem .7rem;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 11px;
  background: rgba(255,255,255,.025);
  transition: background .12s, border-color .12s;
}

.ap-member:hover {
  background: rgba(255,255,255,.045);
  border-color: rgba(255,255,255,.12);
}

.ap-member__icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(10,15,30,.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .75rem;
  font-weight: 900;
  color: rgb(148 163 184);
  flex-shrink: 0;
  overflow: hidden;
}

.ap-member__icon img { width: 100%; height: 100%; object-fit: cover; }

.ap-member__info { min-width: 0; }

.ap-member__info strong {
  display: block;
  font-size: .83rem;
  font-weight: 700;
  color: rgb(226 232 240);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ap-member__info small {
  display: block;
  font-size: .72rem;
  color: rgb(100 116 139);
  margin-top: .05rem;
}

/* sub form */
.ap-subform {
  margin-top: 1.2rem;
  padding-top: 1.2rem;
  border-top: 1px solid rgba(255,255,255,.07);
}

.ap-subform__title {
  font-size: .8rem;
  font-weight: 700;
  color: rgb(148 163 184);
  margin: 0 0 .65rem;
}

/* forms */
.ap-form { display: flex; flex-direction: column; gap: .45rem; }

/* manage */
.ap-manage-cols {
  display: grid;
  gap: .7rem;
}

@media (min-width: 600px) {
  .ap-manage-cols { grid-template-columns: repeat(2, 1fr); }
}

.ap-manage-card {
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  background: rgba(255,255,255,.02);
  padding: .9rem;
}

.ap-manage-card__title {
  font-size: .78rem;
  font-weight: 700;
  color: rgb(148 163 184);
  margin: 0 0 .65rem;
}

.ap-toggle {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .38rem .55rem;
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 9px;
  background: rgba(255,255,255,.02);
  cursor: pointer;
  font-size: .82rem;
  color: rgb(203 213 225);
}

.ap-toggle input { accent-color: #8b5cf6; }

/* tx */
.ap-tx-block {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255,255,255,.07);
}

.ap-tx-list { list-style: none; margin: 0; padding: 0; }

.ap-tx-list li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .75rem;
  padding: .42rem 0;
  border-bottom: 1px solid rgba(255,255,255,.05);
}

.ap-tx-list li:last-child { border-bottom: none; }

.ap-tx-left { min-width: 0; }
.ap-tx-left span { display: block; font-size: .82rem; font-weight: 600; color: rgb(203 213 225); }
.ap-tx-left small { display: block; font-size: .73rem; color: rgb(100 116 139); margin-top: .04rem; }

.ap-tx-list strong { font-size: .82rem; font-weight: 800; white-space: nowrap; flex-shrink: 0; }
.ap-tx-pos { color: rgb(52 211 153); }
.ap-tx-neg { color: rgb(248 113 113); }

/* responsive */
@media (max-width: 600px) {
  .ap-hero__inner { padding: 1rem 1rem .5rem; }
  .ap-hero__title { font-size: 1.25rem; }
  .ap-hero__actions { padding: .75rem 1rem .9rem; }
  .ap-hero__id { flex-direction: column; }
  .ap-hero__icon { width: 48px; height: 48px; font-size: 1rem; }
  .ap-block { padding: .9rem; }
}
</style>
