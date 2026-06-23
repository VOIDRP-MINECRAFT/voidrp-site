<script setup>
import { onMounted, reactive, ref } from 'vue'
import {
  disableAdminMarketItem,
  enableAdminMarketItem,
  getAdminMarketSummary,
  listAdminMarketItems,
  patchAdminMarketItem,
  recalculateAdminMarket,
  resetAdminMarketItem,
} from '../services/adminApi'

const loading = ref(true)
const saving = ref(false)
const message = ref('')
const error = ref('')
const summary = ref(null)
const items = ref([])
const selected = ref(null)

const filters = reactive({
  q: '',
  sort: 'updated',
  direction: 'desc',
})

const editForm = reactive({
  base_buy_price: '',
  base_sell_price: '',
  current_buy_price: '',
  current_sell_price: '',
  buy_multiplier: '',
  sell_multiplier: '',
  group_key: '',
  display_name: '',
  admin_note: '',
})

function money(value) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return '0.00'
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)
}

function showMessage(text) {
  message.value = text
  window.setTimeout(() => {
    if (message.value === text) message.value = ''
  }, 3600)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [summaryPayload, itemsPayload] = await Promise.all([
      getAdminMarketSummary(),
      listAdminMarketItems({ ...filters, include_disabled: true, limit: 500 }),
    ])
    summary.value = summaryPayload
    items.value = itemsPayload?.items || []
  } catch (err) {
    error.value = err?.message || 'Не удалось загрузить рынок.'
  } finally {
    loading.value = false
  }
}

function selectItem(item) {
  selected.value = item
  editForm.base_buy_price = String(item.base_buy_price ?? '')
  editForm.base_sell_price = String(item.base_sell_price ?? '')
  editForm.current_buy_price = String(item.current_buy_price ?? '')
  editForm.current_sell_price = String(item.current_sell_price ?? '')
  editForm.buy_multiplier = String(item.buy_multiplier ?? '')
  editForm.sell_multiplier = String(item.sell_multiplier ?? '')
  editForm.group_key = item.group_key || 'default'
  editForm.display_name = item.display_name || ''
  editForm.admin_note = ''
}

function numericOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(String(value).replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

async function saveSelected(extraPayload = {}) {
  if (!selected.value) return
  saving.value = true
  error.value = ''
  try {
    const payload = {
      display_name: editForm.display_name || null,
      group_key: editForm.group_key || 'default',
      base_buy_price: numericOrNull(editForm.base_buy_price),
      base_sell_price: numericOrNull(editForm.base_sell_price),
      current_buy_price: numericOrNull(editForm.current_buy_price),
      current_sell_price: numericOrNull(editForm.current_sell_price),
      buy_multiplier: numericOrNull(editForm.buy_multiplier),
      sell_multiplier: numericOrNull(editForm.sell_multiplier),
      admin_note: editForm.admin_note || null,
      ...extraPayload,
    }
    const response = await patchAdminMarketItem(selected.value.material, payload)
    showMessage(response?.message || 'Предмет обновлён.')
    await load()
    const fresh = items.value.find((item) => item.material === selected.value.material)
    if (fresh) selectItem(fresh)
  } catch (err) {
    error.value = err?.message || 'Не удалось сохранить предмет.'
  } finally {
    saving.value = false
  }
}

async function toggleSelected() {
  if (!selected.value) return
  saving.value = true
  error.value = ''
  try {
    const response = selected.value.enabled
      ? await disableAdminMarketItem(selected.value.material)
      : await enableAdminMarketItem(selected.value.material)
    showMessage(response?.message || 'Статус изменён.')
    await load()
    const fresh = items.value.find((item) => item.material === selected.value.material)
    if (fresh) selectItem(fresh)
  } catch (err) {
    error.value = err?.message || 'Не удалось изменить статус.'
  } finally {
    saving.value = false
  }
}

async function resetSelected() {
  if (!selected.value) return
  saving.value = true
  error.value = ''
  try {
    const response = await resetAdminMarketItem(selected.value.material)
    showMessage(response?.message || 'Цена сброшена к базовой.')
    await load()
    const fresh = items.value.find((item) => item.material === selected.value.material)
    if (fresh) selectItem(fresh)
  } catch (err) {
    error.value = err?.message || 'Не удалось сбросить предмет.'
  } finally {
    saving.value = false
  }
}

async function recalculate() {
  saving.value = true
  error.value = ''
  try {
    const response = await recalculateAdminMarket(true)
    showMessage(`Пересчёт завершён. Изменено: ${response.changed}/${response.total}`)
    await load()
  } catch (err) {
    error.value = err?.message || 'Не удалось пересчитать рынок.'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="admin-market min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
    <div class="mx-auto max-w-[1440px] space-y-4">
      <header class="admin-market__header">
        <div>
          <p>VoidRP Admin</p>
          <h1>Управление рынком</h1>
          <span>Публичная экономика, EconomyShopGUI и рынок государств</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <RouterLink to="/internal-admin" class="btn btn-ghost">Legacy admin</RouterLink>
          <button class="btn btn-primary" :disabled="saving" @click="recalculate">Пересчитать рынок</button>
          <button class="btn btn-outline" :disabled="loading" @click="load">Обновить</button>
        </div>
      </header>

      <div v-if="message" class="alert alert-success">{{ message }}</div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="admin-card">
          <small>Активных товаров</small>
          <strong>{{ summary?.active_items || 0 }}</strong>
        </article>
        <article class="admin-card">
          <small>Всего товаров</small>
          <strong>{{ summary?.total_items || 0 }}</strong>
        </article>
        <article class="admin-card">
          <small>Лоты государств</small>
          <strong>{{ summary?.active_nation_listings || 0 }}</strong>
        </article>
        <article class="admin-card">
          <small>Оборот 24ч</small>
          <strong>{{ money(summary?.shop_volume_24h || 0) }}</strong>
        </article>
      </section>

      <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div class="admin-panel">
          <div class="admin-panel__top">
            <div>
              <p>Товары</p>
              <h2>Market items</h2>
            </div>
            <form class="admin-filters" @submit.prevent="load">
              <input v-model="filters.q" class="input" placeholder="Поиск material/display name" />
              <select v-model="filters.sort" class="select">
                <option value="updated">Обновление</option>
                <option value="material">Название</option>
                <option value="buy">Покупка</option>
                <option value="sell">Скупка</option>
                <option value="demand">Спрос</option>
                <option value="supply">Предложение</option>
              </select>
              <button class="btn btn-sm btn-primary">Найти</button>
            </form>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Предмет</th>
                  <th>Buy</th>
                  <th>Sell</th>
                  <th>Спрос</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in items"
                  :key="item.material"
                  :class="{ 'is-selected': selected?.material === item.material }"
                  @click="selectItem(item)"
                >
                  <td>
                    <strong>{{ item.display_name || item.material }}</strong>
                    <span>{{ item.material }}</span>
                  </td>
                  <td>{{ money(item.current_buy_price) }}</td>
                  <td>{{ money(item.current_sell_price) }}</td>
                  <td>{{ money(item.demand_score) }} / {{ money(item.supply_score) }}</td>
                  <td>{{ item.enabled ? 'Вкл' : 'Выкл' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <aside class="admin-panel admin-editor">
          <template v-if="selected">
            <div class="admin-panel__top !items-start">
              <div>
                <p>Редактирование</p>
                <h2>{{ selected.material }}</h2>
              </div>
              <span :class="selected.enabled ? 'status-good' : 'status-bad'">
                {{ selected.enabled ? 'enabled' : 'disabled' }}
              </span>
            </div>

            <div class="grid gap-3">
              <label>
                <span>Display name</span>
                <input v-model="editForm.display_name" class="input" />
              </label>
              <label>
                <span>Group</span>
                <input v-model="editForm.group_key" class="input" />
              </label>
              <div class="grid gap-3 md:grid-cols-2">
                <label><span>Base buy</span><input v-model="editForm.base_buy_price" class="input" /></label>
                <label><span>Base sell</span><input v-model="editForm.base_sell_price" class="input" /></label>
                <label><span>Current buy</span><input v-model="editForm.current_buy_price" class="input" /></label>
                <label><span>Current sell</span><input v-model="editForm.current_sell_price" class="input" /></label>
                <label><span>Buy multiplier</span><input v-model="editForm.buy_multiplier" class="input" /></label>
                <label><span>Sell multiplier</span><input v-model="editForm.sell_multiplier" class="input" /></label>
              </div>
              <label>
                <span>Admin note</span>
                <textarea v-model="editForm.admin_note" class="textarea" rows="3"></textarea>
              </label>
            </div>

            <div class="mt-4 grid gap-2">
              <button class="btn btn-primary" :disabled="saving" @click="saveSelected()">Сохранить</button>
              <button class="btn btn-outline" :disabled="saving" @click="saveSelected({ reset_scores: true })">Сбросить спрос/предложение</button>
              <button class="btn btn-ghost" :disabled="saving" @click="resetSelected">Сбросить к базовой цене</button>
              <button class="btn" :class="selected.enabled ? 'btn-error' : 'btn-success'" :disabled="saving" @click="toggleSelected">
                {{ selected.enabled ? 'Отключить из рынка' : 'Включить в рынок' }}
              </button>
            </div>
          </template>

          <div v-else class="admin-empty">
            <h2>Выбери предмет</h2>
            <p>Нажми строку в таблице, чтобы вручную отредактировать цены, множители или отключить товар из динамики.</p>
          </div>
        </aside>
      </section>
    </div>
  </section>
</template>

<style scoped>
.admin-market__header,
.admin-panel,
.admin-card {
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 1.35rem;
  background: rgba(15, 23, 42, .72);
  box-shadow: 0 22px 80px rgba(0,0,0,.26);
}

.admin-market__header {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
}

.admin-market__header p,
.admin-panel__top p,
.admin-card small,
.admin-editor label span {
  color: rgb(148 163 184);
  font-size: .75rem;
  font-weight: 900;
  letter-spacing: .16em;
  text-transform: uppercase;
}

.admin-market__header h1,
.admin-panel__top h2 {
  color: white;
  font-weight: 950;
  letter-spacing: -.03em;
}

.admin-market__header h1 {
  font-size: clamp(1.4rem, 2.3vw, 2.6rem);
}

.admin-market__header span {
  color: rgb(203 213 225);
}

.admin-card {
  padding: .95rem;
}

.admin-card strong {
  display: block;
  margin-top: .35rem;
  color: white;
  font-size: 1.45rem;
}

.admin-panel {
  padding: 1rem;
}

.admin-panel__top {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.admin-filters {
  display: grid;
  grid-template-columns: minmax(0, 240px) 150px auto;
  gap: .55rem;
}

.admin-table-wrap {
  overflow-x: auto;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 1rem;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 780px;
}

.admin-table th,
.admin-table td {
  border-bottom: 1px solid rgba(255,255,255,.07);
  padding: .75rem .85rem;
  text-align: left;
}

.admin-table th {
  color: rgb(148 163 184);
  font-size: .75rem;
  font-weight: 900;
  letter-spacing: .16em;
  text-transform: uppercase;
}

.admin-table tr {
  cursor: pointer;
  transition: .15s ease;
}

.admin-table tr:hover,
.admin-table tr.is-selected {
  background: rgba(109, 93, 246, .12);
}

.admin-table td {
  color: rgb(203 213 225);
  font-size: .9rem;
}

.admin-table td strong,
.admin-table td span {
  display: block;
}

.admin-table td span {
  color: rgb(100 116 139);
  font-size: .78rem;
}

.status-good,
.status-bad {
  border-radius: 999px;
  padding: .38rem .65rem;
  font-size: .75rem;
  font-weight: 900;
  text-transform: uppercase;
}

.status-good {
  background: rgba(34, 197, 94, .12);
  color: rgb(134 239 172);
}

.status-bad {
  background: rgba(244, 63, 94, .12);
  color: rgb(253 164 175);
}

.admin-empty {
  display: grid;
  min-height: 320px;
  place-items: center;
  text-align: center;
}

.admin-empty h2 {
  color: white;
  font-size: 1.2rem;
  font-weight: 950;
}

.admin-empty p {
  margin-top: .5rem;
  max-width: 300px;
  color: rgb(148 163 184);
  line-height: 1.7;
}

@media (max-width: 900px) {
  .admin-market__header,
  .admin-panel__top {
    align-items: stretch;
    flex-direction: column;
  }

  .admin-filters {
    grid-template-columns: 1fr;
  }
}
</style>
