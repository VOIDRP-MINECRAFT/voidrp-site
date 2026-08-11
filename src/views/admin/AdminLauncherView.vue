<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authState, hasPermission } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'
import {
  launcherGetStatus,
  launcherGetLog,
  launcherSetVersion,
  launcherDeploy,
  launcherCancel,
  launcherSetNotes,
  launcherRollback,
  launcherGetHistory,
  launcherGetCrashStats,
} from '../../services/adminLauncherApi'

const token = () => authState.accessToken
const canDeploy = computed(() => hasPermission('launcher.deploy'))
const canViewCrashes = computed(() => hasPermission('crashes.view'))
const router = useRouter()

function openCrashes(version) {
  if (!canViewCrashes.value) return
  router.push({ path: '/admin/launcher-crashes', query: version ? { version } : {} })
}

const loading = ref(true)
const status = ref(null)
const versionInput = ref('')
const savingVersion = ref(false)
const starting = ref(false)
const notesInput = ref('')
const savingNotes = ref(false)
const rolling = ref(false)
const history = ref([])
const crashStats = ref(null)

// Live job view (refreshed by the light /log poll while a build runs).
const job = ref({ state: null, running: false, stage: '', percent: 0, error: null })
const logText = ref('')
const logBox = ref(null)

let pollTimer = null

const deployed = computed(() => status.value?.deployed || { present: false })
const publicOk = computed(() => status.value?.publicManifestOk)
const running = computed(() => job.value.running)
const currentVersion = computed(() => status.value?.currentVersion || '—')
const prevVersion = computed(() => status.value?.prevVersion || null)
const notesChanged = computed(() => notesInput.value !== (status.value?.notes || ''))

const nextPatch = computed(() => {
  const v = versionInput.value.trim()
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v)
  return m ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : null
})
const versionChanged = computed(
  () => versionInput.value.trim() && versionInput.value.trim() !== currentVersion.value,
)

function fmtSize(bytes) {
  if (bytes == null) return '—'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU')
}

function applyJob(j) {
  if (!j) return
  job.value = {
    state: j.state ?? null,
    running: !!j.running,
    stage: j.stage || '',
    percent: Number(j.percent || 0),
    error: j.error || null,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    version: j.version,
  }
}

async function scrollLog() {
  await nextTick()
  const el = logBox.value
  if (el) el.scrollTop = el.scrollHeight
}

async function loadStatus() {
  try {
    const data = await launcherGetStatus(token())
    status.value = data
    applyJob(data.job)
    logText.value = data.logTail || ''
    if (document.activeElement?.dataset?.role !== 'version-input') {
      versionInput.value = data.currentVersion || ''
    }
    if (document.activeElement?.dataset?.role !== 'notes-input') {
      notesInput.value = data.notes || ''
    }
    scrollLog()
  } catch (e) {
    toastError(e?.message || 'Не удалось загрузить статус лаунчера')
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  try { history.value = (await launcherGetHistory(token())).items || [] } catch { /* noop */ }
}
async function loadCrashStats() {
  try { crashStats.value = await launcherGetCrashStats(token()) } catch { /* noop */ }
}

async function loadLog() {
  try {
    const data = await launcherGetLog(token())
    logText.value = data.text || ''
    applyJob({
      state: data.state,
      running: data.running,
      stage: data.stage,
      percent: data.percent,
      error: data.error,
    })
    scrollLog()
    if (!data.running) {
      stopPolling()
      await loadStatus()
      loadHistory()
      loadCrashStats()
      if (data.state === 'success') toastSuccess('Релиз собран и задеплоен')
      else if (data.state === 'failed') toastError(data.error || 'Сборка завершилась с ошибкой')
    }
  } catch {
    /* transient — keep polling */
  }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    if (!document.hidden) loadLog()
  }, 1500)
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function saveVersion() {
  const target = versionInput.value.trim()
  if (!target) { toastError('Укажите версию'); return }
  savingVersion.value = true
  try {
    const data = await launcherSetVersion(token(), { version: target })
    status.value = { ...status.value, ...data }
    versionInput.value = data.currentVersion || target
    toastSuccess(`Версия установлена: ${data.currentVersion || target}`)
  } catch (e) {
    toastError(e?.message || 'Не удалось изменить версию')
  } finally {
    savingVersion.value = false
  }
}

async function saveNotes() {
  savingNotes.value = true
  try {
    const data = await launcherSetNotes(token(), notesInput.value)
    if (status.value) status.value.notes = data.notes || ''
    notesInput.value = data.notes || ''
    toastSuccess('Заметки сохранены (попадут в манифест при следующем деплое)')
  } catch (e) {
    toastError(e?.message || 'Не удалось сохранить заметки')
  } finally {
    savingNotes.value = false
  }
}

async function rollback() {
  const ok = await confirmDialog({
    title: `Откатить на ${prevVersion.value}?`,
    message:
      `Предыдущий релиз (${prevVersion.value}) будет опубликован игрокам вместо текущего ` +
      `(${deployed.value.version}). Продолжить?`,
    confirmLabel: 'Откатить',
    cancelLabel: 'Отмена',
    danger: true,
  })
  if (!ok) return
  rolling.value = true
  try {
    const data = await launcherRollback(token())
    status.value = data
    applyJob(data.job)
    await loadStatus()
    loadHistory()
    toastSuccess(`Откат выполнен: ${data.deployed?.version || prevVersion.value}`)
  } catch (e) {
    toastError(e?.message || 'Не удалось откатить')
  } finally {
    rolling.value = false
  }
}

async function deploy() {
  const ver = status.value?.currentVersion || versionInput.value
  const ok = await confirmDialog({
    title: 'Собрать и задеплоить лаунчер?',
    message:
      `Будет собрана версия ${ver} (Windows + Linux) и опубликована игрокам через ` +
      `self-update. Сборка занимает несколько минут и временно нагрузит сервер. Продолжить?`,
    confirmLabel: 'Собрать и задеплоить',
    cancelLabel: 'Отмена',
  })
  if (!ok) return
  starting.value = true
  try {
    const data = await launcherDeploy(token())
    status.value = data
    applyJob(data.job)
    logText.value = data.logTail || ''
    startPolling()
    toastSuccess('Сборка запущена')
  } catch (e) {
    toastError(e?.message || 'Не удалось запустить сборку')
  } finally {
    starting.value = false
  }
}

async function cancel() {
  const ok = await confirmDialog({
    title: 'Отменить сборку?',
    message: 'Текущая сборка будет прервана. Задеплоенный релиз не изменится.',
    confirmLabel: 'Отменить сборку',
    cancelLabel: 'Назад',
    danger: true,
  })
  if (!ok) return
  try {
    const data = await launcherCancel(token())
    status.value = data
    applyJob(data.job)
    stopPolling()
  } catch (e) {
    toastError(e?.message || 'Не удалось отменить сборку')
  }
}

watch(running, (isRunning) => { if (isRunning) startPolling() })

function fmtDuration(sec) {
  if (sec == null) return '—'
  if (sec < 60) return `${sec} с`
  return `${Math.floor(sec / 60)} мин ${sec % 60} с`
}

onMounted(async () => {
  await loadStatus()
  loadHistory()
  loadCrashStats()
  if (job.value.running) startPolling()
})
onBeforeUnmount(stopPolling)
</script>

<template>
  <div class="adm-page">
    <!-- ── Header ─────────────────────────────────────────── -->
    <div class="adm-head">
      <div>
        <h1 class="adm-title">Лаунчер</h1>
        <p class="adm-sub">Версия релиза, состояние манифеста и сборка/деплой на игроков.</p>
      </div>
      <div class="adm-head-actions">
        <span v-if="running" class="adm-badge adm-badge--warn">Идёт сборка…</span>
        <span v-else-if="publicOk === true" class="adm-badge adm-badge--ok">Онлайн</span>
        <span v-else-if="publicOk === false" class="adm-badge adm-badge--err">URL недоступен</span>
        <button
          class="adm-btn adm-btn--acc"
          :disabled="!canDeploy || running || starting"
          @click="deploy"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91 0z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
          Собрать и задеплоить
        </button>
      </div>
    </div>

    <div v-if="loading" class="adm-card adm-skel" style="height: 130px" />

    <template v-else>
      <!-- ── KPI row ──────────────────────────────────────── -->
      <div class="lnc-kpis">
        <div class="adm-kpi adm-kpi--acc">
          <div class="adm-kpi__val adm-mono">{{ currentVersion }}</div>
          <div class="adm-kpi__label">Текущая версия (сборка)</div>
        </div>
        <div class="adm-kpi">
          <div class="adm-kpi__val adm-mono">{{ deployed.version || '—' }}</div>
          <div class="adm-kpi__label">В деплое (манифест)</div>
        </div>
        <div class="adm-kpi">
          <div class="adm-kpi__val adm-kpi__val--sm">{{ deployed.notes || '—' }}</div>
          <div class="adm-kpi__label">Последняя сборка</div>
        </div>
      </div>

      <!-- ── Версия ───────────────────────────────────────── -->
      <div class="adm-card lnc-card">
        <div class="adm-card__head">
          <h3 class="adm-card__title">Версия сборки</h3>
          <span class="adm-badge adm-badge--info adm-mono">package.json</span>
        </div>
        <div class="lnc-card__body">
          <div class="lnc-ver">
            <input
              v-model="versionInput"
              data-role="version-input"
              class="adm-input lnc-ver__input adm-mono"
              placeholder="4.0.31"
              :disabled="!canDeploy || running"
            />
            <button
              class="adm-btn adm-btn--sm"
              :disabled="!canDeploy || running || !nextPatch"
              @click="versionInput = nextPatch"
            >+1 patch<template v-if="nextPatch"> → {{ nextPatch }}</template></button>
            <button
              class="adm-btn adm-btn--sm adm-btn--acc"
              :disabled="!canDeploy || running || savingVersion || !versionChanged"
              @click="saveVersion"
            >{{ savingVersion ? 'Сохранение…' : 'Сохранить' }}</button>
          </div>
          <p class="lnc-hint">
            <template v-if="!canDeploy">Только просмотр — нет права <span class="adm-mono">launcher.deploy</span>.</template>
            <template v-else>Смена версии нужна, чтобы self-update догнал игроков. Та же версия = пересборка без обновления у игроков.</template>
          </p>
        </div>
      </div>

      <!-- ── Release notes ────────────────────────────────── -->
      <div class="adm-card lnc-card">
        <div class="adm-card__head">
          <h3 class="adm-card__title">Что нового (release notes)</h3>
          <span class="adm-badge adm-badge--info">игрокам при обновлении</span>
        </div>
        <div class="lnc-card__body">
          <textarea
            v-model="notesInput"
            data-role="notes-input"
            class="adm-textarea"
            rows="3"
            :disabled="!canDeploy || running"
            placeholder="Напр.: Ловим и объясняем ошибки запуска, ускорили синхронизацию…"
          />
          <div class="lnc-notes-actions">
            <button
              class="adm-btn adm-btn--sm adm-btn--acc"
              :disabled="!canDeploy || running || savingNotes || !notesChanged"
              @click="saveNotes"
            >{{ savingNotes ? 'Сохранение…' : 'Сохранить заметки' }}</button>
            <span class="lnc-hint lnc-hint--inline">Запишутся в манифест при следующем деплое.</span>
          </div>
        </div>
      </div>

      <!-- ── Задеплоенный релиз ───────────────────────────── -->
      <div class="adm-card lnc-card">
        <div class="adm-card__head">
          <h3 class="adm-card__title">Задеплоенный релиз</h3>
          <div class="lnc-head-right">
            <button
              v-if="prevVersion"
              class="adm-btn adm-btn--sm"
              :disabled="!canDeploy || running || rolling"
              :title="`Вернуть предыдущий релиз ${prevVersion}`"
              @click="rollback"
            >↩ Откат на {{ prevVersion }}</button>
            <span v-if="publicOk === true" class="adm-badge adm-badge--ok">URL доступен</span>
            <span v-else-if="publicOk === false" class="adm-badge adm-badge--err">URL недоступен</span>
          </div>
        </div>
        <div class="lnc-card__body">
          <div v-if="!deployed.present" class="adm-empty">Манифест не найден в деплой-каталоге.</div>
          <div v-else class="adm-table-wrap">
            <div class="adm-table-scroll">
              <table class="adm-table">
                <thead>
                  <tr>
                    <th>Платформа</th><th>Файл</th><th>Размер</th>
                    <th>SHA-256</th><th>Обновлён</th><th>Целостность</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in deployed.artifacts" :key="a.platform + a.kind">
                    <td class="adm-mono">{{ a.platform }}</td>
                    <td>{{ a.kind === 'launcher' ? 'Лаунчер' : 'Updater' }}</td>
                    <td class="adm-num">{{ fmtSize(a.sizeBytes) }}</td>
                    <td class="adm-mono lnc-sha">{{ a.sha256Short || '—' }}</td>
                    <td class="lnc-nowrap">{{ fmtDate(a.mtime) }}</td>
                    <td>
                      <span v-if="a.matches" class="adm-badge adm-badge--ok">✓</span>
                      <span v-else class="adm-badge adm-badge--err">✗</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Сборка и деплой ──────────────────────────────── -->
      <div class="adm-card lnc-card">
        <div class="adm-card__head">
          <h3 class="adm-card__title">Сборка и деплой</h3>
          <span v-if="running" class="adm-badge adm-badge--warn">идёт сборка…</span>
          <span v-else-if="job.state === 'success'" class="adm-badge adm-badge--ok">успешно</span>
          <span v-else-if="job.state === 'failed'" class="adm-badge adm-badge--err">ошибка</span>
        </div>
        <div class="lnc-card__body">
          <div class="lnc-actions">
            <button
              class="adm-btn adm-btn--acc"
              :disabled="!canDeploy || running || starting"
              @click="deploy"
            >⚙ Собрать манифесты и задеплоить</button>
            <button v-if="running" class="adm-btn adm-btn--danger adm-btn--sm" @click="cancel">Отменить</button>
            <span class="lnc-hint lnc-hint--inline">Собирает Windows + Linux и публикует игрокам. Несколько минут.</span>
          </div>

          <!-- Live progress -->
          <div v-if="running || job.state" class="lnc-progress">
            <div class="lnc-progress__row">
              <span class="lnc-stage">
                {{ job.stage || (running ? 'Инициализация…' : (job.state === 'success' ? 'Готово' : 'Завершено')) }}
              </span>
              <span class="adm-num adm-mono">{{ job.percent }}%</span>
            </div>
            <div class="lnc-bar">
              <div
                class="lnc-bar__fill"
                :class="{ 'is-fail': job.state === 'failed', 'is-done': job.state === 'success', 'is-live': running }"
                :style="{ width: `${Math.max(3, job.percent)}%` }"
              />
            </div>
            <div v-if="job.error" class="adm-badge adm-badge--err lnc-err">{{ job.error }}</div>
            <pre ref="logBox" class="lnc-log adm-mono">{{ logText || '…' }}</pre>
          </div>
        </div>
      </div>

      <!-- ── Краши по версиям / adoption ──────────────────── -->
      <div v-if="crashStats && crashStats.versions.length" class="adm-card lnc-card">
        <div class="adm-card__head">
          <h3 class="adm-card__title">Краши по версиям</h3>
          <span class="adm-badge adm-badge--info">за {{ crashStats.windowDays }} дн · всего {{ crashStats.total }}</span>
        </div>
        <div class="lnc-card__body">
          <p v-if="canViewCrashes" class="lnc-hint" style="margin-top:0">Нажми на строку, чтобы посмотреть сами краши этой версии.</p>
          <div class="adm-table-wrap"><div class="adm-table-scroll">
            <table class="adm-table">
              <thead><tr><th>Версия</th><th>Крашей</th><th>Игроков</th><th>Последний</th><th></th></tr></thead>
              <tbody>
                <tr
                  v-for="v in crashStats.versions"
                  :key="v.version"
                  :class="{ 'lnc-row-cur': v.version === currentVersion, 'is-clickable': canViewCrashes }"
                  @click="openCrashes(v.version)"
                >
                  <td class="adm-mono">
                    {{ v.version }}
                    <span v-if="v.version === currentVersion" class="adm-badge adm-badge--acc lnc-cur-tag">текущая</span>
                  </td>
                  <td class="adm-num">{{ v.crashes }}</td>
                  <td class="adm-num">{{ v.players }}</td>
                  <td class="lnc-nowrap adm-mut">{{ fmtDate(v.last) }}</td>
                  <td class="lnc-nowrap">
                    <span v-if="canViewCrashes" class="lnc-open">Открыть →</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div></div>
        </div>
      </div>

      <!-- ── История деплоев ──────────────────────────────── -->
      <div class="adm-card lnc-card">
        <div class="adm-card__head">
          <h3 class="adm-card__title">История деплоев</h3>
        </div>
        <div class="lnc-card__body">
          <div v-if="!history.length" class="adm-empty">Пока нет записей.</div>
          <div v-else class="adm-table-wrap"><div class="adm-table-scroll">
            <table class="adm-table">
              <thead><tr><th>Версия</th><th>Результат</th><th>Кто</th><th>Когда</th><th>Длит.</th></tr></thead>
              <tbody>
                <tr v-for="(h, i) in history" :key="i">
                  <td class="adm-mono">{{ h.version || '—' }}</td>
                  <td>
                    <span v-if="h.state === 'success'" class="adm-badge adm-badge--ok">успех</span>
                    <span v-else-if="h.state === 'failed'" class="adm-badge adm-badge--err">ошибка</span>
                    <span v-else class="adm-badge adm-badge--info">{{ h.state || '—' }}</span>
                  </td>
                  <td class="adm-mut lnc-nowrap">{{ h.actor || '—' }}</td>
                  <td class="lnc-nowrap adm-mut">{{ fmtDate(h.finished_at) }}</td>
                  <td class="adm-num">{{ fmtDuration(h.duration_sec) }}</td>
                </tr>
              </tbody>
            </table>
          </div></div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.adm-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.lnc-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.7rem;
  margin-bottom: 0.9rem;
}
.adm-kpi__val--sm { font-size: 0.82rem; font-weight: 700; line-height: 1.3; word-break: break-word; }

.lnc-card { margin-top: 0.9rem; }
.lnc-card__body { padding: 1.05rem 1.2rem; }
@media (max-width: 640px) { .lnc-card__body { padding: 0.9rem 0.9rem; } }

.lnc-ver { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.lnc-ver__input { width: 150px; text-align: center; flex: 0 0 auto; }

.lnc-hint { margin: 0.7rem 0 0; font-size: 0.76rem; line-height: 1.5; color: var(--adm-dim); }
.lnc-hint--inline { margin: 0; }

.lnc-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.lnc-notes-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-top: 0.6rem; }
.lnc-head-right { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; justify-content: flex-end; }
.lnc-cur-tag { margin-left: 0.4rem; }
.lnc-row-cur { background: var(--adm-acc-soft); }
.lnc-open { font-size: 0.72rem; font-weight: 700; color: var(--adm-acc-text); opacity: 0; transition: opacity 0.12s; }
:deep(.adm-table tbody tr.is-clickable:hover) .lnc-open { opacity: 1; }

.lnc-sha { color: var(--adm-dim); }
.lnc-nowrap { white-space: nowrap; }

.lnc-progress { margin-top: 1.1rem; }
.lnc-progress__row { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; margin-bottom: 0.4rem; }
.lnc-stage { font-weight: 700; font-size: 0.9rem; color: var(--adm-text); min-width: 0; overflow-wrap: anywhere; }
.lnc-bar { height: 8px; border-radius: 6px; background: rgba(148, 163, 184, 0.14); overflow: hidden; }
.lnc-bar__fill { height: 100%; border-radius: 6px; background: var(--adm-acc); transition: width 0.4s ease; }
.lnc-bar__fill.is-live { background: linear-gradient(90deg, var(--adm-acc), #a855f7); }
.lnc-bar__fill.is-done { background: linear-gradient(90deg, #10b981, #34d399); }
.lnc-bar__fill.is-fail { background: linear-gradient(90deg, #ef4444, #f87171); }
.lnc-err { margin-top: 0.6rem; }

.lnc-log {
  margin: 0.85rem 0 0;
  max-height: 320px;
  overflow: auto;
  background: rgba(2, 6, 12, 0.55);
  border: 1px solid var(--adm-line);
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  font-size: 0.72rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: rgba(203, 213, 225, 0.9);
}
@media (max-width: 640px) { .lnc-log { max-height: 240px; font-size: 0.68rem; } }
</style>
