<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getHudSnapshot, setWebguiToken } from '../services/gameUiApi.js'
import { API_BASE_URL } from '../services/apiBase'
import { useWebGuiToken, useWebGuiClient, runCommand } from '../composables/useWebGui.js'
import GuiIcon from '../components/GuiIcon.vue'
import GameUiNotifications from '../components/GameUiNotifications.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)

const client = useWebGuiClient()
const data = ref(null)
const error = ref(null)
const clock = ref('')
const flash = ref(null)     // { amount, positive } — balance change pop
const hidden = ref(false)   // slid off-screen (toggled by the in-game keybind)
let pollTimer = null
let clockTimer = null
let flashTimer = null
let prevBalance = null

try { hidden.value = localStorage.getItem('voidrp_hud_hidden') === '1' } catch {}
// The mod's HUD-slide keybind dispatches this event into the page; we animate the slide.
function onSlide() {
  hidden.value = !hidden.value
  try { localStorage.setItem('voidrp_hud_hidden', hidden.value ? '1' : '0') } catch {}
}

async function load() {
  if (!token) { error.value = 'no_token'; return }
  try {
    const next = await getHudSnapshot()
    // Balance-change flash (skip the first load)
    if (prevBalance != null && next.balance !== prevBalance) {
      const delta = next.balance - prevBalance
      flash.value = { amount: Math.abs(delta), positive: delta > 0 }
      clearTimeout(flashTimer)
      flashTimer = setTimeout(() => { flash.value = null }, 2600)
    }
    prevBalance = next.balance
    data.value = next
    error.value = null
  } catch (e) {
    error.value = e.message
  }
}

const bpPct = computed(() => {
  const d = data.value
  if (!d) return 0
  return Math.min(100, Math.round((d.bp_xp % 10000) / 100))
})

function tickClock() {
  clock.value = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  document.documentElement.classList.add('webgui-hud')
  window.addEventListener('webgui:hudSlide', onSlide)
  window.__voidHudToggle = onSlide  // fallback the mod can call directly
  load()
  tickClock()
  pollTimer = setInterval(load, 10_000)
  clockTimer = setInterval(tickClock, 15_000)
})
onUnmounted(() => {
  clearInterval(pollTimer)
  clearInterval(clockTimer)
  clearTimeout(flashTimer)
  window.removeEventListener('webgui:hudSlide', onSlide)
  document.documentElement.classList.remove('webgui-hud')
})

const username = computed(() => client.value?.username || '')
const headUrl = computed(() =>
  username.value ? `${API_BASE_URL}/public/player-head/${encodeURIComponent(username.value)}` : '',
)
const ping = computed(() => client.value?.server?.ping ?? null)
const pos = computed(() => {
  const p = client.value?.pos
  if (!p) return null
  return { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) }
})
const dimension = computed(() => {
  const d = client.value?.dimension || ''
  if (d.includes('the_nether')) return { icon: 'flame', name: t('gameUiHud.dimNether'), tint: '#fb7185' }
  if (d.includes('the_end')) return { icon: 'sparkles', name: t('gameUiHud.dimEnd'), tint: '#c084fc' }
  if (d.includes('overworld')) return { icon: 'globe', name: t('gameUiHud.dimOverworld'), tint: '#34d399' }
  return { icon: 'map', name: '', tint: '#8b7bff' }
})
const pingClass = computed(() => {
  const p = ping.value
  if (p == null) return ''
  if (p < 80) return 'good'
  if (p < 160) return 'mid'
  return 'bad'
})

function formatBalance(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}
function roleLabel(r) {
  return { leader: t('gameUiHud.roleLeader'), officer: t('gameUiHud.roleOfficer'), member: t('gameUiHud.roleMember') }[r] || ''
}
function openMarket() { runCommand('/shop') }
function openQuests() { runCommand('/dailyquest') }
</script>

<template>
  <div class="hud" :class="{ hidden }">
    <div v-if="error && !data" class="hud-err"><GuiIcon name="alert" :size="14" /> WebGUI</div>

    <div v-else class="hud-card">
      <!-- accent strip -->
      <span class="hud-accent" aria-hidden="true"></span>

      <!-- identity -->
      <div class="hud-top">
        <img v-if="headUrl" class="hud-avatar" :src="headUrl" alt="" @error="$event.target.style.visibility='hidden'" />
        <div class="hud-idt">
          <span class="hud-name">{{ username || '—' }}</span>
          <span v-if="data && data.nation_name" class="hud-nation">
            <GuiIcon name="shield" :size="11" />{{ data.nation_name }}<span v-if="roleLabel(data.nation_role)" class="hud-role"> · {{ roleLabel(data.nation_role) }}</span>
          </span>
          <span v-else-if="data" class="hud-nation hud-nation--none">{{ t('gameUiHud.noNation') }}</span>
        </div>
        <div class="hud-side">
          <span v-if="ping != null" class="hud-ping" :class="pingClass"><span class="hud-ping-dot" />{{ ping }}</span>
          <span class="hud-clock">{{ clock }}</span>
        </div>
      </div>

      <div class="hud-sep" />

      <!-- balance -->
      <button class="hud-balance" @click="openMarket" :title="t('gameUiHud.openMarket')">
        <span class="hud-bico"><GuiIcon name="coins" :size="15" /></span>
        <span class="hud-money">{{ data ? formatBalance(data.balance) : '…' }}</span>
        <span class="hud-unit">{{ t('gameUiHud.monUnit') }}</span>
        <transition name="hud-flash">
          <span v-if="flash" class="hud-delta" :class="flash.positive ? 'pos' : 'neg'">{{ flash.positive ? '+' : '−' }}{{ formatBalance(flash.amount) }}</span>
        </transition>
      </button>

      <!-- battle pass mini-bar -->
      <div v-if="data && data.bp_level" class="hud-bp" :class="{ prem: data.bp_has_premium }">
        <span class="hud-bp-lvl"><GuiIcon :name="data.bp_has_premium ? 'crown' : 'battlepass'" :size="12" />LVL {{ data.bp_level }}</span>
        <span class="hud-bp-track"><i :style="{ width: bpPct + '%' }"></i></span>
      </div>

      <!-- position -->
      <div class="hud-meta" v-if="pos">
        <span class="hud-chip">
          <GuiIcon name="map" :size="12" class="hud-chip-ic" />
          <span class="hud-coords"><b>{{ pos.x }}</b> <b>{{ pos.y }}</b> <b>{{ pos.z }}</b></span>
        </span>
      </div>

      <!-- deliveries alert (actionable) -->
      <div class="hud-badges" v-if="data && data.pending_deliveries > 0">
        <button class="hud-badge hud-badge--alert" @click="openMarket" :title="t('gameUiHud.pendingDeliveries')">
          <GuiIcon name="package" :size="12" />{{ data.pending_deliveries }}
        </button>
      </div>

      <!-- key hints -->
      <div class="hud-hint">
        <kbd class="hud-key">F6</kbd><span>{{ t('gameUiHud.hintMenu') }}</span>
        <span class="hud-hint-dot">·</span>
        <kbd class="hud-key">→</kbd><span>{{ t('gameUiHud.hintHide') }}</span>
      </div>
    </div>
  </div>

  <!-- reactive notification toasts (own stack, shown regardless of HUD slide state) -->
  <GameUiNotifications v-if="token" />
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&family=JetBrains+Mono:wght@600;700&display=swap');

.hud {
  /* Right edge, vertically centered — the notification stack will share this zone. */
  position: fixed; top: 50%; right: 14px; left: auto; transform: translateY(-50%);
  z-index: 9999;
  pointer-events: none;
  font-family: 'Inter', system-ui, sans-serif;
  user-select: none;
  transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
/* slid off the right edge (toggled by the in-game keybind) */
.hud.hidden { transform: translateY(-50%) translateX(calc(100% + 26px)); }

/* CEF-safe: NO backdrop-filter / box-shadow (they smear a halo on the transparent
   surface). Flat gradient fill + crisp 1px border. Per-glyph text-shadow for legibility. */
.hud-card {
  pointer-events: auto;
  position: relative;
  min-width: 158px; max-width: 200px;
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px 10px 8px 12px;
  border-radius: 11px;
  background: linear-gradient(160deg, rgba(16, 18, 34, 0.72), rgba(9, 11, 22, 0.62));
  border: 1px solid rgba(139, 123, 255, 0.3);
  overflow: hidden;
}
.hud-card * { text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9); }
.hud-accent {
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: linear-gradient(180deg, #8b7bff, #d946ef);
}

/* identity */
.hud-top { display: flex; align-items: center; gap: 8px; }
.hud-avatar {
  width: 26px; height: 26px; border-radius: 6px; image-rendering: pixelated;
  border: 1px solid rgba(139, 123, 255, 0.5); flex-shrink: 0;
}
.hud-idt { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.hud-name { font-size: 0.8rem; font-weight: 800; color: #fff; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-nation { display: flex; align-items: center; gap: 4px; font-size: 0.64rem; font-weight: 600; color: #c3cdec; line-height: 1.1; }
.hud-nation svg { color: #a78bfa; flex-shrink: 0; }
.hud-nation--none { color: #8b97b5; }
.hud-role { color: #a78bfa; font-weight: 700; }

.hud-side { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex-shrink: 0; }
.hud-ping { display: flex; align-items: center; gap: 4px; font-size: 0.62rem; font-weight: 800; color: #aab6d4; font-variant-numeric: tabular-nums; }
.hud-ping-dot { width: 5px; height: 5px; border-radius: 50%; background: #64748b; }
.hud-ping.good { color: #4ade80; } .hud-ping.good .hud-ping-dot { background: #4ade80; }
.hud-ping.mid { color: #fbbf24; } .hud-ping.mid .hud-ping-dot { background: #fbbf24; }
.hud-ping.bad { color: #f87171; } .hud-ping.bad .hud-ping-dot { background: #f87171; }
.hud-clock { font-size: 0.6rem; font-weight: 700; color: #8b97b5; font-variant-numeric: tabular-nums; }

.hud-sep { height: 1px; background: rgba(139, 123, 255, 0.16); }

/* balance */
.hud-balance {
  pointer-events: auto; display: flex; align-items: center; gap: 7px;
  padding: 4px 7px; width: 100%;
  border-radius: 8px; border: 1px solid rgba(251, 191, 36, 0.22);
  background: rgba(251, 191, 36, 0.08);
  font-family: inherit; cursor: pointer; transition: background 0.13s, border-color 0.13s;
}
.hud-balance:hover { background: rgba(251, 191, 36, 0.14); border-color: rgba(251, 191, 36, 0.4); }
.hud-balance:active { transform: scale(0.98); }
.hud-bico { color: #fbbf24; display: grid; place-items: center; flex-shrink: 0; }
.hud-money { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.84rem; color: #fcd34d; letter-spacing: 0.01em; }
.hud-unit { font-size: 0.58rem; color: #b48a2e; font-weight: 700; margin-left: auto; }

/* position + dimension chips */
.hud-meta { display: flex; gap: 5px; flex-wrap: wrap; }
.hud-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; border-radius: 7px;
  border: 1px solid rgba(139, 123, 255, 0.2); background: rgba(255, 255, 255, 0.04);
}
.hud-chip-ic { color: #9fb0d6; flex-shrink: 0; }
.hud-dim-ic { color: var(--dt, #8b7bff); }
.hud-coords { display: flex; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; color: #cdd6ea; }
.hud-coords b { font-weight: 700; color: #fff; }
.hud-dim { font-size: 0.68rem; color: #dbe2f6; font-weight: 700; }

/* badges */
.hud-badges { display: flex; gap: 5px; flex-wrap: wrap; }
.hud-badge {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 999px;
  font-size: 0.66rem; font-weight: 800; font-family: inherit;
  color: #c7d2fe; background: rgba(139, 123, 255, 0.2); border: 1px solid rgba(139, 123, 255, 0.42);
  cursor: pointer; transition: filter 0.12s, transform 0.1s;
}
.hud-badge:hover { filter: brightness(1.18); }
.hud-badge:active { transform: scale(0.94); }
.hud-badge--alert { color: #1a1205; background: rgba(251, 191, 36, 0.95); border-color: #fbbf24; }

/* F6 hint */
.hud-hint { display: flex; align-items: center; gap: 5px; font-size: 0.6rem; font-weight: 600; color: #8b97b5; }
.hud-key {
  font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; font-weight: 700; color: #c9beff;
  padding: 0 4px; border-radius: 4px; line-height: 1.5;
  background: rgba(139, 123, 255, 0.16); border: 1px solid rgba(139, 123, 255, 0.4);
  border-bottom-width: 2px;
}
.hud-hint-dot { color: #4b5570; }

/* collapse button */
.hud-collapse {
  pointer-events: auto; flex-shrink: 0; align-self: flex-start;
  display: grid; place-items: center; width: 19px; height: 19px; margin: -2px -2px 0 1px;
  border-radius: 6px; border: 1px solid rgba(139, 123, 255, 0.24);
  background: rgba(255, 255, 255, 0.05); color: #9fb0d6; cursor: pointer; transition: all 0.13s;
}
.hud-collapse:hover { background: rgba(139, 123, 255, 0.18); color: #d7cffb; }

/* balance delta flash */
.hud-balance { position: relative; }
.hud-delta {
  position: absolute; right: 8px; top: -13px;
  font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; font-weight: 800;
  padding: 0 4px; border-radius: 5px; pointer-events: none;
}
.hud-delta.pos { color: #4ade80; background: rgba(34, 197, 94, 0.14); }
.hud-delta.neg { color: #f87171; background: rgba(248, 113, 113, 0.14); }
.hud-flash-enter-active { transition: opacity 0.2s, transform 0.2s; }
.hud-flash-leave-active { transition: opacity 0.5s ease, transform 0.5s ease; }
.hud-flash-enter-from { opacity: 0; transform: translateY(6px); }
.hud-flash-leave-to { opacity: 0; transform: translateY(-10px); }

/* battle pass mini-bar */
.hud-bp { display: flex; align-items: center; gap: 8px; }
.hud-bp-lvl { display: flex; align-items: center; gap: 4px; font-size: 0.62rem; font-weight: 800; color: #c9beff; flex-shrink: 0; }
.hud-bp-lvl svg { color: #a78bfa; }
.hud-bp.prem .hud-bp-lvl { color: #fcd77a; } .hud-bp.prem .hud-bp-lvl svg { color: #fbbf24; }
.hud-bp-track { flex: 1; height: 4px; border-radius: 999px; background: rgba(0, 0, 0, 0.4); overflow: hidden; }
.hud-bp-track i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #7c6bff, #b45cf0); transition: width 0.5s ease; }
.hud-bp.prem .hud-bp-track i { background: linear-gradient(90deg, #f59e0b, #fbbf24); }

/* collapsed slim pill */
.hud-mini {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 7px;
  padding: 5px 9px 5px 6px; border-radius: 10px;
  background: linear-gradient(160deg, rgba(16, 18, 34, 0.72), rgba(9, 11, 22, 0.62));
  border: 1px solid rgba(139, 123, 255, 0.3); border-right: 3px solid rgba(139, 123, 255, 0.9);
  font-family: inherit; cursor: pointer; transition: border-color 0.13s;
}
.hud-mini * { text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9); }
.hud-mini:hover { border-color: rgba(139, 123, 255, 0.55); }
.hud-mini-av { width: 22px; height: 22px; border-radius: 5px; image-rendering: pixelated; border: 1px solid rgba(139, 123, 255, 0.5); flex-shrink: 0; }
.hud-mini-bal { display: flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; font-weight: 800; color: #fcd34d; }
.hud-mini-bal svg { color: #fbbf24; }
.hud-mini-lvl { font-size: 0.6rem; font-weight: 800; color: #c9beff; padding: 1px 6px; border-radius: 6px; background: rgba(139, 123, 255, 0.18); border: 1px solid rgba(139, 123, 255, 0.34); }
.hud-mini-arr { color: #7c889f; transform: rotate(180deg); }

.hud-err {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 11px; border-radius: 9px;
  background: rgba(40, 12, 12, 0.7); border: 1px solid rgba(248, 113, 113, 0.4);
  color: #fca5a5; font-size: 0.76rem; font-weight: 700;
}
</style>
