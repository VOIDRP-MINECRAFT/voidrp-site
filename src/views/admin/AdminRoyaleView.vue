<script setup>
// Battle royale (VoidRP: Royale): the host panel to run the event from here (or a phone),
// every game the plugin reports, the day's standings, every game added up, and the settings.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState } from '../../stores/authStore'
import { toastError } from '../../services/toast'
import { royaleExport, royaleLive, royaleMatches } from '../../services/royaleAdminApi'
import RoyaleControl from './royale/RoyaleControl.vue'
import RoyaleMatches from './royale/RoyaleMatches.vue'
import RoyaleStandings from './royale/RoyaleStandings.vue'
import RoyaleSettings from './royale/RoyaleSettings.vue'
import RoyaleDashboard from './royale/RoyaleDashboard.vue'
import RoyalePlayers from './royale/RoyalePlayers.vue'
import RoyaleAnalytics from './royale/RoyaleAnalytics.vue'
import { clock } from './royale/royaleUi'

const route = useRoute()
const router = useRouter()
const token = () => authState.accessToken

const TABS = [
  { key: 'overview', label: 'Обзор' },
  { key: 'control', label: 'Пульт' },
  { key: 'players', label: 'Игроки' },
  { key: 'analytics', label: 'Аналитика' },
  { key: 'matches', label: 'Матчи' },
  { key: 'day', label: 'Итоги дня' },
  { key: 'all', label: 'Все игры' },
  { key: 'settings', label: 'Настройки' },
]
const tab = ref(TABS.some((t) => t.key === route.query.tab) ? route.query.tab : 'overview')
watch(tab, (t) => router.replace({ query: { ...route.query, tab: t } }))

// ── Matches (every 30 s) ─────────────────────────────────────────────────
const matches = ref([])
const loading = ref(true)
async function loadMatches() {
  try {
    matches.value = (await royaleMatches(token(), true)).items || []
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить матчи')
  } finally {
    loading.value = false
  }
}
const finished = computed(() => matches.value.filter((m) => !m.aborted).length)

// ── Live state (every 2 s on the panel, 10 s elsewhere; paused in a hidden tab) ──
const live = ref(null)
let inFlight = false
let lastState = null
async function loadLive() {
  if (inFlight || document.hidden) return
  inFlight = true
  try {
    live.value = await royaleLive(token(), tab.value === 'control')
    // A game just finished: its result is in the list now.
    if (lastState && lastState !== live.value.state && live.value.state === 'lobby') setTimeout(loadMatches, 3000)
    lastState = live.value.state
  } catch {
    live.value = live.value || { state: 'offline' }
  } finally {
    inFlight = false
  }
}

const STATE_SHORT = { offline: 'выключен', lobby: 'лобби', countdown: 'отсчёт', freeze: 'высадка', running: 'игра идёт', over: 'итоги' }
const pill = computed(() => {
  const l = live.value
  if (!l) return null
  const s = l.state || 'offline'
  let text = l.paused ? 'пауза' : STATE_SHORT[s] || s
  if (['running', 'freeze'].includes(s) && l.elapsed != null) text += ` · ${clock(l.elapsed)}`
  if (s !== 'offline') text += ` · ${l.online ?? 0} онлайн`
  const tone = s === 'offline' ? '' : l.paused || s === 'countdown' ? 'warn' : ['running', 'freeze'].includes(s) ? 'err' : 'ok'
  return { text, tone }
})

let liveTimer = null
let matchTimer = null
function schedule() {
  clearInterval(liveTimer)
  liveTimer = setInterval(loadLive, tab.value === 'control' ? 2000 : 10000)
}
watch(tab, () => { schedule(); loadLive() })
const onVisible = () => { if (!document.hidden) { loadLive(); loadMatches() } }

onMounted(() => {
  loadMatches()
  loadLive()
  schedule()
  matchTimer = setInterval(loadMatches, 30000)
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => {
  clearInterval(liveTimer)
  clearInterval(matchTimer)
  document.removeEventListener('visibilitychange', onVisible)
})

async function exportAll() {
  try { await royaleExport(token()) } catch (e) { toastError(e.message) }
}
</script>

<template>
  <div class="adm-page ry">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title ry-title">
          Королевская битва
          <span v-if="pill" class="ry-pill" :class="pill.tone && `ry-pill--${pill.tone}`"><span class="adm-dot" :class="pill.tone && `adm-dot--${pill.tone}`" />{{ pill.text }}</span>
        </h1>
        <p class="adm-sub">Ведите игру прямо отсюда, смотрите результаты каждого матча и итоги дня, выгружайте таблицы для учебной части.</p>
      </div>
      <div class="adm-head-actions">
        <button class="adm-btn" :disabled="!finished" @click="exportAll">⬇ Все матчи в Excel</button>
      </div>
    </div>

    <div class="ry-tabs-wrap">
      <div class="adm-tabs ry-tabs">
        <button v-for="t in TABS" :key="t.key" class="adm-tab" :class="{ 'adm-tab--active': tab === t.key }" @click="tab = t.key">
          {{ t.label }}<span v-if="t.key === 'matches' && matches.length" class="ry-count">{{ matches.length }}</span>
        </button>
      </div>
    </div>

    <RoyaleDashboard v-if="tab === 'overview'" />
    <RoyalePlayers v-else-if="tab === 'players'" />
    <RoyaleAnalytics v-else-if="tab === 'analytics'" />
    <RoyaleControl v-else-if="tab === 'control'" :live="live" @refresh="loadLive" />
    <RoyaleMatches v-else-if="tab === 'matches'" :matches="matches" :loading="loading" @reload="loadMatches" />
    <RoyaleStandings v-else-if="tab === 'day'" mode="day" :matches="matches" />
    <RoyaleStandings v-else-if="tab === 'all'" mode="all" :matches="matches" />
    <RoyaleSettings v-else-if="tab === 'settings'" @changed="loadLive" />
  </div>
</template>

<style scoped>
.ry { display: flex; flex-direction: column; gap: 14px; }
.ry-title { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ry-pill { display: inline-flex; align-items: center; gap: 7px; font-size: .74rem; font-weight: 700; padding: 4px 11px; border-radius: 999px; border: 1px solid var(--adm-line-strong); color: var(--adm-mut); background: rgba(148, 163, 184, .06); letter-spacing: 0; }
.ry-pill--ok { color: #6ee7b7; border-color: rgba(52, 211, 153, .3); }
.ry-pill--warn { color: #fde68a; border-color: rgba(251, 191, 36, .35); }
.ry-pill--err { color: #fca5a5; border-color: rgba(248, 113, 113, .4); background: rgba(248, 113, 113, .07); }
.ry-tabs-wrap { overflow-x: auto; }
.ry-tabs { flex-wrap: nowrap; }
.ry-count { margin-left: 6px; font-size: .68rem; padding: 1px 6px; border-radius: 999px; background: rgba(148, 163, 184, .12); }
</style>
