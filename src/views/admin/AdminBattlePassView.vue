<script setup>
import { onMounted, ref } from 'vue'
import {
  adminGetBattlePassStats,
  adminListBattlePassPremium,
  adminGrantBattlePassPremium,
  adminRevokeBattlePassPremium,
} from '../../services/battlepassAdminApi'
import { authState } from '../../stores/authStore'

const token = () => authState.accessToken

// Stats
const stats = ref(null)
const loadingStats = ref(true)

// Premium list
const premiumList = ref([])
const loadingList = ref(true)
const totalCount = ref(0)
const activeOnly = ref(false)
const skip = ref(0)
const limit = 20

// Grant form
const grantForm = ref({ minecraft_uuid: '', minecraft_nickname: '', days: 30, note: '' })
const grantLoading = ref(false)
const grantMsg = ref('')
const grantError = ref('')

// Revoke
const revokeLoading = ref(null)

async function loadStats() {
  loadingStats.value = true
  try { stats.value = await adminGetBattlePassStats(token()) }
  catch { stats.value = null }
  finally { loadingStats.value = false }
}

async function loadList() {
  loadingList.value = true
  try {
    const params = { skip: skip.value, limit }
    if (activeOnly.value) params.active_only = true
    const data = await adminListBattlePassPremium(token(), params)
    premiumList.value = data?.items || data || []
    totalCount.value = data?.total ?? premiumList.value.length
  } catch {
    premiumList.value = []
    totalCount.value = 0
  } finally {
    loadingList.value = false
  }
}

async function loadAll() {
  await Promise.all([loadStats(), loadList()])
}

async function doGrant() {
  grantMsg.value = ''
  grantError.value = ''
  if (!grantForm.value.minecraft_uuid.trim()) { grantError.value = 'UUID обязателен'; return }
  if (!grantForm.value.minecraft_nickname.trim()) { grantError.value = 'Никнейм обязателен'; return }
  if (!grantForm.value.days || grantForm.value.days < 1) { grantError.value = 'Укажите количество дней'; return }
  grantLoading.value = true
  try {
    await adminGrantBattlePassPremium(token(), {
      minecraft_uuid: grantForm.value.minecraft_uuid.trim(),
      minecraft_nickname: grantForm.value.minecraft_nickname.trim(),
      days: Number(grantForm.value.days),
      note: grantForm.value.note.trim() || undefined,
    })
    grantMsg.value = `✓ Premium выдан игроку ${grantForm.value.minecraft_nickname}`
    grantForm.value = { minecraft_uuid: '', minecraft_nickname: '', days: 30, note: '' }
    skip.value = 0
    await loadAll()
  } catch (e) {
    grantError.value = '✗ ' + (e.message || 'Ошибка при выдаче')
  } finally {
    grantLoading.value = false
  }
}

async function doRevoke(uuid, nickname) {
  if (!confirm(`Отозвать Premium у ${nickname}?`)) return
  revokeLoading.value = uuid
  try {
    await adminRevokeBattlePassPremium(token(), uuid)
    await loadAll()
  } catch (e) {
    alert('Ошибка: ' + (e.message || 'Не удалось отозвать'))
  } finally {
    revokeLoading.value = null
  }
}

function onActiveOnlyChange() {
  skip.value = 0
  loadList()
}

function prevPage() {
  if (skip.value === 0) return
  skip.value = Math.max(0, skip.value - limit)
  loadList()
}

function nextPage() {
  if (skip.value + limit >= totalCount.value) return
  skip.value += limit
  loadList()
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const currentPage = () => Math.floor(skip.value / limit) + 1
const totalPages = () => Math.max(1, Math.ceil(totalCount.value / limit))

onMounted(loadAll)
</script>

<template>
  <div class="ap">
    <!-- Header -->
    <div class="ap__header">
      <div>
        <h1 class="ap__title">Battle Pass</h1>
        <p class="ap__sub">Управление Premium-подписками</p>
      </div>
      <button class="btn btn--ghost btn--sm" @click="loadAll">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Обновить
      </button>
    </div>

    <!-- Stats -->
    <div v-if="loadingStats" class="skel skel--cards" />
    <div v-else class="stats-row">
      <div class="stat stat--accent">
        <div class="stat__l">Активных Premium</div>
        <div class="stat__v">{{ stats?.active_premium_count ?? '—' }}</div>
      </div>
      <div class="stat">
        <div class="stat__l">Всего выдано</div>
        <div class="stat__v">{{ stats?.total_premium_count ?? '—' }}</div>
      </div>
    </div>

    <!-- Grant form -->
    <div class="section">
      <div class="section__head">Выдать Premium</div>
      <div class="grant-form">
        <input
          v-model="grantForm.minecraft_uuid"
          class="inp"
          placeholder="Minecraft UUID"
          spellcheck="false"
        />
        <input
          v-model="grantForm.minecraft_nickname"
          class="inp"
          placeholder="Никнейм"
          spellcheck="false"
        />
        <input
          v-model.number="grantForm.days"
          class="inp inp--narrow"
          type="number"
          min="1"
          placeholder="Дней"
        />
        <input
          v-model="grantForm.note"
          class="inp inp--wide"
          placeholder="Примечание (необязательно)"
        />
        <button class="btn btn--primary" :disabled="grantLoading" @click="doGrant">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          {{ grantLoading ? 'Выдаётся...' : 'Выдать Premium' }}
        </button>
      </div>
      <div v-if="grantMsg" class="notice notice--ok">{{ grantMsg }}</div>
      <div v-if="grantError" class="notice notice--err">{{ grantError }}</div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <label class="checkbox-label">
        <input
          v-model="activeOnly"
          type="checkbox"
          class="checkbox"
          @change="onActiveOnlyChange"
        />
        <span>Только активные</span>
      </label>
      <span class="filters__hint">Всего: {{ totalCount }}</span>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div v-if="loadingList" class="skel skel--tall" />
      <table v-else-if="premiumList.length" class="tbl">
        <thead>
          <tr>
            <th>Никнейм</th>
            <th>UUID</th>
            <th>Истекает</th>
            <th>Выдал</th>
            <th>Примечание</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in premiumList"
            :key="entry.minecraft_uuid"
            :class="{ 'tbl__row--dim': !entry.is_active, 'tbl__row--loading': revokeLoading === entry.minecraft_uuid }"
          >
            <td class="tbl__nick">{{ entry.minecraft_nickname || '—' }}</td>
            <td class="tbl__uuid">{{ entry.minecraft_uuid }}</td>
            <td class="tbl__date">{{ fmtDate(entry.expires_at) }}</td>
            <td class="tbl__issuer">{{ entry.granted_by || '—' }}</td>
            <td class="tbl__note">{{ entry.note || '—' }}</td>
            <td>
              <span class="badge" :class="entry.is_active ? 'badge--green' : 'badge--red'">
                {{ entry.is_active ? 'Активен' : 'Истёк' }}
              </span>
            </td>
            <td>
              <button
                class="btn btn--danger btn--xs"
                :disabled="revokeLoading === entry.minecraft_uuid || !entry.is_active"
                @click="doRevoke(entry.minecraft_uuid, entry.minecraft_nickname)"
              >Отозвать</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">Нет записей</div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages() > 1" class="pagination">
      <button class="btn btn--ghost btn--sm" :disabled="skip === 0" @click="prevPage">← Назад</button>
      <span class="pagination__info">Стр. {{ currentPage() }} / {{ totalPages() }}</span>
      <button class="btn btn--ghost btn--sm" :disabled="skip + limit >= totalCount" @click="nextPage">Вперёд →</button>
    </div>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.ap { padding: 1.75rem 1.5rem 3rem; max-width: 100%; }

.ap__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.1rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.ap__title { font-size: 1.4rem; font-weight: 800; color: #e2e8f0; margin: 0; }
.ap__sub { font-size: 0.75rem; color: #475569; margin: 0.15rem 0 0; }

.notice {
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-top: 0.65rem;
}
.notice--ok { background: rgba(34,197,94,0.1); color: #86efac; }
.notice--err { background: rgba(239,68,68,0.1); color: #fca5a5; }

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.stat {
  background: linear-gradient(145deg, #0f1628 0%, #0a1020 100%);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 13px;
  padding: 0.95rem 1rem;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.stat:hover {
  transform: translateY(-2px);
  border-color: rgba(255,255,255,0.1);
  box-shadow: 0 8px 20px rgba(0,0,0,0.25);
}

.stat--accent {
  border-color: rgba(124,58,237,0.2);
  background: linear-gradient(145deg, #130f22 0%, #0d0a1d 100%);
}

.stat--accent:hover { border-color: rgba(124,58,237,0.35); box-shadow: 0 8px 20px rgba(124,58,237,0.1); }

.stat__l {
  font-size: .75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #3d4f6e;
  margin-bottom: 0.35rem;
}

.stat__v {
  font-size: 1.5rem;
  font-weight: 900;
  color: #e2e8f0;
  line-height: 1;
}

.stat--accent .stat__v { color: #c4b5fd; }

/* Section */
.section {
  background: linear-gradient(145deg, #0f1628 0%, #0a1020 100%);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 1rem 1.1rem;
  margin-bottom: 1.1rem;
}

.section__head {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #3d4f6e;
  margin-bottom: 0.75rem;
}

/* Grant form */
.grant-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

/* Filters */
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: #94a3b8;
  user-select: none;
}

.checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #7c3aed;
  cursor: pointer;
}

.filters__hint { font-size: .75rem; color: #334155; font-style: italic; margin-left: auto; }

/* Inputs */
.inp, .sel {
  padding: 0.42rem 0.75rem;
  background: #0d1422;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.13s;
  flex: 1;
  min-width: 160px;
}
.inp:focus { border-color: rgba(124,58,237,0.45); }
.inp--narrow { flex: 0 0 90px; min-width: 90px; }
.inp--wide { flex: 2; min-width: 200px; }
.sel option { background: #0d1422; }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.85rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: background 0.13s, opacity 0.13s;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn--primary { background: #7c3aed; color: #fff; }
.btn--primary:hover:not(:disabled) { background: #6d28d9; }
.btn--ghost { background: rgba(255,255,255,0.05); color: #94a3b8; }
.btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
.btn--danger { background: rgba(239,68,68,0.12); color: #fca5a5; }
.btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.22); }
.btn--sm { padding: 0.38rem 0.75rem; font-size: 0.78rem; }
.btn--xs { padding: 0.25rem 0.55rem; font-size: .75rem; }

/* Table wrap */
.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.06);
  background: #0a1020;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
  white-space: nowrap;
}

.tbl thead th {
  padding: 0.58rem 0.8rem;
  text-align: left;
  font-size: .75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #2d3e5c;
  background: linear-gradient(0deg, #0a1020 0%, #0d1428 100%);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  position: sticky;
  top: 0;
}

.tbl tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.1s; }
.tbl tbody tr:last-child { border-bottom: none; }
.tbl tbody tr:hover { background: rgba(124,58,237,0.04); }
.tbl__row--dim { opacity: 0.45; }
.tbl__row--loading { opacity: 0.6; pointer-events: none; }

.tbl td { padding: 0.5rem 0.8rem; color: #64748b; vertical-align: middle; }

.tbl__nick { font-weight: 800; color: #c4b5fd !important; }
.tbl__uuid { font-family: monospace; font-size: .73rem; color: #475569 !important; max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.tbl__date { color: #94a3b8 !important; }
.tbl__issuer { color: #64748b !important; }
.tbl__note { max-width: 160px; overflow: hidden; text-overflow: ellipsis; color: #475569 !important; }

.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: .75rem; font-weight: 800; }
.badge--green { background: rgba(34,197,94,0.1); color: #86efac; }
.badge--red { background: rgba(239,68,68,0.1); color: #fca5a5; }

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.85rem;
  justify-content: center;
}

.pagination__info { font-size: 0.78rem; color: #475569; font-weight: 600; }

/* Skeleton */
.skel {
  border-radius: 12px;
  background: linear-gradient(90deg, #0d1422 25%, #121929 50%, #0d1422 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
.skel--cards { height: 72px; margin-bottom: 1.25rem; }
.skel--tall { height: 280px; }

@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty { color: #334155; font-size: 0.83rem; padding: 2rem; text-align: center; }

@media (max-width: 600px) { .ap { padding: 1rem 0.75rem 2rem; } }
</style>
