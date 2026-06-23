<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getPublicProfileBySlug } from '../services/profileApi'
import { followProfile, unfollowProfile } from '../services/socialApi'
import { useAuthStore } from '../stores/authStore'
import { getBattlePassProfileByNick } from '../services/battlepassApi'

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref('')
const actionMessage = ref('')
const followLoading = ref(false)
const profile = ref(null)
const bpProfile = ref(null)
const publicNation = computed(() => profile.value?.nation || null)

function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(139, 92, 246, ${alpha})`
  const value = hex.replace('#', '')
  const normalized = value.length === 3 ? value.split('').map((x) => x + x).join('') : value

  if (normalized.length !== 6) {
    return `rgba(139, 92, 246, ${alpha})`
  }

  const intValue = Number.parseInt(normalized, 16)
  const r = (intValue >> 16) & 255
  const g = (intValue >> 8) & 255
  const b = intValue & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const displayName = computed(() => {
  return profile.value?.display_name || profile.value?.player_account?.minecraft_nickname || profile.value?.user?.site_login || 'Игрок'
})

const avatarFallback = computed(() => displayName.value.slice(0, 1).toUpperCase())
const accent = computed(() => profile.value?.accent_color || '#8b5cf6')
const avatarUrl = computed(() => profile.value?.assets?.avatar_url || profile.value?.assets?.avatar_preview_url || '')
const bannerUrl = computed(() => profile.value?.assets?.banner_url || profile.value?.assets?.banner_preview_url || '')
const backgroundUrl = computed(() => profile.value?.assets?.background_url || profile.value?.assets?.background_preview_url || '')
const nationLink = computed(() => (publicNation.value?.slug ? `/nation/${publicNation.value.slug}` : ''))

const routeBackground = computed(() => {
  const accentGlow = hexToRgba(accent.value, 0.22)
  if (!backgroundUrl.value) {
    return [
      `radial-gradient(circle at top left, ${accentGlow} 0%, transparent 24%)`,
      `radial-gradient(circle at top right, ${hexToRgba(accent.value, 0.16)} 0%, transparent 28%)`,
      'linear-gradient(180deg, #05070f 0%, #0a0f1c 48%, #10192c 100%)',
    ].join(', ')
  }

  return [
    'linear-gradient(180deg, rgba(4,6,11,0.62), rgba(4,6,11,0.9))',
    `radial-gradient(circle at top left, ${accentGlow} 0%, transparent 28%)`,
    `url(${backgroundUrl.value})`,
  ].join(', ')
})

const pageShellStyle = computed(() => ({
  borderColor: hexToRgba(accent.value, 0.2),
  boxShadow: `0 28px 80px ${hexToRgba(accent.value, 0.16)}`,
  background: 'linear-gradient(180deg, rgba(7,11,20,0.48), rgba(7,11,20,0.32))',
}))

const heroStyle = computed(() => {
  if (bannerUrl.value) {
    return {
      backgroundImage: [
        'linear-gradient(180deg, rgba(4,6,11,0.05), rgba(4,6,11,0.74))',
        `radial-gradient(circle at top left, ${hexToRgba(accent.value, 0.28)} 0%, transparent 32%)`,
        `url(${bannerUrl.value})`,
      ].join(', '),
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }

  return {
    background: [
      `radial-gradient(circle at top left, ${hexToRgba(accent.value, 0.36)} 0%, transparent 32%)`,
      'linear-gradient(135deg, rgba(6,9,19,0.96) 0%, rgba(10,15,27,0.98) 56%, rgba(22,28,48,1) 100%)',
    ].join(', '),
  }
})

const cardStyle = computed(() => ({
  borderColor: hexToRgba(accent.value, 0.16),
  background: `linear-gradient(180deg, rgba(10,15,27,0.84), ${hexToRgba(accent.value, 0.08)})`,
}))

const accentBadgeStyle = computed(() => ({
  borderColor: accent.value,
  backgroundColor: hexToRgba(accent.value, 0.12),
  color: accent.value,
}))

const accentLineStyle = computed(() => ({
  background: `linear-gradient(90deg, ${accent.value}, ${hexToRgba(accent.value, 0.12)})`,
}))

const canFollow = computed(() => {
  if (!profile.value) return false
  if (profile.value.viewer?.is_self) return false
  return Boolean(authStore.accessToken)
})

const stats = computed(() => {
  if (!profile.value) return []
  return [
    { label: t('publicProfile.followers'), value: Number(profile.value?.stats?.followers || 0) },
    { label: t('publicProfile.following'), value: Number(profile.value?.stats?.following || 0) },
    { label: t('publicProfile.friends'), value: Number(profile.value?.stats?.friends || 0) },
  ]
})

const profileFacts = computed(() => {
  const items = []

  if (profile.value?.player_account?.minecraft_nickname) {
    items.push({ label: t('publicProfile.factNick'), value: profile.value.player_account.minecraft_nickname })
  }

  if (publicNation.value?.title) {
    items.push({
      label: t('publicProfile.factNation'),
      value: publicNation.value.title,
      hint: publicNation.value.tag ? `[${publicNation.value.tag}]` : '',
      to: nationLink.value,
    })
  }

  if (profile.value?.status_text) {
    items.push({ label: t('publicProfile.factStatus'), value: profile.value.status_text })
  }

  if (bpProfile.value) {
    const lvlText = `${bpProfile.value.level} / 120`
    const suffix = bpProfile.value.has_premium ? ' ✦' : ''
    items.push({ label: t('publicProfile.factBpLevel'), value: lvlText + suffix })
  }

  return items
})

function applyRouteBackground(value) {
  document.documentElement.style.setProperty('--route-bg', value)
}


async function loadProfile() {
  loading.value = true
  error.value = ''
  actionMessage.value = ''

  try {
    const payload = await getPublicProfileBySlug(route.params.slug, authStore.accessToken || null)
    profile.value = payload
    const nick = payload?.player_account?.minecraft_nickname
    if (nick) {
      bpProfile.value = await getBattlePassProfileByNick(nick).catch(() => null)
    }
  } catch (err) {
    error.value = err.message || t('publicProfile.loadError')
  } finally {
    loading.value = false
  }
}

async function toggleFollow() {
  if (!profile.value || !authStore.accessToken) return

  followLoading.value = true
  error.value = ''
  actionMessage.value = ''

  try {
    const wasFollowing = Boolean(profile.value.viewer?.is_following)

    if (wasFollowing) {
      await unfollowProfile(authStore.accessToken, profile.value.slug)
    } else {
      await followProfile(authStore.accessToken, profile.value.slug)
    }

    await loadProfile()
    actionMessage.value = wasFollowing ? t('publicProfile.unfollowed') : t('publicProfile.followed')
  } catch (err) {
    error.value = err.message || t('publicProfile.followError')
  } finally {
    followLoading.value = false
  }
}

async function copyProfileLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    actionMessage.value = t('publicProfile.linkCopied')
    error.value = ''
  } catch {
    error.value = t('publicProfile.linkCopyError')
  }
}

watch(() => route.params.slug, loadProfile)
watch(routeBackground, (value) => applyRouteBackground(value), { immediate: true })
onMounted(loadProfile)
onBeforeUnmount(() => {
  document.documentElement.style.removeProperty('--route-bg')
})
</script>

<template>
  <section class="py-6 md:py-8">
    <div class="container-shell">
      <div v-if="loading" class="space-y-5">
        <div class="skeleton h-[280px] rounded-[30px]"></div>
        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div class="skeleton h-[220px] rounded-[28px]"></div>
          <div class="skeleton h-[180px] rounded-[28px]"></div>
        </div>
      </div>

      <div v-else-if="error" class="mx-auto max-w-3xl alert alert-error">{{ error }}</div>

      <div v-else-if="profile" class="page-backdrop route-shell overflow-hidden rounded-[32px] border" :style="pageShellStyle">
        <div class="p-3 md:p-4">
          <div class="space-y-4">
            <section class="relative overflow-hidden rounded-[28px] shadow-[0_26px_100px_rgba(0,0,0,0.36)]" :style="heroStyle">
              <div class="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/72"></div>

              <div class="relative px-5 pb-5 pt-5 md:px-7 md:pb-7 md:pt-7">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full border border-white/12 bg-black/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-white/84 backdrop-blur-md">
                    {{ t('publicProfile.playerProfile') }}
                  </span>
                  <span class="rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em]" :style="accentBadgeStyle">
                    {{ t('publicProfile.accent') }}
                  </span>
                  <RouterLink
                    v-if="publicNation?.slug"
                    :to="nationLink"
                    class="rounded-full border border-white/12 bg-black/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-white/84 backdrop-blur-md transition hover:bg-black/40"
                  >
                    {{ publicNation.title }}
                  </RouterLink>
                  <span
                    v-if="bpProfile?.has_premium"
                    class="group relative rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-amber-300 backdrop-blur-md cursor-default"
                    :title="t('publicProfile.premiumBadgeTooltip')"
                  >
                    ✦ {{ t('publicProfile.premiumBadge') }}
                  </span>
                </div>

                <div class="mt-12 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div class="flex min-w-0 items-end gap-4">
                    <div class="flex h-22 w-22 items-center justify-center overflow-hidden rounded-[24px] border-4 border-white/90 bg-slate-900 text-3xl font-black uppercase text-slate-100 shadow-[0_18px_50px_rgba(0,0,0,0.4)] md:h-24 md:w-24">
                      <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="h-full w-full object-cover" />
                      <span v-else>{{ avatarFallback }}</span>
                    </div>

                    <div class="min-w-0 pb-1 text-white">
                      <h1 class="break-words text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] md:text-4xl">
                        {{ displayName }}
                      </h1>

                      <p class="mt-2 text-sm text-white/76 md:text-base">
                        @{{ profile.slug }}
                        <template v-if="profile.player_account?.minecraft_nickname">· {{ profile.player_account.minecraft_nickname }}</template>
                      </p>

                      <p v-if="profile.status_text" class="mt-3 max-w-2xl text-sm leading-6 text-white/90 md:text-[15px]">
                        {{ profile.status_text }}
                      </p>
                    </div>
                  </div>

                  <div class="flex flex-wrap gap-3">
                    <button
                      v-if="canFollow"
                      class="btn btn-light rounded-2xl"
                      :disabled="followLoading"
                      @click="toggleFollow"
                    >
                      <span v-if="followLoading" class="spinner"></span>
                      <span v-else>{{ profile.viewer?.is_following ? t('publicProfile.unfollow') : t('publicProfile.follow') }}</span>
                    </button>

                    <RouterLink v-if="profile.viewer?.is_self" to="/profile/public" class="btn btn-outline rounded-2xl">
                      {{ t('publicProfile.edit') }}
                    </RouterLink>

                    <button type="button" class="btn btn-outline rounded-2xl" @click="copyProfileLink">
                      {{ t('publicProfile.share') }}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <div v-if="actionMessage" class="alert alert-success">
              {{ actionMessage }}
            </div>

            <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <section class="surface-card p-4 md:p-5" :style="cardStyle">
                <div class="section-kicker !mb-2">{{ t('publicProfile.aboutKicker') }}</div>
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div class="min-w-0 flex-1">
                    <h2 class="text-lg font-black text-slate-50 md:text-xl">{{ t('publicProfile.aboutTitle') }}</h2>
                    <div class="mt-3 h-[2px] w-full rounded-full" :style="accentLineStyle"></div>
                    <p class="mt-3 whitespace-pre-line text-sm leading-6 text-slate-300 md:text-[15px]">
                      {{ profile.bio || t('publicProfile.noBio') }}
                    </p>
                  </div>

                  <div class="grid min-w-0 grid-cols-3 gap-3 md:w-[360px]">
                    <div v-for="item in stats" :key="item.label" class="metric-card profile-stat-card text-center" :style="cardStyle">
                      <p class="text-[1.7rem] font-black leading-none text-slate-50">{{ item.value }}</p>
                      <p class="mt-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                        {{ item.label }}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <aside class="space-y-4">
                <section class="surface-card p-4 md:p-5" :style="cardStyle">
                  <div class="section-kicker !mb-2">{{ t('publicProfile.infoKicker') }}</div>
                  <h2 class="text-lg font-black text-slate-50">{{ t('publicProfile.infoTitle') }}</h2>

                  <div class="mt-4 space-y-3">
                    <component
                      :is="item.to ? RouterLink : 'div'"
                      v-for="item in profileFacts"
                      :key="item.label"
                      :to="item.to"
                      class="action-card block transition"
                      :style="cardStyle"
                    >
                      <p class="metric-label">{{ item.label }}</p>
                      <p class="mt-2 text-sm font-semibold text-slate-100">{{ item.value }}</p>
                      <p v-if="item.hint" class="mt-1 text-sm leading-6 text-slate-400">{{ item.hint }}</p>
                    </component>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
