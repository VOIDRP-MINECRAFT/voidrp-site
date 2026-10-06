<script setup>
// «Серверы»: карточки серверов с живым онлайном и быстрыми переключателями; настройки
// одного сервера — во вкладках (servers/ServerEditor.vue), новый — мастером в три шага.
// Что открыто — в адресе: ?edit=<slug>&tab=<вкладка> или ?new=1.
//
// «Серверы» можно дать на один сервер: тогда правится только он, а создание, удаление и поля
// про машину — только с правом на всю платформу. Бэкенд проверяет то же самое.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { authState } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'
import { deleteServer, getServersStatus, listServers, updateServer } from '../../services/adminServersApi'
import ServerCard from './servers/ServerCard.vue'
import ServerEditor from './servers/ServerEditor.vue'
import ServerWizard from './servers/ServerWizard.vue'
import { visibilityPatch } from './servers/shared'

const route = useRoute()
const router = useRouter()
const token = () => authState.accessToken
const platform = computed(() => !!(authState.user?.is_admin || authState.user?.permissions?.includes('servers.manage')))

const servers = ref([])
const status = ref({})
const loading = ref(true)
const busy = ref(null)
const query = ref('')
const editor = ref(null)

async function load() {
  try {
    servers.value = await listServers(token())
  } catch (e) {
    toastError(e?.message || 'Не удалось загрузить серверы')
  } finally {
    loading.value = false
  }
}
async function loadStatus() {
  try { status.value = await getServersStatus(token()) } catch { /* the cards just say «проверяем…» */ }
}
let timer = null
onMounted(() => {
  load()
  loadStatus()
  timer = setInterval(loadStatus, 30000)
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => { clearInterval(timer); window.removeEventListener('beforeunload', beforeUnload) })

// ── Что открыто ──
const editing = computed(() => (typeof route.query.edit === 'string' ? servers.value.find((s) => s.slug === route.query.edit) : null))
const creating = computed(() => route.query.new === '1' && platform.value)
const tab = computed(() => (typeof route.query.tab === 'string' ? route.query.tab : 'general'))
const open = (slug) => router.push({ query: { edit: slug } })
const setTab = (t) => router.replace({ query: { ...route.query, tab: t } })
const close = () => router.push({ query: {} })

const isDirty = () => !!editor.value?.dirty
function beforeUnload(e) { if (isDirty()) { e.preventDefault(); e.returnValue = '' } }
async function confirmLeave() {
  if (!isDirty()) return true
  return confirmDialog({ title: 'Несохранённые изменения', message: 'Изменения в настройках сервера не сохранены. Уйти без сохранения?', confirmLabel: 'Уйти без сохранения', danger: true })
}
onBeforeRouteLeave(async () => (await confirmLeave()) || false)
onBeforeRouteUpdate(async (to, from) => {
  // Same page, another server or back to the list: ask before dropping edits.
  if (from.query.edit && to.query.edit !== from.query.edit) return (await confirmLeave()) || false
  return true
})

// ── Список ──
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = [...servers.value].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
  if (!q) return list
  return list.filter((s) => [s.name, s.slug, s.host].some((v) => (v || '').toLowerCase().includes(q)))
})
const totals = computed(() => {
  const vals = Object.values(status.value)
  return {
    online: vals.filter((v) => v.online).length,
    players: vals.reduce((a, v) => a + (v.online ? v.players_online || 0 : 0), 0),
    maint: servers.value.filter((s) => s.maintenance).length,
  }
})

function replace(updated) {
  const i = servers.value.findIndex((s) => s.id === updated.id)
  if (i >= 0) servers.value.splice(i, 1, updated)
}
async function patch(server, body, done) {
  busy.value = server.id
  try {
    replace(await updateServer(token(), server.id, body))
    toastSuccess(done)
  } catch (e) {
    toastError(e?.message || 'Не удалось сохранить')
  } finally {
    busy.value = null
  }
}
function setVisibility(server, mode) {
  const text = { all: `«${server.name}» виден всем игрокам`, staff: `«${server.name}» виден только админам`, hidden: `«${server.name}» скрыт ото всех` }[mode]
  patch(server, visibilityPatch(mode), text)
}
function setMaintenance(server, on) {
  patch(server, { maintenance: on }, on ? `«${server.name}»: техработы включены` : `«${server.name}»: техработы выключены`)
}
async function remove(server) {
  const ok = await confirmDialog({ title: 'Удалить сервер', message: `Удалить «${server.name}»? Все игровые данные этого сервера удалятся каскадно и безвозвратно.`, confirmLabel: 'Удалить навсегда', danger: true })
  if (!ok) return
  try {
    await deleteServer(token(), server.id)
    servers.value = servers.value.filter((s) => s.id !== server.id)
    toastSuccess('Сервер удалён')
  } catch (e) { toastError(e?.message || 'Не удалось удалить') }
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toastSuccess('Адрес скопирован') } catch { toastError('Не удалось скопировать') }
}
function onSaved(updated) { replace(updated) }
async function onDeleted() { await load(); close() }
async function onCreated(server) {
  servers.value.push(server)
  loadStatus()
  router.replace({ query: { edit: server.slug, tab: 'look' } })
}
</script>

<template>
  <div class="adm-page sv-page">
    <ServerWizard v-if="creating" :servers="servers" @close="close" @created="onCreated" />

    <template v-else-if="route.query.edit">
      <div v-if="loading" class="adm-skel" style="height: 300px" />
      <ServerEditor v-else-if="editing" ref="editor" :key="editing.id" :server="editing" :status="status[editing.id]" :platform="platform" :tab="tab"
                    @close="close" @tab="setTab" @saved="onSaved" @deleted="onDeleted" />
      <div v-else class="adm-empty">
        <div class="adm-empty__title">Сервер «{{ route.query.edit }}» не найден</div>
        <div class="adm-empty__sub">Возможно, его удалили или у вас нет прав на него.</div>
        <button type="button" class="adm-btn adm-btn--sm" @click="close">← Все серверы</button>
      </div>
    </template>

    <template v-else>
      <div class="adm-page__head">
        <div>
          <h1 class="adm-title">Серверы</h1>
          <p class="adm-sub">
            <template v-if="servers.length">{{ servers.length }} {{ servers.length === 1 ? 'сервер' : servers.length < 5 ? 'сервера' : 'серверов' }} · в сети {{ totals.online }} · игроков {{ totals.players }}<template v-if="totals.maint"> · на техработах {{ totals.maint }}</template></template>
            <template v-else>Витрина, подключение, сборка и секрет каждого сервера</template>
          </p>
        </div>
        <div class="adm-head-actions">
          <input v-if="servers.length > 4" v-model="query" type="search" class="adm-input sv-search" placeholder="Найти сервер" aria-label="Найти сервер" />
          <button v-if="platform" type="button" class="adm-btn adm-btn--acc" @click="router.push({ query: { new: '1' } })">+ Новый сервер</button>
        </div>
      </div>

      <div v-if="loading" class="sv-grid">
        <div v-for="n in 3" :key="n" class="adm-skel" style="height: 330px" />
      </div>
      <div v-else-if="!servers.length" class="adm-empty">
        <div class="adm-empty__title">Пока нет серверов</div>
        <div class="adm-empty__sub">Добавьте первый — он появится на сайте и в лаунчере</div>
      </div>
      <div v-else-if="!shown.length" class="adm-empty"><div class="adm-empty__title">Ничего не нашлось</div></div>
      <div v-else class="sv-grid">
        <ServerCard v-for="s in shown" :key="s.id" :server="s" :status="status[s.id]" :platform="platform" :busy="busy === s.id"
                    @edit="open(s.slug)" @visibility="setVisibility(s, $event)" @maintenance="setMaintenance(s, $event)" @delete="remove(s)" @copy="copy" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.sv-page { max-width: 1240px; }
.sv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 1rem; margin-top: 1rem; align-items: start; }
.sv-search { width: 14rem; }
</style>
