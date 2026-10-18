<script setup>
// Standings: one day (points for the team's place and for kills over that date's finished
// games, with the podium and the Excel export) or every game ever played on the server.
import { computed, onMounted, ref, watch } from 'vue'
import { authState } from '../../../stores/authStore'
import { toastError } from '../../../services/toast'
import { royaleAll, royaleDay, royaleExportDay } from '../../../services/royaleAdminApi'
import { TEAM_COLORS, clock, hearts, moscowDate, plural, timeOnly } from './royaleUi'

const props = defineProps({
  mode: { type: String, default: 'day' }, // day | all
  matches: { type: Array, default: () => [] },
})

const token = () => authState.accessToken
const date = ref('')
const data = ref(null)
const loading = ref(false)
const query = ref('')
const sortKey = ref('points')
const sortDesc = ref(true)

async function load() {
  loading.value = true
  try {
    if (props.mode === 'day') {
      // Today first (the event day); a day with no games falls back to the last game's day, once.
      const first = !date.value
      if (first) date.value = moscowDate(new Date().toISOString())
      data.value = await royaleDay(token(), date.value)
      const newest = props.matches.find((m) => !m.aborted && m.started_at)
      if (first && !data.value?.games && newest && moscowDate(newest.started_at) !== date.value) {
        date.value = moscowDate(newest.started_at)
        data.value = await royaleDay(token(), date.value)
      }
    } else {
      data.value = await royaleAll(token())
    }
  } catch (e) {
    toastError(e.message || 'Не удалось посчитать итоги')
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => props.mode, () => { data.value = null; load() })

async function exportDay() {
  try { await royaleExportDay(token(), date.value) } catch (e) { toastError(e.message) }
}

const podium = computed(() => {
  const t = data.value?.teams || []
  // 2nd · 1st · 3rd, like a real podium.
  return [t[1], t[0], t[2]].map((team, i) => team && { ...team, place: [2, 1, 3][i] }).filter(Boolean)
})

const COLS = [
  { key: 'points', label: 'Очки' },
  { key: 'wins', label: 'Побед' },
  { key: 'kills', label: 'Убийств' },
  { key: 'assists', label: 'Помощь' },
  { key: 'damage', label: 'Урон ❤', fmt: hearts },
  { key: 'best_place', label: 'Лучшее место', fmt: (v) => v || '—', asc: true },
  { key: 'alive_seconds', label: 'В живых', fmt: clock },
  { key: 'games', label: 'Игр' },
]
function sortBy(c) {
  if (sortKey.value === c.key) sortDesc.value = !sortDesc.value
  else { sortKey.value = c.key; sortDesc.value = !c.asc }
}
const players = computed(() => {
  const q = query.value.trim().toLowerCase()
  const rows = (data.value?.players || []).filter((p) => !q || p.name.toLowerCase().includes(q))
  const k = sortKey.value
  const rank = new Map((data.value?.players || []).map((p, i) => [p.name, i + 1]))
  return [...rows]
    .sort((a, b) => {
      const x = a[k] ?? (k === 'best_place' ? 99 : 0)
      const y = b[k] ?? (k === 'best_place' ? 99 : 0)
      return sortDesc.value ? y - x : x - y
    })
    .map((p) => ({ ...p, rank: rank.get(p.name) }))
})
const totals = computed(() => {
  const ps = data.value?.players || []
  return { players: ps.length, kills: ps.reduce((n, p) => n + (p.kills || 0), 0) }
})
</script>

<template>
  <div class="rs">
    <div class="adm-card adm-card--pad rs-head">
      <div>
        <div class="rs-h">{{ mode === 'day' ? 'Итоги дня' : 'Все игры сервера' }}</div>
        <div class="rs-sub">
          Очки: за место команды {{ (data?.place_points || []).join(' / ') }}, за убийство {{ data?.kill_points ?? 1 }}.
          Остановленные игры не считаются. Игроки — по нику, даже если меняли команду.
        </div>
      </div>
      <div v-if="mode === 'day'" class="rs-actions">
        <input v-model="date" type="date" class="adm-input rs-date" @change="load" />
        <a class="adm-btn" :class="{ 'adm-btn--disabled': !data?.games }" :href="`/print/royale/day/${date}`" target="_blank" rel="noopener">🏅 Грамоты</a>
        <button class="adm-btn" :disabled="!data?.games" @click="exportDay">⬇ Excel</button>
      </div>
    </div>

    <div v-if="loading && !data" class="adm-skel" style="height: 280px" />
    <div v-else-if="!data?.games" class="adm-card adm-card--pad adm-empty">
      <div class="adm-empty__title">{{ mode === 'day' ? `За ${date} законченных игр нет` : 'Законченных игр пока нет' }}</div>
    </div>
    <template v-else>
      <div class="rs-kpis">
        <div class="adm-kpi"><div><div class="adm-kpi__val">{{ data.games }}</div><div class="adm-kpi__label">{{ plural(data.games, 'игра', 'игры', 'игр') }}</div></div></div>
        <div class="adm-kpi"><div><div class="adm-kpi__val">{{ totals.players }}</div><div class="adm-kpi__label">игроков</div></div></div>
        <div class="adm-kpi"><div><div class="adm-kpi__val">{{ totals.kills }}</div><div class="adm-kpi__label">убийств</div></div></div>
        <div class="adm-kpi adm-kpi--acc" v-if="data.teams[0]">
          <div>
            <div class="adm-kpi__val" :style="{ color: TEAM_COLORS[data.teams[0].color] }">{{ data.teams[0].title }}</div>
            <div class="adm-kpi__label">впереди · {{ data.teams[0].points }} очк.</div>
          </div>
        </div>
      </div>

      <div class="adm-card adm-card--pad rs-podium-card">
        <div class="rs-podium">
          <div v-for="t in podium" :key="t.color" class="rs-step" :class="`rs-step--${t.place}`" :style="{ '--tc': TEAM_COLORS[t.color] }">
            <div class="rs-step-name">{{ t.title }}</div>
            <div class="rs-step-pts adm-num">{{ t.points }} <small>очк.</small></div>
            <div class="rs-step-block"><span>{{ t.place }}</span></div>
          </div>
        </div>
        <div class="adm-table-wrap rs-teams">
          <table class="adm-table rs-table">
            <thead><tr><th>#</th><th>Команда</th><th>Очки</th><th>Побед</th><th>Убийств</th><th>Игр</th></tr></thead>
            <tbody>
              <tr v-for="(t, i) in data.teams" :key="t.color">
                <td>{{ i + 1 }}</td>
                <td><span class="rs-sw" :style="{ background: TEAM_COLORS[t.color] }" /><b :style="{ color: TEAM_COLORS[t.color] }">{{ t.title }}</b></td>
                <td><b>{{ t.points }}</b></td><td>{{ t.wins }}</td><td>{{ t.kills }}</td><td>{{ t.games }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="adm-card adm-card--pad">
        <div class="adm-card__head">
          <h3 class="adm-card__title">Игроки · {{ totals.players }}</h3>
          <input v-model="query" class="adm-input rs-search" placeholder="Найти по нику" />
        </div>
        <div class="adm-table-wrap">
          <div class="adm-table-scroll">
            <table class="adm-table rs-table">
              <thead>
                <tr>
                  <th>#</th><th class="rs-left">Игрок</th><th class="rs-left">Команда</th>
                  <th v-for="c in COLS" :key="c.key" class="rs-th" :class="{ 'rs-th--on': sortKey === c.key }" @click="sortBy(c)">
                    {{ c.label }}<span v-if="sortKey === c.key">{{ sortDesc ? ' ▾' : ' ▴' }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in players" :key="p.name">
                  <td><span class="rs-rank" :class="p.rank <= 3 && `rs-rank--${p.rank}`">{{ p.rank }}</span></td>
                  <td class="rs-left"><b>{{ p.name }}</b></td>
                  <td class="rs-left" :style="{ color: TEAM_COLORS[p.team] }">{{ p.team_title || '—' }}</td>
                  <td v-for="c in COLS" :key="c.key" :class="{ 'rs-strong': c.key === 'points' }">{{ c.fmt ? c.fmt(p[c.key]) : (p[c.key] ?? 0) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-if="mode === 'day' && data.matches?.length" class="adm-card adm-card--pad">
        <div class="adm-card__head"><h3 class="adm-card__title">Игры дня</h3></div>
        <div class="rs-games">
          <div v-for="(m, i) in data.matches" :key="m.id" class="rs-game" :style="{ '--tc': TEAM_COLORS[m.winner] || 'var(--adm-faint)' }">
            <span class="rs-game-n">{{ i + 1 }}</span>
            <span>{{ timeOnly(m.started_at) }} · {{ clock(m.duration_seconds) }} · {{ m.players_count }} игр.</span>
            <b v-if="m.winner_title">★ {{ m.winner_title }}</b>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rs { display: flex; flex-direction: column; gap: 14px; }
.rs-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.rs-h { font-weight: 800; font-size: 1.05rem; color: var(--adm-text); }
.rs-sub { font-size: 12px; color: var(--adm-mut); margin-top: 3px; max-width: 70ch; }
.rs-actions { display: flex; gap: 8px; }
.rs-date { width: auto; }
.rs-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 760px) { .rs-kpis { grid-template-columns: repeat(2, 1fr); } }
.rs-podium-card { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(0, 1.3fr); gap: 18px; align-items: end; }
@media (max-width: 900px) { .rs-podium-card { grid-template-columns: 1fr; } }
.rs-podium { display: flex; align-items: flex-end; justify-content: center; gap: 10px; padding-top: 8px; }
.rs-step { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 33%; max-width: 140px; }
.rs-step-name { font-weight: 800; color: var(--tc); font-size: .86rem; text-align: center; }
.rs-step-pts { font-size: 1.05rem; font-weight: 800; color: var(--adm-text); }
.rs-step-pts small { font-size: .65rem; color: var(--adm-dim); }
.rs-step-block { width: 100%; border-radius: 10px 10px 4px 4px; display: grid; place-items: center; background: linear-gradient(180deg, color-mix(in srgb, var(--tc) 55%, #0c1220), color-mix(in srgb, var(--tc) 18%, #0c1220)); border: 1px solid color-mix(in srgb, var(--tc) 60%, transparent); }
.rs-step-block span { font-size: 1.6rem; font-weight: 900; color: rgba(255, 255, 255, .92); text-shadow: 0 2px 6px rgba(0, 0, 0, .4); }
.rs-step--1 .rs-step-block { height: 120px; box-shadow: 0 10px 30px -12px var(--tc); }
.rs-step--2 .rs-step-block { height: 88px; }
.rs-step--3 .rs-step-block { height: 64px; }
.rs-teams { border: 0; background: transparent; }
.rs-table th, .rs-table td { white-space: nowrap; text-align: right; }
.rs-table th:first-child, .rs-table td:first-child { text-align: left; width: 2.5rem; }
.rs-teams .rs-table th:nth-child(2), .rs-teams .rs-table td:nth-child(2) { text-align: left; }
.rs-left { text-align: left !important; }
.rs-sw { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 7px; }
.rs-th { cursor: pointer; user-select: none; }
.rs-th--on { color: var(--adm-acc-text); }
.rs-strong { font-weight: 800; color: var(--adm-text); }
.rs-search { max-width: 220px; }
.rs-rank { display: inline-grid; place-items: center; min-width: 1.6rem; height: 1.6rem; border-radius: 8px; font-weight: 800; font-size: .78rem; color: var(--adm-mut); }
.rs-rank--1 { background: rgba(250, 204, 21, .16); color: #facc15; }
.rs-rank--2 { background: rgba(203, 213, 225, .14); color: #e2e8f0; }
.rs-rank--3 { background: rgba(251, 146, 60, .14); color: #fdba74; }
.rs-games { display: flex; flex-direction: column; gap: 4px; }
.rs-game { display: flex; gap: 10px; align-items: center; font-size: 13px; padding: 6px 10px; border-radius: 9px; border-left: 3px solid var(--tc); background: rgba(148, 163, 184, .04); color: var(--adm-mut); }
.rs-game b { color: var(--tc); margin-left: auto; }
.rs-game-n { font-weight: 800; color: var(--adm-text); min-width: 1.4rem; }
</style>
