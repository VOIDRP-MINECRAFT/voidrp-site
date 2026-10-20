<script setup>
// The Royale dashboard: live state, headline numbers, top players, recent games, quick actions.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { authState, hasPermission } from '../../../stores/authStore'
import { toastError, toastSuccess } from '../../../services/toast'
import { royaleOverview, royaleCommand } from '../../../services/royaleAdminApi'
import { clock } from './royaleUi'

const token = () => authState.accessToken
const canControl = computed(() => hasPermission('royale.control'))
const data = ref(null)
const busy = ref('')
let timer = null

async function load() {
  try { data.value = await royaleOverview(token()) } catch (e) { toastError(e.message || 'Не удалось загрузить') }
}
onMounted(() => { load(); timer = setInterval(load, 5000) })
onUnmounted(() => clearInterval(timer))

const stateLabel = computed(() => {
  const d = data.value
  if (!d || !d.server_online) return { t: 'Сервер офлайн', c: 'off' }
  if (d.in_game) return { t: 'Идёт раунд', c: 'live' }
  if (d.state === 'countdown') return { t: `Старт через ${d.countdown ?? '…'} с`, c: 'soon' }
  return { t: 'В лобби — ждём игроков', c: 'lobby' }
})

async function doCommand(action, label) {
  busy.value = action
  try {
    const res = await royaleCommand(token(), { action })
    toastSuccess(res.answer || label)
    setTimeout(load, 1200)
  } catch (e) { toastError(e.message || 'Не вышло') } finally { busy.value = '' }
}
const fmtDur = (s) => (s ? clock(s) : '—')
const head = (nick) => `/api/v1/public/player-head/${encodeURIComponent(nick)}`
const headFallback = (e, nick) => { if (!e.target.dataset.fb) { e.target.dataset.fb = 1; e.target.src = `https://mc-heads.net/avatar/${encodeURIComponent(nick)}/40` } }

// Lucide-style inline icons (the admin font has no emoji).
const IC = {
  games: 'M6 12h4m-2-2v4M15 13h.01M18 11h.01M17.5 6h-11A4.5 4.5 0 0 0 2 10.5L1.6 15a3 3 0 0 0 5.1 2.3L8 16h8l1.3 1.3a3 3 0 0 0 5.1-2.3L22 10.5A4.5 4.5 0 0 0 17.5 6Z',
  today: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  week: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM8 14h3',
  players: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1A4 4 0 0 1 16 11',
  kills: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M5 14l-3 3 3 3 3-3',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0V4ZM5 6H3v1a3 3 0 0 0 3 3M19 6h2v1a3 3 0 0 0-3 3M9 20h6M12 14v6',
  sword: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4',
}
const STATS = computed(() => data.value ? [
  { k: 'games', n: data.value.totals.games, l: 'всего игр' },
  { k: 'today', n: data.value.totals.games_today, l: 'сегодня' },
  { k: 'week', n: data.value.totals.games_week, l: 'за неделю' },
  { k: 'players', n: data.value.totals.players, l: 'игроков' },
  { k: 'kills', n: data.value.totals.kills, l: 'убийств' },
  { k: 'clock', n: fmtDur(data.value.totals.avg_duration), l: 'средняя игра' },
] : [])
</script>

<template>
  <div v-if="!data" class="adm-skel" style="height: 320px" />
  <div v-else class="rd">
    <!-- Live banner -->
    <div class="rd-live" :class="`rd-live--${stateLabel.c}`">
      <div class="rd-live-main">
        <div class="rd-live-dot" />
        <div>
          <div class="rd-live-t">{{ stateLabel.t }}</div>
          <div class="rd-live-sub">
            <span class="rd-chip">{{ data.online }} онлайн</span>
            <span v-if="data.live_map" class="rd-chip">{{ data.live_map }}</span>
            <span class="rd-chip">режим: {{ data.settings.mode === 'public' ? 'общий' : 'ивент' }}</span>
            <span v-if="data.settings.rewards_on" class="rd-chip rd-chip--acc">награды вкл</span>
          </div>
        </div>
      </div>
      <div v-if="canControl" class="rd-live-actions">
        <button class="adm-btn adm-btn--acc" :disabled="busy" @click="doCommand('start_force', 'Старт')">▶ Старт</button>
        <button class="adm-btn" :disabled="busy" @click="doCommand('stop', 'Стоп')">■ Стоп</button>
      </div>
    </div>

    <!-- Stat cards -->
    <div class="rd-stats">
      <div v-for="s in STATS" :key="s.k" class="rd-stat">
        <span class="rd-stat-i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="IC[s.k]" /></svg></span>
        <div><div class="rd-stat-n">{{ s.n }}</div><div class="rd-stat-l">{{ s.l }}</div></div>
      </div>
    </div>

    <div class="rd-cols">
      <!-- Top players -->
      <div class="adm-card adm-card--pad">
        <div class="rd-h"><svg class="rd-h-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="IC.trophy" /></svg> Топ игроков</div>
        <div class="rd-list">
          <div v-for="(p, i) in data.top" :key="p.name" class="rd-pl">
            <span class="rd-badge" :class="`rd-badge--${i + 1}`">{{ i + 1 }}</span>
            <img class="rd-head" :src="head(p.name)" alt="" @error="headFallback($event, p.name)">
            <span class="rd-pl-name">{{ p.name }}</span>
            <span class="rd-lvl">ур.{{ p.level }}</span>
            <span class="rd-pl-spacer" />
            <span class="rd-pl-pts">{{ p.points }}</span>
            <span class="rd-pl-sub">{{ p.wins }}W · {{ p.kills }}K</span>
          </div>
          <div v-if="!data.top.length" class="rd-empty">Пока нет игр</div>
        </div>
      </div>

      <!-- Recent games -->
      <div class="adm-card adm-card--pad">
        <div class="rd-h"><svg class="rd-h-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="IC.clock" /></svg> Последние игры</div>
        <div class="rd-list">
          <div v-for="m in data.recent" :key="m.id" class="rd-game">
            <span class="rd-game-map">{{ m.map_title || m.map || '—' }}</span>
            <span class="rd-game-win"><svg class="rd-win-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="IC.trophy" /></svg> {{ m.winner_title || '—' }}</span>
            <span class="rd-pl-spacer" />
            <span class="rd-game-sub">{{ m.players_count }} игроков · {{ fmtDur(m.duration_seconds) }}</span>
          </div>
          <div v-if="!data.recent.length" class="rd-empty">Пока нет игр</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rd { display: flex; flex-direction: column; gap: 14px; }
.rd-live { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 16px 18px; border-radius: 14px; border: 1px solid var(--adm-border, #2a2a33);
  background: linear-gradient(135deg, rgba(124,58,237,.14), rgba(255,107,61,.08)); }
.rd-live--off { background: rgba(120,120,130,.1); }
.rd-live--live { background: linear-gradient(135deg, rgba(255,107,61,.22), rgba(255,180,77,.1)); }
.rd-live-main { display: flex; align-items: center; gap: 12px; }
.rd-live-dot { width: 12px; height: 12px; border-radius: 50%; background: #9aa; box-shadow: 0 0 0 4px rgba(150,150,160,.15); flex: none; }
.rd-live--live .rd-live-dot, .rd-live--lobby .rd-live-dot { background: #4ade80; box-shadow: 0 0 0 4px rgba(74,222,128,.2); animation: rdpulse 1.6s infinite; }
.rd-live--soon .rd-live-dot { background: #ffb84d; box-shadow: 0 0 0 4px rgba(255,184,77,.2); }
@keyframes rdpulse { 0%,100% { opacity: 1 } 50% { opacity: .4 } }
.rd-live-t { font-size: 1.15rem; font-weight: 800; }
.rd-live-sub { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 5px; }
.rd-chip { font-size: .76rem; padding: 2px 8px; border-radius: 20px; background: rgba(255,255,255,.07); color: var(--adm-muted, #cbd); }
.rd-chip--acc { background: rgba(255,107,61,.2); color: #ffb088; font-weight: 600; }
.rd-live-actions { display: flex; gap: 8px; }
.rd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.rd-stat { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--adm-border, #2a2a33); background: var(--adm-card, #16161c); transition: border-color .15s, transform .15s; }
.rd-stat:hover { border-color: rgba(255,107,61,.45); transform: translateY(-1px); }
.rd-stat-i { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, rgba(255,107,61,.16), rgba(255,180,77,.1)); color: #ff8c5a; flex: none; }
.rd-stat-i svg { width: 20px; height: 20px; }
.rd-stat-n { font-size: 1.45rem; font-weight: 900; line-height: 1.05; color: #fff; }
.rd-stat-l { font-size: .74rem; color: var(--adm-muted, #9aa); margin-top: 1px; }
.rd-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 760px) { .rd-cols { grid-template-columns: 1fr; } }
.rd-h { display: flex; align-items: center; gap: 7px; font-weight: 800; margin-bottom: 10px; }
.rd-h-ic { width: 17px; height: 17px; color: #ff8c5a; }
.rd-list { display: flex; flex-direction: column; }
.rd-pl, .rd-game { display: flex; align-items: center; gap: 9px; padding: 7px 2px; border-bottom: 1px solid var(--adm-border, #22222a); font-size: .9rem; }
.rd-pl:last-child, .rd-game:last-child { border-bottom: 0; }
.rd-badge { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; font-size: .74rem; font-weight: 800; background: rgba(255,255,255,.07); color: var(--adm-muted, #9aa); flex: none; }
.rd-badge--1 { background: linear-gradient(135deg, #ffd36b, #f0a500); color: #2a1e00; }
.rd-badge--2 { background: linear-gradient(135deg, #e2e6ea, #aab2bd); color: #1b2026; }
.rd-badge--3 { background: linear-gradient(135deg, #e5a06a, #b9712f); color: #2a1400; }
.rd-head { width: 24px; height: 24px; border-radius: 5px; image-rendering: pixelated; background: rgba(255,255,255,.05); flex: none; }
.rd-pl-name { font-weight: 600; }
.rd-lvl { font-size: .68rem; color: #a78bfa; font-weight: 800; background: rgba(167,139,250,.15); padding: 1px 5px; border-radius: 5px; }
.rd-pl-spacer { flex: 1; }
.rd-pl-pts { font-weight: 800; color: #ff9e3d; }
.rd-pl-sub, .rd-game-sub { font-size: .78rem; color: var(--adm-muted, #9aa); white-space: nowrap; }
.rd-game-map { font-weight: 600; }
.rd-game-win { display: inline-flex; align-items: center; gap: 5px; font-size: .82rem; color: #ffb84d; }
.rd-win-ic { width: 13px; height: 13px; }
.rd-empty { text-align: center; color: var(--adm-muted, #9aa); padding: 18px; }
</style>
