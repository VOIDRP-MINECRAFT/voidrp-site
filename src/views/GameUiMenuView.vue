<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

function postToGame(payload) {
  if (typeof window !== 'undefined' && window.webgui && typeof window.webgui.postToGame === 'function') {
    window.webgui.postToGame(payload)
  }
}

function openMarket() {
  postToGame({ channel: 'open_gui', url: 'https://void-rp.ru/game-ui/market' })
}

function openTreasury() {
  postToGame({ channel: 'open_gui', url: 'https://void-rp.ru/game-ui/treasury' })
}

function openAlliance() {
  postToGame({ channel: 'open_gui', url: 'https://void-rp.ru/game-ui/alliance' })
}

function openBattlepass() {
  postToGame({ channel: 'open_gui', url: 'https://void-rp.ru/game-ui/battlepass' })
}

function openQuests() {
  postToGame({ channel: 'open_gui', url: 'https://void-rp.ru/game-ui/quests' })
}

function openSite() {
  postToGame({ channel: 'open_gui', url: 'https://void-rp.ru' })
}

function closeMenu() {
  postToGame({ channel: 'close' })
}

const buttons = [
  { key: 'market',     icon: '🛒', action: openMarket,     color: 'btn-primary' },
  { key: 'treasury',   icon: '🏦', action: openTreasury,   color: 'btn-secondary' },
  { key: 'alliance',   icon: '🤝', action: openAlliance,   color: 'btn-accent' },
  { key: 'battlepass', icon: '⭐', action: openBattlepass, color: 'btn-warning' },
  { key: 'quests',     icon: '📋', action: openQuests,     color: 'btn-info' },
  { key: 'site',       icon: '🌐', action: openSite,       color: 'btn-ghost' },
]
</script>

<template>
  <div class="game-ui-menu">
    <div class="menu-backdrop" @click="closeMenu" />
    <div class="menu-panel">
      <div class="menu-header">
        <span class="menu-title">{{ t('gameUiMenu.title') }}</span>
        <button class="btn btn-ghost btn-sm btn-circle close-btn" @click="closeMenu">✕</button>
      </div>
      <div class="menu-buttons">
        <button
          v-for="btn in buttons"
          :key="btn.key"
          class="btn menu-btn"
          :class="btn.color"
          @click="btn.action"
        >
          <span class="btn-icon">{{ btn.icon }}</span>
          <span>{{ t('gameUiMenu.' + btn.key) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.game-ui-menu {
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.menu-panel {
  position: relative;
  background: rgba(15, 20, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 28px 32px 32px;
  width: 360px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.menu-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.03em;
}

.close-btn {
  color: #94a3b8;
}

.menu-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.menu-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: auto;
  padding: 16px 8px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  transition: transform 0.1s, opacity 0.1s;
}

.menu-btn:active {
  transform: scale(0.96);
}

.btn-icon {
  font-size: 1.5rem;
  line-height: 1;
}
</style>
