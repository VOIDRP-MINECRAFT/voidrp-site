<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getPublicProfileBySlug, getPublicProfileGameStats } from '../services/profileApi'
import { followProfile, unfollowProfile } from '../services/socialApi'
import { useAuthStore } from '../stores/authStore'
import { getBattlePassProfileByNick } from '../services/battlepassApi'
import { serverFeatureEnabled } from '../stores/serverStore'
import { filledSocialLinks } from '../utils/socialLinks.js'

const { t, locale } = useI18n()
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref('')
const actionMessage = ref('')
const followLoading = ref(false)
const profile = ref(null)
const bpProfile = ref(null)
const gameStats = ref(null)
const headStage = ref(0)   // 0 = our skin head, 1 = mc-heads fallback, 2 = letter

const nick = computed(() => profile.value?.player_account?.minecraft_nickname || '')
const displayName = computed(() => profile.value?.display_name || nick.value || profile.value?.user?.site_login || t('publicProfile.player'))
// The in-game nick only adds information when it differs from what is already shown.
const showNick = computed(() => {
  const n = nick.value.toLowerCase()
  return Boolean(n) && n !== displayName.value.toLowerCase() && n !== String(profile.value?.slug || '').toLowerCase()
})
const accent = computed(() => profile.value?.accent_color || '#8b5cf6')
const avatarUrl = computed(() => profile.value?.assets?.avatar_url || profile.value?.assets?.avatar_preview_url || '')
const bannerUrl = computed(() => profile.value?.assets?.banner_url || profile.value?.assets?.banner_preview_url || '')
const backgroundUrl = computed(() => profile.value?.assets?.background_url || profile.value?.assets?.background_preview_url || '')
// No uploaded avatar → the player's skin head; no nick either → first letter.
const headUrl = computed(() => {
  if (!nick.value || headStage.value >= 2) return ''
  const n = encodeURIComponent(nick.value)
  return headStage.value === 0 ? `/api/v1/public/player-head/${n}` : `https://mc-heads.net/avatar/${n}/128`
})
const avatarLetter = computed(() => displayName.value.slice(0, 1).toUpperCase())
const socialLinks = computed(() => filledSocialLinks(profile.value?.social_links))
const nation = computed(() => profile.value?.nation || null)
const nationLink = computed(() => (nation.value?.slug ? `/nation/${nation.value.slug}` : ''))

function hexToRgb(hex) {
  const v = String(hex || '').replace('#', '')
  const n = v.length === 3 ? v.split('').map((x) => x + x).join('') : v
  if (!/^[0-9a-f]{6}$/i.test(n)) return [139, 92, 246]
  const i = Number.parseInt(n, 16)
  return [(i >> 16) & 255, (i >> 8) & 255, i & 255]
}
// WCAG relative luminance: decides text colour on the accent and keeps near-black accents visible.
function luminance([r, g, b]) {
  const c = [r, g, b].map((x) => { const v = x / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function mix([r, g, b], [r2, g2, b2], t) {
  return [r + (r2 - r) * t, g + (g2 - g) * t, b + (b2 - b) * t].map(Math.round)
}

function hexToRgba(hex, alpha) {
  const v = String(hex || '').replace('#', '')
  const n = v.length === 3 ? v.split('').map((x) => x + x).join('') : v
  if (n.length !== 6) return `rgba(139, 92, 246, ${alpha})`
  const i = Number.parseInt(n, 16)
  return `rgba(${(i >> 16) & 255}, ${(i >> 8) & 255}, ${i & 255}, ${alpha})`
}

// Players pick any accent, from pure white to pure black. Buttons get readable ink either way,
// and an accent too dark to see on the dark page is lifted towards white for lines and glows.
const pageVars = computed(() => {
  const rgb = hexToRgb(accent.value)
  const lum = luminance(rgb)
  const ui = lum < 0.06 ? mix(rgb, [255, 255, 255], 0.45) : rgb
  const css = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`
  return {
    '--pp-accent': css(rgb),
    '--pp-accent-ui': css(ui),
    '--pp-on-accent': lum > 0.45 ? '#0e0c18' : '#ffffff',
    '--pp-accent-soft': css(ui, 0.14),
    '--pp-accent-line': css(ui, 0.4),
    '--pp-accent-glow': css(ui, 0.28),
  }
})

const bannerStyle = computed(() => (bannerUrl.value
  ? { backgroundImage: `url(${bannerUrl.value})` }
  : { backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${hexToRgba(accent.value, 0.55)} 0%, transparent 55%), radial-gradient(90% 120% at 100% 100%, ${hexToRgba(accent.value, 0.25)} 0%, transparent 60%), linear-gradient(135deg, #1a1530, #0d0b17)` }))

const routeBackground = computed(() => {
  if (!backgroundUrl.value) {
    return `radial-gradient(circle at 15% 0%, ${hexToRgba(accent.value, 0.18)} 0%, transparent 30%), linear-gradient(180deg, #07060d 0%, #0d0b17 100%)`
  }
  // One layer per image: cover the whole page instead of tiling, darkened so any picture reads as ambience.
  return `linear-gradient(180deg, rgba(8,7,14,0.86) 0%, rgba(8,7,14,0.93) 40%, rgba(8,7,14,0.98) 100%), url(${backgroundUrl.value}) center top / cover no-repeat`
})
function applyRouteBackground(value) {
  document.documentElement.style.setProperty('--route-bg', value)
}

const counters = computed(() => {
  const st = profile.value?.stats || {}
  return [
    { key: 'followers', value: Number(st.followers || 0), label: t('publicProfile.followers') },
    { key: 'following', value: Number(st.following || 0), label: t('publicProfile.following') },
    { key: 'friends', value: Number(st.friends || 0), label: t('publicProfile.friends') },
  ]
})

// Small line icons for the stat tiles (24px grid, stroke-based).
const STAT_ICONS = {
  playtime: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  pvp: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 17.5 21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2',
  kd: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  mobs: 'M9 10h.01M15 10h.01M8 20v-2.5a1.5 1.5 0 0 1 1-1.4V15a7 7 0 1 1 6 0v1.1a1.5 1.5 0 0 1 1 1.4V20M10 20v-2M14 20v-2',
  broken: 'M14.5 4.5 19.5 9.5M3 21l9-9M13 3.5c2.6-.6 5.3.2 7.3 2.2l-2.8 2.8-3.7-3.7ZM15.5 10.5l-2-2',
  streak: 'M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.6-2.6 1.5-3.5.2 1.4 1 2.2 2 2.5C11 8 11 5.5 12 3Z',
}

const statTiles = computed(() => {
  const s = gameStats.value?.stats
  if (!s) return []
  const kd = s.deaths > 0 ? (s.pvp_kills / s.deaths).toFixed(2) : String(s.pvp_kills || 0)
  const h = Math.floor((s.playtime_minutes || 0) / 60)
  const m = (s.playtime_minutes || 0) % 60
  const num = (v) => Number(v || 0).toLocaleString(locale.value === 'en' ? 'en-US' : 'ru-RU')
  return [
    { key: 'playtime', value: h > 0 ? t('publicProfile.hm', { h: num(h), m }) : t('publicProfile.m', { m }), label: t('publicProfile.stat.playtime') },
    { key: 'pvp', value: num(s.pvp_kills), label: t('publicProfile.stat.pvp') },
    { key: 'kd', value: kd, label: t('publicProfile.stat.kd') },
    { key: 'mobs', value: num(s.mob_kills), label: t('publicProfile.stat.mobs') },
    { key: 'broken', value: num(s.blocks_broken), label: t('publicProfile.stat.mined') },
    { key: 'streak', value: num(s.best_kill_streak), label: t('publicProfile.stat.streak') },
  ]
})
// Simplified brand glyphs, filled, 24px grid.
const SOCIAL_ICONS = {
  twitch: 'M4.5 2 3 5.8V20h4.8v2.5h2.7L13 20h3.8L21 15.8V2Zm14.8 12.9-2.7 2.7h-4.3l-2.3 2.3v-2.3H6.3V3.7h13Zm-3.4-7.6h-1.7v5h1.7Zm-4.6 0H9.6v5h1.7Z',
  youtube: 'M22 8.1a3 3 0 0 0-2.1-2.1C18 5.5 12 5.5 12 5.5s-6 0-7.9.5A3 3 0 0 0 2 8.1 31 31 0 0 0 1.5 12a31 31 0 0 0 .5 3.9 3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-3.9 31 31 0 0 0-.5-3.9ZM10 15.2V8.8l5.2 3.2Z',
  tiktok: 'M16.6 2h-3.3v13.3a2.9 2.9 0 1 1-2-2.8V9.1a6.3 6.3 0 1 0 5.3 6.2V8.6A7.9 7.9 0 0 0 21 10V6.7a4.4 4.4 0 0 1-4.4-4.4Z',
  telegram: 'M21.4 3.6 2.9 10.7c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.2-15c.3-1.3-.5-1.9-1.6-1.1ZM9.6 14.1l-.4 4 -1.4-4.6 10.9-6.9Z',
  discord: 'M19.3 5.3A16.5 16.5 0 0 0 15.2 4l-.5 1a15.3 15.3 0 0 0-5.4 0l-.5-1a16.4 16.4 0 0 0-4.1 1.3C2.1 9.2 1.4 13 1.7 16.7a16.6 16.6 0 0 0 5 2.5l1.1-1.7a10.7 10.7 0 0 1-1.7-.8l.4-.3a11.8 11.8 0 0 0 11 0l.4.3-1.7.8 1.1 1.7a16.5 16.5 0 0 0 5-2.5c.4-4.3-.7-8.1-3-11.4ZM8.5 14.4c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z',
  vk: 'M13.2 18.5C6.4 18.5 2.5 13.8 2.3 6h3.4c.1 5.7 2.6 8.2 4.6 8.7V6h3.2v4.9c2-.2 4-2.5 4.8-4.9h3.2a9.4 9.4 0 0 1-4.4 6.2 9.9 9.9 0 0 1 5.1 6.3h-3.5a6.2 6.2 0 0 0-5.2-4.5v4.5Z',
}

const achievements = computed(() => (gameStats.value?.achievements || []).filter((a) => a.unlocked))
const hasGameData = computed(() => {
  const s = gameStats.value?.stats
  if (!s) return false
  return s.playtime_minutes > 0 || s.pvp_kills > 0 || s.mob_kills > 0 || s.blocks_broken > 0 || achievements.value.length > 0
})

const bp = computed(() => {
  if (!bpProfile.value) return null
  const max = Number(bpProfile.value.max_level || 0)
  const level = Number(bpProfile.value.level || 0)
  return {
    level,
    max,
    pct: max > 0 ? Math.min(100, Math.round((level / max) * 100)) : 0,
    premium: Boolean(bpProfile.value.has_premium),
    season: bpProfile.value.season_name || '',
  }
})

const memberSince = computed(() => {
  const iso = profile.value?.user?.created_at
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale.value === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
})

const canFollow = computed(() => Boolean(profile.value && !profile.value.viewer?.is_self && authStore.accessToken))
// Guests see the button too; it leads to login and back here.
const showGuestFollow = computed(() => Boolean(profile.value && !authStore.accessToken))
const loginToFollow = computed(() => ({ path: '/login', query: { redirect: route.fullPath } }))
const relation = computed(() => {
  const v = profile.value?.viewer
  if (!v || v.is_self) return ''
  if (v.is_friend) return t('publicProfile.relFriend')
  if (v.follows_you) return t('publicProfile.relFollowsYou')
  return ''
})

async function loadProfile() {
  loading.value = true
  error.value = ''
  actionMessage.value = ''
  headStage.value = 0
  try {
    const payload = await getPublicProfileBySlug(route.params.slug, authStore.accessToken || null)
    profile.value = payload
    const n = payload?.player_account?.minecraft_nickname
    bpProfile.value = n && serverFeatureEnabled('battlepass') ? await getBattlePassProfileByNick(n).catch(() => null) : null
    getPublicProfileGameStats(route.params.slug, authStore.accessToken || null)
      .then((g) => { gameStats.value = g })
      .catch(() => { gameStats.value = null })
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
    if (wasFollowing) await unfollowProfile(authStore.accessToken, profile.value.slug)
    else await followProfile(authStore.accessToken, profile.value.slug)
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
onBeforeUnmount(() => document.documentElement.style.removeProperty('--route-bg'))
</script>

<template>
  <section class="pp-page">
    <div class="container-shell">
      <div v-if="loading" class="pp-skeleton">
        <div class="skeleton pp-skeleton__banner"></div>
        <div class="pp-skeleton__row">
          <div class="skeleton pp-skeleton__main"></div>
          <div class="skeleton pp-skeleton__side"></div>
        </div>
      </div>

      <div v-else-if="error && !profile" class="mx-auto max-w-3xl alert alert-error">{{ error }}</div>

      <article v-else-if="profile" class="pp" :style="pageVars">
        <!-- Cover + identity -->
        <header class="pp-head">
          <div class="pp-banner" :class="{ 'pp-banner--image': bannerUrl }" :style="bannerStyle"></div>

          <div class="pp-id">
            <div class="pp-avatar" :class="{ 'pp-avatar--pixel': !avatarUrl && headUrl }">
              <img v-if="avatarUrl" :src="avatarUrl" alt="" />
              <img v-else-if="headUrl" :src="headUrl" alt="" @error="headStage++" />
              <span v-else class="pp-avatar__letter">{{ avatarLetter }}</span>
            </div>

            <div class="pp-id__text">
              <div class="pp-name-row">
                <h1 class="pp-name">{{ displayName }}</h1>
                <span v-if="relation" class="pp-relation">{{ relation }}</span>
              </div>
              <div class="pp-sub">
                <span class="pp-slug">@{{ profile.slug }}</span>
                <span v-if="showNick" class="pp-ingame">{{ t('publicProfile.inGameAs') }} <b>{{ nick }}</b></span>
                <RouterLink v-if="nation?.slug" :to="nationLink" class="pp-chip pp-chip--nation">
                  <img v-if="nation.icon_preview_url || nation.icon_url" :src="nation.icon_preview_url || nation.icon_url" alt="" />
                  <span>{{ nation.title }}</span>
                  <span v-if="nation.tag && nation.tag.toLowerCase() !== String(nation.title).toLowerCase()" class="pp-chip__tag">{{ nation.tag }}</span>
                </RouterLink>
                <span v-if="bp?.premium" class="pp-chip pp-chip--premium" :title="t('publicProfile.premiumBadgeTooltip')">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6.5 6.8 9l3.2-5 3.2 5L17 6.5 15.5 15h-11z" fill="currentColor"/></svg>
                  Premium
                </span>
              </div>
              <p v-if="profile.status_text" class="pp-status">{{ profile.status_text }}</p>
            </div>

            <div class="pp-actions">
              <button v-if="canFollow" type="button" class="pp-btn"
                      :class="profile.viewer?.is_following ? 'pp-btn--following' : 'pp-btn--primary'"
                      :disabled="followLoading" @click="toggleFollow">
                <span v-if="followLoading" class="spinner"></span>
                <template v-else-if="profile.viewer?.is_following">
                  <svg class="pp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
                  <span class="pp-btn__idle">{{ t('publicProfile.youFollow') }}</span>
                  <span class="pp-btn__hover">{{ t('publicProfile.unfollow') }}</span>
                </template>
                <template v-else>
                  <svg class="pp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                  {{ t('publicProfile.follow') }}
                </template>
              </button>
              <RouterLink v-else-if="showGuestFollow" :to="loginToFollow" class="pp-btn pp-btn--primary">
                <svg class="pp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                {{ t('publicProfile.follow') }}
              </RouterLink>
              <RouterLink v-if="profile.viewer?.is_self" to="/profile/public" class="pp-btn">{{ t('publicProfile.edit') }}</RouterLink>
              <button type="button" class="pp-btn pp-btn--icon" :title="t('publicProfile.copyLink')" :aria-label="t('publicProfile.copyLink')" @click="copyProfileLink">
                <svg class="pp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.5 6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.7-1.6"/></svg>
              </button>
            </div>
          </div>

          <div class="pp-strip">
            <dl class="pp-counters">
              <div v-for="c in counters" :key="c.key" class="pp-counter">
                <dt>{{ c.label }}</dt>
                <dd>{{ c.value }}</dd>
              </div>
            </dl>
            <div v-if="socialLinks.length" class="pp-links">
              <a v-for="link in socialLinks" :key="link.key" :href="link.url" target="_blank" rel="noopener noreferrer nofollow"
                 class="pp-link" :style="{ '--chip': link.color }">
                <svg class="pp-link__ico" viewBox="0 0 24 24" aria-hidden="true"><path :d="SOCIAL_ICONS[link.key]" /></svg>
                {{ link.label }}
              </a>
            </div>
          </div>
        </header>

        <p v-if="actionMessage" class="pp-note pp-note--ok" role="status">{{ actionMessage }}</p>
        <p v-if="error" class="pp-note pp-note--err" role="alert">{{ error }}</p>

        <div class="pp-grid">
          <div class="pp-main">
            <section v-if="profile.bio" class="pp-card">
              <h2 class="pp-h">{{ t('publicProfile.about') }}</h2>
              <p class="pp-bio">{{ profile.bio }}</p>
            </section>

            <section class="pp-card">
              <h2 class="pp-h">{{ t('publicProfile.statsTitle') }}</h2>
              <template v-if="hasGameData">
                <dl class="pp-stats">
                  <div v-for="s in statTiles" :key="s.key" class="pp-stat" :class="`pp-stat--${s.key}`">
                    <svg class="pp-stat__ico" viewBox="0 0 24 24" aria-hidden="true"><path :d="STAT_ICONS[s.key]" /></svg>
                    <dd>{{ s.value }}</dd>
                    <dt>{{ s.label }}</dt>
                  </div>
                </dl>
                <template v-if="achievements.length">
                  <h3 class="pp-h3">{{ t('publicProfile.achievements') }} <span>{{ achievements.length }}</span></h3>
                  <ul class="pp-ach">
                    <li v-for="a in achievements" :key="a.key" class="pp-ach__item">
                      <span class="pp-ach__medal" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M12 2.5 20 7v10l-8 4.5L4 17V7Z" /><path class="pp-ach__star" d="m12 7.5 1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4Z" /></svg>
                      </span>
                      <span class="pp-ach__text">
                        <b>{{ a.title }}</b>
                        <span v-if="a.desc">{{ a.desc }}</span>
                      </span>
                    </li>
                  </ul>
                </template>
              </template>
              <p v-else class="pp-empty">{{ t('publicProfile.statsEmpty') }}</p>
            </section>
          </div>

          <aside class="pp-side">
            <section v-if="bp" class="pp-card pp-bp" :class="{ 'pp-bp--premium': bp.premium }">
              <div class="pp-bp__top">
                <h2 class="pp-h">Battle Pass</h2>
                <span v-if="bp.premium" class="pp-bp__tag">Premium</span>
              </div>
              <p v-if="bp.season" class="pp-bp__season">{{ bp.season }}</p>
              <p class="pp-bp__level">
                <span class="pp-bp__lvl-label">{{ t('publicProfile.level') }}</span>
                <span class="pp-bp__lvl">{{ bp.level }}</span>
                <small v-if="bp.max">/ {{ bp.max }}</small>
              </p>
              <div v-if="bp.max" class="pp-bar" role="progressbar" :aria-valuenow="bp.level" aria-valuemin="0" :aria-valuemax="bp.max">
                <div class="pp-bar__fill" :style="{ width: Math.max(bp.pct, 1.5) + '%' }"></div>
              </div>
              <p class="pp-bp__note">{{ bp.premium ? t('publicProfile.bpPremium') : t('publicProfile.bpFree') }}</p>
            </section>

            <section class="pp-card">
              <h2 class="pp-h">{{ t('publicProfile.details') }}</h2>
              <dl class="pp-facts">
                <div v-if="nick"><dt>{{ t('publicProfile.factNick') }}</dt><dd class="pp-mono">{{ nick }}</dd></div>
                <div v-if="nation">
                  <dt>{{ t('publicProfile.factNation') }}</dt>
                  <dd><RouterLink v-if="nationLink" :to="nationLink">{{ nation.title }}</RouterLink><template v-else>{{ nation.title }}</template></dd>
                </div>
                <div v-if="memberSince"><dt>{{ t('publicProfile.memberSince') }}</dt><dd>{{ memberSince }}</dd></div>
              </dl>
            </section>
          </aside>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.pp-page { padding-block: 24px 48px; }

.pp {
  --pp-bg: #0c0a16;
  --pp-surface: rgba(19, 16, 33, 0.8);
  --pp-surface-2: rgba(255, 255, 255, 0.035);
  --pp-line: rgba(255, 255, 255, 0.08);
  --pp-line-2: rgba(255, 255, 255, 0.14);
  --pp-text: #eeecf7;
  --pp-muted: #9d99b6;
  --pp-gold: #f2c14e;
  color: var(--pp-text);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── head ─────────────────────────────────────────────── */
.pp-head {
  position: relative;
  border-radius: 26px;
  overflow: hidden;
  background: var(--pp-surface);
  border: 1px solid var(--pp-line);
  backdrop-filter: blur(18px);
  box-shadow: 0 30px 80px -40px var(--pp-accent-glow), 0 1px 0 rgba(255, 255, 255, 0.04) inset;
}
.pp-banner {
  position: relative;
  aspect-ratio: 4 / 1;
  min-height: 170px;
  max-height: 300px;
  width: 100%;
  background-size: cover;
  background-position: center;
}
/* Fade the bottom of any cover into the card so the avatar and name always sit on dark ground. */
.pp-banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(19, 16, 33, 0) 62%, rgba(19, 16, 33, 0.5) 100%);
}
.pp-id {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 26px;
  align-items: end;
  padding: 18px 32px 22px;
}
.pp-avatar {
  width: 152px;
  height: 152px;
  border-radius: 28px;
  overflow: hidden;
  background: #1a1530;
  border: 5px solid #15122a;
  box-shadow: 0 0 0 1px var(--pp-accent-line), 0 24px 48px rgba(0, 0, 0, 0.5), 0 0 60px -10px var(--pp-accent-glow);
  display: grid;
  place-items: center;
  flex: none;
  margin-top: -96px;   /* only the avatar reaches into the cover */
}
.pp-avatar img { width: 100%; height: 100%; object-fit: cover; }
.pp-avatar--pixel img { image-rendering: pixelated; }
.pp-avatar__letter { font-size: 3.6rem; font-weight: 900; color: var(--pp-accent-ui); }

.pp-id__text { min-width: 0; padding-bottom: 2px; }
.pp-name-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
.pp-name {
  margin: 0;
  font-size: clamp(2rem, 1.3rem + 1.7vw, 3rem);
  line-height: 1;
  font-weight: 900;
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
}
.pp-relation {
  font-size: 0.8rem; font-weight: 700; color: #a7f3d0;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(52, 211, 153, 0.12); border: 1px solid rgba(52, 211, 153, 0.3);
}
.pp-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 12px; font-size: 0.95rem; color: var(--pp-muted); }
.pp-slug { color: #d6d2ea; font-weight: 600; }
.pp-ingame b { color: var(--pp-text); font-weight: 600; }
.pp-status { margin: 10px 0 0; max-width: 62ch; font-size: 1rem; line-height: 1.5; color: #cfcbe3; overflow-wrap: anywhere; }

.pp-chip {
  display: inline-flex; align-items: center; gap: 7px;
  height: 30px; padding: 0 11px; border-radius: 9px;
  font-size: 0.86rem; font-weight: 700; line-height: 1;
  border: 1px solid var(--pp-line-2); background: rgba(255, 255, 255, 0.05); color: var(--pp-text);
  text-decoration: none; white-space: nowrap;
  transition: background-color 0.15s, border-color 0.15s;
}
.pp-chip img { width: 18px; height: 18px; border-radius: 5px; object-fit: cover; }
.pp-chip--nation:hover { border-color: var(--pp-accent-line); background: var(--pp-accent-soft); }
.pp-chip__tag { color: var(--pp-muted); font-weight: 600; }
.pp-chip--premium { color: var(--pp-gold); border-color: rgba(242, 193, 78, 0.42); background: rgba(242, 193, 78, 0.1); }
.pp-chip--premium svg { width: 15px; height: 15px; }

.pp-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; padding-bottom: 4px; }
.pp-ico { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.pp-btn {
  position: relative;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 44px; padding: 0 18px; border-radius: 12px;
  font: inherit; font-size: 0.95rem; font-weight: 700; color: var(--pp-text); text-decoration: none; white-space: nowrap;
  background: rgba(255, 255, 255, 0.06); border: 1px solid var(--pp-line-2); cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.pp-btn:hover { background: rgba(255, 255, 255, 0.1); }
.pp-btn:active { transform: translateY(1px); }
.pp-btn--icon { width: 44px; padding: 0; }
.pp-btn--primary {
  min-width: 164px;
  color: var(--pp-on-accent);
  background: var(--pp-accent);
  border-color: transparent;
  box-shadow: 0 10px 30px -10px var(--pp-accent-glow), 0 0 0 1px rgba(255, 255, 255, 0.12) inset;
}
.pp-btn--primary:hover { background: var(--pp-accent); filter: brightness(1.08); box-shadow: 0 14px 34px -10px var(--pp-accent-glow), 0 0 0 1px rgba(255, 255, 255, 0.2) inset; }
.pp-btn--following { min-width: 164px; border-color: var(--pp-accent-line); background: var(--pp-accent-soft); }
.pp-btn__hover { display: none; }
.pp-btn--following:hover { border-color: rgba(248, 113, 113, 0.45); background: rgba(248, 113, 113, 0.1); color: #fecaca; }
.pp-btn--following:hover .pp-btn__idle { display: none; }
.pp-btn--following:hover .pp-btn__hover { display: inline; }
.pp-btn--following:hover .pp-ico { display: none; }
.pp-btn:disabled { opacity: 0.6; cursor: default; }
.pp-btn:focus-visible, .pp-chip:focus-visible, .pp-link:focus-visible, .pp-facts a:focus-visible { outline: 2px solid var(--pp-accent-ui); outline-offset: 2px; }

/* counters + social links under the identity */
.pp-strip {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px 24px;
  padding: 16px 32px 20px;
  border-top: 1px solid var(--pp-line);
  background: rgba(0, 0, 0, 0.14);
}
.pp-counters { display: flex; margin: 0; }
.pp-counter { display: flex; align-items: baseline; gap: 8px; padding: 0 22px; border-left: 1px solid var(--pp-line-2); }
.pp-counter:first-child { padding-left: 0; border-left: 0; }
.pp-counter dd { order: -1; margin: 0; font-size: 1.35rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.pp-counter dt { font-size: 0.9rem; color: var(--pp-muted); white-space: nowrap; }

.pp-links { display: flex; flex-wrap: wrap; gap: 8px; }
.pp-link {
  display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px 0 11px; border-radius: 10px;
  font-size: 0.9rem; font-weight: 700; color: var(--pp-text); text-decoration: none;
  border: 1px solid color-mix(in srgb, var(--chip) 38%, transparent);
  background: color-mix(in srgb, var(--chip) 12%, transparent);
  transition: background-color 0.15s, border-color 0.15s;
}
.pp-link:hover { background: color-mix(in srgb, var(--chip) 24%, transparent); border-color: color-mix(in srgb, var(--chip) 60%, transparent); }
.pp-link__ico { width: 17px; height: 17px; fill: var(--chip); flex: none; }

.pp-note { margin: 0; padding: 10px 14px; border-radius: 12px; font-size: 0.92rem; border: 1px solid var(--pp-line); }
.pp-note--ok { background: rgba(52, 211, 153, 0.1); border-color: rgba(52, 211, 153, 0.35); color: #a7f3d0; }
.pp-note--err { background: rgba(248, 113, 113, 0.1); border-color: rgba(248, 113, 113, 0.35); color: #fecaca; }

/* ── body ─────────────────────────────────────────────── */
.pp-grid { display: grid; grid-template-columns: minmax(0, 1fr) 350px; gap: 16px; align-items: start; }
.pp-main, .pp-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.pp-card {
  background: var(--pp-surface);
  border: 1px solid var(--pp-line);
  border-radius: 20px;
  padding: 24px 26px;
  backdrop-filter: blur(18px);
}
.pp-h { margin: 0 0 16px; font-size: 1.12rem; font-weight: 800; letter-spacing: -0.01em; }
.pp-h3 { margin: 26px 0 12px; font-size: 1rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.pp-h3 span { font-size: 0.78rem; font-weight: 800; color: var(--pp-gold); padding: 2px 8px; border-radius: 999px; background: rgba(242, 193, 78, 0.12); }
.pp-bio { margin: 0; max-width: 72ch; font-size: 1rem; line-height: 1.65; white-space: pre-line; overflow-wrap: anywhere; color: #d9d6ea; }
.pp-empty { margin: 0; color: var(--pp-muted); font-size: 0.95rem; line-height: 1.5; }

.pp-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 0; }
.pp-stat {
  position: relative;
  display: flex; flex-direction: column; gap: 6px;
  padding: 16px 18px 16px; min-width: 0;
  border-radius: 14px;
  background: var(--pp-surface-2);
  border: 1px solid var(--pp-line);
}
.pp-stat__ico { width: 20px; height: 20px; fill: none; stroke: var(--pp-accent-ui); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; opacity: 0.9; margin-bottom: 4px; }
.pp-stat dd { margin: 0; font-size: 1.55rem; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.pp-stat dt { font-size: 0.88rem; color: var(--pp-muted); }
.pp-stat--playtime { background: linear-gradient(160deg, var(--pp-accent-soft), var(--pp-surface-2) 70%); border-color: var(--pp-accent-line); }

.pp-ach { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
.pp-ach__item {
  display: flex; gap: 12px; align-items: center; padding: 11px 14px 11px 11px; border-radius: 14px;
  background: linear-gradient(135deg, rgba(242, 193, 78, 0.09), rgba(242, 193, 78, 0.02));
  border: 1px solid rgba(242, 193, 78, 0.2);
}
.pp-ach__medal { flex: none; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 11px; background: rgba(242, 193, 78, 0.12); }
.pp-ach__medal svg { width: 26px; height: 26px; }
.pp-ach__medal path { fill: rgba(242, 193, 78, 0.25); stroke: var(--pp-gold); stroke-width: 1.5; stroke-linejoin: round; }
.pp-ach__medal .pp-ach__star { fill: var(--pp-gold); stroke: none; }
.pp-ach__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pp-ach__text b { font-size: 0.94rem; color: #fbe7b5; }
.pp-ach__text span { font-size: 0.82rem; line-height: 1.35; color: var(--pp-muted); }

.pp-bp { position: relative; overflow: hidden; }
.pp-bp--premium { border-color: rgba(242, 193, 78, 0.32); background: radial-gradient(120% 90% at 100% 0%, rgba(242, 193, 78, 0.12), transparent 60%), var(--pp-surface); }
.pp-bp__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pp-bp__top .pp-h { margin-bottom: 0; }
.pp-bp__tag { font-size: 0.76rem; font-weight: 800; color: #1b1405; background: linear-gradient(135deg, #f7d27a, #e0a526); padding: 4px 9px; border-radius: 999px; }
.pp-bp__season { margin: 4px 0 0; font-size: 0.88rem; color: var(--pp-muted); }
.pp-bp__level { margin: 18px 0 12px; display: flex; align-items: baseline; gap: 8px; }
.pp-bp__lvl-label { font-size: 0.88rem; color: var(--pp-muted); }
.pp-bp__lvl { font-size: 3rem; font-weight: 900; line-height: 0.9; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
.pp-bp__level small { font-size: 1rem; color: var(--pp-muted); font-weight: 700; }
.pp-bar { height: 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.07); overflow: hidden; }
.pp-bar__fill { height: 100%; border-radius: inherit; background: var(--pp-accent-ui); box-shadow: 0 0 16px var(--pp-accent-glow); }
.pp-bp--premium .pp-bar__fill { background: linear-gradient(90deg, #e0a526, #f7d27a); box-shadow: 0 0 16px rgba(242, 193, 78, 0.45); }
.pp-bp__note { margin: 12px 0 0; font-size: 0.88rem; color: var(--pp-muted); }

.pp-facts { margin: 0; display: flex; flex-direction: column; }
.pp-facts > div { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 11px 0; border-top: 1px solid var(--pp-line); }
.pp-facts > div:first-child { border-top: 0; padding-top: 0; }
.pp-facts dt { color: var(--pp-muted); font-size: 0.92rem; }
.pp-facts dd { margin: 0; font-weight: 700; font-size: 0.95rem; text-align: right; overflow-wrap: anywhere; }
.pp-facts a { color: var(--pp-text); text-decoration: underline; text-decoration-color: var(--pp-accent-line); text-underline-offset: 4px; }
.pp-facts a:hover { text-decoration-color: var(--pp-accent-ui); }

/* ── skeleton ─────────────────────────────────────────── */
.pp-skeleton { display: flex; flex-direction: column; gap: 16px; }
.pp-skeleton__banner { height: 420px; border-radius: 26px; }
.pp-skeleton__row { display: grid; grid-template-columns: minmax(0, 1fr) 350px; gap: 16px; }
.pp-skeleton__main { height: 300px; border-radius: 20px; }
.pp-skeleton__side { height: 220px; border-radius: 20px; }

/* ── responsive ───────────────────────────────────────── */
@media (max-width: 1100px) {
  .pp-id { grid-template-columns: auto minmax(0, 1fr); }
  .pp-actions { grid-column: 1 / -1; justify-content: flex-start; }
  .pp-grid, .pp-skeleton__row { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .pp-page { padding-block: 12px 32px; }
  .pp-head { border-radius: 20px; }
  .pp-banner { aspect-ratio: 16 / 7; min-height: 0; }
  .pp-id { grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 0 18px 18px; }
  .pp-avatar { width: 108px; height: 108px; border-radius: 22px; border-width: 4px; margin-top: -54px; }
  .pp-actions .pp-btn--primary, .pp-actions .pp-btn--following { flex: 1; }
  .pp-strip { padding: 14px 18px 18px; flex-direction: column; align-items: stretch; }
  .pp-counters { justify-content: space-between; }
  .pp-counter { flex-direction: column; align-items: flex-start; gap: 4px; padding: 0 0 0 16px; flex: 1; }
  .pp-counter dt { font-size: 0.82rem; }
  .pp-card { padding: 18px; }
  .pp-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .pp-stat { padding: 14px; }
  .pp-stat dd { font-size: 1.3rem; }
}
@media (prefers-reduced-motion: reduce) {
  .pp-btn, .pp-chip, .pp-link { transition: none; }
}
</style>
