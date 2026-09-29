<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  anticheatGetPlayer, anticheatPlayerAction, anticheatSetModVerdict, anticheatDeleteModVerdict,
  anticheatListActions, anticheatCreateAction,
} from '../../services/adminAnticheatApi.js'
import { authState, hasPermission } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'

const route = useRoute()
const router = useRouter()
const token = () => authState.accessToken
const canManage = hasPermission('anticheat.manage')

const playerUuid = route.params.uuid

const data = ref(null)
const loading = ref(true)
const error = ref('')

const actionLoading = ref(false)
const actionMsg = ref('')
const actionErr = ref('')
const actionReason = ref('')
const showSnapshotIdx = ref(0)
const showInjectionIdx = ref(0)

const verdictLoading = ref({})
const verdictMsg = ref('')

async function setVerdict(modId, verdict) {
  const key = modId + verdict
  verdictLoading.value = { ...verdictLoading.value, [key]: true }
  verdictMsg.value = ''
  try {
    await anticheatSetModVerdict(token(), modId, verdict)
    verdictMsg.value = verdict === 'CHEAT'
      ? `${modId} помечен как ЧИТ`
      : `${modId} помечен как БЕЗОПАСНЫЙ`
    await load()
  } catch (e) {
    verdictMsg.value = e.message || 'Ошибка'
  } finally {
    verdictLoading.value = { ...verdictLoading.value, [key]: false }
  }
}

async function clearVerdict(modId) {
  verdictMsg.value = ''
  try {
    await anticheatDeleteModVerdict(token(), modId)
    verdictMsg.value = `Вердикт для ${modId} удалён`
    await load()
  } catch (e) {
    verdictMsg.value = e.message || 'Ошибка'
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await anticheatGetPlayer(token(), playerUuid)
    showSnapshotIdx.value = 0
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

onMounted(() => { load().then(prefillPlace); loadRollbacks() })

// ── Rollback through CoreProtect (Paper servers with VoidRP Guard) ───────────
const rollbacks = ref([])
const rbMinutes = ref(60)
const rbRadius = ref(0)
const rbPlace = ref({ world: '', x: null, y: null, z: null })
const rbBusy = ref(false)
const RB_PRESETS = [
  { label: '15 мин', minutes: 15 },
  { label: '1 ч', minutes: 60 },
  { label: '3 ч', minutes: 180 },
  { label: '12 ч', minutes: 720 },
  { label: '1 день', minutes: 1440 },
  { label: '3 дня', minutes: 4320 },
]
let rbTimer = null

async function loadRollbacks() {
  try {
    rollbacks.value = await anticheatListActions(token(), { player_uuid: playerUuid, limit: 20 })
  } catch {
    rollbacks.value = []
  }
  // Keep watching while the server has not answered yet.
  clearTimeout(rbTimer)
  if (rollbacks.value.some(a => a.status === 'pending' || a.status === 'running')) {
    rbTimer = setTimeout(loadRollbacks, 4000)
  }
}

onBeforeUnmount(() => clearTimeout(rbTimer))

// A grief record names "Последний — <world> <x> <y> <z>": the natural place to
// roll back around.
function prefillPlace() {
  const grief = data.value?.violations?.find(v => v.check_type?.startsWith('GRIEF'))
  const m = grief?.details?.match(/Последний — (\S+) (-?\d+) (-?\d+) (-?\d+)/)
  if (m) rbPlace.value = { world: m[1], x: +m[2], y: +m[3], z: +m[4] }
}

function fmtMinutes(min) {
  if (min % 1440 === 0) return `${min / 1440} д`
  if (min % 60 === 0) return `${min / 60} ч`
  return `${min} мин`
}

async function queueRollback(kind) {
  const minutes = Number(rbMinutes.value)
  const radius = Number(rbRadius.value) || 0
  if (!minutes || minutes < 1) { toastError('Укажите, за сколько минут'); return }
  const nick = data.value.player_nick
  const where = radius
    ? `в радиусе ${radius} блоков от ${rbPlace.value.world} ${rbPlace.value.x} ${rbPlace.value.y} ${rbPlace.value.z}`
    : 'по всему миру'
  const ok = await confirmDialog({
    title: kind === 'rollback' ? 'Откатить изменения игрока?' : 'Вернуть откаченное?',
    message: kind === 'rollback'
      ? `CoreProtect отменит всё, что ${nick} ломал, ставил и брал из сундуков за последние ${fmtMinutes(minutes)} ${where}. Если откатили лишнее, это можно вернуть кнопкой «Восстановить».`
      : `CoreProtect снова применит изменения ${nick} за последние ${fmtMinutes(minutes)} ${where} — это отменяет прошлый откат.`,
    confirmLabel: kind === 'rollback' ? 'Откатить' : 'Восстановить',
    danger: kind === 'rollback',
  })
  if (!ok) return
  rbBusy.value = true
  try {
    const body = { kind, target_nick: nick, target_uuid: playerUuid, minutes, radius }
    if (radius) Object.assign(body, rbPlace.value)
    await anticheatCreateAction(token(), body)
    toastSuccess('Отправлено на сервер — результат появится ниже через несколько секунд')
    await loadRollbacks()
  } catch (e) {
    toastError(e.message || 'Не удалось отправить')
  } finally {
    rbBusy.value = false
  }
}

const RB_STATUS = {
  pending: { label: 'ждёт сервер', cls: '' },
  running: { label: 'выполняется', cls: 'adm-badge--warn' },
  done: { label: 'готово', cls: 'adm-badge--ok' },
  failed: { label: 'ошибка', cls: 'adm-badge--err' },
}

async function doAction(action) {
  actionLoading.value = true
  actionMsg.value = ''
  actionErr.value = ''
  try {
    const res = await anticheatPlayerAction(token(), playerUuid, action, actionReason.value)
    if (action === 'clear_violations') actionMsg.value = 'Нарушения помечены как проверенные'
    else if (action === 'kick') actionMsg.value = `Игрок ${res.nick} кикнут`
    else if (action === 'disable') actionMsg.value = `Аккаунт ${res.nick} заблокирован`
    else if (action === 'enable') actionMsg.value = `Аккаунт ${res.nick} разблокирован`
    await load()
  } catch (e) {
    actionErr.value = e.message || 'Ошибка'
  } finally {
    actionLoading.value = false
  }
}

// Точка-индикатор слева от нарушения (свои оттенки), и отдельно —
// системный бейдж, чтобы серьёзность читалась как остальные статусы панели.
function severityBadge(s) {
  if (s === 'HIGH') return 'adm-badge--err'
  if (s === 'MEDIUM') return 'adm-badge--warn'
  return ''
}

function severityClass(s) {
  if (s === 'HIGH') return 'sev--high'
  if (s === 'MEDIUM') return 'sev--med'
  return 'sev--low'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <div class="adm-page">
    <button class="adm-btn adm-btn--ghost adm-btn--sm" style="align-self: flex-start" @click="router.push({ name: 'admin-anticheat' })">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      Назад к списку
    </button>

    <div v-if="loading" class="adm-skel" style="height: 280px; margin-top: 1rem" />

    <div v-else-if="error" class="acp-alert">{{ error }}</div>

    <template v-else-if="data">
      <!-- Header -->
      <div class="acp-header">
        <div class="acp-avatar">{{ data.player_nick.charAt(0).toUpperCase() }}</div>
        <div>
          <h1 class="acp-nick">{{ data.player_nick }}</h1>
          <div class="acp-uuid">{{ data.player_uuid }}</div>
          <div class="acp-status" :class="data.account_active === false ? 'acp-status--off' : 'acp-status--on'">
            <span v-if="data.account_active === null">Аккаунт: не найден на сайте</span>
            <span v-else-if="data.account_active">Аккаунт активен</span>
            <span v-else>Аккаунт заблокирован</span>
          </div>
        </div>
        <div class="acp-stats">
          <div class="acp-stat">
            <div class="acp-stat__val">{{ data.violations.length }}</div>
            <div class="acp-stat__lbl">нарушений</div>
          </div>
          <div class="acp-stat">
            <div class="acp-stat__val acp-stat__val--danger">{{ data.violations.filter(v => v.severity === 'HIGH').length }}</div>
            <div class="acp-stat__lbl">HIGH</div>
          </div>
          <div class="acp-stat">
            <div class="acp-stat__val">{{ data.snapshots.length }}</div>
            <div class="acp-stat__lbl">снимков</div>
          </div>
        </div>
      </div>

      <!-- Actions (require anticheat.manage) -->
      <div v-if="canManage" class="acp-actions-card">
        <div class="acp-actions-title">Действия</div>
        <div class="acp-actions-row">
          <input v-model="actionReason" class="adm-input acp-reason-input" placeholder="Причина (необязательно)" />
          <button class="adm-btn" :disabled="actionLoading" @click="doAction('kick')">Кикнуть</button>
          <button
            v-if="data.account_active !== false"
            class="adm-btn adm-btn--danger"
            :disabled="actionLoading || data.account_active === null"
            @click="doAction('disable')"
          >Заблокировать аккаунт</button>
          <button
            v-else
            class="adm-btn adm-btn--ok"
            :disabled="actionLoading"
            @click="doAction('enable')"
          >Разблокировать аккаунт</button>
          <button class="adm-btn" :disabled="actionLoading" @click="doAction('clear_violations')">Снять все нарушения</button>
        </div>
        <div v-if="actionMsg" class="acp-action-ok">{{ actionMsg }}</div>
        <div v-if="actionErr" class="acp-action-err">{{ actionErr }}</div>
      </div>

      <!-- Rollback through CoreProtect (Paper servers running VoidRP Guard) -->
      <div v-if="canManage" class="acp-actions-card">
        <div class="acp-actions-title">Откат через CoreProtect</div>
        <p class="acp-rb-hint">
          Отменяет всё, что игрок ломал, ставил и брал из сундуков за выбранное время.
          Работает на серверах с плагином VoidRP Guard и CoreProtect (Origins).
        </p>
        <div class="acp-actions-row">
          <button
            v-for="p in RB_PRESETS"
            :key="p.minutes"
            class="adm-btn adm-btn--sm"
            :class="{ 'adm-btn--acc': rbMinutes === p.minutes }"
            @click="rbMinutes = p.minutes"
          >{{ p.label }}</button>
          <label class="acp-rb-field">
            <span>минут</span>
            <input v-model.number="rbMinutes" type="number" min="1" max="43200" class="adm-input acp-rb-num" />
          </label>
        </div>
        <div class="acp-actions-row">
          <label class="acp-rb-field">
            <span>радиус (0 — везде)</span>
            <input v-model.number="rbRadius" type="number" min="0" max="1000" class="adm-input acp-rb-num" />
          </label>
          <template v-if="rbRadius > 0">
            <label class="acp-rb-field"><span>мир</span><input v-model="rbPlace.world" class="adm-input acp-rb-world" placeholder="world" /></label>
            <label class="acp-rb-field"><span>x</span><input v-model.number="rbPlace.x" type="number" class="adm-input acp-rb-num" /></label>
            <label class="acp-rb-field"><span>y</span><input v-model.number="rbPlace.y" type="number" class="adm-input acp-rb-num" /></label>
            <label class="acp-rb-field"><span>z</span><input v-model.number="rbPlace.z" type="number" class="adm-input acp-rb-num" /></label>
          </template>
        </div>
        <div class="acp-actions-row">
          <button class="adm-btn adm-btn--danger" :disabled="rbBusy" @click="queueRollback('rollback')">Откатить</button>
          <button class="adm-btn" :disabled="rbBusy" @click="queueRollback('restore')">Восстановить</button>
        </div>

        <div v-if="rollbacks.length" class="acp-rb-list">
          <div v-for="a in rollbacks" :key="a.id" class="acp-rb-row">
            <span class="adm-badge" :class="RB_STATUS[a.status]?.cls">{{ RB_STATUS[a.status]?.label || a.status }}</span>
            <span class="acp-rb-what">
              {{ a.kind === 'rollback' ? 'Откат' : 'Восстановление' }} за {{ fmtMinutes(a.params.minutes) }}
              <template v-if="a.params.radius"> · радиус {{ a.params.radius }} от {{ a.params.world }} {{ a.params.x }} {{ a.params.y }} {{ a.params.z }}</template>
            </span>
            <span class="acp-rb-meta">{{ a.created_by || '—' }} · {{ fmtDate(a.created_at) }}</span>
            <div v-if="a.result" class="acp-rb-result" :class="{ 'acp-rb-result--err': a.status === 'failed' }">{{ a.result }}</div>
          </div>
        </div>
      </div>

      <div class="acp-grid">
        <!-- Violation timeline -->
        <section class="acp-section">
          <div class="acp-section-title">
            Нарушения
            <span class="acp-section-count">{{ data.violations.length }}</span>
          </div>
          <div v-if="data.violations.length === 0" class="acp-empty">Нарушений нет</div>
          <div v-else class="acp-timeline">
            <div
              v-for="v in data.violations"
              :key="v.id"
              class="acp-viol"
              :class="{ 'acp-viol--reviewed': v.reviewed }"
            >
              <div class="acp-viol-dot" :class="severityClass(v.severity)" />
              <div class="acp-viol-body">
                <div class="acp-viol-top">
                  <span class="acp-check-type">{{ v.check_type }}</span>
                  <span class="adm-badge acp-sev-badge" :class="severityBadge(v.severity)">{{ v.severity }}</span>
                  <span v-if="v.reviewed" class="acp-reviewed-tag">✓ проверено</span>
                </div>
                <div v-if="v.details" class="acp-viol-details">{{ v.details }}</div>
                <div class="acp-viol-meta">
                  <span>VL: {{ v.vl }}</span>
                  <span v-if="v.actual_value">факт: {{ v.actual_value.toFixed(2) }}</span>
                  <span v-if="v.expected_max">макс: {{ v.expected_max.toFixed(2) }}</span>
                  <span class="acp-viol-date">{{ fmtDate(v.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Mod snapshots -->
        <section class="acp-section">
          <div class="acp-section-title">
            Клиентские моды
            <span class="acp-section-count">{{ data.snapshots.length }}</span>
          </div>
          <div v-if="data.snapshots.length === 0" class="acp-empty">Снимков нет</div>
          <template v-else>
            <div class="acp-snap-tabs">
              <button
                v-for="(snap, idx) in data.snapshots"
                :key="snap.id"
                class="acp-snap-tab"
                :class="{ 'acp-snap-tab--active': showSnapshotIdx === idx }"
                @click="showSnapshotIdx = idx"
              >
                {{ fmtDate(snap.created_at) }}
                <span v-if="snap.suspicious_mods.length > 0" class="acp-snap-warn">⚠</span>
              </button>
            </div>

            <div v-if="data.snapshots[showSnapshotIdx]" class="acp-snap-detail">
              <div class="acp-snap-row">
                <span class="acp-snap-lbl">Ресурспак:</span>
                <span :class="data.snapshots[showSnapshotIdx].resource_pack_status === 'SUCCESSFULLY_LOADED' ? 'acp-ok' : 'acp-neutral'">
                  {{ data.snapshots[showSnapshotIdx].resource_pack_status }}
                </span>
              </div>
              <div class="acp-snap-row">
                <span class="acp-snap-lbl">Верифицирован:</span>
                <span :class="data.snapshots[showSnapshotIdx].is_verified ? 'acp-ok' : 'acp-warn'">
                  {{ data.snapshots[showSnapshotIdx].is_verified ? 'Да' : 'Нет' }}
                </span>
              </div>

              <div v-if="data.snapshots[showSnapshotIdx].suspicious_mods.length > 0" class="acp-susp-block">
                <div class="acp-susp-title">Подозрительные моды</div>
                <div v-if="verdictMsg" class="acp-verdict-msg">{{ verdictMsg }}</div>
                <div class="acp-susp-list">
                  <div
                    v-for="m in data.snapshots[showSnapshotIdx].suspicious_mods"
                    :key="m"
                    class="acp-susp-row"
                  >
                    <span class="acp-mod acp-mod--bad">{{ m }}</span>
                    <div v-if="canManage" class="acp-verdict-btns">
                      <button
                        class="acp-vbtn acp-vbtn--cheat"
                        :disabled="verdictLoading[m + 'CHEAT']"
                        @click="setVerdict(m.split(':')[0], 'CHEAT')"
                        title="Это чит — всегда флагировать"
                      >Это чит</button>
                      <button
                        class="acp-vbtn acp-vbtn--safe"
                        :disabled="verdictLoading[m + 'SAFE']"
                        @click="setVerdict(m.split(':')[0], 'SAFE')"
                        title="Безопасный — больше не флагировать"
                      >Безопасный</button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="acp-all-mods-title">Все моды ({{ data.snapshots[showSnapshotIdx].mods.length }})</div>
              <div class="acp-mod-list acp-mod-list--all">
                <span
                  v-for="m in data.snapshots[showSnapshotIdx].mods"
                  :key="m"
                  class="acp-mod"
                  :class="data.snapshots[showSnapshotIdx].suspicious_mods.includes(m) ? 'acp-mod--bad' : ''"
                >{{ m }}</span>
              </div>
            </div>
          </template>
        </section>
      </div>

      <!-- Injection detection reports -->
      <section v-if="data.injection_reports && data.injection_reports.length > 0" class="acp-section acp-section--inject">
        <div class="acp-section-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Инжект-детекция
          <span class="acp-section-count">{{ data.injection_reports.length }}</span>
        </div>
        <div class="acp-snap-tabs">
          <button
            v-for="(r, idx) in data.injection_reports"
            :key="r.id"
            class="acp-snap-tab"
            :class="{ 'acp-snap-tab--active': showInjectionIdx === idx, 'acp-snap-tab--danger': r.agents_detected || r.suspicious_libraries.length > 0 }"
            @click="showInjectionIdx = idx"
          >
            {{ fmtDate(r.created_at) }}
            <span v-if="r.agents_detected || r.suspicious_libraries.length > 0" class="acp-snap-warn">⚡</span>
          </button>
        </div>
        <div v-if="data.injection_reports[showInjectionIdx]" class="acp-inject-detail">
          <div class="acp-snap-row">
            <span class="acp-snap-lbl">Java-агенты:</span>
            <span :class="data.injection_reports[showInjectionIdx].agents_detected ? 'acp-warn' : 'acp-ok'">
              {{ data.injection_reports[showInjectionIdx].agents_detected ? 'ОБНАРУЖЕНЫ' : 'Нет' }}
            </span>
          </div>
          <div v-if="data.injection_reports[showInjectionIdx].java_agents.length > 0" class="acp-inject-list">
            <div class="acp-inject-subtitle">Агенты:</div>
            <span
              v-for="a in data.injection_reports[showInjectionIdx].java_agents"
              :key="a"
              class="acp-mod acp-mod--bad"
            >{{ a }}</span>
          </div>
          <div v-if="data.injection_reports[showInjectionIdx].suspicious_libraries.length > 0" class="acp-inject-list">
            <div class="acp-inject-subtitle">Подозрит. библиотеки:</div>
            <span
              v-for="lib in data.injection_reports[showInjectionIdx].suspicious_libraries"
              :key="lib"
              class="acp-mod acp-mod--bad"
            >{{ lib }}</span>
          </div>
          <div v-if="!data.injection_reports[showInjectionIdx].agents_detected && data.injection_reports[showInjectionIdx].suspicious_libraries.length === 0" class="acp-ok" style="font-size:0.82rem;padding:0.25rem 0;">
            Признаков инъекции не обнаружено
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }





.acp-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.acp-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--adm-acc), rgba(var(--adm-acc-rgb), 0.55));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  font-weight: 900;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 20px rgba(var(--adm-acc-rgb), 0.35);
}

.acp-nick {
  font-size: 1.3rem;
  font-weight: 800;
  margin: 0 0 0.15rem;
  color: var(--adm-text);
}

.acp-uuid {
  font-size: 0.72rem;
  color: var(--adm-faint);
  font-family: monospace;
  margin-bottom: 0.3rem;
}

.acp-status {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: var(--adm-r-sm);
  display: inline-block;
}

.acp-status--on { background: rgba(34,197,94,0.1); color: #4ade80; }
.acp-status--off { background: rgba(239,68,68,0.1); color: #f87171; }

.acp-stats {
  margin-left: auto;
  display: flex;
  gap: 1.2rem;
}

.acp-stat { text-align: center; }
.acp-stat__val { font-size: 1.5rem; font-weight: 900; color: var(--adm-text); }
.acp-stat__val--danger { color: #f87171; }
.acp-stat__lbl { font-size: 0.7rem; color: var(--adm-faint); font-weight: 700; text-transform: uppercase; }

/* Rollback */
.acp-actions-row + .acp-actions-row { margin-top: 0.6rem; }
.acp-rb-hint { margin: -0.25rem 0 0.75rem; font-size: 0.78rem; color: var(--adm-dim); line-height: 1.45; }
.acp-rb-field { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.76rem; color: var(--adm-dim); }
.acp-rb-num { width: 6.5rem; }
.acp-rb-world { width: 9rem; }
.acp-rb-list { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; border-top: 1px solid var(--adm-line); padding-top: 0.75rem; }
.acp-rb-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.6rem; }
.acp-rb-what { font-size: 0.82rem; color: var(--adm-text); }
.acp-rb-meta { font-size: 0.72rem; color: var(--adm-faint); margin-left: auto; }
.acp-rb-result { flex-basis: 100%; font-size: 0.78rem; color: var(--adm-dim); padding-left: 0.25rem; }
.acp-rb-result--err { color: #f87171; }

/* Actions card */
.acp-actions-card {
  background: rgba(148, 163, 184, 0.03);
  border: 1px solid var(--adm-line);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.acp-actions-title {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--adm-faint);
  margin-bottom: 0.75rem;
}

.acp-actions-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  align-items: center;
}

/* input inherits adm-input; just size it inside the actions row */
.acp-reason-input { flex: 1; min-width: 180px; }

.acp-action-ok { margin-top: 0.5rem; font-size: 0.8rem; color: #4ade80; }
.acp-action-err { margin-top: 0.5rem; font-size: 0.8rem; color: #f87171; }

/* Grid layout */
.acp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 900px) { .acp-grid { grid-template-columns: 1fr; } }

.acp-section {
  background: rgba(148, 163, 184, 0.03);
  border: 1px solid var(--adm-line);
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.acp-section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--adm-dim);
  margin-bottom: 1rem;
}

.acp-section-count {
  background: var(--adm-acc-soft);
  color: var(--adm-acc-text);
  padding: 0.1rem 0.4rem;
  border-radius: var(--adm-r-sm);
  font-size: 0.72rem;
}

.acp-empty { color: var(--adm-faint); font-size: 0.85rem; padding: 0.5rem 0; }

/* Timeline */
.acp-timeline { display: flex; flex-direction: column; gap: 0.7rem; max-height: 600px; overflow-y: auto; }

.acp-viol {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.025);
  border: 1px solid rgba(148,163,184,0.05);
  transition: opacity 0.15s;
}

.acp-viol--reviewed { opacity: 0.45; }

.acp-viol-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 0.3rem;
}

.sev--high { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.5); }
.sev--med { background: #eab308; box-shadow: 0 0 6px rgba(234,179,8,0.4); }
.sev--low { background: #64748b; }

.acp-viol-body { flex: 1; min-width: 0; }

.acp-viol-top { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.2rem; }

.acp-check-type { font-weight: 700; font-size: 0.85rem; color: #cbd5e1; }

.acp-sev-badge {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.acp-sev-badge.sev--high { background: rgba(239,68,68,0.15); color: #f87171; }
.acp-sev-badge.sev--med { background: rgba(234,179,8,0.12); color: #facc15; }
.acp-sev-badge.sev--low { background: rgba(100,116,139,0.12); color: var(--adm-mut); }

.acp-reviewed-tag { font-size: 0.68rem; color: var(--adm-ok); margin-left: auto; }

.acp-viol-details { font-size: 0.78rem; color: var(--adm-mut); margin-bottom: 0.2rem; }

.acp-viol-meta {
  display: flex;
  gap: 0.6rem;
  font-size: 0.72rem;
  color: var(--adm-faint);
  flex-wrap: wrap;
}

.acp-viol-date { margin-left: auto; }

/* Snapshots */
.acp-snap-tabs {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.acp-snap-tab {
  padding: 0.3rem 0.65rem;
  border-radius: var(--adm-r-sm);
  background: rgba(148,163,184,0.04);
  border: 1px solid var(--adm-line);
  color: var(--adm-mut);
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.acp-snap-tab:hover { background: var(--adm-line); color: var(--adm-mut); }
.acp-snap-tab--active { background: var(--adm-acc-soft); color: var(--adm-acc-text); border-color: var(--adm-acc-line); }

.acp-snap-warn { margin-left: 0.25rem; color: #f97316; }

.acp-snap-detail { font-size: 0.82rem; }

.acp-snap-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.3rem;
}

.acp-snap-lbl { color: var(--adm-dim); font-weight: 600; min-width: 8rem; }
.acp-ok { color: #4ade80; }
.acp-warn { color: #f97316; }
.acp-neutral { color: var(--adm-mut); }

.acp-susp-block {
  margin: 0.75rem 0;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  background: rgba(239,68,68,0.06);
  border: 1px solid rgba(239,68,68,0.15);
}

.acp-susp-title { font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #f87171; margin-bottom: 0.5rem; letter-spacing: 0.05em; }

.acp-all-mods-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--adm-faint); margin: 0.75rem 0 0.4rem; letter-spacing: 0.05em; }

.acp-mod-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.acp-mod-list--all { max-height: 200px; overflow-y: auto; }

.acp-mod {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 5px;
  font-size: 0.75rem;
  background: rgba(148,163,184,0.05);
  color: var(--adm-mut);
  border: 1px solid var(--adm-line);
  font-family: monospace;
}

.acp-mod--bad { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.2); }

/* Suspicious mod row with verdict buttons */
.acp-susp-list { display: flex; flex-direction: column; gap: 0.4rem; }
.acp-susp-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.acp-verdict-btns { display: flex; gap: 0.3rem; margin-left: auto; }
.acp-vbtn {
  padding: 0.2rem 0.55rem;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.12s;
}
.acp-vbtn:disabled { opacity: 0.45; cursor: not-allowed; }
.acp-vbtn--cheat { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.25); color: #f87171; }
.acp-vbtn--cheat:hover:not(:disabled) { background: rgba(239,68,68,0.22); }
.acp-vbtn--safe { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.2); color: #4ade80; }
.acp-vbtn--safe:hover:not(:disabled) { background: rgba(34,197,94,0.2); }
.acp-verdict-msg { font-size: 0.78rem; color: var(--adm-acc-text); margin-bottom: 0.4rem; }

/* Injection detection section */
.acp-section--inject {
  margin-top: 1.25rem;
  border-color: rgba(251,191,36,0.15);
}
.acp-snap-tab--danger { border-color: rgba(251, 191, 36, 0.3); color: var(--adm-warn); }
.acp-inject-detail { font-size: 0.82rem; padding-top: 0.25rem; }
.acp-inject-list { margin: 0.5rem 0; }
.acp-inject-subtitle { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--adm-dim); margin-bottom: 0.3rem; letter-spacing: 0.05em; }

/* States */
.acp-alert {
  margin-top: 1rem;
  padding: 0.7rem 1rem;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: var(--adm-r-sm);
  color: #fca5a5;
  font-size: 0.83rem;
  font-weight: 600;
}
</style>
