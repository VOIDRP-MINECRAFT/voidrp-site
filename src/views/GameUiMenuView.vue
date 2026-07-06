<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gameui.css'
import { useWebGuiClient, runCommand, openGui, closeGui } from '../composables/useWebGui.js'

const { t } = useI18n()
const client = useWebGuiClient()

const username = computed(() => client.value?.username || '')
const ping = computed(() => client.value?.server?.ping)

/* Buttons fire in-game commands → the plugin re-opens the target GUI with a
   FRESH signed token. This avoids the "session not confirmed" error you get
   when navigating to a tokenless URL via open_gui. */
const tiles = [
  { key: 'market',     icon: '🛒', cmd: '/shop',           accent: 'a' },
  { key: 'nmarket',    icon: '🏷️', cmd: '/nmarket',         accent: 'b' },
  { key: 'treasury',   icon: '🏦', cmd: '/nationtreasury',  accent: 'c' },
  { key: 'alliance',   icon: '🤝', cmd: '/alliance',        accent: 'd' },
  { key: 'battlepass', icon: '⭐', cmd: '/battlepass',      accent: 'e' },
  { key: 'quests',     icon: '📜', cmd: '/dailyquest',      accent: 'f' },
]

function openTile(tile) {
  runCommand(tile.cmd)
  // GUI is replaced by the server packet; close defensively if it isn't.
}

function openSite() {
  openGui('https://void-rp.ru')
}
</script>

<template>
  <div class="menu-root">
    <div class="menu-backdrop" @click="closeGui" />

    <div class="menu-panel">
      <button class="menu-close" @click="closeGui">✕</button>

      <!-- Brand -->
      <div class="menu-brand">
        <div class="menu-logo">VOID<span>RP</span></div>
        <div class="menu-sub">{{ t('gameUiMenu.title') }}</div>
      </div>

      <!-- Player chip -->
      <div v-if="username" class="menu-player">
        <img class="menu-avatar" :src="`https://mc-heads.net/avatar/${username}/40`" alt="" @error="$event.target.style.display='none'" />
        <div class="menu-player-info">
          <span class="menu-player-name">{{ username }}</span>
          <span v-if="ping != null" class="menu-player-ping">
            <span class="ping-dot" :class="{ good: ping < 80, mid: ping >= 80 && ping < 160, bad: ping >= 160 }" />
            {{ ping }} ms
          </span>
        </div>
      </div>

      <!-- Tiles -->
      <div class="menu-grid">
        <button
          v-for="tile in tiles"
          :key="tile.key"
          class="menu-tile"
          :data-accent="tile.accent"
          @click="openTile(tile)"
        >
          <span class="tile-glow" />
          <span class="tile-icon">{{ tile.icon }}</span>
          <span class="tile-label">{{ t('gameUiMenu.' + tile.key) }}</span>
        </button>
      </div>

      <!-- Footer -->
      <button class="menu-site" @click="openSite">
        🌐 {{ t('gameUiMenu.site') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.menu-root {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', system-ui, sans-serif;
}

.menu-backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.14), transparent 55%),
    rgba(4, 7, 14, 0.62);
  backdrop-filter: blur(7px);
}

.menu-panel {
  position: relative;
  width: 400px;
  max-width: 92vw;
  padding: 26px 26px 22px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(20, 27, 48, 0.92), rgba(12, 17, 33, 0.96));
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  animation: menu-pop 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes menu-pop {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.menu-close {
  position: absolute;
  top: 16px; right: 16px;
  width: 30px; height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: #94a3b8;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
}
.menu-close:hover { background: rgba(248, 113, 113, 0.16); color: #fca5a5; }

/* Brand */
.menu-brand { text-align: center; margin-bottom: 18px; }
.menu-logo {
  font-size: 1.7rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  color: #e8eefc;
  text-shadow: 0 0 24px rgba(129, 140, 248, 0.45);
}
.menu-logo span { color: #818cf8; }
.menu-sub {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: #6b7a9c;
  margin-top: 2px;
}

/* Player */
.menu-player {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 13px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(148, 163, 184, 0.12);
  margin-bottom: 18px;
}
.menu-avatar { width: 34px; height: 34px; border-radius: 8px; image-rendering: pixelated; }
.menu-player-info { display: flex; flex-direction: column; gap: 2px; }
.menu-player-name { font-size: 0.92rem; font-weight: 700; color: #e8eefc; }
.menu-player-ping { display: flex; align-items: center; gap: 5px; font-size: 0.72rem; color: #6b7a9c; }
.ping-dot { width: 7px; height: 7px; border-radius: 50%; background: #64748b; }
.ping-dot.good { background: #4ade80; box-shadow: 0 0 6px rgba(74, 222, 128, 0.7); }
.ping-dot.mid  { background: #fbbf24; box-shadow: 0 0 6px rgba(251, 191, 36, 0.7); }
.ping-dot.bad  { background: #f87171; box-shadow: 0 0 6px rgba(248, 113, 113, 0.7); }

/* Grid */
.menu-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 11px;
  margin-bottom: 14px;
}

.menu-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 18px 6px 15px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.14s, border-color 0.2s, background 0.2s;
}
.menu-tile:hover { transform: translateY(-3px); border-color: rgba(129, 140, 248, 0.5); background: rgba(99, 102, 241, 0.1); }
.menu-tile:active { transform: translateY(-1px) scale(0.97); }

.tile-glow {
  position: absolute;
  top: -40%; left: 50%;
  width: 120%; height: 90%;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, var(--tile-c, rgba(129,140,248,0.5)), transparent 70%);
  opacity: 0;
  transition: opacity 0.25s;
  pointer-events: none;
}
.menu-tile:hover .tile-glow { opacity: 0.55; }

.menu-tile[data-accent="a"] { --tile-c: rgba(99, 102, 241, 0.55); }
.menu-tile[data-accent="b"] { --tile-c: rgba(45, 212, 191, 0.55); }
.menu-tile[data-accent="c"] { --tile-c: rgba(168, 85, 247, 0.55); }
.menu-tile[data-accent="d"] { --tile-c: rgba(56, 189, 248, 0.55); }
.menu-tile[data-accent="e"] { --tile-c: rgba(251, 191, 36, 0.55); }
.menu-tile[data-accent="f"] { --tile-c: rgba(244, 114, 182, 0.55); }

.tile-icon { font-size: 1.7rem; line-height: 1; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)); }
.tile-label { font-size: 0.76rem; font-weight: 600; color: #cbd5e1; text-align: center; }

/* Site */
.menu-site {
  width: 100%;
  padding: 11px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.025);
  color: #94a3b8;
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.menu-site:hover { background: rgba(255, 255, 255, 0.06); color: #e8eefc; }
</style>
