<script setup>
import { onMounted, ref } from 'vue'
import { adminListPlayers, adminPatchLegacy } from '../../services/adminApi'
import { adminGetBattlePassPlayerByNick, adminGrantBattlePassPremium, adminRevokeBattlePassPremiumByNick } from '../../services/battlepassAdminApi'
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
  <div class="adm-page">
    <!-- Header -->
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Игроки</h1>
        <p class="adm-sub">{{ total.toLocaleString('ru') }} записей · аккаунты общие для всех серверов</p>
      </div>
      <button class="adm-btn" :disabled="loading" @click="load">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Обновить
      </button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="search" class="adm-input filters__search" placeholder="Логин, ник, почта..." @keyup.enter="load" />
      <select v-model="filterLegacy" class="adm-select filters__sel">
        <option value="">Legacy: все</option>
        <option value="true">Legacy вкл</option>
        <option value="false">Legacy выкл</option>
      </select>
      <select v-model="filterActive" class="adm-select filters__sel">
        <option value="">Активность: все</option>
        <option value="true">Активны</option>
        <option value="false">Заблокированы</option>
      </select>
      <button class="adm-btn adm-btn--acc" @click="load">Найти</button>
    </div>

    <!-- Table -->
    <div v-if="loading" class="adm-skel" style="height: 260px" />
    <div v-else-if="items.length" class="adm-table-wrap">
      <div class="adm-table-scroll">
        <table class="adm-table" style="white-space: nowrap">
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
            <tr v-for="item in items" :key="item.player_account.id" :class="{ 'row--blocked': !item.user.is_active }">
              <td class="cell-login">{{ item.user.site_login }}</td>
              <td class="cell-nick adm-mono">{{ item.player_account.minecraft_nickname }}</td>
              <td class="cell-dim">{{ item.user.email }}</td>
              <td>
                <span class="adm-badge" :class="item.user.email_verified ? 'adm-badge--ok' : 'adm-badge--warn'">
                  {{ item.user.email_verified ? 'Да' : 'Нет' }}
                </span>
              </td>
              <td class="adm-num" style="text-align: center">{{ item.diagnostics.refresh_sessions_active }}</td>
              <td>
                <span class="adm-badge" :class="item.player_account.legacy_auth_enabled ? 'adm-badge--acc' : ''">
                  {{ item.player_account.legacy_auth_enabled ? 'Вкл' : 'Выкл' }}
                </span>
              </td>
              <td>
                <span class="adm-badge" :class="item.user.is_active ? 'adm-badge--ok' : 'adm-badge--err'">
                  {{ item.user.is_active ? 'Активен' : 'Заблок.' }}
                </span>
              </td>
              <td class="cell-dim adm-num">{{ formatDate(item.user.created_at) }}</td>
              <td>
                <button class="adm-btn adm-btn--sm" @click="openModal(item)">Управление</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="adm-empty">
      <div class="adm-empty__title">Ничего не найдено</div>
      <div class="adm-empty__sub">Попробуй изменить поисковый запрос или фильтры</div>
    </div>

    <!-- Modal -->
    <div v-if="modal" class="adm-modal-backdrop" @click.self="closeModal">
      <div class="adm-modal" style="max-width: 480px">
        <div class="modal__head">
          <div>
            <div class="modal__title">{{ modal.user.site_login }}</div>
            <div class="modal__sub adm-mono">{{ modal.player_account.minecraft_nickname }}</div>
          </div>
          <button class="adm-btn adm-btn--ghost adm-btn--icon" @click="closeModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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

        <!-- Actions -->
        <div class="adm-label">Аккаунт</div>
        <div class="action-row">
          <button
            class="adm-btn adm-btn--sm"
            :class="modal.user.is_active ? 'adm-btn--danger' : 'adm-btn--ok'"
            :disabled="actionLoading"
            @click="patchPlayer(modal.player_account.id, { user_active: !modal.user.is_active })"
          >
            {{ modal.user.is_active ? 'Заблокировать' : 'Разблокировать' }}
          </button>
          <button
            class="adm-btn adm-btn--sm"
            :disabled="actionLoading"
            @click="patchPlayer(modal.player_account.id, { revoke_refresh_sessions: true })"
          >
            Сбросить сессии ({{ modal.diagnostics.refresh_sessions_active }})
          </button>
        </div>

        <div class="adm-label" style="margin-top: 1rem">Legacy-авторизация</div>
        <div class="action-row">
          <button
            class="adm-btn adm-btn--sm"
            :class="modal.player_account.legacy_auth_enabled ? 'adm-btn--danger' : 'adm-btn--acc'"
            :disabled="actionLoading"
            @click="patchPlayer(modal.player_account.id, { legacy_auth_enabled: !modal.player_account.legacy_auth_enabled })"
          >
            {{ modal.player_account.legacy_auth_enabled ? 'Выключить Legacy' : 'Включить Legacy' }}
          </button>
          <button
            v-if="modal.diagnostics.legacy_hash_present"
            class="adm-btn adm-btn--sm"
            :disabled="actionLoading"
            @click="patchPlayer(modal.player_account.id, { clear_legacy_hash: true })"
          >
            Сбросить хэш
          </button>
        </div>

        <div v-if="actionMsg" class="notice notice--ok">{{ actionMsg }}</div>
        <div v-if="actionErr" class="notice notice--err">{{ actionErr }}</div>

        <!-- Battle Pass Premium -->
        <div class="adm-label" style="margin-top: 1.1rem">Battle Pass Premium</div>

        <div v-if="bpLoading && !bpInfo" class="adm-skel" style="height: 32px; margin-bottom: 0.75rem" />

        <template v-else>
          <!-- Current status -->
          <div v-if="bpInfo" class="bp-status-row">
            <span class="bp-status-label">Статус:</span>
            <span v-if="bpInfo.has_premium" class="adm-badge adm-badge--ok">
              Активен до {{ formatBpExpiry(bpInfo.expires_at) }}
            </span>
            <span v-else-if="bpInfo.expires_at" class="adm-badge adm-badge--err">
              Истёк {{ formatBpExpiry(bpInfo.expires_at) }}
            </span>
            <span v-else class="adm-badge">Не выдан</span>

            <span class="bp-level-hint adm-num">Ур. {{ bpInfo.level }} · {{ bpInfo.xp }} XP</span>
          </div>

          <!-- UUID not found — manual input -->
          <div v-if="bpInfo && !bpInfo.minecraft_uuid" class="bp-uuid-row">
            <span class="bp-uuid-hint">UUID не найден в БД. Введите вручную:</span>
            <input
              v-model="bpManualUuid"
              class="adm-input adm-mono"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              spellcheck="false"
            />
          </div>

          <!-- Grant form -->
          <div class="bp-grant-row">
            <select v-model="bpDays" class="adm-select" style="width: auto; flex-shrink: 0">
              <option :value="7">7 дней</option>
              <option :value="14">14 дней</option>
              <option :value="30">30 дней</option>
              <option :value="60">60 дней</option>
              <option :value="90">90 дней</option>
            </select>
            <input v-model="bpNote" class="adm-input" style="flex: 1; min-width: 120px" placeholder="Причина (необязательно)" />
            <button class="adm-btn adm-btn--acc adm-btn--sm" :disabled="bpLoading" @click="grantBp">
              {{ bpInfo?.has_premium ? '+ Продлить' : 'Выдать BP' }}
            </button>
            <button class="adm-btn adm-btn--danger adm-btn--sm" :disabled="bpLoading" @click="revokeBp">Отозвать</button>
          </div>

          <div v-if="bpMsg" class="notice notice--ok">{{ bpMsg }}</div>
          <div v-if="bpErr" class="notice notice--err">{{ bpErr }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Фильтры */
.filters { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.filters__search { flex: 1; min-width: 180px; }
.filters__sel { width: auto; flex-shrink: 0; }

/* Таблица: подсветка ролей ячеек */
.row--blocked { opacity: 0.5; }
.cell-login { font-weight: 800; color: var(--adm-acc-text); }
.cell-nick { color: var(--adm-mut); font-weight: 600; }
.cell-dim { color: var(--adm-dim); font-size: 0.75rem; }

/* Модалка */
.modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.2rem;
  gap: 0.5rem;
}
.modal__title { font-size: 1.08rem; font-weight: 800; color: var(--adm-text); }
.modal__sub { font-size: 0.76rem; color: var(--adm-dim); margin-top: 0.15rem; }

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin-bottom: 1.1rem;
}
@media (max-width: 600px) { .info-grid { grid-template-columns: 1fr; } }
.info-grid__item {
  background: rgba(148, 163, 184, 0.04);
  border: 1px solid var(--adm-line);
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  min-width: 0;
}
.info-grid__label {
  display: block;
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--adm-faint);
  margin-bottom: 0.2rem;
}
.info-grid__val { font-size: 0.8rem; color: var(--adm-mut); font-weight: 600; overflow-wrap: anywhere; }

.action-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.notice {
  margin-top: 0.9rem;
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
}
.notice--ok { background: rgba(52, 211, 153, 0.1); color: #6ee7b7; }
.notice--err { background: rgba(248, 113, 113, 0.1); color: #fca5a5; }

/* Battle Pass секция модалки */
.bp-status-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
.bp-status-label { font-size: 0.78rem; color: var(--adm-dim); font-weight: 700; }
.bp-level-hint { font-size: 0.7rem; color: var(--adm-dim); margin-left: auto; }
.bp-grant-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.bp-uuid-row { margin-bottom: 0.6rem; display: flex; flex-direction: column; gap: 0.35rem; }
.bp-uuid-hint { font-size: 0.72rem; color: var(--adm-warn); font-weight: 600; }
</style>
