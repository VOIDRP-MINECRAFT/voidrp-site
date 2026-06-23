<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  getAdminPlayer,
  getAdminSummary,
  listAdminPlayers,
  updateAdminLegacy,
} from '../services/adminApi'

const summary = ref(null)
const summaryLoading = ref(false)
const summaryError = ref('')

const filters = reactive({
  q: '',
  legacy_auth_enabled: '',
  legacy_hash_present: '',
  user_active: 'true',
  limit: '50',
})

const players = ref([])
const totalPlayers = ref(0)
const listLoading = ref(false)
const listError = ref('')

const selectedPlayerId = ref('')
const selectedRecord = ref(null)
const recordLoading = ref(false)
const recordError = ref('')

const actionBusy = ref(false)
const actionError = ref('')
const actionMessage = ref('')

const legacyEditor = reactive({
  legacy_password_hash: '',
  legacy_hash_algo: 'custom_pbkdf2_sha256',
})

const hasSelectedRecord = computed(() => Boolean(selectedRecord.value))

const canSaveHash = computed(() => {
  return (
    Boolean(selectedRecord.value) &&
    legacyEditor.legacy_password_hash.trim().length > 0 &&
    legacyEditor.legacy_hash_algo.trim().length > 0
  )
})

function parseNullableBoolean(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function buildListParams() {
  return {
    q: filters.q.trim() || null,
    legacy_auth_enabled: parseNullableBoolean(filters.legacy_auth_enabled),
    legacy_hash_present: parseNullableBoolean(filters.legacy_hash_present),
    user_active: parseNullableBoolean(filters.user_active),
    limit: Number(filters.limit) || 50,
  }
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function statusBadge(value, trueClass = 'badge-success', falseClass = 'badge-ghost') {
  return ['badge', 'badge-sm', value ? trueClass : falseClass]
}

function countBadge(value) {
  return ['badge', 'badge-sm', value > 0 ? 'badge-primary' : 'badge-ghost']
}

function hydrateLegacyEditor(record) {
  legacyEditor.legacy_password_hash = ''
  legacyEditor.legacy_hash_algo =
    record?.player_account?.legacy_hash_algo || 'custom_pbkdf2_sha256'
}

function syncRecordInList(record) {
  const index = players.value.findIndex(
    (item) => item.player_account.id === record.player_account.id,
  )

  if (index >= 0) {
    players.value[index] = record
  }
}

async function loadSummary() {
  summaryLoading.value = true
  summaryError.value = ''

  try {
    summary.value = await getAdminSummary()
  } catch (error) {
    summaryError.value = error.message || 'Не удалось загрузить summary.'
  } finally {
    summaryLoading.value = false
  }
}

async function loadPlayers() {
  listLoading.value = true
  listError.value = ''

  try {
    const response = await listAdminPlayers(buildListParams())
    players.value = response.items || []
    totalPlayers.value = response.total || 0
  } catch (error) {
    listError.value = error.message || 'Не удалось загрузить список игроков.'
  } finally {
    listLoading.value = false
  }
}

async function refreshPageData() {
  await Promise.all([loadSummary(), loadPlayers()])
}

async function openPlayer(playerAccountId) {
  selectedPlayerId.value = playerAccountId
  selectedRecord.value = null
  recordLoading.value = true
  recordError.value = ''
  actionError.value = ''
  actionMessage.value = ''

  try {
    const record = await getAdminPlayer(playerAccountId)
    selectedRecord.value = record
    hydrateLegacyEditor(record)
  } catch (error) {
    recordError.value = error.message || 'Не удалось загрузить карточку игрока.'
  } finally {
    recordLoading.value = false
  }
}

async function applyRecordUpdate(payload, successMessage) {
  if (!selectedPlayerId.value) {
    return
  }

  actionBusy.value = true
  actionError.value = ''
  actionMessage.value = ''

  try {
    const response = await updateAdminLegacy(selectedPlayerId.value, payload)
    selectedRecord.value = response.record
    syncRecordInList(response.record)
    hydrateLegacyEditor(response.record)
    actionMessage.value = successMessage
    await refreshPageData()
  } catch (error) {
    actionError.value = error.message || 'Не удалось сохранить изменения.'
  } finally {
    actionBusy.value = false
  }
}

async function submitFilters() {
  await loadPlayers()
}

async function resetFilters() {
  filters.q = ''
  filters.legacy_auth_enabled = ''
  filters.legacy_hash_present = ''
  filters.user_active = 'true'
  filters.limit = '50'
  await loadPlayers()
}

async function saveLegacyHash() {
  if (!canSaveHash.value) {
    actionError.value = 'Заполни legacy hash и algo.'
    return
  }

  await applyRecordUpdate(
    {
      legacy_password_hash: legacyEditor.legacy_password_hash.trim(),
      legacy_hash_algo: legacyEditor.legacy_hash_algo.trim(),
    },
    'Legacy hash сохранён.',
  )
}

async function toggleLegacy() {
  if (!selectedRecord.value) return

  await applyRecordUpdate(
    {
      legacy_auth_enabled: !selectedRecord.value.player_account.legacy_auth_enabled,
    },
    selectedRecord.value.player_account.legacy_auth_enabled
      ? 'Legacy вход отключён.'
      : 'Legacy вход включён.',
  )
}

async function toggleUserActive() {
  if (!selectedRecord.value) return

  const nextValue = !selectedRecord.value.user.is_active
  const confirmed = window.confirm(
    nextValue
      ? 'Включить аккаунт пользователя?'
      : 'Отключить аккаунт пользователя?',
  )

  if (!confirmed) return

  await applyRecordUpdate(
    {
      user_active: nextValue,
    },
    nextValue ? 'Аккаунт включён.' : 'Аккаунт отключён.',
  )
}

async function clearLegacyHash() {
  if (!selectedRecord.value) return

  const confirmed = window.confirm(
    'Очистить legacy hash и legacy algo для этого игрока?',
  )

  if (!confirmed) return

  await applyRecordUpdate(
    {
      clear_legacy_hash: true,
    },
    'Legacy hash очищен.',
  )
}

async function revokeRefreshSessions() {
  if (!selectedRecord.value) return

  const confirmed = window.confirm(
    'Отозвать все активные refresh sessions этого пользователя?',
  )

  if (!confirmed) return

  await applyRecordUpdate(
    {
      revoke_refresh_sessions: true,
    },
    'Активные refresh sessions отозваны.',
  )
}

onMounted(async () => {
  await refreshPageData()
})
</script>

<template>
  <section class="py-10 md:py-14">
    <div class="container-shell">
      <div class="max-w-4xl">
        <div class="section-kicker">VoidRP Internal</div>
        <h1 class="section-title">Legacy Migration Console</h1>
        <p class="section-subtitle">
          Внутренняя панель для поиска игроков, миграции legacy-входа и
          управления launcher-only / mixed-mode доступом.
        </p>
      </div>

      <div
        v-if="summaryError"
        class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
      >
        {{ summaryError }}
      </div>

      <div class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div class="glass-card rounded-[28px] p-6">
          <p class="text-xs uppercase tracking-[0.24em] text-slate-500">
            Всего игроков
          </p>
          <p class="mt-3 text-3xl font-black text-slate-900">
            {{ summaryLoading ? '...' : summary?.total_players ?? '—' }}
          </p>
        </div>

        <div class="glass-card rounded-[28px] p-6">
          <p class="text-xs uppercase tracking-[0.24em] text-slate-500">
            Legacy enabled
          </p>
          <p class="mt-3 text-3xl font-black text-slate-900">
            {{ summaryLoading ? '...' : summary?.legacy_enabled_players ?? '—' }}
          </p>
        </div>

        <div class="glass-card rounded-[28px] p-6">
          <p class="text-xs uppercase tracking-[0.24em] text-slate-500">
            Legacy ready
          </p>
          <p class="mt-3 text-3xl font-black text-slate-900">
            {{ summaryLoading ? '...' : summary?.legacy_ready_players ?? '—' }}
          </p>
        </div>

        <div class="glass-card rounded-[28px] p-6">
          <p class="text-xs uppercase tracking-[0.24em] text-slate-500">
            Missing hash
          </p>
          <p class="mt-3 text-3xl font-black text-slate-900">
            {{ summaryLoading ? '...' : summary?.legacy_missing_hash_players ?? '—' }}
          </p>
        </div>

        <div class="glass-card rounded-[28px] p-6">
          <p class="text-xs uppercase tracking-[0.24em] text-slate-500">
            Launcher only
          </p>
          <p class="mt-3 text-3xl font-black text-slate-900">
            {{ summaryLoading ? '...' : summary?.launcher_only_players ?? '—' }}
          </p>
        </div>
      </div>

      <div class="glass-card mt-8 rounded-[32px] p-6 md:p-8">
        <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div class="section-kicker">Фильтры</div>
            <h2 class="text-2xl font-black text-slate-900">
              Поиск и выбор игроков
            </h2>
          </div>
          <div class="text-sm text-slate-500">
            Найдено записей: <strong>{{ totalPlayers }}</strong>
          </div>
        </div>

        <form
          class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5"
          @submit.prevent="submitFilters"
        >
          <label class="form-control w-full xl:col-span-2">
            <span class="label-text mb-2 font-semibold text-slate-700">
              Поиск по нику / логину / почте
            </span>
            <input
              v-model="filters.q"
              class="input input-bordered w-full rounded-2xl"
              placeholder="Например: YannGotti или email"
            />
          </label>

          <label class="form-control w-full">
            <span class="label-text mb-2 font-semibold text-slate-700">
              Legacy enabled
            </span>
            <select
              v-model="filters.legacy_auth_enabled"
              class="select select-bordered w-full rounded-2xl"
            >
              <option value="">Все</option>
              <option value="true">Только true</option>
              <option value="false">Только false</option>
            </select>
          </label>

          <label class="form-control w-full">
            <span class="label-text mb-2 font-semibold text-slate-700">
              Hash present
            </span>
            <select
              v-model="filters.legacy_hash_present"
              class="select select-bordered w-full rounded-2xl"
            >
              <option value="">Все</option>
              <option value="true">Только true</option>
              <option value="false">Только false</option>
            </select>
          </label>

          <label class="form-control w-full">
            <span class="label-text mb-2 font-semibold text-slate-700">
              User active
            </span>
            <select
              v-model="filters.user_active"
              class="select select-bordered w-full rounded-2xl"
            >
              <option value="">Все</option>
              <option value="true">Только true</option>
              <option value="false">Только false</option>
            </select>
          </label>

          <label class="form-control w-full">
            <span class="label-text mb-2 font-semibold text-slate-700">
              Limit
            </span>
            <select
              v-model="filters.limit"
              class="select select-bordered w-full rounded-2xl"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </label>

          <div class="flex flex-col gap-3 md:col-span-2 xl:col-span-5 sm:flex-row">
            <button type="submit" class="btn btn-primary rounded-2xl" :disabled="listLoading">
              {{ listLoading ? 'Обновляем...' : 'Применить фильтры' }}
            </button>
            <button type="button" class="btn btn-outline rounded-2xl" @click="resetFilters">
              Сбросить
            </button>
            <button type="button" class="btn btn-ghost rounded-2xl" @click="refreshPageData">
              Обновить всё
            </button>
          </div>
        </form>
      </div>

      <div class="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div class="glass-card rounded-[32px] p-6 md:p-8">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="section-kicker">Игроки</div>
              <h2 class="text-2xl font-black text-slate-900">
                Список игроков
              </h2>
            </div>
            <span v-if="listLoading" class="loading loading-spinner loading-md text-primary"></span>
          </div>

          <p
            v-if="listError"
            class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {{ listError }}
          </p>

          <div v-if="!listLoading && players.length === 0" class="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            Игроки не найдены. Попробуй изменить фильтры или очистить поиск.
          </div>

          <div v-else class="mt-6 overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
            <table class="table table-zebra">
              <thead>
                <tr class="text-slate-600">
                  <th>Ник</th>
                  <th>Логин</th>
                  <th>Email</th>
                  <th>Legacy</th>
                  <th>Ready</th>
                  <th>Launcher only</th>
                  <th>Sessions</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in players"
                  :key="item.player_account.id"
                  class="hover cursor-pointer"
                  @click="openPlayer(item.player_account.id)"
                >
                  <td>
                    <div class="font-semibold text-slate-900">
                      {{ item.player_account.minecraft_nickname }}
                    </div>
                    <div class="mt-1 text-xs text-slate-500">
                      {{ formatDate(item.player_account.created_at) }}
                    </div>
                  </td>

                  <td>
                    <div class="font-medium text-slate-800">
                      {{ item.user.site_login }}
                    </div>
                    <div class="mt-1">
                      <span :class="statusBadge(item.user.is_active, 'badge-success', 'badge-error')">
                        {{ item.user.is_active ? 'active' : 'disabled' }}
                      </span>
                    </div>
                  </td>

                  <td>
                    <div class="max-w-[220px] truncate text-slate-700">
                      {{ item.user.email }}
                    </div>
                    <div class="mt-1">
                      <span :class="statusBadge(item.user.email_verified, 'badge-info', 'badge-warning')">
                        {{ item.user.email_verified ? 'verified' : 'not verified' }}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span :class="statusBadge(item.player_account.legacy_auth_enabled, 'badge-primary', 'badge-ghost')">
                      {{ item.player_account.legacy_auth_enabled ? 'enabled' : 'off' }}
                    </span>
                  </td>

                  <td>
                    <div class="flex flex-wrap gap-2">
                      <span :class="statusBadge(item.diagnostics.legacy_hash_present, 'badge-success', 'badge-error')">
                        hash
                      </span>
                      <span :class="statusBadge(item.diagnostics.legacy_ready, 'badge-success', 'badge-error')">
                        ready
                      </span>
                    </div>
                  </td>

                  <td>
                    <span :class="statusBadge(item.diagnostics.must_use_launcher, 'badge-secondary', 'badge-ghost')">
                      {{ item.diagnostics.must_use_launcher ? 'yes' : 'no' }}
                    </span>
                  </td>

                  <td>
                    <span :class="countBadge(item.diagnostics.refresh_sessions_active)">
                      {{ item.diagnostics.refresh_sessions_active }}
                    </span>
                  </td>

                  <td>
                    <button type="button" class="btn btn-xs rounded-xl" @click.stop="openPlayer(item.player_account.id)">
                      Открыть
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="glass-card rounded-[32px] p-6 md:p-8 xl:sticky xl:top-24 h-fit">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="section-kicker">Карточка игрока</div>
              <h2 class="text-2xl font-black text-slate-900">
                Управление аккаунтом
              </h2>
            </div>
            <span v-if="recordLoading" class="loading loading-spinner loading-md text-primary"></span>
          </div>

          <p
            v-if="recordError"
            class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {{ recordError }}
          </p>

          <div
            v-else-if="!hasSelectedRecord && !recordLoading"
            class="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-600"
          >
            Выбери игрока в таблице слева, чтобы открыть детали, поменять legacy-режим,
            сохранить legacy hash, отозвать refresh sessions или отключить аккаунт.
          </div>

          <div v-else-if="selectedRecord" class="mt-6 space-y-6">
            <div class="flex flex-wrap gap-2">
              <span :class="statusBadge(selectedRecord.user.is_active, 'badge-success', 'badge-error')">
                {{ selectedRecord.user.is_active ? 'Аккаунт активен' : 'Аккаунт отключён' }}
              </span>

              <span :class="statusBadge(selectedRecord.user.email_verified, 'badge-info', 'badge-warning')">
                {{ selectedRecord.user.email_verified ? 'Почта подтверждена' : 'Почта не подтверждена' }}
              </span>

              <span :class="statusBadge(selectedRecord.player_account.legacy_auth_enabled, 'badge-primary', 'badge-ghost')">
                {{ selectedRecord.player_account.legacy_auth_enabled ? 'Legacy включён' : 'Legacy выключен' }}
              </span>

              <span :class="statusBadge(selectedRecord.diagnostics.legacy_ready, 'badge-success', 'badge-error')">
                {{ selectedRecord.diagnostics.legacy_ready ? 'Legacy ready' : 'Legacy not ready' }}
              </span>

              <span :class="statusBadge(selectedRecord.diagnostics.must_use_launcher, 'badge-secondary', 'badge-ghost')">
                {{ selectedRecord.diagnostics.must_use_launcher ? 'Launcher only' : 'Mixed access' }}
              </span>
            </div>

            <div class="grid gap-3">
              <div class="build-info-card">
                <p class="build-info-card__label">Minecraft nick</p>
                <p class="build-info-card__value">{{ selectedRecord.player_account.minecraft_nickname }}</p>
              </div>

              <div class="build-info-card">
                <p class="build-info-card__label">Site login</p>
                <p class="build-info-card__value">{{ selectedRecord.user.site_login }}</p>
              </div>

              <div class="build-info-card">
                <p class="build-info-card__label">Email</p>
                <p class="build-info-card__value">{{ selectedRecord.user.email }}</p>
              </div>

              <div class="build-info-card">
                <p class="build-info-card__label">Player account id</p>
                <p class="build-info-card__value break-all">{{ selectedRecord.player_account.id }}</p>
              </div>

              <div class="build-info-card">
                <p class="build-info-card__label">User id</p>
                <p class="build-info-card__value break-all">{{ selectedRecord.user.id }}</p>
              </div>

              <div class="build-info-card">
                <p class="build-info-card__label">Legacy hash algo</p>
                <p class="build-info-card__value">{{ selectedRecord.player_account.legacy_hash_algo || '—' }}</p>
              </div>

              <div class="build-info-card">
                <p class="build-info-card__label">Refresh sessions active</p>
                <p class="build-info-card__value">{{ selectedRecord.diagnostics.refresh_sessions_active }}</p>
              </div>

              <div class="build-info-card">
                <p class="build-info-card__label">Создан</p>
                <p class="build-info-card__value">{{ formatDate(selectedRecord.user.created_at) }}</p>
              </div>
            </div>

            <div class="rounded-[24px] border border-slate-200 bg-white/80 p-5">
              <p class="text-sm font-semibold text-slate-900">Быстрые переключатели</p>

              <div class="mt-4 grid gap-4">
                <label class="label cursor-pointer justify-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    class="toggle toggle-primary"
                    :checked="selectedRecord.player_account.legacy_auth_enabled"
                    :disabled="actionBusy"
                    @change="toggleLegacy"
                  />
                  <div>
                    <div class="font-semibold text-slate-800">Legacy вход</div>
                    <div class="text-sm text-slate-500">
                      Разрешить или запретить вход через /login для этого игрока.
                    </div>
                  </div>
                </label>

                <label class="label cursor-pointer justify-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    class="toggle toggle-secondary"
                    :checked="selectedRecord.user.is_active"
                    :disabled="actionBusy"
                    @change="toggleUserActive"
                  />
                  <div>
                    <div class="font-semibold text-slate-800">Аккаунт активен</div>
                    <div class="text-sm text-slate-500">
                      Полное включение или отключение пользовательского аккаунта.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div class="rounded-[24px] border border-slate-200 bg-white/80 p-5">
              <p class="text-sm font-semibold text-slate-900">Legacy hash editor</p>
              <p class="mt-2 text-sm leading-7 text-slate-600">
                Backend не возвращает сам hash обратно, только его наличие и algo.
                Поэтому после сохранения поле hash очищается намеренно.
              </p>

              <div class="mt-5 grid gap-4">
                <label class="form-control w-full">
                  <span class="label-text mb-2 font-semibold text-slate-700">Legacy password hash</span>
                  <textarea
                    v-model="legacyEditor.legacy_password_hash"
                    class="textarea textarea-bordered min-h-[120px] w-full rounded-2xl"
                    placeholder="Вставь legacy hash сюда"
                  ></textarea>
                </label>

                <label class="form-control w-full">
                  <span class="label-text mb-2 font-semibold text-slate-700">Legacy hash algo</span>
                  <input
                    v-model="legacyEditor.legacy_hash_algo"
                    class="input input-bordered w-full rounded-2xl"
                    placeholder="Например: custom_pbkdf2_sha256"
                  />
                </label>

                <div class="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    class="btn btn-primary rounded-2xl"
                    :disabled="actionBusy || !canSaveHash"
                    @click="saveLegacyHash"
                  >
                    {{ actionBusy ? 'Сохраняем...' : 'Сохранить legacy hash' }}
                  </button>

                  <button
                    type="button"
                    class="btn btn-outline rounded-2xl"
                    :disabled="actionBusy"
                    @click="clearLegacyHash"
                  >
                    Очистить hash
                  </button>
                </div>
              </div>
            </div>

            <div class="rounded-[24px] border border-slate-200 bg-white/80 p-5">
              <p class="text-sm font-semibold text-slate-900">Сессии и сервисные действия</p>

              <div class="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  class="btn btn-outline rounded-2xl"
                  :disabled="actionBusy"
                  @click="revokeRefreshSessions"
                >
                  Отозвать refresh sessions
                </button>

                <button
                  type="button"
                  class="btn btn-ghost rounded-2xl"
                  :disabled="actionBusy"
                  @click="openPlayer(selectedPlayerId)"
                >
                  Перечитать карточку
                </button>
              </div>
            </div>

            <p
              v-if="actionMessage"
              class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              {{ actionMessage }}
            </p>

            <p
              v-if="actionError"
              class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {{ actionError }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
