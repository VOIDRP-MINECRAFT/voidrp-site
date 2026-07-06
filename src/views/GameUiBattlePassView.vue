<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gameui.css'
import { getBattlepassStatus, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken, closeGui } from '../composables/useWebGui.js'
import GameUiNav from '../components/GameUiNav.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)

const profile = ref(null)
const loading = ref(false)
const error = ref(null)

const XP_PER_LEVEL = 1000

async function load() {
  loading.value = true
  try {
    profile.value = await getBattlepassStatus()
    error.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

const xpInLevel = computed(() => profile.value ? profile.value.xp % XP_PER_LEVEL : 0)
const xpPercent = computed(() => Math.min(100, Math.round(xpInLevel.value / XP_PER_LEVEL * 100)))
const xpToNext = computed(() => XP_PER_LEVEL - xpInLevel.value)

function formatExpiry(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}
</script>

<template>
  <div class="gui-root">
    <header class="gui-header">
      <span class="gui-title"><span class="gui-title-icon">⭐</span>{{ t('gameUiBattlepass.title') }}</span>
      <button class="gui-close" @click="closeGui">✕</button>
    </header>

    <GameUiNav current="battlepass" />

    <div v-if="!token" class="gui-state"><span class="gui-state-icon">🔒</span><span class="gui-state-text">{{ t('gameUiBattlepass.tokenError') }}</span></div>
    <div v-else-if="loading" class="gui-state"><span class="gui-spinner" /><span class="gui-state-sub">{{ t('gameUiBattlepass.loading') }}</span></div>
    <div v-else-if="error" class="gui-state"><span class="gui-state-icon">⚠️</span><span class="gui-state-text">{{ error }}</span></div>

    <div v-else-if="profile" class="gui-body">
      <!-- Hero -->
      <div class="bp-hero" :class="{ premium: profile.has_premium }">
        <div class="bp-ring">
          <span class="bp-level">{{ profile.level }}</span>
          <span class="bp-level-lbl">{{ t('gameUiBattlepass.level') }}</span>
        </div>
        <div class="bp-meta">
          <div class="bp-season">{{ profile.season || t('gameUiBattlepass.title') }}</div>
          <div v-if="profile.has_premium" class="bp-premium">
            <span class="bp-star">⭐</span> {{ t('gameUiBattlepass.premium') }}
          </div>
          <div v-else class="bp-free">{{ t('gameUiBattlepass.noPremium') }}</div>
          <div v-if="profile.has_premium && profile.premium_expires_at" class="bp-expiry">
            {{ t('gameUiBattlepass.until') }} {{ formatExpiry(profile.premium_expires_at) }}
          </div>
        </div>
      </div>

      <!-- XP bar -->
      <div class="gui-card">
        <div class="xp-head">
          <span class="xp-total">{{ Number(profile.xp).toLocaleString('ru-RU') }} XP</span>
          <span class="xp-next">+{{ xpToNext }} → {{ profile.level + 1 }} {{ t('gameUiBattlepass.level').toLowerCase() }}</span>
        </div>
        <div class="xp-track">
          <div class="xp-fill" :class="{ premium: profile.has_premium }" :style="{ width: xpPercent + '%' }">
            <span class="xp-shine" />
          </div>
        </div>
        <div class="xp-foot">{{ xpInLevel }} / {{ XP_PER_LEVEL }} · {{ xpPercent }}%</div>
      </div>

      <div class="bp-note">💡 {{ t('gameUiBattlepass.rewardsNote') }}</div>
    </div>
  </div>
</template>

<style scoped>
.bp-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(139, 92, 246, 0.07));
  border: 1px solid rgba(129, 140, 248, 0.28);
}
.bp-hero.premium {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.16), rgba(217, 119, 6, 0.07));
  border-color: rgba(251, 191, 36, 0.4);
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.18), 0 10px 30px rgba(217, 119, 6, 0.18);
}

.bp-ring {
  width: 82px; height: 82px;
  border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex-shrink: 0;
  background: radial-gradient(circle at center, rgba(99, 102, 241, 0.25), rgba(99, 102, 241, 0.05));
  border: 2px solid rgba(129, 140, 248, 0.55);
  box-shadow: inset 0 0 18px rgba(129, 140, 248, 0.25);
}
.bp-hero.premium .bp-ring {
  background: radial-gradient(circle at center, rgba(251, 191, 36, 0.28), rgba(251, 191, 36, 0.05));
  border-color: rgba(251, 191, 36, 0.7);
  box-shadow: inset 0 0 18px rgba(251, 191, 36, 0.3);
}
.bp-level { font-size: 1.8rem; font-weight: 900; color: #a5b4fc; line-height: 1; }
.bp-hero.premium .bp-level { color: #fcd34d; }
.bp-level-lbl { font-size: 0.6rem; color: #6b7a9c; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }

.bp-meta { flex: 1; min-width: 0; }
.bp-season { font-size: 1rem; font-weight: 700; color: #e8eefc; margin-bottom: 5px; }
.bp-premium { font-size: 0.84rem; font-weight: 700; color: #fcd34d; display: flex; align-items: center; gap: 5px; }
.bp-star { filter: drop-shadow(0 0 5px rgba(251,191,36,0.7)); }
.bp-free { font-size: 0.82rem; color: #6b7a9c; }
.bp-expiry { font-size: 0.72rem; color: #6b7a9c; margin-top: 3px; }

.xp-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 9px; }
.xp-total { font-size: 0.92rem; font-weight: 800; color: #e8eefc; }
.xp-next { font-size: 0.72rem; color: #6b7a9c; }

.xp-track {
  height: 11px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.1);
}
.xp-fill {
  position: relative;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #6366f1, #818cf8);
  transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}
.xp-fill.premium { background: linear-gradient(90deg, #d97706, #fbbf24); }
.xp-shine {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  animation: xp-sweep 2.2s ease-in-out infinite;
}
@keyframes xp-sweep { 0% { transform: translateX(-100%); } 60%, 100% { transform: translateX(220%); } }
.xp-foot { text-align: right; font-size: 0.7rem; color: #6b7a9c; margin-top: 6px; }

.bp-note {
  font-size: 0.78rem; color: #6b7a9c; text-align: center;
  padding: 10px; border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(148, 163, 184, 0.08);
}
</style>
