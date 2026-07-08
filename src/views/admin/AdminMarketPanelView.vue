<script setup>
import { onMounted, ref } from 'vue'

const vFocus = { mounted(el) { el.focus(); el.select() } }
import {
  adminGetMarketSummary,
  adminListMarketItems,
  adminEnableMarketItem,
  adminDisableMarketItem,
  adminResetMarketItem,
  adminRecalculateMarket,
  adminPatchMarketItem,
} from '../../services/adminApi'
import { authState } from '../../stores/authStore'

const token = () => authState.accessToken

const summary = ref(null)
const items = ref([])
const loadingSummary = ref(true)
const loadingItems = ref(true)
const actionLoading = ref(null)
const search = ref('')
const filterEnabled = ref('')
const recalcLoading = ref(false)
const recalcMsg = ref('')

// inline edit
const editingCell = ref(null) // { material, field }
const editingVal = ref('')

async function loadSummary() {
  loadingSummary.value = true
  try { summary.value = await adminGetMarketSummary(token()) }
  catch { summary.value = null }
  finally { loadingSummary.value = false }
}

async function loadItems() {
  loadingItems.value = true
  try {
    const params = { include_disabled: true, limit: 500 }
    if (search.value) params.q = search.value
    if (filterEnabled.value !== '') params.include_disabled = filterEnabled.value === 'false' ? false : true
    const data = await adminListMarketItems(token(), params)
    items.value = data?.items || []
  } catch {
    items.value = []
  } finally {
    loadingItems.value = false
  }
}

async function doEnable(material) {
  actionLoading.value = material
  try { await adminEnableMarketItem(token(), material); await loadItems() } catch { /* noop */ }
  finally { actionLoading.value = null }
}

async function doDisable(material) {
  actionLoading.value = material
  try { await adminDisableMarketItem(token(), material); await loadItems() } catch { /* noop */ }
  finally { actionLoading.value = null }
}

async function doReset(material) {
  if (!confirm(`Сбросить цены для ${material}?`)) return
  actionLoading.value = material
  try { await adminResetMarketItem(token(), material); await loadItems() } catch { /* noop */ }
  finally { actionLoading.value = null }
}

async function recalculate() {
  recalcLoading.value = true
  recalcMsg.value = ''
  try {
    await adminRecalculateMarket(token(), true)
    recalcMsg.value = '✓ Пересчёт выполнен'
    await loadItems()
  } catch (e) {
    recalcMsg.value = '✗ ' + (e.message || 'Ошибка пересчёта')
  } finally {
    recalcLoading.value = false
  }
}

// inline editing
function startEdit(material, field, current) {
  editingCell.value = { material, field }
  editingVal.value = current !== null && current !== undefined ? String(current) : ''
}

async function commitEdit(material, field) {
  const val = parseFloat(editingVal.value)
  if (isNaN(val) || val < 0) { cancelEdit(); return }
  const payload = {}
  payload[field] = val
  actionLoading.value = material
  try {
    await adminPatchMarketItem(token(), material, payload)
    const idx = items.value.findIndex(i => i.material === material)
    if (idx !== -1) items.value[idx][field] = val
  } catch { /* noop */ }
  finally {
    actionLoading.value = null
    editingCell.value = null
  }
}

function cancelEdit() { editingCell.value = null }

function isEditing(material, field) {
  return editingCell.value?.material === material && editingCell.value?.field === field
}

function fmt(v) { return v != null ? Number(v).toFixed(2) : '—' }
function trend(v) {
  if (v == null) return { text: '—', cls: '' }
  const n = Number(v)
  return { text: (n > 0 ? '+' : '') + n.toFixed(1) + '%', cls: n > 0 ? 'up' : n < 0 ? 'down' : '' }
}

function visibleItems() {
  if (filterEnabled.value === 'true') return items.value.filter(i => i.enabled)
  if (filterEnabled.value === 'false') return items.value.filter(i => !i.enabled)
  return items.value
}

onMounted(() => { loadSummary(); loadItems() })
</script>

<template>
  <div class="adm-page">
    <!-- Header -->
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Рынок</h1>
        <p class="adm-sub">Товары и цены выбранного сервера</p>
      </div>
      <button class="adm-btn adm-btn--acc" :disabled="recalcLoading" @click="recalculate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        {{ recalcLoading ? 'Пересчёт...' : 'Пересчитать рынок' }}
      </button>
    </div>

    <div v-if="recalcMsg" class="notice" :class="recalcMsg.startsWith('✓') ? 'notice--ok' : 'notice--err'">
      {{ recalcMsg }}
    </div>

    <!-- Summary cards -->
    <div v-if="loadingSummary" class="adm-skel" style="height: 72px" />
    <div v-else-if="summary" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div class="adm-kpi"><div><div class="adm-kpi__val">{{ summary.total_items ?? '—' }}</div><div class="adm-kpi__label">Всего товаров</div></div></div>
      <div class="adm-kpi adm-kpi--acc"><div><div class="adm-kpi__val" style="color: var(--adm-acc-text)">{{ summary.active_items ?? '—' }}</div><div class="adm-kpi__label">Активных</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val">{{ summary.shop_transactions_24h ?? '—' }}</div><div class="adm-kpi__label">Сделок 24ч</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val">{{ summary.shop_volume_24h != null ? Math.round(summary.shop_volume_24h).toLocaleString('ru') : '—' }}</div><div class="adm-kpi__label">Объём 24ч</div></div></div>
      <div class="adm-kpi"><div><div class="adm-kpi__val">{{ summary.nation_orders_24h ?? '—' }}</div><div class="adm-kpi__label">Нац. заявок 24ч</div></div></div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="search" class="adm-input filters__search" placeholder="Поиск по материалу или названию..." @input="loadItems" />
      <select v-model="filterEnabled" class="adm-select" style="width: auto">
        <option value="">Все товары</option>
        <option value="true">Только активные</option>
        <option value="false">Только выключенные</option>
      </select>
      <span class="filters__hint">Кликни на цену для редактирования</span>
    </div>

    <!-- Table -->
    <div v-if="loadingItems" class="adm-skel" style="height: 280px" />
    <div v-else-if="visibleItems().length" class="adm-table-wrap">
      <div class="adm-table-scroll">
        <table class="adm-table" style="white-space: nowrap">
          <thead>
            <tr>
              <th>Материал</th>
              <th>Название</th>
              <th style="text-align: right">База покуп.</th>
              <th style="text-align: right">База продаж.</th>
              <th style="text-align: right">Тек. покуп.</th>
              <th style="text-align: right">Тек. продаж.</th>
              <th>Тренд</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in visibleItems()"
              :key="item.material"
              :class="{ 'row--dim': !item.enabled, 'row--loading': actionLoading === item.material }"
            >
              <td class="cell-mat adm-mono">{{ item.material }}</td>
              <td class="cell-name">{{ item.display_name || '—' }}</td>

              <!-- Base buy price — editable -->
              <td class="cell-price adm-num">
                <span
                  v-if="!isEditing(item.material, 'base_buy_price')"
                  class="price-cell"
                  @click="startEdit(item.material, 'base_buy_price', item.base_buy_price)"
                >{{ fmt(item.base_buy_price) }}</span>
                <input
                  v-else
                  v-model="editingVal"
                  class="price-input adm-num"
                  type="number"
                  step="0.01"
                  min="0"
                  @keyup.enter="commitEdit(item.material, 'base_buy_price')"
                  @keyup.escape="cancelEdit"
                  @blur="commitEdit(item.material, 'base_buy_price')"
                  v-focus
                />
              </td>

              <!-- Base sell price — editable -->
              <td class="cell-price adm-num">
                <span
                  v-if="!isEditing(item.material, 'base_sell_price')"
                  class="price-cell"
                  @click="startEdit(item.material, 'base_sell_price', item.base_sell_price)"
                >{{ fmt(item.base_sell_price) }}</span>
                <input
                  v-else
                  v-model="editingVal"
                  class="price-input adm-num"
                  type="number"
                  step="0.01"
                  min="0"
                  @keyup.enter="commitEdit(item.material, 'base_sell_price')"
                  @keyup.escape="cancelEdit"
                  @blur="commitEdit(item.material, 'base_sell_price')"
                  v-focus
                />
              </td>

              <td class="cell-price cell-price--cur adm-num">{{ fmt(item.current_buy_price) }}</td>
              <td class="cell-price cell-price--cur adm-num">{{ fmt(item.current_sell_price) }}</td>
              <td :class="['cell-trend adm-num', trend(item.trend_percent).cls]">{{ trend(item.trend_percent).text }}</td>

              <td>
                <span class="adm-badge" :class="item.enabled ? 'adm-badge--ok' : 'adm-badge--err'">
                  {{ item.enabled ? 'Активен' : 'Выключен' }}
                </span>
              </td>

              <td>
                <div class="row-actions">
                  <button
                    v-if="!item.enabled"
                    class="adm-btn adm-btn--ok adm-btn--sm"
                    :disabled="actionLoading === item.material"
                    @click="doEnable(item.material)"
                  >Вкл</button>
                  <button
                    v-else
                    class="adm-btn adm-btn--sm"
                    :disabled="actionLoading === item.material"
                    @click="doDisable(item.material)"
                  >Выкл</button>
                  <button
                    class="adm-btn adm-btn--danger adm-btn--sm"
                    :disabled="actionLoading === item.material"
                    @click="doReset(item.material)"
                  >Сброс</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="adm-empty">
      <div class="adm-empty__title">Нет товаров</div>
      <div class="adm-empty__sub">На этом сервере рынок пока пуст</div>
    </div>
  </div>
</template>

<style scoped>
.notice {
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
}
.notice--ok { background: rgba(52, 211, 153, 0.1); color: #6ee7b7; }
.notice--err { background: rgba(248, 113, 113, 0.1); color: #fca5a5; }

.filters { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.filters__search { flex: 1; min-width: 200px; max-width: 420px; }
.filters__hint { font-size: 0.72rem; color: var(--adm-faint); font-style: italic; }

.row--dim { opacity: 0.45; }
.row--loading { opacity: 0.6; pointer-events: none; }

.cell-mat { font-weight: 800; color: var(--adm-acc-text); font-size: 0.73rem; }
.cell-name { color: var(--adm-mut); max-width: 140px; overflow: hidden; text-overflow: ellipsis; }

.cell-price { text-align: right; min-width: 80px; }
.cell-price--cur { color: var(--adm-dim); }

.price-cell {
  cursor: pointer;
  color: var(--adm-mut);
  padding: 0.1rem 0.25rem;
  border-radius: 4px;
  transition: background-color 0.1s, color 0.1s;
}
.price-cell:hover { background: var(--adm-acc-soft); color: var(--adm-acc-text); }

.price-input {
  width: 84px;
  padding: 0.15rem 0.35rem;
  background: #080c16;
  border: 1px solid var(--adm-acc-line);
  border-radius: 5px;
  color: var(--adm-text);
  font-size: 0.78rem;
  outline: none;
  text-align: right;
}

.cell-trend { font-weight: 700; font-size: 0.74rem; }
.cell-trend.up { color: #6ee7b7; }
.cell-trend.down { color: #fca5a5; }

.row-actions { display: flex; gap: 0.3rem; }
</style>
