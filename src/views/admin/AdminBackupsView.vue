<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'
import AdminSaveBar from '../../components/admin/AdminSaveBar.vue'
import { useUnsavedGuard } from '../../composables/useUnsavedGuard'
import {
  backupsCreate, backupsDelete, backupsList, backupsRestore, backupsSaveSettings,
} from '../../services/backupsAdminApi'

const token = () => authState.accessToken
const canCreate = computed(() => hasPermission('backups.create'))
const canRestore = computed(() => hasPermission('backups.restore'))
const canDelete = computed(() => hasPermission('backups.delete'))
const canSettings = computed(() => hasPermission('backups.settings'))
const serverName = computed(() => activeServer.value?.name || 'сервер')

const data = ref(null)
const loading = ref(true)
const note = ref('')
const creating = ref(false)
const busyId = ref(null)

const KIND = { manual: 'Вручную', scheduled: 'По расписанию', pre_restore: 'Перед откатом' }
const KIND_CLS = { manual: '', scheduled: 'adm-badge--ok', pre_restore: 'adm-badge--warn' }
const WARN_SECONDS = 30

// A backup holds the world as it was when it was made, not when it was queued.
const madeAt = (b) => b?.finished_at || b?.created_at
const dt = (v) => (v ? new Date(v).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')
function size(bytes) {
  if (bytes == null) return '—'
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1)} ГБ`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} МБ`
}
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
function ago(v) {
  if (!v) return ''
  const min = Math.round((Date.now() - new Date(v)) / 60000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} ч назад`
  return `${Math.round(h / 24)} дн назад`
}

const items = computed(() => data.value?.items || [])
const restores = computed(() => data.value?.restores || [])
const activeRestore = computed(() => restores.value.find(r => r.status === 'pending' || r.status === 'running'))
const working = computed(() => items.value.some(b => b.status === 'pending' || b.status === 'running') || !!activeRestore.value)
const doneCount = computed(() => items.value.filter(b => b.status === 'done').length)
const totalSize = computed(() => items.value.reduce((s, b) => s + (b.status === 'done' ? b.size_bytes || 0 : 0), 0))
const byId = computed(() => Object.fromEntries(items.value.map(b => [b.id, b])))
const problems = computed(() => data.value?.server?.problems || [])

// ── Loading, and watching while something is in progress ─────────────────
let timer = null
let inFlight = false
async function load() {
  if (inFlight) return
  inFlight = true
  try {
    data.value = await backupsList(token())
    if (!settingsDirty.value) takeSettings()
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить бэкапы')
  } finally {
    inFlight = false
    loading.value = false
    schedule()
  }
}
function schedule() {
  clearTimeout(timer)
  if (document.hidden) return
  timer = setTimeout(load, working.value ? 3000 : 30000)
}
function onVisibility() {
  if (document.hidden) clearTimeout(timer)
  else load()
}
onMounted(() => {
  load()
  document.addEventListener('visibilitychange', onVisibility)
})
onUnmounted(() => {
  clearTimeout(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})

// ── Actions ──────────────────────────────────────────────────────────────
async function create() {
  creating.value = true
  try {
    await backupsCreate(token(), note.value.trim())
    note.value = ''
    toastSuccess('Бэкап поставлен в очередь — начнётся в течение минуты')
    await load()
  } catch (e) {
    toastError(e.message || 'Не удалось создать бэкап')
  } finally {
    creating.value = false
  }
}

async function restore(b) {
  const ok = await confirmDialog({
    title: 'Откатить мир на этот бэкап?',
    message: `Мир сервера «${serverName.value}» станет таким, каким был ${dt(madeAt(b))}. `
      + `Сначала будет сделан бэкап текущего мира — откат можно будет отменить, откатившись на него. `
      + `Игроков предупредят в чате за ${WARN_SECONDS} с, затем сервер перезапустится (основной сервер загружается ~10 минут).`,
    confirmLabel: 'Откатить',
    danger: true,
  })
  if (!ok) return
  busyId.value = b.id
  try {
    await backupsRestore(token(), b.id, WARN_SECONDS)
    toastSuccess('Откат поставлен в очередь — ход виден вверху страницы')
    await load()
  } catch (e) {
    toastError(e.message || 'Не удалось начать откат')
  } finally {
    busyId.value = null
  }
}

async function remove(b) {
  const ok = await confirmDialog({
    title: 'Удалить бэкап?',
    message: `Бэкап от ${dt(madeAt(b))} (${size(b.size_bytes)}) будет удалён с диска насовсем.`,
    confirmLabel: 'Удалить',
    danger: true,
  })
  if (!ok) return
  busyId.value = b.id
  try {
    await backupsDelete(token(), b.id)
    toastSuccess('Бэкап удалён')
    await load()
  } catch (e) {
    toastError(e.message || 'Не удалось удалить')
  } finally {
    busyId.value = null
  }
}

// ── Schedule ─────────────────────────────────────────────────────────────
const HOURS = [1, 2, 3, 6, 12, 24, 48, 72, 168]
const hoursLabel = (h) => (h < 24 ? `${h} ч` : h === 168 ? 'неделю' : `${h / 24} дн`)
const form = ref({ enabled: false, every_hours: 24, keep: 7 })
const saved = ref({ enabled: false, every_hours: 24, keep: 7 })
const settingsDirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(saved.value))
const savingSettings = ref(false)
function takeSettings() {
  const s = data.value?.settings || {}
  saved.value = { enabled: !!s.enabled, every_hours: s.every_hours || 24, keep: s.keep || 7 }
  form.value = { ...saved.value }
}
useUnsavedGuard(() => settingsDirty.value)
const resetSettings = () => { form.value = { ...saved.value } }

async function saveSettings() {
  savingSettings.value = true
  try {
    const res = await backupsSaveSettings(token(), { ...form.value, keep: Number(form.value.keep) })
    data.value.settings = res.settings
    data.value.settings_updated_by = res.settings_updated_by
    takeSettings()
    toastSuccess('Расписание сохранено')
  } catch (e) {
    toastError(e.message || 'Не удалось сохранить расписание')
  } finally {
    savingSettings.value = false
  }
}
const nextScheduled = computed(() => {
  const s = data.value?.settings
  if (!s?.enabled) return null
  const last = data.value?.last_scheduled_at
  if (!last) return 'в течение минуты'
  const at = new Date(new Date(last).getTime() + s.every_hours * 3600000)
  return at < new Date() ? 'в течение минуты' : dt(at.toISOString())
})

const RESTORE_STATUS = {
  pending: { label: 'ждёт', cls: '' },
  running: { label: 'идёт', cls: 'adm-badge--warn' },
  done: { label: 'готово', cls: 'adm-badge--ok' },
  failed: { label: 'ошибка', cls: 'adm-badge--err' },
}
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1 class="adm-title">Бэкапы</h1>
        <p class="adm-sub">Мир сервера «{{ serverName }}» · откат и удаление бэкапов, расписание</p>
      </div>
    </div>

    <div v-if="loading" class="adm-skel" style="height: 260px" />

    <template v-else-if="data">
      <div v-if="problems.length" class="bk-alert">
        <strong>Для этого сервера бэкапы пока не работают:</strong>
        <span v-for="p in problems" :key="p">{{ p }}</span>
      </div>

      <!-- A restore in progress: the most important thing on the page while it lasts. -->
      <div v-if="activeRestore" class="adm-card adm-card--pad bk-live">
        <div class="bk-live__pulse" />
        <div>
          <div class="bk-live__title">Идёт откат на бэкап от {{ dt(madeAt(byId[activeRestore.backup_id])) }}</div>
          <div class="bk-live__step">{{ activeRestore.step || 'Ждёт исполнителя' }}</div>
          <div class="bk-live__meta">Запустил {{ activeRestore.requested_by || '—' }} · {{ dt(activeRestore.created_at) }}</div>
        </div>
      </div>

      <div class="bk-top">
        <div class="adm-card adm-card--pad bk-create">
          <div class="bk-card-title">Создать бэкап</div>
          <p class="bk-hint">
            Сохраняет миры ({{ (data.server.worlds || []).join(', ') || '—' }}) без остановки сервера:
            запись мира на время архивации приостанавливается.
          </p>
          <div v-if="canCreate" class="bk-row">
            <input v-model="note" class="adm-input bk-note" maxlength="256" placeholder="Подпись, например «перед вайпом энда»" @keyup.enter="create" />
            <button class="adm-btn adm-btn--acc" :disabled="creating || problems.length > 0" @click="create">Создать сейчас</button>
          </div>
          <div class="bk-stats">
            <span><b>{{ doneCount }}</b> {{ plural(doneCount, 'бэкап', 'бэкапа', 'бэкапов') }} · {{ size(totalSize) }}</span>
            <span v-if="data.storage.free != null">на диске свободно {{ size(data.storage.free) }} из {{ size(data.storage.total) }}</span>
          </div>
        </div>

        <div class="adm-card adm-card--pad bk-schedule">
          <div class="bk-card-title">Расписание</div>
          <label class="bk-toggle">
            <input v-model="form.enabled" type="checkbox" :disabled="!canSettings" />
            <span>Делать бэкапы автоматически</span>
          </label>
          <div class="bk-row">
            <label class="bk-field">
              <span>каждые</span>
              <select v-model.number="form.every_hours" class="adm-input" :disabled="!canSettings || !form.enabled">
                <option v-for="h in HOURS" :key="h" :value="h">{{ hoursLabel(h) }}</option>
              </select>
            </label>
            <label class="bk-field">
              <span>хранить последних</span>
              <input v-model.number="form.keep" type="number" min="1" max="100" class="adm-input bk-num" :disabled="!canSettings || !form.enabled" />
            </label>
          </div>
          <p class="bk-hint">
            Лишние удаляются сами — только сделанные по расписанию; ручные и «перед откатом» остаются, пока их не удалят.
            <template v-if="nextScheduled"><br>Следующий: {{ nextScheduled }}.</template>
          </p>
          <div v-if="canSettings" class="bk-row">
            <span v-if="data.settings_updated_by" class="bk-meta">изменил {{ data.settings_updated_by }}</span>
          </div>
        </div>
      </div>

      <div class="adm-card bk-list">
        <div v-if="!items.length" class="adm-empty">
          <div class="adm-empty__title">Бэкапов пока нет</div>
          <div class="adm-empty__sub">Создайте первый кнопкой выше или включите расписание</div>
        </div>
        <div v-else class="adm-table-wrap">
          <div class="adm-table-scroll">
            <table class="adm-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Тип</th>
                  <th>Подпись</th>
                  <th>Размер</th>
                  <th>Кто</th>
                  <th>Состояние</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in items" :key="b.id">
                  <td class="bk-when">
                    <div>{{ dt(madeAt(b)) }}</div>
                    <div class="bk-meta">{{ ago(madeAt(b)) }}</div>
                  </td>
                  <td><span class="adm-badge" :class="KIND_CLS[b.kind]">{{ KIND[b.kind] || b.kind }}</span></td>
                  <td class="bk-note-cell">{{ b.note || '—' }}</td>
                  <td class="bk-num-cell">{{ size(b.size_bytes) }}</td>
                  <td>{{ b.created_by || '—' }}</td>
                  <td class="bk-state">
                    <span v-if="b.status === 'done' && b.file_present" class="adm-badge adm-badge--ok">готов</span>
                    <span v-else-if="b.status === 'done'" class="adm-badge adm-badge--err" title="Файла архива нет на диске">файл пропал</span>
                    <template v-else-if="b.status === 'pending' || b.status === 'running'">
                      <span class="adm-badge adm-badge--warn">{{ b.status === 'pending' ? 'в очереди' : 'создаётся' }}</span>
                      <div v-if="b.progress" class="bk-meta">{{ b.progress }}</div>
                    </template>
                    <template v-else>
                      <span class="adm-badge adm-badge--err">ошибка</span>
                      <div class="bk-err">{{ b.error }}</div>
                    </template>
                  </td>
                  <td class="bk-actions">
                    <button
                      v-if="canRestore && b.status === 'done' && b.file_present"
                      class="adm-btn adm-btn--sm"
                      :disabled="!!activeRestore || busyId === b.id"
                      @click="restore(b)"
                    >Откатиться</button>
                    <button
                      v-if="canDelete && b.status !== 'pending' && b.status !== 'running'"
                      class="adm-btn adm-btn--sm adm-btn--danger"
                      :disabled="busyId === b.id || activeRestore?.backup_id === b.id"
                      @click="remove(b)"
                    >Удалить</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-if="restores.length" class="adm-card adm-card--pad bk-restores">
        <div class="bk-card-title">Откаты</div>
        <div v-for="r in restores" :key="r.id" class="bk-restore">
          <span class="adm-badge" :class="RESTORE_STATUS[r.status]?.cls">{{ RESTORE_STATUS[r.status]?.label || r.status }}</span>
          <span class="bk-restore__what">на бэкап от {{ dt(madeAt(byId[r.backup_id])) }}</span>
          <span class="bk-meta">{{ r.requested_by || '—' }} · {{ dt(r.created_at) }}</span>
          <div class="bk-restore__detail" :class="{ 'bk-err': r.status === 'failed' }">{{ r.error || r.step }}</div>
        </div>
      </div>
    </template>
    <AdminSaveBar v-if="canSettings" :dirty="settingsDirty" :saving="savingSettings" text="расписание бэкапов" save-label="Сохранить расписание" @save="saveSettings" @reset="resetSettings" />
  </div>
</template>

<style scoped>
.bk-alert {
  display: flex; flex-direction: column; gap: 0.25rem;
  border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08);
  color: #fca5a5; border-radius: var(--adm-r-sm, 10px); padding: 0.8rem 1rem; font-size: 0.84rem; margin-bottom: 1rem;
}
.bk-live { display: flex; gap: 0.9rem; align-items: flex-start; margin-bottom: 1rem; border-color: rgba(250, 204, 21, 0.4); }
.bk-live__pulse {
  width: 0.7rem; height: 0.7rem; border-radius: 50%; background: #facc15; margin-top: 0.35rem; flex-shrink: 0;
  animation: bk-pulse 1.4s ease-in-out infinite;
}
@keyframes bk-pulse { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) { .bk-live__pulse { animation: none; } }
.bk-live__title { font-weight: 800; color: var(--adm-text); }
.bk-live__step { color: #fde68a; font-size: 0.88rem; margin-top: 0.15rem; }
.bk-live__meta { color: var(--adm-faint); font-size: 0.74rem; margin-top: 0.25rem; }

.bk-top { display: grid; grid-template-columns: 1.3fr 1fr; gap: 1rem; margin-bottom: 1rem; }
@media (max-width: 900px) { .bk-top { grid-template-columns: 1fr; } }
.bk-create, .bk-schedule { display: flex; flex-direction: column; gap: 0.7rem; }
.bk-card-title { font-weight: 800; font-size: 0.95rem; color: var(--adm-text); }
.bk-hint { margin: 0; font-size: 0.78rem; color: var(--adm-dim); line-height: 1.5; }
.bk-row { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
.bk-note { flex: 1 1 14rem; min-width: 0; }
.bk-stats { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; color: var(--adm-dim); }
.bk-stats b { color: var(--adm-text); }
.bk-toggle { display: flex; align-items: center; gap: 0.5rem; font-size: 0.86rem; color: var(--adm-text); cursor: pointer; }
.bk-field { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.8rem; color: var(--adm-dim); }
.bk-num { width: 5rem; }
.bk-meta { font-size: 0.72rem; color: var(--adm-faint); }
.bk-err { font-size: 0.74rem; color: #f87171; max-width: 26rem; white-space: normal; }

.bk-list { margin-bottom: 1rem; overflow: hidden; }
.bk-when { white-space: nowrap; }
.bk-note-cell { max-width: 18rem; white-space: normal; color: var(--adm-dim); }
.bk-num-cell { font-variant-numeric: tabular-nums; white-space: nowrap; }
.bk-state { min-width: 8rem; }
.bk-actions { display: flex; gap: 0.4rem; justify-content: flex-end; white-space: nowrap; }

.bk-restores { display: flex; flex-direction: column; gap: 0.6rem; }
.bk-restore { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.6rem; }
.bk-restore__what { font-size: 0.84rem; color: var(--adm-text); }
.bk-restore .bk-meta { margin-left: auto; }
.bk-restore__detail { flex-basis: 100%; font-size: 0.78rem; color: var(--adm-dim); }
</style>
