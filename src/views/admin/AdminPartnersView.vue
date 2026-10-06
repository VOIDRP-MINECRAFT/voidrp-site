<script setup>
// «Партнёры»: все подключённые серверы одной таблицей — кому плохо, у кого старые плагины,
// кто молчит. Сначала проблемные. Только админам платформы; обновляется раз в 30 с.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getFleet } from '../../services/integrationApi'
import { toastError } from '../../services/toast'
import { ago } from './integration/util'

const data = ref(null)
const loading = ref(true)
const now = ref(Date.now())
const filter = ref('all')
let timer = null
let clock = null

async function load() {
  try { data.value = await getFleet() } catch (e) { if (!data.value) toastError(e?.message || 'Не удалось загрузить') } finally { loading.value = false }
}
onMounted(() => {
  load()
  timer = setInterval(load, 30000)
  clock = setInterval(() => { now.value = Date.now() }, 5000)
})
onBeforeUnmount(() => { clearInterval(timer); clearInterval(clock) })

const servers = computed(() => data.value?.servers || [])
const counts = computed(() => ({
  all: servers.value.length,
  problems: servers.value.filter((s) => s.state === 'err' || s.state === 'warn' || s.open_incident).length,
  outdated: servers.value.filter((s) => s.plugins.some((p) => p.outdated)).length,
}))
const shown = computed(() => servers.value.filter((s) => {
  if (filter.value === 'problems') return s.state === 'err' || s.state === 'warn' || s.open_incident
  if (filter.value === 'outdated') return s.plugins.some((p) => p.outdated)
  return true
}))
const STATE = { ok: 'на связи', warn: 'не всё работает', err: 'нет связи', new: 'не подключён' }
const pct = (v) => (v == null ? '—' : `${v >= 99.995 ? '100' : v.toFixed(1)}%`)
const barKind = (u) => (u == null ? 'empty' : u >= 99.5 ? 'good' : u >= 95 ? 'partial' : 'bad')
const totals = computed(() => ({
  players: servers.value.reduce((a, s) => a + (s.players || 0), 0),
  waiting: servers.value.reduce((a, s) => a + s.plugins.filter((p) => p.outdated).length, 0),
  auto: servers.value.filter((s) => s.auto_update).length,
}))
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Партнёры</h1>
        <p class="adm-sub">Все подключённые серверы: связь, оценка, доступность и плагины. Сначала те, где что-то не так.</p>
      </div>
      <a href="/partners" target="_blank" class="adm-btn adm-btn--ghost">Публичная страница ↗</a>
    </div>

    <div v-if="loading && !data" class="adm-card fl-pad">Загружаем…</div>
    <template v-else>
      <div class="fl-stats">
        <div class="fl-stat"><span class="fl-stat__v">{{ counts.all }}</span><span class="fl-stat__l">серверов</span></div>
        <div class="fl-stat" :class="{ 'fl-stat--bad': counts.problems }"><span class="fl-stat__v">{{ counts.problems }}</span><span class="fl-stat__l">с проблемами</span></div>
        <div class="fl-stat"><span class="fl-stat__v">{{ totals.players }}</span><span class="fl-stat__l">игроков сейчас</span></div>
        <div class="fl-stat" :class="{ 'fl-stat--warn': totals.waiting }"><span class="fl-stat__v">{{ totals.waiting }}</span><span class="fl-stat__l">обновлений ждут</span></div>
        <div class="fl-stat"><span class="fl-stat__v">{{ totals.auto }}/{{ counts.all }}</span><span class="fl-stat__l">с автообновлением</span></div>
      </div>

      <div class="adm-tabs fl-filter">
        <button v-for="f in [['all', 'Все'], ['problems', 'С проблемами'], ['outdated', 'Старые плагины']]" :key="f[0]" class="adm-tab" :class="{ 'adm-tab--active': filter === f[0] }" @click="filter = f[0]">
          {{ f[1] }} <span class="fl-count">{{ counts[f[0]] }}</span>
        </button>
      </div>

      <div v-if="!shown.length" class="adm-card fl-pad fl-calm">✓ Здесь пусто — всё в порядке.</div>
      <div class="fl-list">
        <article v-for="s in shown" :key="s.slug" class="fl-row" :class="`fl-row--${s.state}`">
          <div class="fl-id">
            <img v-if="s.icon_url" :src="s.icon_url" alt="" class="fl-icon" />
            <div class="fl-icon fl-icon--ph" v-else>{{ s.name.slice(0, 1) }}</div>
            <div class="fl-id__text">
              <div class="fl-name">{{ s.name }} <span v-if="!s.is_external" class="adm-badge">наш</span><span v-if="s.maintenance" class="adm-badge adm-badge--warn">техработы</span></div>
              <div class="fl-muted">{{ s.core || 'ядро не указано' }} · отчёт {{ s.last_report ? ago(s.last_report, now) : 'не было' }}</div>
            </div>
          </div>

          <div class="fl-state">
            <span class="adm-dot" :class="{ 'adm-dot--ok': s.state === 'ok', 'adm-dot--warn': s.state === 'warn', 'adm-dot--err': s.state === 'err' }" />
            <span>{{ STATE[s.state] }}</span>
            <span v-if="s.health?.grade" class="fl-grade" :class="`fl-grade--${s.health.grade.replace('+', 'p')}`" :title="`${s.health.score}/100`">{{ s.health.grade }}</span>
          </div>

          <div class="fl-live">
            <div><b>{{ s.players ?? '—' }}</b><span class="fl-muted"> игроков</span></div>
            <div><b :class="{ 'fl-warn': s.tps != null && s.tps < 15 }">{{ s.tps != null ? s.tps.toFixed(1) : '—' }}</b><span class="fl-muted"> TPS</span></div>
            <div v-if="s.reach"><b :class="{ 'fl-err': !s.reach.ok }">{{ s.reach.ok ? `${s.reach.latency_ms} мс` : 'недоступен' }}</b><span class="fl-muted"> снаружи</span></div>
          </div>

          <div class="fl-up">
            <div class="fl-muted">7 дней <b class="fl-strong">{{ pct(s.uptime_7d) }}</b> · сбоев {{ s.incidents_30d }}</div>
            <div class="fl-bars"><i v-for="b in s.bars_30d" :key="b.day" :class="`fl-bar--${barKind(b.uptime)}`" :title="`${b.day}: ${pct(b.uptime)}`" /></div>
          </div>

          <div class="fl-plugins">
            <span v-for="p in s.plugins" :key="p.name" class="fl-plugin" :class="{ 'fl-plugin--old': p.outdated, 'fl-plugin--bad': p.unsupported }" :title="p.outdated ? `есть ${p.latest}` : 'свежий'">
              {{ p.name.replace('VoidRp', '') }} {{ p.version }}<template v-if="p.outdated"> → {{ p.latest }}</template>
            </span>
            <span class="fl-muted">{{ s.auto_update ? '🔁 автообновление' : '' }}</span>
          </div>

          <div class="fl-foot">
            <span v-if="s.open_incident" class="fl-err">🔥 {{ s.open_incident.detail }}</span>
            <span v-else-if="s.advice" class="fl-muted">💡 {{ s.advice }}</span>
            <span class="fl-acts">
              <a v-if="s.status_page" :href="s.status_page" target="_blank" class="adm-btn adm-btn--sm adm-btn--ghost">Статус</a>
              <RouterLink :to="`/admin/integration?server=${s.slug}`" class="adm-btn adm-btn--sm">Интеграция</RouterLink>
            </span>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.fl-pad { padding: 1rem; }
.fl-calm { color: var(--adm-ok); font-weight: 600; }
.fl-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; margin-bottom: 1rem; }
.fl-stat { padding: 0.75rem 0.9rem; border-radius: var(--adm-r); background: var(--adm-card); border: 1px solid var(--adm-line); display: flex; flex-direction: column; }
.fl-stat__v { font-size: 1.5rem; font-weight: 800; color: var(--adm-text); font-variant-numeric: tabular-nums; }
.fl-stat__l { font-size: 0.75rem; color: var(--adm-dim); }
.fl-stat--bad .fl-stat__v { color: var(--adm-err); }
.fl-stat--warn .fl-stat__v { color: var(--adm-warn); }
.fl-filter { margin-bottom: 0.8rem; }
.fl-count { opacity: 0.65; font-size: 0.75em; margin-left: 0.2rem; }
.fl-list { display: flex; flex-direction: column; gap: 0.6rem; }
.fl-row {
  display: grid; grid-template-columns: minmax(200px, 1.4fr) minmax(140px, 0.8fr) minmax(150px, 0.9fr) minmax(170px, 1fr);
  grid-template-areas: "id state live up" "plugins plugins plugins plugins" "foot foot foot foot";
  gap: 0.6rem 1rem; padding: 0.85rem 1rem; border-radius: var(--adm-r); background: var(--adm-card); border: 1px solid var(--adm-line); border-left: 4px solid var(--adm-line-strong);
}
.fl-row--ok { border-left-color: var(--adm-ok); }
.fl-row--warn { border-left-color: var(--adm-warn); }
.fl-row--err { border-left-color: var(--adm-err); }
@media (max-width: 900px) {
  .fl-row { grid-template-columns: 1fr 1fr; grid-template-areas: "id id" "state live" "up up" "plugins plugins" "foot foot"; }
}
.fl-id { grid-area: id; display: flex; gap: 0.7rem; align-items: center; min-width: 0; }
.fl-icon { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex: none; }
.fl-icon--ph { display: grid; place-items: center; background: var(--adm-acc-soft); color: var(--adm-acc-text); font-weight: 800; }
.fl-id__text { min-width: 0; }
.fl-name { font-weight: 700; color: var(--adm-text); display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; }
.fl-muted { color: var(--adm-dim); font-size: 0.78rem; }
.fl-strong { color: var(--adm-text); }
.fl-warn { color: var(--adm-warn); }
.fl-err { color: var(--adm-err); font-size: 0.82rem; font-weight: 600; }
.fl-state { grid-area: state; display: flex; gap: 0.4rem; align-items: center; font-size: 0.84rem; color: var(--adm-text); }
.fl-grade { font-weight: 800; font-size: 0.78rem; padding: 0.05rem 0.4rem; border-radius: 6px; border: 1px solid currentColor; }
.fl-grade--Ap, .fl-grade--A { color: var(--adm-ok); }
.fl-grade--B { color: var(--adm-info); }
.fl-grade--C, .fl-grade--D { color: var(--adm-warn); }
.fl-grade--F { color: var(--adm-err); }
.fl-live { grid-area: live; display: flex; flex-direction: column; gap: 0.1rem; font-size: 0.84rem; color: var(--adm-text); }
.fl-up { grid-area: up; display: flex; flex-direction: column; gap: 0.3rem; justify-content: center; }
.fl-bars { display: flex; gap: 2px; height: 14px; }
.fl-bars i { flex: 1; border-radius: 2px; background: var(--adm-line); }
.fl-bars .fl-bar--good { background: var(--adm-ok); }
.fl-bars .fl-bar--partial { background: var(--adm-warn); }
.fl-bars .fl-bar--bad { background: var(--adm-err); }
.fl-plugins { grid-area: plugins; display: flex; gap: 0.35rem; flex-wrap: wrap; align-items: center; }
.fl-plugin { font-size: 0.74rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: var(--adm-card-2); border: 1px solid var(--adm-line); color: var(--adm-text); }
.fl-plugin--old { border-color: color-mix(in srgb, var(--adm-warn) 55%, transparent); color: var(--adm-warn); }
.fl-plugin--bad { border-color: color-mix(in srgb, var(--adm-err) 60%, transparent); color: var(--adm-err); }
.fl-foot { grid-area: foot; display: flex; gap: 0.6rem; align-items: center; justify-content: space-between; flex-wrap: wrap; border-top: 1px solid var(--adm-line); padding-top: 0.55rem; }
.fl-acts { display: flex; gap: 0.4rem; margin-left: auto; }
</style>
