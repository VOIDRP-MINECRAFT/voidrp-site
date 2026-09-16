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

function hexToRgba(hex, alpha) {
  const v = String(hex || '').replace('#', '')
  const n = v.length === 3 ? v.split('').map((x) => x + x).join('') : v
  if (n.length !== 6) return `rgba(139, 92, 246, ${alpha})`
  const i = Number.parseInt(n, 16)
  return `rgba(${(i >> 16) & 255}, ${(i >> 8) & 255}, ${i & 255}, ${alpha})`
}

const pageVars = computed(() => ({
  '--pp-accent': accent.value,
  '--pp-accent-soft': hexToRgba(accent.value, 0.16),
  '--pp-accent-line': hexToRgba(accent.value, 0.38),
}))

const bannerStyle = computed(() => (bannerUrl.value
  ? { backgroundImage: `linear-gradient(180deg, rgba(13,11,23,0) 45%, rgba(13,11,23,0.85)), url(${bannerUrl.value})` }
  : { backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${hexToRgba(accent.value, 0.55)} 0%, transparent 55%), radial-gradient(90% 120% at 100% 100%, ${hexToRgba(accent.value, 0.25)} 0%, transparent 60%), linear-gradient(135deg, #1a1530, #0d0b17)` }))

const routeBackground = computed(() => {
  if (!backgroundUrl.value) {
    return `radial-gradient(circle at 15% 0%, ${hexToRgba(accent.value, 0.18)} 0%, transparent 30%), linear-gradient(180deg, #07060d 0%, #0d0b17 100%)`
  }
  return `linear-gradient(180deg, rgba(7,6,13,0.7), rgba(7,6,13,0.92)), url(${backgroundUrl.value})`
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
          <div class="pp-banner" :style="bannerStyle"></div>

          <div class="pp-id">
            <div class="pp-avatar" :class="{ 'pp-avatar--pixel': !avatarUrl && headUrl }">
              <img v-if="avatarUrl" :src="avatarUrl" alt="" />
              <img v-else-if="headUrl" :src="headUrl" alt="" @error="headStage++" />
              <span v-else class="pp-avatar__letter">{{ avatarLetter }}</span>
            </div>

            <div class="pp-id__text">
              <h1 class="pp-name">{{ displayName }}</h1>
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

            <div class="pp-id__side">
              <div class="pp-actions">
                <button v-if="canFollow" class="pp-btn pp-btn--primary" :disabled="followLoading" @click="toggleFollow">
                  <span v-if="followLoading" class="spinner"></span>
                  <span v-else>{{ profile.viewer?.is_following ? t('publicProfile.unfollow') : t('publicProfile.follow') }}</span>
                </button>
                <RouterLink v-if="profile.viewer?.is_self" to="/profile/public" class="pp-btn">{{ t('publicProfile.edit') }}</RouterLink>
                <button type="button" class="pp-btn" @click="copyProfileLink">{{ t('publicProfile.copyLink') }}</button>
              </div>
              <dl class="pp-counters">
                <div v-for="c in counters" :key="c.key" class="pp-counter">
                  <dt>{{ c.label }}</dt>
                  <dd>{{ c.value }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </header>

        <p v-if="actionMessage" class="pp-note pp-note--ok" role="status">{{ actionMessage }}</p>
        <p v-if="error" class="pp-note pp-note--err" role="alert">{{ error }}</p>

        <div class="pp-grid">
          <div class="pp-main">
            <section class="pp-card">
              <h2 class="pp-h">{{ t('publicProfile.about') }}</h2>
              <p v-if="profile.bio" class="pp-bio">{{ profile.bio }}</p>
              <p v-else class="pp-empty">{{ t('publicProfile.noBio') }}</p>
              <div v-if="socialLinks.length" class="pp-links">
                <a v-for="link in socialLinks" :key="link.key" :href="link.url" target="_blank" rel="noopener noreferrer nofollow"
                   class="pp-link" :style="{ '--chip': link.color }">
                  <span class="pp-link__dot"></span>{{ link.label }}
                </a>
              </div>
            </section>

            <section class="pp-card">
              <h2 class="pp-h">{{ t('publicProfile.statsTitle') }}</h2>
              <template v-if="hasGameData">
                <dl class="pp-stats">
                  <div v-for="s in statTiles" :key="s.key" class="pp-stat">
                    <dd>{{ s.value }}</dd>
                    <dt>{{ s.label }}</dt>
                  </div>
                </dl>
                <template v-if="achievements.length">
                  <h3 class="pp-h3">{{ t('publicProfile.achievements') }} <span>{{ achievements.length }}</span></h3>
                  <ul class="pp-ach">
                    <li v-for="a in achievements" :key="a.key" class="pp-ach__item">
                      <span class="pp-ach__mark" aria-hidden="true"></span>
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
                <span v-if="bp.season" class="pp-bp__season">{{ bp.season }}</span>
              </div>
              <p class="pp-bp__level"><span>{{ bp.level }}</span><small v-if="bp.max">/ {{ bp.max }}</small></p>
              <div v-if="bp.max" class="pp-bar" role="progressbar" :aria-valuenow="bp.level" aria-valuemin="0" :aria-valuemax="bp.max">
                <div class="pp-bar__fill" :style="{ width: Math.max(bp.pct, 1) + '%' }"></div>
              </div>
              <p class="pp-bp__note">{{ bp.premium ? t('publicProfile.bpPremium') : t('publicProfile.bpFree') }}</p>
            </section>

            <section class="pp-card">
              <h2 class="pp-h">{{ t('publicProfile.details') }}</h2>
              <dl class="pp-facts">
                <div v-if="nick"><dt>{{ t('publicProfile.factNick') }}</dt><dd>{{ nick }}</dd></div>
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
.pp-page { padding-block: 24px 40px; }

.pp {
  --pp-bg: #0d0b17;
  --pp-surface: rgba(21, 18, 38, 0.82);
  --pp-line: rgba(255, 255, 255, 0.08);
  --pp-text: #eceaf6;
  --pp-muted: #9a96b3;
  --pp-gold: #f2c14e;
  color: var(--pp-text);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── head ─────────────────────────────────────────────── */
.pp-head {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  background: var(--pp-surface);
  border: 1px solid var(--pp-line);
  backdrop-filter: blur(14px);
}
.pp-banner {
  height: 220px;
  background-size: cover;
  background-position: center;
  border-bottom: 1px solid var(--pp-line);
}
.pp-id {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 24px;
  align-items: start;
  padding: 18px 28px 24px;
}
.pp-avatar {
  width: 140px;
  height: 140px;
  border-radius: 22px;
  overflow: hidden;
  background: #1a1530;
  border: 4px solid var(--pp-bg);
  box-shadow: 0 0 0 1px var(--pp-accent-line), 0 20px 40px rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  position: relative;
  margin-top: -88px;   /* only the head overlaps the cover */
}
.pp-avatar img { width: 100%; height: 100%; object-fit: cover; }
.pp-avatar--pixel img { image-rendering: pixelated; }
.pp-avatar__letter { font-size: 3.4rem; font-weight: 900; color: var(--pp-accent); }

.pp-id__text { min-width: 0; }
.pp-name {
  margin: 0;
  font-size: clamp(1.9rem, 1.2rem + 1.6vw, 2.75rem);
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
.pp-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 10px; font-size: 0.95rem; color: var(--pp-muted); }
.pp-slug { color: var(--pp-text); font-weight: 600; }
.pp-ingame b { color: var(--pp-text); font-weight: 600; }
.pp-status { margin: 10px 0 0; max-width: 62ch; font-size: 1rem; line-height: 1.5; color: #cfcbe3; overflow-wrap: anywhere; }

.pp-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 28px; padding: 0 10px; border-radius: 8px;
  font-size: 0.85rem; font-weight: 700; line-height: 1;
  border: 1px solid var(--pp-line); background: rgba(255, 255, 255, 0.04); color: var(--pp-text);
  text-decoration: none; white-space: nowrap;
}
.pp-chip img { width: 18px; height: 18px; border-radius: 4px; object-fit: cover; }
.pp-chip--nation:hover { border-color: var(--pp-accent-line); background: var(--pp-accent-soft); }
.pp-chip__tag { color: var(--pp-muted); font-weight: 600; }
.pp-chip--premium { color: var(--pp-gold); border-color: rgba(242, 193, 78, 0.4); background: rgba(242, 193, 78, 0.1); }
.pp-chip--premium svg { width: 15px; height: 15px; }

.pp-id__side { display: flex; flex-direction: column; align-items: flex-end; gap: 16px; }
.pp-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.pp-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 40px; padding: 0 16px; border-radius: 10px;
  font: inherit; font-size: 0.92rem; font-weight: 700; color: var(--pp-text); text-decoration: none; white-space: nowrap;
  background: rgba(255, 255, 255, 0.05); border: 1px solid var(--pp-line); cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.pp-btn:hover { background: rgba(255, 255, 255, 0.09); }
.pp-btn--primary { background: var(--pp-accent); border-color: transparent; color: #fff; }
.pp-btn--primary:hover { background: var(--pp-accent); filter: brightness(1.1); }
.pp-btn:disabled { opacity: 0.6; cursor: default; }
.pp-btn:focus-visible, .pp-chip:focus-visible, .pp-link:focus-visible, .pp-facts a:focus-visible { outline: 2px solid var(--pp-accent); outline-offset: 2px; }

.pp-counters { display: flex; gap: 28px; margin: 0; }
.pp-counter { display: flex; flex-direction: column-reverse; align-items: flex-end; }
.pp-counter dd { margin: 0; font-size: 1.5rem; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
.pp-counter dt { font-size: 0.85rem; color: var(--pp-muted); white-space: nowrap; }

.pp-note { margin: 0; padding: 10px 14px; border-radius: 12px; font-size: 0.92rem; border: 1px solid var(--pp-line); }
.pp-note--ok { background: rgba(52, 211, 153, 0.1); border-color: rgba(52, 211, 153, 0.35); color: #a7f3d0; }
.pp-note--err { background: rgba(248, 113, 113, 0.1); border-color: rgba(248, 113, 113, 0.35); color: #fecaca; }

/* ── body ─────────────────────────────────────────────── */
.pp-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
.pp-main, .pp-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.pp-card {
  background: var(--pp-surface);
  border: 1px solid var(--pp-line);
  border-radius: 18px;
  padding: 22px 24px;
  backdrop-filter: blur(14px);
}
.pp-h { margin: 0 0 14px; font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em; }
.pp-h3 { margin: 22px 0 12px; font-size: 0.98rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.pp-h3 span { font-size: 0.8rem; font-weight: 700; color: var(--pp-muted); padding: 2px 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); }
.pp-bio { margin: 0; max-width: 72ch; font-size: 1rem; line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; color: #d9d6ea; }
.pp-empty { margin: 0; color: var(--pp-muted); font-size: 0.95rem; line-height: 1.5; }

.pp-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.pp-link {
  display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: 9px;
  font-size: 0.88rem; font-weight: 700; color: var(--pp-text); text-decoration: none;
  border: 1px solid color-mix(in srgb, var(--chip) 40%, transparent);
  background: color-mix(in srgb, var(--chip) 12%, transparent);
}
.pp-link:hover { background: color-mix(in srgb, var(--chip) 22%, transparent); }
.pp-link__dot { width: 8px; height: 8px; border-radius: 999px; background: var(--chip); }

.pp-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin: 0; border-radius: 14px; overflow: hidden; background: var(--pp-line); border: 1px solid var(--pp-line); }
.pp-stat { display: flex; flex-direction: column; gap: 4px; padding: 16px 18px; background: rgba(13, 11, 23, 0.72); min-width: 0; }
.pp-stat dd { margin: 0; font-size: 1.6rem; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.pp-stat dt { font-size: 0.88rem; color: var(--pp-muted); }

.pp-ach { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.pp-ach__item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; background: rgba(242, 193, 78, 0.06); border: 1px solid rgba(242, 193, 78, 0.2); }
.pp-ach__mark { flex: none; width: 10px; height: 10px; margin-top: 5px; background: var(--pp-gold); transform: rotate(45deg); border-radius: 2px; }
.pp-ach__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pp-ach__text b { font-size: 0.92rem; color: #fbe7b5; }
.pp-ach__text span { font-size: 0.82rem; line-height: 1.35; color: var(--pp-muted); }

.pp-bp__top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.pp-bp__top .pp-h { margin-bottom: 0; }
.pp-bp__season { font-size: 0.85rem; color: var(--pp-muted); text-align: right; }
.pp-bp__level { margin: 14px 0 10px; display: flex; align-items: baseline; gap: 6px; }
.pp-bp__level span { font-size: 2.6rem; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
.pp-bp__level small { font-size: 1rem; color: var(--pp-muted); font-weight: 600; }
.pp-bar { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.pp-bar__fill { height: 100%; border-radius: inherit; background: var(--pp-accent); }
.pp-bp--premium .pp-bar__fill { background: linear-gradient(90deg, #e0a526, var(--pp-gold)); }
.pp-bp--premium { border-color: rgba(242, 193, 78, 0.3); }
.pp-bp__note { margin: 10px 0 0; font-size: 0.88rem; color: var(--pp-muted); }

.pp-facts { margin: 0; display: flex; flex-direction: column; }
.pp-facts > div { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-top: 1px solid var(--pp-line); }
.pp-facts > div:first-child { border-top: 0; padding-top: 0; }
.pp-facts dt { color: var(--pp-muted); font-size: 0.92rem; }
.pp-facts dd { margin: 0; font-weight: 600; font-size: 0.95rem; text-align: right; overflow-wrap: anywhere; }
.pp-facts a { color: var(--pp-text); text-decoration: underline; text-decoration-color: var(--pp-accent-line); text-underline-offset: 3px; }
.pp-facts a:hover { text-decoration-color: var(--pp-accent); }

/* ── skeleton ─────────────────────────────────────────── */
.pp-skeleton { display: flex; flex-direction: column; gap: 16px; }
.pp-skeleton__banner { height: 360px; border-radius: 24px; }
.pp-skeleton__row { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; }
.pp-skeleton__main { height: 260px; border-radius: 18px; }
.pp-skeleton__side { height: 200px; border-radius: 18px; }

/* ── responsive ───────────────────────────────────────── */
@media (max-width: 1100px) {
  .pp-id { grid-template-columns: auto minmax(0, 1fr); }
  .pp-id__side { grid-column: 1 / -1; flex-direction: row; justify-content: space-between; align-items: center; flex-wrap: wrap; }
  .pp-counter { align-items: flex-start; }
  .pp-grid, .pp-skeleton__row { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .pp-banner { height: 150px; }
  .pp-id { grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 0 18px 18px; }
  .pp-avatar { width: 104px; height: 104px; border-radius: 18px; margin-top: -52px; }
  .pp-id__side { flex-direction: column; align-items: stretch; }
  .pp-actions { justify-content: flex-start; }
  .pp-counters { gap: 22px; }
  .pp-card { padding: 18px; }
  .pp-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pp-stat dd { font-size: 1.35rem; }
}
</style>
