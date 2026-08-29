<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getLeaderboards, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)

const data = ref(null)
const loading = ref(true)
const error = ref(null)
const scope = ref('nations')   // nations | players
const metric = ref('prestige')

const METRICS = {
  nations: [
    { key: 'prestige',  icon: 'trophy',   fmt: 'num' },
    { key: 'treasury',  icon: 'treasury', fmt: 'money', gold: true },
    { key: 'territory', icon: 'map',      fmt: 'num' },
    { key: 'pvp',       icon: 'swords',   fmt: 'num' },
  ],
  players: [
    { key: 'pvp',      icon: 'swords', fmt: 'num' },
    { key: 'playtime', icon: 'clock',  fmt: 'time' },
    { key: 'balance',  icon: 'coins',  fmt: 'money', gold: true },
    { key: 'quests',   icon: 'quest',  fmt: 'num' },
  ],
}

async function load() {
  try { data.value = await getLeaderboards(); error.value = null }
  catch (e) { error.value = e.message }
  finally { loading.value = false }
}
onMounted(load)

function setScope(s) { scope.value = s; metric.value = METRICS[s][0].key }
const metrics = computed(() => METRICS[scope.value])
const activeMetric = computed(() => metrics.value.find(m => m.key === metric.value) || metrics.value[0])
const rows = computed(() => data.value?.[scope.value]?.[metric.value] || [])

function money(v) { return Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) }
function playtime(min) {
  const h = Math.floor(Number(min || 0) / 60)
  return h >= 1 ? `${money(h)} ${t('gameUiLeaderboards.hours')}` : `${Math.round(min)} ${t('gameUiLeaderboards.min')}`
}
function fmtValue(v) {
  const f = activeMetric.value.fmt
  if (f === 'money') return money(v)
  if (f === 'time') return playtime(v)
  return money(v)
}
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="leaderboards" />
    <GameUiTopBar :title="t('gameUiNav.leaderboards')" />

    <div class="gp-wrap gp-wrap--narrow gp-wrap--app">
      <div v-if="!token" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="lock" :size="30" /></span><span class="gp-state-text">{{ t('gameUiLeaderboards.tokenError') }}</span></div></div>
      <div v-else-if="loading" class="gp-center"><span class="gp-spinner"></span></div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <div v-else class="gp-panel lb">
        <div class="gp-phead">
          <span class="gp-phead-ic"><GuiIcon name="trophy" :size="16" /></span>
          <span class="gp-phead-tt">{{ t('gameUiLeaderboards.title') }}</span>
          <span class="gp-phead-sp"></span>
          <div class="gp-seg">
            <button class="gp-seg-btn" :class="{ active: scope==='nations' }" @click="setScope('nations')">{{ t('gameUiLeaderboards.nations') }}</button>
            <button class="gp-seg-btn" :class="{ active: scope==='players' }" @click="setScope('players')">{{ t('gameUiLeaderboards.players') }}</button>
          </div>
        </div>

        <div class="lb-metrics">
          <button v-for="m in metrics" :key="m.key" class="lb-metric" :class="{ active: metric===m.key }" @click="metric=m.key">
            <GuiIcon :name="m.icon" :size="14" />{{ t('gameUiLeaderboards.m_' + m.key) }}
          </button>
        </div>

        <div v-if="!rows.length" class="gp-state" style="padding:40px"><span class="gp-state-ico"><GuiIcon name="trophy" :size="30" /></span><span class="gp-state-text">{{ t('gameUiLeaderboards.empty') }}</span></div>

        <div v-else class="lb-list gp-stagger">
          <div v-for="r in rows" :key="r.rank" class="lb-row" :class="['rk-' + Math.min(r.rank, 4)]" :style="scope==='nations' && r.accent ? { '--nac': r.accent } : {}">
            <span class="lb-rank">{{ r.rank }}</span>
            <span v-if="scope==='nations'" class="lb-tag" :style="r.accent ? { color: r.accent, borderColor: r.accent + '66', background: r.accent + '1f' } : {}">{{ r.tag }}</span>
            <span class="lb-name" :style="scope==='nations' && r.accent ? { color: r.accent } : {}">{{ r.name }}</span>
            <span class="lb-val gp-num" :class="{ gold: activeMetric.gold }">
              <GuiIcon :name="activeMetric.icon" :size="13" class="lb-val-ic" />{{ fmtValue(r.value) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lb { min-height: 0; }
.lb-metrics { display: flex; gap: 6px; flex-wrap: wrap; }
.lb-metric {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 10px;
  border: 1px solid var(--gp-line); background: rgba(255,255,255,0.02); color: var(--gp-ink-soft);
  font-family: inherit; font-size: 0.76rem; font-weight: 700; cursor: pointer; transition: all 0.14s;
}
.lb-metric:hover { color: var(--gp-ink); border-color: var(--gp-line-strong); }
.lb-metric.active { background: rgba(139,123,255,0.16); border-color: rgba(139,123,255,0.4); color: #d7cffb; }
.lb-metric svg { color: var(--gp-violet-2); }

.lb-list { display: flex; flex-direction: column; gap: 7px; }
.lb-row {
  display: flex; align-items: center; gap: 12px; padding: 11px 14px;
  border-radius: 13px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.022);
  transition: border-color 0.14s, transform 0.1s;
}
.lb-row:hover { transform: translateX(2px); border-color: var(--gp-line-strong); }
.lb-rank {
  width: 30px; height: 30px; flex-shrink: 0; display: grid; place-items: center; border-radius: 9px;
  font-family: 'Silkscreen', 'JetBrains Mono', monospace; font-size: 0.72rem; font-weight: 700;
  color: var(--gp-ink-dim); background: rgba(0,0,0,0.28); border: 1px solid var(--gp-line);
}
.rk-1 .lb-rank { color: #1a1200; background: linear-gradient(135deg, #fcd34d, #f59e0b); border-color: transparent; box-shadow: 0 0 14px -2px rgba(251,191,36,0.7); }
.rk-2 .lb-rank { color: #11131f; background: linear-gradient(135deg, #e5e7eb, #9ca3af); border-color: transparent; }
.rk-3 .lb-rank { color: #1a0f06; background: linear-gradient(135deg, #d9a066, #b45309); border-color: transparent; }
.rk-1 { border-color: rgba(251,191,36,0.4); }

.lb-tag { flex-shrink: 0; font-size: 0.6rem; font-weight: 900; padding: 2px 7px; border-radius: 6px; color: #c9beff; background: rgba(139,123,255,0.14); border: 1px solid rgba(139,123,255,0.28); }
.lb-name { flex: 1; min-width: 0; font-size: 0.9rem; font-weight: 700; color: #eef2ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-val { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; font-size: 0.92rem; font-weight: 800; color: #dbe2f6; }
.lb-val.gold { color: var(--gp-gold); }
.lb-val-ic { color: var(--gp-ink-dim); }
.lb-val.gold .lb-val-ic { color: var(--gp-gold); }
</style>
