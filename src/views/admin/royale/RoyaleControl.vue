<script setup>
// The host panel: the game as it goes (the same state the projector shows) and the host's
// commands — start, pause, phases, airdrops, whitelist, moving players between teams, mute,
// kick. Every button runs the plugin's own command on the server (see /admin/royale/command).
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { authState, hasPermission } from '../../../stores/authStore'
import { toastError, toastSuccess } from '../../../services/toast'
import { confirmDialog } from '../../../composables/useConfirm'
import { royaleCommand, royaleReadiness } from '../../../services/royaleAdminApi'
import { TEAM_COLORS, TEAM_KEYS, TEAM_TITLES, clock, feedLine, hearts, plural } from './royaleUi'
import RoyaleGrace from './RoyaleGrace.vue'

const props = defineProps({ live: { type: Object, default: null } })
const emit = defineEmits(['refresh'])

const token = () => authState.accessToken
const canControl = computed(() => hasPermission('royale.control'))

const state = computed(() => props.live?.state || 'offline')
const offline = computed(() => state.value === 'offline')
const inLobby = computed(() => state.value === 'lobby')
const inCountdown = computed(() => state.value === 'countdown')
const inGame = computed(() => ['freeze', 'running'].includes(state.value))
const over = computed(() => state.value === 'over')
const phase = computed(() => props.live?.phase || null)
const teamSize = computed(() => props.live?.team_size || 0)

const STATE_TITLE = { offline: 'Сервер выключен', lobby: 'Лобби', countdown: 'Отсчёт', freeze: 'Высадка', running: 'Игра идёт', over: 'Игра окончена' }
const title = computed(() => (props.live?.paused ? 'Пауза' : STATE_TITLE[state.value] || state.value))
const tone = computed(() => {
  if (offline.value) return 'off'
  if (props.live?.paused) return 'warn'
  if (inGame.value) return 'live'
  if (inCountdown.value) return 'warn'
  if (over.value) return 'gold'
  return 'ok'
})

const bigClock = computed(() => {
  const l = props.live
  if (!l) return ''
  if (inCountdown.value || state.value === 'freeze') return l.countdown != null ? clock(l.countdown) : ''
  if (inGame.value || over.value) return clock(l.elapsed)
  return ''
})

const zoneLine = computed(() => {
  const p = phase.value
  if (!p) return ''
  if (p.stage === 'final') return 'Последняя зона'
  const left = p.left != null ? clock(p.left) : '—'
  return p.stage === 'shrink' ? `Зона сужается · ${left}` : `Зона стоит · ещё ${left}`
})

const teams = computed(() => props.live?.teams || [])
const inTeams = computed(() => teams.value.reduce((n, t) => n + (t.members || []).length, 0))
const aliveTeams = computed(() => teams.value.filter((t) => (t.alive ?? (t.members || []).length) > 0).length)
const feed = computed(() => props.live?.feed || [])
const teamTitle = (k) => teams.value.find((t) => t.color === k)?.title || TEAM_TITLES[k] || k

// ── Players online ───────────────────────────────────────────────────────
const search = ref('')
const teamOf = computed(() => {
  const m = {}
  teams.value.forEach((t) => (t.members || []).forEach((p) => { m[p.name.toLowerCase()] = t.color }))
  return m
})
const memberOf = computed(() => {
  const m = {}
  teams.value.forEach((t) => (t.members || []).forEach((p) => { m[p.name.toLowerCase()] = p }))
  return m
})
const players = computed(() => {
  const f = search.value.trim().toLowerCase()
  return (props.live?.players || []).filter((n) => !f || n.toLowerCase().includes(f))
})
const loners = computed(() => (props.live?.players || []).filter((n) => !teamOf.value[n.toLowerCase()]).length)

// ── Commands ─────────────────────────────────────────────────────────────
const busy = ref('')
const lastAnswer = ref(null)

async function run(action, extra = {}, ask = null) {
  if (!canControl.value) return
  if (ask && !(await confirmDialog(ask))) return
  busy.value = action + (extra.player || '')
  try {
    const res = await royaleCommand(token(), { action, ...extra })
    lastAnswer.value = { text: res.answer, at: new Date() }
    toastSuccess(res.answer)
    emit('refresh')
  } catch (e) {
    toastError(e.message || 'Сервер не выполнил команду')
  } finally {
    busy.value = ''
  }
}

const start = () => run('start')
const startForce = () => run('start_force', {}, {
  title: 'Старт без проверок?',
  message: 'Игра начнётся, даже если команда одна или игроков мало. Для обычного старта нужна обычная кнопка.',
  confirmLabel: 'Начать',
})
const stop = () => run('stop', {}, {
  title: 'Остановить игру?', message: 'Все вернутся в лобби, победителя не будет. Матч сохранится как остановленный.',
  confirmLabel: 'Остановить', danger: true,
})
const again = () => run('again', {}, {
  title: 'Сыграть заново?', message: 'Текущая игра остановится, сразу начнётся новая на свежей карте с теми же командами.',
  confirmLabel: 'Заново', danger: true,
})
const nextPhase = () => run('phase', {}, {
  title: 'Следующая фаза?', message: 'Зона сразу начнёт сужаться дальше. Защитные минуты, если ещё идут, закончатся.',
  confirmLabel: 'Дальше',
})
const togglePause = () => run(props.live?.paused ? 'resume' : 'pause')
const drop = () => run('drop')
const whitelist = () => run(props.live?.whitelist ? 'whitelist_off' : 'whitelist_on', {}, props.live?.whitelist
  ? { title: 'Выключить вайтлист?', message: 'Зайти сможет любой, кто знает адрес. Так делают перед началом ивента.', confirmLabel: 'Выключить' }
  : { title: 'Включить вайтлист?', message: 'Зайдут только те, кто в списке. Остальных не пустит.', confirmLabel: 'Включить' })
const clearResults = () => run('clearresults', {}, {
  title: 'Убрать итоги в архив?',
  message: 'Табло и пьедестал в лобби станут пустыми, итоги дня на сервере начнутся заново, рекорды паркура сбросятся. Матчи в админке останутся.',
  confirmLabel: 'В архив', danger: true,
})

const moveTo = (name, team) => run('team', { player: name, team })
const mute = (name) => run('mute', { player: name, minutes: 5 })
const unmute = (name) => run('unmute', { player: name })
const kick = (name) => run('kick', { player: name }, {
  title: `Кикнуть ${name}?`, message: 'Игрока отключит от сервера, зайти снова он сможет сразу.', confirmLabel: 'Кикнуть', danger: true,
})

const projector = computed(() => `/royale/live`)

// ── Announce: big text on everyone's screen and in chat ───────────────────
const announceText = ref('')
async function announce() {
  const text = announceText.value.trim()
  if (!text) return
  await run('announce', { text })
  announceText.value = ''
}
const QUICK = ['2 минуты до старта — вставайте на круги!', 'Приготовились!', 'Обед через 5 минут', 'Молодцы! Ещё одна игра']

// ── Add a latecomer to a team mid-game ────────────────────────────────────
const joinPick = ref({})
const joinable = (n) => (inGame.value || over.value) && !memberOf.value[n.toLowerCase()]
const smallestTeam = computed(() => {
  const live = teams.value.filter((t) => (t.alive ?? 1) > 0)
  if (!live.length) return TEAM_KEYS[0]
  return live.reduce((a, b) => ((b.members || []).length < (a.members || []).length ? b : a)).color
})
async function join(n) {
  const team = joinPick.value[n] || smallestTeam.value
  await run('join', { player: n, team })
}

// ── Readiness (pre-event self-check) ──────────────────────────────────────
const readiness = ref(null)
let readyTimer = null
async function loadReadiness() {
  if (document.hidden) return
  try {
    readiness.value = await royaleReadiness(token())
  } catch { /* keep the last */ }
}
onMounted(() => { loadReadiness(); readyTimer = setInterval(loadReadiness, 12000) })
onUnmounted(() => clearInterval(readyTimer))
const readyFails = computed(() => (readiness.value?.checks || []).filter((c) => c.ok === false))
</script>

<template>
  <div class="rc">
    <!-- State -->
    <div class="adm-card rc-hero" :class="`rc-hero--${tone}`">
      <div class="rc-hero-main">
        <div class="rc-state"><span class="rc-pulse" />{{ title }}</div>
        <div v-if="bigClock" class="rc-clock adm-num">{{ bigClock }}</div>
        <div class="rc-chips">
          <span v-if="phase" class="rc-chip">Фаза {{ phase.index }} из {{ phase.total }}</span>
          <span v-if="zoneLine" class="rc-chip" :class="{ 'rc-chip--red': phase?.stage === 'shrink' }">{{ zoneLine }}</span>
          <span v-if="phase?.size" class="rc-chip">Зона {{ phase.size }} блоков</span>
          <span v-if="live?.grace_left > 0" class="rc-chip rc-chip--ok">Без урона ещё {{ clock(live.grace_left) }}</span>
          <span v-if="live?.winner" class="rc-chip rc-chip--gold" :style="{ color: TEAM_COLORS[live.winner.color] }">★ {{ live.winner.title }}</span>
          <span v-if="live?.map" class="rc-chip rc-chip--dim">{{ live.map }}</span>
        </div>
      </div>
      <div class="rc-hero-stats">
        <div class="rc-stat"><b class="adm-num">{{ offline ? '—' : live?.online ?? 0 }}</b><span>онлайн</span></div>
        <div class="rc-stat">
          <b class="adm-num">{{ offline ? '—' : (inGame || over) ? aliveTeams : teams.length }}</b>
          <span>{{ (inGame || over) ? 'команд в игре' : 'команд' }}</span>
        </div>
        <div class="rc-stat"><b class="adm-num">{{ teamSize || '—' }}</b><span>в команде макс.</span></div>
        <div class="rc-stat">
          <b :class="live?.whitelist ? 'rc-on' : 'rc-off'">{{ live?.whitelist == null ? '—' : live.whitelist ? 'вкл' : 'выкл' }}</b>
          <span>вайтлист</span>
        </div>
      </div>
    </div>

    <!-- Pre-event readiness -->
    <div v-if="canControl && readiness && !inGame" class="adm-card adm-card--pad rc-ready" :class="readiness.ready ? 'rc-ready--ok' : 'rc-ready--warn'">
      <div class="rc-ready-head">
        <span class="rc-ready-badge">{{ readiness.ready ? '✓ Готово к ивенту' : '⚠ Перед стартом' }}</span>
        <span v-if="readyFails.length" class="rc-dim">нужно поправить: {{ readyFails.length }}</span>
      </div>
      <div class="rc-ready-list">
        <div v-for="c in readiness.checks" :key="c.key" class="rc-ready-item" :class="c.ok === false ? 'is-bad' : c.ok === null ? 'is-unknown' : 'is-ok'">
          <span class="rc-ready-dot" />
          <span class="rc-ready-label">{{ c.label }}</span>
          <span v-if="c.detail" class="rc-dim">— {{ c.detail }}</span>
          <span v-if="c.hint && c.ok === false" class="rc-ready-hint">{{ c.hint }}</span>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="adm-card adm-card--pad rc-controls">
      <div v-if="!canControl" class="rc-note">Управлять игрой может тот, у кого есть право «Королевская битва: пульт».</div>
      <template v-else>
        <div class="rc-group">
          <div class="rc-group-title">Игра</div>
          <div class="rc-btns">
            <button class="adm-btn adm-btn--acc rc-big" :disabled="!inLobby || !!busy" @click="start">▶ Старт</button>
            <button class="adm-btn" :disabled="!inLobby || !!busy" title="Даже с одной командой" @click="startForce">⚡ Без проверок</button>
            <button class="adm-btn" :disabled="!(inGame || inCountdown) || !!busy" @click="again">↻ Заново</button>
            <button class="adm-btn adm-btn--danger" :disabled="!(inGame || inCountdown) || !!busy" @click="stop">■ Остановить</button>
          </div>
        </div>
        <div class="rc-group">
          <div class="rc-group-title">Ход игры</div>
          <div class="rc-btns">
            <button class="adm-btn" :class="{ 'adm-btn--ok': live?.paused }" :disabled="!inGame || !!busy" @click="togglePause">
              {{ live?.paused ? '▶ Продолжить' : '⏸ Пауза' }}
            </button>
            <button class="adm-btn" :disabled="!inGame || !!busy" @click="nextPhase">⏭ Следующая фаза</button>
            <button class="adm-btn" :disabled="!inGame || !!busy" @click="drop">📦 Припасы сейчас</button>
          </div>
        </div>
        <div class="rc-group">
          <div class="rc-group-title">Сервер</div>
          <div class="rc-btns">
            <button class="adm-btn" :disabled="offline || !!busy" @click="whitelist">
              {{ live?.whitelist ? '🔓 Выключить вайтлист' : '🔒 Включить вайтлист' }}
            </button>
            <button class="adm-btn" :disabled="offline || !inLobby || !!busy" @click="clearResults">🗄 Итоги в архив</button>
          </div>
        </div>
        <div class="rc-group">
          <div class="rc-group-title">Объявить</div>
          <div class="rc-announce">
            <input
              v-model="announceText" class="adm-input rc-announce-input" maxlength="120"
              placeholder="Текст на весь экран игрокам…" :disabled="offline || !!busy"
              @keydown.enter="announce"
            />
            <button class="adm-btn adm-btn--acc" :disabled="offline || !announceText.trim() || !!busy" @click="announce">📣 Показать всем</button>
          </div>
        </div>
        <div v-if="!offline" class="rc-quick">
          <button v-for="q in QUICK" :key="q" class="rc-quick-btn" :disabled="!!busy" @click="announceText = q">{{ q }}</button>
        </div>
        <div v-if="lastAnswer" class="rc-answer"><span>Сервер ответил:</span> {{ lastAnswer.text }}</div>
      </template>
      <div class="rc-links">
        <a :href="projector" target="_blank" rel="noopener" class="adm-btn adm-btn--ghost adm-btn--sm">📺 Экран для проектора</a>
        <a href="/royale/host" target="_blank" rel="noopener" class="adm-btn adm-btn--ghost adm-btn--sm">📋 Шпаргалка ведущего</a>
      </div>
    </div>

    <div v-if="!offline && canControl" class="adm-card adm-card--pad rc-grace">
      <RoyaleGrace :value="live" compact @saved="$emit('refresh')" />
    </div>

    <div v-if="offline" class="adm-card adm-card--pad adm-empty">
      <div class="adm-empty__title">Сервер Royale не отвечает</div>
      <div class="adm-empty__sub">Состояние приходит с сервера раз в 2 секунды. Если сервер включён, подождите немного — или проверьте его в «Серверах».</div>
    </div>

    <template v-else>
      <div class="rc-grid">
        <!-- Teams -->
        <div class="adm-card adm-card--pad">
          <div class="adm-card__head">
            <h3 class="adm-card__title">Команды</h3>
            <span class="rc-dim">
              <template v-if="inLobby || inCountdown">в командах {{ inTeams }} · без команды {{ loners }}</template>
              <template v-else>{{ aliveTeams }} {{ plural(aliveTeams, 'команда', 'команды', 'команд') }} ещё в игре</template>
            </span>
          </div>
          <div v-if="!teams.length" class="rc-empty">Пока никто не выбрал команду.</div>
          <div class="rc-teams">
            <div
              v-for="t in teams" :key="t.color" class="rc-team"
              :class="{ 'rc-team--out': (inGame || over) && t.alive === 0 }"
              :style="{ '--tc': TEAM_COLORS[t.color] }"
            >
              <div class="rc-team-head">
                <b>{{ t.title }}</b>
                <span v-if="inGame || over" class="rc-dim">
                  <template v-if="t.placement">{{ t.placement }}-е место</template>
                  <template v-else>живы {{ t.alive }}/{{ t.total }}</template>
                  · ☠ {{ t.kills }}
                </span>
                <span v-else class="rc-dim" :class="{ 'rc-full': (t.members || []).length >= teamSize }">{{ (t.members || []).length }}/{{ teamSize }}</span>
              </div>
              <div class="rc-members">
                <span
                  v-for="m in t.members" :key="m.name" class="rc-member"
                  :class="{ 'rc-member--dead': (inGame || over) && !m.alive, 'rc-member--off': m.online === false }"
                  :title="(inGame || over) ? `убийств ${m.kills}, урон ${hearts(m.damage * 2)} ❤${m.online === false ? ', вышел' : ''}` : ''"
                >
                  {{ m.name }}<i v-if="m.kills">☠{{ m.kills }}</i>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Feed -->
        <div class="adm-card adm-card--pad rc-feed">
          <div class="adm-card__head"><h3 class="adm-card__title">События</h3></div>
          <div v-if="!feed.length" class="rc-empty">
            {{ inGame ? 'Пока тихо.' : 'Появятся, когда начнётся игра.' }}
          </div>
          <div v-for="e in feed" :key="`${e.t}-${e.type}-${e.victim || e.team || e.player || e.phase || ''}`" class="rc-ev" :class="feedLine(e, teamTitle).tone && `rc-ev--${feedLine(e, teamTitle).tone}`">
            <span class="rc-ev-t adm-num">{{ clock(e.t) }}</span>
            <span class="rc-ev-i">{{ feedLine(e, teamTitle).icon }}</span>
            <span>
              <span v-for="(p, i) in feedLine(e, teamTitle).parts" :key="i" :style="p.color ? { color: p.color, fontWeight: 700 } : null">{{ p.text }}</span>
              <span v-if="feedLine(e, teamTitle).note" class="rc-dim"> · {{ feedLine(e, teamTitle).note }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Players -->
      <div class="adm-card adm-card--pad">
        <div class="adm-card__head">
          <h3 class="adm-card__title">Игроки онлайн · {{ (live?.players || []).length }}</h3>
          <input v-model="search" class="adm-input rc-search" placeholder="Найти по нику" />
        </div>
        <div v-if="!(live?.players || []).length" class="rc-empty">На сервере никого нет.</div>
        <div v-else class="adm-table-wrap">
          <div class="adm-table-scroll">
            <table class="adm-table rc-table">
              <thead>
                <tr><th>Игрок</th><th>Команда</th><th v-if="inGame || over">В игре</th><th v-if="canControl" class="rc-right">Действия</th></tr>
              </thead>
              <tbody>
                <tr v-for="n in players" :key="n">
                  <td><b>{{ n }}</b></td>
                  <td>
                    <select
                      v-if="canControl && (inLobby || inCountdown)"
                      class="adm-select rc-team-select"
                      :value="teamOf[n.toLowerCase()] || 'none'"
                      :style="{ color: TEAM_COLORS[teamOf[n.toLowerCase()]] || 'var(--adm-mut)' }"
                      :disabled="!!busy"
                      @change="moveTo(n, $event.target.value)"
                    >
                      <option value="none">— без команды</option>
                      <option v-for="k in TEAM_KEYS" :key="k" :value="k">{{ TEAM_TITLES[k] }}</option>
                    </select>
                    <span v-else :style="{ color: TEAM_COLORS[teamOf[n.toLowerCase()]] }">{{ teamOf[n.toLowerCase()] ? TEAM_TITLES[teamOf[n.toLowerCase()]] : '—' }}</span>
                  </td>
                  <td v-if="inGame || over">
                    <template v-if="memberOf[n.toLowerCase()]">
                      <span :class="memberOf[n.toLowerCase()].alive ? 'rc-on' : 'rc-dim'">{{ memberOf[n.toLowerCase()].alive ? 'жив' : 'выбыл' }}</span>
                      <span class="rc-dim"> · ☠ {{ memberOf[n.toLowerCase()].kills }}</span>
                    </template>
                    <span v-else class="rc-dim">смотрит / лобби</span>
                  </td>
                  <td v-if="canControl" class="rc-right">
                    <div class="rc-acts">
                      <template v-if="joinable(n)">
                        <select
                          class="adm-select rc-join-select" :value="joinPick[n] || smallestTeam"
                          :style="{ color: TEAM_COLORS[joinPick[n] || smallestTeam] }" :disabled="!!busy"
                          @change="joinPick[n] = $event.target.value"
                        >
                          <option v-for="k in TEAM_KEYS" :key="k" :value="k">{{ TEAM_TITLES[k] }}</option>
                        </select>
                        <button class="adm-btn adm-btn--sm adm-btn--ok" :disabled="!!busy" title="Добавить опоздавшего в игру" @click="join(n)">⚔ В бой</button>
                      </template>
                      <button class="adm-btn adm-btn--sm" :disabled="!!busy" title="Закрыть чат на 5 минут" @click="mute(n)">Мут 5 мин</button>
                      <button class="adm-btn adm-btn--sm" :disabled="!!busy" title="Открыть чат" @click="unmute(n)">Размут</button>
                      <button class="adm-btn adm-btn--sm adm-btn--danger" :disabled="!!busy" @click="kick(n)">Кик</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-if="canControl && inGame" class="rc-note rc-note--sm">Опоздавшего можно добавить в игру кнопкой «В бой». Перевод между командами — только в лобби.</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rc { display: flex; flex-direction: column; gap: 14px; }
.rc-hero { display: flex; justify-content: space-between; gap: 18px; padding: 18px 20px; flex-wrap: wrap; position: relative; overflow: hidden; }
.rc-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(120% 140% at 0% 0%, var(--rc-glow, transparent), transparent 55%); pointer-events: none; }
.rc-hero--ok { --rc-glow: rgba(52, 211, 153, .10); --rc-dot: var(--adm-ok); }
.rc-hero--live { --rc-glow: rgba(248, 113, 113, .14); --rc-dot: var(--adm-err); border-color: rgba(248, 113, 113, .35); }
.rc-hero--warn { --rc-glow: rgba(251, 191, 36, .13); --rc-dot: var(--adm-warn); border-color: rgba(251, 191, 36, .3); }
.rc-hero--gold { --rc-glow: rgba(250, 204, 21, .14); --rc-dot: #facc15; }
.rc-hero--off { --rc-dot: var(--adm-faint); }
.rc-hero-main { position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.rc-state { display: flex; align-items: center; gap: 10px; font-size: 1.5rem; font-weight: 800; color: var(--adm-text); letter-spacing: -.01em; }
.rc-pulse { width: 11px; height: 11px; border-radius: 50%; background: var(--rc-dot); box-shadow: 0 0 0 0 var(--rc-dot); animation: rc-pulse 1.8s infinite; }
.rc-hero--off .rc-pulse { animation: none; }
@keyframes rc-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--rc-dot) 60%, transparent); } 70% { box-shadow: 0 0 0 10px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
.rc-clock { font-size: 2.6rem; font-weight: 800; line-height: 1; color: var(--adm-text); }
.rc-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.rc-chip { font-size: .74rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: rgba(148, 163, 184, .08); border: 1px solid var(--adm-line-strong); color: var(--adm-mut); }
.rc-chip--red { color: #fca5a5; border-color: rgba(248, 113, 113, .4); background: rgba(248, 113, 113, .08); }
.rc-chip--ok { color: #6ee7b7; border-color: rgba(52, 211, 153, .35); background: rgba(52, 211, 153, .07); }
.rc-chip--gold { border-color: rgba(250, 204, 21, .4); background: rgba(250, 204, 21, .07); }
.rc-chip--dim { color: var(--adm-dim); }
.rc-hero-stats { position: relative; display: grid; grid-template-columns: repeat(4, minmax(84px, 1fr)); gap: 8px; align-self: center; }
@media (max-width: 640px) { .rc-hero-stats { grid-template-columns: repeat(2, 1fr); width: 100%; } }
.rc-stat { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 12px; border-radius: 12px; background: rgba(8, 12, 22, .55); border: 1px solid var(--adm-line); }
.rc-stat b { font-size: 1.35rem; font-weight: 800; color: var(--adm-text); }
.rc-stat span { font-size: .68rem; color: var(--adm-dim); font-weight: 700; text-align: center; }
.rc-on { color: var(--adm-ok) !important; }
.rc-off { color: var(--adm-mut) !important; }
.rc-controls { display: flex; flex-direction: column; gap: 14px; }
.rc-group { display: grid; grid-template-columns: 110px 1fr; gap: 10px; align-items: center; }
@media (max-width: 640px) { .rc-group { grid-template-columns: 1fr; gap: 6px; } }
.rc-group-title { font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--adm-dim); }
.rc-btns { display: flex; gap: 8px; flex-wrap: wrap; }
.rc-big { padding-left: 1.4rem; padding-right: 1.4rem; font-weight: 800; }
.rc-answer { font-size: .8rem; color: var(--adm-mut); background: rgba(148, 163, 184, .06); border-radius: 9px; padding: 8px 12px; }
.rc-answer span { color: var(--adm-dim); font-weight: 700; margin-right: 4px; }
.rc-links { display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--adm-line); padding-top: 12px; }
.rc-note { font-size: .82rem; color: var(--adm-mut); }
.rc-note--sm { font-size: .74rem; color: var(--adm-dim); margin-top: 10px; }
.rc-grace { padding-top: 14px; padding-bottom: 14px; }
.rc-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 14px; align-items: start; }
@media (max-width: 1000px) { .rc-grid { grid-template-columns: 1fr; } }
.rc-dim { color: var(--adm-dim); font-size: .76rem; }
.rc-full { color: var(--adm-err); font-weight: 700; }
.rc-empty { color: var(--adm-dim); font-size: .82rem; padding: 10px 2px; }
.rc-teams { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
.rc-team { border: 1px solid var(--adm-line-strong); border-top: 3px solid var(--tc); border-radius: 12px; padding: 10px 12px; background: linear-gradient(180deg, color-mix(in srgb, var(--tc) 9%, transparent), transparent 70%); }
.rc-team--out { opacity: .45; filter: grayscale(.6); }
.rc-team-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.rc-team-head b { color: var(--tc); font-weight: 800; }
.rc-members { display: flex; flex-wrap: wrap; gap: 5px; }
.rc-member { font-size: .76rem; padding: 3px 8px; border-radius: 7px; background: rgba(148, 163, 184, .08); color: var(--adm-text); }
.rc-member i { font-style: normal; color: var(--adm-err); margin-left: 4px; font-weight: 700; }
.rc-member--dead { text-decoration: line-through; color: var(--adm-dim); }
.rc-member--off { opacity: .5; }
.rc-feed { max-height: 460px; overflow: auto; }
.rc-ev { display: grid; grid-template-columns: 3.1em 1.4em 1fr; gap: 2px; font-size: .82rem; padding: 4px 0; border-bottom: 1px solid var(--adm-line); color: var(--adm-text); }
.rc-ev:last-child { border-bottom: 0; }
.rc-ev-t { color: var(--adm-dim); font-size: .74rem; }
.rc-ev--gold { color: #fde68a; }
.rc-ev--red { color: #fca5a5; }
.rc-search { max-width: 220px; }
.rc-table td, .rc-table th { white-space: nowrap; }
.rc-team-select { width: auto; min-width: 150px; padding-top: .3rem; padding-bottom: .3rem; font-weight: 700; }
.rc-join-select { width: auto; min-width: 118px; padding-top: .2rem; padding-bottom: .2rem; font-weight: 700; }
.rc-announce { display: flex; gap: 8px; flex: 1; }
.rc-announce-input { flex: 1; }
.rc-quick { display: flex; gap: 6px; flex-wrap: wrap; padding-left: 120px; }
@media (max-width: 640px) { .rc-quick { padding-left: 0; } }
.rc-quick-btn { font-size: .74rem; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--adm-line-strong); background: rgba(148,163,184,.05); color: var(--adm-mut); cursor: pointer; }
.rc-quick-btn:hover:not(:disabled) { border-color: var(--adm-acc-line); color: var(--adm-text); }
.rc-ready { display: flex; flex-direction: column; gap: 10px; }
.rc-ready--ok { border-color: rgba(52,211,153,.3); background: linear-gradient(140deg, rgba(52,211,153,.06), var(--adm-card) 60%); }
.rc-ready--warn { border-color: rgba(251,191,36,.35); background: linear-gradient(140deg, rgba(251,191,36,.06), var(--adm-card) 60%); }
.rc-ready-head { display: flex; align-items: center; gap: 10px; }
.rc-ready-badge { font-weight: 800; color: var(--adm-text); }
.rc-ready--ok .rc-ready-badge { color: #6ee7b7; }
.rc-ready--warn .rc-ready-badge { color: #fde68a; }
.rc-ready-list { display: flex; flex-direction: column; gap: 6px; }
.rc-ready-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--adm-text); flex-wrap: wrap; }
.rc-ready-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.rc-ready-item.is-ok .rc-ready-dot { background: var(--adm-ok); }
.rc-ready-item.is-bad .rc-ready-dot { background: var(--adm-err); }
.rc-ready-item.is-unknown .rc-ready-dot { background: var(--adm-faint); }
.rc-ready-item.is-ok .rc-ready-label { color: var(--adm-mut); }
.rc-ready-hint { font-size: 12px; color: #fca5a5; background: rgba(248,113,113,.08); border-radius: 6px; padding: 1px 8px; }
.rc-right { text-align: right; }
.rc-acts { display: flex; gap: 6px; justify-content: flex-end; }
</style>
