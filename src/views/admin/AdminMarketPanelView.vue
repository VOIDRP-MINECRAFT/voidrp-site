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
  <div class="ap">
    <!-- Header -->
    <div class="ap__header">
      <div>
        <h1 class="ap__title">Рынок</h1>
        <p class="ap__sub">Управление товарами и ценами</p>
      </div>
      <button class="btn btn--primary btn--sm" :disabled="recalcLoading" @click="recalculate">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        {{ recalcLoading ? 'Пересчёт...' : 'Пересчитать рынок' }}
      </button>
    </div>

    <div v-if="recalcMsg" class="notice" :class="recalcMsg.startsWith('✓') ? 'notice--ok' : 'notice--err'">
      {{ recalcMsg }}
    </div>

    <!-- Summary cards -->
    <div v-if="loadingSummary" class="skel skel--cards" />
    <div v-else-if="summary" class="stats-row">
      <div class="stat">
        <div class="stat__l">Всего товаров</div>
        <div class="stat__v">{{ summary.total_items ?? '—' }}</div>
      </div>
      <div class="stat stat--accent">
        <div class="stat__l">Активных</div>
        <div class="stat__v">{{ summary.active_items ?? '—' }}</div>
      </div>
      <div class="stat">
        <div class="stat__l">Сделок 24ч</div>
        <div class="stat__v">{{ summary.shop_transactions_24h ?? '—' }}</div>
      </div>
      <div class="stat">
        <div class="stat__l">Объём 24ч</div>
        <div class="stat__v">{{ summary.shop_volume_24h != null ? Math.round(summary.shop_volume_24h).toLocaleString('ru') : '—' }}</div>
      </div>
      <div class="stat">
        <div class="stat__l">Нац. заявок 24ч</div>
        <div class="stat__v">{{ summary.nation_orders_24h ?? '—' }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="search" class="inp" placeholder="Поиск по материалу или названию..." @input="loadItems" />
      <select v-model="filterEnabled" class="sel">
        <option value="">Все товары</option>
        <option value="true">Только активные</option>
        <option value="false">Только выключенные</option>
      </select>
      <span class="filters__hint">Кликни на цену для редактирования</span>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div v-if="loadingItems" class="skel skel--tall" />
      <table v-else-if="visibleItems().length" class="tbl">
        <thead>
          <tr>
            <th>Материал</th>
            <th>Название</th>
            <th>База покуп.</th>
            <th>База продаж.</th>
            <th>Тек. покуп.</th>
            <th>Тек. продаж.</th>
            <th>Тренд</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in visibleItems()"
            :key="item.material"
            :class="{ 'tbl__row--dim': !item.enabled, 'tbl__row--loading': actionLoading === item.material }"
          >
            <td class="tbl__mat">{{ item.material }}</td>
            <td class="tbl__name">{{ item.display_name || '—' }}</td>

            <!-- Base buy price — editable -->
            <td class="tbl__price">
              <span
                v-if="!isEditing(item.material, 'base_buy_price')"
                class="price-cell"
                @click="startEdit(item.material, 'base_buy_price', item.base_buy_price)"
              >{{ fmt(item.base_buy_price) }}</span>
              <input
                v-else
                v-model="editingVal"
                class="price-input"
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
            <td class="tbl__price">
              <span
                v-if="!isEditing(item.material, 'base_sell_price')"
                class="price-cell"
                @click="startEdit(item.material, 'base_sell_price', item.base_sell_price)"
              >{{ fmt(item.base_sell_price) }}</span>
              <input
                v-else
                v-model="editingVal"
                class="price-input"
                type="number"
                step="0.01"
                min="0"
                @keyup.enter="commitEdit(item.material, 'base_sell_price')"
                @keyup.escape="cancelEdit"
                @blur="commitEdit(item.material, 'base_sell_price')"
                v-focus
              />
            </td>

            <td class="tbl__price tbl__price--cur">{{ fmt(item.current_buy_price) }}</td>
            <td class="tbl__price tbl__price--cur">{{ fmt(item.current_sell_price) }}</td>
            <td :class="['tbl__trend', trend(item.trend_percent).cls]">{{ trend(item.trend_percent).text }}</td>

            <td>
              <span class="badge" :class="item.enabled ? 'badge--green' : 'badge--red'">
                {{ item.enabled ? 'Активен' : 'Выключен' }}
              </span>
            </td>

            <td>
              <div class="row-actions">
                <button
                  v-if="!item.enabled"
                  class="btn btn--success btn--xs"
                  :disabled="actionLoading === item.material"
                  @click="doEnable(item.material)"
                >Вкл</button>
                <button
                  v-else
                  class="btn btn--ghost btn--xs"
                  :disabled="actionLoading === item.material"
                  @click="doDisable(item.material)"
                >Выкл</button>
                <button
                  class="btn btn--danger btn--xs"
                  :disabled="actionLoading === item.material"
                  @click="doReset(item.material)"
                >Сброс</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">Нет товаров</div>
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
  margin-bottom: 1rem;
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

/* Filters */
.filters { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.85rem; align-items: center; }

.inp, .sel {
  padding: 0.42rem 0.75rem;
  background: #0d1422;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.13s;
}
.inp { flex: 1; min-width: 200px; }
.inp:focus, .sel:focus { border-color: rgba(124,58,237,0.45); }
.sel option { background: #0d1422; }

.filters__hint { font-size: .75rem; color: #334155; font-style: italic; }

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
.btn--success { background: rgba(34,197,94,0.12); color: #86efac; }
.btn--success:hover:not(:disabled) { background: rgba(34,197,94,0.22); }
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

.tbl__mat { font-weight: 800; color: #c4b5fd !important; font-size: .75rem; font-family: monospace; }
.tbl__name { color: #94a3b8 !important; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }

.tbl__price { text-align: right; min-width: 80px; }
.tbl__price--cur { color: #475569 !important; }

.price-cell {
  cursor: pointer;
  color: #94a3b8;
  padding: 0.1rem 0.25rem;
  border-radius: 4px;
  transition: background 0.1s;
}
.price-cell:hover { background: rgba(124,58,237,0.15); color: #c4b5fd; }

.price-input {
  width: 80px;
  padding: 0.15rem 0.35rem;
  background: #111827;
  border: 1px solid rgba(124,58,237,0.5);
  border-radius: 5px;
  color: #e2e8f0;
  font-size: 0.78rem;
  outline: none;
  text-align: right;
}

.tbl__trend { font-weight: 700; font-size: .75rem; }
.tbl__trend.up { color: #86efac; }
.tbl__trend.down { color: #fca5a5; }

.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: .75rem; font-weight: 800; }
.badge--green { background: rgba(34,197,94,0.1); color: #86efac; }
.badge--red { background: rgba(239,68,68,0.1); color: #fca5a5; }

.row-actions { display: flex; gap: 0.3rem; }

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
