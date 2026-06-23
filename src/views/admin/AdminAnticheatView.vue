<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  anticheatListPlayers,
  anticheatGetConfig,
  anticheatUpdateConfig,
  anticheatGetStats,
} from '../../services/adminAnticheatApi.js'
import { authState } from '../../stores/authStore'

const router = useRouter()
const token = () => authState.accessToken

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref('players')

// ── Players tab ───────────────────────────────────────────────────────────────
const players = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const onlySuspicious = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await anticheatListPlayers(token(), { limit: 200, only_suspicious: onlySuspicious.value })
    players.value = data?.items || []
    total.value = data?.total ?? players.value.length
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
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

onMounted(load)
</script>

<template>
  <div class="ac-page">
    <div class="ac-header">
      <div>
        <h1 class="ac-title">Античит</h1>
        <p class="ac-sub">Мониторинг и настройка защиты</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="ac-tabs">
      <button class="ac-tab" :class="{ 'ac-tab--active': activeTab === 'players' }" @click="switchTab('players')">Игроки</button>
      <button class="ac-tab" :class="{ 'ac-tab--active': activeTab === 'stats' }" @click="switchTab('stats')">Статистика</button>
      <button class="ac-tab" :class="{ 'ac-tab--active': activeTab === 'config' }" @click="switchTab('config')">Настройки</button>
    </div>

    <!-- ── Players ── -->
    <div v-if="activeTab === 'players'">
      <div class="ac-toolbar">
        <label class="ac-toggle">
          <input v-model="onlySuspicious" type="checkbox" @change="load" />
          <span>Только с читами</span>
        </label>
        <button class="ac-btn-refresh" :disabled="loading" @click="load">
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          <span v-if="loading" class="ac-spinner" />
          Обновить
        </button>
      </div>

      <div v-if="error" class="ac-error">{{ error }}</div>

      <div v-if="!loading && players.length === 0 && !error" class="ac-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <p>Нарушений не обнаружено</p>
      </div>

      <div v-else class="ac-table-wrap">
        <table class="ac-table">
          <thead>
            <tr>
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
              class="ac-row"
              :class="'ac-row--' + riskLevel(p)"
              @click="goToPlayer(p.player_uuid)"
            >
              <td class="ac-nick">{{ p.player_nick }}</td>
              <td>
                <span class="ac-badge" :class="'ac-badge--' + riskLevel(p)">{{ riskLabel(p) }}</span>
              </td>
              <td>{{ p.total_violations }}</td>
              <td class="ac-counts">
                <span class="ac-cnt ac-cnt--high">{{ p.high_count }}</span>
                <span class="ac-cnt ac-cnt--med">{{ p.medium_count }}</span>
                <span class="ac-cnt ac-cnt--low">{{ p.low_count }}</span>
              </td>
              <td>
                <span v-if="p.unreviewed_count > 0" class="ac-unreviewed">{{ p.unreviewed_count }}</span>
                <span v-else class="ac-ok">✓</span>
              </td>
              <td>
                <span v-if="p.has_suspicious_mods" class="ac-mods-flag">
                  ⚠ {{ p.suspicious_mod_names.slice(0, 2).join(', ') }}{{ p.suspicious_mod_names.length > 2 ? '…' : '' }}
                </span>
                <span v-else class="ac-ok">—</span>
              </td>
              <td class="ac-date">{{ fmtDate(p.last_violation_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="loading" class="ac-loading">
        <span class="ac-spinner ac-spinner--lg" />
        Загрузка...
      </div>

      <div v-if="!loading && players.length > 0" class="ac-footer">
        Всего игроков: {{ total }}
      </div>
    </div>

    <!-- ── Stats ── -->
    <div v-if="activeTab === 'stats'" class="ac-section">
      <div v-if="statsLoading" class="ac-loading"><span class="ac-spinner ac-spinner--lg" /> Загрузка...</div>
      <div v-if="statsError" class="ac-error">{{ statsError }}</div>

      <div v-if="stats && !statsLoading">
        <div class="ac-stats-summary">
          <div class="ac-stat-card">
            <div class="ac-stat-val">{{ stats.total_violations }}</div>
            <div class="ac-stat-lbl">всего нарушений</div>
          </div>
          <div class="ac-stat-card">
            <div class="ac-stat-val">{{ stats.unique_players }}</div>
            <div class="ac-stat-lbl">уникальных игроков</div>
          </div>
        </div>

        <div class="ac-table-wrap" style="margin-top:1rem">
          <table class="ac-table">
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
              <tr v-for="s in stats.by_check" :key="s.check_type" class="ac-row">
                <td class="ac-nick">{{ s.check_type }}</td>
                <td>{{ s.count }}</td>
                <td>{{ s.min_actual }}</td>
                <td>
                  <span class="ac-stat-avg">{{ s.avg_actual }}</span>
                </td>
                <td>{{ s.max_actual }}</td>
                <td class="ac-date">{{ s.avg_expected_max }}</td>
                <td>
                  <span v-if="s.avg_expected_max > 0" class="ac-exceed"
                    :class="s.avg_actual / s.avg_expected_max > 2 ? 'ac-exceed--high' : 'ac-exceed--med'">
                    ×{{ (s.avg_actual / s.avg_expected_max).toFixed(2) }}
                  </span>
                  <span v-else class="ac-ok">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="ac-stats-hint">
          «Среднее знач.» — среднее фактическое значение среди всех зафиксированных нарушений.
          «Превышение» — во сколько раз среднее превышает порог. Используй для калибровки порогов.
        </p>
      </div>
    </div>

    <!-- ── Config ── -->
    <div v-if="activeTab === 'config'" class="ac-section">
      <div v-if="configLoading" class="ac-loading"><span class="ac-spinner ac-spinner--lg" /> Загрузка...</div>
      <div v-if="configError" class="ac-error">{{ configError }}</div>

      <div v-if="configs.length && !configLoading">
        <p class="ac-config-hint">
          Пороги применяются на сервере автоматически каждые 5 минут без перезагрузки мода.
          Локальный TOML-конфиг используется как запасной вариант при недоступности API.
        </p>

        <div class="ac-config-grid">
          <div v-for="c in configs" :key="c.key" class="ac-config-card">
            <div class="ac-config-header">
              <span class="ac-config-label">{{ c.label }}</span>
              <span class="ac-config-key">{{ c.key }}</span>
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
                :max="c.max_value"
                :step="c.step"
                class="ac-num-input"
              />
            </div>
            <div class="ac-config-range">{{ c.min_value }} — {{ c.max_value }}</div>
            <div v-if="c.updated_by" class="ac-config-meta">
              Изменено: {{ c.updated_by }}
            </div>
          </div>
        </div>

        <div class="ac-config-actions">
          <button class="ac-btn-save" :disabled="configSaving" @click="saveConfig">
            <span v-if="configSaving" class="ac-spinner" />
            {{ configSaving ? 'Сохранение...' : 'Сохранить' }}
          </button>
          <span v-if="configSaved" class="ac-saved-ok">✓ Сохранено. Мод обновится в течение 5 минут.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.ac-page {
  padding: 1.5rem 1.75rem;
  color: #e2e8f0;
  min-height: 100vh;
}

.ac-header {
  margin-bottom: 1.25rem;
}

.ac-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: #e2e8f0;
  margin: 0 0 0.2rem;
}

.ac-sub {
  font-size: 0.8rem;
  color: #475569;
  margin: 0;
}

/* Tabs */
.ac-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  padding-bottom: 0;
}

.ac-tab {
  padding: 0.5rem 1.1rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #475569;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}

.ac-tab:hover { color: #94a3b8; }

.ac-tab--active {
  color: #a78bfa;
  border-bottom-color: #a78bfa;
}

/* Toolbar */
.ac-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.ac-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: #64748b;
  cursor: pointer;
}

.ac-toggle input { accent-color: #7c3aed; }

.ac-btn-refresh {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  background: rgba(124,58,237,0.15);
  border: 1px solid rgba(124,58,237,0.25);
  color: #a78bfa;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.ac-btn-refresh:hover:not(:disabled) { background: rgba(124,58,237,0.25); }
.ac-btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

.ac-error {
  padding: 0.75rem 1rem;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 8px;
  color: #f87171;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.ac-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: #334155;
}

.ac-table-wrap {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
}

.ac-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.845rem;
}

.ac-table thead th {
  padding: 0.65rem 0.9rem;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #334155;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  white-space: nowrap;
}

.ac-row {
  cursor: pointer;
  transition: background 0.12s;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.ac-row:last-child { border-bottom: none; }
.ac-row:hover { background: rgba(255,255,255,0.04); }
.ac-row--high { border-left: 3px solid rgba(239,68,68,0.5); }
.ac-row--medium { border-left: 3px solid rgba(234,179,8,0.5); }
.ac-row--low { border-left: 3px solid rgba(100,116,139,0.4); }
.ac-row--none { border-left: 3px solid transparent; }

.ac-table td {
  padding: 0.7rem 0.9rem;
  color: #94a3b8;
  vertical-align: middle;
}

.ac-nick {
  font-weight: 700;
  color: #e2e8f0 !important;
}

.ac-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ac-badge--high { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
.ac-badge--medium { background: rgba(234,179,8,0.12); color: #facc15; border: 1px solid rgba(234,179,8,0.2); }
.ac-badge--low { background: rgba(100,116,139,0.12); color: #64748b; border: 1px solid rgba(100,116,139,0.2); }
.ac-badge--none { background: rgba(34,197,94,0.1); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }

.ac-counts { display: flex; gap: 0.35rem; align-items: center; }

.ac-cnt {
  display: inline-block;
  min-width: 1.4rem;
  text-align: center;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 700;
}

.ac-cnt--high { background: rgba(239,68,68,0.12); color: #f87171; }
.ac-cnt--med { background: rgba(234,179,8,0.1); color: #facc15; }
.ac-cnt--low { background: rgba(100,116,139,0.1); color: #64748b; }

.ac-unreviewed {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  background: rgba(234,179,8,0.12);
  color: #facc15;
  font-size: 0.78rem;
  font-weight: 700;
}

.ac-ok { color: #334155; font-size: 0.82rem; }

.ac-mods-flag {
  color: #f97316;
  font-size: 0.8rem;
  font-weight: 600;
}

.ac-date { font-size: 0.78rem; color: #475569 !important; white-space: nowrap; }

.ac-loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 2rem;
  color: #475569;
  font-size: 0.85rem;
}

.ac-footer {
  padding: 0.75rem 0.25rem;
  font-size: 0.78rem;
  color: #334155;
  text-align: right;
}

.ac-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(167,139,250,0.3);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.ac-spinner--lg { width: 20px; height: 20px; }

@keyframes spin { to { transform: rotate(360deg); } }

/* Section wrapper */
.ac-section { padding-top: 0.25rem; }

/* Stats */
.ac-stats-summary {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.ac-stat-card {
  padding: 1rem 1.5rem;
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  min-width: 140px;
}

.ac-stat-val {
  font-size: 1.75rem;
  font-weight: 800;
  color: #a78bfa;
}

.ac-stat-lbl {
  font-size: 0.75rem;
  color: #475569;
  margin-top: 0.2rem;
}

.ac-stat-avg {
  font-weight: 700;
  color: #e2e8f0;
}

.ac-exceed {
  display: inline-block;
  padding: 0.15rem 0.4rem;
  border-radius: 5px;
  font-size: 0.78rem;
  font-weight: 700;
}

.ac-exceed--high { background: rgba(239,68,68,0.15); color: #f87171; }
.ac-exceed--med { background: rgba(234,179,8,0.1); color: #facc15; }

.ac-stats-hint {
  margin-top: 0.75rem;
  font-size: 0.78rem;
  color: #334155;
  line-height: 1.5;
}

/* Config */
.ac-config-hint {
  font-size: 0.82rem;
  color: #475569;
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

.ac-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.ac-config-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 1rem 1.1rem;
}

.ac-config-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.ac-config-label {
  font-weight: 700;
  font-size: 0.88rem;
  color: #e2e8f0;
}

.ac-config-key {
  font-size: 0.7rem;
  color: #334155;
  font-family: monospace;
}

.ac-config-desc {
  font-size: 0.78rem;
  color: #475569;
  margin: 0 0 0.75rem;
  line-height: 1.4;
}

.ac-config-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ac-slider {
  flex: 1;
  accent-color: #7c3aed;
  cursor: pointer;
}

.ac-num-input {
  width: 72px;
  padding: 0.3rem 0.45rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 0.85rem;
  text-align: right;
}

.ac-num-input:focus { outline: none; border-color: rgba(124,58,237,0.5); }

.ac-config-range {
  font-size: 0.7rem;
  color: #334155;
  margin-top: 0.3rem;
}

.ac-config-meta {
  font-size: 0.7rem;
  color: #334155;
  margin-top: 0.2rem;
}

.ac-config-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.ac-btn-save {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.4rem;
  border-radius: 8px;
  background: rgba(124,58,237,0.2);
  border: 1px solid rgba(124,58,237,0.35);
  color: #a78bfa;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}

.ac-btn-save:hover:not(:disabled) { background: rgba(124,58,237,0.3); }
.ac-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

.ac-saved-ok {
  font-size: 0.82rem;
  color: #4ade80;
  font-weight: 600;
}
</style>
