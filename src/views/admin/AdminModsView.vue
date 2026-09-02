<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getMods,
  uploadMods,
  applyMods,
  updateModMeta,
  setModTargets,
  removeMod,
  regenerateManifest,
  getManifestJobStatus,
} from '../../services/adminModsApi.js'
import { serverPowerAction } from '../../services/adminServerOpsApi.js'
import { authState, hasPermission } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { toastError, toastSuccess, toastInfo } from '../../services/toast'
import { confirmDialog } from '../../composables/useConfirm'

const token = () => authState.accessToken
const canManage = hasPermission('mods.manage')
const canRestart = hasPermission('monitoring.restart')
const serverName = computed(() => activeServer.value?.name || 'сервер')
// Partner (external) server: its game host is on someone else's machine, so we can't put
// mods into its server-side mods folder or restart it — only the client pack is ours.
const isExternal = computed(() => !!activeServer.value?.is_external)

// ── State ─────────────────────────────────────────────────────────────────────
const data = ref(null)
const loading = ref(true)
const err = ref('')
const filter = ref('')
const showFilter = ref('all') // all | client | server | optional
const needsRegen = ref(false)  // a client-affecting change happened since last rebuild

const mods = computed(() => data.value?.mods || [])
const counts = computed(() => data.value?.counts || {})
const serverDirAvailable = computed(() => data.value?.server_dir_available !== false)

const filtered = computed(() => {
  const f = filter.value.trim().toLowerCase()
  return mods.value.filter((m) => {
    if (showFilter.value === 'client' && !m.on_client) return false
    if (showFilter.value === 'server' && !m.on_server) return false
    if (showFilter.value === 'optional' && !m.optional) return false
    if (!f) return true
    return m.filename.toLowerCase().includes(f) || (m.display_name || '').toLowerCase().includes(f)
  })
})

function fmtBytes(n) {
  if (n == null) return '—'
  const u = ['Б', 'КБ', 'МБ', 'ГБ']
  let i = 0; let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}

async function load() {
  loading.value = true
  err.value = ''
  try {
    data.value = await getMods(token())
  } catch (e) {
    err.value = e?.message || 'Ошибка загрузки списка модов'
  } finally {
    loading.value = false
  }
}

// ── Upload → staging → apply ──────────────────────────────────────────────────
const fileInput = ref(null)
const uploadBusy = ref(false)
const uploadPct = ref(0)
const uploadInfo = ref('')
const applyBusy = ref(false)
const staging = ref(null) // { token, files: [ {filename, size, on_client, on_server, optional, required, display_name, description} ] }

function pickFiles() { fileInput.value?.click() }

async function onFiles(ev) {
  const list = Array.from(ev.target?.files || [])
  ev.target.value = '' // allow re-selecting the same files
  await handleFiles(list)
}
async function onDrop(ev) {
  const list = Array.from(ev.dataTransfer?.files || [])
  await handleFiles(list)
}

async function handleFiles(list) {
  const jars = list.filter((f) => f.name.toLowerCase().endsWith('.jar'))
  if (!jars.length) { toastError('Выберите .jar файлы'); return }
  if (jars.length !== list.length) toastInfo('Не-.jar файлы пропущены')
  uploadBusy.value = true
  uploadPct.value = 0
  uploadInfo.value = `${jars.length} файл(ов) · ${fmtBytes(jars.reduce((s, f) => s + f.size, 0))}`
  try {
    const res = await uploadMods(token(), jars, (pct, loaded, total) => {
      uploadPct.value = pct
      uploadInfo.value = `${fmtBytes(loaded)} / ${fmtBytes(total)}`
    })
    staging.value = {
      token: res.token,
      files: (res.files || []).map((f) => ({
        filename: f.filename,
        size: f.size,
        on_client: true,
        on_server: true,
        optional: false,
        required: false,
        display_name: '',
        description: '',
      })),
    }
  } catch (e) {
    toastError(e?.message || 'Не удалось загрузить файлы')
  } finally {
    uploadBusy.value = false
  }
}

function cancelStaging() { staging.value = null }

async function applyStaging() {
  if (!staging.value) return
  const selections = staging.value.files.map((f) => ({
    filename: f.filename,
    on_client: f.on_client,
    on_server: f.on_server,
    optional: f.optional,
    required: f.optional && f.required,
    display_name: f.display_name || null,
    description: f.description || null,
  }))
  if (selections.every((s) => !s.on_client && !s.on_server)) {
    toastError('Отметьте хотя бы одну цель (клиент или сервер) хотя бы у одного мода')
    return
  }
  applyBusy.value = true
  try {
    const res = await applyMods(token(), staging.value.token, selections)
    toastSuccess(`Добавлено модов: ${res.count}`)
    staging.value = null
    if (selections.some((s) => s.on_client)) needsRegen.value = true
    await load()
  } catch (e) {
    toastError(e?.message || 'Не удалось применить')
  } finally {
    applyBusy.value = false
  }
}

// ── Toggle client/server on an existing mod ──────────────────────────────────
async function toggleTarget(mod, which) {
  if (which === 'on_server' && isExternal.value) return   // external: no server-side mods
  const next = { on_client: mod.on_client, on_server: mod.on_server }
  next[which] = !next[which]
  if (!next.on_client && !next.on_server) {
    // Turning off the last target = full delete → confirm & route through delete.
    return del(mod)
  }
  if (which === 'on_server' && next.on_server && !serverDirAvailable.value) {
    toastError('Папка серверных модов недоступна для этого сервера')
    return
  }
  try {
    await setModTargets(token(), mod.filename, next.on_client, next.on_server)
    mod.on_client = next.on_client
    mod.on_server = next.on_server
    if (which === 'on_client') needsRegen.value = true
    toastSuccess(`${mod.filename}: обновлено`)
  } catch (e) {
    toastError(e?.message || 'Не удалось изменить')
  }
}

// ── Edit metadata (optional/required/name/desc) ──────────────────────────────
const editItem = ref(null)
function openEdit(mod) {
  editItem.value = {
    filename: mod.filename,
    optional: mod.optional,
    required: mod.required,
    display_name: mod.display_name || '',
    description: mod.description || '',
  }
}
const editBusy = ref(false)
async function saveEdit() {
  if (!editItem.value) return
  editBusy.value = true
  try {
    await updateModMeta(token(), editItem.value.filename, {
      optional: editItem.value.optional,
      required: editItem.value.optional && editItem.value.required,
      display_name: editItem.value.display_name || null,
      description: editItem.value.description || null,
    })
    toastSuccess('Сохранено. Не забудьте пересобрать манифест.')
    needsRegen.value = true
    editItem.value = null
    await load()
  } catch (e) {
    toastError(e?.message || 'Не удалось сохранить')
  } finally {
    editBusy.value = false
  }
}

// ── Delete (soft → trash) ────────────────────────────────────────────────────
async function del(mod) {
  const ok = await confirmDialog({
    title: 'Удалить мод',
    message: `Удалить «${mod.filename}» с ${mod.on_client && mod.on_server ? 'клиента и сервера' : mod.on_client ? 'клиента' : 'сервера'}? Файл переместится в корзину (можно восстановить).`,
    confirmLabel: 'Удалить',
    danger: true,
  })
  if (!ok) return
  try {
    await removeMod(token(), mod.filename, 'both')
    if (mod.on_client) needsRegen.value = true
    toastSuccess(`Удалено: ${mod.filename}`)
    await load()
  } catch (e) {
    toastError(e?.message || 'Не удалось удалить')
  }
}

// ── Footer actions: rebuild manifest (live console modal) + restart server ───
const buildOpen = ref(false)
const buildLog = ref('')
const buildPercent = ref(0)
const buildState = ref('running') // running | success | error
const buildError = ref('')
const buildServer = ref('')
const consoleEl = ref(null)
let buildTimer = null

const regenRunning = computed(() => buildOpen.value && buildState.value === 'running')

function stopBuildPolling() {
  if (buildTimer) { clearInterval(buildTimer); buildTimer = null }
}
function closeBuildModal() {
  if (buildState.value === 'running') return // не закрываем во время сборки
  stopBuildPolling()
  buildOpen.value = false
}

async function pollBuild() {
  try {
    const s = await getManifestJobStatus(token())
    buildLog.value = s.log || ''
    buildPercent.value = s.percent ?? 0
    buildState.value = s.state || (s.running ? 'running' : 'success')
    buildError.value = s.error || ''
    await nextTick()
    if (consoleEl.value) consoleEl.value.scrollTop = consoleEl.value.scrollHeight
    if (!s.running) {
      stopBuildPolling()
      if (buildState.value === 'success') {
        needsRegen.value = false
        buildPercent.value = 100
      }
    }
  } catch (e) {
    buildError.value = e?.message || 'Ошибка получения статуса'
  }
}

async function regen() {
  // Окно открывается сразу — сборка идёт в фоне, лог/проценты тянем поллингом.
  buildOpen.value = true
  buildServer.value = serverName.value
  buildLog.value = ''
  buildPercent.value = 0
  buildError.value = ''
  buildState.value = 'running'
  try {
    const s = await regenerateManifest(token())
    buildState.value = s.state || 'running'
  } catch (e) {
    // 409 = сборка уже идёт — просто подключаемся к ней поллингом.
    if (!/уже идёт|409/i.test(e?.message || '')) {
      buildState.value = 'error'
      buildError.value = e?.message || 'Не удалось запустить пересборку'
      return
    }
  }
  stopBuildPolling()
  await pollBuild()
  buildTimer = setInterval(pollBuild, 700)
}

const restartBusy = ref(false)
async function restartServer() {
  const ok = await confirmDialog({
    title: 'Перезапустить сервер',
    message: `Перезапустить «${serverName.value}»? Все игроки будут отключены на время перезапуска. Нужно, чтобы серверные моды применились.`,
    confirmLabel: 'Перезапустить',
    danger: true,
  })
  if (!ok) return
  restartBusy.value = true
  try {
    await serverPowerAction(token(), 'restart')
    toastSuccess('Перезапуск: команда отправлена')
  } catch (e) {
    toastError(e?.message || 'Не удалось перезапустить')
  } finally {
    restartBusy.value = false
  }
}

onMounted(load)
onBeforeUnmount(stopBuildPolling)
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Моды · {{ serverName }}</h1>
        <p class="adm-sub">Управление модами клиента и сервера выбранного сервера</p>
      </div>
      <div class="adm-head-actions">
        <button v-if="canManage" class="adm-btn adm-btn--acc" :disabled="regenRunning" @click="regen">
          {{ regenRunning ? 'Сборка…' : 'Пересобрать манифест' }}
        </button>
        <button v-if="canManage && canRestart && !isExternal" class="adm-btn adm-btn--danger" :disabled="restartBusy" @click="restartServer">
          Перезапустить сервер
        </button>
      </div>
    </div>

    <!-- предупреждение о пересборке -->
    <div v-if="needsRegen" class="mods-warn">
      Клиентские моды изменены — <b>пересоберите манифест</b>, чтобы игроки получили обновление.
      <template v-if="!isExternal">Серверные моды применятся только после <b>перезапуска сервера</b>.</template>
    </div>

    <div v-if="err" class="adm-empty"><div class="adm-empty__title">{{ err }}</div></div>

    <!-- ── Загрузка ────────────────────────────────────────────────── -->
    <div v-if="canManage" class="adm-card adm-card--pad mods-upload">
      <input ref="fileInput" type="file" accept=".jar" multiple hidden @change="onFiles" />
      <div v-if="!staging && uploadBusy" class="mods-uploading">
        <div class="mods-uploading__top">
          <span>{{ uploadPct >= 100 ? 'Обработка на сервере…' : `Загрузка… ${uploadPct}%` }}</span>
          <span class="mods-dim">{{ uploadInfo }}</span>
        </div>
        <div class="mods-bar"><span class="mods-bar__fill" :class="{ 'is-indeterminate': uploadPct >= 100 }" :style="{ width: uploadPct + '%' }" /></div>
      </div>
      <div v-else-if="!staging" class="mods-drop" @click="pickFiles" @dragover.prevent @drop.prevent="onDrop">
        <div class="mods-drop__icon">＋</div>
        <div class="mods-drop__title">Перетащите .jar сюда или нажмите</div>
        <div class="mods-drop__sub">Можно несколько файлов сразу. Дальше выберете, куда ставить.</div>
      </div>

      <!-- staging: предпросмотр загруженной пачки -->
      <div v-else class="mods-stage">
        <div class="mods-stage__head">
          <h3 class="adm-card__title">Новые моды ({{ staging.files.length }})</h3>
          <div class="mods-stage__actions">
            <button class="adm-btn" @click="cancelStaging">Отмена</button>
            <button class="adm-btn adm-btn--ok" :disabled="applyBusy" @click="applyStaging">
              {{ applyBusy ? 'Применение…' : 'Применить' }}
            </button>
          </div>
        </div>
        <div class="mods-stage__list">
          <div v-for="f in staging.files" :key="f.filename" class="mods-stage__row">
            <div class="mods-stage__name adm-mono" :title="f.filename">
              {{ f.filename }} <span class="mods-dim">· {{ fmtBytes(f.size) }}</span>
            </div>
            <div class="mods-stage__flags">
              <label class="adm-check"><input v-model="f.on_client" type="checkbox" /> клиент</label>
              <label class="adm-check"><input v-model="f.on_server" type="checkbox" :disabled="!serverDirAvailable" /> сервер</label>
              <label class="adm-check"><input v-model="f.optional" type="checkbox" /> опциональный</label>
              <label class="adm-check" :class="{ 'is-disabled': !f.optional }">
                <input v-model="f.required" type="checkbox" :disabled="!f.optional" /> нельзя откл.
              </label>
              <input v-model="f.display_name" class="adm-input adm-input--sm" placeholder="Название (для лаунчера)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Список модов ─────────────────────────────────────────────── -->
    <div class="adm-card mods-list">
      <div class="adm-card__head mods-list__head">
        <div class="mods-counts">
          <span class="adm-badge">всего {{ counts.total ?? '—' }}</span>
          <span class="adm-badge adm-badge--info">клиент {{ counts.client ?? '—' }}</span>
          <span class="adm-badge adm-badge--acc">сервер {{ counts.server ?? '—' }}</span>
          <span class="adm-badge adm-badge--ok">опциональных {{ counts.optional ?? '—' }}</span>
        </div>
        <div class="mods-tools">
          <div class="adm-tabs">
            <button class="adm-tab" :class="{ 'adm-tab--active': showFilter === 'all' }" @click="showFilter = 'all'">Все</button>
            <button class="adm-tab" :class="{ 'adm-tab--active': showFilter === 'client' }" @click="showFilter = 'client'">Клиент</button>
            <button class="adm-tab" :class="{ 'adm-tab--active': showFilter === 'server' }" @click="showFilter = 'server'">Сервер</button>
            <button class="adm-tab" :class="{ 'adm-tab--active': showFilter === 'optional' }" @click="showFilter = 'optional'">Опц.</button>
          </div>
          <input v-model="filter" class="adm-input adm-input--sm" placeholder="поиск…" />
        </div>
      </div>

      <div v-if="loading" class="adm-empty"><div class="adm-empty__title">Загрузка…</div></div>
      <div v-else-if="!filtered.length" class="adm-empty"><div class="adm-empty__title">Ничего не найдено</div></div>

      <table v-else class="adm-table mods-table">
        <thead>
          <tr>
            <th>Файл</th>
            <th class="mods-c">Клиент</th>
            <th class="mods-c">Сервер</th>
            <th>Тип</th>
            <th class="mods-c">Размер</th>
            <th v-if="canManage"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in filtered" :key="m.filename">
            <td>
              <div class="mods-name adm-mono">{{ m.filename }}</div>
              <div v-if="m.display_name" class="mods-dim">{{ m.display_name }}</div>
            </td>
            <td class="mods-c">
              <button class="mods-dot" :class="m.on_client ? 'is-on' : 'is-off'"
                      :disabled="!canManage" @click="toggleTarget(m, 'on_client')" :title="m.on_client ? 'На клиенте — нажмите чтобы убрать' : 'Нет на клиенте — нажмите чтобы добавить'">
                {{ m.on_client ? '✓' : '—' }}
              </button>
            </td>
            <td class="mods-c">
              <button class="mods-dot" :class="m.on_server ? 'is-on' : 'is-off'"
                      :disabled="!canManage || isExternal"
                      @click="toggleTarget(m, 'on_server')"
                      :title="isExternal ? 'Внешний сервер — серверные моды не ставятся (чужой хост)' : (m.on_server ? 'На сервере — нажмите чтобы убрать' : 'Нет на сервере — нажмите чтобы добавить')">
                {{ isExternal ? '·' : (m.on_server ? '✓' : '—') }}
              </button>
            </td>
            <td>
              <span v-if="m.optional && m.required" class="adm-badge adm-badge--warn">обязательный</span>
              <span v-else-if="m.optional" class="adm-badge adm-badge--ok">опциональный</span>
              <span v-else class="adm-badge">скрытый</span>
              <span v-if="m.source === 'override'" class="mods-ovr" title="Задано вручную">●</span>
            </td>
            <td class="mods-c mods-dim">{{ fmtBytes(m.size) }}</td>
            <td v-if="canManage" class="mods-acts">
              <button class="adm-btn adm-btn--sm" @click="openEdit(m)">Изм.</button>
              <button class="adm-btn adm-btn--sm adm-btn--danger" @click="del(m)">Удал.</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Модалка редактирования метаданных ────────────────────────── -->
    <div v-if="editItem" class="adm-modal-backdrop" @click.self="editItem = null">
      <div class="adm-modal mods-edit">
        <h3 class="adm-card__title mods-edit__title">{{ editItem.filename }}</h3>
        <label class="adm-check"><input v-model="editItem.optional" type="checkbox" /> Опциональный (виден в списке модов лаунчера)</label>
        <label class="adm-check" :class="{ 'is-disabled': !editItem.optional }">
          <input v-model="editItem.required" type="checkbox" :disabled="!editItem.optional" /> Нельзя отключить (обязательный)
        </label>
        <label class="mods-field">
          <span>Название</span>
          <input v-model="editItem.display_name" class="adm-input" placeholder="Название для лаунчера" />
        </label>
        <label class="mods-field">
          <span>Описание</span>
          <textarea v-model="editItem.description" class="adm-input" rows="3" placeholder="Короткое описание"></textarea>
        </label>
        <div class="mods-edit__actions">
          <button class="adm-btn" @click="editItem = null">Отмена</button>
          <button class="adm-btn adm-btn--ok" :disabled="editBusy" @click="saveEdit">Сохранить</button>
        </div>
      </div>
    </div>

    <!-- ── Пересборка манифеста: живой лог + прогресс ────────────────── -->
    <div v-if="buildOpen" class="adm-modal-backdrop" @click.self="closeBuildModal">
      <div class="adm-modal mfb">
        <div class="mfb__head">
          <div class="mfb__head-l">
            <h3 class="adm-card__title">Сборка манифеста</h3>
            <p class="adm-sub mfb__server">{{ buildServer }}</p>
          </div>
          <span class="mfb__state" :class="'mfb__state--' + buildState">
            <span class="mfb__dot" />
            <template v-if="buildState === 'running'">Сборка…</template>
            <template v-else-if="buildState === 'success'">Готово</template>
            <template v-else>Ошибка</template>
          </span>
        </div>

        <div class="mfb__bar">
          <div
            class="mfb__bar-fill"
            :class="{ 'is-err': buildState === 'error', 'is-ok': buildState === 'success' }"
            :style="{ width: buildPercent + '%' }"
          />
        </div>
        <div class="mfb__pct adm-num">{{ buildPercent }}%</div>

        <pre ref="consoleEl" class="mfb__console">{{ buildLog || 'Запуск пересборки…' }}</pre>

        <div v-if="buildError" class="mfb__err">{{ buildError }}</div>

        <div class="mfb__foot">
          <span v-if="buildState === 'success'" class="adm-sub mfb__hint">Игроки получат изменения при следующем запуске лаунчера.</span>
          <button class="adm-btn adm-btn--acc" :disabled="buildState === 'running'" @click="closeBuildModal">
            {{ buildState === 'running' ? 'Идёт сборка…' : 'Закрыть' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mods-warn {
  padding: 0.7rem 1rem; border-radius: var(--adm-r-sm); font-size: 0.82rem;
  background: var(--adm-warn-soft, rgba(234, 179, 8, 0.1)); border: 1px solid var(--adm-warn); color: var(--adm-warn);
}
.mods-dim { color: var(--adm-dim); font-size: 0.72rem; }

/* upload */
.mods-drop {
  border: 1.5px dashed var(--adm-line); border-radius: var(--adm-r); padding: 1.6rem;
  text-align: center; cursor: pointer; transition: border-color 0.15s, background-color 0.15s;
}
.mods-drop:hover { border-color: var(--adm-acc); background: var(--adm-acc-soft); }
.mods-drop__icon { font-size: 1.6rem; color: var(--adm-acc); }
.mods-drop__title { font-weight: 700; margin-top: 0.3rem; }
.mods-drop__sub { color: var(--adm-dim); font-size: 0.76rem; margin-top: 0.2rem; }

/* upload progress */
.mods-uploading { padding: 0.4rem 0.2rem; }
.mods-uploading__top { display: flex; justify-content: space-between; align-items: baseline; gap: 0.6rem; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.5rem; }
.mods-bar { height: 8px; border-radius: 5px; background: rgba(148, 163, 184, 0.15); overflow: hidden; }
.mods-bar__fill { display: block; height: 100%; border-radius: 5px; background: var(--adm-acc); transition: width 0.2s ease; }
.mods-bar__fill.is-indeterminate { width: 100% !important; animation: mods-pulse 1s ease-in-out infinite; }
@keyframes mods-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

.mods-stage__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
.mods-stage__actions { display: flex; gap: 0.4rem; }
.mods-stage__list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 340px; overflow-y: auto; }
.mods-stage__row { padding: 0.5rem 0.6rem; border: 1px solid var(--adm-line); border-radius: var(--adm-r-sm); }
.mods-stage__name { font-size: 0.78rem; margin-bottom: 0.4rem; word-break: break-all; }
.mods-stage__flags { display: flex; flex-wrap: wrap; gap: 0.7rem; align-items: center; }
.mods-stage__flags .adm-input--sm { flex: 1; min-width: 160px; }

/* list */
.mods-list__head { flex-wrap: wrap; gap: 0.6rem; }
.mods-counts { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.mods-tools { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.adm-input--sm { width: 160px; padding: 0.32rem 0.55rem; font-size: 0.78rem; }
.mods-table th.mods-c, .mods-table td.mods-c { text-align: center; width: 1%; white-space: nowrap; }
.mods-name { font-size: 0.78rem; word-break: break-all; }
.mods-acts { display: flex; gap: 0.3rem; justify-content: flex-end; }
.adm-check.is-disabled { opacity: 0.45; }
.mods-ovr { color: var(--adm-acc); margin-left: 0.3rem; font-size: 0.7rem; }

.mods-dot {
  width: 1.7rem; height: 1.7rem; border-radius: 50%; border: 1px solid var(--adm-line);
  font-weight: 800; cursor: pointer; transition: all 0.12s; background: transparent; color: var(--adm-dim);
}
.mods-dot.is-on { background: var(--adm-ok-soft, rgba(34,197,94,0.15)); border-color: var(--adm-ok); color: var(--adm-ok); }
.mods-dot.is-off { color: var(--adm-faint); }
.mods-dot:disabled { cursor: default; opacity: 0.7; }

/* edit modal — .adm-modal (global) provides the centered box; these lay out its content */
.mods-edit { display: flex; flex-direction: column; gap: 0.7rem; max-width: 460px; }
.mods-edit__title { word-break: break-all; }
.mods-field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.76rem; color: var(--adm-dim); }
.mods-edit__actions { display: flex; justify-content: flex-end; gap: 0.4rem; margin-top: 0.3rem; }

/* ── Модалка пересборки манифеста (на глобальном .adm-modal) ─────────── */
.mfb { max-width: 820px; display: flex; flex-direction: column; gap: 0.7rem; }
.mfb__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.mfb__head-l { min-width: 0; }
.mfb__server { margin-top: 0.15rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.mfb__state { display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0; font-size: 0.76rem; font-weight: 800; }
.mfb__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--adm-acc); }
.mfb__state--running { color: var(--adm-acc-text); }
.mfb__state--running .mfb__dot { animation: mfb-pulse 1s ease-in-out infinite; }
.mfb__state--success { color: var(--adm-ok, #34d399); }
.mfb__state--success .mfb__dot { background: var(--adm-ok, #34d399); }
.mfb__state--error { color: var(--adm-err, #f87171); }
.mfb__state--error .mfb__dot { background: var(--adm-err, #f87171); }
@keyframes mfb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.mfb__bar { height: 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.12); overflow: hidden; }
.mfb__bar-fill {
  height: 100%; width: 0; border-radius: 4px; background: var(--adm-acc);
  transition: width 0.35s ease;
}
.mfb__bar-fill.is-ok { background: var(--adm-ok, #34d399); }
.mfb__bar-fill.is-err { background: var(--adm-err, #f87171); }
.mfb__pct { align-self: flex-end; margin-top: -0.3rem; font-size: 0.78rem; font-weight: 800; color: var(--adm-text); }

.mfb__console {
  min-height: 240px; max-height: 46vh; overflow-y: auto; margin: 0;
  padding: 0.75rem 0.85rem; border-radius: var(--adm-r-sm, 10px);
  background: var(--adm-bg, #06080f); border: 1px solid var(--adm-line);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.72rem; line-height: 1.5; color: var(--adm-mut);
  white-space: pre-wrap; word-break: break-word;
}
.mfb__err {
  padding: 0.5rem 0.7rem; border-radius: var(--adm-r-sm, 8px);
  font-size: 0.76rem; color: var(--adm-err, #f87171); background: rgba(248, 113, 113, 0.08);
}
.mfb__foot { display: flex; align-items: center; justify-content: flex-end; gap: 0.8rem; }
.mfb__hint { margin-right: auto; }
</style>
