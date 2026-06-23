<script setup>
import { onMounted, ref } from 'vue'
import { adminListPlayers, adminPatchLegacy } from '../../services/adminApi'
import { adminGetBattlePassPlayerByNick, adminGrantBattlePassPremium, adminRevokeBattlePassPremium, adminRevokeBattlePassPremiumByNick } from '../../services/battlepassAdminApi'
import { authState } from '../../stores/authStore'

const token = () => authState.accessToken

const items = ref([])
const total = ref(0)
const loading = ref(true)
const search = ref('')
const filterLegacy = ref('')
const filterActive = ref('')

const modal = ref(null)
const actionLoading = ref(false)
const actionMsg = ref('')
const actionErr = ref('')

// Battle Pass section
const bpInfo = ref(null)
const bpLoading = ref(false)
const bpDays = ref(30)
const bpNote = ref('')
const bpMsg = ref('')
const bpErr = ref('')
const bpManualUuid = ref('')

async function load() {
  loading.value = true
  try {
    const params = { limit: 100 }
    if (search.value) params.q = search.value
    if (filterLegacy.value !== '') params.legacy_auth_enabled = filterLegacy.value
    if (filterActive.value !== '') params.user_active = filterActive.value
    const data = await adminListPlayers(token(), params)
    items.value = data?.items || []
    total.value = data?.total ?? items.value.length
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

function openModal(item) {
  modal.value = item
  actionMsg.value = ''
  actionErr.value = ''
  bpInfo.value = null
  bpMsg.value = ''
  bpErr.value = ''
  bpDays.value = 30
  bpNote.value = ''
  bpManualUuid.value = ''
  void loadBpInfo(item.player_account.minecraft_nickname)
}

async function loadBpInfo(nickname) {
  bpLoading.value = true
  try {
    bpInfo.value = await adminGetBattlePassPlayerByNick(token(), nickname)
  } catch {
    bpInfo.value = null
  } finally {
    bpLoading.value = false
  }
}

async function grantBp() {
  if (!bpInfo.value) return
  const nickname = modal.value.player_account.minecraft_nickname
  const uuid = bpInfo.value.minecraft_uuid || bpManualUuid.value.trim()
  if (!uuid) { bpErr.value = 'Введите UUID игрока вручную'; return }
  bpLoading.value = true
  bpMsg.value = ''
  bpErr.value = ''
  try {
    await adminGrantBattlePassPremium(token(), {
      minecraft_uuid: uuid,
      minecraft_nickname: nickname,
      days: bpDays.value,
      note: bpNote.value || null,
    })
    bpMsg.value = `Battle Pass Premium выдан на ${bpDays.value} дн.`
    await loadBpInfo(nickname)
  } catch (e) {
    bpErr.value = e.message || 'Ошибка при выдаче BP'
  } finally {
    bpLoading.value = false
  }
}

async function revokeBp() {
  if (!confirm('Отозвать Battle Pass Premium у игрока?')) return
  bpLoading.value = true
  bpMsg.value = ''
  bpErr.value = ''
  const nickname = modal.value.player_account.minecraft_nickname
  try {
    // всегда используем revoke-by-nick: обновляет DB (если запись есть) + всегда отправляет RCON
    await adminRevokeBattlePassPremiumByNick(token(), nickname)
    bpMsg.value = 'Battle Pass Premium отозван.'
    await loadBpInfo(nickname)
  } catch (e) {
    bpErr.value = e.message || 'Ошибка при отзыве BP'
  } finally {
    bpLoading.value = false
  }
}

function formatBpExpiry(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function closeModal() {
  modal.value = null
}

async function patchPlayer(playerAccountId, payload) {
  actionLoading.value = true
  actionMsg.value = ''
  actionErr.value = ''
  try {
    const res = await adminPatchLegacy(token(), playerAccountId, payload)
    actionMsg.value = res?.message || 'Сохранено'
    // refresh the row in the list
    const idx = items.value.findIndex(i => i.player_account.id === playerAccountId)
    if (idx !== -1 && res?.record) {
      items.value[idx] = res.record
      modal.value = res.record
    }
  } catch (e) {
    actionErr.value = e.message || 'Ошибка'
  } finally {
    actionLoading.value = false
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(load)
</script>

<template>
  <div class="ap">
    <!-- Header -->
    <div class="ap__header">
      <div>
        <h1 class="ap__title">Игроки</h1>
        <p class="ap__sub">{{ total.toLocaleString('ru') }} записей</p>
      </div>
      <button class="btn btn--ghost btn--sm" :disabled="loading" @click="load">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Обновить
      </button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="search" class="inp" placeholder="Логин, ник, почта..." @keyup.enter="load" />
      <select v-model="filterLegacy" class="sel">
        <option value="">Legacy: все</option>
        <option value="true">Legacy вкл</option>
        <option value="false">Legacy выкл</option>
      </select>
      <select v-model="filterActive" class="sel">
        <option value="">Активность: все</option>
        <option value="true">Активны</option>
        <option value="false">Заблокированы</option>
      </select>
      <button class="btn btn--primary btn--sm" @click="load">Найти</button>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div v-if="loading" class="skel skel--tall" />
      <table v-else-if="items.length" class="tbl">
        <thead>
          <tr>
            <th>Логин</th>
            <th>Ник</th>
            <th>Почта</th>
            <th>Почта ✓</th>
            <th>Сессии</th>
            <th>Legacy</th>
            <th>Статус</th>
            <th>Создан</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.player_account.id" :class="{ 'tbl__row--blocked': !item.user.is_active }">
            <td class="tbl__login">{{ item.user.site_login }}</td>
            <td class="tbl__nick">{{ item.player_account.minecraft_nickname }}</td>
            <td class="tbl__email">{{ item.user.email }}</td>
            <td>
              <span class="badge" :class="item.user.email_verified ? 'badge--green' : 'badge--yellow'">
                {{ item.user.email_verified ? 'Да' : 'Нет' }}
              </span>
            </td>
            <td class="tbl__num">{{ item.diagnostics.refresh_sessions_active }}</td>
            <td>
              <span class="badge" :class="item.player_account.legacy_auth_enabled ? 'badge--purple' : 'badge--dim'">
                {{ item.player_account.legacy_auth_enabled ? 'Вкл' : 'Выкл' }}
              </span>
            </td>
            <td>
              <span class="badge" :class="item.user.is_active ? 'badge--green' : 'badge--red'">
                {{ item.user.is_active ? 'Активен' : 'Заблок.' }}
              </span>
            </td>
            <td class="tbl__date">{{ formatDate(item.user.created_at) }}</td>
            <td>
              <button class="btn btn--ghost btn--xs" @click="openModal(item)">
                Управление
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">Ничего не найдено</div>
    </div>

    <!-- Modal -->
    <div v-if="modal" class="modal-overlay" @click.self="closeModal">
          <div class="adm-modal-box">
            <div class="modal__head">
              <div>
                <div class="modal__title">{{ modal.user.site_login }}</div>
                <div class="modal__sub">{{ modal.player_account.minecraft_nickname }}</div>
              </div>
              <button class="modal__close" @click="closeModal">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <!-- Info grid -->
            <div class="info-grid">
              <div class="info-grid__item">
                <span class="info-grid__label">Почта</span>
                <span class="info-grid__val">{{ modal.user.email }}</span>
              </div>
              <div class="info-grid__item">
                <span class="info-grid__label">Подтверждена</span>
                <span class="info-grid__val">{{ modal.user.email_verified ? 'Да' : 'Нет' }}</span>
              </div>
              <div class="info-grid__item">
                <span class="info-grid__label">Активных сессий</span>
                <span class="info-grid__val">{{ modal.diagnostics.refresh_sessions_active }}</span>
              </div>
              <div class="info-grid__item">
                <span class="info-grid__label">Legacy хэш</span>
                <span class="info-grid__val">{{ modal.diagnostics.legacy_hash_present ? 'Есть' : 'Нет' }}</span>
              </div>
              <div class="info-grid__item">
                <span class="info-grid__label">Legacy готов</span>
                <span class="info-grid__val">{{ modal.diagnostics.legacy_ready ? 'Да' : 'Нет' }}</span>
              </div>
              <div class="info-grid__item">
                <span class="info-grid__label">Ник заблок.</span>
                <span class="info-grid__val">{{ modal.player_account.nickname_locked ? 'Да' : 'Нет' }}</span>
              </div>
            </div>

            <div class="modal__divider" />

            <!-- Actions -->
            <div class="modal__section">Аккаунт</div>
            <div class="action-row">
              <button
                class="btn btn--sm"
                :class="modal.user.is_active ? 'btn--danger' : 'btn--success'"
                :disabled="actionLoading"
                @click="patchPlayer(modal.player_account.id, { user_active: !modal.user.is_active })"
              >
                {{ modal.user.is_active ? '🔒 Заблокировать' : '🔓 Разблокировать' }}
              </button>
              <button
                class="btn btn--ghost btn--sm"
                :disabled="actionLoading"
                @click="patchPlayer(modal.player_account.id, { revoke_refresh_sessions: true })"
              >
                Сбросить сессии ({{ modal.diagnostics.refresh_sessions_active }})
              </button>
            </div>

            <div class="modal__section" style="margin-top:1rem">Legacy-авторизация</div>
            <div class="action-row">
              <button
                class="btn btn--sm"
                :class="modal.player_account.legacy_auth_enabled ? 'btn--danger' : 'btn--primary'"
                :disabled="actionLoading"
                @click="patchPlayer(modal.player_account.id, { legacy_auth_enabled: !modal.player_account.legacy_auth_enabled })"
              >
                {{ modal.player_account.legacy_auth_enabled ? 'Выключить Legacy' : 'Включить Legacy' }}
              </button>
              <button
                v-if="modal.diagnostics.legacy_hash_present"
                class="btn btn--ghost btn--sm"
                :disabled="actionLoading"
                @click="patchPlayer(modal.player_account.id, { clear_legacy_hash: true })"
              >
                Сбросить хэш
              </button>
            </div>

            <div v-if="actionMsg" class="notice notice--ok">{{ actionMsg }}</div>
            <div v-if="actionErr" class="notice notice--err">{{ actionErr }}</div>

            <div class="modal__divider" style="margin-top:1rem" />

            <!-- Battle Pass Premium -->
            <div class="modal__section">Battle Pass Premium</div>

            <div v-if="bpLoading && !bpInfo" class="bp-skeleton" />

            <template v-else>
              <!-- Current status -->
              <div v-if="bpInfo" class="bp-status-row">
                <span class="bp-status-label">Статус:</span>
                <span v-if="bpInfo.has_premium" class="badge badge--green">
                  Активен до {{ formatBpExpiry(bpInfo.expires_at) }}
                </span>
                <span v-else-if="bpInfo.expires_at" class="badge badge--red">
                  Истёк {{ formatBpExpiry(bpInfo.expires_at) }}
                </span>
                <span v-else class="badge badge--dim">Не выдан</span>

                <span class="bp-level-hint">Ур. {{ bpInfo.level }} · {{ bpInfo.xp }} XP</span>
              </div>

              <!-- UUID not found — manual input -->
              <div v-if="bpInfo && !bpInfo.minecraft_uuid" class="bp-uuid-row">
                <span class="bp-uuid-hint">UUID не найден в БД. Введите вручную:</span>
                <input
                  v-model="bpManualUuid"
                  class="inp bp-uuid-inp"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  spellcheck="false"
                />
              </div>

              <!-- Grant form -->
              <div class="bp-grant-row">
                <select v-model="bpDays" class="sel bp-days-sel">
                  <option :value="7">7 дней</option>
                  <option :value="14">14 дней</option>
                  <option :value="30">30 дней</option>
                  <option :value="60">60 дней</option>
                  <option :value="90">90 дней</option>
                </select>
                <input v-model="bpNote" class="inp bp-note-inp" placeholder="Причина (необязательно)" />
                <button
                  class="btn btn--primary btn--sm"
                  :disabled="bpLoading"
                  @click="grantBp"
                >{{ bpInfo?.has_premium ? '+ Продлить' : 'Выдать BP' }}</button>
                <button
                  class="btn btn--danger btn--sm"
                  :disabled="bpLoading"
                  @click="revokeBp"
                >Отозвать</button>
              </div>

              <div v-if="bpMsg" class="notice notice--ok">{{ bpMsg }}</div>
              <div v-if="bpErr" class="notice notice--err">{{ bpErr }}</div>
            </template>
          </div>
    </div>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.ap {
  padding: 1.75rem 1.5rem 3rem;
  max-width: 100%;
}

.ap__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 1rem;
}

.ap__title { font-size: 1.4rem; font-weight: 800; color: #e2e8f0; margin: 0; }
.ap__sub { font-size: 0.75rem; color: #475569; margin: 0.15rem 0 0; }

/* Filters */
.filters { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }

.inp, .sel {
  padding: 0.45rem 0.75rem;
  background: #0d1422;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.82rem;
  outline: none;
  transition: border-color 0.13s;
}

.inp { flex: 1; min-width: 180px; }
.inp:focus, .sel:focus { border-color: rgba(124,58,237,0.5); }
.sel option { background: #0d1422; }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: background 0.13s, opacity 0.13s;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn--primary { background: #7c3aed; color: #fff; }
.btn--primary:hover:not(:disabled) { background: #6d28d9; }
.btn--ghost { background: rgba(255,255,255,0.05); color: #94a3b8; }
.btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); color: #cbd5e1; }
.btn--danger { background: rgba(239,68,68,0.15); color: #fca5a5; }
.btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.25); }
.btn--success { background: rgba(34,197,94,0.15); color: #86efac; }
.btn--success:hover:not(:disabled) { background: rgba(34,197,94,0.25); }
.btn--sm { padding: 0.38rem 0.75rem; font-size: 0.8rem; }
.btn--xs { padding: 0.28rem 0.6rem; font-size: 0.75rem; }

/* Table */
.table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); background: #0a1020; }

.tbl { width: 100%; border-collapse: collapse; font-size: 0.8rem; white-space: nowrap; }

.tbl thead th {
  padding: 0.6rem 0.85rem;
  text-align: left;
  font-size: .75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #2d3e5c;
  background: linear-gradient(0deg, #0a1020 0%, #0d1428 100%);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.tbl tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.1s; }
.tbl tbody tr:last-child { border-bottom: none; }
.tbl tbody tr:hover { background: rgba(124,58,237,0.04); }
.tbl__row--blocked { opacity: 0.5; }

.tbl td { padding: 0.55rem 0.85rem; color: #64748b; vertical-align: middle; }

.tbl__login { font-weight: 800; color: #c4b5fd !important; }
.tbl__nick { color: #94a3b8 !important; font-weight: 600; }
.tbl__email { color: #475569 !important; font-size: 0.75rem; }
.tbl__date { color: #334155 !important; font-size: .75rem; }
.tbl__num { color: #64748b !important; font-weight: 700; text-align: center; }

/* Badge */
.badge {
  display: inline-block;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  font-size: .75rem;
  font-weight: 800;
}
.badge--green { background: rgba(34,197,94,0.1); color: #86efac; }
.badge--yellow { background: rgba(234,179,8,0.1); color: #fde047; }
.badge--red { background: rgba(239,68,68,0.1); color: #fca5a5; }
.badge--purple { background: rgba(124,58,237,0.12); color: #c4b5fd; }
.badge--dim { background: rgba(100,116,139,0.1); color: #475569; }

/* Skeleton */
.skel {
  border-radius: 12px;
  background: linear-gradient(90deg, #0d1422 25%, #121929 50%, #0d1422 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
.skel--tall { height: 260px; }

@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty { color: #2d3e5c; font-size: 0.83rem; padding: 2rem 0; text-align: center; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(6px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.adm-modal-box {
  background: #111827;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  padding: 1.5rem;
  width: 100%;
  max-width: 460px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.8);
}

.modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 0.5rem;
}

.modal__title { font-size: 1.1rem; font-weight: 800; color: #e2e8f0; }
.modal__sub { font-size: 0.78rem; color: #64748b; margin-top: 0.15rem; }

.modal__close {
  background: rgba(255,255,255,0.05);
  border: none;
  color: #475569;
  cursor: pointer;
  border-radius: 7px;
  padding: 0.3rem;
  display: flex;
  align-items: center;
  transition: color 0.13s, background 0.13s;
  flex-shrink: 0;
}
.modal__close:hover { color: #94a3b8; background: rgba(255,255,255,0.08); }

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin-bottom: 1.1rem;
}

.info-grid__item {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
}

.info-grid__label {
  display: block;
  font-size: .75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #334155;
  margin-bottom: 0.2rem;
}

.info-grid__val { font-size: 0.82rem; color: #94a3b8; font-weight: 600; }

.modal__divider {
  height: 1px;
  background: rgba(255,255,255,0.05);
  margin: 0 0 1rem;
}

.modal__section {
  font-size: .75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #334155;
  margin-bottom: 0.6rem;
}

.action-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.notice {
  margin-top: 0.9rem;
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
}
.notice--ok { background: rgba(34,197,94,0.1); color: #86efac; }
.notice--err { background: rgba(239,68,68,0.1); color: #fca5a5; }

/* Battle Pass section */
.bp-skeleton {
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(90deg, #0d1422 25%, #121929 50%, #0d1422 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  margin-bottom: 0.75rem;
}
.bp-status-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.bp-status-label { font-size: 0.78rem; color: #475569; font-weight: 700; }
.bp-level-hint { font-size: 0.72rem; color: #334155; margin-left: auto; }
.bp-grant-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.bp-days-sel { width: auto; flex-shrink: 0; }
.bp-note-inp { flex: 1; min-width: 120px; }
.bp-uuid-row {
  margin-bottom: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.bp-uuid-hint { font-size: 0.72rem; color: #f59e0b; font-weight: 600; }
.bp-uuid-inp { font-family: monospace; font-size: 0.75rem; width: 100%; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

@media (max-width: 600px) {
  .ap { padding: 1rem 0.75rem 2rem; }
  .info-grid { grid-template-columns: 1fr; }
}
</style>
