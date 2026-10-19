<script setup>
// Публичные лидеры королевской битвы за всё время: /royale/leaderboard. Без входа, RU/EN.
// Очки за место команды + за убийства, сложенные по всем сыгранным матчам. ?server=<slug>.
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
let poll = null

async function load() {
  try {
    data.value = await apiRequest(`/royale/leaderboard?server=${encodeURIComponent(slug.value)}&limit=50`, { serverScope: false, toast: false })
    failed.value = false
  } catch {
    failed.value = true
  }
}

onMounted(() => {
  if (!document.getElementById('royale-font')) {
    const link = document.createElement('link')
    link.id = 'royale-font'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap'
    document.head.appendChild(link)
  }
  if (route.query.lang === 'en' || route.query.lang === 'ru') setLocale(route.query.lang)
  document.title = t('royaleBoard.title')
  load()
  poll = setInterval(load, 60000)
})
onBeforeUnmount(() => clearInterval(poll))

const players = computed(() => data.value?.players || [])
const games = computed(() => data.value?.games || 0)
const top3 = computed(() => players.value.slice(0, 3))
const rest = computed(() => players.value.slice(3))
const hearts = (d) => Math.round((d || 0) / 2).toLocaleString('ru-RU')
</script>

<template>
  <div class="lb">
    <header class="lb-head">
      <AcademyLogo light class="lb-logo" />
      <div>
        <h1>{{ t('royaleBoard.title') }}</h1>
        <p>{{ t('royaleBoard.sub', { n: games }) }}</p>
      </div>
    </header>

    <div v-if="failed && !data" class="lb-empty">{{ t('royaleBoard.failed') }}</div>
    <div v-else-if="!players.length" class="lb-empty">{{ t('royaleBoard.empty') }}</div>

    <template v-else>
      <section class="lb-podium">
        <article v-for="(p, i) in top3" :key="p.name" class="lb-pod" :class="`m${i + 1}`">
          <div class="lb-pod-rank">{{ i + 1 }}</div>
          <div class="lb-pod-name">{{ p.name }}</div>
          <div class="lb-pod-pts">{{ p.points }} <span>{{ t('royaleBoard.pts') }}</span></div>
          <div class="lb-pod-sub">
            <span>🏆 {{ p.wins }}</span><span>⚔ {{ p.kills }}</span><span>{{ p.games }} {{ t('royaleBoard.games') }}</span>
          </div>
        </article>
      </section>

      <table class="lb-table">
        <thead>
          <tr>
            <th>#</th><th class="l">{{ t('royaleBoard.player') }}</th>
            <th>{{ t('royaleBoard.points') }}</th><th>🏆</th><th>⚔</th>
            <th>❤</th><th>{{ t('royaleBoard.games') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in rest" :key="p.name">
            <td class="lb-rank">{{ i + 4 }}</td>
            <td class="l lb-name">{{ p.name }}</td>
            <td class="lb-pts">{{ p.points }}</td>
            <td>{{ p.wins }}</td><td>{{ p.kills }}</td>
            <td>{{ hearts(p.damage) }}</td><td>{{ p.games }}</td>
          </tr>
        </tbody>
      </table>

      <p class="lb-foot">{{ t('royaleBoard.formula', { place: (data.place_points || []).join('/'), kill: data.kill_points }) }}</p>
    </template>
  </div>
</template>

<style scoped>
.lb {
  --bg: #0a0a0d; --panel: #14141a; --line: #24242c; --muted: #8a8a96; --red: #e8344e; --gold: #ffcc33;
  min-height: 100vh; background: radial-gradient(1200px 500px at 85% -10%, rgba(232, 52, 78, 0.14), transparent 60%), var(--bg);
  color: #f4f4f6; font-family: Inter, ui-sans-serif, system-ui, sans-serif; padding: 2.5rem 1rem 4rem;
}
:global(body:has(.lb)) { background: #0a0a0d; }
.lb-head { max-width: 920px; margin: 0 auto 2rem; display: flex; align-items: center; gap: 1.4rem; }
.lb-logo { font-size: 3.4rem; }
.lb-head h1 { margin: 0; font-size: 2rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em; }
.lb-head p { margin: 0.2rem 0 0; color: var(--muted); }
.lb-empty { max-width: 920px; margin: 3rem auto; text-align: center; color: var(--muted); font-size: 1.3rem; }

.lb-podium { max-width: 920px; margin: 0 auto 1.4rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.lb-pod { background: var(--panel); border: 1px solid var(--line); border-top: 0.3em solid var(--muted); border-radius: 0.7em; padding: 1.1rem 1rem; text-align: center; }
.lb-pod.m1 { border-top-color: var(--gold); transform: translateY(-0.5rem); box-shadow: 0 0 2em rgba(255, 204, 51, 0.15); }
.lb-pod.m2 { border-top-color: #cdd3da; }
.lb-pod.m3 { border-top-color: #cd7f32; }
.lb-pod-rank { font-size: 2.4rem; font-weight: 900; line-height: 1; }
.lb-pod.m1 .lb-pod-rank { color: var(--gold); }
.lb-pod-name { font-weight: 800; font-size: 1.3rem; margin: 0.3rem 0; word-break: break-word; }
.lb-pod-pts { font-size: 1.8rem; font-weight: 900; color: var(--gold); }
.lb-pod-pts span { font-size: 0.8rem; color: var(--muted); font-weight: 600; }
.lb-pod-sub { display: flex; justify-content: center; gap: 0.9rem; margin-top: 0.5rem; color: var(--muted); font-size: 0.95rem; }

.lb-table { max-width: 920px; margin: 0 auto; width: 100%; border-collapse: collapse; }
.lb-table th { text-align: right; padding: 0.5rem 0.6rem; color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--line); }
.lb-table th.l, .lb-table td.l { text-align: left; }
.lb-table td { text-align: right; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; }
.lb-rank { color: var(--muted); font-weight: 800; }
.lb-name { font-weight: 700; }
.lb-pts { font-weight: 900; color: var(--gold); }
.lb-foot { max-width: 920px; margin: 1.4rem auto 0; color: var(--muted); font-size: 0.85rem; text-align: center; }

@media (max-width: 640px) {
  .lb-head { flex-direction: column; text-align: center; gap: 0.6rem; }
  .lb-podium { grid-template-columns: 1fr; }
  .lb-pod.m1 { transform: none; }
  .lb-table th:nth-child(6), .lb-table td:nth-child(6) { display: none; }
}
</style>
