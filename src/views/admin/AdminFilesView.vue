<script setup>
import { requestReauth } from '../../stores/securityStore'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { diffLines } from 'diff'
import { authState, hasPermission } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'
import {
  deleteEntry, downloadEntry, getRevision, listFolder, listRevisions, makeFolder, readFile,
  renameEntry, revertRevision, uploadFiles, writeFile,
} from '../../services/filesAdminApi'

// CodeMirror is heavy: loaded when a file is first opened.
const CodeEditor = defineAsyncComponent(() => import('../../components/admin/CodeEditor.vue'))

const token = () => authState.accessToken
const can = {
  edit: hasPermission('files.edit'),
  upload: hasPermission('files.upload'),
  delete: hasPermission('files.delete'),
}
const serverName = computed(() => activeServer.value?.name || 'сервер')

// ── Folder ───────────────────────────────────────────────────────────────
const folder = ref(null)
const loadingFolder = ref(true)
const filter = ref('')

async function openFolder(path = '') {
  if (!(await leaveFile())) return
  loadingFolder.value = true
  try {
    folder.value = await listFolder(token(), path)
    filter.value = ''
  } catch (e) {
    toastError(e.message || 'Не удалось открыть папку')
  } finally {
    loadingFolder.value = false
  }
}

const crumbs = computed(() => {
  const parts = (folder.value?.path || '').split('/').filter(Boolean)
  return parts.map((name, i) => ({ name, path: parts.slice(0, i + 1).join('/') }))
})
const entries = computed(() => {
  const f = filter.value.trim().toLowerCase()
  return (folder.value?.entries || []).filter((e) => !f || e.name.toLowerCase().includes(f))
})

function size(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} КБ`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`
  return `${(bytes / 1024 ** 3).toFixed(1)} ГБ`
}
const when = (ts) => new Date(ts * 1000).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const whenIso = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function open(entry) {
  if (entry.type === 'dir') return openFolder(entry.path)
  if (entry.editable && !entry.secret) return openFile(entry.path)
  if (entry.editable && entry.secret) return openFile(entry.path) // allowed only with files.secrets; the API says so otherwise
  return download(entry)
}

// ── File ─────────────────────────────────────────────────────────────────
const file = ref(null) // { path, content, etag, language, masked, size, mtime }
const text = ref('')
const saving = ref(false)
const dirty = computed(() => file.value && text.value !== file.value.content)

// Пароли в конфигах открываются только после ввода пароля от аккаунта (5 минут).
async function revealSecrets() {
  if (!(await requestReauth())) return
  const fresh = await readFile(token(), file.value.path)
  file.value = { ...file.value, ...fresh }
  text.value = fresh.content
}

async function openFile(path) {
  if (!(await leaveFile())) return
  try {
    const f = await readFile(token(), path)
    file.value = f
    text.value = f.content
    history.value = null
    diffView.value = null
  } catch (e) {
    toastError(e.message || 'Не удалось открыть файл')
  }
}

async function leaveFile() {
  if (!dirty.value) return true
  return confirmDialog({
    title: 'Закрыть без сохранения?',
    message: `В «${file.value.path}» есть несохранённые изменения — они пропадут.`,
    confirmLabel: 'Закрыть', danger: true,
  })
}

async function save() {
  if (!file.value || !dirty.value || saving.value || !can.edit) return
  saving.value = true
  try {
    const res = await writeFile(token(), { path: file.value.path, content: text.value, etag: file.value.etag })
    if (res.unchanged) {
      toastSuccess('Изменений нет')
    } else {
      toastSuccess(`Сохранено: +${res.lines_added} −${res.lines_removed}` + (res.running ? '. Применится после перезагрузки плагина или сервера' : ''))
    }
    const fresh = await readFile(token(), file.value.path)
    file.value = fresh
    text.value = fresh.content
    if (history.value) loadHistory()
  } catch (e) {
    toastError(e.message || 'Не удалось сохранить')
  } finally {
    saving.value = false
  }
}

function closeFile() {
  leaveFile().then((ok) => { if (ok) { file.value = null; history.value = null; diffView.value = null } })
}

// ── History ──────────────────────────────────────────────────────────────
const history = ref(null)
const diffView = ref(null) // { rev, parts }

async function loadHistory() {
  try {
    history.value = (await listRevisions(token(), file.value.path)).items
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить историю')
  }
}

async function showDiff(rev) {
  try {
    const r = await getRevision(token(), rev.id)
    diffView.value = { rev, parts: diffLines(r.before || '', r.after) }
  } catch (e) {
    toastError(e.message || 'Не удалось открыть версию')
  }
}

async function revert(rev) {
  const ok = await confirmDialog({
    title: 'Откатить эту правку?',
    message: `Файл вернётся к тому, каким был до правки ${rev.author || '—'} от ${whenIso(rev.at)}. Откат сам попадёт в историю — его можно будет отменить.`,
    confirmLabel: 'Откатить', danger: true,
  })
  if (!ok) return
  try {
    await revertRevision(token(), rev.id)
    toastSuccess('Правка откачена')
    const fresh = await readFile(token(), file.value.path)
    file.value = fresh
    text.value = fresh.content
    diffView.value = null
    loadHistory()
  } catch (e) {
    toastError(e.message || 'Не удалось откатить')
  }
}

// ── Files and folders ────────────────────────────────────────────────────
async function download(entry) {
  try {
    await downloadEntry(token(), entry.path, entry.type === 'dir' ? `${entry.name}.zip` : entry.name)
  } catch (e) {
    toastError(e.message || 'Не удалось скачать')
  }
}

const newName = ref(null) // { kind: 'dir'|'file'|'rename', entry?, value }
function startNew(kind) { newName.value = { kind, value: '' } }
function startRename(entry) { newName.value = { kind: 'rename', entry, value: entry.name } }

async function submitName() {
  const n = newName.value
  const name = (n?.value || '').trim()
  if (!name) return
  try {
    if (n.kind === 'dir') {
      await makeFolder(token(), folder.value.path, name)
      toastSuccess('Папка создана')
    } else if (n.kind === 'file') {
      const path = folder.value.path ? `${folder.value.path}/${name}` : name
      await writeFile(token(), { path, content: '', create: true })
      toastSuccess('Файл создан')
      newName.value = null
      await openFolder(folder.value.path)
      return openFile(path)
    } else {
      await renameEntry(token(), n.entry.path, name)
      toastSuccess('Переименовано')
    }
    newName.value = null
    await openFolder(folder.value.path)
  } catch (e) {
    toastError(e.message || 'Не получилось')
  }
}

async function remove(entry) {
  const ok = await confirmDialog({
    title: entry.type === 'dir' ? `Удалить папку «${entry.name}»?` : `Удалить «${entry.name}»?`,
    message: entry.type === 'dir' ? 'Папка удалится со всем содержимым. Вернуть можно только из бэкапа.' : 'Файл удалится с диска. Вернуть можно только из бэкапа.',
    confirmLabel: 'Удалить', danger: true,
  })
  if (!ok) return
  try {
    await deleteEntry(token(), entry.path)
    toastSuccess('Удалено')
    if (file.value?.path === entry.path) file.value = null
    await openFolder(folder.value.path)
  } catch (e) {
    toastError(e.message || 'Не удалось удалить')
  }
}

// Upload: button or drop onto the list.
const uploading = ref(null)
const dragOver = ref(false)
const picker = ref(null)
async function upload(fileList) {
  if (!fileList?.length || !can.upload) return
  const names = new Set((folder.value?.entries || []).map((e) => e.name))
  const clash = [...fileList].filter((f) => names.has(f.name)).map((f) => f.name)
  let overwrite = false
  if (clash.length) {
    overwrite = await confirmDialog({
      title: 'Заменить существующие?',
      message: `Уже есть: ${clash.join(', ')}. Заменить их загружаемыми?`,
      confirmLabel: 'Заменить', danger: true,
    })
    if (!overwrite) return
  }
  uploading.value = 0
  try {
    const res = await uploadFiles(token(), folder.value.path, fileList, { overwrite, onProgress: (p) => { uploading.value = p } })
    toastSuccess(`Загружено: ${res.saved.length}`)
    await openFolder(folder.value.path)
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить')
  } finally {
    uploading.value = null
  }
}
function onDrop(e) {
  dragOver.value = false
  upload(e.dataTransfer?.files)
}

// ── Leaving with unsaved text ────────────────────────────────────────────
function beforeUnload(e) { if (dirty.value) { e.preventDefault(); e.returnValue = '' } }
const route = useRoute()
// ?path= opens a folder straight away (e.g. a plugin's settings from «Моды и плагины»).
onMounted(() => { openFolder(typeof route.query.path === 'string' ? route.query.path : ''); window.addEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave(() => leaveFile())
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1 class="adm-title">Файлы</h1>
        <p class="adm-sub">Папка сервера «{{ serverName }}» · конфиги правятся с историей и проверкой, моды и плагины — в разделе «Моды и плагины»</p>
      </div>
    </div>

    <div class="fm" :class="{ 'fm--open': !!file }">
      <!-- Folder -->
      <section
        class="adm-card fm-list"
        :class="{ 'fm-list--drop': dragOver }"
        @dragover.prevent="dragOver = can.upload"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
      >
        <div class="fm-bar">
          <nav class="fm-crumbs">
            <button class="fm-crumb" @click="openFolder('')">{{ folder?.root || 'сервер' }}</button>
            <template v-for="c in crumbs" :key="c.path">
              <span class="fm-sep">/</span>
              <button class="fm-crumb" @click="openFolder(c.path)">{{ c.name }}</button>
            </template>
          </nav>
          <span v-if="folder?.running" class="adm-badge adm-badge--ok" title="Сервер запущен">запущен</span>
        </div>
        <div class="fm-tools">
          <input v-model="filter" class="adm-input fm-filter" placeholder="Фильтр по имени" />
          <template v-if="can.upload">
            <button class="adm-btn adm-btn--sm" @click="startNew('dir')">Папка</button>
            <button v-if="can.edit" class="adm-btn adm-btn--sm" @click="startNew('file')">Файл</button>
            <button class="adm-btn adm-btn--sm adm-btn--acc" :disabled="uploading !== null" @click="picker.click()">
              {{ uploading !== null ? `Загрузка ${uploading}%` : 'Загрузить' }}
            </button>
            <input ref="picker" type="file" multiple hidden @change="upload($event.target.files); $event.target.value = ''" />
          </template>
        </div>
        <form v-if="newName" class="fm-name" @submit.prevent="submitName">
          <input v-model="newName.value" class="adm-input" autofocus
                 :placeholder="newName.kind === 'dir' ? 'Имя папки' : newName.kind === 'file' ? 'Имя файла, например config.yml' : 'Новое имя'" />
          <button class="adm-btn adm-btn--sm adm-btn--acc" type="submit">{{ newName.kind === 'rename' ? 'Переименовать' : 'Создать' }}</button>
          <button class="adm-btn adm-btn--sm" type="button" @click="newName = null">Отмена</button>
        </form>

        <div v-if="loadingFolder" class="adm-skel" style="height: 240px" />
        <div v-else class="fm-rows">
          <button v-if="folder && folder.parent !== null" class="fm-row" @click="openFolder(folder.parent)">
            <span class="fm-ico">↩</span><span class="fm-name-cell">..</span>
          </button>
          <div v-for="e in entries" :key="e.path" class="fm-row" :class="{ 'fm-row--open': file?.path === e.path }" @click="open(e)">
            <span class="fm-ico">{{ e.type === 'dir' ? '📁' : e.secret ? '🔒' : e.editable ? '📄' : '📦' }}</span>
            <span class="fm-name-cell" :title="e.path">{{ e.name }}<span v-if="e.link" class="fm-link">↪</span></span>
            <span class="fm-meta">{{ e.type === 'dir' ? '' : size(e.size) }}</span>
            <span class="fm-meta fm-when">{{ e.mtime ? when(e.mtime) : '' }}</span>
            <span class="fm-acts" @click.stop>
              <button class="fm-act" title="Скачать" @click="download(e)">⤓</button>
              <button v-if="can.upload" class="fm-act" title="Переименовать" @click="startRename(e)">✎</button>
              <button v-if="can.delete" class="fm-act fm-act--danger" title="Удалить" @click="remove(e)">✕</button>
            </span>
          </div>
          <div v-if="!entries.length" class="fm-empty">{{ filter ? 'Ничего не нашлось' : 'Папка пуста' }}</div>
        </div>
        <div v-if="can.upload" class="fm-hint">Файлы можно перетащить сюда. Jar модов и плагинов — только через «Моды и плагины».</div>
      </section>

      <!-- File -->
      <section v-if="file" class="adm-card fm-editor">
        <div class="fm-bar">
          <div class="fm-file">
            <b>{{ file.path.split('/').pop() }}</b>
            <span class="fm-meta">{{ file.path }} · {{ size(file.size) }} · {{ file.language }}</span>
          </div>
          <div class="fm-file-acts">
            <button class="adm-btn adm-btn--sm" @click="history ? (history = null, diffView = null) : loadHistory()">{{ history ? 'Скрыть историю' : 'История' }}</button>
            <button v-if="can.edit" class="adm-btn adm-btn--sm adm-btn--acc" :disabled="!dirty || saving" @click="save">
              {{ saving ? 'Сохранение…' : 'Сохранить' }}
            </button>
            <button class="adm-btn adm-btn--sm adm-btn--ghost" @click="closeFile">✕</button>
          </div>
        </div>
        <div v-if="file.masked" class="fm-note">
          Скрыто секретов: {{ file.masked }} (показаны как ••••••••). Оставьте их как есть — при сохранении настоящие значения вернутся на место.
          <button v-if="file.secrets_locked" type="button" class="adm-btn adm-btn--sm fm-reveal" @click="revealSecrets">Показать секреты</button>
        </div>
        <div v-if="file.running && /^(plugins|config|mods)\//.test(file.path)" class="fm-note fm-note--soft">
          Сервер запущен: изменения применятся после перезагрузки плагина или сервера.
        </div>

        <div class="fm-work" :class="{ 'fm-work--split': history }">
          <div class="fm-code">
            <CodeEditor v-model="text" :language="file.language" :readonly="!can.edit" @save="save" />
          </div>
          <aside v-if="history" class="fm-history">
            <div class="fm-history__title">История · последние {{ history.length }}</div>
            <div v-if="!history.length" class="fm-meta">Правок через админку ещё не было.</div>
            <div v-for="r in history" :key="r.id" class="fm-rev" :class="{ 'fm-rev--on': diffView?.rev.id === r.id }">
              <button class="fm-rev__head" @click="showDiff(r)">
                <span>{{ r.author || '—' }}</span>
                <span class="fm-meta">{{ whenIso(r.at) }}</span>
              </button>
              <div class="fm-rev__stat">
                <span class="fm-plus">+{{ r.lines_added }}</span> <span class="fm-minus">−{{ r.lines_removed }}</span>
                <span v-if="r.note" class="fm-meta">· {{ r.note }}</span>
                <span v-if="r.created" class="fm-meta">· создан</span>
              </div>
              <button v-if="can.edit && !r.created" class="adm-btn adm-btn--sm fm-rev__revert" @click="revert(r)">Откатить эту правку</button>
            </div>
            <pre v-if="diffView" class="fm-diff"><span
              v-for="(p, i) in diffView.parts" :key="i"
              :class="p.added ? 'fm-diff--add' : p.removed ? 'fm-diff--del' : 'fm-diff--same'"
            >{{ p.added || p.removed ? p.value : (p.count > 6 ? p.value.split('\n').slice(0, 2).join('\n') + '\n  …\n' + p.value.split('\n').slice(-3).join('\n') : p.value) }}</span></pre>
          </aside>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.fm { display: grid; grid-template-columns: 1fr; gap: 1rem; align-items: start; }
.fm--open { grid-template-columns: minmax(18rem, 34%) 1fr; }
@media (max-width: 1000px) { .fm--open { grid-template-columns: 1fr; } }
.fm-list, .fm-editor { padding: 0.9rem; display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
.fm-list--drop { outline: 2px dashed rgba(var(--adm-acc-rgb), 0.7); outline-offset: -4px; }
.fm-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; min-width: 0; }
.fm-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 0.15rem; min-width: 0; font-size: 0.85rem; }
.fm-crumb { background: none; border: 0; color: var(--adm-text); cursor: pointer; padding: 0.1rem 0.25rem; border-radius: 6px; }
.fm-crumb:hover { background: rgba(148, 163, 184, 0.1); }
.fm-sep { color: var(--adm-faint); }
.fm-tools { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.fm-filter { flex: 1 1 8rem; min-width: 0; }
.fm-name { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.fm-name .adm-input { flex: 1 1 10rem; min-width: 0; }
.fm-rows { display: flex; flex-direction: column; max-height: 68vh; overflow: auto; }
.fm-row {
  display: grid; grid-template-columns: 1.4rem 1fr auto auto auto; align-items: center; gap: 0.5rem;
  padding: 0.35rem 0.4rem; border-radius: 8px; cursor: pointer; font-size: 0.84rem; color: var(--adm-text);
  background: none; border: 0; text-align: left; width: 100%;
}
.fm-row:hover { background: rgba(148, 163, 184, 0.07); }
.fm-row--open { background: rgba(var(--adm-acc-rgb), 0.14); }
.fm-ico { text-align: center; }
.fm-name-cell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.fm-link { margin-left: 0.3rem; color: var(--adm-faint); }
.fm-meta { font-size: 0.72rem; color: var(--adm-faint); white-space: nowrap; font-variant-numeric: tabular-nums; }
.fm--open .fm-when { display: none; }
.fm-acts { display: flex; gap: 0.15rem; opacity: 0; }
.fm-row:hover .fm-acts { opacity: 1; }
@media (hover: none) { .fm-acts { opacity: 1; } }
.fm-act { background: none; border: 0; color: var(--adm-dim); cursor: pointer; padding: 0.1rem 0.3rem; border-radius: 6px; }
.fm-act:hover { background: rgba(148, 163, 184, 0.14); color: var(--adm-text); }
.fm-act--danger:hover { color: #f87171; }
.fm-empty { padding: 1rem; text-align: center; color: var(--adm-faint); font-size: 0.82rem; }
.fm-hint { font-size: 0.72rem; color: var(--adm-faint); }
.fm-file { display: flex; flex-direction: column; min-width: 0; }
.fm-file b { color: var(--adm-text); font-size: 0.95rem; }
.fm-file .fm-meta { overflow: hidden; text-overflow: ellipsis; }
.fm-file-acts { display: flex; gap: 0.4rem; flex-shrink: 0; }
.fm-reveal { margin-left: 0.6rem; }
.fm-note { font-size: 0.78rem; color: #fde68a; background: rgba(250, 204, 21, 0.08); border-radius: 8px; padding: 0.45rem 0.6rem; }
.fm-note--soft { color: var(--adm-dim); background: rgba(148, 163, 184, 0.07); }
.fm-work { display: grid; grid-template-columns: 1fr; gap: 0.8rem; min-height: 60vh; }
.fm-work--split { grid-template-columns: 1fr minmax(16rem, 38%); }
@media (max-width: 1200px) { .fm-work--split { grid-template-columns: 1fr; } }
.fm-code { min-height: 60vh; min-width: 0; display: flex; }
.fm-code > * { flex: 1; }
.fm-history { display: flex; flex-direction: column; gap: 0.5rem; max-height: 72vh; overflow: auto; min-width: 0; }
.fm-history__title { font-weight: 700; font-size: 0.85rem; color: var(--adm-text); }
.fm-rev { border: 1px solid var(--adm-line); border-radius: 8px; padding: 0.45rem 0.55rem; display: flex; flex-direction: column; gap: 0.3rem; }
.fm-rev--on { border-color: rgba(var(--adm-acc-rgb), 0.6); }
.fm-rev__head { display: flex; justify-content: space-between; background: none; border: 0; color: var(--adm-text); cursor: pointer; padding: 0; font-size: 0.82rem; }
.fm-rev__stat { font-size: 0.75rem; }
.fm-plus { color: #4ade80; }
.fm-minus { color: #f87171; }
.fm-rev__revert { align-self: flex-start; }
.fm-diff { margin: 0; font-size: 0.72rem; line-height: 1.45; white-space: pre-wrap; word-break: break-word; background: rgba(148, 163, 184, 0.05); border-radius: 8px; padding: 0.5rem; }
.fm-diff--add { background: rgba(34, 197, 94, 0.15); color: #bbf7d0; display: block; }
.fm-diff--del { background: rgba(239, 68, 68, 0.15); color: #fecaca; display: block; text-decoration: line-through; text-decoration-color: rgba(239, 68, 68, 0.4); }
.fm-diff--same { color: var(--adm-faint); display: block; }
</style>
