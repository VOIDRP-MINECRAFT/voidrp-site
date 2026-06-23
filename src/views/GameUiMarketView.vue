<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  setWebguiToken,
  getItems,
  getOrderBook,
  getMySellOrders,
  getMyBuyOrders,
  getMyTrades,
  getPickupReady,
  createPendingAction,
} from '../services/gameUiMarketApi'
import { useItemNames } from '../composables/useItemNames'
import ItemIcon from '../components/ItemIcon.vue'

const { t } = useI18n()
const route = useRoute()
const itemNames = useItemNames()

// ── Auth ──────────────────────────────────────────────────────────────────────

const tokenValid = ref(true)

function initToken() {
  const token = route.query.webgui_token || ''
  if (!token) {
    tokenValid.value = false
    return
  }
  setWebguiToken(token)
}

// ── State ─────────────────────────────────────────────────────────────────────

const tab = ref('items')
const loading = ref(false)
const error = ref(null)

// Items tab
const items = ref([])
const search = ref('')
const filteredItems = computed(() => {
  if (!search.value.trim()) return items.value
  const q = search.value.toLowerCase()
  return items.value.filter(i =>
    i.item_key.toLowerCase().includes(q) ||
    (i.display_name && i.display_name.toLowerCase().includes(q))
  )
})

// Order book modal
const orderBookItem = ref(null)
const orderBook = ref(null)
const orderBookLoading = ref(false)
const buyModal = ref(false)
const buyTarget = ref(null) // { sell_order_id, unit_price, max_amount, display_name, item_key }
const buyAmount = ref(1)
const buySubmitting = ref(false)
const buyResult = ref(null)

// My orders
const mySellOrders = ref([])
const myBuyOrders = ref([])
const myTrades = ref([])
const cancellingId = ref(null)

// Pickup
const pickupCount = ref(0)
const pickupSubmitting = ref(false)
const pickupResult = ref(null)

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadTab(name) {
  tab.value = name
  error.value = null
  loading.value = true
  try {
    if (name === 'items') await loadItems()
    else if (name === 'orders') await loadMyOrders()
    else if (name === 'trades') await loadMyTrades()
    else if (name === 'pickup') await loadPickup()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadItems() {
  const res = await getItems()
  items.value = res?.items || []
}

async function loadMyOrders() {
  const [s, b] = await Promise.all([getMySellOrders(), getMyBuyOrders()])
  mySellOrders.value = s?.items || []
  myBuyOrders.value = b?.items || []
}

async function loadMyTrades() {
  const res = await getMyTrades()
  myTrades.value = res?.items || []
}

async function loadPickup() {
  const res = await getPickupReady()
  pickupCount.value = res?.count || 0
}

async function openOrderBook(item) {
  orderBookItem.value = item
  orderBook.value = null
  orderBookLoading.value = true
  try {
    orderBook.value = await getOrderBook(item.item_key)
  } catch (e) {
    orderBook.value = { error: e.message }
  } finally {
    orderBookLoading.value = false
  }
}

// ── Buy ───────────────────────────────────────────────────────────────────────

function openBuyModal(sellOrder) {
  buyTarget.value = {
    sell_order_id: sellOrder.id,
    unit_price: sellOrder.unit_price,
    max_amount: sellOrder.remaining_amount,
    display_name: sellOrder.display_name || orderBookItem.value?.item_key || '',
    item_key: orderBookItem.value?.item_key || '',
  }
  buyAmount.value = Math.min(1, sellOrder.remaining_amount)
  buyResult.value = null
  buyModal.value = true
}

async function submitBuy() {
  if (!buyTarget.value || buyAmount.value <= 0) return
  buySubmitting.value = true
  buyResult.value = null
  try {
    await createPendingAction('buy', {
      item_key: buyTarget.value.item_key,
      amount: buyAmount.value,
      unit_price: buyTarget.value.unit_price,
      display_name: buyTarget.value.display_name,
    })
    buyResult.value = { ok: true }
    setTimeout(() => { buyModal.value = false }, 2000)
  } catch (e) {
    buyResult.value = { ok: false, msg: e.message }
  } finally {
    buySubmitting.value = false
  }
}

// ── Cancel ────────────────────────────────────────────────────────────────────

async function cancelSell(orderId) {
  if (cancellingId.value) return
  cancellingId.value = orderId
  try {
    await createPendingAction('cancel_sell', { order_id: orderId })
    mySellOrders.value = mySellOrders.value.filter(o => o.id !== orderId)
  } catch (e) {
    error.value = e.message
  } finally {
    cancellingId.value = null
  }
}

async function cancelBuy(orderId) {
  if (cancellingId.value) return
  cancellingId.value = orderId
  try {
    await createPendingAction('cancel_buy', { order_id: orderId })
    myBuyOrders.value = myBuyOrders.value.filter(o => o.id !== orderId)
  } catch (e) {
    error.value = e.message
  } finally {
    cancellingId.value = null
  }
}

// ── Pickup ────────────────────────────────────────────────────────────────────

async function requestPickup() {
  pickupSubmitting.value = true
  pickupResult.value = null
  try {
    await createPendingAction('pickup', {})
    pickupResult.value = { ok: true }
    pickupCount.value = 0
  } catch (e) {
    pickupResult.value = { ok: false, msg: e.message }
  } finally {
    pickupSubmitting.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemLabel(key) {
  if (!key) return key
  if (itemNames.value[key]) return itemNames.value[key]
  const parts = key.split(':')
  return parts[parts.length - 1].replace(/_/g, ' ')
}

function displayName(item) {
  return itemLabel(item.item_key) || item.display_name || item.item_key
}

function money(n) {
  if (n === undefined || n === null) return '—'
  const num = parseFloat(n)
  return Number.isInteger(num) ? num.toLocaleString() : num.toFixed(2)
}

function statusLabel(status) {
  const map = {
    active: t('gameUiMarket.statusActive'),
    partially_filled: t('gameUiMarket.statusPartial'),
    cancelled: t('gameUiMarket.statusCancelled'),
    filled: t('gameUiMarket.statusFilled'),
  }
  return map[status] || status
}

function statusClass(status) {
  if (status === 'active') return 'badge-success'
  if (status === 'partially_filled') return 'badge-warning'
  if (status === 'cancelled') return 'badge-error'
  return 'badge-ghost'
}

// ── Polling ───────────────────────────────────────────────────────────────────

let pollTimer = null

async function silentRefresh() {
  try {
    if (tab.value === 'items') await loadItems()
    else if (tab.value === 'orders') await loadMyOrders()
    else if (tab.value === 'trades') await loadMyTrades()
    else if (tab.value === 'pickup') await loadPickup()
    if (tab.value !== 'pickup') {
      const res = await getPickupReady()
      pickupCount.value = res?.count || 0
    }
  } catch (_) {}
}

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(() => {
  initToken()
  if (tokenValid.value) {
    loadTab('items')
    pollTimer = setInterval(silentRefresh, 5000)
  }
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="min-h-screen bg-base-100 text-base-content text-sm">
    <!-- Token error -->
    <div v-if="!tokenValid" class="p-6 text-center">
      <div class="text-error text-base font-bold mb-2">⚠ {{ t('gameUiMarket.tokenError') }}</div>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-200">
        <span class="font-bold text-base">{{ t('gameUiMarket.title') }}</span>
        <div class="flex items-center gap-1">
          <span v-if="pickupCount > 0" class="badge badge-warning badge-sm">{{ pickupCount }}</span>
          <button class="btn btn-ghost btn-xs" @click="loadTab(tab)">↻</button>
        </div>
      </div>

      <!-- Tabs -->
      <div role="tablist" class="tabs tabs-bordered tabs-sm px-2 pt-2">
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': tab === 'items' }"
          @click="loadTab('items')"
        >{{ t('gameUiMarket.tabItems') }}</button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': tab === 'orders' }"
          @click="loadTab('orders')"
        >{{ t('gameUiMarket.tabMyOrders') }}</button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': tab === 'trades' }"
          @click="loadTab('trades')"
        >{{ t('gameUiMarket.tabTrades') }}</button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': tab === 'pickup' }"
          @click="loadTab('pickup')"
        >
          {{ t('gameUiMarket.tabPickup') }}
          <span v-if="pickupCount > 0" class="badge badge-warning badge-xs ml-1">{{ pickupCount }}</span>
        </button>
      </div>

      <!-- Error banner -->
      <div v-if="error" class="mx-3 mt-2 alert alert-error py-2 text-xs">{{ error }}</div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-10">
        <span class="loading loading-spinner loading-md"></span>
      </div>

      <!-- ── Items tab ────────────────────────────────────────────────────── -->
      <div v-else-if="tab === 'items'" class="p-3">
        <input
          v-model="search"
          type="text"
          :placeholder="t('gameUiMarket.searchPlaceholder')"
          class="input input-bordered input-sm w-full mb-3"
        />

        <div v-if="filteredItems.length === 0" class="text-center py-8 text-base-content/40">
          {{ t('gameUiMarket.noItems') }}
        </div>

        <div v-else class="overflow-x-auto">
          <table class="table table-xs w-full">
            <thead>
              <tr>
                <th>{{ t('gameUiMarket.title') }}</th>
                <th class="text-right">{{ t('gameUiMarket.bestSell') }}</th>
                <th class="text-right">{{ t('gameUiMarket.bestBuy') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filteredItems"
                :key="item.item_key"
                class="hover cursor-pointer"
                @click="openOrderBook(item)"
              >
                <td>
                  <div class="flex items-center gap-2">
                    <ItemIcon :item-key="item.item_key" :size="20" />
                    <span class="truncate max-w-[140px]">{{ displayName(item) }}</span>
                  </div>
                </td>
                <td class="text-right text-success font-mono">
                  {{ item.best_sell_price != null ? money(item.best_sell_price) : '—' }}
                </td>
                <td class="text-right text-info font-mono">
                  {{ item.best_buy_price != null ? money(item.best_buy_price) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Order book drawer -->
        <div v-if="orderBookItem" class="mt-4 border border-base-300 rounded-xl p-3">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 font-semibold">
              <ItemIcon :item-key="orderBookItem.item_key" :size="20" />
              {{ displayName(orderBookItem) }}
            </div>
            <button class="btn btn-ghost btn-xs" @click="orderBookItem = null">✕</button>
          </div>

          <div v-if="orderBookLoading" class="text-center py-4">
            <span class="loading loading-spinner loading-sm"></span>
          </div>
          <div v-else-if="orderBook">
            <div class="grid grid-cols-2 gap-2">
              <!-- Sellers -->
              <div>
                <div class="text-xs text-success font-semibold mb-1">{{ t('gameUiMarket.sells') }}</div>
                <div
                  v-for="so in (orderBook.sell_orders || []).slice(0, 8)"
                  :key="so.id"
                  class="flex items-center justify-between text-xs py-0.5 hover:bg-base-200 rounded cursor-pointer"
                  @click="openBuyModal(so)"
                >
                  <span class="text-success font-mono">{{ money(so.unit_price) }}</span>
                  <span class="text-base-content/60">×{{ so.remaining_amount }}</span>
                  <button class="btn btn-success btn-xs h-5 min-h-0 px-1.5">{{ t('gameUiMarket.buyBtn') }}</button>
                </div>
                <div v-if="!(orderBook.sell_orders || []).length" class="text-xs text-base-content/40">—</div>
              </div>
              <!-- Buyers -->
              <div>
                <div class="text-xs text-info font-semibold mb-1">{{ t('gameUiMarket.buys') }}</div>
                <div
                  v-for="bo in (orderBook.buy_orders || []).slice(0, 8)"
                  :key="bo.id"
                  class="flex items-center justify-between text-xs py-0.5"
                >
                  <span class="text-info font-mono">{{ money(bo.unit_price) }}</span>
                  <span class="text-base-content/60">×{{ bo.remaining_amount }}</span>
                </div>
                <div v-if="!(orderBook.buy_orders || []).length" class="text-xs text-base-content/40">—</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── My Orders tab ────────────────────────────────────────────────── -->
      <div v-else-if="tab === 'orders'" class="p-3">
        <div class="text-xs font-semibold text-success mb-2">{{ t('gameUiMarket.mySells') }}</div>
        <div v-if="!mySellOrders.length" class="text-xs text-base-content/40 mb-3">{{ t('gameUiMarket.noMyOrders') }}</div>
        <div v-else class="overflow-x-auto mb-4">
          <table class="table table-xs w-full">
            <thead><tr>
              <th>Предмет</th>
              <th class="text-right">{{ t('gameUiMarket.price') }}</th>
              <th class="text-right">Ост.</th>
              <th></th>
            </tr></thead>
            <tbody>
              <tr v-for="o in mySellOrders" :key="o.id">
                <td class="max-w-[100px] truncate">{{ itemLabel(o.item_key) || o.display_name || o.item_key }}</td>
                <td class="text-right font-mono text-success">{{ money(o.unit_price) }}</td>
                <td class="text-right">{{ o.remaining_amount }}/{{ o.total_amount }}</td>
                <td>
                  <button
                    class="btn btn-error btn-xs h-5 min-h-0"
                    :class="{ loading: cancellingId === o.id }"
                    :disabled="!!cancellingId"
                    @click="cancelSell(o.id)"
                  >{{ t('gameUiMarket.cancelOrder') }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-xs font-semibold text-info mb-2">{{ t('gameUiMarket.myBuys') }}</div>
        <div v-if="!myBuyOrders.length" class="text-xs text-base-content/40">{{ t('gameUiMarket.noMyOrders') }}</div>
        <div v-else class="overflow-x-auto">
          <table class="table table-xs w-full">
            <thead><tr>
              <th>Предмет</th>
              <th class="text-right">{{ t('gameUiMarket.price') }}</th>
              <th class="text-right">Ост.</th>
              <th></th>
            </tr></thead>
            <tbody>
              <tr v-for="o in myBuyOrders" :key="o.id">
                <td class="max-w-[100px] truncate">{{ itemLabel(o.item_key) || o.display_name || o.item_key }}</td>
                <td class="text-right font-mono text-info">{{ money(o.unit_price) }}</td>
                <td class="text-right">{{ o.remaining_amount }}/{{ o.total_amount }}</td>
                <td>
                  <button
                    class="btn btn-error btn-xs h-5 min-h-0"
                    :class="{ loading: cancellingId === o.id }"
                    :disabled="!!cancellingId"
                    @click="cancelBuy(o.id)"
                  >{{ t('gameUiMarket.cancelOrder') }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Trades tab ───────────────────────────────────────────────────── -->
      <div v-else-if="tab === 'trades'" class="p-3">
        <div v-if="!myTrades.length" class="text-center py-8 text-base-content/40 text-xs">
          {{ t('gameUiMarket.noTrades') }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table table-xs w-full">
            <thead><tr>
              <th>Предмет</th>
              <th class="text-right">Цена</th>
              <th class="text-right">Кол-во</th>
              <th class="text-right">Итог</th>
            </tr></thead>
            <tbody>
              <tr v-for="tr in myTrades" :key="tr.id">
                <td class="max-w-[100px] truncate">{{ itemLabel(tr.item_key) || tr.display_name || tr.item_key }}</td>
                <td class="text-right font-mono">{{ money(tr.unit_price) }}</td>
                <td class="text-right">{{ tr.amount }}</td>
                <td class="text-right font-mono">{{ money(tr.gross_total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Pickup tab ───────────────────────────────────────────────────── -->
      <div v-else-if="tab === 'pickup'" class="p-6 text-center">
        <div class="text-4xl mb-3">📦</div>
        <div class="text-base font-semibold mb-1">
          <template v-if="pickupCount > 0">
            {{ t('gameUiMarket.pickupReady', { n: pickupCount }) }}
          </template>
          <template v-else>{{ t('gameUiMarket.pickupNone') }}</template>
        </div>

        <div v-if="pickupResult" class="my-3 text-xs" :class="pickupResult.ok ? 'text-success' : 'text-error'">
          {{ pickupResult.ok ? t('gameUiMarket.pickupSuccess') : (pickupResult.msg || t('gameUiMarket.pickupFail')) }}
        </div>

        <button
          class="btn btn-primary mt-2"
          :class="{ loading: pickupSubmitting }"
          :disabled="pickupSubmitting || pickupCount === 0"
          @click="requestPickup"
        >
          {{ t('gameUiMarket.pickupBtn') }}
        </button>
      </div>
    </template>

    <!-- ── Buy modal ────────────────────────────────────────────────────────── -->
    <dialog :open="buyModal" class="modal modal-open" @click.self="buyModal = false">
      <div class="modal-box max-w-xs p-4" v-if="buyTarget">
        <h3 class="font-bold text-sm mb-3">{{ t('gameUiMarket.buyModal') }}</h3>
        <div class="text-xs text-base-content/70 mb-1">{{ buyTarget.display_name }}</div>
        <div class="text-xs mb-3">
          {{ t('gameUiMarket.price') }}: <span class="font-mono text-success">{{ money(buyTarget.unit_price) }}</span>
          · Макс: {{ buyTarget.max_amount }}
        </div>

        <div class="form-control mb-3">
          <label class="label py-0.5"><span class="label-text text-xs">{{ t('gameUiMarket.buyAmount') }}</span></label>
          <input
            v-model.number="buyAmount"
            type="number"
            :min="1"
            :max="buyTarget.max_amount"
            class="input input-bordered input-sm w-full"
          />
          <div class="text-xs text-base-content/50 mt-1">
            {{ t('gameUiMarket.total') }}: <span class="font-mono">{{ money(buyAmount * buyTarget.unit_price) }}</span>
          </div>
        </div>

        <div v-if="buyResult" class="mb-2 text-xs" :class="buyResult.ok ? 'text-success' : 'text-error'">
          {{ buyResult.ok ? t('gameUiMarket.buySuccess') : (buyResult.msg || t('gameUiMarket.buyFail')) }}
        </div>

        <div class="modal-action justify-between mt-2">
          <button class="btn btn-ghost btn-sm" @click="buyModal = false">{{ t('gameUiMarket.buyCancel') }}</button>
          <button
            class="btn btn-success btn-sm"
            :class="{ loading: buySubmitting }"
            :disabled="buySubmitting || buyAmount < 1 || buyAmount > buyTarget.max_amount"
            @click="submitBuy"
          >{{ t('gameUiMarket.buyConfirm') }}</button>
        </div>
      </div>
    </dialog>
  </div>
</template>
