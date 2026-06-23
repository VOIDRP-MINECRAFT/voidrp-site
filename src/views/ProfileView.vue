<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AccountTabs from '../components/AccountTabs.vue'
import { resendVerification } from '../services/authApi'
import { getMyNation } from '../services/nationsApi'
import { getMyPublicProfile } from '../services/profileApi'
import { getPlayerProgression } from '../services/progressionApi'
import { getBattlePassProfileByNick } from '../services/battlepassApi'
import { toastError, toastSuccess } from '../services/toast'
import { reloadMe, useAuthStore } from '../stores/authStore'

const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(true)
const sendingVerification = ref(false)
const publicProfile = ref(null)
const myNation = ref(null)
const progression = ref(null)
const bpProfile = ref(null)

const TIERS = [
  { key: 'create_age',   label: 'Механизмы',   icon: '⚙️' },
  { key: 'mekanism_age', label: 'Сталь',        icon: '🔩' },
  { key: 'ae2_age',      label: 'Автоматизация',icon: '💾' },
  { key: 'reactor_age',  label: 'Реакторы',     icon: '⚛️' },
  { key: 'draconic_age', label: 'Дракон',        icon: '🐉' },
  { key: 'quantum_age',  label: 'Квантум',       icon: '🌌' },
  { key: 'endgame',      label: 'Эндгейм',       icon: '♾️' },
]

const displayName = computed(() => auth.displayName.value || 'Игрок')

const avatarUrl = computed(
  () => publicProfile.value?.assets?.avatar_url || publicProfile.value?.assets?.avatar_preview_url || '',
)
const avatarText = computed(() => {
  const src = publicProfile.value?.display_name || auth.state.playerAccount?.minecraft_nickname || 'V'
  return src.slice(0, 1).toUpperCase()
})

const publicProfileUrl = computed(() => (publicProfile.value?.slug ? `/u/${publicProfile.value.slug}` : ''))

const createdAtText = computed(() => {
  const raw = auth.state.user?.created_at
  if (!raw) return '—'
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' }).format(new Date(raw))
})

const nationRoleText = computed(() => {
  switch (String(myNation.value?.viewer_role || '').toLowerCase()) {
    case 'leader': return t('profile.roleLeader')
    case 'officer': return t('profile.roleOfficer')
    case 'member': return t('profile.roleMember')
    default: return null
  }
})

const canManageNation = computed(() => Boolean(myNation.value?.viewer_can_manage))

const checkpoints = computed(() => [
  {
    label: t('profile.checkEmail'),
    done: auth.emailVerified.value,
    value: auth.emailVerified.value ? t('profile.emailVerified') : t('profile.emailNotVerified'),
  },
  {
    label: t('profile.checkNick'),
    done: Boolean(auth.state.playerAccount?.minecraft_nickname),
    value: auth.state.playerAccount?.minecraft_nickname || t('profile.noNickname'),
  },
  {
    label: t('profile.checkProfile'),
    done: Boolean(publicProfile.value?.slug),
    value: publicProfile.value?.slug ? `@${publicProfile.value.slug}` : t('profile.profileNotFilled'),
  },
  {
    label: t('profile.checkNation'),
    done: Boolean(myNation.value?.slug),
    value: myNation.value?.title || t('profile.nationNotSelected'),
  },
])

const readinessPercent = computed(() => {
  const done = checkpoints.value.filter((c) => c.done).length
  return Math.round((done / checkpoints.value.length) * 100)
})

const unlockedKeys = computed(() => {
  if (!progression.value) return new Set()
  return new Set(progression.value.tiers.map((t) => t.tier_name))
})

const currentTierLabel = computed(() => progression.value?.current_tier_label || null)

const enrichedTiers = computed(() => {
  const tierMap = {}
  if (progression.value) {
    for (const t of progression.value.tiers) tierMap[t.tier_name] = t
  }
  return TIERS.map((tier) => ({
    ...tier,
    unlocked: unlockedKeys.value.has(tier.key),
    unlocked_at: tierMap[tier.key]?.unlocked_at ?? null,
  }))
})

function fmtDate(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' }).format(new Date(iso))
}

async function loadData() {
  loading.value = true
  try {
    await reloadMe()
    const nick = auth.state.playerAccount?.minecraft_nickname
    const [profilePayload, nationPayload, progressionPayload, bpPayload] = await Promise.all([
      auth.accessToken ? getMyPublicProfile(auth.accessToken) : null,
      auth.accessToken ? getMyNation(auth.accessToken) : null,
      nick ? getPlayerProgression(nick).catch(() => null) : null,
      nick ? getBattlePassProfileByNick(nick).catch(() => null) : null,
    ])
    publicProfile.value = profilePayload || null
    myNation.value = nationPayload || null
    progression.value = progressionPayload || null
    bpProfile.value = bpPayload || null
  } catch (e) {
    toastError(e.message || t('profile.loadError'))
  } finally {
    loading.value = false
  }
}

async function sendVerificationAgain() {
  if (!auth.state.user?.email) return
  sendingVerification.value = true
  try {
    await resendVerification({ email: auth.state.user.email })
    toastSuccess(t('profile.verificationSent'))
  } catch (e) {
    toastError(e?.message || t('profile.verificationError'))
  } finally {
    sendingVerification.value = false
  }
}

async function copyLink() {
  if (!publicProfileUrl.value || typeof window === 'undefined') return
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${publicProfileUrl.value}`)
    toastSuccess(t('profile.linkCopied'))
  } catch {
    toastError(t('profile.linkCopyError'))
  }
}

onMounted(loadData)
</script>

<template>
  <section class="py-6 md:py-8 auth-page">
    <div class="container-shell space-y-4 page-entry">

      <!-- Compact hero -->
      <section class="surface-card p-4 md:p-5">
        <div class="flex items-center gap-4">
          <div class="preview-avatar h-14 w-14 shrink-0 text-xl">
            <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="h-full w-full object-cover" />
            <span v-else>{{ avatarText }}</span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="truncate text-xl font-black tracking-tight text-slate-50">{{ displayName }}</h1>
              <span
                v-if="currentTierLabel"
                class="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-300"
              >
                {{ currentTierLabel }}
              </span>
              <span
                v-if="myNation && nationRoleText"
                class="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400"
              >
                {{ nationRoleText }} · {{ myNation.tag }}
              </span>
            </div>
            <p class="mt-1 text-xs text-slate-500">{{ auth.accountModeText.value }} · с {{ createdAtText }}</p>
          </div>

          <div class="hidden shrink-0 gap-2 sm:flex">
            <button v-if="publicProfileUrl" type="button" class="btn btn-outline !py-1.5 !text-xs" @click="copyLink">
              {{ t('profile.copyLink') }}
            </button>
            <RouterLink to="/profile/public" class="btn btn-primary !py-1.5 !text-xs">
              {{ t('profile.appearance') }}
            </RouterLink>
          </div>
        </div>

        <div class="mt-3 flex gap-2 sm:hidden">
          <button v-if="publicProfileUrl" type="button" class="btn btn-outline flex-1 !py-1.5 !text-xs" @click="copyLink">
            {{ t('profile.copyLink') }}
          </button>
          <RouterLink to="/profile/public" class="btn btn-primary !py-1.5 !text-xs" :class="publicProfileUrl ? 'flex-1' : 'w-full'">
            {{ t('profile.appearance') }}
          </RouterLink>
        </div>

        <div class="mt-3">
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs text-slate-500">{{ t('profile.readiness') }}</span>
            <span class="text-xs font-semibold text-slate-400">{{ readinessPercent }}%</span>
          </div>
          <div style="background: rgba(255,255,255,0.07); height: 5px; border-radius: 999px; overflow: hidden;">
            <div
              :style="{
                width: readinessPercent + '%',
                background: 'linear-gradient(90deg, #8b5cf6, #22c55e)',
                height: '100%',
                borderRadius: '999px',
                transition: 'width 0.5s ease',
              }"
            ></div>
          </div>
        </div>
      </section>

      <AccountTabs />

      <div v-if="loading" class="grid gap-4 lg:grid-cols-2">
        <div class="skeleton h-72 rounded-[28px]"></div>
        <div class="skeleton h-72 rounded-[28px]"></div>
      </div>

      <div v-else class="grid gap-4 lg:grid-cols-2">

        <!-- Left: Progression + Checklist -->
        <div class="space-y-4">

          <section class="surface-card p-4 md:p-5">
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="section-kicker !mb-1">{{ t('profile.progressionKicker') }}</div>
                <h2 class="text-base font-black tracking-tight text-slate-50">{{ t('profile.progressionTitle') }}</h2>
              </div>
              <RouterLink to="/leaderboard" class="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                {{ t('profile.leaderboard') }}
              </RouterLink>
            </div>

            <div class="mt-3 space-y-1.5">
              <div
                v-for="tier in enrichedTiers"
                :key="tier.key"
                class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition"
                :class="tier.unlocked ? 'bg-violet-500/10' : 'bg-slate-800/40'"
              >
                <span class="w-5 text-center text-sm leading-none select-none">{{ tier.icon }}</span>
                <span
                  class="flex-1 text-sm font-medium"
                  :class="tier.unlocked ? 'text-slate-100' : 'text-slate-500'"
                >
                  {{ tier.label }}
                </span>
                <span v-if="tier.unlocked" class="text-xs text-slate-400">{{ fmtDate(tier.unlocked_at) }}</span>
                <span v-else class="h-2 w-2 shrink-0 rounded-full bg-slate-700"></span>
              </div>
            </div>

            <p v-if="!progression" class="mt-3 text-center text-xs text-slate-500">
              {{ t('profile.noProgression') }}
            </p>
          </section>

          <section class="surface-card p-4 md:p-5">
            <div class="section-kicker !mb-1">{{ t('profile.checklistKicker') }}</div>
            <h2 class="text-base font-black tracking-tight text-slate-50">{{ t('profile.checklistTitle') }}</h2>

            <div class="mt-3 grid grid-cols-2 gap-2">
              <div
                v-for="cp in checkpoints"
                :key="cp.label"
                class="rounded-xl p-3"
                :class="cp.done ? 'bg-emerald-500/10' : 'bg-amber-500/10'"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs text-slate-400">{{ cp.label }}</span>
                  <span
                    class="h-2 w-2 shrink-0 rounded-full"
                    :class="cp.done ? 'bg-emerald-400' : 'bg-amber-400'"
                  ></span>
                </div>
                <p class="mt-1.5 truncate text-xs font-semibold text-slate-200">{{ cp.value }}</p>
              </div>
            </div>

            <button
              v-if="!auth.emailVerified.value"
              type="button"
              class="btn btn-ghost mt-3 w-full !py-1.5 !text-xs"
              :disabled="sendingVerification"
              @click="sendVerificationAgain"
            >
              <span v-if="sendingVerification" class="spinner"></span>
              {{ sendingVerification ? t('profile.resending') : t('profile.resendVerification') }}
            </button>
          </section>
        </div>

        <!-- Right: Account info + Nation + Links -->
        <div class="space-y-4">

          <section class="surface-card p-4 md:p-5">
            <div class="section-kicker !mb-1">{{ t('profile.dataKicker') }}</div>
            <h2 class="text-base font-black tracking-tight text-slate-50">{{ t('profile.dataTitle') }}</h2>

            <div class="mt-3 space-y-1.5">
              <div class="flex items-center justify-between rounded-xl bg-slate-800/40 px-3 py-2.5">
                <span class="text-xs text-slate-400">{{ t('profile.loginLabel') }}</span>
                <span class="text-xs font-semibold text-slate-100">{{ auth.state.user?.site_login || '—' }}</span>
              </div>
              <div class="flex items-center justify-between rounded-xl bg-slate-800/40 px-3 py-2.5">
                <span class="shrink-0 text-xs text-slate-400">{{ t('profile.emailLabel') }}</span>
                <span
                  class="ml-4 max-w-[120px] truncate text-right text-xs font-semibold text-slate-100 sm:max-w-[180px]"
                  :title="auth.state.user?.email"
                >
                  {{ auth.state.user?.email || '—' }}
                </span>
              </div>
              <div class="flex items-center justify-between rounded-xl bg-slate-800/40 px-3 py-2.5">
                <span class="text-xs text-slate-400">{{ t('profile.nicknameLabel') }}</span>
                <span class="text-xs font-semibold text-slate-100">
                  {{ auth.state.playerAccount?.minecraft_nickname || t('profile.noNickname') }}
                </span>
              </div>
            </div>
          </section>

          <section class="surface-card p-4 md:p-5">
            <div class="section-kicker !mb-1">{{ t('profile.nationKicker') }}</div>
            <h2 class="text-base font-black tracking-tight text-slate-50">
              {{ myNation ? myNation.title : t('profile.noNation') }}
            </h2>

            <div v-if="myNation" class="mt-3">
              <p class="text-xs text-slate-400">
                [{{ myNation.tag }}] · {{ myNation.short_description || t('profile.nationNoDesc') }}
              </p>
              <div class="mt-3 flex gap-2">
                <RouterLink
                  :to="canManageNation ? '/nation/studio' : `/nation/${myNation.slug}`"
                  class="btn btn-primary flex-1 !py-1.5 !text-xs"
                >
                  {{ canManageNation ? t('profile.manage') : t('profile.openPage') }}
                </RouterLink>
                <RouterLink :to="`/nation/${myNation.slug}`" class="btn btn-outline flex-1 !py-1.5 !text-xs">
                  {{ t('profile.openNation') }}
                </RouterLink>
              </div>
            </div>
            <div v-else class="mt-3">
              <p class="text-xs text-slate-400">
                {{ t('profile.noNationDesc') }}
              </p>
              <div class="mt-3 flex gap-2">
                <RouterLink to="/nations" class="btn btn-outline flex-1 !py-1.5 !text-xs">{{ t('profile.nationsList') }}</RouterLink>
                <RouterLink to="/nation/studio" class="btn btn-primary flex-1 !py-1.5 !text-xs">{{ t('profile.createNation') }}</RouterLink>
              </div>
            </div>
          </section>

          <!-- Battle Pass -->
          <section class="surface-card p-4 md:p-5">
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="section-kicker !mb-1">{{ t('profile.bpKicker') }}</div>
                <h2 class="text-base font-black tracking-tight text-slate-50">{{ t('profile.bpTitle') }}</h2>
              </div>
              <span
                v-if="bpProfile?.has_premium"
                class="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300"
              >
                ✦ Premium
              </span>
              <span v-else class="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
                {{ t('profile.bpNoPremium') }}
              </span>
            </div>

            <div v-if="bpProfile" class="mt-3 space-y-2">
              <div class="flex items-center justify-between rounded-xl bg-slate-800/40 px-3 py-2.5">
                <span class="text-xs text-slate-400">{{ t('profile.bpLevel') }}</span>
                <span class="text-xs font-bold text-slate-100">{{ bpProfile.level }} / 120</span>
              </div>
              <div class="rounded-xl bg-slate-800/40 px-3 py-2.5">
                <div class="mb-1.5 flex items-center justify-between">
                  <span class="text-xs text-slate-400">{{ t('profile.bpSeason') }} {{ bpProfile.season }}</span>
                  <span class="text-xs text-slate-500">{{ bpProfile.xp.toLocaleString() }} XP</span>
                </div>
                <div style="background: rgba(255,255,255,0.07); height: 4px; border-radius: 999px; overflow: hidden;">
                  <div
                    :style="{
                      width: Math.min(100, Math.round((bpProfile.level / 120) * 100)) + '%',
                      background: bpProfile.has_premium
                        ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                        : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                      height: '100%',
                      borderRadius: '999px',
                      transition: 'width 0.5s ease',
                    }"
                  ></div>
                </div>
              </div>
              <div v-if="bpProfile.has_premium && bpProfile.premium_expires_at" class="flex items-center justify-between rounded-xl bg-amber-500/10 px-3 py-2">
                <span class="text-xs text-amber-400/80">{{ t('profile.bpPremiumActive') }}</span>
                <span class="text-xs font-semibold text-amber-300">
                  {{ new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' }).format(new Date(bpProfile.premium_expires_at)) }}
                </span>
              </div>
            </div>
            <p v-else class="mt-3 text-center text-xs text-slate-500">{{ t('profile.bpNoData') }}</p>
          </section>

          <section class="surface-card p-4 md:p-5">
            <div class="section-kicker !mb-1">{{ t('profile.sectionsKicker') }}</div>
            <h2 class="text-base font-black tracking-tight text-slate-50">{{ t('profile.sectionsTitle') }}</h2>

            <div class="mt-3 grid grid-cols-2 gap-2">
              <RouterLink
                to="/profile/public"
                class="action-card !p-3 text-center transition hover:-translate-y-[1px]"
              >
                <p class="text-xs font-semibold text-slate-100">{{ t('profile.sectionAppearance') }}</p>
              </RouterLink>
              <RouterLink
                to="/profile/referrals"
                class="action-card !p-3 text-center transition hover:-translate-y-[1px]"
              >
                <p class="text-xs font-semibold text-slate-100">{{ t('profile.sectionReferrals') }}</p>
              </RouterLink>
              <RouterLink
                to="/profile/social"
                class="action-card !p-3 text-center transition hover:-translate-y-[1px]"
              >
                <p class="text-xs font-semibold text-slate-100">{{ t('profile.sectionFriends') }}</p>
              </RouterLink>
              <RouterLink
                to="/leaderboard"
                class="action-card !p-3 text-center transition hover:-translate-y-[1px]"
              >
                <p class="text-xs font-semibold text-slate-100">{{ t('profile.sectionLeaderboard') }}</p>
              </RouterLink>
            </div>
          </section>
        </div>
      </div>

    </div>
  </section>
</template>
