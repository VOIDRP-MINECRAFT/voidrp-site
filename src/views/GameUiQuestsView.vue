<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gameui.css'
import { getHudSnapshot, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken, runCommand, closeGui } from '../composables/useWebGui.js'
import GameUiNav from '../components/GameUiNav.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)

const loading = ref(true)
const completedQuests = ref(0)

const questTypes = [
  { key: 'daily',    icon: '🌅', cmd: '/dailyquest', accent: 'a' },
  { key: 'hard',     icon: '⚔️', cmd: '/bossquest',  accent: 'b' },
  { key: 'delivery', icon: '📦', cmd: '/delivery',   accent: 'c' },
]

onMounted(async () => {
  try {
    const snap = await getHudSnapshot()
    completedQuests.value = snap.completed_quests ?? 0
  } catch {
    // ignore — show 0
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="gui-root">
    <header class="gui-header">
      <span class="gui-title"><span class="gui-title-icon">📜</span>{{ t('gameUiQuests.title') }}</span>
      <button class="gui-close" @click="closeGui">✕</button>
    </header>

    <GameUiNav current="quests" />

    <div v-if="loading" class="gui-state"><span class="gui-spinner" /></div>

    <div v-else class="gui-body">
      <!-- Completed hero -->
      <div class="gui-card-hero q-hero">
        <span class="q-hero-icon">🏆</span>
        <div class="q-hero-info">
          <span class="q-hero-num">{{ completedQuests }}</span>
          <span class="q-hero-lbl">{{ t('gameUiQuests.completedTotal') }}</span>
        </div>
      </div>

      <div class="gui-section-title">{{ t('gameUiQuests.inGameOnlyTitle') }}</div>

      <!-- Quest type tiles -->
      <button
        v-for="q in questTypes"
        :key="q.key"
        class="q-tile"
        :data-accent="q.accent"
        @click="runCommand(q.cmd)"
      >
        <span class="q-tile-icon">{{ q.icon }}</span>
        <span class="q-tile-text">
          <span class="q-tile-name">{{ t('gameUiQuests.' + q.key) }}</span>
          <span class="q-tile-desc">{{ t('gameUiQuests.' + q.key + 'Desc') }}</span>
        </span>
        <span class="q-tile-arrow">→</span>
      </button>

      <div class="q-note">💡 {{ t('gameUiQuests.inGameOnlyDesc') }}</div>
    </div>
  </div>
</template>

<style scoped>
.q-hero { display: flex; align-items: center; gap: 16px; padding: 18px 20px; }
.q-hero-icon { font-size: 2.4rem; filter: drop-shadow(0 2px 8px rgba(251, 191, 36, 0.4)); }
.q-hero-info { display: flex; flex-direction: column; }
.q-hero-num {
  font-size: 1.9rem; font-weight: 900; line-height: 1;
  background: linear-gradient(90deg, #fcd34d, #fbbf24);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.q-hero-lbl { font-size: 0.74rem; color: #aab6d4; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }

.q-tile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 16px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: transform 0.12s, border-color 0.2s, background 0.2s;
}
.q-tile:hover { transform: translateX(3px); border-color: var(--q-c, rgba(129,140,248,0.5)); background: rgba(255, 255, 255, 0.055); }
.q-tile:active { transform: scale(0.985); }
.q-tile[data-accent="a"] { --q-c: rgba(251, 191, 36, 0.5); }
.q-tile[data-accent="b"] { --q-c: rgba(248, 113, 113, 0.5); }
.q-tile[data-accent="c"] { --q-c: rgba(168, 85, 247, 0.5); }

.q-tile-icon {
  width: 44px; height: 44px;
  border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.45rem;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(148, 163, 184, 0.1);
  flex-shrink: 0;
}
.q-tile-text { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.q-tile-name { font-size: 0.92rem; font-weight: 700; color: #e8eefc; }
.q-tile-desc { font-size: 0.74rem; color: #6b7a9c; line-height: 1.35; }
.q-tile-arrow { font-size: 1.1rem; color: #6b7a9c; flex-shrink: 0; transition: transform 0.15s, color 0.15s; }
.q-tile:hover .q-tile-arrow { transform: translateX(3px); color: #818cf8; }

.q-note {
  font-size: 0.78rem; color: #6b7a9c; line-height: 1.5;
  padding: 11px 13px; border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(148, 163, 184, 0.08);
}
</style>
