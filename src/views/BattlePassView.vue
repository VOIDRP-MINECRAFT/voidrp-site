<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore'
import { getBattlePassLeaderboard, getBattlePassProfile } from '../services/battlepassApi'
import { usePageMeta } from '../composables/usePageMeta.js'

usePageMeta({
  title: 'Боевой пропуск',
  description: 'Прогресс боевого пропуска сервера VoidRP — топ игроков, текущий сезон и ваш уровень.',
  url: 'https://void-rp.ru/battlepass',
})

const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(true)
const leaderboard = ref(null)
const myProfile = ref(null)

const MAX_LEVEL = 120
const XP_PER_LEVEL = 1000

const isAuthenticated = computed(() => !!auth.accessToken)

const podium = computed(() => leaderboard.value?.entries?.slice(0, 3) ?? [])
const rest = computed(() => leaderboard.value?.entries?.slice(3) ?? [])

// Progress bar = XP within the current level (0–1000), not overall season progress
function xpPercent(xp) {
  return Math.round((xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100)
}

function xpInLevel(xp) {
  return xp % XP_PER_LEVEL
}

function headUrl(nickname) {
  return `/api/v1/public/player-head/${encodeURIComponent(nickname)}`
}

function onHeadError(e, nickname) {
  e.currentTarget.onerror = null
  e.currentTarget.src = `https://mc-heads.net/avatar/${encodeURIComponent(nickname)}/32`
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' }).format(new Date(iso))
}

const PODIUM_CLASSES = ['bp-gold', 'bp-silver', 'bp-bronze']
const PODIUM_MEDALS = ['🥇', '🥈', '🥉']

async function load() {
  loading.value = true
  try {
    const [lb, profile] = await Promise.all([
      getBattlePassLeaderboard(),
      isAuthenticated.value && auth.playerAccount?.minecraft_uuid
        ? getBattlePassProfile(auth.playerAccount.minecraft_uuid).catch(() => null)
        : Promise.resolve(null),
    ])
    leaderboard.value = lb
    myProfile.value = profile
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="bp-page auth-page">

    <!-- ── Hero ──────────────────────────────────────────────────── -->
    <section class="bp-hero">
      <div class="bp-hero__glow" aria-hidden="true"></div>
      <div class="container-shell bp-hero__inner page-entry">
        <div class="bp-hero__badge">
          <span class="bp-star">✦</span>
          {{ leaderboard?.season ? t('battlepass.seasonLabel', { s: leaderboard.season }) : t('battlepass.seasonFallback') }}
        </div>
        <h1 class="bp-hero__title">{{ t('battlepass.title') }}</h1>
        <p class="bp-hero__desc">{{ t('battlepass.desc') }}</p>
      </div>
    </section>

    <div class="container-shell bp-body space-y-4">

      <!-- ── My card ────────────────────────────────────────────── -->
      <template v-if="isAuthenticated">
        <div v-if="loading" class="skeleton h-28 rounded-2xl"></div>

        <div v-else-if="myProfile" class="bp-mycard" :class="myProfile.has_premium ? 'bp-mycard--premium' : 'bp-mycard--free'">
          <div class="bp-mycard__left">
            <div class="bp-mycard__label">{{ t('battlepass.myProgress') }}</div>
            <div class="bp-mycard__level">
              {{ t('battlepass.level') }} <span class="bp-mycard__lvnum">{{ myProfile.level }}</span>
              <span class="bp-mycard__lvmax">/ {{ MAX_LEVEL }}</span>
            </div>
            <div class="bp-mycard__bar-wrap">
              <div
                class="bp-mycard__bar-fill"
                :style="{
                  width: xpPercent(myProfile.xp) + '%',
                  background: myProfile.has_premium
                    ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                    : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                }"
              ></div>
            </div>
            <div class="bp-mycard__xp">{{ xpInLevel(myProfile.xp) }} / {{ XP_PER_LEVEL }} XP</div>
          </div>
          <div class="bp-mycard__right">
            <span v-if="myProfile.has_premium" class="bp-badge bp-badge--premium">✦ Premium</span>
            <span v-else class="bp-badge bp-badge--free">{{ t('battlepass.freeTier') }}</span>
            <div v-if="myProfile.has_premium && myProfile.premium_expires_at" class="bp-mycard__expires">
              {{ t('battlepass.premiumUntil') }} {{ fmtDate(myProfile.premium_expires_at) }}
            </div>
          </div>
        </div>

        <div v-else class="surface-card bp-nodata">
          <span class="text-slate-400 text-sm">{{ t('battlepass.noData') }}</span>
        </div>
      </template>

      <!-- ── Guest CTA ──────────────────────────────────────────── -->
      <div v-else class="bp-guest-cta">
        <div class="bp-guest-cta__icon">✦</div>
        <div>
          <div class="bp-guest-cta__title">{{ t('battlepass.guestTitle') }}</div>
          <div class="bp-guest-cta__sub">{{ t('battlepass.guestSub') }}</div>
        </div>
        <RouterLink to="/login" class="bp-guest-cta__btn">{{ t('battlepass.guestBtn') }}</RouterLink>
      </div>

      <!-- ── Leaderboard ─────────────────────────────────────────── -->
      <section>
        <div class="section-kicker !mb-2">{{ t('battlepass.leaderboardKicker') }}</div>
        <h2 class="text-xl font-black tracking-tight text-slate-50 mb-3">{{ t('battlepass.leaderboardTitle') }}</h2>

        <!-- skeleton -->
        <div v-if="loading" class="space-y-2">
          <div v-for="i in 6" :key="i" class="skeleton h-14 rounded-2xl"></div>
        </div>

        <template v-else-if="leaderboard?.entries?.length">
          <!-- Podium top-3 -->
          <div class="bp-podium">
            <div
              v-for="(entry, i) in podium"
              :key="entry.minecraft_uuid"
              class="bp-podium__card"
              :class="PODIUM_CLASSES[i]"
            >
              <div class="bp-podium__medal">{{ PODIUM_MEDALS[i] }}</div>
              <img
                :src="headUrl(entry.minecraft_nickname)"
                :alt="entry.minecraft_nickname"
                class="bp-podium__avatar"
                @error="(e) => onHeadError(e, entry.minecraft_nickname)"
              />
              <RouterLink :to="`/u/${entry.minecraft_nickname}`" class="bp-podium__nick">
                {{ entry.minecraft_nickname }}
              </RouterLink>
              <div class="bp-podium__lvl">{{ t('battlepass.lvl') }} {{ entry.level }}</div>
              <div v-if="entry.has_premium" class="bp-badge bp-badge--premium bp-badge--sm">✦</div>
              <div class="bp-podium__bar-wrap">
                <div
                  class="bp-podium__bar-fill"
                  :style="{
                    width: xpPercent(entry.xp) + '%',
                    background: entry.has_premium
                      ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                      : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                  }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Rest of list -->
          <div v-if="rest.length" class="surface-card bp-table-card mt-3">
            <div class="bp-row bp-row--header">
              <span class="bp-col-rank">#</span>
              <span class="bp-col-player">{{ t('battlepass.colPlayer') }}</span>
              <span class="bp-col-level">{{ t('battlepass.colLevel') }}</span>
              <span class="bp-col-xp">XP</span>
            </div>
            <div
              v-for="entry in rest"
              :key="entry.minecraft_uuid"
              class="bp-row"
            >
              <span class="bp-col-rank text-slate-500">{{ entry.rank }}</span>
              <span class="bp-col-player">
                <img
                  :src="headUrl(entry.minecraft_nickname)"
                  :alt="entry.minecraft_nickname"
                  class="bp-row__avatar"
                  @error="(e) => onHeadError(e, entry.minecraft_nickname)"
                />
                <RouterLink :to="`/u/${entry.minecraft_nickname}`" class="bp-row__nick">
                  {{ entry.minecraft_nickname }}
                </RouterLink>
                <span v-if="entry.has_premium" class="bp-badge bp-badge--premium bp-badge--sm ml-1">✦</span>
              </span>
              <span class="bp-col-level font-bold text-slate-100">{{ entry.level }}</span>
              <span class="bp-col-xp">
                <div class="bp-row__bar-wrap">
                  <div
                    class="bp-row__bar-fill"
                    :style="{
                      width: xpPercent(entry.xp) + '%',
                      background: entry.has_premium
                        ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                        : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                    }"
                  ></div>
                </div>
                <span class="text-xs text-slate-500 ml-1">{{ entry.xp.toLocaleString() }}</span>
              </span>
            </div>
          </div>
        </template>

        <div v-else-if="!loading" class="surface-card bp-empty">
          <p class="text-slate-400 text-sm text-center py-6">{{ t('battlepass.empty') }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ── Page layout ───────────────────────────────────────────────── */
.bp-page { min-height: 100vh; }
.bp-body { padding-top: 1.5rem; padding-bottom: 3rem; }

/* ── Hero ──────────────────────────────────────────────────────── */
.bp-hero {
  position: relative;
  overflow: hidden;
  padding: 3rem 0 2.5rem;
  background: linear-gradient(180deg, rgba(245,158,11,0.07) 0%, transparent 100%);
  border-bottom: 1px solid rgba(245,158,11,0.08);
}
.bp-hero__glow {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 60% 60% at 50% 0%, rgba(245,158,11,0.12), transparent);
  pointer-events: none;
}
.bp-hero__inner { position: relative; z-index: 1; }
.bp-hero__badge {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: rgba(245,158,11,0.12);
  border: 1px solid rgba(245,158,11,0.25);
  color: #fbbf24;
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 0.3rem 0.75rem; border-radius: 999px; margin-bottom: 1rem;
}
.bp-star { font-size: 0.6rem; }
.bp-hero__title {
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 900; letter-spacing: -0.03em;
  color: #f8fafc;
  line-height: 1.1; margin-bottom: 0.75rem;
}
.bp-hero__desc {
  font-size: 0.9rem; color: #94a3b8; max-width: 520px; line-height: 1.6;
}

/* ── My card ───────────────────────────────────────────────────── */
.bp-mycard {
  display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  border-radius: 1.25rem;
  flex-wrap: wrap;
}
.bp-mycard--premium {
  background: linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(249,115,22,0.06) 100%);
  border: 1px solid rgba(245,158,11,0.25);
}
.bp-mycard--free {
  background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.06) 100%);
  border: 1px solid rgba(99,102,241,0.2);
}
.bp-mycard__label {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: #64748b; margin-bottom: 0.4rem;
}
.bp-mycard__level { font-size: 1rem; color: #cbd5e1; margin-bottom: 0.6rem; }
.bp-mycard__lvnum { font-size: 1.6rem; font-weight: 900; color: #f8fafc; margin: 0 0.15rem; }
.bp-mycard__lvmax { font-size: 0.85rem; color: #475569; }
.bp-mycard__bar-wrap {
  width: 220px; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.07); overflow: hidden;
}
.bp-mycard__bar-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
.bp-mycard__xp { font-size: 0.72rem; color: #64748b; margin-top: 0.4rem; }
.bp-mycard__right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
.bp-mycard__expires { font-size: 0.7rem; color: #92400e; }

/* ── Badges ────────────────────────────────────────────────────── */
.bp-badge {
  display: inline-flex; align-items: center; gap: 0.25rem;
  border-radius: 999px; font-weight: 700; padding: 0.25rem 0.65rem; font-size: 0.72rem;
}
.bp-badge--premium {
  background: rgba(245,158,11,0.18); border: 1px solid rgba(245,158,11,0.35); color: #fbbf24;
}
.bp-badge--free {
  background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.3); color: #94a3b8;
}
.bp-badge--sm { padding: 0.15rem 0.45rem; font-size: 0.65rem; }

/* ── Guest CTA ─────────────────────────────────────────────────── */
.bp-guest-cta {
  display: flex; align-items: center; gap: 1rem;
  padding: 1.25rem 1.5rem; border-radius: 1.25rem;
  background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.18);
  flex-wrap: wrap;
}
.bp-guest-cta__icon {
  font-size: 1.5rem; color: #818cf8; width: 2.5rem; height: 2.5rem;
  display: flex; align-items: center; justify-content: center;
  background: rgba(99,102,241,0.12); border-radius: 0.75rem;
  flex-shrink: 0;
}
.bp-guest-cta__title { font-weight: 700; color: #e2e8f0; font-size: 0.95rem; }
.bp-guest-cta__sub { font-size: 0.8rem; color: #64748b; margin-top: 0.15rem; }
.bp-guest-cta__btn {
  margin-left: auto;
  background: #6366f1; color: #fff;
  font-size: 0.8rem; font-weight: 700;
  padding: 0.5rem 1.2rem; border-radius: 999px;
  text-decoration: none; transition: background 0.15s;
  white-space: nowrap;
}
.bp-guest-cta__btn:hover { background: #4f46e5; }

/* ── Podium ────────────────────────────────────────────────────── */
.bp-podium {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;
}
@media (max-width: 640px) {
  .bp-podium { grid-template-columns: 1fr; }
}
.bp-podium__card {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.4rem; padding: 1.25rem 1rem 1rem;
  border-radius: 1.25rem; border: 1px solid transparent; text-align: center;
}
.bp-gold   { background: linear-gradient(145deg,rgba(245,158,11,.14),rgba(251,191,36,.06)); border-color: rgba(245,158,11,.28); }
.bp-silver { background: linear-gradient(145deg,rgba(148,163,184,.12),rgba(100,116,139,.05)); border-color: rgba(148,163,184,.2); }
.bp-bronze { background: linear-gradient(145deg,rgba(180,120,60,.12),rgba(140,90,40,.05)); border-color: rgba(180,120,60,.22); }
.bp-podium__medal { font-size: 1.5rem; }
.bp-podium__avatar { width: 48px; height: 48px; border-radius: 0.5rem; image-rendering: pixelated; }
.bp-podium__nick {
  font-weight: 700; font-size: 0.85rem; color: #e2e8f0; text-decoration: none;
}
.bp-podium__nick:hover { color: #f8fafc; }
.bp-podium__lvl { font-size: 0.78rem; color: #94a3b8; }
.bp-podium__bar-wrap {
  width: 100%; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.07); overflow: hidden;
}
.bp-podium__bar-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }

/* ── Table rows ────────────────────────────────────────────────── */
.bp-table-card { padding: 0; overflow: hidden; }
.bp-row {
  display: grid;
  grid-template-columns: 2.5rem 1fr 3.5rem 6rem;
  align-items: center;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  gap: 0.5rem;
}
.bp-row:last-child { border-bottom: none; }
.bp-row--header {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.07em;
  text-transform: uppercase; color: #475569;
  border-bottom: 1px solid rgba(255,255,255,0.07) !important;
  padding-top: 0.75rem; padding-bottom: 0.75rem;
}
.bp-col-rank { text-align: center; font-size: 0.8rem; font-weight: 600; }
.bp-col-player { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.bp-col-level { text-align: center; font-size: 0.82rem; }
.bp-col-xp { display: flex; align-items: center; gap: 0.4rem; }
.bp-row__avatar { width: 24px; height: 24px; border-radius: 4px; image-rendering: pixelated; flex-shrink: 0; }
.bp-row__nick {
  font-size: 0.82rem; font-weight: 600; color: #cbd5e1; text-decoration: none;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bp-row__nick:hover { color: #f8fafc; }
.bp-row__bar-wrap { flex: 1; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.07); overflow: hidden; }
.bp-row__bar-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }

/* ── Misc ──────────────────────────────────────────────────────── */
.bp-nodata, .bp-empty {
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem; border-radius: 1.25rem;
}
</style>
