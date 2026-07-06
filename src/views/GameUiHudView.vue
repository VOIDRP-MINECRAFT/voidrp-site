<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getHudSnapshot, setWebguiToken } from '../services/gameUiApi.js'
import { API_BASE_URL } from '../services/apiBase'
import { useWebGuiToken, useWebGuiClient, runCommand } from '../composables/useWebGui.js'

const token = useWebGuiToken()
setWebguiToken(token)

const client = useWebGuiClient()
const data = ref(null)
const error = ref(null)
const clock = ref('')
let pollTimer = null
let clockTimer = null

async function load() {
  if (!token) { error.value = 'no_token'; return }
  try {
    data.value = await getHudSnapshot()
    error.value = null
  } catch (e) {
    error.value = e.message
  }
}

function tickClock() {
  clock.value = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  document.documentElement.classList.add('webgui-hud')
  load()
  tickClock()
  pollTimer = setInterval(load, 10_000)
  clockTimer = setInterval(tickClock, 15_000)
})
onUnmounted(() => {
  clearInterval(pollTimer)
  clearInterval(clockTimer)
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
  if (d.includes('the_nether')) return { icon: '🔥', name: 'Незер' }
  if (d.includes('the_end')) return { icon: '🌌', name: 'Энд' }
  if (d.includes('overworld')) return { icon: '🌳', name: 'Овермир' }
  return { icon: '🧭', name: '' }
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
  return { leader: 'Глава', officer: 'Офицер', member: 'Участник' }[r] || ''
}

function openMarket() { runCommand('/shop') }
function openQuests() { runCommand('/dailyquest') }
</script>

<template>
  <div class="hud">
    <div v-if="error && !data" class="hud-err">⚠ WebGUI</div>

    <div v-else class="hud-panel">
      <!-- Identity -->
      <div class="hud-id">
        <img
          v-if="headUrl"
          class="hud-avatar"
          :src="headUrl"
          alt=""
          @error="$event.target.style.visibility = 'hidden'"
        />
        <div class="hud-id-text">
          <span class="hud-name">{{ username || '—' }}</span>
          <span class="hud-nation" v-if="data && data.nation_name">
            🏛️ {{ data.nation_name }}<span class="hud-role" v-if="roleLabel(data.nation_role)"> · {{ roleLabel(data.nation_role) }}</span>
          </span>
          <span class="hud-nation hud-nation--none" v-else-if="data">Без государства</span>
        </div>
        <div class="hud-id-side">
          <span class="hud-ping" v-if="ping != null" :class="pingClass">
            <span class="hud-ping-dot" />{{ ping }}
          </span>
          <span class="hud-clock">{{ clock }}</span>
        </div>
      </div>

      <div class="hud-sep" />

      <!-- Stats -->
      <div class="hud-rows">
        <button class="hud-row hud-row--btn" @click="openMarket" title="Открыть рынок">
          <span class="hud-ic">💰</span>
          <span class="hud-money">{{ data ? formatBalance(data.balance) : '…' }}</span>
          <span class="hud-unit">мон.</span>
        </button>

        <div class="hud-row" v-if="pos">
          <span class="hud-ic">📍</span>
          <span class="hud-coords"><b>{{ pos.x }}</b> <b>{{ pos.y }}</b> <b>{{ pos.z }}</b></span>
        </div>

        <div class="hud-row" v-if="dimension.name">
          <span class="hud-ic">{{ dimension.icon }}</span>
          <span class="hud-dim">{{ dimension.name }}</span>
        </div>
      </div>

      <!-- Action badges -->
      <div class="hud-badges" v-if="data && (data.pending_deliveries > 0 || data.completed_quests > 0)">
        <button
          v-if="data.pending_deliveries > 0"
          class="hud-badge hud-badge--alert"
          @click="openMarket"
          title="Незабранные доставки на рынке"
        >📦 {{ data.pending_deliveries }}</button>
        <button
          v-if="data.completed_quests > 0"
          class="hud-badge"
          @click="openQuests"
          title="Выполнено квестов"
        >📜 {{ data.completed_quests }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap');

.hud {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 9999;
  pointer-events: none;
  font-family: 'Inter', system-ui, sans-serif;
  user-select: none;
}

/* No box-shadow / backdrop-filter: any soft blur on a transparent CEF surface smears
   into a "barrier" halo around the panel. Flat fill + crisp 1px border only.
   Text legibility over the game comes from a tight per-glyph text-shadow. */
.hud-panel {
  pointer-events: auto;
  min-width: 176px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(9, 13, 24, 0.52);
  border: 1px solid rgba(129, 140, 248, 0.28);
  border-left: 3px solid rgba(129, 140, 248, 0.95);
}
.hud-panel * { text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9); }

/* Identity */
.hud-id { display: flex; align-items: center; gap: 9px; }
.hud-avatar {
  width: 28px; height: 28px;
  border-radius: 6px;
  image-rendering: pixelated;
  border: 1px solid rgba(255, 255, 255, 0.18);
  flex-shrink: 0;
}
.hud-id-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.hud-name {
  font-size: 0.85rem; font-weight: 800; color: #ffffff;
  line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hud-nation { font-size: 0.69rem; font-weight: 600; color: #c3cdec; line-height: 1.1; }
.hud-nation--none { color: #8b97b5; }
.hud-role { color: #a78bfa; font-weight: 700; }

.hud-id-side { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.hud-ping {
  display: flex; align-items: center; gap: 4px;
  font-size: 0.66rem; font-weight: 700; color: #aab6d4;
}
.hud-ping-dot { width: 6px; height: 6px; border-radius: 50%; background: #64748b; box-shadow: none; }
.hud-ping.good { color: #4ade80; } .hud-ping.good .hud-ping-dot { background: #4ade80; }
.hud-ping.mid  { color: #fbbf24; } .hud-ping.mid  .hud-ping-dot { background: #fbbf24; }
.hud-ping.bad  { color: #f87171; } .hud-ping.bad  .hud-ping-dot { background: #f87171; }
.hud-clock { font-size: 0.64rem; font-weight: 600; color: #8b97b5; font-variant-numeric: tabular-nums; }

.hud-sep { height: 1px; background: rgba(255, 255, 255, 0.1); }

/* Stat rows */
.hud-rows { display: flex; flex-direction: column; gap: 4px; }
.hud-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #e6ebf7; }
.hud-row--btn {
  background: none; border: none; padding: 1px 0; margin: 0;
  font: inherit; color: inherit; cursor: pointer; width: 100%;
  transition: opacity 0.12s;
}
.hud-row--btn:hover { opacity: 0.75; }
.hud-ic { font-size: 0.86rem; width: 16px; text-align: center; flex-shrink: 0; }
.hud-money { font-weight: 800; color: #fcd34d; letter-spacing: 0.01em; }
.hud-unit { font-size: 0.64rem; color: #8b97b5; font-weight: 600; }

.hud-coords { display: flex; gap: 8px; font-variant-numeric: tabular-nums; font-size: 0.78rem; color: #cdd6ea; }
.hud-coords b { font-weight: 700; color: #ffffff; }
.hud-dim { font-size: 0.76rem; color: #cdd6ea; font-weight: 600; }

/* Badges */
.hud-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.hud-badge {
  pointer-events: auto;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.71rem; font-weight: 800;
  font-family: inherit;
  color: #c7d2fe;
  background: rgba(129, 140, 248, 0.2);
  border: 1px solid rgba(129, 140, 248, 0.4);
  cursor: pointer;
  transition: filter 0.12s, transform 0.1s;
}
.hud-badge:hover { filter: brightness(1.18); }
.hud-badge:active { transform: scale(0.94); }
.hud-badge--alert { color: #1a1205; background: rgba(251, 191, 36, 0.95); border-color: #fbbf24; }

.hud-err {
  pointer-events: auto;
  padding: 6px 11px;
  border-radius: 9px;
  background: rgba(40, 12, 12, 0.7);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #fca5a5;
  font-size: 0.76rem;
  font-weight: 600;
}
</style>
