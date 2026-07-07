<script setup>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '../config.site.js'
import { useReveal } from '../composables/useReveal.js'
import { usePageMeta } from '../composables/usePageMeta.js'
import { getServerStats, getNationRankings } from '../services/nationStatsApi.js'
import { apiRequest } from '../services/apiBase.js'
import { serverState, activeServer, fetchServers, setActiveServer } from '../stores/serverStore'

function getLandingScreenshots() { return apiRequest('/landing/screenshots') }

const { t } = useI18n()

useReveal()
usePageMeta({
  title: 'VoidRP (Войд РП) — Майнкрафт Roleplay сервер',
  description: 'Войд РП — майнкрафт ролевой сервер с живой экономикой, государствами, альянсами и сотнями модов. VoidRP: единый аккаунт, удобный лаунчер — void-rp.ru.',
})

// ── Multi-server ───────────────────────────────────────────────────────────
const servers = computed(() =>
  [...serverState.list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
)

// Sum of live players across all servers; null until at least one server
// reports an online status (falls back to the generic "server is online" text).
const totalOnline = computed(() => {
  let any = false
  let sum = 0
  for (const s of serverState.list) {
    if (s.status?.online) {
      any = true
      sum += s.status.players_online ?? 0
    }
  }
  return any ? sum : null
})

const serverAddress = computed(() => {
  const s = activeServer.value
  if (!s) return siteConfig.serverIp
  return s.port && s.port !== 25565 ? `${s.host}:${s.port}` : s.host
})

const mapUrl = computed(() => activeServer.value?.map_url || siteConfig.bluemapUrl)

// ── Per-server theme ────────────────────────────────────────────────────────
// The whole page is tinted with the active server's accent color and its
// banner becomes the hero background (crossfaded on switch) — the site
// counterpart of the launcher's server-hero.
const ACCENT_FALLBACK = '#7c3aed'

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return [124, 58, 237]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mixRgb(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

const themeVars = computed(() => {
  const base = parseHex(activeServer.value?.accent_color || ACCENT_FALLBACK)
  const dark = mixRgb(base, [0, 0, 0], 0.28)
  const deep = mixRgb(base, [0, 0, 0], 0.12)
  const soft = mixRgb(base, [255, 255, 255], 0.32)
  const pale = mixRgb(base, [255, 255, 255], 0.56)
  const rgb = (c) => c.join(', ')
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
  return {
    '--srv': hex(base),
    '--srv-dark': hex(dark),
    '--srv-soft': hex(soft),
    '--srv-pale': hex(pale),
    '--srv-rgb': rgb(base),
    '--srv-deep-rgb': rgb(deep),
    '--srv-soft-rgb': rgb(soft),
    '--srv-pale-rgb': rgb(pale),
  }
})

// Hero banner crossfade: the layer list holds the current banner; the
// TransitionGroup in the template fades the outgoing layer while the new
// one animates in on top.
const bannerLayers = ref([])
let bannerLayerKey = 0

watch(
  () => activeServer.value?.banner_url,
  (url, old) => {
    if (!bannerLayers.value.length || url !== old) {
      bannerLayers.value = [{ key: ++bannerLayerKey, url: url || null }]
    }
  },
  { immediate: true },
)

// Refetch server-scoped data in place when the active server changes (the
// home route is excluded from App.vue's remount-by-slug key).
let scopedWatcherReady = false

async function refetchScoped() {
  nationsLoading.value = true
  const [stats, rankings] = await Promise.allSettled([getServerStats(), getNationRankings()])
  if (stats.status === 'fulfilled') {
    statsData.value = stats.value
    if (statsAnimated) {
      if (statPlayersEl.value) countUp(statPlayersEl.value, stats.value.total_players, 900)
      if (statNationsEl.value) countUp(statNationsEl.value, stats.value.total_nations, 900)
    }
  }
  topNations.value =
    rankings.status === 'fulfilled' ? (rankings.value.items || []).slice(0, 3) : []
  nationsLoading.value = false
  await nextTick()
  bindSpotlight()
}

watch(
  () => serverState.activeSlug,
  () => {
    if (scopedWatcherReady) refetchScoped()
  },
)

// Feature flag of the ACTIVE server; absent/unknown key ⇒ enabled.
function feat(key) {
  const f = activeServer.value?.features
  if (!f) return true
  return f[key] !== false
}

function statusMeta(s) {
  if (s.maintenance) return { label: t('servers.maintenance'), cls: 'is-maint' }
  return s.status?.online
    ? { label: t('servers.online'), cls: 'is-online' }
    : { label: t('servers.offline'), cls: 'is-offline' }
}

function worldAddress(s) {
  return s.port && s.port !== 25565 ? `${s.host}:${s.port}` : s.host
}

function chooseWorld(s) {
  // App.vue keys <RouterView> by the active slug, so this remounts the page
  // and every scoped section (stats, nations) refetches for the new server.
  if (s.slug !== serverState.activeSlug) setActiveServer(s.slug)
}

const ipCopied = ref(false)
function copyIp() {
  navigator.clipboard.writeText(serverAddress.value).then(() => {
    ipCopied.value = true
    setTimeout(() => { ipCopied.value = false }, 2000)
  })
}

// ── Stats counter ──────────────────────────────────────────────────────────
const statPlayersEl = ref(null)
const statNationsEl = ref(null)
const statsData = ref(null)
let statsAnimated = false
let statsObserver = null

function countUp(el, target, duration = 1500) {
  const start = performance.now()
  const step = (now) => {
    const p = Math.min((now - start) / duration, 1)
    const ease = 1 - Math.pow(1 - p, 4)
    el.textContent = Math.round(ease * target).toLocaleString('ru')
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function triggerCountUp() {
  if (statsAnimated || !statsData.value) return
  statsAnimated = true
  if (statPlayersEl.value) countUp(statPlayersEl.value, statsData.value.total_players)
  if (statNationsEl.value) countUp(statNationsEl.value, statsData.value.total_nations)
}

// ── Screenshots ────────────────────────────────────────────────────────────
const screenshots = ref([])

// ── Top nations ────────────────────────────────────────────────────────────
const topNations = ref([])
const nationsLoading = ref(true)

// ── Spotlight (mouse follow) ───────────────────────────────────────────────
const LIGHT_SELECTOR = '.step-card, .feat-card, .launcher-card, .cta-card, .nation-card, .world-card'
let lightCleanup = []

function bindSpotlight() {
  document.querySelectorAll(LIGHT_SELECTOR).forEach((card) => {
    if (card.dataset.litBound) return
    card.dataset.litBound = '1'
    function onMove(e) {
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px')
      card.style.setProperty('--my', (e.clientY - r.top) + 'px')
      card.classList.add('lit')
    }
    function onLeave() { card.classList.remove('lit') }
    card.addEventListener('mousemove', onMove)
    card.addEventListener('mouseleave', onLeave)
    lightCleanup.push(() => {
      card.removeEventListener('mousemove', onMove)
      card.removeEventListener('mouseleave', onLeave)
    })
  })
}

onMounted(async () => {
  bindSpotlight()
  const slugAtStart = serverState.activeSlug

  // Fetch all data in parallel
  const [stats, rankings, shots] = await Promise.allSettled([
    getServerStats(),
    getNationRankings(),
    getLandingScreenshots(),
    fetchServers(),
  ])

  if (shots.status === 'fulfilled') {
    screenshots.value = shots.value || []
  }

  if (stats.status === 'fulfilled') {
    statsData.value = stats.value
    // Observe stats bar; trigger count-up when visible
    const statsBar = document.querySelector('.stats-bar')
    if (statsBar) {
      statsObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            triggerCountUp()
            statsObserver.disconnect()
          }
        },
        { threshold: 0.3 },
      )
      statsObserver.observe(statsBar)
    }
  }

  if (rankings.status === 'fulfilled') {
    topNations.value = (rankings.value.items || []).slice(0, 3)
  }
  nationsLoading.value = false

  // World/nation cards render after the fetches — attach spotlight to them too.
  await nextTick()
  bindSpotlight()

  // The server list may have resolved a different default slug mid-mount —
  // refetch scoped data once so stats/nations match the active server.
  scopedWatcherReady = true
  if (serverState.activeSlug !== slugAtStart) refetchScoped()
})

onUnmounted(() => {
  lightCleanup.forEach((fn) => fn())
  lightCleanup = []
  statsObserver?.disconnect()
})

function nationAccent(nation) {
  return nation.accent_color || activeServer.value?.accent_color || '#7c3aed'
}
</script>

<template>
  <div class="home-root" :style="themeVars">
  <!-- ═══════════════════════ HERO ═══════════════════════ -->
  <section class="hero">
    <!-- per-server banner background, crossfaded on switch -->
    <div class="hero__banner" aria-hidden="true">
      <TransitionGroup name="banner">
        <div
          v-for="layer in bannerLayers"
          :key="layer.key"
          class="hero__banner-img"
          :style="layer.url ? { backgroundImage: `url(${layer.url})` } : {}"
        ></div>
      </TransitionGroup>
      <div class="hero__banner-tint"></div>
      <div class="hero__banner-veil"></div>
    </div>

    <div class="hero__noise"></div>
    <div class="hero__grid"></div>
    <div class="hero__orb hero__orb--1"></div>
    <div class="hero__orb hero__orb--2"></div>
    <div class="hero__orb hero__orb--3"></div>

    <!-- ambient bloom pulse on load -->
    <div class="hero__bloom" aria-hidden="true"></div>

    <!-- floating Minecraft items -->
    <div class="hero__mc-stage" aria-hidden="true">
      <img class="mc-item mc-item--sword"    src="/item-icons/minecraft/diamond_sword.png" alt="">
      <img class="mc-item mc-item--beacon"   src="/item-icons/minecraft/beacon.png" alt="">
      <img class="mc-item mc-item--star"     src="/item-icons/minecraft/nether_star.png" alt="">
      <img class="mc-item mc-item--egg"      src="/item-icons/minecraft/dragon_egg.png" alt="">
      <img class="mc-item mc-item--diamond"  src="/item-icons/minecraft/diamond.png" alt="">
      <img class="mc-item mc-item--table"    src="/item-icons/minecraft/enchanting_table.png" alt="">
      <img class="mc-item mc-item--obsidian" src="/item-icons/minecraft/obsidian.png" alt="">
    </div>

    <!-- gradient veil fading hero into page -->
    <div class="hero__bottom-veil" aria-hidden="true"></div>

    <div class="container-shell hero__inner">
      <div class="hero__badge anim-hero anim-d0">
        <span class="hero__badge-dot"></span>
        <Transition name="srv-swap" mode="out-in">
          <span :key="activeServer?.slug || 'default'" class="hero__badge-text">
            <template v-if="activeServer">VoidRP · {{ activeServer.name }} · MC {{ activeServer.mc_version }}</template>
            <template v-else>VoidRP · Minecraft Roleplay · {{ siteConfig.serverVersion }}</template>
          </span>
        </Transition>
      </div>

      <h1 class="hero__title anim-hero anim-d1">
        {{ t('hero.title1') }}<br>
        <span class="hero__title-grad">{{ t('hero.title2') }}</span>
      </h1>

      <p class="hero__desc anim-hero anim-d2">
        {{ t('hero.desc') }}
      </p>

      <div class="hero__actions anim-hero anim-d3">
        <RouterLink to="/register" class="btn-hero-primary">{{ t('hero.createAccount') }}</RouterLink>
        <a :href="siteConfig.launcherPortableUrl" class="btn-hero-secondary" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          {{ t('hero.downloadLauncher') }}
        </a>
        <a :href="siteConfig.discordUrl" target="_blank" rel="noreferrer" class="btn-hero-ghost">Discord</a>
      </div>

      <!-- server ribbon — switching re-themes the whole page in place -->
      <div v-if="servers.length > 1" class="hero__ribbon anim-hero anim-d4">
        <button
          v-for="s in servers"
          :key="s.slug"
          type="button"
          class="ribbon-pill"
          :class="{ 'ribbon-pill--active': activeServer?.slug === s.slug }"
          @click="chooseWorld(s)"
        >
          <span class="ribbon-pill__icon">
            <img v-if="s.icon_url" :src="s.icon_url" :alt="s.name" />
            <span v-else>{{ s.name.charAt(0) }}</span>
          </span>
          <span class="ribbon-pill__text">
            <span class="ribbon-pill__name">{{ s.name }}</span>
            <span class="ribbon-pill__status" :class="statusMeta(s).cls">
              <span class="ribbon-pill__dot"></span>
              <template v-if="s.status?.online">{{ s.status.players_online }} {{ t('hero.online') }}</template>
              <template v-else>{{ statusMeta(s).label }}</template>
            </span>
          </span>
        </button>
      </div>

      <div class="hero__meta anim-hero anim-d4">
        <button class="hero__ip" @click="copyIp">
          <svg v-if="!ipCopied" viewBox="0 0 20 20" fill="currentColor" width="11" height="11"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
          <svg v-else viewBox="0 0 20 20" fill="currentColor" width="11" height="11"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          {{ ipCopied ? t('hero.copied') : serverAddress }}
        </button>
        <span class="hero__sep">·</span>
        <span class="hero__online">
          <span class="hero__online-dot"></span>
          <template v-if="totalOnline !== null">{{ totalOnline }} {{ servers.length > 1 ? t('hero.onlineTotal') : t('hero.online') }}</template>
          <template v-else>{{ t('hero.serverOnline') }}</template>
        </span>
        <span class="hero__sep">·</span>
        <a href="#worlds" class="hero__map-link">{{ t('hero.chooseWorld') }}</a>
        <template v-if="feat('map')">
          <span class="hero__sep">·</span>
          <a :href="mapUrl" target="_blank" rel="noreferrer" class="hero__map-link">{{ t('hero.worldMap') }}</a>
        </template>
      </div>
    </div>

    <div class="hero__scroll-cue anim-hero anim-d5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
    </div>
  </section>

  <!-- ═══════════════════════ WORLDS (servers) ═══════════════════════ -->
  <section id="worlds" class="worlds-section">
    <div class="container-shell">
      <div class="section-header" data-reveal>
        <div class="kicker-wrap">
          <span class="kicker-line"></span>
          <p class="section-kicker">{{ t('homeWorlds.kicker') }}</p>
          <span class="kicker-line"></span>
        </div>
        <h2 class="section-h2">{{ t('homeWorlds.title') }}</h2>
        <p class="worlds-sub">{{ t('homeWorlds.sub') }}</p>
      </div>

      <!-- skeleton -->
      <div v-if="serverState.loading && !servers.length" class="worlds-grid">
        <div v-for="i in 2" :key="i" class="world-card world-card--skeleton">
          <div class="skeleton wc-skel-banner"></div>
          <div class="wc-skel-body">
            <div class="skeleton wc-skel-line"></div>
            <div class="skeleton wc-skel-line wc-skel-line--short"></div>
          </div>
        </div>
      </div>

      <div v-else-if="servers.length" class="worlds-grid">
        <article
          v-for="s in servers"
          :key="s.slug"
          class="world-card"
          :class="{ 'world-card--active': activeServer?.slug === s.slug }"
        >
          <div class="world-card__banner">
            <div
              class="world-card__banner-img"
              :style="s.banner_url ? { backgroundImage: `url(${s.banner_url})` } : {}"
            ></div>
            <div class="world-card__banner-veil"></div>
            <span class="world-status" :class="statusMeta(s).cls">
              <span class="world-status__dot"></span>{{ statusMeta(s).label }}
            </span>
            <div class="world-card__identity">
              <div class="world-card__icon">
                <img v-if="s.icon_url" :src="s.icon_url" :alt="s.name" />
                <span v-else>{{ s.name.charAt(0) }}</span>
              </div>
              <div class="world-card__id-text">
                <h3 class="world-card__name">{{ s.name }}</h3>
                <div class="world-card__chips">
                  <span class="world-chip">MC {{ s.mc_version }}</span>
                  <span class="world-chip">{{ s.loader }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="world-card__body">
            <p class="world-card__desc">{{ s.description || '' }}</p>
            <div class="world-card__meta">
              <span class="world-card__players" :class="{ 'is-live': s.status?.online }">
                <span class="world-card__players-dot"></span>
                <template v-if="s.status?.online">{{ s.status.players_online }} / {{ s.status.players_max }} {{ t('servers.players') }}</template>
                <template v-else>—</template>
              </span>
              <span class="world-card__addr">{{ worldAddress(s) }}</span>
            </div>
            <button
              type="button"
              class="world-card__btn"
              :class="{ 'world-card__btn--active': activeServer?.slug === s.slug }"
              @click="chooseWorld(s)"
            >
              {{ activeServer?.slug === s.slug ? t('homeWorlds.current') : t('homeWorlds.choose') }}
            </button>
          </div>
        </article>
      </div>

      <div class="worlds-footer" data-reveal>
        <RouterLink to="/servers" class="nations-link">{{ t('homeWorlds.details') }}</RouterLink>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ SCREENSHOTS ═══════════════════════ -->
  <section v-if="screenshots.length" class="screenshots-section" aria-hidden="true">
    <div class="marquee-wrap">
      <div class="marquee-track">
        <div v-for="(s, i) in [...screenshots, ...screenshots]" :key="i" class="marquee-item">
          <img :src="s.url" class="marquee-img" loading="lazy" decoding="async" />
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ STEPS ═══════════════════════ -->
  <section class="steps-section">
    <div class="container-shell">
      <div class="section-header" data-reveal>
        <div class="kicker-wrap">
          <span class="kicker-line"></span>
          <p class="section-kicker">{{ t('steps.kicker') }}</p>
          <span class="kicker-line"></span>
        </div>
        <h2 class="section-h2">{{ t('steps.title') }}</h2>
      </div>
      <div class="steps-grid">
        <div class="step-card" data-num="01" data-reveal data-delay="0">
          <div class="step-card__num">01</div>
          <h3 class="step-card__title">{{ t('steps.s1title') }}</h3>
          <p class="step-card__desc">{{ t('steps.s1desc') }}</p>
          <RouterLink to="/register" class="step-card__link">{{ t('steps.s1link') }}</RouterLink>
        </div>
        <div class="step-card step-card--accent" data-num="02" data-reveal data-delay="80">
          <div class="step-card__num">02</div>
          <h3 class="step-card__title">{{ t('steps.s2title') }}</h3>
          <p class="step-card__desc">{{ t('steps.s2desc') }}</p>
          <a :href="siteConfig.launcherPortableUrl" target="_blank" rel="noreferrer" class="step-card__link">{{ t('steps.s2link') }}</a>
        </div>
        <div class="step-card" data-num="03" data-reveal data-delay="160">
          <div class="step-card__num">03</div>
          <h3 class="step-card__title">{{ t('steps.s3title') }}</h3>
          <p class="step-card__desc">{{ t('steps.s3desc') }}</p>
          <span class="step-card__link step-card__link--muted">IP: {{ serverAddress }}</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ STATS ═══════════════════════ -->
  <section class="stats-section">
    <div class="container-shell">
      <div class="stats-bar" data-reveal>
        <div class="stat-item">
          <span class="stat-num">{{ servers.length || '—' }}</span>
          <span class="stat-label">{{ t('stats.servers') }}</span>
        </div>
        <div class="stat-divider" aria-hidden="true"></div>
        <div class="stat-item">
          <span class="stat-num" ref="statPlayersEl">—</span>
          <span class="stat-label">{{ t('stats.players') }}</span>
        </div>
        <div class="stat-divider" aria-hidden="true"></div>
        <div class="stat-item">
          <span class="stat-num" ref="statNationsEl">—</span>
          <span class="stat-label">{{ t('stats.nations') }}</span>
        </div>
        <div class="stat-divider" aria-hidden="true"></div>
        <div class="stat-item">
          <span class="stat-num">320+</span>
          <span class="stat-label">{{ t('stats.mods') }}</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ LAUNCHER ═══════════════════════ -->
  <section class="launcher-section">
    <div class="container-shell">
      <div class="launcher-card" data-reveal>
        <div class="launcher-card__glow"></div>
        <div class="launcher-card__left">
          <div class="kicker-wrap kicker-wrap--left">
            <span class="kicker-line"></span>
            <p class="section-kicker section-kicker--light">{{ t('launcher.kicker') }}</p>
          </div>
          <h2 class="launcher-card__title">{{ t('launcher.title') }}</h2>
          <p class="launcher-card__desc">{{ t('launcher.desc') }}</p>
          <ul class="launcher-features">
            <li><span class="lf-dot"></span>{{ t('launcher.f1') }}</li>
            <li><span class="lf-dot"></span>{{ t('launcher.f2') }}</li>
            <li><span class="lf-dot"></span>{{ t('launcher.f3') }}</li>
            <li><span class="lf-dot"></span>{{ t('launcher.f4') }}</li>
          </ul>
        </div>
        <div class="launcher-card__right">
          <div class="launcher-download-box">
            <p class="ldb-label">{{ t('launcher.ready') }}</p>
            <a :href="siteConfig.launcherPortableUrl" target="_blank" rel="noreferrer" class="ldb-btn">
              <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
              {{ t('launcher.download') }}
            </a>
            <p class="ldb-note">
              {{ t('launcher.needAccount') }}<br>
              <RouterLink to="/register">{{ t('launcher.registerFree') }}</RouterLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ TOP NATIONS ═══════════════════════ -->
  <section v-if="feat('nations')" class="top-nations-section">
    <div class="container-shell">
      <div class="section-header" data-reveal>
        <div class="kicker-wrap">
          <span class="kicker-line"></span>
          <p class="section-kicker">{{ t('topNations.kicker') }}</p>
          <span class="kicker-line"></span>
        </div>
        <h2 class="section-h2">{{ t('topNations.title') }}</h2>
        <p v-if="activeServer && servers.length > 1" class="section-server-note">
          {{ t('topNations.onServer', { name: activeServer.name }) }}
        </p>
      </div>

      <!-- skeleton -->
      <div v-if="nationsLoading" class="nations-grid">
        <div v-for="i in 3" :key="i" class="nation-card nation-card--skeleton">
          <div class="skeleton nc-skel-rank"></div>
          <div class="skeleton nc-skel-title"></div>
          <div class="skeleton nc-skel-meta"></div>
        </div>
      </div>

      <!-- data -->
      <div v-else-if="topNations.length" class="nations-grid nations-grid--loaded">
        <div
          v-for="(nation, i) in topNations"
          :key="nation.slug"
          class="nation-card"
          :style="{ '--nc-accent': nationAccent(nation) }"
        >
          <div class="nation-card__accent-bar"></div>
          <div class="nation-card__top">
            <span class="nation-card__rank" :class="`nc-rank--${i + 1}`">#{{ i + 1 }}</span>
            <span class="nation-card__tag" :style="{ color: nationAccent(nation) }">[{{ nation.tag }}]</span>
          </div>
          <router-link :to="`/nation/${nation.slug}`" class="nation-card__title">
            {{ nation.title }}
          </router-link>
          <div class="nation-card__meta">
            <span>{{ t('topNations.members', { n: nation.members_count }) }}</span>
            <span class="nc-dot">·</span>
            <span>{{ t('topNations.score', { n: Math.round(nation.score) }) }}</span>
          </div>
          <div class="nation-card__bar">
            <div
              class="nation-card__bar-fill"
              :style="{ width: i === 0 ? '100%' : i === 1 ? '72%' : '48%', background: nationAccent(nation) }"
            ></div>
          </div>
        </div>
      </div>

      <!-- empty -->
      <p v-else class="nations-empty">{{ t('topNations.noData') }}</p>

      <div class="nations-footer">
        <RouterLink to="/nations/rankings" class="nations-link">{{ t('topNations.allRankings') }}</RouterLink>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ FEATURES ═══════════════════════ -->
  <section class="features-section">
    <div class="container-shell">
      <div class="section-header" data-reveal>
        <div class="kicker-wrap">
          <span class="kicker-line"></span>
          <p class="section-kicker">{{ t('features.kicker') }}</p>
          <span class="kicker-line"></span>
        </div>
        <h2 class="section-h2">{{ t('features.title') }}</h2>
      </div>
      <div class="features-grid">
        <div class="feat-card" data-reveal data-delay="0">
          <div class="feat-card__icon feat-icon--violet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="21" height="21"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <h3 class="feat-card__title">{{ t('features.nations') }}</h3>
          <p class="feat-card__desc">{{ t('features.nationsDesc') }}</p>
        </div>
        <div class="feat-card" data-reveal data-delay="60">
          <div class="feat-card__icon feat-icon--sky">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="21" height="21"><path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 class="feat-card__title">{{ t('features.alliances') }}</h3>
          <p class="feat-card__desc">{{ t('features.alliancesDesc') }}</p>
        </div>
        <div class="feat-card" data-reveal data-delay="120">
          <div class="feat-card__icon feat-icon--green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="21" height="21"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 class="feat-card__title">{{ t('features.economy') }}</h3>
          <p class="feat-card__desc">{{ t('features.economyDesc') }}</p>
        </div>
        <div class="feat-card" data-reveal data-delay="180">
          <div class="feat-card__icon feat-icon--amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="21" height="21"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
          </div>
          <h3 class="feat-card__title">{{ t('features.map') }}</h3>
          <p class="feat-card__desc">{{ t('features.mapDesc') }}</p>
        </div>
        <div class="feat-card" data-reveal data-delay="240">
          <div class="feat-card__icon feat-icon--rose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="21" height="21"><path stroke-linecap="round" stroke-linejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 class="feat-card__title">{{ t('features.profiles') }}</h3>
          <p class="feat-card__desc">{{ t('features.profilesDesc') }}</p>
        </div>
        <div class="feat-card" data-reveal data-delay="300">
          <div class="feat-card__icon feat-icon--indigo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="21" height="21"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <h3 class="feat-card__title">{{ t('features.design') }}</h3>
          <p class="feat-card__desc">{{ t('features.designDesc') }}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ GAMEPLAY ═══════════════════════ -->
  <section class="gameplay-section">
    <div class="container-shell">
      <div class="section-header" data-reveal>
        <div class="kicker-wrap">
          <span class="kicker-line"></span>
          <p class="section-kicker">{{ t('gameplay.kicker') }}</p>
          <span class="kicker-line"></span>
        </div>
        <h2 class="section-h2">{{ t('gameplay.title') }}</h2>
      </div>
      <div class="gameplay-grid">
        <div class="gp-card" data-reveal data-delay="0">
          <div class="gp-card__icon gp-icon--red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="22" height="22"><path stroke-linecap="round" stroke-linejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 1 0-4.243-4.243 3 3 0 0 0 4.243 4.243zm9.9-9.9a3 3 0 1 0-4.243-4.243 3 3 0 0 0 4.243 4.243z"/></svg>
          </div>
          <h3 class="gp-card__title">{{ t('gameplay.war') }}</h3>
          <p class="gp-card__desc">{{ t('gameplay.warDesc') }}</p>
        </div>
        <div class="gp-card" data-reveal data-delay="70">
          <div class="gp-card__icon gp-icon--amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="22" height="22"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
          <h3 class="gp-card__title">{{ t('gameplay.build') }}</h3>
          <p class="gp-card__desc">{{ t('gameplay.buildDesc') }}</p>
        </div>
        <div class="gp-card" data-reveal data-delay="140">
          <div class="gp-card__icon gp-icon--cyan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="22" height="22"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
          </div>
          <h3 class="gp-card__title">{{ t('gameplay.explore') }}</h3>
          <p class="gp-card__desc">{{ t('gameplay.exploreDesc') }}</p>
        </div>
        <div class="gp-card" data-reveal data-delay="210">
          <div class="gp-card__icon gp-icon--violet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="22" height="22"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          </div>
          <h3 class="gp-card__title">{{ t('gameplay.role') }}</h3>
          <p class="gp-card__desc">{{ t('gameplay.roleDesc') }}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ BATTLE PASS ═══════════════════════ -->
  <section v-if="feat('battlepass')" class="bp-section">
    <div class="container-shell">
      <div class="bp-card" data-reveal>
        <div class="bp-card__glow"></div>
        <div class="bp-card__left">
          <p class="bp-kicker">{{ t('battlepassTeaser.kicker') }}</p>
          <h2 class="bp-card__title">{{ t('battlepassTeaser.title') }}</h2>
          <p class="bp-card__desc">{{ t('battlepassTeaser.desc') }}</p>
          <RouterLink to="/battlepass" class="bp-card__link">{{ t('battlepassTeaser.link') }}</RouterLink>
        </div>
        <div class="bp-card__right" aria-hidden="true">
          <div class="bp-icon">⭐</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ CTA ═══════════════════════ -->
  <section class="cta-section">
    <div class="container-shell">
      <div class="cta-card" data-reveal>
        <div class="cta-card__glow"></div>
        <div class="cta-card__orb cta-card__orb--1"></div>
        <div class="cta-card__orb cta-card__orb--2"></div>
        <div class="kicker-wrap">
          <span class="kicker-line kicker-line--dim"></span>
          <p class="section-kicker section-kicker--light">{{ t('cta.kicker') }}</p>
          <span class="kicker-line kicker-line--dim"></span>
        </div>
        <h2 class="cta-card__title">{{ t('cta.title') }}</h2>
        <p class="cta-card__desc">{{ t('cta.desc') }}</p>
        <div class="cta-actions">
          <RouterLink to="/register" class="btn-hero-primary">{{ t('cta.createAccount') }}</RouterLink>
          <a :href="siteConfig.launcherPortableUrl" target="_blank" rel="noreferrer" class="btn-hero-secondary">{{ t('cta.downloadLauncher') }}</a>
          <a :href="siteConfig.discordUrl" target="_blank" rel="noreferrer" class="btn-hero-ghost">Discord</a>
        </div>
        <div class="cta-links">
          <RouterLink to="/servers" class="cta-link">{{ t('nav.servers') }}</RouterLink>
          <template v-if="feat('nations')">
            <span>·</span>
            <RouterLink to="/nations" class="cta-link">{{ t('cta.nations') }}</RouterLink>
          </template>
          <template v-if="feat('map')">
            <span>·</span>
            <a :href="mapUrl" target="_blank" rel="noreferrer" class="cta-link">{{ t('cta.worldMap') }}</a>
          </template>
          <template v-if="feat('nations')">
            <span>·</span>
            <RouterLink to="/nations/rankings" class="cta-link">{{ t('cta.ranking') }}</RouterLink>
          </template>
          <span>·</span>
          <RouterLink to="/guide" class="cta-link">{{ t('cta.guide') }}</RouterLink>
        </div>
      </div>
    </div>
  </section>
  </div>
</template>

<style scoped>
/* ════════════════════════════════════
   KEYFRAMES
════════════════════════════════════ */
@keyframes hero-in {
  from { opacity: 0; transform: translateY(32px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes hero-bloom {
  0%   { opacity: 0;   transform: translate(-50%, -50%) scale(.5); }
  25%  { opacity: 1;   transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0;   transform: translate(-50%, -50%) scale(1.8); }
}

@keyframes orb-float-1 {
  0%   { transform: translate(0, 0) scale(1); }
  50%  { transform: translate(30px, -40px) scale(1.08); }
  100% { transform: translate(-10px, 20px) scale(0.96); }
}
@keyframes orb-float-2 {
  0%   { transform: translate(0, 0) scale(1); }
  40%  { transform: translate(-40px, 30px) scale(1.06); }
  100% { transform: translate(20px, -20px) scale(0.94); }
}
@keyframes orb-float-3 {
  0%   { transform: translate(0, 0); }
  60%  { transform: translate(20px, -30px); }
  100% { transform: translate(-15px, 15px); }
}

@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 6px rgba(74,222,128,.6); opacity: 1; }
  50%       { box-shadow: 0 0 14px rgba(74,222,128,.9), 0 0 28px rgba(74,222,128,.3); opacity: .85; }
}

@keyframes grad-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes scroll-bounce {
  0%, 100% { transform: translateY(0); opacity: .4; }
  50%       { transform: translateY(7px); opacity: .9; }
}

@keyframes reveal-up {
  from { opacity: 0; transform: translateY(40px) scale(.985); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}

@keyframes ldb-pulse {
  0%, 100% { box-shadow: 0 0 28px rgba(var(--srv-deep-rgb),.4); }
  50%       { box-shadow: 0 0 48px rgba(var(--srv-deep-rgb),.65), 0 0 80px rgba(var(--srv-deep-rgb),.2); }
}

/* ════════════════════════════════════
   HERO ENTRY — staggered
════════════════════════════════════ */
.anim-hero {
  opacity: 0;
  animation: hero-in .85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.anim-d0 { animation-delay: .05s; }
.anim-d1 { animation-delay: .22s; }
.anim-d2 { animation-delay: .38s; }
.anim-d3 { animation-delay: .54s; }
.anim-d4 { animation-delay: .70s; }
.anim-d5 { animation-delay: .90s; }

/* ════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════ */
[data-reveal] {
  opacity: 0;
  transform: translateY(40px) scale(.985);
  transition: opacity .75s cubic-bezier(0.16, 1, 0.3, 1),
              transform .75s cubic-bezier(0.16, 1, 0.3, 1);
}
[data-reveal].is-revealed {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* ════════════════════════════════════
   SHARED BUTTONS
════════════════════════════════════ */
.btn-hero-primary {
  display: inline-flex; align-items: center; gap: .4rem;
  padding: .78rem 1.55rem;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--srv), var(--srv-dark));
  color: #fff; font-weight: 800; font-size: .92rem;
  text-decoration: none;
  box-shadow: 0 0 28px rgba(var(--srv-deep-rgb),.38);
  transition: box-shadow .25s, transform .18s;
}
.btn-hero-primary:hover {
  box-shadow: 0 0 48px rgba(var(--srv-deep-rgb),.65);
  transform: translateY(-2px);
}
.btn-hero-primary:active { transform: translateY(0); }

.btn-hero-secondary {
  display: inline-flex; align-items: center; gap: .45rem;
  padding: .78rem 1.55rem;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.06);
  color: #e2e8f0; font-weight: 700; font-size: .92rem;
  text-decoration: none; backdrop-filter: blur(8px);
  transition: border-color .22s, background .22s, transform .18s, box-shadow .22s;
}
.btn-hero-secondary:hover {
  border-color: rgba(var(--srv-rgb),.55);
  background: rgba(var(--srv-rgb),.14);
  box-shadow: 0 0 24px rgba(var(--srv-rgb),.2);
  transform: translateY(-2px);
}

.btn-hero-ghost {
  display: inline-flex; align-items: center;
  padding: .78rem 1.1rem;
  border-radius: 14px;
  color: rgba(255,255,255,.45); font-weight: 700; font-size: .92rem;
  text-decoration: none;
  transition: color .2s;
}
.btn-hero-ghost:hover { color: rgba(255,255,255,.88); }

/* ════════════════════════════════════
   PER-SERVER THEME
   .home-root carries --srv / --srv-rgb… from the active server's
   accent_color; every accent below resolves through them, so switching
   the server re-tints the entire page.
════════════════════════════════════ */
.home-root {
  /* fallback = brand violet, until the server list resolves */
  --srv: #7c3aed;
  --srv-dark: #5a2aab;
  --srv-soft: #a578f0;
  --srv-pale: #c5a9f5;
  --srv-rgb: 124, 58, 237;
  --srv-deep-rgb: 109, 51, 209;
  --srv-soft-rgb: 165, 120, 240;
  --srv-pale-rgb: 197, 169, 245;
}

/* server-name swap in the hero badge */
.srv-swap-enter-active, .srv-swap-leave-active { transition: opacity .28s ease, transform .28s ease; }
.srv-swap-enter-from { opacity: 0; transform: translateY(6px); }
.srv-swap-leave-to   { opacity: 0; transform: translateY(-6px); }

/* ════════════════════════════════════
   HERO
════════════════════════════════════ */
.hero {
  position: relative; overflow: hidden;
  padding: 7rem 0 8rem;
  min-height: 100svh;
  display: flex; align-items: center;
}

/* per-server banner background */
.hero__banner {
  position: absolute; inset: 0; z-index: 0;
  pointer-events: none;
  isolation: isolate; /* keeps the color-blend tint inside the banner stack */
}
@keyframes banner-in {
  from { opacity: 0; transform: scale(1.06); }
  to   { opacity: 1; transform: scale(1); }
}
.hero__banner-img {
  position: absolute; inset: 0;
  background-size: cover; background-position: center;
  /* duotone: убираем родные цвета баннера — остаётся только светотень,
     которую tint ниже перекрашивает в акцент мира. Любой баннер гармонирует
     и с навбаром, и с контентом после hero. */
  filter: grayscale(.92) brightness(.6) contrast(1.06);
  animation: banner-in 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
  will-change: opacity, transform;
}

/* перекраска светотени баннера в акцент сервера */
.hero__banner-tint {
  position: absolute; inset: 0;
  background: linear-gradient(160deg, rgb(var(--srv-rgb)) 0%, rgb(var(--srv-deep-rgb)) 100%);
  mix-blend-mode: color;
  opacity: .85;
}
.banner-leave-active { transition: opacity 1s ease; }
.banner-leave-to { opacity: 0; }
/* фейды строго в цвет фона сайта (#070b14 = 7,11,20): сверху сливается с
   навбаром, снизу — с секцией миров; без видимых швов на любом баннере */
.hero__banner-veil {
  position: absolute; inset: 0;
  background:
    linear-gradient(90deg, rgba(7,11,20,.9) 0%, rgba(7,11,20,.66) 42%, rgba(7,11,20,.38) 100%),
    linear-gradient(180deg, rgba(7,11,20,.96) 0%, rgba(7,11,20,.5) 26%, rgba(7,11,20,.38) 55%, #070b14 100%);
}

/* server ribbon — launcher-style switcher */
.hero__ribbon {
  display: flex; flex-wrap: wrap; gap: .55rem;
  margin-bottom: 1.8rem;
}
.ribbon-pill {
  position: relative;
  display: inline-flex; align-items: center; gap: .6rem;
  padding: .48rem .85rem .48rem .5rem;
  border-radius: 16px; cursor: pointer;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(10,10,22,.55);
  backdrop-filter: blur(12px);
  font: inherit; text-align: left;
  transition: border-color .25s, background .25s, box-shadow .25s, transform .18s;
}
.ribbon-pill:hover {
  border-color: rgba(var(--srv-rgb), .45);
  background: rgba(var(--srv-rgb), .1);
  transform: translateY(-2px);
}
.ribbon-pill--active {
  border-color: rgba(var(--srv-rgb), .65);
  background: linear-gradient(135deg, rgba(var(--srv-rgb), .22), rgba(var(--srv-deep-rgb), .1)), rgba(10,10,22,.6);
  box-shadow: 0 0 22px rgba(var(--srv-rgb), .28), inset 0 0 18px rgba(var(--srv-rgb), .08);
}
.ribbon-pill__icon {
  width: 2.15rem; height: 2.15rem; border-radius: 11px; flex-shrink: 0; overflow: hidden;
  border: 1px solid rgba(255,255,255,.14); background: rgba(12,16,30,.85);
  display: flex; align-items: center; justify-content: center;
  color: var(--srv-soft); font-weight: 900; font-size: .95rem;
}
.ribbon-pill__icon img { width: 100%; height: 100%; object-fit: cover; }
.ribbon-pill__text { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
.ribbon-pill__name {
  font-size: .8rem; font-weight: 800; color: #eef1fb;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 11rem;
}
.ribbon-pill__status {
  display: inline-flex; align-items: center; gap: .32rem;
  font-size: .66rem; font-weight: 700;
}
.ribbon-pill__dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; }
.ribbon-pill__status.is-online  { color: #86efac; }
.ribbon-pill__status.is-online .ribbon-pill__dot { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,.7); }
.ribbon-pill__status.is-offline { color: #fca5a5; }
.ribbon-pill__status.is-offline .ribbon-pill__dot { background: #ef4444; }
.ribbon-pill__status.is-maint   { color: #fde047; }
.ribbon-pill__status.is-maint .ribbon-pill__dot { background: #eab308; }

/* ambient bloom — fades in then expands out on load */
.hero__bloom {
  position: absolute;
  top: 42%; left: 50%;
  width: 780px; height: 480px;
  border-radius: 999px;
  background: radial-gradient(
    ellipse at center,
    rgba(var(--srv-rgb), .38) 0%,
    rgba(var(--srv-deep-rgb), .18) 40%,
    transparent 70%
  );
  filter: blur(48px);
  animation: hero-bloom 2.2s cubic-bezier(0.16, 1, 0.3, 1) .1s both;
  z-index: 2;
  pointer-events: none;
}

/* gradient veil — fades hero into rest of page */
.hero__bottom-veil {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 320px;
  background: linear-gradient(to bottom, transparent 0%, #070b14 100%);
  z-index: 2;
  pointer-events: none;
}

/* subtle noise grain */
.hero__noise {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  opacity: .028;
}

/* subtle dot grid */
.hero__grid {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background-image: radial-gradient(circle, rgba(148,163,184,.12) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 0%, black 40%, transparent 100%);
}

/* glow orbs */
.hero__orb {
  position: absolute; border-radius: 999px; pointer-events: none;
  filter: blur(90px);
}
.hero__orb--1 {
  width: 680px; height: 680px;
  background: radial-gradient(circle, rgba(var(--srv-deep-rgb),.28), transparent 70%);
  top: -200px; left: -160px;
  animation: orb-float-1 12s ease-in-out infinite alternate;
}
.hero__orb--2 {
  width: 560px; height: 560px;
  background: radial-gradient(circle, rgba(56,189,248,.16), transparent 70%);
  top: 5%; right: -140px;
  animation: orb-float-2 16s ease-in-out infinite alternate;
}
.hero__orb--3 {
  width: 420px; height: 280px;
  background: radial-gradient(circle, rgba(var(--srv-rgb),.12), transparent 70%);
  bottom: 5%; left: 28%;
  animation: orb-float-3 10s ease-in-out infinite alternate;
}

.hero__inner {
  position: relative; z-index: 3;
  display: flex; flex-direction: column; align-items: flex-start;
}

.hero__badge {
  display: inline-flex; align-items: center; gap: .5rem;
  border: 1px solid rgba(var(--srv-rgb),.32);
  background: rgba(var(--srv-rgb),.1);
  border-radius: 999px;
  padding: .38rem .9rem;
  font-size: .75rem; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: rgb(var(--srv-pale-rgb));
  margin-bottom: 1.6rem;
  backdrop-filter: blur(6px);
}
.hero__badge-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--srv-soft);
  animation: pulse-dot 2.4s ease-in-out infinite;
  flex-shrink: 0;
}

.hero__title {
  font-size: clamp(3rem, 7vw, 4.8rem);
  font-weight: 900; letter-spacing: -.055em; line-height: .92;
  color: #f8faff;
  margin: 0 0 1.3rem;
}
.hero__title-grad {
  display: block; margin-top: .18em;
  background: linear-gradient(110deg, #fff 0%, var(--srv-pale) 30%, #7dd3fc 60%, var(--srv-pale) 90%, #fff 100%);
  background-size: 300% 300%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: grad-shift 6s ease-in-out infinite;
}

.hero__desc {
  font-size: clamp(.9rem, 2vw, 1.05rem);
  line-height: 1.72; color: rgba(148,163,184,.9);
  max-width: 500px; margin: 0 0 2.2rem;
}

.hero__actions { display: flex; flex-wrap: wrap; gap: .65rem; margin-bottom: 2.2rem; }

.hero__meta {
  display: flex; align-items: center; flex-wrap: wrap;
  gap: .55rem; font-size: .82rem;
}
.hero__sep { color: rgba(255,255,255,.18); }

.hero__ip {
  display: inline-flex; align-items: center; gap: .38rem;
  border: 1px solid rgba(148,163,184,.13);
  background: rgba(255,255,255,.04); border-radius: 8px;
  padding: .3rem .68rem; cursor: pointer;
  font: inherit; font-size: .8rem; font-weight: 700; color: rgb(203 213 225);
  transition: border-color .18s, color .18s, background .18s;
}
.hero__ip:hover { border-color: rgba(var(--srv-rgb),.38); background: rgba(var(--srv-rgb),.07); color: #fff; }

.hero__online {
  display: inline-flex; align-items: center; gap: .38rem;
  font-size: .8rem; font-weight: 600; color: rgba(255,255,255,.48);
}
.hero__online-dot {
  width: 7px; height: 7px; border-radius: 999px;
  background: rgb(74 222 128);
  animation: pulse-dot 2s ease-in-out infinite;
  flex-shrink: 0;
}

.hero__map-link {
  font-size: .8rem; font-weight: 600;
  color: rgba(var(--srv-soft-rgb),.72); text-decoration: none;
  transition: color .18s;
}
.hero__map-link:hover { color: var(--srv-pale); }

.hero__scroll-cue {
  position: absolute; bottom: 2.5rem; left: 50%; transform: translateX(-50%);
  z-index: 3; color: rgba(255,255,255,.3);
  animation: scroll-bounce 2.2s ease-in-out infinite;
}

/* ════════════════════════════════════
   KICKER WITH FLANKING LINES
════════════════════════════════════ */
.kicker-wrap {
  display: flex; align-items: center; gap: .75rem;
  margin-bottom: .5rem;
}
.kicker-wrap--left { justify-content: flex-start; }

.kicker-line {
  flex: 1; max-width: 2.8rem; height: 1px;
  background: rgba(var(--srv-rgb),.45);
}
.kicker-line--dim { background: rgba(var(--srv-soft-rgb),.25); }

/* ════════════════════════════════════
   SCREENSHOT MARQUEE
════════════════════════════════════ */
.screenshots-section {
  overflow: hidden;
  padding: 0 0 5rem;
  mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
}

@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

.marquee-wrap { overflow: hidden; }

.marquee-track {
  display: flex; gap: .85rem;
  width: max-content;
  animation: marquee 40s linear infinite;
}
.marquee-wrap:hover .marquee-track { animation-play-state: paused; }

.marquee-item { flex-shrink: 0; }
.marquee-img {
  height: 200px; width: auto;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,.07);
  display: block;
}

/* ════════════════════════════════════
   GAMEPLAY
════════════════════════════════════ */
.gameplay-section { padding: 0 0 5.5rem; }

.gameplay-grid {
  display: grid; gap: .85rem;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.gp-card {
  position: relative; overflow: hidden;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 20px;
  background: rgba(255,255,255,.022);
  padding: 1.6rem; display: flex; flex-direction: column; gap: .8rem;
  transition: border-color .28s, transform .22s, box-shadow .28s;
}
.gp-card:hover {
  border-color: rgba(var(--srv-rgb),.25);
  transform: translateY(-3px);
  box-shadow: 0 10px 36px rgba(0,0,0,.25);
}

.gp-card__icon {
  width: 46px; height: 46px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.gp-icon--red    { background: rgba(239,68,68,.1);   border: 1px solid rgba(239,68,68,.22);   color: #fca5a5; }
.gp-icon--amber  { background: rgba(245,158,11,.09);  border: 1px solid rgba(245,158,11,.2);   color: #fcd34d; }
.gp-icon--cyan   { background: rgba(6,182,212,.1);    border: 1px solid rgba(6,182,212,.22);   color: #67e8f9; }
.gp-icon--violet { background: rgba(var(--srv-rgb),.11);  border: 1px solid rgba(var(--srv-rgb),.24);  color: var(--srv-soft); }

.gp-card__title { font-size: .97rem; font-weight: 800; color: #e2e8f0; margin: 0; }
.gp-card__desc  { font-size: .81rem; line-height: 1.65; color: rgba(100,116,139,.95); margin: 0; }

/* ════════════════════════════════════
   BATTLE PASS TEASER
════════════════════════════════════ */
.bp-section { padding: 0 0 5.5rem; }

.bp-card {
  position: relative; overflow: hidden;
  border: 1px solid rgba(251,191,36,.2);
  border-radius: 24px;
  background: radial-gradient(ellipse at top left, rgba(251,191,36,.1) 0%, transparent 55%),
    linear-gradient(135deg, rgba(20,16,42,.98), rgba(10,10,22,1));
  padding: 2.5rem 2.75rem;
  display: flex; align-items: center; justify-content: space-between; gap: 2rem;
  transition: box-shadow .3s;
}
.bp-card:hover { box-shadow: 0 0 60px rgba(251,191,36,.08), 0 20px 50px rgba(0,0,0,.35); }

.bp-card__glow {
  position: absolute; width: 400px; height: 250px;
  background: rgba(251,191,36,.07); filter: blur(90px);
  border-radius: 999px; top: -80px; left: -60px; pointer-events: none;
}

.bp-kicker {
  font-size: .72rem; font-weight: 700; letter-spacing: .16em;
  text-transform: uppercase; color: rgba(251,191,36,.7); margin: 0 0 .5rem;
}
.bp-card__title {
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 900; letter-spacing: -.04em; color: #fff; margin: 0 0 .7rem;
}
.bp-card__desc {
  font-size: .88rem; line-height: 1.7;
  color: rgba(255,255,255,.48); margin: 0 0 1.4rem; max-width: 460px;
}
.bp-card__link {
  display: inline-flex; align-items: center;
  font-size: .9rem; font-weight: 700;
  color: rgba(251,191,36,.85); text-decoration: none;
  transition: color .18s;
}
.bp-card__link:hover { color: #fde68a; }

.bp-card__right { flex-shrink: 0; }
.bp-icon { font-size: 4.5rem; line-height: 1; opacity: .45; filter: drop-shadow(0 0 24px rgba(251,191,36,.5)); }

@media (max-width: 600px) { .bp-card__right { display: none; } .bp-card { padding: 2rem 1.5rem; } }

/* ════════════════════════════════════
   STATS
════════════════════════════════════ */
.stats-section { padding: 0 0 4rem; }

.stats-bar {
  display: flex; align-items: center; justify-content: center;
  flex-wrap: wrap; gap: 0;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 22px;
  background: rgba(255,255,255,.022);
  backdrop-filter: blur(10px);
  padding: 2rem 2.5rem;
  overflow: hidden;
}

.stat-item {
  flex: 1; min-width: 140px;
  display: flex; flex-direction: column; align-items: center; gap: .38rem;
  padding: .5rem 1rem;
}

.stat-num {
  font-size: clamp(2rem, 5vw, 2.9rem);
  font-weight: 900; letter-spacing: -.04em;
  background: linear-gradient(120deg, #fff 0%, var(--srv-pale) 50%, #7dd3fc 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  line-height: 1;
  min-width: 4ch; text-align: center;
}

.stat-label {
  font-size: .72rem; font-weight: 600; letter-spacing: .1em;
  text-transform: uppercase; color: rgba(148,163,184,.55);
  text-align: center;
}

.stat-divider {
  width: 1px; height: 52px; flex-shrink: 0;
  background: rgba(255,255,255,.07);
  margin: 0 .5rem;
}

@media (max-width: 520px) {
  .stat-divider { display: none; }
  .stats-bar { gap: 1.2rem; padding: 1.5rem; }
  .stat-item { min-width: 100%; border-bottom: 1px solid rgba(255,255,255,.06); padding-bottom: 1rem; }
  .stat-item:last-child { border-bottom: none; }
}

/* ════════════════════════════════════
   TOP NATIONS
════════════════════════════════════ */
.top-nations-section { padding: 0 0 5.5rem; }

.nations-grid {
  display: grid; gap: 1rem;
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 768px) { .nations-grid { grid-template-columns: 1fr; } }

.nation-card {
  position: relative; overflow: hidden;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 20px;
  background: rgba(255,255,255,.022);
  padding: 1.5rem 1.4rem 1.3rem;
  display: flex; flex-direction: column; gap: .7rem;
  transition: border-color .28s, transform .22s, box-shadow .28s;
}
.nation-card:hover {
  border-color: color-mix(in srgb, var(--nc-accent, var(--srv)) 50%, transparent);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,.3);
}

/* coloured top strip */
.nation-card__accent-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--nc-accent, var(--srv));
  opacity: .65;
}

.nation-card__top {
  display: flex; align-items: center; gap: .55rem;
}

.nation-card__rank {
  font-size: .82rem; font-weight: 900; letter-spacing: .04em;
}
.nc-rank--1 { color: #fbbf24; }
.nc-rank--2 { color: #94a3b8; }
.nc-rank--3 { color: #b45309; }

.nation-card__tag {
  font-size: .78rem; font-weight: 700; letter-spacing: .04em;
}

.nation-card__title {
  font-size: 1.05rem; font-weight: 800; color: #f1f5f9;
  text-decoration: none; line-height: 1.25;
  transition: color .18s;
}
.nation-card__title:hover { color: var(--srv-pale); }

.nation-card__meta {
  font-size: .77rem; color: rgba(148,163,184,.65);
  display: flex; align-items: center; gap: .4rem;
}
.nc-dot { opacity: .4; }

/* relative score bar */
.nation-card__bar {
  height: 3px; border-radius: 999px;
  background: rgba(255,255,255,.06); overflow: hidden;
  margin-top: .2rem;
}
.nation-card__bar-fill {
  height: 100%; border-radius: 999px;
  opacity: .55;
  transition: width .8s cubic-bezier(0.16, 1, 0.3, 1);
}

/* skeleton */
.nation-card--skeleton { pointer-events: none; }
.nc-skel-rank  { height: 12px; width: 60px;  border-radius: 6px; }
.nc-skel-title { height: 20px; width: 120px; border-radius: 8px; margin-top: .3rem; }
.nc-skel-meta  { height: 10px; width: 90px;  border-radius: 6px; margin-top: .2rem; }

.nations-grid--loaded {
  animation: reveal-up .65s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.nations-footer {
  margin-top: 1.4rem; display: flex; justify-content: flex-end;
  animation: reveal-up .65s cubic-bezier(0.16, 1, 0.3, 1) .15s both;
}
.nations-link {
  font-size: .82rem; font-weight: 700;
  color: rgba(var(--srv-soft-rgb),.7); text-decoration: none;
  transition: color .18s;
}
.nations-link:hover { color: var(--srv-pale); }

.nations-empty {
  font-size: .9rem; color: rgba(148,163,184,.45);
  text-align: center; padding: 2.5rem 0;
}

/* nation-card spotlight */
.nation-card::after {
  content: '';
  position: absolute; inset: 0; border-radius: inherit;
  background: radial-gradient(
    circle 200px at var(--mx, 50%) var(--my, 50%),
    color-mix(in srgb, var(--nc-accent, var(--srv)) 18%, transparent) 0%,
    transparent 70%
  );
  opacity: 0; transition: opacity .35s ease; pointer-events: none;
}
.nation-card.lit::after { opacity: 1; }

/* ════════════════════════════════════
   WORLDS (servers)
════════════════════════════════════ */
.worlds-section {
  position: relative; z-index: 3;
  padding: 0 0 5.5rem;
  margin-top: -3.5rem; /* pull into the hero's bottom veil */
  scroll-margin-top: 5rem;
}

.worlds-sub {
  margin: .55rem 0 0;
  font-size: .88rem; color: rgba(148,163,184,.7);
  max-width: 520px;
}

.worlds-grid {
  display: grid; gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  align-items: stretch;
}

.world-card {
  position: relative; overflow: hidden;
  display: flex; flex-direction: column;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 22px;
  background: rgba(255,255,255,.022);
  transition: border-color .28s, transform .22s, box-shadow .28s;
}
.world-card:hover {
  border-color: rgba(var(--srv-rgb),.32);
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(0,0,0,.32), 0 0 0 1px rgba(var(--srv-rgb),.12);
}
.world-card--active {
  border-color: rgba(var(--srv-rgb),.45);
  box-shadow: 0 0 0 1px rgba(var(--srv-rgb),.3), 0 12px 40px rgba(0,0,0,.3), 0 0 36px rgba(var(--srv-deep-rgb),.12);
}

/* spotlight, same pattern as the other landing cards */
.world-card::after {
  content: '';
  position: absolute; inset: 0; border-radius: inherit;
  background: radial-gradient(
    circle 240px at var(--mx, 50%) var(--my, 50%),
    rgba(var(--srv-rgb),.12) 0%,
    transparent 70%
  );
  opacity: 0; transition: opacity .35s ease; pointer-events: none;
}
.world-card.lit::after { opacity: 1; }

.world-card__banner {
  position: relative;
  min-height: 118px;
  padding: 1rem 1.15rem;
  display: flex; align-items: flex-end;
}
.world-card__banner-img {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(var(--srv-deep-rgb), .5) 0%, rgba(15,14,32,.9) 60%, rgba(7,11,20,.95) 100%);
  background-size: cover; background-position: center;
}
.world-card__banner-veil {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(7,11,20,.12) 0%, rgba(7,11,20,.5) 55%, rgba(7,11,20,.96) 100%);
}

.world-status {
  position: absolute; top: .8rem; right: .85rem; z-index: 2;
  display: inline-flex; align-items: center; gap: .38rem;
  padding: .26rem .62rem; border-radius: 999px;
  font-size: .7rem; font-weight: 800;
  background: rgba(6,9,17,.72); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,.08);
}
.world-status__dot { width: 7px; height: 7px; border-radius: 999px; }
.world-status.is-online  { color: #86efac; }
.world-status.is-online .world-status__dot { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,.7); }
.world-status.is-offline { color: #fca5a5; }
.world-status.is-offline .world-status__dot { background: #ef4444; }
.world-status.is-maint   { color: #fde047; }
.world-status.is-maint .world-status__dot { background: #eab308; }

.world-card__identity {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: .75rem;
  width: 100%; min-width: 0;
}
.world-card__icon {
  width: 2.9rem; height: 2.9rem; border-radius: 13px; flex-shrink: 0; overflow: hidden;
  border: 1px solid rgba(255,255,255,.14); background: rgba(12,16,30,.85);
  display: flex; align-items: center; justify-content: center;
  color: var(--srv-soft); font-weight: 900; font-size: 1.2rem;
  box-shadow: 0 8px 20px rgba(0,0,0,.35);
}
.world-card__icon img { width: 100%; height: 100%; object-fit: cover; }
.world-card__id-text { min-width: 0; flex: 1; }
.world-card__name {
  margin: 0;
  font-size: 1.08rem; font-weight: 800; color: #f4f7ff;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  text-shadow: 0 2px 8px rgba(0,0,0,.5);
}
.world-card__chips { display: flex; flex-wrap: wrap; gap: .32rem; margin-top: .32rem; }
.world-chip {
  font-size: .66rem; font-weight: 700; padding: .13rem .48rem; border-radius: 999px;
  color: #c9d6f0; background: rgba(255,255,255,.09); backdrop-filter: blur(4px);
}

.world-card__body {
  display: flex; flex-direction: column; gap: .85rem;
  padding: 1.05rem 1.15rem 1.2rem; flex: 1;
}
.world-card__desc {
  margin: 0; font-size: .83rem; line-height: 1.55; color: rgba(148,163,184,.85);
  min-height: 2.5em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.world-card__meta {
  display: flex; align-items: center; justify-content: space-between; gap: .6rem;
  font-size: .78rem;
}
.world-card__players {
  display: inline-flex; align-items: center; gap: .4rem;
  font-weight: 700; color: rgba(148,163,184,.6);
}
.world-card__players-dot {
  width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0;
  background: rgba(148,163,184,.4);
}
.world-card__players.is-live { color: #86efac; }
.world-card__players.is-live .world-card__players-dot {
  background: rgb(74 222 128);
  animation: pulse-dot 2s ease-in-out infinite;
}
.world-card__addr {
  font-family: ui-monospace, monospace; color: rgba(148,163,184,.5);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.world-card__btn {
  position: relative; z-index: 2;
  margin-top: auto; width: 100%; padding: .68rem;
  border: 1px solid rgba(255,255,255,.1); border-radius: 13px;
  font: inherit; font-size: .87rem; font-weight: 800; cursor: pointer;
  color: #e5e7ff; background: rgba(255,255,255,.05);
  transition: background .18s, border-color .18s, transform .12s;
}
.world-card__btn:hover { background: rgba(var(--srv-rgb),.14); border-color: rgba(var(--srv-rgb),.4); }
.world-card__btn:active { transform: scale(.99); }
.world-card__btn--active {
  color: #fff; border-color: transparent;
  background: linear-gradient(135deg, var(--srv), var(--srv-dark));
  box-shadow: 0 0 24px rgba(var(--srv-deep-rgb),.3);
  cursor: default;
}

.worlds-footer {
  margin-top: 1.4rem; display: flex; justify-content: flex-end;
}

/* skeleton */
.world-card--skeleton { pointer-events: none; min-height: 300px; }
.wc-skel-banner { height: 118px; border-radius: 0; }
.wc-skel-body { padding: 1.05rem 1.15rem; display: flex; flex-direction: column; gap: .7rem; }
.wc-skel-line { height: 14px; border-radius: 7px; width: 80%; }
.wc-skel-line--short { width: 45%; }

/* server note under scoped section headers */
.section-server-note {
  margin: .45rem 0 0;
  font-size: .78rem; font-weight: 600;
  color: rgba(var(--srv-soft-rgb),.6);
}

/* ════════════════════════════════════
   STEPS
════════════════════════════════════ */
.steps-section { padding: 5.5rem 0; }

.section-header { margin-bottom: 2.8rem; }
.section-h2 {
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  font-weight: 900; letter-spacing: -.045em;
  color: #f1f5f9; margin: .3rem 0 0;
}

.steps-grid {
  display: grid; gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.step-card {
  position: relative; overflow: hidden;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(var(--srv-rgb),.055) 0%, transparent 50%),
    rgba(255,255,255,.022);
  padding: 2rem;
  display: flex; flex-direction: column; gap: .8rem;
  transition: border-color .28s, background .28s, transform .22s, box-shadow .28s;
}
.step-card:hover {
  border-color: rgba(var(--srv-rgb),.32);
  background:
    linear-gradient(180deg, rgba(var(--srv-rgb),.1) 0%, transparent 60%),
    rgba(var(--srv-rgb),.04);
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(0,0,0,.32), 0 0 0 1px rgba(var(--srv-rgb),.12);
}

/* large ghost number — decorative */
.step-card::before {
  content: attr(data-num);
  position: absolute;
  right: 1.2rem; bottom: -.6rem;
  font-size: 7.5rem; font-weight: 900; line-height: 1;
  letter-spacing: -.08em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255,255,255,.055);
  user-select: none; pointer-events: none;
}

.step-card--accent {
  background:
    linear-gradient(180deg, rgba(var(--srv-deep-rgb),.18) 0%, transparent 60%),
    rgba(255,255,255,.032);
  border-color: rgba(var(--srv-rgb),.28);
}
.step-card--accent:hover {
  border-color: rgba(var(--srv-rgb),.52);
  box-shadow: 0 16px 48px rgba(0,0,0,.32), 0 0 36px rgba(var(--srv-deep-rgb),.16);
}
.step-card--accent::before {
  -webkit-text-stroke: 1px rgba(var(--srv-rgb),.1);
}

.step-card__num {
  font-size: .75rem; font-weight: 900; letter-spacing: .16em;
  color: rgba(var(--srv-rgb),.7);
}
.step-card__title {
  font-size: 1.12rem; font-weight: 900; color: #f1f5f9; margin: 0;
}
.step-card__desc {
  font-size: .84rem; line-height: 1.65; color: rgba(148,163,184,.85); margin: 0; flex: 1;
}
.step-card__link {
  display: inline-block; font-size: .82rem; font-weight: 700;
  color: var(--srv-soft); text-decoration: none;
  transition: color .18s, letter-spacing .18s;
}
.step-card__link:hover { color: var(--srv-pale); letter-spacing: .01em; }
.step-card__link--muted { color: rgba(148,163,184,.4); pointer-events: none; }

/* ════════════════════════════════════
   LAUNCHER
════════════════════════════════════ */
.launcher-section { padding: 0 0 5.5rem; }

.launcher-card {
  position: relative; overflow: hidden;
  border: 1px solid rgba(var(--srv-rgb),.32);
  border-radius: 28px;
  background: radial-gradient(ellipse at top left, rgba(var(--srv-deep-rgb),.3) 0%, transparent 55%),
    linear-gradient(135deg, rgba(20,16,42,.98), rgba(10,10,22,1));
  padding: 2.75rem;
  display: grid; gap: 2.5rem;
  grid-template-columns: 1fr auto;
  align-items: center;
  transition: box-shadow .3s;
}
.launcher-card:hover {
  box-shadow: 0 0 80px rgba(var(--srv-deep-rgb),.15), 0 24px 60px rgba(0,0,0,.4);
}
@media (max-width: 768px) { .launcher-card { grid-template-columns: 1fr; } }

.launcher-card__glow {
  position: absolute; width: 500px; height: 350px;
  background: rgba(var(--srv-deep-rgb),.18);
  filter: blur(100px); border-radius: 999px;
  top: -100px; left: -80px; pointer-events: none;
}

.launcher-card__title {
  font-size: clamp(1.6rem, 3vw, 2.3rem);
  font-weight: 900; letter-spacing: -.045em; color: #fff;
  margin: .4rem 0 .8rem;
}
.launcher-card__desc {
  font-size: .9rem; line-height: 1.72;
  color: rgba(255,255,255,.52); margin: 0 0 1.4rem; max-width: 480px;
}

.launcher-features {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: .5rem;
}
.launcher-features li {
  display: flex; align-items: center; gap: .6rem;
  font-size: .84rem; font-weight: 600; color: rgba(255,255,255,.62);
}
.lf-dot {
  width: 5px; height: 5px; border-radius: 999px; flex-shrink: 0;
  background: var(--srv-soft); box-shadow: 0 0 6px rgba(var(--srv-soft-rgb),.65);
}

.launcher-download-box {
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 22px;
  background: rgba(255,255,255,.04);
  padding: 1.6rem 1.85rem;
  display: flex; flex-direction: column; align-items: center; gap: .9rem;
  text-align: center; min-width: min(230px, 100%);
  backdrop-filter: blur(10px);
  transition: border-color .25s;
}
.launcher-download-box:hover { border-color: rgba(var(--srv-rgb),.35); }

.ldb-label {
  font-size: .75rem; font-weight: 700; letter-spacing: .18em;
  text-transform: uppercase; color: rgba(var(--srv-soft-rgb),.8); margin: 0;
}
.ldb-btn {
  display: inline-flex; align-items: center; gap: .5rem;
  padding: .9rem 1.7rem; border-radius: 15px;
  background: linear-gradient(135deg, var(--srv), var(--srv-dark));
  color: #fff; font-weight: 800; font-size: .95rem;
  text-decoration: none; white-space: nowrap;
  animation: ldb-pulse 3s ease-in-out infinite;
  transition: transform .18s;
}
.ldb-btn:hover { transform: translateY(-2px); }
.ldb-note {
  font-size: .75rem; line-height: 1.6; color: rgba(255,255,255,.38); margin: 0;
}
.ldb-note a { color: rgba(var(--srv-soft-rgb),.75); text-decoration: none; transition: color .18s; }
.ldb-note a:hover { color: var(--srv-pale); }

/* ════════════════════════════════════
   FEATURES
════════════════════════════════════ */
.features-section { padding: 0 0 5.5rem; }

.features-grid {
  display: grid; gap: .85rem;
  grid-template-columns: repeat(auto-fill, minmax(285px, 1fr));
}

.feat-card {
  position: relative; overflow: hidden;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 20px; background: rgba(255,255,255,.022);
  padding: 1.7rem; display: flex; flex-direction: column; gap: .85rem;
  transition: border-color .28s, background .28s, transform .22s, box-shadow .28s;
}
.feat-card:hover {
  border-color: rgba(var(--srv-rgb),.28);
  background: rgba(var(--srv-rgb),.05);
  transform: translateY(-4px);
  box-shadow: 0 10px 38px rgba(0,0,0,.28), 0 0 0 1px rgba(var(--srv-rgb),.1);
}

/* gradient border reveal on hover */
.feat-card::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(var(--srv-rgb),.55) 0%, rgba(56,189,248,.3) 50%, transparent 70%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.feat-card:hover::before { opacity: 1; }

.feat-card__icon {
  width: 46px; height: 46px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: transform .22s;
}
.feat-card:hover .feat-card__icon { transform: scale(1.1); }

.feat-icon--violet { background: rgba(var(--srv-rgb),.14);  border: 1px solid rgba(var(--srv-rgb),.24); color: var(--srv-soft); }
.feat-icon--sky    { background: rgba(56,189,248,.11);  border: 1px solid rgba(56,189,248,.22);  color: #7dd3fc; }
.feat-icon--green  { background: rgba(74,222,128,.11);  border: 1px solid rgba(74,222,128,.22);  color: #86efac; }
.feat-icon--amber  { background: rgba(251,191,36,.09);  border: 1px solid rgba(251,191,36,.2);   color: #fcd34d; }
.feat-icon--rose   { background: rgba(251,113,133,.09); border: 1px solid rgba(251,113,133,.2);  color: #fda4af; }
.feat-icon--indigo { background: rgba(99,102,241,.11);  border: 1px solid rgba(99,102,241,.22);  color: #a5b4fc; }

.feat-card__title {
  font-size: .97rem; font-weight: 800; color: #e2e8f0; margin: 0;
}
.feat-card__desc {
  font-size: .81rem; line-height: 1.65; color: rgba(100,116,139,.95); margin: 0;
}

/* ════════════════════════════════════
   CTA
════════════════════════════════════ */
.cta-section { padding: 0 0 6rem; }

.cta-card {
  position: relative; overflow: hidden;
  border: 1px solid rgba(255,255,255,.09); border-radius: 28px;
  background: radial-gradient(ellipse at center top, rgba(var(--srv-deep-rgb),.22) 0%, transparent 55%),
    linear-gradient(180deg, rgba(18,14,36,.98), rgba(8,8,18,1));
  padding: 5.5rem 2rem;
  display: flex; flex-direction: column; align-items: center;
  text-align: center;
}

.cta-card__glow {
  position: absolute; width: 600px; height: 200px;
  background: rgba(var(--srv-deep-rgb),.16); filter: blur(90px);
  border-radius: 999px; top: -30px; left: 50%; transform: translateX(-50%);
  pointer-events: none;
}
.cta-card__orb {
  position: absolute; border-radius: 999px; pointer-events: none; filter: blur(70px);
}
.cta-card__orb--1 {
  width: 300px; height: 200px;
  background: rgba(56,189,248,.07);
  bottom: -40px; left: -60px;
  animation: orb-float-2 14s ease-in-out infinite alternate;
}
.cta-card__orb--2 {
  width: 250px; height: 180px;
  background: rgba(var(--srv-soft-rgb),.07);
  bottom: -30px; right: -50px;
  animation: orb-float-1 11s ease-in-out infinite alternate;
}

.cta-card__title {
  font-size: clamp(2.2rem, 5vw, 3.2rem);
  font-weight: 900; letter-spacing: -.055em; color: #fff;
  margin: .5rem 0 .8rem;
}
.cta-card__desc {
  font-size: .95rem; color: rgba(255,255,255,.46);
  margin: 0 0 2.4rem; max-width: 360px;
}

.cta-actions {
  display: flex; flex-wrap: wrap; gap: .65rem;
  justify-content: center; margin-bottom: 2rem;
}

.cta-links {
  display: flex; flex-wrap: wrap; gap: .55rem;
  align-items: center; justify-content: center;
}
.cta-link {
  font-size: .78rem; font-weight: 600;
  color: rgba(148,163,184,.48); text-decoration: none;
  transition: color .18s;
}
.cta-link:hover { color: rgba(255,255,255,.72); }
.cta-links span { color: rgba(255,255,255,.14); }

/* ════════════════════════════════════
   SPOTLIGHT — свет за мышью
════════════════════════════════════ */
.step-card::after,
.feat-card::after,
.launcher-card::after,
.cta-card::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}

.step-card::after,
.feat-card::after {
  background: radial-gradient(
    circle 220px at var(--mx, 50%) var(--my, 50%),
    rgba(var(--srv-rgb), .11) 0%,
    transparent 70%
  );
}
.launcher-card::after {
  background: radial-gradient(
    circle 300px at var(--mx, 50%) var(--my, 50%),
    rgba(var(--srv-rgb), .14) 0%,
    transparent 65%
  );
}
.cta-card::after {
  background: radial-gradient(
    circle 340px at var(--mx, 50%) var(--my, 50%),
    rgba(var(--srv-rgb), .11) 0%,
    rgba(56, 189, 248, .05) 50%,
    transparent 70%
  );
}

.step-card.lit::after,
.feat-card.lit::after,
.launcher-card.lit::after,
.cta-card.lit::after { opacity: 1; }

/* ════════════════════════════════════
   MINECRAFT FLOATING ITEMS
════════════════════════════════════ */
@keyframes mc-float-a {
  0%, 100% { transform: translateY(0)    rotate(-5deg)  scale(1);    }
  50%       { transform: translateY(-22px) rotate(3deg)   scale(1.04); }
}
@keyframes mc-float-b {
  0%, 100% { transform: translateY(0)    rotate(8deg)   scale(1);    }
  50%       { transform: translateY(-16px) rotate(2deg)   scale(0.97); }
}
@keyframes mc-float-c {
  0%, 100% { transform: translateY(0)    rotate(-10deg) scale(1);    }
  50%       { transform: translateY(-26px) rotate(-4deg)  scale(1.06); }
}
@keyframes mc-float-d {
  0%, 100% { transform: translateY(0)    rotate(12deg)  scale(1);    }
  50%       { transform: translateY(-13px) rotate(6deg)   scale(0.96); }
}
@keyframes mc-float-e {
  0%, 100% { transform: translateY(0)    rotate(3deg)   scale(1);    }
  50%       { transform: translateY(-19px) rotate(-5deg)  scale(1.03); }
}
@keyframes mc-stage-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.hero__mc-stage {
  position: absolute;
  top: 0; bottom: 0;
  left: 50%; transform: translateX(-50%);
  width: min(1180px, 100vw);
  pointer-events: none;
  z-index: 1;
  animation: mc-stage-in 1.4s ease-out 1.1s both;
}

.mc-item {
  position: absolute;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  user-select: none; pointer-events: none;
}

.mc-item--sword {
  width: 108px; height: 108px;
  top: 14%; right: 18%; opacity: .42;
  animation: mc-float-a 7.5s ease-in-out infinite;
  filter: drop-shadow(0 0 18px rgba(103,232,249,.55)) drop-shadow(0 4px 8px rgba(0,0,0,.4));
}
.mc-item--beacon {
  width: 84px; height: 84px;
  top: 40%; right: 7%; opacity: .34;
  animation: mc-float-b 9.2s ease-in-out infinite;
  filter: drop-shadow(0 0 14px rgba(56,189,248,.5)) drop-shadow(0 4px 8px rgba(0,0,0,.4));
}
.mc-item--star {
  width: 76px; height: 76px;
  top: 8%; right: 32%; opacity: .32;
  animation: mc-float-c 11s ease-in-out infinite;
  filter: drop-shadow(0 0 12px rgba(251,191,36,.55)) drop-shadow(0 4px 8px rgba(0,0,0,.4));
}
.mc-item--egg {
  width: 70px; height: 70px;
  top: 60%; right: 11%; opacity: .30;
  animation: mc-float-d 8.3s ease-in-out infinite;
  filter: drop-shadow(0 0 12px rgba(var(--srv-soft-rgb),.5)) drop-shadow(0 4px 8px rgba(0,0,0,.4));
}
.mc-item--diamond {
  width: 64px; height: 64px;
  top: 26%; right: 35%; opacity: .33;
  animation: mc-float-e 6.8s ease-in-out infinite;
  filter: drop-shadow(0 0 10px rgba(103,232,249,.5)) drop-shadow(0 4px 6px rgba(0,0,0,.35));
}
.mc-item--table {
  width: 82px; height: 82px;
  top: 72%; right: 26%; opacity: .28;
  animation: mc-float-a 10.5s ease-in-out infinite reverse;
  filter: drop-shadow(0 0 12px rgba(var(--srv-rgb),.45)) drop-shadow(0 4px 8px rgba(0,0,0,.4));
}
.mc-item--obsidian {
  width: 66px; height: 66px;
  top: 46%; right: 38%; opacity: .22;
  animation: mc-float-b 13s ease-in-out infinite;
  filter: drop-shadow(0 0 10px rgba(var(--srv-deep-rgb),.4)) drop-shadow(0 4px 6px rgba(0,0,0,.35));
}

@media (max-width: 1100px) {
  .hero__mc-stage { display: none; }
}

@media (max-width: 768px) {
  .container-shell { padding-inline: .9rem; }
  .hero { padding: 5.5rem 0 6rem; }
  .hero__bottom-veil { height: 200px; }
  .steps-section { padding: 4rem 0; }
  .launcher-section { padding: 0 0 4rem; }
  .features-section { padding: 0 0 4rem; }
  .section-h2 { font-size: 1.55rem; }
}
</style>
