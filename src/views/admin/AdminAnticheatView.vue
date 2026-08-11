<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  anticheatListPlayers,
  anticheatGetConfig,
  anticheatUpdateConfig,
  anticheatGetStats,
  anticheatDeletePlayers,
} from '../../services/adminAnticheatApi.js'
import { authState, hasPermission } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'

const router = useRouter()
const token = () => authState.accessToken
const canManage = hasPermission('anticheat.manage')
const activeServerName = computed(() => activeServer.value?.name || 'сервер')

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref('players')

// ── Players tab ───────────────────────────────────────────────────────────────
const players = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const onlySuspicious = ref(false)

// Pagination
const PAGE_SIZE = 50
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))

async function load() {
  loading.value = true
  error.value = ''
  selected.value = []  // reset selection whenever the visible rows change
  try {
    const data = await anticheatListPlayers(token(), {
      limit: PAGE_SIZE,
      skip: (page.value - 1) * PAGE_SIZE,
      only_suspicious: onlySuspicious.value,
    })
    players.value = data?.items || []
    total.value = data?.total ?? players.value.length
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

// ── Selection & bulk delete ─────────────────────────────────────────────────
const selected = ref([])  // player_uuids ticked in the current view
const deleting = ref(false)

function isSelected(uuid) { return selected.value.includes(uuid) }
function toggleOne(uuid) {
  const i = selected.value.indexOf(uuid)
  if (i >= 0) selected.value.splice(i, 1)
  else selected.value.push(uuid)
}
const allSelected = computed(
  () => players.value.length > 0 && players.value.every(p => selected.value.includes(p.player_uuid)),
)
const someSelected = computed(() => selected.value.length > 0 && !allSelected.value)
function toggleAll() {
  selected.value = allSelected.value ? [] : players.value.map(p => p.player_uuid)
}

async function deleteSelected() {
  if (!selected.value.length || deleting.value) return
  const n = selected.value.length
  const word = n === 1 ? 'игрока' : 'игроков'
  const ok = await confirmDialog({
    title: 'Удалить записи античита',
    message: `Удалить все записи (нарушения, снапшоты модов, отчёты инъекций) для ${n} ${word} на сервере «${activeServerName.value}»? Действие необратимо.`,
    confirmLabel: 'Удалить',
    danger: true,
  })
  if (!ok) return
  deleting.value = true
  try {
    const res = await anticheatDeletePlayers(token(), selected.value)
    toastSuccess(`Удалено записей: ${res.violations} нарушений, ${res.snapshots} снапшотов, ${res.injection_reports} инъекций`)
    selected.value = []
    // If we cleared the last rows on a non-first page, step back so we don't
    // land on an empty page.
    if (players.value.length === res.players && page.value > 1) page.value -= 1
    await load()
  } catch (e) {
    toastError(e.message || 'Не удалось удалить')
  } finally {
    deleting.value = false
  }
}

function goToPage(p) {
  const np = Math.min(Math.max(1, p), totalPages.value)
  if (np === page.value) return
  page.value = np
  load()
}

function onSuspiciousChange() {
  page.value = 1
  load()
}

function goToPlayer(uuid) {
  router.push({ name: 'admin-anticheat-player', params: { uuid } })
}

function riskLevel(p) {
  if (p.has_suspicious_mods || p.high_count > 0) return 'high'
  if (p.medium_count > 2) return 'medium'
  if (p.total_violations > 0) return 'low'
  return 'none'
}

function riskLabel(p) {
  const r = riskLevel(p)
  if (r === 'high') return 'Высокий'
  if (r === 'medium') return 'Средний'
  if (r === 'low') return 'Низкий'
  return 'Чисто'
}

function riskBadge(p) {
  const r = riskLevel(p)
  if (r === 'high') return 'adm-badge--err'
  if (r === 'medium') return 'adm-badge--warn'
  if (r === 'low') return ''
  return 'adm-badge--ok'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
const stats = ref(null)
const statsLoading = ref(false)
const statsError = ref('')

async function loadStats() {
  if (stats.value) return
  statsLoading.value = true
  statsError.value = ''
  try {
    stats.value = await anticheatGetStats(token())
  } catch (e) {
    statsError.value = e.message || 'Ошибка загрузки'
  } finally {
    statsLoading.value = false
  }
}

function switchTab(tab) {
  activeTab.value = tab
  if (tab === 'stats') loadStats()
  if (tab === 'config') loadConfig()
}

// ── Config tab ────────────────────────────────────────────────────────────────
const configs = ref([])
const configLoading = ref(false)
const configError = ref('')
const configSaving = ref(false)
const configSaved = ref(false)

async function loadConfig() {
  if (configs.value.length) return
  configLoading.value = true
  configError.value = ''
  try {
    configs.value = await anticheatGetConfig(token())
  } catch (e) {
    configError.value = e.message || 'Ошибка загрузки'
  } finally {
    configLoading.value = false
  }
}

async function saveConfig() {
  configSaving.value = true
  configSaved.value = false
  configError.value = ''
  try {
    const updates = configs.value.map(c => ({ key: c.key, value: Number(c.value) }))
    configs.value = await anticheatUpdateConfig(token(), updates)
    configSaved.value = true
    setTimeout(() => { configSaved.value = false }, 3000)
  } catch (e) {
    configError.value = e.message || 'Ошибка сохранения'
  } finally {
    configSaving.value = false
  }
}

// The layout keys server-scoped views by the active slug, so switching servers
// remounts this view and re-runs load() with the new server — no watcher needed.
onMounted(load)
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Античит</h1>
        <p class="adm-sub">Мониторинг и настройка защиты · нарушения сервера «{{ activeServerName }}»</p>
      </div>
      <div class="adm-tabs">
        <button class="adm-tab" :class="{ 'adm-tab--active': activeTab === 'players' }" @click="switchTab('players')">Игроки</button>
        <button class="adm-tab" :class="{ 'adm-tab--active': activeTab === 'stats' }" @click="switchTab('stats')">Статистика</button>
        <button class="adm-tab" :class="{ 'adm-tab--active': activeTab === 'config' }" @click="switchTab('config')">Настройки</button>
      </div>
    </div>

    <!-- ── Players ── -->
    <div v-if="activeTab === 'players'" class="ac-tab">
      <div class="ac-toolbar">
        <label class="adm-check">
          <input v-model="onlySuspicious" type="checkbox" @change="onSuspiciousChange" />
          <span>Только с читами</span>
        </label>
        <button class="adm-btn" :disabled="loading" @click="load">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Обновить
        </button>
        <button
          v-if="canManage && selected.length"
          class="adm-btn adm-btn--danger"
          :disabled="deleting"
          @click="deleteSelected"
        >
          {{ deleting ? 'Удаление…' : `Удалить выбранных (${selected.length})` }}
        </button>
      </div>

      <div v-if="error" class="ac-alert">{{ error }}</div>

      <div v-if="loading" class="adm-skel" style="height: 260px" />

      <div v-else-if="players.length === 0 && !error" class="adm-empty">
        <div class="adm-empty__title">Нарушений не обнаружено</div>
        <div class="adm-empty__sub">На сервере «{{ activeServerName }}» пока чисто — античит не зафиксировал нарушений</div>
      </div>

      <template v-else>
        <div class="adm-table-wrap">
          <div class="adm-table-scroll">
            <table class="adm-table" style="white-space: nowrap">
              <thead>
                <tr>
                  <th v-if="canManage" class="ac-check-col">
                    <input
                      type="checkbox"
                      class="adm-check-box"
                      :checked="allSelected"
                      :indeterminate="someSelected"
                      title="Выбрать всё"
                      @change="toggleAll"
                    />
                  </th>
                  <th>Игрок</th>
                  <th>Риск</th>
                  <th>Нарушений</th>
                  <th>HIGH / MED / LOW</th>
                  <th>Не проверено</th>
                  <th>Подозрит. моды</th>
                  <th>Последнее</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in players"
                  :key="p.player_uuid"
                  class="is-clickable"
                  :class="['risk--' + riskLevel(p), { 'is-selected': isSelected(p.player_uuid) }]"
                  @click="goToPlayer(p.player_uuid)"
                >
                  <td v-if="canManage" class="ac-check-col" @click.stop>
                    <input
                      type="checkbox"
                      class="adm-check-box"
                      :checked="isSelected(p.player_uuid)"
                      @change="toggleOne(p.player_uuid)"
                    />
                  </td>
                  <td class="adm-mono" style="color: var(--adm-text); font-weight: 700">{{ p.player_nick }}</td>
                  <td><span class="adm-badge" :class="riskBadge(p)">{{ riskLabel(p) }}</span></td>
                  <td class="adm-num">{{ p.total_violations }}</td>
                  <td>
                    <span class="cnt cnt--high">{{ p.high_count }}</span>
                    <span class="cnt cnt--med">{{ p.medium_count }}</span>
                    <span class="cnt cnt--low">{{ p.low_count }}</span>
                  </td>
                  <td>
                    <span v-if="p.unreviewed_count > 0" class="adm-badge adm-badge--warn">{{ p.unreviewed_count }}</span>
                    <span v-else class="ac-dim">✓</span>
                  </td>
                  <td>
                    <span v-if="p.has_suspicious_mods" class="ac-mods">
                      ⚠ {{ p.suspicious_mod_names.slice(0, 2).join(', ') }}{{ p.suspicious_mod_names.length > 2 ? '…' : '' }}
                    </span>
                    <span v-else class="ac-dim">—</span>
                  </td>
                  <td class="ac-dim adm-mono" style="font-size: 0.76rem">{{ fmtDate(p.last_violation_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="adm-pager">
          <span class="adm-pager__info">{{ rangeFrom }}–{{ rangeTo }} из {{ total.toLocaleString('ru') }}</span>
          <div class="pager-btns">
            <button class="adm-btn adm-btn--sm" :disabled="page <= 1" @click="goToPage(page - 1)">← Назад</button>
            <span class="pager-cur adm-num">{{ page }} / {{ totalPages }}</span>
            <button class="adm-btn adm-btn--sm" :disabled="page >= totalPages" @click="goToPage(page + 1)">Вперёд →</button>
          </div>
        </div>
      </template>
    </div>

    <!-- ── Stats ── -->
    <div v-if="activeTab === 'stats'" class="ac-tab">
      <div v-if="statsLoading" class="adm-skel" style="height: 220px" />
      <div v-else-if="statsError" class="ac-alert">{{ statsError }}</div>

      <div v-else-if="stats">
        <div class="ac-kpis">
          <div class="adm-kpi"><div><div class="adm-kpi__val">{{ stats.total_violations }}</div><div class="adm-kpi__label">всего нарушений</div></div></div>
          <div class="adm-kpi"><div><div class="adm-kpi__val">{{ stats.unique_players }}</div><div class="adm-kpi__label">уникальных игроков</div></div></div>
        </div>

        <div class="adm-table-wrap" style="margin-top: 1rem">
          <div class="adm-table-scroll">
            <table class="adm-table" style="white-space: nowrap">
              <thead>
                <tr>
                  <th>Проверка</th>
                  <th>Кол-во</th>
                  <th>Мин. знач.</th>
                  <th>Среднее знач.</th>
                  <th>Макс. знач.</th>
                  <th>Средний порог</th>
                  <th>Превышение</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in stats.by_check" :key="s.check_type">
                  <td class="adm-mono" style="color: var(--adm-text); font-weight: 700">{{ s.check_type }}</td>
                  <td class="adm-num">{{ s.count }}</td>
                  <td class="adm-num">{{ s.min_actual }}</td>
                  <td class="adm-num" style="color: var(--adm-text); font-weight: 700">{{ s.avg_actual }}</td>
                  <td class="adm-num">{{ s.max_actual }}</td>
                  <td class="adm-num ac-dim">{{ s.avg_expected_max }}</td>
                  <td>
                    <span v-if="s.avg_expected_max > 0" class="adm-badge"
                      :class="s.avg_actual / s.avg_expected_max > 2 ? 'adm-badge--err' : 'adm-badge--warn'">
                      ×{{ (s.avg_actual / s.avg_expected_max).toFixed(2) }}
                    </span>
                    <span v-else class="ac-dim">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p class="ac-hint">
          «Среднее знач.» — среднее фактическое значение среди всех зафиксированных нарушений.
          «Превышение» — во сколько раз среднее превышает порог. Используй для калибровки порогов.
        </p>
      </div>
    </div>

    <!-- ── Config ── -->
    <div v-if="activeTab === 'config'" class="ac-tab">
      <div v-if="configLoading" class="adm-skel" style="height: 220px" />
      <div v-else-if="configError" class="ac-alert">{{ configError }}</div>

      <div v-else-if="configs.length">
        <p class="ac-hint" style="margin-bottom: 1.25rem">
          Пороги применяются на сервере автоматически каждые 5 минут без перезагрузки мода.
          Локальный TOML-конфиг используется как запасной вариант при недоступности API.
          Настройки общие для всех серверов. Ползунок ограничен рекомендуемым диапазоном —
          в числовом поле можно вписать любое значение выше него.
        </p>

        <div class="ac-config-grid">
          <div v-for="c in configs" :key="c.key" class="adm-card adm-card--pad ac-config-card">
            <div class="ac-config-header">
              <span class="ac-config-label">{{ c.label }}</span>
              <span class="ac-config-key adm-mono">{{ c.key }}</span>
            </div>
            <p class="ac-config-desc">{{ c.description }}</p>
            <div class="ac-config-row">
              <input
                v-model.number="c.value"
                type="range"
                :min="c.min_value"
                :max="c.max_value"
                :step="c.step"
                class="ac-slider"
              />
              <input
                v-model.number="c.value"
                type="number"
                :min="c.min_value"
                :step="c.step"
                class="adm-input ac-num-input"
              />
            </div>
            <div class="ac-config-range">ползунок: {{ c.min_value }} — {{ c.max_value }} · в поле можно ввести и больше</div>
            <div v-if="c.updated_by" class="ac-config-range">Изменено: {{ c.updated_by }}</div>
          </div>
        </div>

        <div class="ac-config-actions">
          <button v-if="canManage" class="adm-btn adm-btn--acc" :disabled="configSaving" @click="saveConfig">
            {{ configSaving ? 'Сохранение…' : 'Сохранить' }}
          </button>
          <span v-if="configSaved" class="ac-saved-ok">✓ Сохранено. Мод обновится в течение 5 минут.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ac-tab { display: flex; flex-direction: column; gap: 0; }
.ac-toolbar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }

/* Небольшой баннер ошибки */
.ac-alert {
  padding: 0.7rem 1rem;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: var(--adm-r-sm);
  color: #fca5a5;
  font-size: 0.83rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

/* Риск-акцент слева у строки таблицы */
.risk--high td:first-child { box-shadow: inset 3px 0 0 var(--adm-err); }
.risk--medium td:first-child { box-shadow: inset 3px 0 0 var(--adm-warn); }
.risk--low td:first-child { box-shadow: inset 3px 0 0 var(--adm-dim); }

/* Колонка чекбоксов выбора */
.ac-check-col { width: 1%; text-align: center; padding-left: 0.6rem; padding-right: 0.6rem; }
.adm-check-box { width: 16px; height: 16px; cursor: pointer; accent-color: var(--adm-acc); vertical-align: middle; }
tr.is-selected { background: var(--adm-acc-soft, rgba(99, 102, 241, 0.08)); }

/* Компактные счётчики HIGH/MED/LOW */
.cnt {
  display: inline-block;
  min-width: 1.5rem;
  text-align: center;
  padding: 0.1rem 0.35rem;
  border-radius: 5px;
  font-family: var(--adm-mono);
  font-size: 0.76rem;
  font-weight: 700;
  margin-right: 0.2rem;
}
.cnt--high { background: rgba(248, 113, 113, 0.12); color: #fca5a5; }
.cnt--med { background: rgba(251, 191, 36, 0.12); color: #fcd34d; }
.cnt--low { background: rgba(148, 163, 184, 0.1); color: var(--adm-mut); }

.ac-dim { color: var(--adm-faint); font-size: 0.82rem; }
.ac-mods { color: #fb923c; font-size: 0.8rem; font-weight: 600; }
.ac-hint { margin-top: 0.75rem; font-size: 0.76rem; color: var(--adm-dim); line-height: 1.5; }

/* Пагинация */
.pager-btns { display: flex; align-items: center; gap: 0.6rem; }
.pager-cur { font-size: 0.78rem; font-weight: 700; color: var(--adm-mut); min-width: 3.5rem; text-align: center; }

/* Статистика */
.ac-kpis { display: flex; gap: 0.85rem; flex-wrap: wrap; }
.ac-kpis .adm-kpi { flex: 1; min-width: 180px; }

/* Настройки */
.ac-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.85rem;
  margin-bottom: 1.5rem;
}
.ac-config-card { display: flex; flex-direction: column; gap: 0.35rem; }
.ac-config-header { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
.ac-config-label { font-weight: 800; font-size: 0.86rem; color: var(--adm-text); }
.ac-config-key { font-size: 0.68rem; color: var(--adm-faint); }
.ac-config-desc { font-size: 0.77rem; color: var(--adm-dim); margin: 0 0 0.5rem; line-height: 1.45; }
.ac-config-row { display: flex; align-items: center; gap: 0.75rem; }
.ac-slider { flex: 1; accent-color: var(--adm-acc); cursor: pointer; }
.ac-num-input { width: 84px; text-align: right; padding: 0.4rem 0.5rem; }
.ac-config-range { font-size: 0.68rem; color: var(--adm-faint); }
.ac-config-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.ac-saved-ok { font-size: 0.82rem; color: #6ee7b7; font-weight: 700; }
</style>
