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
const place = (n) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : `#${n}`)
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
            <span>👥 <b>{{ data.online }}</b> онлайн</span>
            <span v-if="data.live_map">· 🗺 {{ data.live_map }}</span>
            <span>· режим: <b>{{ data.settings.mode === 'public' ? 'общий' : 'ивент' }}</b></span>
            <span v-if="data.settings.rewards_on">· 💰 награды вкл</span>
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
      <div class="rd-stat"><div class="rd-stat-n">{{ data.totals.games }}</div><div class="rd-stat-l">всего игр</div></div>
      <div class="rd-stat"><div class="rd-stat-n">{{ data.totals.games_today }}</div><div class="rd-stat-l">сегодня</div></div>
      <div class="rd-stat"><div class="rd-stat-n">{{ data.totals.games_week }}</div><div class="rd-stat-l">за неделю</div></div>
      <div class="rd-stat"><div class="rd-stat-n">{{ data.totals.players }}</div><div class="rd-stat-l">игроков</div></div>
      <div class="rd-stat"><div class="rd-stat-n">{{ data.totals.kills }}</div><div class="rd-stat-l">убийств</div></div>
      <div class="rd-stat"><div class="rd-stat-n">{{ fmtDur(data.totals.avg_duration) }}</div><div class="rd-stat-l">средняя игра</div></div>
    </div>

    <div class="rd-cols">
      <!-- Top players -->
      <div class="adm-card adm-card--pad">
        <div class="rd-h">🏆 Топ игроков</div>
        <table class="rd-table">
          <tbody>
            <tr v-for="(p, i) in data.top" :key="p.name">
              <td class="rd-rank">{{ place(i + 1) }}</td>
              <td class="rd-name">{{ p.name }} <span class="rd-lvl">ур.{{ p.level }}</span></td>
              <td class="rd-num"><b>{{ p.points }}</b> очк</td>
              <td class="rd-num rd-dim">{{ p.wins }}🏅 · {{ p.kills }}⚔</td>
            </tr>
            <tr v-if="!data.top.length"><td colspan="4" class="rd-empty">Пока нет игр</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Recent games -->
      <div class="adm-card adm-card--pad">
        <div class="rd-h">🕑 Последние игры</div>
        <table class="rd-table">
          <tbody>
            <tr v-for="m in data.recent" :key="m.id">
              <td class="rd-name">{{ m.map_title || m.map || '—' }}</td>
              <td class="rd-num rd-win" :style="{ color: '#ffb84d' }">{{ m.winner_title || '—' }}</td>
              <td class="rd-num rd-dim">{{ m.players_count }}👥 · {{ fmtDur(m.duration_seconds) }}</td>
            </tr>
            <tr v-if="!data.recent.length"><td colspan="3" class="rd-empty">Пока нет игр</td></tr>
          </tbody>
        </table>
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
.rd-live--live { background: linear-gradient(135deg, rgba(255,107,61,.2), rgba(255,180,77,.1)); }
.rd-live-main { display: flex; align-items: center; gap: 12px; }
.rd-live-dot { width: 12px; height: 12px; border-radius: 50%; background: #9aa; box-shadow: 0 0 0 4px rgba(150,150,160,.15); }
.rd-live--live .rd-live-dot, .rd-live--lobby .rd-live-dot { background: #4ade80; box-shadow: 0 0 0 4px rgba(74,222,128,.2); animation: rdpulse 1.6s infinite; }
.rd-live--soon .rd-live-dot { background: #ffb84d; box-shadow: 0 0 0 4px rgba(255,184,77,.2); }
@keyframes rdpulse { 0%,100% { opacity: 1 } 50% { opacity: .4 } }
.rd-live-t { font-size: 1.15rem; font-weight: 800; }
.rd-live-sub { font-size: .85rem; color: var(--adm-muted, #9aa); display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
.rd-live-actions { display: flex; gap: 8px; }
.rd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
.rd-stat { text-align: center; padding: 14px 8px; border-radius: 12px; border: 1px solid var(--adm-border, #2a2a33); background: var(--adm-card, #16161c); }
.rd-stat-n { font-size: 1.5rem; font-weight: 900; background: linear-gradient(135deg, #ff6b3d, #ffd36b); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.rd-stat-l { font-size: .75rem; color: var(--adm-muted, #9aa); margin-top: 2px; }
.rd-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 760px) { .rd-cols { grid-template-columns: 1fr; } }
.rd-h { font-weight: 800; margin-bottom: 8px; }
.rd-table { width: 100%; border-collapse: collapse; }
.rd-table td { padding: 6px 4px; border-bottom: 1px solid var(--adm-border, #22222a); font-size: .88rem; }
.rd-rank { width: 2rem; }
.rd-name { font-weight: 600; }
.rd-lvl { font-size: .72rem; color: #a78bfa; font-weight: 700; }
.rd-num { text-align: right; white-space: nowrap; }
.rd-dim { color: var(--adm-muted, #9aa); font-size: .8rem; }
.rd-empty { text-align: center; color: var(--adm-muted, #9aa); padding: 14px; }
</style>
