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
const headFallback = (e, nick) => { if (!e.target.dataset.fb) { e.target.dataset.fb = 1; e.target.src = `https://mc-heads.net/avatar/${encodeURIComponent(nick)}/48` } }

const IC = {
  games: 'M6 12h4m-2-2v4M15 13h.01M18 11h.01M17.5 6h-11A4.5 4.5 0 0 0 2 10.5L1.6 15a3 3 0 0 0 5.1 2.3L8 16h8l1.3 1.3a3 3 0 0 0 5.1-2.3L22 10.5A4.5 4.5 0 0 0 17.5 6Z',
  today: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  week: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM8 14h3',
  players: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1A4 4 0 0 1 16 11',
  kills: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M5 14l-3 3 3 3 3-3',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0V4ZM5 6H3v1a3 3 0 0 0 3 3M19 6h2v1a3 3 0 0 0-3 3M9 20h6M12 14v6',
}
const STATS = computed(() => data.value ? [
  { k: 'games', n: data.value.totals.games, l: 'всего игр' },
  { k: 'today', n: data.value.totals.games_today, l: 'сегодня' },
  { k: 'week', n: data.value.totals.games_week, l: 'за неделю' },
  { k: 'players', n: data.value.totals.players, l: 'игроков' },
  { k: 'kills', n: data.value.totals.kills, l: 'убийств' },
  { k: 'clock', n: fmtDur(data.value.totals.avg_duration), l: 'ср. длина' },
] : [])
</script>

<template>
  <div v-if="!data" class="adm-skel" style="height: 360px" />
  <div v-else class="rd">
    <!-- Hero live banner -->
    <div class="rd-hero" :class="`rd-hero--${stateLabel.c}`">
      <div class="rd-hero-glow" />
      <div class="rd-hero-row">
        <div class="rd-hero-id">
          <span class="rd-hero-dot" />
          <div>
            <div class="rd-hero-t">{{ stateLabel.t }}</div>
            <div class="rd-chips">
              <span class="rd-chip"><b>{{ data.online }}</b> онлайн</span>
              <span v-if="data.live_map" class="rd-chip">{{ data.live_map }}</span>
              <span class="rd-chip">{{ data.settings.mode === 'public' ? 'общий режим' : 'ивент' }}</span>
              <span v-if="data.settings.rewards_on" class="rd-chip rd-chip--acc">💰 награды</span>
            </div>
          </div>
        </div>
        <div v-if="canControl" class="rd-hero-actions">
          <button class="rd-btn rd-btn--go" :disabled="busy" @click="doCommand('start_force', 'Старт')">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> Старт
          </button>
          <button class="rd-btn" :disabled="busy" @click="doCommand('stop', 'Стоп')">
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> Стоп
          </button>
        </div>
      </div>
    </div>

    <!-- Stat tiles -->
    <div class="rd-stats">
      <div v-for="s in STATS" :key="s.k" class="rd-tile">
        <span class="rd-tile-i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="IC[s.k]" /></svg></span>
        <div class="rd-tile-n">{{ s.n }}</div>
        <div class="rd-tile-l">{{ s.l }}</div>
      </div>
    </div>

    <div class="rd-cols">
      <!-- Top players -->
      <div class="rd-card">
        <div class="rd-h"><svg class="rd-h-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="IC.trophy" /></svg> Топ игроков</div>
        <div class="rd-list">
          <div v-for="(p, i) in data.top" :key="p.name" class="rd-pl">
            <span class="rd-rank" :class="`rd-rank--${i + 1}`">{{ i + 1 }}</span>
            <img class="rd-ava" :src="head(p.name)" alt="" @error="headFallback($event, p.name)">
            <div class="rd-pl-id">
              <span class="rd-pl-name">{{ p.name }}</span>
              <span class="rd-pl-meta">ур. {{ p.level }} · {{ p.wins }} побед</span>
            </div>
            <div class="rd-pl-right">
              <span class="rd-pl-pts">{{ p.points }}</span>
              <span class="rd-pl-ptsl">очков</span>
            </div>
          </div>
          <div v-if="!data.top.length" class="rd-empty">Пока нет игр</div>
        </div>
      </div>

      <!-- Recent games -->
      <div class="rd-card">
        <div class="rd-h"><svg class="rd-h-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="IC.clock" /></svg> Последние игры</div>
        <div class="rd-list">
          <div v-for="m in data.recent" :key="m.id" class="rd-game">
            <span class="rd-game-dot" />
            <div class="rd-pl-id">
              <span class="rd-pl-name">{{ m.map_title || m.map || '—' }}</span>
              <span class="rd-pl-meta">победа: <b class="rd-win">{{ m.winner_title || '—' }}</b></span>
            </div>
            <div class="rd-pl-right">
              <span class="rd-game-pc">{{ m.players_count }} игроков</span>
              <span class="rd-pl-ptsl">{{ fmtDur(m.duration_seconds) }}</span>
            </div>
          </div>
          <div v-if="!data.recent.length" class="rd-empty">Пока нет игр</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rd { display: flex; flex-direction: column; gap: 16px; }

/* Hero */
.rd-hero { position: relative; overflow: hidden; border-radius: 22px; padding: 26px 28px;
  border: 1px solid rgba(255,255,255,.08); background: #0e0e13; }
.rd-hero-glow { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(640px 220px at 12% -40%, rgba(255,107,61,.28), transparent 70%),
              radial-gradient(540px 220px at 95% 150%, rgba(168,85,247,.22), transparent 70%); }
.rd-hero--off .rd-hero-glow { background: radial-gradient(600px 200px at 50% -40%, rgba(120,120,140,.14), transparent 70%); }
.rd-hero-row { position: relative; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.rd-hero-id { display: flex; align-items: center; gap: 16px; }
.rd-hero-dot { width: 14px; height: 14px; border-radius: 50%; background: #868692; box-shadow: 0 0 0 5px rgba(150,150,160,.14); flex: none; }
.rd-hero--live .rd-hero-dot, .rd-hero--lobby .rd-hero-dot { background: #37f08a; box-shadow: 0 0 16px 2px rgba(55,240,138,.6), 0 0 0 5px rgba(55,240,138,.14); animation: rdpulse 1.8s infinite; }
.rd-hero--soon .rd-hero-dot { background: #ffb84d; box-shadow: 0 0 16px 2px rgba(255,184,77,.5), 0 0 0 5px rgba(255,184,77,.14); }
@keyframes rdpulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
.rd-hero-t { font-size: 1.5rem; font-weight: 800; letter-spacing: -.01em; }
.rd-chips { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 9px; }
.rd-chip { font-size: .8rem; padding: 4px 11px; border-radius: 999px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.07); color: #c7c7d1; }
.rd-chip b { color: #fff; }
.rd-chip--acc { background: rgba(255,107,61,.16); border-color: rgba(255,107,61,.3); color: #ffb088; }
.rd-hero-actions { display: flex; gap: 10px; }
.rd-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 999px; font-weight: 700; font-size: .92rem;
  border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); color: #eee; cursor: pointer; transition: transform .12s, filter .12s, background .12s; }
.rd-btn svg { width: 15px; height: 15px; }
.rd-btn:hover { background: rgba(255,255,255,.1); }
.rd-btn--go { border-color: transparent; color: #1a0f08; background: linear-gradient(135deg, #ff8a3d, #ff5a9e); box-shadow: 0 6px 20px rgba(255,90,120,.3); }
.rd-btn--go:hover { filter: brightness(1.07); transform: translateY(-1px); }
.rd-btn:disabled { opacity: .55; cursor: default; }

/* Stat tiles */
.rd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.rd-tile { position: relative; padding: 18px; border-radius: 18px; border: 1px solid rgba(255,255,255,.07);
  background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.01)); transition: transform .15s, border-color .15s; }
.rd-tile:hover { transform: translateY(-2px); border-color: rgba(255,138,61,.4); }
.rd-tile-i { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; margin-bottom: 12px;
  background: linear-gradient(135deg, rgba(255,138,61,.2), rgba(255,90,158,.14)); color: #ff9a5c; }
.rd-tile-i svg { width: 21px; height: 21px; }
.rd-tile-n { font-size: 1.7rem; font-weight: 900; line-height: 1; letter-spacing: -.02em; }
.rd-tile-l { font-size: .8rem; color: #8a8a96; margin-top: 5px; }

/* Cards */
.rd-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 820px) { .rd-cols { grid-template-columns: 1fr; } }
.rd-card { border-radius: 20px; border: 1px solid rgba(255,255,255,.07); background: #0e0e13; padding: 20px 22px; }
.rd-h { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.05rem; margin-bottom: 14px; }
.rd-h-ic { width: 18px; height: 18px; color: #ff9a5c; }
.rd-list { display: flex; flex-direction: column; gap: 4px; }
.rd-pl, .rd-game { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 13px; transition: background .12s; }
.rd-pl:hover, .rd-game:hover { background: rgba(255,255,255,.035); }
.rd-rank { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 9px; font-size: .8rem; font-weight: 800; background: rgba(255,255,255,.06); color: #9a9aa6; flex: none; }
.rd-rank--1 { background: linear-gradient(135deg, #ffdf7e, #f0a500); color: #3a2800; box-shadow: 0 3px 12px rgba(240,165,0,.3); }
.rd-rank--2 { background: linear-gradient(135deg, #eef2f6, #aeb6c1); color: #1b2026; }
.rd-rank--3 { background: linear-gradient(135deg, #f0ad78, #c17b36); color: #2a1400; }
.rd-ava { width: 36px; height: 36px; border-radius: 10px; image-rendering: pixelated; background: rgba(255,255,255,.05); box-shadow: 0 0 0 1px rgba(255,255,255,.08); flex: none; }
.rd-pl-id { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.rd-pl-name { font-weight: 700; font-size: .95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rd-pl-meta { font-size: .78rem; color: #8a8a96; }
.rd-win { color: #ffc46b; }
.rd-pl-right { display: flex; flex-direction: column; align-items: flex-end; flex: none; }
.rd-pl-pts { font-weight: 900; font-size: 1.05rem; background: linear-gradient(135deg, #ff8a3d, #ff5a9e); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.rd-game-pc { font-weight: 700; font-size: .9rem; color: #d6d6de; }
.rd-pl-ptsl { font-size: .72rem; color: #74747e; }
.rd-game-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff8a3d; flex: none; margin: 0 9px; box-shadow: 0 0 10px rgba(255,138,61,.5); }
.rd-empty { text-align: center; color: #74747e; padding: 22px; }
</style>
