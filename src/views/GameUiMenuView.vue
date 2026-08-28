<script setup>
import { ref, computed, onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import '../assets/gui-premium.css'
import { getHome, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken, useWebGuiClient, closeGui } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'
import CountUp from '../components/CountUp.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const token = useWebGuiToken()
setWebguiToken(token)
const client = useWebGuiClient()

const home = ref(null)
const loading = ref(true)
const error = ref(null)
const canvasRef = useTemplateRef('skinCanvas')
const skin3dOk = ref(false)
let viewer = null

const username = computed(() => home.value?.nickname || client.value?.username || '')
const ping = computed(() => client.value?.server?.ping)
const accent = computed(() => home.value?.nation?.accent_color || '#8b7bff')
const bpPct = computed(() => {
  const bp = home.value?.battlepass
  if (!bp) return 0
  const per = 10000
  return Math.min(100, Math.round((bp.xp % per) / per * 100))
})

const tiles = [
  { key: 'research',   icon: 'tech',       route: 'game-ui-research' },
  { key: 'treasury',   icon: 'treasury',   route: 'game-ui-treasury' },
  { key: 'quests',     icon: 'quest',      route: 'game-ui-quests' },
  { key: 'alliance',   icon: 'alliance',   route: 'game-ui-alliance' },
  { key: 'market',     icon: 'market',     route: 'game-ui-market' },
  { key: 'battlepass', icon: 'battlepass', route: 'game-ui-battlepass' },
]

function goTile(tile) {
  const raw = route.query.webgui_token
  const webgui_token = Array.isArray(raw) ? raw[0] : raw
  router.push({ name: tile.route, query: webgui_token ? { webgui_token } : {} })
}

async function load() {
  try {
    home.value = await getHome()
    error.value = null
    mountSkin()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function mountSkin() {
  if (!home.value?.skin_url) return
  await new Promise((r) => setTimeout(r, 50))
  if (!canvasRef.value) return
  try {
    const { SkinViewer, IdleAnimation } = await import('skinview3d')
    viewer = new SkinViewer({ canvas: canvasRef.value, width: 220, height: 320 })
    await viewer.loadSkin(home.value.skin_url, { model: home.value.skin_slim ? 'slim' : 'default' })
    viewer.animation = new IdleAnimation()
    viewer.autoRotate = true
    viewer.autoRotateSpeed = 0.6
    viewer.controls.enableZoom = false
    viewer.controls.enablePan = false
    viewer.zoom = 0.9
    viewer.fov = 40
    skin3dOk.value = true
  } catch (e) {
    if (viewer) { try { viewer.dispose() } catch {} viewer = null }
    skin3dOk.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => { if (viewer) { try { viewer.dispose() } catch {} } })

function art(id) { return `/item-icons/minecraft/${id}.png` }
function money(v) { return Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) }
function playtime(min) {
  const m = Number(min || 0)
  const h = Math.floor(m / 60)
  if (h < 1) return `${m}${t('gameUiHome.mShort')}`
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d}${t('gameUiHome.dShort')} ${h % 24}${t('gameUiHome.hShort')}`
  return `${h}${t('gameUiHome.hShort')} ${m % 60}${t('gameUiHome.mShort')}`
}
const kd = computed(() => {
  const s = home.value?.stats
  if (!s) return '0.0'
  return (s.pvp_kills / Math.max(1, s.deaths)).toFixed(2)
})
function roleLabel(r) {
  return { leader: t('gameUiHome.roleLeader'), officer: t('gameUiHome.roleOfficer'), member: t('gameUiHome.roleMember') }[r] || r
}
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <section class="gp-shell" :style="{ '--accent': accent }">
    <GameUiSidebar current="home" />
    <GameUiTopBar :title="t('gameUiNav.home')" />

    <div class="gp-wrap gp-wrap--wide gp-wrap--app">
      <div v-if="loading" class="dash gp-grow">
        <div class="gp-panel"><div class="gp-skel" style="width:100%;height:300px"></div><div class="gp-skel gp-skel-row" style="width:60%;height:22px;margin:14px auto 0"></div><div class="gp-skel gp-skel-row" style="width:40%;margin:10px auto 0"></div></div>
        <div class="right">
          <div class="gp-skel" style="height:190px;border-radius:20px"></div>
          <div class="gp-grid gp-grid--4"><div v-for="i in 4" :key="i" class="gp-skel" style="height:78px"></div></div>
          <div class="grid-2col"><div class="gp-skel" style="height:220px"></div><div class="gp-skel" style="height:220px"></div></div>
        </div>
      </div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <div v-else-if="home" class="dash gp-grow">
        <!-- LEFT: profile card -->
        <div class="gp-panel profile">
          <div class="skin-stage" :style="{ '--glow': accent }">
            <canvas ref="skinCanvas" class="skin-canvas" :class="{ show: skin3dOk }"></canvas>
            <img v-if="!skin3dOk" class="skin-fallback" :src="`https://mc-heads.net/body/${username}/front`" alt="" />
            <span v-if="skin3dOk" class="skin-hint">↔ {{ t('gameUiHome.dragHint') }}</span>
          </div>

          <div class="id-row">
            <span class="id-name" :style="{ color: accent }">{{ username }}</span>
          </div>
          <div class="id-tags">
            <span v-if="home.nation?.custom_prefix" class="prefix" :style="{ color: accent }">{{ home.nation.custom_prefix }}</span>
            <span v-if="home.nation" class="ntag" :style="{ color: accent, borderColor: accent + '55', background: accent + '1a' }">{{ home.nation.tag }}</span>
          </div>
          <div v-if="home.nation" class="nrole"><GuiIcon name="shield" :size="13" />{{ roleLabel(home.nation.role) }} · {{ home.nation.title }}</div>
          <div v-else class="nrole gp-muted">{{ t('gameUiHome.noNation') }}</div>

          <div v-if="home.battlepass" class="bp-mini">
            <div class="bp-mini-head">
              <span class="bp-mini-lv"><GuiIcon name="battlepass" :size="14" />{{ t('gameUiHome.level') || 'Уровень' }} {{ home.battlepass.level }}</span>
              <span v-if="home.battlepass.has_premium" class="gp-pill gp-pill--gold"><GuiIcon name="crown" :size="13" />Premium</span>
            </div>
            <div class="gp-track" style="height:8px"><div class="gp-fill" :class="{ 'gp-fill--gold': home.battlepass.has_premium }" :style="{ width: bpPct + '%' }"></div></div>
          </div>

          <div class="id-meta">
            <span v-if="ping != null" class="meta-item"><span class="dot" :class="ping < 80 ? 'good' : ping < 160 ? 'mid' : 'bad'"></span>{{ ping }} ms</span>
            <span class="meta-item gp-muted">{{ t('gameUiHome.since') }} {{ formatDate(home.registered_at) }}</span>
          </div>
        </div>

        <!-- RIGHT -->
        <div class="right">
          <!-- welcome hero -->
          <div class="welcome">
            <div class="welcome-bg"></div>
            <div class="welcome-art" aria-hidden="true">
              <img :src="art('enchanting_table')" class="wa wa0" alt="" @error="$event.target.remove()" />
              <img :src="art('diamond_block')" class="wa wa1" alt="" @error="$event.target.remove()" />
              <img :src="art('netherite_block')" class="wa wa2" alt="" @error="$event.target.remove()" />
              <img :src="art('amethyst_shard')" class="wa wa3" alt="" @error="$event.target.remove()" />
            </div>
            <div class="welcome-in">
              <div class="gp-eyebrow">VoidRP · {{ t('gameUiHome.welcomeKicker') }}</div>
              <h1 class="welcome-tt">{{ t('gameUiHome.welcomeTitle') }} <span>VOID<b>RP</b></span></h1>
              <p class="welcome-sub">{{ t('gameUiHome.welcomeSub') }}</p>
              <button class="gp-btn gp-btn--primary welcome-cta" @click="closeGui">
                <GuiIcon name="play" :size="16" />{{ t('gameUiHome.playBtn') }}
              </button>
            </div>
          </div>

          <!-- KPIs -->
          <div class="gp-grid gp-grid--4 gp-stagger">
            <div class="gp-kpi gp-kpi--gold">
              <div class="gp-kpi-top"><GuiIcon name="wallet" :size="15" /><span class="gp-kpi-lbl">{{ t('gameUiHome.balance') }}</span></div>
              <div class="gp-kpi-val"><CountUp :value="home.stats.balance" :format="money" /></div>
            </div>
            <div class="gp-kpi">
              <div class="gp-kpi-top"><GuiIcon name="swords" :size="15" /><span class="gp-kpi-lbl">{{ t('gameUiHome.pvp') }}</span></div>
              <div class="gp-kpi-val">{{ home.stats.pvp_kills }}</div>
            </div>
            <div class="gp-kpi">
              <div class="gp-kpi-top"><GuiIcon name="skull" :size="15" /><span class="gp-kpi-lbl">{{ t('gameUiHome.deaths') }}</span></div>
              <div class="gp-kpi-val">{{ home.stats.deaths }}</div>
            </div>
            <div class="gp-kpi">
              <div class="gp-kpi-top"><GuiIcon name="clock" :size="15" /><span class="gp-kpi-lbl">{{ t('gameUiHome.playtime') }}</span></div>
              <div class="gp-kpi-val">{{ playtime(home.stats.playtime_minutes) }}</div>
            </div>
          </div>

          <!-- stat grid + quick tiles -->
          <div class="grid-2col">
            <div class="gp-panel">
              <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="activity" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiHome.stats') }}</span></div>
              <div class="stat-grid gp-stagger">
                <div class="scell"><GuiIcon name="target" :size="16" class="s-ic" /><span class="s-lbl">K/D</span><span class="s-val gp-num">{{ kd }}</span></div>
                <div class="scell"><GuiIcon name="flame" :size="16" class="s-ic" /><span class="s-lbl">{{ t('gameUiHome.streak') }}</span><span class="s-val gp-num">{{ home.stats.best_kill_streak }}</span></div>
                <div class="scell"><GuiIcon name="skull" :size="16" class="s-ic" /><span class="s-lbl">{{ t('gameUiHome.mobs') }}</span><span class="s-val gp-num">{{ home.stats.mob_kills }}</span></div>
                <div class="scell"><GuiIcon name="quest" :size="16" class="s-ic" /><span class="s-lbl">{{ t('gameUiHome.quests') }}</span><span class="s-val gp-num">{{ home.stats.completed_quests }}</span></div>
                <div class="scell"><GuiIcon name="pickaxe" :size="16" class="s-ic" /><span class="s-lbl">{{ t('gameUiHome.mined') }}</span><span class="s-val gp-num">{{ money(home.stats.blocks_broken) }}</span></div>
                <div class="scell"><GuiIcon name="package" :size="16" class="s-ic" /><span class="s-lbl">{{ t('gameUiHome.placed') }}</span><span class="s-val gp-num">{{ money(home.stats.blocks_placed) }}</span></div>
              </div>
            </div>

            <div class="gp-panel">
              <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="grid" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiHome.quickAccess') }}</span></div>
              <div class="tiles gp-stagger">
                <button v-for="tile in tiles" :key="tile.key" class="tile" @click="goTile(tile)">
                  <GuiIcon :name="tile.icon" :size="20" />
                  <span>{{ t('gameUiNav.' + tile.key) }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dash { display: grid; grid-template-columns: 320px 1fr; gap: 16px; align-items: start; }
@media (max-width: 900px) { .dash { grid-template-columns: 1fr; } }

/* profile */
.profile { align-items: center; gap: 12px; }
.skin-stage {
  position: relative; width: 100%; height: 300px; flex-shrink: 0;
  border-radius: 14px; overflow: hidden;
  background:
    radial-gradient(150px 200px at 50% 42%, color-mix(in srgb, var(--glow) 26%, transparent), transparent 70%),
    linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.35));
  border: 1px solid var(--gp-line); display: grid; place-items: center;
}
.skin-canvas { display: block; cursor: grab; opacity: 0; transition: opacity 0.3s; }
.skin-canvas.show { opacity: 1; }
.skin-canvas:active { cursor: grabbing; }
.skin-fallback { position: absolute; inset: 0; margin: auto; height: 86%; width: auto; image-rendering: pixelated; }
.skin-hint { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); font-size: 0.62rem; color: var(--gp-ink-dim); letter-spacing: 0.05em; }

.id-row { display: flex; align-items: center; justify-content: center; }
.id-name { font-size: 1.6rem; font-weight: 900; letter-spacing: -0.01em; text-shadow: 0 0 26px color-mix(in srgb, var(--accent) 50%, transparent); }
.id-tags { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
.prefix { font-size: 0.8rem; font-weight: 900; }
.ntag { font-size: 0.7rem; font-weight: 900; padding: 2px 9px; border-radius: 7px; border: 1px solid; }
.nrole { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--gp-ink-soft); }

.bp-mini { width: 100%; display: flex; flex-direction: column; gap: 7px; padding: 12px; border-radius: 12px; border: 1px solid var(--gp-line); background: rgba(0,0,0,0.2); }
.bp-mini-head { display: flex; align-items: center; justify-content: space-between; }
.bp-mini-lv { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 800; color: #c9beff; }

.id-meta { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin-top: 2px; }
.meta-item { display: flex; align-items: center; gap: 6px; font-size: 0.74rem; color: var(--gp-ink-soft); }
.dot { width: 7px; height: 7px; border-radius: 50%; }
.dot.good { background: var(--gp-green); box-shadow: 0 0 7px rgba(52,211,153,0.7); }
.dot.mid { background: var(--gp-gold); box-shadow: 0 0 7px rgba(251,191,36,0.7); }
.dot.bad { background: var(--gp-red); box-shadow: 0 0 7px rgba(251,113,133,0.7); }

/* right */
.right { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.welcome { position: relative; overflow: hidden; border-radius: var(--gp-r-xl); border: 1px solid rgba(139,123,255,0.26); min-height: 190px; display: flex; box-shadow: var(--gp-sh-md); }
.welcome-bg {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(560px 300px at 84% -10%, rgba(217,70,239,0.28), transparent 58%),
    radial-gradient(460px 320px at 8% 130%, rgba(139,123,255,0.32), transparent 60%),
    linear-gradient(120deg, rgba(34,24,64,0.94), rgba(12,12,26,0.86));
}
/* Minecraft block textures as decorative artwork (local assets, Type C) */
.welcome-art { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.wa { position: absolute; image-rendering: pixelated; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5)); }
.wa0 { width: 118px; height: 118px; right: 40px; top: 50%; transform: translateY(-50%) rotate(-8deg); opacity: 0.9; filter: drop-shadow(0 0 26px rgba(139,123,255,0.6)) drop-shadow(0 8px 14px rgba(0,0,0,0.55)); animation: wfloat 5s ease-in-out infinite; }
.wa1 { width: 46px; height: 46px; right: 150px; top: 26px; opacity: 0.55; transform: rotate(10deg); animation: wfloat 6s ease-in-out 0.4s infinite; }
.wa2 { width: 40px; height: 40px; right: 30px; bottom: 22px; opacity: 0.5; transform: rotate(-6deg); animation: wfloat 5.5s ease-in-out 0.8s infinite; }
.wa3 { width: 34px; height: 34px; right: 200px; bottom: 30px; opacity: 0.45; animation: wfloat 6.5s ease-in-out 0.2s infinite; }
@keyframes wfloat { 0%,100% { translate: 0 0; } 50% { translate: 0 -8px; } }
.welcome-in { position: relative; z-index: 2; padding: 24px 26px; display: flex; flex-direction: column; gap: 6px; justify-content: center; max-width: 62%; }
.welcome-tt { font-size: 1.8rem; font-weight: 900; line-height: 1.02; color: #f4f7ff; }
.welcome-tt span { color: #c4b5fd; } .welcome-tt b { color: #a78bfa; }
.welcome-sub { font-size: 0.82rem; color: var(--gp-ink-soft); line-height: 1.5; }
.welcome-cta { margin-top: 12px; align-self: flex-start; }

.grid-2col { display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; align-items: stretch; }
@media (max-width: 760px) { .grid-2col { grid-template-columns: 1fr; } }
.grid-2col > .gp-panel { height: 100%; }

.stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 1fr; gap: 10px; flex: 1 1 auto; }
@media (max-width: 620px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
.scell { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 14px 8px; border-radius: 12px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.02); }
.s-ic { color: var(--gp-violet-2); }
.s-lbl { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gp-ink-dim); }
.s-val { font-size: 1.05rem; font-weight: 800; color: #eef2ff; }

.tiles { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 1fr; gap: 10px; flex: 1 1 auto; }
.tile {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
  padding: 14px 8px; border-radius: 13px; border: 1px solid var(--gp-line);
  background: rgba(255,255,255,0.025); color: var(--gp-ink-soft);
  font-family: inherit; font-size: 0.68rem; font-weight: 700; cursor: pointer;
  transition: transform 0.12s, border-color 0.15s, background 0.15s, color 0.15s;
}
.tile:hover { transform: translateY(-2px); border-color: rgba(139,123,255,0.4); background: rgba(139,123,255,0.1); color: #d7cffb; }
.tile:active { transform: scale(0.95); }
.tile svg { color: var(--gp-violet-2); }
</style>
