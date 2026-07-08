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
  <div class="adm-page">
    <!-- Header -->
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Battle Pass</h1>
        <p class="adm-sub">Premium-подписки выбранного сервера</p>
      </div>
      <button class="adm-btn" @click="loadAll">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Обновить
      </button>
    </div>

    <!-- Stats -->
    <div v-if="loadingStats" class="adm-skel" style="height: 72px" />
    <div v-else class="grid grid-cols-2 gap-3" style="max-width: 460px">
      <div class="adm-kpi adm-kpi--acc"><div><div class="adm-kpi__val" style="color: var(--adm-acc-text)">{{ stats?.active_premium_count ?? '—' }}</div><div class="adm-kpi__label">Активных Premium</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val">{{ stats?.total_premium_count ?? '—' }}</div><div class="adm-kpi__label">Всего выдано</div></div></div>
    </div>

    <!-- Grant form -->
    <div class="adm-card adm-card--pad">
      <div class="adm-label">Выдать Premium</div>
      <div class="grant-form">
        <input v-model="grantForm.minecraft_uuid" class="adm-input adm-mono grant-form__uuid" placeholder="Minecraft UUID" spellcheck="false" />
        <input v-model="grantForm.minecraft_nickname" class="adm-input grant-form__nick" placeholder="Никнейм" spellcheck="false" />
        <input v-model.number="grantForm.days" class="adm-input grant-form__days" type="number" min="1" placeholder="Дней" />
        <input v-model="grantForm.note" class="adm-input grant-form__note" placeholder="Примечание (необязательно)" />
        <button class="adm-btn adm-btn--acc" :disabled="grantLoading" @click="doGrant">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          {{ grantLoading ? 'Выдаётся...' : 'Выдать Premium' }}
        </button>
      </div>
      <div v-if="grantMsg" class="notice notice--ok">{{ grantMsg }}</div>
      <div v-if="grantError" class="notice notice--err">{{ grantError }}</div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <label class="adm-check">
        <input v-model="activeOnly" type="checkbox" @change="onActiveOnlyChange" />
        <span>Только активные</span>
      </label>
      <span class="filters__hint">Всего: {{ totalCount }}</span>
    </div>

    <!-- Table -->
    <div v-if="loadingList" class="adm-skel" style="height: 280px" />
    <div v-else-if="premiumList.length" class="adm-table-wrap">
      <div class="adm-table-scroll">
        <table class="adm-table" style="white-space: nowrap">
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
              :class="{ 'row--dim': !entry.is_active, 'row--loading': revokeLoading === entry.minecraft_uuid }"
            >
              <td class="cell-nick adm-mono">{{ entry.minecraft_nickname || '—' }}</td>
              <td class="cell-uuid adm-mono">{{ entry.minecraft_uuid }}</td>
              <td class="adm-num" style="color: var(--adm-mut)">{{ fmtDate(entry.expires_at) }}</td>
              <td style="color: var(--adm-dim)">{{ entry.granted_by || '—' }}</td>
              <td class="cell-note">{{ entry.note || '—' }}</td>
              <td>
                <span class="adm-badge" :class="entry.is_active ? 'adm-badge--ok' : 'adm-badge--err'">
                  {{ entry.is_active ? 'Активен' : 'Истёк' }}
                </span>
              </td>
              <td>
                <button
                  class="adm-btn adm-btn--danger adm-btn--sm"
                  :disabled="revokeLoading === entry.minecraft_uuid || !entry.is_active"
                  @click="doRevoke(entry.minecraft_uuid, entry.minecraft_nickname)"
                >Отозвать</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="adm-empty">
      <div class="adm-empty__title">Нет записей</div>
      <div class="adm-empty__sub">На этом сервере Premium ещё никому не выдавался</div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages() > 1" class="adm-pager" style="justify-content: center">
      <button class="adm-btn adm-btn--sm" :disabled="skip === 0" @click="prevPage">← Назад</button>
      <span class="adm-pager__info">Стр. {{ currentPage() }} / {{ totalPages() }}</span>
      <button class="adm-btn adm-btn--sm" :disabled="skip + limit >= totalCount" @click="nextPage">Вперёд →</button>
    </div>
  </div>
</template>

<style scoped>
.notice {
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-top: 0.65rem;
}
.notice--ok { background: rgba(52, 211, 153, 0.1); color: #6ee7b7; }
.notice--err { background: rgba(248, 113, 113, 0.1); color: #fca5a5; }

.grant-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.grant-form__uuid { flex: 1.4; min-width: 220px; }
.grant-form__nick { flex: 1; min-width: 140px; }
.grant-form__days { flex: 0 0 90px; min-width: 90px; }
.grant-form__note { flex: 2; min-width: 200px; }

.filters { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
.filters__hint { font-size: 0.72rem; color: var(--adm-faint); font-style: italic; margin-left: auto; }

.row--dim { opacity: 0.45; }
.row--loading { opacity: 0.6; pointer-events: none; }

.cell-nick { font-weight: 800; color: var(--adm-acc-text); }
.cell-uuid { font-size: 0.72rem; color: var(--adm-dim); max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.cell-note { max-width: 160px; overflow: hidden; text-overflow: ellipsis; color: var(--adm-dim); }
</style>
