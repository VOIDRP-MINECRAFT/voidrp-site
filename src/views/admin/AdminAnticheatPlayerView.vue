<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { anticheatGetPlayer, anticheatPlayerAction, anticheatSetModVerdict, anticheatDeleteModVerdict } from '../../services/adminAnticheatApi.js'
import { authState } from '../../stores/authStore'

const route = useRoute()
const router = useRouter()
const token = () => authState.accessToken

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

onMounted(load)

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
  <div class="acp-page">
    <button class="acp-back" @click="router.push({ name: 'admin-anticheat' })">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      Назад к списку
    </button>

    <div v-if="loading" class="acp-loading">
      <span class="acp-spinner acp-spinner--lg" />
      Загрузка...
    </div>

    <div v-else-if="error" class="acp-error">{{ error }}</div>

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

      <!-- Actions -->
      <div class="acp-actions-card">
        <div class="acp-actions-title">Действия</div>
        <div class="acp-actions-row">
          <input v-model="actionReason" class="acp-reason-input" placeholder="Причина (необязательно)" />
          <button class="acp-action-btn acp-action-btn--kick" :disabled="actionLoading" @click="doAction('kick')">Кикнуть</button>
          <button
            v-if="data.account_active !== false"
            class="acp-action-btn acp-action-btn--disable"
            :disabled="actionLoading || data.account_active === null"
            @click="doAction('disable')"
          >Заблокировать аккаунт</button>
          <button
            v-else
            class="acp-action-btn acp-action-btn--enable"
            :disabled="actionLoading"
            @click="doAction('enable')"
          >Разблокировать аккаунт</button>
          <button class="acp-action-btn acp-action-btn--clear" :disabled="actionLoading" @click="doAction('clear_violations')">Снять все нарушения</button>
        </div>
        <div v-if="actionMsg" class="acp-action-ok">{{ actionMsg }}</div>
        <div v-if="actionErr" class="acp-action-err">{{ actionErr }}</div>
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
                  <span class="acp-sev-badge" :class="severityClass(v.severity)">{{ v.severity }}</span>
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
                    <div class="acp-verdict-btns">
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

.acp-page {
  padding: 1.5rem 1.75rem;
  color: #e2e8f0;
  min-height: 100vh;
}

.acp-back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0 0 1.2rem;
  transition: color 0.13s;
}

.acp-back:hover { color: #94a3b8; }

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
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  font-weight: 900;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 20px rgba(124,58,237,0.35);
}

.acp-nick {
  font-size: 1.3rem;
  font-weight: 800;
  margin: 0 0 0.15rem;
  color: #e2e8f0;
}

.acp-uuid {
  font-size: 0.72rem;
  color: #334155;
  font-family: monospace;
  margin-bottom: 0.3rem;
}

.acp-status {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
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
.acp-stat__val { font-size: 1.5rem; font-weight: 900; color: #e2e8f0; }
.acp-stat__val--danger { color: #f87171; }
.acp-stat__lbl { font-size: 0.7rem; color: #334155; font-weight: 700; text-transform: uppercase; }

/* Actions card */
.acp-actions-card {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.acp-actions-title {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #334155;
  margin-bottom: 0.75rem;
}

.acp-actions-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  align-items: center;
}

.acp-reason-input {
  flex: 1;
  min-width: 180px;
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #e2e8f0;
  font-size: 0.82rem;
  outline: none;
}

.acp-reason-input::placeholder { color: #334155; }
.acp-reason-input:focus { border-color: rgba(124,58,237,0.4); }

.acp-action-btn {
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.13s, opacity 0.13s;
}

.acp-action-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.acp-action-btn--kick { background: rgba(234,179,8,0.12); border-color: rgba(234,179,8,0.2); color: #facc15; }
.acp-action-btn--kick:hover:not(:disabled) { background: rgba(234,179,8,0.2); }

.acp-action-btn--disable { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.2); color: #f87171; }
.acp-action-btn--disable:hover:not(:disabled) { background: rgba(239,68,68,0.2); }

.acp-action-btn--enable { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.2); color: #4ade80; }
.acp-action-btn--enable:hover:not(:disabled) { background: rgba(34,197,94,0.2); }

.acp-action-btn--clear { background: rgba(100,116,139,0.1); border-color: rgba(100,116,139,0.2); color: #64748b; }
.acp-action-btn--clear:hover:not(:disabled) { background: rgba(100,116,139,0.2); }

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
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
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
  color: #475569;
  margin-bottom: 1rem;
}

.acp-section-count {
  background: rgba(124,58,237,0.15);
  color: #a78bfa;
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  font-size: 0.72rem;
}

.acp-empty { color: #334155; font-size: 0.85rem; padding: 0.5rem 0; }

/* Timeline */
.acp-timeline { display: flex; flex-direction: column; gap: 0.7rem; max-height: 600px; overflow-y: auto; }

.acp-viol {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
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
.acp-sev-badge.sev--low { background: rgba(100,116,139,0.12); color: #64748b; }

.acp-reviewed-tag { font-size: 0.68rem; color: #22c55e; margin-left: auto; }

.acp-viol-details { font-size: 0.78rem; color: #64748b; margin-bottom: 0.2rem; }

.acp-viol-meta {
  display: flex;
  gap: 0.6rem;
  font-size: 0.72rem;
  color: #334155;
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
  border-radius: 6px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.acp-snap-tab:hover { background: rgba(255,255,255,0.06); color: #94a3b8; }
.acp-snap-tab--active { background: rgba(124,58,237,0.15); color: #c4b5fd; border-color: rgba(124,58,237,0.25); }

.acp-snap-warn { margin-left: 0.25rem; color: #f97316; }

.acp-snap-detail { font-size: 0.82rem; }

.acp-snap-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.3rem;
}

.acp-snap-lbl { color: #475569; font-weight: 600; min-width: 8rem; }
.acp-ok { color: #4ade80; }
.acp-warn { color: #f97316; }
.acp-neutral { color: #94a3b8; }

.acp-susp-block {
  margin: 0.75rem 0;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  background: rgba(239,68,68,0.06);
  border: 1px solid rgba(239,68,68,0.15);
}

.acp-susp-title { font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #f87171; margin-bottom: 0.5rem; letter-spacing: 0.05em; }

.acp-all-mods-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #334155; margin: 0.75rem 0 0.4rem; letter-spacing: 0.05em; }

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
  background: rgba(255,255,255,0.04);
  color: #64748b;
  border: 1px solid rgba(255,255,255,0.06);
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
.acp-verdict-msg { font-size: 0.78rem; color: #a78bfa; margin-bottom: 0.4rem; }

/* Injection detection section */
.acp-section--inject {
  margin-top: 1.25rem;
  border-color: rgba(251,191,36,0.15);
}
.acp-snap-tab--danger { border-color: rgba(251,191,36,0.3); color: #fbbf24; }
.acp-inject-detail { font-size: 0.82rem; padding-top: 0.25rem; }
.acp-inject-list { margin: 0.5rem 0; }
.acp-inject-subtitle { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 0.3rem; letter-spacing: 0.05em; }

/* States */
.acp-loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 2rem;
  color: #475569;
  font-size: 0.85rem;
}

.acp-error {
  padding: 0.75rem 1rem;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 8px;
  color: #f87171;
  font-size: 0.85rem;
}

.acp-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(167,139,250,0.3);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.acp-spinner--lg { width: 20px; height: 20px; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
