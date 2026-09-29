<script setup>
// The queue of jar changes to the server's mods and plugins: what waits for the server
// to be stopped, "Перезапустить и применить", and how the last restart went.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'
import { applyPluginsViaPlugman, applyServerChangesNow, cancelServerChange, getServerChanges } from '../../services/pluginsAdminApi'

const emit = defineEmits(['applied'])
const token = () => authState.accessToken
const canManage = computed(() => hasPermission('mods.manage') || hasPermission('plugins.manage'))
const data = ref(null)
const busy = ref(false)
let timer = null

const active = computed(() => ['pending', 'running'].includes(data.value?.job?.status))
const showJob = computed(() => {
  const j = data.value?.job
  if (!j) return false
  if (active.value) return true
  return j.finished_at && Date.now() - new Date(j.finished_at).getTime() < 30 * 60 * 1000
})

async function load() {
  try {
    const wasActive = active.value
    data.value = await getServerChanges(token())
    if (wasActive && !active.value) emit('applied')
  } catch {
    data.value = null
  }
  clearTimeout(timer)
  if (!document.hidden) timer = setTimeout(load, active.value ? 3000 : 20000)
}
defineExpose({ load })
onMounted(load)
onBeforeUnmount(() => clearTimeout(timer))

async function cancel(c) {
  try {
    await cancelServerChange(token(), c.id)
    await load()
  } catch (e) {
    toastError(e.message || 'Не удалось отменить')
  }
}

async function applyNow() {
  const n = data.value.pending.length
  const running = data.value.running
  const ok = await confirmDialog({
    title: running ? 'Перезапустить сервер и применить?' : 'Применить изменения?',
    message: running
      ? `Игроков предупредят в чате за 30 с, сервер остановится, ${n} изм. применятся, пока он выключен, и он запустится снова (основной сервер грузится ~10 минут).`
      : `Сервер выключен — ${n} изм. применятся сразу.`,
    confirmLabel: running ? 'Перезапустить и применить' : 'Применить',
    danger: running,
  })
  if (!ok) return
  busy.value = true
  try {
    const res = await applyServerChangesNow(token(), 30)
    toastSuccess(res.job ? 'Перезапуск поставлен — ход виден здесь' : 'Изменения применены')
    await load()
    if (!res.job) emit('applied')
  } catch (e) {
    toastError(e.message || 'Не удалось применить')
  } finally {
    busy.value = false
  }
}

const pluginPending = computed(() => (data.value?.pending || []).filter((c) => c.kind === 'plugin').length)
const modPending = computed(() => (data.value?.pending || []).filter((c) => c.kind === 'mod').length)
const canPlugins = computed(() => hasPermission('plugins.manage'))

async function applyPlugman() {
  const ok = await confirmDialog({
    title: 'Применить плагины без перезапуска?',
    message: `PlugMan выгрузит ${pluginPending.value} плагин(а) — и те, что от них зависят, — подменит jar и загрузит снова. `
      + 'Игроки останутся на сервере. Некоторые плагины после горячей перезагрузки ведут себя странно — тогда поможет обычный перезапуск.'
      + (modPending.value ? ` Моды (${modPending.value}) так не применить — они останутся в очереди до перезапуска.` : ''),
    confirmLabel: 'Применить через PlugMan',
  })
  if (!ok) return
  busy.value = true
  try {
    const res = await applyPluginsViaPlugman(token())
    const warn = res.results.filter((r) => r.warning || r.status !== 'applied')
    if (warn.length) toastError(`Есть предупреждения: ${warn.map((r) => r.filename).join(', ')} — смотрите «Последние»`)
    else toastSuccess(`Применено без перезапуска: ${res.results.length}`)
    await load()
    emit('applied')
  } catch (e) {
    toastError(e.message || 'Не удалось применить через PlugMan')
  } finally {
    busy.value = false
  }
}

const OP = { add: 'установить', remove: 'удалить', disable: 'выключить', enable: 'включить' }
const KIND = { mod: 'мод', plugin: 'плагин' }
</script>

<template>
  <div v-if="data && (data.pending.length || showJob)" class="adm-card adm-card--pad scb">
    <div v-if="showJob" class="scb-job" :class="`scb-job--${data.job.status}`">
      <span class="scb-dot" />
      <div>
        <div class="scb-job__title">
          {{ active ? 'Идёт перезапуск с применением изменений' : data.job.status === 'done' ? 'Изменения применены' : 'Перезапуск не удался' }}
        </div>
        <div class="scb-job__step">{{ data.job.error || data.job.step }}</div>
      </div>
    </div>

    <template v-if="data.pending.length">
      <div class="scb-head">
        <div>
          <b>В очереди: {{ data.pending.length }}</b>
          <span class="scb-sub">
            {{ data.running ? 'сервер запущен — jar меняются только на остановленном, это безопасно для игроков' : 'сервер выключен' }}
          </span>
        </div>
        <div class="scb-acts">
          <button v-if="canPlugins && data.running && data.plugman && pluginPending" class="adm-btn adm-btn--ok adm-btn--sm" :disabled="busy || active" @click="applyPlugman">
            Плагины без перезапуска (PlugMan)
          </button>
          <button v-if="canManage && data.can_restart" class="adm-btn adm-btn--acc adm-btn--sm" :disabled="busy || active" @click="applyNow">
            {{ data.running ? 'Перезапустить и применить' : 'Применить' }}
          </button>
        </div>
      </div>
      <div v-if="data.running && pluginPending && !data.plugman" class="scb-tip">
        Совет: поставьте плагин <b>PlugManX</b> — тогда изменения плагинов можно применять без перезапуска сервера.
        Пока — перезапуском, как с модами.
      </div>
      <div v-for="c in data.pending" :key="c.id" class="scb-row">
        <span class="adm-badge">{{ KIND[c.kind] }}</span>
        <span class="scb-row__what">{{ c.label || `${OP[c.op]} ${c.filename}` }}</span>
        <span class="scb-row__meta">{{ c.created_by || '—' }}</span>
        <button v-if="canManage" class="adm-btn adm-btn--sm adm-btn--ghost" @click="cancel(c)">Отменить</button>
      </div>
      <p class="scb-hint">Применится также само, если сервер будет выключен (воркер проверяет раз в минуту).</p>
    </template>
  </div>
</template>

<style scoped>
.scb { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; border-color: rgba(250, 204, 21, 0.35); }
.scb-head { display: flex; justify-content: space-between; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
.scb-head b { color: var(--adm-text); }
.scb-sub { display: block; font-size: 0.76rem; color: var(--adm-dim); margin-top: 0.15rem; }
.scb-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-size: 0.84rem; }
.scb-row__what { flex: 1; min-width: 12rem; color: var(--adm-text); }
.scb-row__meta { font-size: 0.72rem; color: var(--adm-faint); }
.scb-acts { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.scb-tip { font-size: 0.78rem; color: var(--adm-dim); background: rgba(148, 163, 184, 0.07); border-radius: 8px; padding: 0.45rem 0.6rem; }
.scb-tip b { color: var(--adm-text); }
.scb-hint { margin: 0; font-size: 0.72rem; color: var(--adm-faint); }
.scb-job { display: flex; gap: 0.7rem; align-items: flex-start; }
.scb-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; margin-top: 0.35rem; background: #facc15; flex-shrink: 0; }
.scb-job--done .scb-dot { background: #4ade80; }
.scb-job--failed .scb-dot { background: #f87171; }
.scb-job--running .scb-dot, .scb-job--pending .scb-dot { animation: scb-pulse 1.4s ease-in-out infinite; }
@keyframes scb-pulse { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) { .scb-dot { animation: none !important; } }
.scb-job__title { font-weight: 700; color: var(--adm-text); font-size: 0.9rem; }
.scb-job__step { font-size: 0.8rem; color: var(--adm-dim); margin-top: 0.15rem; }
</style>
