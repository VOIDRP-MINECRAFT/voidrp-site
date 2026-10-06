<script setup>
// «Лента событий» платформы: кто что сделал, какие серверы падали, какие вышли сборки.
// Выезжает справа; обновляется каждые 30 с, пока открыта.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { authState } from '../../stores/authStore'
import { getAdminFeed } from '../../services/adminApi'
import { actionLabel, categoryLabel } from '../../views/admin/auditLabels'

const emit = defineEmits(['close'])
const events = ref([])
const loading = ref(true)
const filter = ref('all')
const now = ref(Date.now())
let timer = null
let clock = null

async function load() {
  try { events.value = (await getAdminFeed(authState.accessToken, 60)).events || [] } catch { /* keep the last list */ } finally { loading.value = false }
}
function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => {
  load()
  timer = setInterval(load, 30000)
  clock = setInterval(() => { now.value = Date.now() }, 15000)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => { clearInterval(timer); clearInterval(clock); document.removeEventListener('keydown', onKey) })

const shown = computed(() => events.value.filter((e) => filter.value === 'all' || e.kind === filter.value))
const counts = computed(() => ({ all: events.value.length, audit: events.value.filter((e) => e.kind === 'audit').length, incident: events.value.filter((e) => e.kind === 'incident').length, release: events.value.filter((e) => e.kind === 'release').length }))
function ago(iso) {
  const s = Math.max(0, Math.round((now.value - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'только что'
  if (s < 3600) return `${Math.round(s / 60)} мин назад`
  if (s < 86400) return `${Math.round(s / 3600)} ч назад`
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
const day = (iso) => new Date(iso).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
const grouped = computed(() => {
  const out = []
  for (const e of shown.value) {
    const d = day(e.at)
    if (!out.length || out[out.length - 1].day !== d) out.push({ day: d, items: [] })
    out[out.length - 1].items.push(e)
  }
  return out
})
</script>

<template>
  <div class="fp-backdrop" @mousedown.self="emit('close')">
    <aside class="fp" role="dialog" aria-label="Лента событий">
      <header class="fp-head">
        <b>Лента событий</b>
        <button type="button" class="adm-btn adm-btn--sm adm-btn--ghost" aria-label="Закрыть" @click="emit('close')">✕</button>
      </header>
      <div class="adm-tabs fp-tabs">
        <button v-for="f in [['all', 'Всё'], ['audit', 'Действия'], ['incident', 'Сбои'], ['release', 'Сборки']]" :key="f[0]" type="button" class="adm-tab" :class="{ 'adm-tab--active': filter === f[0] }" @click="filter = f[0]">
          {{ f[1] }} <span v-if="counts[f[0]]" class="fp-n">{{ counts[f[0]] }}</span>
        </button>
      </div>
      <div class="fp-list">
        <div v-if="loading" class="adm-loading">Собираю события…</div>
        <div v-else-if="!shown.length" class="fp-empty">За неделю здесь пусто.</div>
        <template v-for="g in grouped" :key="g.day">
          <div class="fp-day">{{ g.day }}</div>
          <div v-for="(e, i) in g.items" :key="`${g.day}-${i}`" class="fp-ev" :class="`fp-ev--${e.kind}`">
            <span class="fp-ev__mark" :class="{ 'is-err': e.kind === 'incident' && e.incident === 'down', 'is-warn': (e.kind === 'incident' && e.incident !== 'down') || e.important }" />
            <div class="fp-ev__body">
              <template v-if="e.kind === 'audit'">
                <div><b>{{ e.who || 'система' }}</b> {{ actionLabel(e.action) }}<template v-if="e.target"> · <span class="fp-dim">{{ e.target }}</span></template></div>
                <div class="fp-dim">{{ categoryLabel(e.category) }}<template v-if="e.server"> · {{ e.server }}</template></div>
              </template>
              <template v-else-if="e.kind === 'incident'">
                <div><b>{{ e.server }}</b> {{ e.incident === 'down' ? 'был недоступен' : 'тормозил' }}<template v-if="!e.ended_at"> — <span class="fp-err">идёт сейчас</span></template></div>
                <div class="fp-dim">{{ e.detail }}</div>
              </template>
              <template v-else>
                <div>Вышла сборка <b>{{ e.plugin }} {{ e.version }}</b><span v-if="e.important" class="adm-badge adm-badge--warn fp-badge">важное</span><span v-if="e.channel !== 'stable'" class="adm-badge fp-badge">бета</span></div>
              </template>
            </div>
            <span class="fp-ev__at">{{ ago(e.at) }}</span>
          </div>
        </template>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.fp-backdrop { position: fixed; inset: 0; z-index: 90; background: rgba(2, 4, 9, 0.45); display: flex; justify-content: flex-end; }
.fp { width: min(420px, 100%); height: 100%; display: flex; flex-direction: column; background: var(--adm-card-2); border-left: 1px solid var(--adm-line-strong); box-shadow: -20px 0 60px rgba(0, 0, 0, 0.5); animation: fp-in 0.2s ease; }
@keyframes fp-in { from { transform: translateX(30px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .fp { animation: none; } }
.fp-head { display: flex; justify-content: space-between; align-items: center; padding: 0.9rem 1rem 0.6rem; color: var(--adm-text); }
.fp-tabs { margin: 0 1rem 0.5rem; align-self: flex-start; }
.fp-n { opacity: 0.6; font-size: 0.75em; margin-left: 0.15rem; }
.fp-list { flex: 1; overflow-y: auto; padding: 0 1rem 1rem; display: flex; flex-direction: column; }
.fp-day { position: sticky; top: 0; background: var(--adm-card-2); padding: 0.6rem 0 0.35rem; font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--adm-dim); }
.fp-ev { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.5rem 0; border-bottom: 1px solid var(--adm-line); font-size: 0.8rem; color: var(--adm-text); line-height: 1.4; }
.fp-ev__mark { width: 7px; height: 7px; border-radius: 50%; margin-top: 0.4rem; background: var(--adm-acc); flex: none; }
.fp-ev--audit .fp-ev__mark { background: var(--adm-line-strong); }
.fp-ev__mark.is-err { background: var(--adm-err); }
.fp-ev__mark.is-warn { background: var(--adm-warn); }
.fp-ev__body { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.fp-ev__at { font-size: 0.7rem; color: var(--adm-faint); white-space: nowrap; }
.fp-dim { color: var(--adm-dim); font-size: 0.74rem; }
.fp-err { color: var(--adm-err); font-weight: 700; }
.fp-badge { margin-left: 0.35rem; }
.fp-empty { padding: 2rem 0; text-align: center; color: var(--adm-dim); font-size: 0.84rem; }
</style>
