<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getHudSnapshot, setWebguiToken } from '../services/gameUiApi.js'
import { API_BASE_URL } from '../services/apiBase'
import { useWebGuiToken, useWebGuiClient, runCommand } from '../composables/useWebGui.js'
import GuiIcon from '../components/GuiIcon.vue'

const { t } = useI18n()
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
  <div class="hud">
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
      </button>

      <!-- position + dimension -->
      <div class="hud-meta" v-if="pos || dimension.name">
        <span v-if="pos" class="hud-chip">
          <GuiIcon name="map" :size="12" class="hud-chip-ic" />
          <span class="hud-coords"><b>{{ pos.x }}</b> <b>{{ pos.y }}</b> <b>{{ pos.z }}</b></span>
        </span>
        <span v-if="dimension.name" class="hud-chip" :style="{ '--dt': dimension.tint }">
          <GuiIcon :name="dimension.icon" :size="12" class="hud-chip-ic hud-dim-ic" />
          <span class="hud-dim">{{ dimension.name }}</span>
        </span>
      </div>

      <!-- action badges -->
      <div class="hud-badges" v-if="data && (data.pending_deliveries > 0 || data.completed_quests > 0)">
        <button v-if="data.pending_deliveries > 0" class="hud-badge hud-badge--alert" @click="openMarket" :title="t('gameUiHud.pendingDeliveries')">
          <GuiIcon name="package" :size="12" />{{ data.pending_deliveries }}
        </button>
        <button v-if="data.completed_quests > 0" class="hud-badge" @click="openQuests" :title="t('gameUiHud.questsDone')">
          <GuiIcon name="quest" :size="12" />{{ data.completed_quests }}
        </button>
      </div>

      <!-- F6 hint -->
      <div class="hud-hint"><kbd class="hud-key">F6</kbd><span>{{ t('gameUiHud.menuHint') }}</span></div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&family=JetBrains+Mono:wght@600;700&display=swap');

.hud {
  position: fixed; top: 14px; left: 14px; z-index: 9999;
  pointer-events: none;
  font-family: 'Inter', system-ui, sans-serif;
  user-select: none;
}

/* CEF-safe: NO backdrop-filter / box-shadow (they smear a halo on the transparent
   surface). Flat gradient fill + crisp 1px border. Per-glyph text-shadow for legibility. */
.hud-card {
  pointer-events: auto;
  position: relative;
  min-width: 190px;
  display: flex; flex-direction: column; gap: 8px;
  padding: 11px 13px 11px 15px;
  border-radius: 13px;
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
.hud-top { display: flex; align-items: center; gap: 9px; }
.hud-avatar {
  width: 30px; height: 30px; border-radius: 7px; image-rendering: pixelated;
  border: 1px solid rgba(139, 123, 255, 0.5); flex-shrink: 0;
}
.hud-idt { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.hud-name { font-size: 0.86rem; font-weight: 800; color: #fff; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-nation { display: flex; align-items: center; gap: 4px; font-size: 0.68rem; font-weight: 600; color: #c3cdec; line-height: 1.1; }
.hud-nation svg { color: #a78bfa; flex-shrink: 0; }
.hud-nation--none { color: #8b97b5; }
.hud-role { color: #a78bfa; font-weight: 700; }

.hud-side { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.hud-ping { display: flex; align-items: center; gap: 4px; font-size: 0.66rem; font-weight: 800; color: #aab6d4; font-variant-numeric: tabular-nums; }
.hud-ping-dot { width: 6px; height: 6px; border-radius: 50%; background: #64748b; }
.hud-ping.good { color: #4ade80; } .hud-ping.good .hud-ping-dot { background: #4ade80; }
.hud-ping.mid { color: #fbbf24; } .hud-ping.mid .hud-ping-dot { background: #fbbf24; }
.hud-ping.bad { color: #f87171; } .hud-ping.bad .hud-ping-dot { background: #f87171; }
.hud-clock { font-size: 0.64rem; font-weight: 700; color: #8b97b5; font-variant-numeric: tabular-nums; }

.hud-sep { height: 1px; background: rgba(139, 123, 255, 0.16); }

/* balance */
.hud-balance {
  pointer-events: auto; display: flex; align-items: center; gap: 8px;
  padding: 5px 8px; margin: -1px 0; width: 100%;
  border-radius: 9px; border: 1px solid rgba(251, 191, 36, 0.22);
  background: rgba(251, 191, 36, 0.08);
  font-family: inherit; cursor: pointer; transition: background 0.13s, border-color 0.13s;
}
.hud-balance:hover { background: rgba(251, 191, 36, 0.14); border-color: rgba(251, 191, 36, 0.4); }
.hud-balance:active { transform: scale(0.98); }
.hud-bico { color: #fbbf24; display: grid; place-items: center; flex-shrink: 0; }
.hud-money { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.92rem; color: #fcd34d; letter-spacing: 0.01em; }
.hud-unit { font-size: 0.62rem; color: #b48a2e; font-weight: 700; margin-left: auto; }

/* position + dimension chips */
.hud-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.hud-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px; border-radius: 8px;
  border: 1px solid rgba(139, 123, 255, 0.2); background: rgba(255, 255, 255, 0.04);
}
.hud-chip-ic { color: #9fb0d6; flex-shrink: 0; }
.hud-dim-ic { color: var(--dt, #8b7bff); }
.hud-coords { display: flex; gap: 7px; font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: #cdd6ea; }
.hud-coords b { font-weight: 700; color: #fff; }
.hud-dim { font-size: 0.72rem; color: #dbe2f6; font-weight: 700; }

/* badges */
.hud-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.hud-badge {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 999px;
  font-size: 0.71rem; font-weight: 800; font-family: inherit;
  color: #c7d2fe; background: rgba(139, 123, 255, 0.2); border: 1px solid rgba(139, 123, 255, 0.42);
  cursor: pointer; transition: filter 0.12s, transform 0.1s;
}
.hud-badge:hover { filter: brightness(1.18); }
.hud-badge:active { transform: scale(0.94); }
.hud-badge--alert { color: #1a1205; background: rgba(251, 191, 36, 0.95); border-color: #fbbf24; }

/* F6 hint */
.hud-hint { display: flex; align-items: center; gap: 6px; margin-top: 1px; font-size: 0.64rem; font-weight: 600; color: #8b97b5; }
.hud-key {
  font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; font-weight: 700; color: #c9beff;
  padding: 1px 5px; border-radius: 5px; line-height: 1.4;
  background: rgba(139, 123, 255, 0.16); border: 1px solid rgba(139, 123, 255, 0.4);
  border-bottom-width: 2px;
}

.hud-err {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 11px; border-radius: 9px;
  background: rgba(40, 12, 12, 0.7); border: 1px solid rgba(248, 113, 113, 0.4);
  color: #fca5a5; font-size: 0.76rem; font-weight: 700;
}
</style>
