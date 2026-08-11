<script setup>
import { onMounted, ref, computed } from 'vue'
import { adminListCrashes, adminDeleteCrash, adminDeleteCrashes } from '../../services/adminCrashesApi'
import { authState, hasPermission } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'

const token = () => authState.accessToken

const items = ref([])
const loading = ref(true)
const deletingId = ref(null)
const canManage = hasPermission('crashes.manage')
const search = ref('')
const expandedId = ref(null)

async function load() {
  loading.value = true
  selected.value = []
  try {
    const data = await adminListCrashes(token())
    items.value = data?.items || []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

async function remove(id) {
  if (!(await confirmDialog({ title: 'Удалить краш-репорт', message: 'Удалить этот краш-репорт?', confirmLabel: 'Удалить', danger: true }))) return
  deletingId.value = id
  try {
    await adminDeleteCrash(token(), id)
    items.value = items.value.filter(i => i.id !== id)
    selected.value = selected.value.filter(s => s !== id)
    if (expandedId.value === id) expandedId.value = null
  } catch {
    // ignore
  } finally {
    deletingId.value = null
  }
}

const filtered = computed(() => {
  if (!search.value) return items.value
  const q = search.value.toLowerCase()
  return items.value.filter(i => i.player_nickname.toLowerCase().includes(q))
})

// ── Selection & bulk delete ─────────────────────────────────────────────────
const selected = ref([])          // crash-report ids ticked
const bulkDeleting = ref(false)

function isSelected(id) { return selected.value.includes(id) }
function toggleOne(id) {
  const i = selected.value.indexOf(id)
  if (i >= 0) selected.value.splice(i, 1)
  else selected.value.push(id)
}
const allSelected = computed(
  () => filtered.value.length > 0 && filtered.value.every(i => selected.value.includes(i.id)),
)
const someSelected = computed(() => selected.value.length > 0 && !allSelected.value)
function toggleAll() {
  selected.value = allSelected.value ? [] : filtered.value.map(i => i.id)
}

async function removeSelected() {
  if (!selected.value.length || bulkDeleting.value) return
  const n = selected.value.length
  const word = n === 1 ? 'краш-репорт' : 'краш-репортов'
  if (!(await confirmDialog({
    title: 'Удалить краш-репорты',
    message: `Удалить ${n} ${word}? Действие необратимо.`,
    confirmLabel: 'Удалить',
    danger: true,
  }))) return
  bulkDeleting.value = true
  try {
    const res = await adminDeleteCrashes(token(), selected.value)
    const ids = new Set(selected.value)
    items.value = items.value.filter(i => !ids.has(i.id))
    if (expandedId.value && ids.has(expandedId.value)) expandedId.value = null
    selected.value = []
    toastSuccess(`Удалено: ${res.deleted}`)
  } catch (e) {
    toastError(e.message || 'Не удалось удалить')
  } finally {
    bulkDeleting.value = false
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function exitCodeLabel(code) {
  if (code === 0) return { text: 'Норм', cls: 'adm-badge--ok' }
  if (code === 1) return { text: `Код ${code}`, cls: 'adm-badge--warn' }
  return { text: `Код ${code}`, cls: 'adm-badge--err' }
}

// Windows exit codes are signed NTSTATUS values — show the hex + a hint for the
// well-known ones so a bare "-805306369" is actually actionable.
const KNOWN_EXIT = {
  '0xC0000005': 'Access Violation (нативный краш — драйвер/GPU/мод с натив-либой)',
  '0xC0000409': 'Stack buffer overrun (обычно MCEF/CEF)',
  '0xC00000FD': 'Stack overflow',
  '0xE0434352': 'Необработанное .NET-исключение',
  '0xDEAD': 'JVM Runtime.halt',
  '0x1': 'Общая ошибка запуска JVM (см. лог)',
}
function exitCodeHex(code) {
  if (code == null) return null
  const u = code < 0 ? code >>> 0 : code       // to unsigned 32-bit
  return '0x' + u.toString(16).toUpperCase()
}
function exitCodeHint(code) {
  return KNOWN_EXIT[exitCodeHex(code)] || null
}

// Prefer the game's own crash-report file; fall back to the launcher-captured
// log tail. Returns { text, source } or null.
function crashLog(item) {
  if (item.crash_report) return { text: item.crash_report, source: 'crash-report' }
  if (item.log_tail) return { text: item.log_tail, source: 'log-tail' }
  return null
}
function fmtRam(mb) {
  if (!mb) return null
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 ? 1 : 0)} ГБ ОЗУ` : `${mb} МБ ОЗУ`
}

onMounted(load)
</script>

<template>
  <div class="adm-page" style="max-width: 960px">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Краши лаунчера</h1>
        <p class="adm-sub">{{ filtered.length }} из {{ items.length }}</p>
      </div>
      <button class="adm-btn" :disabled="loading" @click="load">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Обновить
      </button>
    </div>

    <input v-model="search" class="adm-input" style="max-width: 320px" placeholder="Ник игрока..." />

    <div v-if="canManage && filtered.length" class="bulk-bar">
      <label class="adm-check">
        <input
          type="checkbox"
          class="adm-check-box"
          :checked="allSelected"
          :indeterminate="someSelected"
          @change="toggleAll"
        />
        <span>Выбрать всё ({{ filtered.length }})</span>
      </label>
      <button
        v-if="selected.length"
        class="adm-btn adm-btn--danger adm-btn--sm"
        :disabled="bulkDeleting"
        @click="removeSelected"
      >
        {{ bulkDeleting ? 'Удаление…' : `Удалить выбранные (${selected.length})` }}
      </button>
    </div>

    <div v-if="loading" class="adm-skel" style="height: 260px" />

    <div v-else-if="filtered.length" class="cards">
      <div v-for="item in filtered" :key="item.id" class="adm-card adm-card--hover" :class="{ 'is-selected': isSelected(item.id) }" style="padding: 0.85rem 1.1rem">
        <div class="card__top">
          <div class="card__meta">
            <input
              v-if="canManage"
              type="checkbox"
              class="adm-check-box"
              :checked="isSelected(item.id)"
              @change="toggleOne(item.id)"
            />
            <span class="nick adm-mono">{{ item.player_nickname }}</span>
            <span class="adm-badge" :class="exitCodeLabel(item.exit_code).cls" :title="exitCodeHex(item.exit_code)">
              {{ exitCodeLabel(item.exit_code).text }} · {{ exitCodeHex(item.exit_code) }}
            </span>
            <span class="date adm-num">{{ formatDate(item.created_at) }}</span>
          </div>
          <div class="card__actions">
            <button
              v-if="crashLog(item)"
              class="adm-btn adm-btn--sm"
              @click="expandedId = expandedId === item.id ? null : item.id"
            >
              {{ expandedId === item.id ? 'Свернуть' : 'Лог' }}
            </button>
            <button v-if="canManage" class="adm-btn adm-btn--danger adm-btn--sm" :disabled="deletingId === item.id" @click="remove(item.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Удалить
            </button>
          </div>
        </div>

        <div v-if="exitCodeHint(item.exit_code)" class="exit-hint">💡 {{ exitCodeHint(item.exit_code) }}</div>

        <div class="env-chips">
          <span v-if="item.server_slug" class="chip">🖥 {{ item.server_slug }}</span>
          <span v-if="item.os_name" class="chip" :title="item.os_name">🪟 {{ item.os_name }}</span>
          <span v-if="item.java_version" class="chip">☕ Java {{ item.java_version }}</span>
          <span v-if="fmtRam(item.ram_mb)" class="chip">🧠 {{ fmtRam(item.ram_mb) }}</span>
          <span v-if="item.launcher_version" class="chip">🚀 v{{ item.launcher_version }}</span>
        </div>

        <template v-if="expandedId === item.id && crashLog(item)">
          <div class="log-source">
            {{ crashLog(item).source === 'crash-report' ? 'crash-report игры' : 'хвост latest.log (crash-report не создан)' }}
          </div>
          <pre class="crash-log adm-mono">{{ crashLog(item).text }}</pre>
        </template>
        <p v-else-if="!crashLog(item)" class="no-log">Лог недоступен (старый лаунчер — нет ни crash-report, ни хвоста лога)</p>
      </div>
    </div>

    <div v-else class="adm-empty">
      <div class="adm-empty__title">Крашей нет</div>
      <div class="adm-empty__sub">Лаунчер присылает отчёт, когда игра завершается с ошибкой</div>
    </div>
  </div>
</template>

<style scoped>
.cards { display: flex; flex-direction: column; gap: 0.65rem; }

.bulk-bar { display: flex; align-items: center; gap: 1rem; margin: 0.85rem 0 0.15rem; flex-wrap: wrap; }
.adm-check-box { width: 16px; height: 16px; cursor: pointer; accent-color: var(--adm-acc); vertical-align: middle; }
.adm-card.is-selected { border-color: var(--adm-acc); box-shadow: inset 0 0 0 1px var(--adm-acc); }

.card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.card__meta { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
.card__actions { display: flex; align-items: center; gap: 0.4rem; }

.nick { font-size: 0.86rem; font-weight: 700; color: var(--adm-acc-text); }
.date { font-size: 0.7rem; color: var(--adm-faint); }

.exit-hint { margin-top: 0.55rem; font-size: 0.76rem; color: var(--adm-warn); line-height: 1.4; }

.env-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.55rem; }
.chip {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  background: var(--adm-line-soft, rgba(148, 163, 184, 0.08));
  border: 1px solid var(--adm-line);
  border-radius: 999px;
  font-size: 0.7rem; color: var(--adm-mut); font-weight: 600;
  max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.log-source { margin: 0.75rem 0 0.25rem; font-size: 0.7rem; color: var(--adm-faint); font-weight: 600; }

.crash-log {
  margin: 0.75rem 0 0;
  padding: 0.75rem;
  background: #05080f;
  border: 1px solid var(--adm-line);
  border-radius: 8px;
  font-size: 0.7rem;
  color: var(--adm-mut);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
}

.no-log { margin: 0.5rem 0 0; font-size: 0.74rem; color: var(--adm-faint); }
</style>
