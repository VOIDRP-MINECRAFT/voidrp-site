<script setup>
// Королевская битва на проекторе: /royale/live. Без входа, на весь экран, обновляется раз в 2 с.
// Что показывать, решает плагин VoidRpRoyale: сбор команд в лобби, игра (кто жив, зона, лента),
// победа. ?server=<slug> — другой сервер (по умолчанию royale), ?lang=en — по-английски.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiRequest } from '../services/apiBase'
import { setLocale } from '../i18n'
import AcademyLogo from '../components/AcademyLogo.vue'

const route = useRoute()
const { t } = useI18n()
const slug = computed(() => String(route.query.server || 'royale').toLowerCase())

const data = ref(null)
const failed = ref(false)
const fetchedAt = ref(Date.now())
const now = ref(Date.now())
let poll = null
let tick = null

async function load() {
  try {
    data.value = await apiRequest(`/royale/live?server=${encodeURIComponent(slug.value)}`, { serverScope: false, toast: false })
    fetchedAt.value = Date.now()
    failed.value = false
  } catch {
    failed.value = true
  }
}

onMounted(() => {
  // The projector's computer may not have Inter: the logo and the address are set in it.
  if (!document.getElementById('royale-font')) {
    const link = document.createElement('link')
    link.id = 'royale-font'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap'
    document.head.appendChild(link)
  }
  if (route.query.lang === 'en' || route.query.lang === 'ru') setLocale(route.query.lang)
  document.title = t('royaleLive.title')
  load()
  poll = setInterval(load, 2000)
  tick = setInterval(() => { now.value = Date.now() }, 250)
})
onBeforeUnmount(() => { clearInterval(poll); clearInterval(tick) })

const state = computed(() => (failed.value && !data.value ? 'offline' : data.value?.state || 'loading'))
// Between two answers the clocks keep going on their own, so nothing jumps by two seconds.
const drift = computed(() => Math.floor((now.value - fetchedAt.value) / 1000))
const down = (v) => (v == null ? null : Math.max(0, v - drift.value))
const up = (v) => (v == null ? null : v + drift.value)
const clock = (s) => (s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)

const teams = computed(() => data.value?.teams || [])
const colors = computed(() => data.value?.colors || {})
const colorOf = (key) => colors.value[key] || '#ffffff'
const aliveTotal = computed(() => teams.value.reduce((n, tm) => n + (tm.alive ?? tm.members.length), 0))
const playersTotal = computed(() => teams.value.reduce((n, tm) => n + (tm.total ?? tm.members.length), 0))
const phase = computed(() => data.value?.phase || null)
const grace = computed(() => down(data.value?.grace_left))
const countdown = computed(() => down(data.value?.countdown))
const elapsed = computed(() => up(data.value?.elapsed))

const zoneLine = computed(() => {
  const p = phase.value
  if (!p) return ''
  if (p.stage === 'final') return t('royaleLive.zoneFinal')
  const left = clock(down(p.left))
  return p.stage === 'shrink' ? t('royaleLive.zoneShrink', { t: left }) : t('royaleLive.zoneWait', { t: left })
})

const last = computed(() => data.value?.last || null)
const feed = computed(() => data.value?.feed || [])
const team = (key) => teams.value.find((tm) => tm.color === key)
const teamTitle = (key) => team(key)?.title || key

function feedLine(e) {
  switch (e.type) {
    case 'kill':
      return e.killer
        ? { icon: '☠', parts: [{ text: e.killer, color: colorOf(e.killer_team) }, { text: ' → ' }, { text: e.victim, color: colorOf(e.victim_team) }], note: e.with }
        : { icon: '☠', parts: [{ text: e.victim, color: colorOf(e.victim_team) }, { text: ` ${t('royaleLive.ev.out')}` }], note: e.with }
    case 'team_out':
      return { icon: '⚑', parts: [{ text: teamTitle(e.team), color: colorOf(e.team), bold: true }, { text: ` ${t('royaleLive.ev.teamOut', { n: e.placement })}` }] }
    case 'airdrop':
      return { icon: '📦', parts: [{ text: t('royaleLive.ev.airdrop') }], gold: true }
    case 'airdrop_open':
      return { icon: '📦', parts: [{ text: `${t('royaleLive.ev.airdropOpen')} ` }, { text: e.player, color: colorOf(e.team) }], gold: true }
    case 'phase':
      return { icon: '◎', parts: [{ text: t('royaleLive.ev.phase', { n: e.phase }) }], red: true }
    case 'start':
      return { icon: '▶', parts: [{ text: t('royaleLive.ev.start') }] }
    case 'end':
      return { icon: '★', parts: [{ text: t('royaleLive.ev.end') }], gold: true }
    default:
      return { icon: '·', parts: [{ text: e.type }] }
  }
}

const winner = computed(() => (state.value === 'ending' ? data.value?.winner : null))
const winnerTeam = computed(() => (winner.value ? team(winner.value.color) : null))
const big = computed(() => ['countdown', 'preparing', 'freeze'].includes(state.value))
// The lobby and the countdown show the teams as they are being made up: names, no numbers.
const rostering = computed(() => state.value === 'lobby' || state.value === 'countdown')
const address = computed(() => data.value?.address || 'void-rp.ru:25568')
const gridClass = computed(() => {
  const n = teams.value.length
  // In the lobby the «how to join» panel takes the left: the teams get fewer columns.
  if (state.value === 'lobby') return n <= 4 ? 'cols-2' : 'cols-3'
  return n <= 2 ? 'cols-2' : n <= 4 ? 'cols-2' : n <= 6 ? 'cols-3' : 'cols-4'
})
</script>

<template>
  <div class="rl">
    <header class="rl-head">
      <div class="rl-brand">
        <AcademyLogo light class="rl-academy" />
        <div class="rl-brand-t">
          <div class="rl-title">{{ t('royaleLive.title') }}</div>
          <div v-if="data?.map" class="rl-sub">{{ data.map }}</div>
        </div>
      </div>

      <div class="rl-center">
        <template v-if="state === 'running'">
          <div class="rl-phase">{{ t('royaleLive.phase', { n: phase?.index, total: phase?.total }) }}</div>
          <div class="rl-zone" :class="{ shrink: phase?.stage === 'shrink' }">{{ zoneLine }}</div>
          <div v-if="grace > 0" class="rl-grace">{{ t('royaleLive.grace', { t: clock(grace) }) }}</div>
        </template>
        <template v-else-if="state === 'lobby'">
          <div class="rl-phase">{{ t('royaleLive.lobby') }}</div>
          <div class="rl-zone">{{ t('royaleLive.lobbyHint') }}</div>
        </template>
        <template v-else-if="state === 'ending'">
          <div class="rl-phase">{{ t('royaleLive.ev.end') }}</div>
        </template>
      </div>

      <div class="rl-stats">
        <template v-if="state === 'running' || state === 'ending' || state === 'freeze'">
          <div class="rl-stat"><b>{{ aliveTotal }}</b><span>/ {{ playersTotal }}</span><em>{{ t('royaleLive.alive') }}</em></div>
          <div class="rl-stat"><b>{{ clock(elapsed) }}</b><em>{{ t('royaleLive.elapsed') }}</em></div>
        </template>
        <div v-else-if="data && state !== 'offline'" class="rl-stat"><b>{{ data.online }}</b><em>{{ t('royaleLive.online') }}</em></div>
      </div>
    </header>

    <div v-if="state === 'offline' || state === 'loading'" class="rl-empty">
      <div class="rl-spinner" />
      <div>{{ state === 'offline' ? t('royaleLive.offline') : t('royaleLive.waiting') }}</div>
    </div>

    <main v-else class="rl-main" :class="{ 'no-feed': rostering, 'with-join': state === 'lobby' }">
      <aside v-if="state === 'lobby'" class="rl-join">
        <AcademyLogo light class="rl-join-logo" />
        <h2>{{ t('royaleLive.join.title') }}</h2>
        <ol>
          <li>{{ t('royaleLive.join.step1') }}</li>
          <li>{{ t('royaleLive.join.step2') }}</li>
          <li>
            {{ t('royaleLive.join.step3') }}
            <div class="rl-addr">{{ address }}</div>
          </li>
          <li>{{ t('royaleLive.join.step4') }}</li>
          <li>{{ t('royaleLive.join.step5') }}</li>
        </ol>
        <div class="rl-join-note">{{ t('royaleLive.join.note') }}</div>
      </aside>
      <section class="rl-teams" :class="gridClass">
        <div v-if="!teams.length" class="rl-noteams">{{ t('royaleLive.noTeams') }}</div>
        <article
          v-for="tm in teams"
          :key="tm.color"
          class="rl-team"
          :class="{ out: tm.alive === 0 && !rostering, won: winner?.color === tm.color }"
          :style="{ '--c': tm.hex }"
        >
          <div class="rl-team-head">
            <span class="rl-team-name">{{ tm.title }}</span>
            <span v-if="rostering" class="rl-team-count">{{ tm.members.length }}/{{ data.team_size }}</span>
            <span v-else-if="tm.alive === 0 && tm.placement" class="rl-badge">{{ t('royaleLive.place', { n: tm.placement }) }}</span>
            <span v-else class="rl-team-count">{{ tm.alive }}/{{ tm.total }}</span>
          </div>
          <div v-if="!rostering" class="rl-team-kills">⚔ {{ tm.kills }} {{ t('royaleLive.kills') }}</div>
          <ul class="rl-members">
            <li v-for="m in tm.members" :key="m.name" :class="{ dead: !m.alive, off: m.alive && m.online === false }">
              <span class="rl-m-name">{{ m.alive ? '' : '☠ ' }}{{ m.name }}</span>
              <span v-if="!rostering" class="rl-m-nums">
                <span v-if="m.kills">⚔ {{ m.kills }}</span>
                <span v-if="m.damage">❤ {{ m.damage }}</span>
                <span v-if="m.alive && m.online === false" class="rl-m-off">{{ t('royaleLive.offlinePlayer') }}</span>
              </span>
            </li>
          </ul>
        </article>
      </section>

      <aside v-if="!rostering" class="rl-feed">
        <h2>{{ t('royaleLive.feed') }}</h2>
        <div v-if="!feed.length" class="rl-feed-empty">{{ t('royaleLive.feedEmpty') }}</div>
        <TransitionGroup name="rl-ev" tag="ul">
          <li v-for="e in feed" :key="`${e.t}-${e.type}-${e.victim || e.team || e.player || e.phase || ''}`" :class="{ gold: feedLine(e).gold, red: feedLine(e).red }">
            <span class="rl-ev-t">{{ clock(e.t) }}</span>
            <span class="rl-ev-i">{{ feedLine(e).icon }}</span>
            <span class="rl-ev-x">
              <span v-for="(p, i) in feedLine(e).parts" :key="i" :style="p.color ? { color: p.color } : null" :class="{ b: p.bold || p.color }">{{ p.text }}</span>
              <span v-if="feedLine(e).note" class="rl-ev-n"> · {{ feedLine(e).note }}</span>
            </span>
          </li>
        </TransitionGroup>
      </aside>
    </main>

    <footer v-if="state === 'lobby' && last?.winner_title" class="rl-last">
      <span class="rl-last-h">{{ t('royaleLive.lastGame') }}<template v-if="last.started_local"> · {{ last.started_local }}</template></span>
      <span>{{ t('royaleLive.lastWinner') }} <b :style="{ color: colorOf(last.winner) }">{{ last.winner_title }}</b>
        <template v-if="last.winners?.length"> ({{ last.winners.join(', ') }})</template></span>
      <span v-if="last.top_killers?.length">{{ t('royaleLive.bestKiller') }}:
        <b :style="{ color: colorOf(last.top_killers[0].team) }">{{ last.top_killers[0].name }}</b> ({{ last.top_killers[0].kills }})</span>
    </footer>

    <Transition name="rl-fade">
      <div v-if="big" class="rl-overlay">
        <div v-if="state === 'countdown'" class="rl-big">
          <div class="rl-big-l">{{ t('royaleLive.countdown') }}</div>
          <div class="rl-big-n">{{ countdown }}</div>
        </div>
        <div v-else-if="state === 'preparing'" class="rl-big"><div class="rl-big-l">{{ t('royaleLive.preparing') }}</div></div>
        <div v-else class="rl-big"><div class="rl-big-l">{{ t('royaleLive.freeze') }}</div></div>
      </div>
    </Transition>

    <Transition name="rl-fade">
      <div v-if="winner" class="rl-overlay win" :style="{ '--c': winner.hex }">
        <div class="rl-big">
          <div class="rl-big-l">{{ t('royaleLive.winner') }}</div>
          <div class="rl-big-team">{{ winner.title }}</div>
          <div v-if="winnerTeam" class="rl-big-names">{{ winnerTeam.members.map((m) => m.name).join(' · ') }}</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.rl {
  --bg: #0a0a0d;
  --panel: #14141a;
  --line: #24242c;
  --text: #f4f4f6;
  --muted: #8a8a96;
  --red: #e8344e;
  --gold: #ffcc33;
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: radial-gradient(1200px 600px at 85% -10%, rgba(232, 52, 78, 0.16), transparent 60%), var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: clamp(14px, 1.05vw, 26px);
  overflow: hidden;
}

.rl-head {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 2em;
  padding: 1.1em 1.6em;
  border-bottom: 1px solid var(--line);
}
.rl-brand { display: flex; align-items: center; gap: 1.1em; }
.rl-academy { font-size: 3em; }
.rl-brand-t { border-left: 1px solid var(--line); padding-left: 1.1em; }
.rl-title { font-weight: 900; font-size: 1.6em; letter-spacing: 0.02em; text-transform: uppercase; white-space: nowrap; }
.rl-sub { color: var(--muted); }

.rl-center { text-align: center; }
.rl-phase { font-size: 1em; color: var(--muted); text-transform: uppercase; letter-spacing: 0.12em; }
.rl-zone { font-size: 2em; font-weight: 800; font-variant-numeric: tabular-nums; }
.rl-zone.shrink { color: var(--red); animation: rl-pulse 1.2s ease-in-out infinite; }
.rl-grace { margin-top: 0.3em; display: inline-block; padding: 0.15em 0.8em; border-radius: 999px; background: rgba(85, 255, 85, 0.12); color: #6dff8a; font-weight: 700; }

.rl-stats { display: flex; justify-content: flex-end; gap: 1.6em; }
.rl-stat { display: grid; grid-template-columns: auto auto; align-items: baseline; column-gap: 0.25em; text-align: right; }
.rl-stat b { font-size: 2.2em; font-weight: 900; font-variant-numeric: tabular-nums; }
.rl-stat span { color: var(--muted); font-size: 1.2em; }
.rl-stat em { grid-column: 1 / -1; font-style: normal; color: var(--muted); font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.1em; }

.rl-main { flex: 1; display: grid; grid-template-columns: 1fr 26em; gap: 1.2em; padding: 1.2em 1.6em; min-height: 0; }
.rl-main.no-feed { grid-template-columns: 1fr; }
.rl-main.with-join { grid-template-columns: 30em 1fr; }

.rl-join { background: var(--panel); border: 1px solid var(--line); border-top: 0.35em solid var(--red); border-radius: 0.6em; padding: 1.4em 1.5em; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.rl-join-logo { font-size: 4.2em; margin-bottom: 0.25em; }
.rl-join h2 { margin: 0.4em 0 0.6em; font-size: 1.7em; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; }
.rl-join ol { margin: 0; padding: 0; list-style: none; counter-reset: step; display: grid; gap: 0.75em; }
.rl-join li { counter-increment: step; position: relative; padding-left: 2.2em; font-size: 1.2em; line-height: 1.35; }
.rl-join li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 1.5em; height: 1.5em; border-radius: 50%; background: var(--red); color: #fff; font-weight: 800; font-size: 0.85em; display: flex; align-items: center; justify-content: center; }
.rl-addr { margin-top: 0.35em; display: inline-block; font-size: 1.75em; font-weight: 900; color: #fff; background: #0a0a0d; border: 2px solid var(--red); border-radius: 0.3em; padding: 0.15em 0.45em; }
.rl-join-note { margin-top: auto; padding-top: 1em; color: var(--muted); }

.rl-teams { display: grid; gap: 1em; align-content: start; min-height: 0; overflow: hidden; }
.rl-teams.cols-2 { grid-template-columns: repeat(2, 1fr); }
.rl-teams.cols-3 { grid-template-columns: repeat(3, 1fr); }
.rl-teams.cols-4 { grid-template-columns: repeat(4, 1fr); }
.rl-noteams { color: var(--muted); font-size: 1.6em; padding: 2em; grid-column: 1 / -1; text-align: center; }

.rl-team {
  background: var(--panel);
  border: 1px solid var(--line);
  border-top: 0.35em solid var(--c);
  border-radius: 0.6em;
  padding: 0.8em 1em 0.9em;
  transition: opacity 0.6s, transform 0.6s, box-shadow 0.6s;
}
.rl-team.out { opacity: 0.38; }
.rl-team.won { box-shadow: 0 0 0 2px var(--c), 0 0 2.5em color-mix(in srgb, var(--c) 45%, transparent); }
.rl-team-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6em; }
.rl-team-name { color: var(--c); font-weight: 900; font-size: 1.45em; }
.rl-team-count { font-weight: 900; font-size: 1.6em; font-variant-numeric: tabular-nums; }
.rl-badge { background: #2a2a33; padding: 0.15em 0.6em; border-radius: 999px; font-weight: 700; }
.rl-team-kills { color: var(--muted); margin: 0.1em 0 0.5em; }
.rl-members { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25em; }
.rl-members li { display: flex; justify-content: space-between; gap: 0.6em; font-size: 1.12em; }
.rl-members li.dead { color: #5e5e68; text-decoration: line-through; text-decoration-color: #444; }
.rl-members li.off .rl-m-name { opacity: 0.6; }
.rl-m-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rl-m-nums { display: flex; gap: 0.7em; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.rl-m-off { color: #c9a227; font-size: 0.85em; }

.rl-feed { background: var(--panel); border: 1px solid var(--line); border-radius: 0.6em; padding: 0.9em 1em; min-height: 0; overflow: hidden; }
.rl-feed h2 { margin: 0 0 0.6em; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); font-weight: 700; }
.rl-feed ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45em; }
.rl-feed li { display: grid; grid-template-columns: 3.2em 1.4em 1fr; align-items: baseline; font-size: 1.05em; }
.rl-feed li.gold .rl-ev-x { color: var(--gold); }
.rl-feed li.red .rl-ev-x { color: var(--red); }
.rl-feed-empty { color: var(--muted); }
.rl-ev-t { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 0.85em; }
.rl-ev-x .b { font-weight: 800; }
.rl-ev-n { color: var(--muted); }

.rl-last { display: flex; gap: 2em; justify-content: center; padding: 0.9em 1.6em 1.2em; border-top: 1px solid var(--line); color: var(--muted); font-size: 1.1em; }
.rl-last b { font-weight: 800; }
.rl-last-h { text-transform: uppercase; letter-spacing: 0.1em; }

.rl-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1em; color: var(--muted); font-size: 1.6em; }
.rl-spinner { width: 2em; height: 2em; border: 0.2em solid var(--line); border-top-color: var(--red); border-radius: 50%; animation: rl-spin 1s linear infinite; }

.rl-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(6, 6, 9, 0.82); backdrop-filter: blur(4px); }
.rl-overlay.win { background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--c) 30%, transparent), rgba(6, 6, 9, 0.9) 60%); }
.rl-big { text-align: center; }
.rl-big-l { font-size: 2.4em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.rl-big-n { font-size: 14em; font-weight: 900; line-height: 1; color: var(--red); font-variant-numeric: tabular-nums; }
.win .rl-big-l { color: var(--gold); font-size: 3em; }
.rl-big-team { font-size: 8em; font-weight: 900; color: var(--c); line-height: 1.05; text-shadow: 0 0 0.4em color-mix(in srgb, var(--c) 50%, transparent); }
.rl-big-names { margin-top: 0.6em; font-size: 2em; color: var(--text); }

.rl-ev-enter-active { transition: all 0.45s ease; }
.rl-ev-enter-from { opacity: 0; transform: translateX(-1em); background: rgba(232, 52, 78, 0.25); }
.rl-fade-enter-active, .rl-fade-leave-active { transition: opacity 0.4s; }
.rl-fade-enter-from, .rl-fade-leave-to { opacity: 0; }

@keyframes rl-pulse { 50% { opacity: 0.6; } }
@keyframes rl-spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .rl { position: static; min-height: 100vh; overflow: auto; font-size: 14px; }
  .rl-head { grid-template-columns: 1fr; text-align: center; gap: 0.8em; padding: 1em 16px; }
  .rl-brand, .rl-stats { justify-content: center; }
  .rl-main, .rl-main.with-join { grid-template-columns: 1fr; padding: 1em 16px; }
  .rl-academy { font-size: 2.4em; }
  .rl-brand-t { border-left: 0; padding-left: 0; }
  .rl-teams.cols-2, .rl-teams.cols-3, .rl-teams.cols-4 { grid-template-columns: 1fr; }
  .rl-last { flex-direction: column; gap: 0.4em; text-align: center; }
  .rl-big-n { font-size: 8em; }
  .rl-big-team { font-size: 4em; }
}
</style>
