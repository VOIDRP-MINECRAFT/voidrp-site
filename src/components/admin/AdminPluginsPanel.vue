<script setup>
// Plugins of the selected server: installed (from plugin.yml), switched off, waiting in
// plugins/update/; upload through a staging preview that tells a new plugin from a new
// version of one installed; switch off / on / remove. Jar changes on a running server
// go to the queue (ServerChangesBar) — never under the JVM.
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authState, hasPermission } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'
import { applyPlugins, changePlugin, getPlugins, uploadPlugins } from '../../services/pluginsAdminApi'

const emit = defineEmits(['changed', 'loaded'])
const router = useRouter()
const token = () => authState.accessToken
const canManage = computed(() => hasPermission('plugins.manage'))
const canFiles = computed(() => hasPermission('files.view'))

const data = ref(null)
const loading = ref(true)
const filter = ref('')

async function load() {
  loading.value = true
  try {
    data.value = await getPlugins(token())
    emit('loaded', data.value)
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить плагины')
  } finally {
    loading.value = false
  }
}
defineExpose({ load })
onMounted(load)

const match = (p) => {
  const f = filter.value.trim().toLowerCase()
  return !f || (p.name || '').toLowerCase().includes(f) || p.filename.toLowerCase().includes(f)
}
const enabled = computed(() => (data.value?.enabled || []).filter(match))
const disabled = computed(() => (data.value?.disabled || []).filter(match))
const installedNames = computed(() => new Set([...(data.value?.enabled || []), ...(data.value?.disabled || [])].map((p) => (p.name || '').toLowerCase())))

const size = (b) => (b < 1024 ** 2 ? `${(b / 1024).toFixed(0)} КБ` : `${(b / 1024 ** 2).toFixed(1)} МБ`)

// ── Upload → staging preview → queue ─────────────────────────────────────
const picker = ref(null)
const uploadPct = ref(null)
const staging = ref(null) // { token, files:[{..., pick}] }
const dragOver = ref(false)

async function upload(list) {
  const files = [...(list || [])].filter((f) => f.name.toLowerCase().endsWith('.jar'))
  if (!files.length) { toastError('Нужны .jar файлы плагинов'); return }
  uploadPct.value = 0
  try {
    const res = await uploadPlugins(token(), files, (p) => { uploadPct.value = p })
    res.files.forEach((f) => { f.pick = !f.error })
    staging.value = res
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить')
  } finally {
    uploadPct.value = null
  }
}

async function applyStaging() {
  const picked = staging.value.files.filter((f) => f.pick).map((f) => f.filename)
  if (!picked.length) { staging.value = null; return }
  try {
    const res = await applyPlugins(token(), staging.value.token, picked)
    const queued = res.queued.filter((q) => q.status === 'pending').length
    toastSuccess(queued ? `В очереди: ${queued} — примените кнопкой в очереди вверху` : 'Установлено')
    staging.value = null
    await load()
    emit('changed')
  } catch (e) {
    toastError(e.message || 'Не удалось применить')
  }
}

// ── Off / on / remove ─────────────────────────────────────────────────────
async function change(p, op) {
  const words = { disable: 'Выключить', enable: 'Включить', remove: 'Удалить' }
  const ok = await confirmDialog({
    title: `${words[op]} ${p.name || p.filename}?`,
    message: op === 'remove'
      ? 'Jar уйдёт в корзину (восстановить можно). Папка настроек плагина остаётся.'
      : op === 'disable' ? 'Jar переедет в plugins/disabled/ — плагин не загрузится, настройки останутся.'
        : 'Jar вернётся в plugins/ и загрузится при старте.',
    confirmLabel: words[op],
    danger: op !== 'enable',
  })
  if (!ok) return
  try {
    const res = await changePlugin(token(), p.filename, op)
    if (res.status === 'failed') toastError(res.result || 'Не получилось')
    else toastSuccess(res.status === 'pending' ? 'В очереди — примените кнопкой вверху' : res.result || 'Готово')
    await load()
    emit('changed')
  } catch (e) {
    toastError(e.message || 'Не получилось')
  }
}

function openConfig(p) {
  router.push({ name: 'admin-files', query: { path: p.config_folder } })
}
</script>

<template>
  <div class="pl">
    <div v-if="loading" class="adm-skel" style="height: 240px" />
    <div v-else-if="data && !data.available" class="adm-empty">
      <div class="adm-empty__title">У этого сервера нет папки plugins</div>
      <div class="adm-empty__sub">Плагины Paper/Bukkit здесь не используются.</div>
    </div>
    <template v-else-if="data">
      <!-- Upload -->
      <div
        v-if="canManage"
        class="adm-card adm-card--pad pl-drop"
        :class="{ 'pl-drop--over': dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="dragOver = false; upload($event.dataTransfer.files)"
      >
        <div>
          <b>Добавить или обновить плагины</b>
          <div class="pl-sub">Перетащите .jar сюда. Новая версия уже стоящего плагина заменит старую — не будет двух копий.</div>
        </div>
        <button class="adm-btn adm-btn--acc" :disabled="uploadPct !== null" @click="picker.click()">
          {{ uploadPct !== null ? `Загрузка ${uploadPct}%` : 'Выбрать файлы' }}
        </button>
        <input ref="picker" type="file" accept=".jar" multiple hidden @change="upload($event.target.files); $event.target.value = ''" />
      </div>

      <!-- Staging preview -->
      <div v-if="staging" class="adm-card adm-card--pad pl-stage">
        <div class="pl-stage__title">Проверка загруженного</div>
        <label v-for="f in staging.files" :key="f.filename" class="pl-stage__row" :class="{ 'pl-stage__row--bad': f.error }">
          <input v-model="f.pick" type="checkbox" :disabled="!!f.error" />
          <div class="pl-stage__info">
            <div><b>{{ f.name || f.filename }}</b> <span class="pl-meta">{{ f.version }} · {{ f.filename }} · {{ size(f.size) }}</span></div>
            <div v-if="f.error" class="pl-err">{{ f.error }}</div>
            <template v-else>
              <div v-if="f.replaces" class="pl-note">
                Заменит {{ f.replaces }} ({{ f.replaces_version || '?' }} → {{ f.version }})
                <span v-if="f.same_version" class="pl-warn">— та же версия</span>
              </div>
              <div v-else class="pl-note pl-note--new">Новый плагин</div>
              <div v-if="f.missing_depend?.length" class="pl-warn">Нет нужных плагинов: {{ f.missing_depend.join(', ') }} — без них он не запустится</div>
            </template>
          </div>
        </label>
        <div class="pl-stage__acts">
          <button class="adm-btn" @click="staging = null">Отмена</button>
          <button class="adm-btn adm-btn--acc" :disabled="!staging.files.some((f) => f.pick)" @click="applyStaging">
            {{ data.running ? 'В очередь (применится при перезапуске)' : 'Установить' }}
          </button>
        </div>
      </div>

      <div class="pl-plugman" :class="data.plugman?.installed ? 'pl-plugman--ok' : ''">
        <template v-if="data.plugman?.installed">
          ✓ Стоит {{ data.plugman.name }}: изменения плагинов можно применять без перезапуска сервера — кнопкой в очереди.
        </template>
        <template v-else>
          PlugMan не установлен: изменения плагинов применяются перезапуском сервера, как у модов.
          Рекомендуем поставить <b>PlugManX</b> — тогда плагины можно обновлять и выключать без перезапуска.
        </template>
      </div>

      <div class="pl-tools">
        <input v-model="filter" class="adm-input pl-filter" placeholder="Поиск плагина" />
        <span class="pl-meta">{{ data.enabled.length }} включено · {{ data.disabled.length }} выключено</span>
      </div>

      <div class="adm-table-wrap">
        <div class="adm-table-scroll">
          <table class="adm-table">
            <thead><tr><th>Плагин</th><th>Версия</th><th>Нужны</th><th>Файл</th><th /></tr></thead>
            <tbody>
              <tr v-for="p in enabled" :key="p.filename">
                <td>
                  <div class="pl-name">{{ p.name || p.filename }}</div>
                  <div v-if="p.error" class="pl-err">{{ p.error }}</div>
                  <div v-else-if="p.authors?.length" class="pl-meta">{{ p.authors.join(', ') }}</div>
                </td>
                <td class="pl-num">{{ p.version }}</td>
                <td>
                  <span v-for="d in p.depend" :key="d" class="pl-dep" :class="{ 'pl-dep--missing': !installedNames.has(d.toLowerCase()) }">{{ d }}</span>
                </td>
                <td class="pl-meta">{{ p.filename }} · {{ size(p.size) }}</td>
                <td class="pl-acts">
                  <button v-if="p.config_folder && canFiles" class="adm-btn adm-btn--sm" @click="openConfig(p)">Настройки</button>
                  <button v-if="canManage" class="adm-btn adm-btn--sm" @click="change(p, 'disable')">Выключить</button>
                  <button v-if="canManage" class="adm-btn adm-btn--sm adm-btn--danger" @click="change(p, 'remove')">Удалить</button>
                </td>
              </tr>
              <tr v-for="p in disabled" :key="'d-' + p.filename" class="pl-off">
                <td><div class="pl-name">{{ p.name || p.filename }} <span class="adm-badge">выключен</span></div></td>
                <td class="pl-num">{{ p.version }}</td>
                <td />
                <td class="pl-meta">disabled/{{ p.filename }}</td>
                <td class="pl-acts">
                  <button v-if="canManage" class="adm-btn adm-btn--sm adm-btn--ok" @click="change(p, 'enable')">Включить</button>
                  <button v-if="canManage" class="adm-btn adm-btn--sm adm-btn--danger" @click="change(p, 'remove')">Удалить</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-if="data.updates.length" class="pl-meta pl-updates">
        Ждут перезапуска в plugins/update/: {{ data.updates.map((u) => `${u.name || u.filename} ${u.version || ''}`).join(', ') }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.pl { display: flex; flex-direction: column; gap: 0.9rem; }
.pl-drop { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; border-style: dashed; }
.pl-drop--over { border-color: rgba(var(--adm-acc-rgb), 0.8); background: rgba(var(--adm-acc-rgb), 0.06); }
.pl-drop b { color: var(--adm-text); }
.pl-sub { font-size: 0.78rem; color: var(--adm-dim); margin-top: 0.2rem; }
.pl-stage { display: flex; flex-direction: column; gap: 0.5rem; }
.pl-stage__title { font-weight: 800; color: var(--adm-text); }
.pl-stage__row { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.4rem; border-radius: 8px; cursor: pointer; }
.pl-stage__row:hover { background: rgba(148, 163, 184, 0.05); }
.pl-stage__row--bad { opacity: 0.8; cursor: default; }
.pl-stage__info { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.84rem; color: var(--adm-text); }
.pl-stage__acts { display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; }
.pl-note { font-size: 0.78rem; color: var(--adm-dim); }
.pl-note--new { color: #6ee7b7; }
.pl-warn { font-size: 0.78rem; color: #fde68a; }
.pl-err { font-size: 0.78rem; color: #f87171; }
.pl-plugman { font-size: 0.8rem; color: var(--adm-dim); background: rgba(250, 204, 21, 0.07); border-radius: 8px; padding: 0.5rem 0.7rem; }
.pl-plugman--ok { background: rgba(34, 197, 94, 0.08); color: #bbf7d0; }
.pl-plugman b { color: var(--adm-text); }
.pl-tools { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
.pl-filter { flex: 0 1 20rem; }
.pl-name { font-weight: 700; color: var(--adm-text); }
.pl-meta { font-size: 0.74rem; color: var(--adm-faint); }
.pl-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.pl-dep { display: inline-block; font-size: 0.7rem; padding: 0.05rem 0.4rem; margin: 0 0.2rem 0.2rem 0; border-radius: 999px; border: 1px solid var(--adm-line); color: var(--adm-dim); }
.pl-dep--missing { border-color: rgba(239, 68, 68, 0.6); color: #fca5a5; }
.pl-acts { display: flex; gap: 0.35rem; justify-content: flex-end; flex-wrap: nowrap; white-space: nowrap; }
.pl-off td { opacity: 0.7; }
.pl-updates { padding: 0 0.2rem; }
</style>
