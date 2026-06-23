<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  setWebguiToken, getItems, getOrderBook, getMySellOrders,
  getMyBuyOrders, getMyTrades, getPickupReady, createPendingAction,
} from '../services/gameUiMarketApi'
import { useItemNames } from '../composables/useItemNames'
import ItemIcon from '../components/ItemIcon.vue'
import { toastSuccess, toastError, toastInfo } from '../services/toast'

const route = useRoute()
const itemNames = useItemNames()
const tokenValid = ref(true)

function initToken() {
  const t = route.query.webgui_token || ''
  if (!t) { tokenValid.value = false; return }
  setWebguiToken(t)
}

// ── state ──────────────────────────────────────────────────────
const tab        = ref('market')     // market | orders | history | pickup
const items      = ref([])
const search     = ref('')
const selected   = ref(null)         // selected item
const orderBook  = ref(null)
const obLoading  = ref(false)

const mySell     = ref([])
const myBuy      = ref([])
const myTrades   = ref([])
const pickupCnt  = ref(0)

const globalErr  = ref(null)
const loading    = ref(false)
const cancelId   = ref(null)
const pickupBusy = ref(false)
const pickupRes  = ref(null)

// action panel inside order book
const buyForm    = ref({ show: false, price: '', amount: 1, busy: false, res: null })
const sellForm   = ref({ show: false, price: '', amount: 1, busy: false, res: null })
const handForm   = ref({ show: false, price: '', amount: 1, busy: false, res: null })

// ── computed ────────────────────────────────────────────────────
const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return items.value
  return items.value.filter(i =>
    i.item_key.toLowerCase().includes(q) ||
    (itemNames.value[i.item_key] || '').toLowerCase().includes(q)
  )
})

// ── helpers ─────────────────────────────────────────────────────
function label(key) {
  if (!key) return key
  if (itemNames.value[key]) return itemNames.value[key]
  return key.split(':').pop().replace(/_/g, ' ')
}

function money(n) {
  if (n == null) return '—'
  const v = parseFloat(n)
  return isNaN(v) ? '—' : v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

function parsePrice(s) {
  return parseFloat(String(s || '').replace(',', '.'))
}

// ── data loaders ────────────────────────────────────────────────
async function loadItems() {
  const r = await getItems()
  items.value = r?.items || []
}

async function loadMyOrders() {
  const [s, b] = await Promise.all([getMySellOrders(), getMyBuyOrders()])
  mySell.value = s?.items || []
  myBuy.value  = b?.items || []
}

async function loadMyTrades() {
  const r = await getMyTrades()
  myTrades.value = r?.items || []
}

async function loadPickup() {
  const r = await getPickupReady()
  pickupCnt.value = r?.count || 0
}

async function selectItem(item) {
  selected.value = item
  orderBook.value = null
  buyForm.value  = { show: false, price: '', amount: 1, busy: false, res: null }
  sellForm.value = { show: false, price: '', amount: 1, busy: false, res: null }
  obLoading.value = true
  try {
    orderBook.value = await getOrderBook(item.item_key)
  } catch (e) {
    orderBook.value = { error: e.message }
  } finally {
    obLoading.value = false
  }
}

async function switchTab(t) {
  tab.value = t
  selected.value = null
  globalErr.value = null
  loading.value = true
  try {
    if (t === 'market')  await loadItems()
    if (t === 'orders')  await loadMyOrders()
    if (t === 'history') await loadMyTrades()
    if (t === 'pickup')  await loadPickup()
  } catch (e) { globalErr.value = e.message }
  finally { loading.value = false }
}

// ── buy / sell actions ──────────────────────────────────────────
function openBuy(suggestedPrice, availQty) {
  const p = suggestedPrice ?? orderBook.value?.sell_side?.[0]?.unit_price ?? ''
  const q = availQty ?? orderBook.value?.sell_side?.[0]?.total_amount ?? 1
  // instant=true when price >= best ask (will fill immediately)
  const bestAsk = orderBook.value?.sell_side?.[0]?.unit_price
  const instant = bestAsk != null && parseFloat(p) >= bestAsk
  buyForm.value = { show: true, price: p ? String(p) : '', amount: q, avail: q, instant, busy: false, res: null }
  sellForm.value.show = false
}

function openSell(suggestedPrice, availQty) {
  const bestBuy  = orderBook.value?.buy_side?.[0]?.unit_price
  const bestSell = orderBook.value?.sell_side?.[0]?.unit_price
  const p = suggestedPrice ?? bestSell ?? (bestBuy ? Math.round(bestBuy * 1.05) : '')
  const q = availQty ?? orderBook.value?.buy_side?.[0]?.total_amount ?? 1
  const instant = bestBuy != null && parseFloat(p) <= bestBuy
  sellForm.value = { show: true, price: p ? String(p) : '', amount: q, avail: q, instant, busy: false, res: null }
  buyForm.value.show = false
}

function applyOptimisticBuy(amount) {
  if (!orderBook.value?.sell_side) return
  let remaining = amount
  const updated = []
  for (const row of orderBook.value.sell_side) {
    const take = Math.min(row.total_amount, remaining)
    remaining -= take
    if (row.total_amount - take > 0) updated.push({ ...row, total_amount: row.total_amount - take })
  }
  orderBook.value = { ...orderBook.value, sell_side: updated }
  // also update left panel best price
  const item = items.value.find(i => i.item_key === selected.value?.item_key)
  if (item && updated.length > 0) item.best_sell_price = updated[0].unit_price
  else if (item && updated.length === 0) item.best_sell_price = null
}

function applyOptimisticSell(amount) {
  if (!orderBook.value?.buy_side) return
  let remaining = amount
  const updated = []
  for (const row of orderBook.value.buy_side) {
    const take = Math.min(row.total_amount, remaining)
    remaining -= take
    if (row.total_amount - take > 0) updated.push({ ...row, total_amount: row.total_amount - take })
  }
  orderBook.value = { ...orderBook.value, buy_side: updated }
  const item = items.value.find(i => i.item_key === selected.value?.item_key)
  if (item && updated.length > 0) item.best_buy_price = updated[0].unit_price
  else if (item && updated.length === 0) item.best_buy_price = null
}

async function submitBuy() {
  const price = parsePrice(buyForm.value.price)
  if (!selected.value || buyForm.value.amount < 1 || isNaN(price) || price <= 0) return
  buyForm.value.busy = true
  buyForm.value.res  = null
  const amt = buyForm.value.amount
  const itemKey = selected.value.item_key
  try {
    // optimistic preflight
    if (buyForm.value.instant) applyOptimisticBuy(amt)
    await createPendingAction('buy', {
      item_key:     itemKey,
      amount:       amt,
      unit_price:   price,
      display_name: label(itemKey),
    })
    buyForm.value.res = { ok: true, msg: buyForm.value.instant ? '⏳ Обрабатывается — смотри инвентарь' : 'Заявка размещена — ждём продавца' }
    toastInfo(
      buyForm.value.instant
        ? `Покупка ${label(itemKey)} ×${amt} — выдача через секунду`
        : `Заявка на покупку: ${label(itemKey)} ×${amt} по ${money(price)} ₽`,
      'Рынок',
    )
    setTimeout(() => { buyForm.value.show = false; buyForm.value.res = null }, 2500)
  } catch (e) {
    if (buyForm.value.instant) refreshAfterAction()
    buyForm.value.res = { ok: false, msg: e.message }
    toastError(e.message, 'Ошибка покупки')
  } finally {
    buyForm.value.busy = false
    refreshAfterAction()
  }
}

async function submitSell() {
  const price = parsePrice(sellForm.value.price)
  if (!selected.value || sellForm.value.amount < 1 || isNaN(price) || price <= 0) return
  sellForm.value.busy = true
  sellForm.value.res  = null
  const amt = sellForm.value.amount
  const itemKey = selected.value.item_key
  try {
    if (sellForm.value.instant) applyOptimisticSell(amt)
    await createPendingAction('sell', {
      item_key:   itemKey,
      amount:     amt,
      unit_price: price,
    })
    sellForm.value.res = { ok: true, msg: sellForm.value.instant ? '✓ Деньги зачислены' : 'Ордер размещён — ждём покупателя' }
    toastSuccess(
      sellForm.value.instant
        ? `Продано сразу: ${label(itemKey)} ×${amt} — деньги придут через сек.`
        : `Ордер на продажу: ${label(itemKey)} ×${amt} по ${money(price)} ₽`,
      'Рынок',
    )
    setTimeout(() => { sellForm.value.show = false; sellForm.value.res = null }, 3500)
  } catch (e) {
    if (sellForm.value.instant) refreshAfterAction()
    sellForm.value.res = { ok: false, msg: e.message }
    toastError(e.message, 'Ошибка продажи')
  } finally {
    sellForm.value.busy = false
    refreshAfterAction()
  }
}

async function submitHandSell() {
  const price = parsePrice(handForm.value.price)
  if (handForm.value.amount < 1 || isNaN(price) || price <= 0) return
  handForm.value.busy = true
  handForm.value.res  = null
  try {
    await createPendingAction('sell', {
      item_key:   '__hand__',
      amount:     handForm.value.amount,
      unit_price: price,
    })
    handForm.value.res = { ok: true, msg: 'Запрос принят — берётся предмет из вашей руки' }
    toastSuccess(`Ордер на продажу из руки ×${handForm.value.amount} по ${money(price)} ₽`, 'Рынок')
    setTimeout(() => { handForm.value.show = false; handForm.value.res = null }, 3500)
  } catch (e) {
    handForm.value.res = { ok: false, msg: e.message }
    toastError(e.message, 'Ошибка продажи')
  } finally {
    handForm.value.busy = false
  }
}

async function cancelOrder(type, id) {
  if (cancelId.value) return
  cancelId.value = id
  try {
    await createPendingAction(type === 'sell' ? 'cancel_sell' : 'cancel_buy', { order_id: id })
    if (type === 'sell') mySell.value = mySell.value.filter(o => o.id !== id)
    else                 myBuy.value  = myBuy.value.filter(o => o.id !== id)
    toastInfo('Ордер отменён, предметы/средства будут возвращены', 'Рынок')
  } catch (e) {
    globalErr.value = e.message
    toastError(e.message, 'Ошибка отмены')
  } finally {
    cancelId.value = null
  }
}

async function requestPickup() {
  pickupBusy.value = true
  pickupRes.value  = null
  try {
    await createPendingAction('pickup', {})
    pickupRes.value = { ok: true }
    toastSuccess('Предметы и деньги будут выданы в течение секунды', 'Рынок — Выдача')
    pickupCnt.value = 0
  } catch (e) {
    pickupRes.value = { ok: false, msg: e.message }
    toastError(e.message, 'Ошибка выдачи')
  } finally {
    pickupBusy.value = false
  }
}

// ── pickup watcher — notify when something arrives ───────────────
watch(pickupCnt, (newVal, oldVal) => {
  if (newVal > oldVal && oldVal !== null) {
    toastInfo(
      `У вас ${newVal} позиций для получения — зайдите во вкладку «Забрать»`,
      '🛒 Рынок — новая выдача',
    )
  }
})

// ── polling ─────────────────────────────────────────────────────
let poll = null
async function silentPoll() {
  try {
    if (tab.value === 'market') await loadItems()
    const r = await getPickupReady()
    pickupCnt.value = r?.count || 0
    if (selected.value) {
      orderBook.value = await getOrderBook(selected.value.item_key)
    }
  } catch (_) {}
}

function checkInstantBuy() {
  const bestAsk = orderBook.value?.sell_side?.[0]?.unit_price
  buyForm.value.instant = bestAsk != null && parseFloat(buyForm.value.price) >= bestAsk
}

function checkInstantSell() {
  const bestBid = orderBook.value?.buy_side?.[0]?.unit_price
  sellForm.value.instant = bestBid != null && parseFloat(sellForm.value.price) <= bestBid
}

async function refreshAfterAction() {
  await new Promise(r => setTimeout(r, 1800))
  try {
    if (selected.value) {
      orderBook.value = await getOrderBook(selected.value.item_key)
    }
    await loadItems()
  } catch (_) {}
}

function obBarWidth(row, orders, _side) {
  if (!orders || orders.length === 0) return 0
  const max = Math.max(...orders.map(o => o.total_amount))
  return max ? Math.round((row.total_amount / max) * 100) : 0
}

onMounted(() => {
  initToken()
  if (tokenValid.value) {
    switchTab('market')
    poll = setInterval(silentPoll, 6000)
  }
})
onUnmounted(() => { if (poll) clearInterval(poll) })
</script>

<template>
<div class="vm-root">

  <!-- ambient background glows -->
  <div class="vm-bg" aria-hidden="true">
    <span class="vm-glow vm-glow-a"></span>
    <span class="vm-glow vm-glow-b"></span>
    <span class="vm-grid"></span>
  </div>

  <!-- Token error -->
  <div v-if="!tokenValid" class="vm-fatal">
    <div class="vm-fatal-icon">⚠</div>
    <div class="vm-fatal-title">Сессия истекла</div>
    <div class="vm-fatal-sub">Закройте меню и откройте снова через <code>/shop</code></div>
  </div>

  <template v-else>

  <!-- ═══════════════════ HEADER ═════════════════════════════════ -->
  <header class="vm-header">
    <div class="vm-brand">
      <span class="vm-brand-mark">
        <span class="vm-brand-dot"></span>
      </span>
      <span class="vm-brand-text">
        <span class="vm-brand-name">VOID<span class="vm-brand-accent">RP</span></span>
        <span class="vm-brand-sub">Биржа игроков</span>
      </span>
    </div>

    <nav class="vm-nav">
      <button class="vm-nav-btn" :class="{ active: tab === 'market' }" @click="switchTab('market')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 11l3.5-4 3 2.5L13 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 4h3v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Рынок</span>
      </button>
      <button class="vm-nav-btn" :class="{ active: tab === 'orders' }" @click="switchTab('orders')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 6.5h5M5.5 9.5h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        <span>Мои ордера</span>
      </button>
      <button class="vm-nav-btn" :class="{ active: tab === 'history' }" @click="switchTab('history')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3l2 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>История</span>
      </button>
      <button class="vm-nav-btn" :class="{ active: tab === 'pickup' }" @click="switchTab('pickup')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 4h10l-1 8.5a1 1 0 0 1-1 .9H5a1 1 0 0 1-1-.9L3 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 4V3a2 2 0 0 1 4 0v1" stroke="currentColor" stroke-width="1.4"/></svg>
        <span>Забрать</span>
        <span v-if="pickupCnt > 0" class="vm-nav-badge">{{ pickupCnt }}</span>
      </button>
    </nav>

    <div class="vm-header-actions">
      <button class="vm-hand-btn" @click="handForm = { show: true, price: '', amount: 1, busy: false, res: null }">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M6 3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h1V3z" stroke="currentColor" stroke-width="1.3"/></svg>
        <span>Продать из руки</span>
      </button>
      <button class="vm-icon-btn" :class="{ spin: loading }" @click="switchTab(tab)" title="Обновить">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13.5 2.5V5.5H10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </header>

  <!-- global error -->
  <transition name="vm-fade">
    <div v-if="globalErr" class="vm-global-err">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M7 4v3.5M7 9.5v.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      {{ globalErr }}
    </div>
  </transition>

  <!-- top loading bar -->
  <div v-if="loading" class="vm-loadbar"><span></span></div>

  <!-- ═══════════════════ MARKET TAB ════════════════════════════ -->
  <div v-if="tab === 'market'" class="vm-market">

    <!-- ── LEFT: item list ────────────────────────────────────── -->
    <aside class="vm-list-panel">
      <div class="vm-search-wrap">
        <svg class="vm-search-ico" width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.4"/><path d="M10 10l2.5 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        <input v-model="search" class="vm-search" placeholder="Поиск предметов…" />
        <span v-if="search" class="vm-search-clear" @click="search = ''">✕</span>
      </div>

      <div class="vm-list-head">
        <span>Предмет</span>
        <span class="ar">Продажа</span>
        <span class="ar">Покупка</span>
      </div>

      <div class="vm-list-scroll">
        <div v-if="!filtered.length" class="vm-list-empty">
          <span class="vm-list-empty-ico">🔍</span>
          Ничего не найдено
        </div>
        <button
          v-for="item in filtered"
          :key="item.item_key"
          class="vm-list-row"
          :class="{ active: selected?.item_key === item.item_key }"
          @click="selectItem(item)"
        >
          <span class="vm-list-item">
            <span class="vm-list-ico"><ItemIcon :item-key="item.item_key" :size="24" /></span>
            <span class="vm-list-name">{{ label(item.item_key) }}</span>
          </span>
          <span class="vm-list-price sell">{{ item.best_sell_price != null ? money(item.best_sell_price) : '—' }}</span>
          <span class="vm-list-price buy">{{ item.best_buy_price != null ? money(item.best_buy_price) : '—' }}</span>
        </button>
      </div>
    </aside>

    <!-- ── RIGHT: detail / order book ────────────────────────── -->
    <section class="vm-detail">

      <!-- placeholder -->
      <div v-if="!selected" class="vm-placeholder">
        <div class="vm-ph-orb">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M3 17l5-6 4 3 6-8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6h4v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="vm-ph-title">Выберите предмет</div>
        <div class="vm-ph-sub">Нажмите на любой предмет в списке слева, чтобы увидеть книгу ордеров и начать торговать.</div>
      </div>

      <template v-else>
        <!-- item header -->
        <div class="vm-item-head">
          <div class="vm-item-id">
            <span class="vm-item-ico"><ItemIcon :item-key="selected.item_key" :size="40" /></span>
            <div class="vm-item-titles">
              <div class="vm-item-name">{{ label(selected.item_key) }}</div>
              <div class="vm-item-key">{{ selected.item_key }}</div>
            </div>
          </div>
          <div class="vm-item-quotes">
            <div class="vm-quote sell">
              <span class="vm-quote-label">Мин. продажа</span>
              <span class="vm-quote-val">{{ selected.best_sell_price != null ? money(selected.best_sell_price) + ' ₽' : '—' }}</span>
            </div>
            <div class="vm-quote buy">
              <span class="vm-quote-label">Макс. покупка</span>
              <span class="vm-quote-val">{{ selected.best_buy_price != null ? money(selected.best_buy_price) + ' ₽' : '—' }}</span>
            </div>
            <div v-if="selected.volume_24h" class="vm-quote vol">
              <span class="vm-quote-label">Объём 24ч</span>
              <span class="vm-quote-val">{{ money(selected.volume_24h) }}</span>
            </div>
          </div>
        </div>

        <!-- loading -->
        <div v-if="obLoading" class="vm-ob-loading">
          <span class="vm-spinner"></span>
        </div>

        <template v-else-if="orderBook && !orderBook.error">

          <!-- trade panel -->
          <div class="vm-trade">
            <div class="vm-trade-tabs">
              <button class="vm-trade-tab buy" :class="{ active: buyForm.show }" @click="buyForm.show ? (buyForm.show=false) : openBuy()">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v10M2 7.5l4.5 4 4.5-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Купить
              </button>
              <button class="vm-trade-tab sell" :class="{ active: sellForm.show }" @click="sellForm.show ? (sellForm.show=false) : openSell()">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 11V1M2 4.5L6.5 1 11 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Продать
              </button>
            </div>

            <!-- buy form -->
            <transition name="vm-slide">
              <div v-if="buyForm.show" class="vm-form buy">
                <div class="vm-form-mode">
                  <span v-if="buyForm.instant" class="vm-chip instant-buy">⚡ Исполнится сразу</span>
                  <span v-else class="vm-chip wait">⏳ Ордер в очереди</span>
                </div>
                <div class="vm-form-grid">
                  <label class="vm-field">
                    <span class="vm-field-label">Цена за шт. <i>₽</i></span>
                    <input v-model="buyForm.price" type="number" min="1" class="vm-input" placeholder="0" @input="checkInstantBuy" />
                  </label>
                  <label class="vm-field">
                    <span class="vm-field-label">Количество <em v-if="buyForm.avail">доступно {{ buyForm.avail }}</em></span>
                    <input v-model.number="buyForm.amount" type="number" min="1" class="vm-input" />
                  </label>
                </div>
                <div v-if="buyForm.price && buyForm.amount" class="vm-form-total">
                  <span>Спишется</span>
                  <strong>{{ money(parsePrice(buyForm.price) * buyForm.amount) }} ₽</strong>
                </div>
                <transition name="vm-fade">
                  <div v-if="buyForm.res" class="vm-form-res" :class="buyForm.res.ok ? 'ok' : 'err'">{{ buyForm.res.msg }}</div>
                </transition>
                <button class="vm-submit buy" :disabled="buyForm.busy || !buyForm.price || buyForm.amount < 1" @click="submitBuy">
                  {{ buyForm.busy ? 'Отправка…' : buyForm.instant ? '⚡ Купить сразу' : 'Создать заявку на покупку' }}
                </button>
                <p class="vm-form-note">
                  {{ buyForm.instant
                      ? 'Деньги списываются сразу, предмет выдаётся немедленно.'
                      : 'Деньги резервируются. Предмет придёт, когда кто-то продаст по вашей цене.' }}
                </p>
              </div>
            </transition>

            <!-- sell form -->
            <transition name="vm-slide">
              <div v-if="sellForm.show" class="vm-form sell">
                <div class="vm-form-mode">
                  <span v-if="sellForm.instant" class="vm-chip instant-sell">⚡ Продастся сразу</span>
                  <span v-else class="vm-chip wait">⏳ Ордер в очереди</span>
                </div>
                <div class="vm-form-grid">
                  <label class="vm-field">
                    <span class="vm-field-label">Цена за шт. <i>₽</i></span>
                    <input v-model="sellForm.price" type="number" min="1" class="vm-input" placeholder="0" @input="checkInstantSell" />
                  </label>
                  <label class="vm-field">
                    <span class="vm-field-label">Количество <em v-if="sellForm.avail">покупают {{ sellForm.avail }}</em></span>
                    <input v-model.number="sellForm.amount" type="number" min="1" class="vm-input" />
                  </label>
                </div>
                <div v-if="sellForm.price && sellForm.amount" class="vm-form-total">
                  <span>Выручка <i>−2%</i></span>
                  <strong>{{ money(parsePrice(sellForm.price) * sellForm.amount * 0.98) }} ₽</strong>
                </div>
                <transition name="vm-fade">
                  <div v-if="sellForm.res" class="vm-form-res" :class="sellForm.res.ok ? 'ok' : 'err'">{{ sellForm.res.msg }}</div>
                </transition>
                <button class="vm-submit sell" :disabled="sellForm.busy || !sellForm.price || sellForm.amount < 1" @click="submitSell">
                  {{ sellForm.busy ? 'Отправка…' : sellForm.instant ? '⚡ Продать сразу' : 'Выставить ордер' }}
                </button>
                <p class="vm-form-note">
                  {{ sellForm.instant
                      ? 'Предмет изымается из инвентаря, деньги зачисляются немедленно.'
                      : 'Предмет изымается из инвентаря и ждёт покупателя.' }}
                </p>
              </div>
            </transition>
          </div>

          <!-- order book -->
          <div class="vm-book">
            <!-- asks (sell) -->
            <div class="vm-book-col asks">
              <div class="vm-book-head sell">
                <span class="vm-book-title"><span class="vm-dot sell"></span> Продают</span>
                <span class="vm-book-cols"><span>Цена</span><span>Кол-во</span></span>
              </div>
              <div class="vm-book-rows">
                <div v-if="!(orderBook.sell_side||[]).length" class="vm-book-empty">Нет ордеров</div>
                <button
                  v-for="(so, i) in (orderBook.sell_side||[]).slice(0,12)"
                  :key="so.unit_price"
                  class="vm-book-row sell"
                  :class="{ best: i === 0 }"
                  @click="openBuy(so.unit_price, so.total_amount)"
                  title="Купить по этой цене"
                >
                  <span class="vm-depth sell" :style="{ width: obBarWidth(so, orderBook.sell_side, 'sell') + '%' }"></span>
                  <span class="vm-book-price sell">{{ money(so.unit_price) }}</span>
                  <span class="vm-book-qty">{{ so.total_amount.toLocaleString('ru-RU') }}</span>
                  <span class="vm-book-cta sell">Купить →</span>
                </button>
              </div>
            </div>

            <!-- spread / center -->
            <div class="vm-book-mid">
              <div class="vm-spread">
                <span class="vm-spread-label">Спред</span>
                <span class="vm-spread-val">{{ orderBook.spread != null ? money(orderBook.spread) + ' ₽' : '—' }}</span>
                <span v-if="orderBook.last_trade_price != null" class="vm-spread-last">
                  посл. {{ money(orderBook.last_trade_price) }} ₽
                </span>
              </div>
            </div>

            <!-- bids (buy) -->
            <div class="vm-book-col bids">
              <div class="vm-book-head buy">
                <span class="vm-book-title"><span class="vm-dot buy"></span> Покупают</span>
                <span class="vm-book-cols"><span>Цена</span><span>Кол-во</span></span>
              </div>
              <div class="vm-book-rows">
                <div v-if="!(orderBook.buy_side||[]).length" class="vm-book-empty">Нет ордеров</div>
                <button
                  v-for="(bo, i) in (orderBook.buy_side||[]).slice(0,12)"
                  :key="bo.unit_price"
                  class="vm-book-row buy"
                  :class="{ best: i === 0 }"
                  @click="openSell(bo.unit_price, bo.total_amount)"
                  title="Продать по этой цене"
                >
                  <span class="vm-depth buy" :style="{ width: obBarWidth(bo, orderBook.buy_side, 'buy') + '%' }"></span>
                  <span class="vm-book-price buy">{{ money(bo.unit_price) }}</span>
                  <span class="vm-book-qty">{{ bo.total_amount.toLocaleString('ru-RU') }}</span>
                  <span class="vm-book-cta buy">Продать →</span>
                </button>
              </div>
            </div>
          </div>

          <div class="vm-book-hint">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M7 6.2v3.3M7 4.5v.01" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            Нажмите на строку — цена и количество подставятся в форму автоматически
          </div>

        </template>

        <div v-else-if="orderBook?.error" class="vm-ob-error">{{ orderBook.error }}</div>
      </template>
    </section>
  </div>

  <!-- ═══════════════════ MY ORDERS TAB ═════════════════════════ -->
  <div v-else-if="tab === 'orders'" class="vm-page">
    <div class="vm-orders-grid">

      <div class="vm-orders-col">
        <div class="vm-orders-title sell">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v10M2 5.5L6.5 1 11 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Мои продажи <span class="vm-orders-count">{{ mySell.length }}</span>
        </div>
        <div v-if="!mySell.length" class="vm-orders-empty">Нет активных ордеров на продажу</div>
        <div v-for="o in mySell" :key="o.id" class="vm-order">
          <span class="vm-order-ico"><ItemIcon :item-key="o.item_key" :size="26" /></span>
          <div class="vm-order-info">
            <span class="vm-order-name">{{ label(o.item_key) }}</span>
            <span class="vm-order-key">{{ o.item_key }}</span>
          </div>
          <div class="vm-order-meta">
            <span class="vm-order-price sell">{{ money(o.unit_price) }} ₽/шт.</span>
            <span class="vm-order-qty">
              {{ o.remaining_amount }}/{{ o.total_amount }} шт.
              <span class="vm-order-status" :class="o.status === 'partially_filled' ? 'partial' : 'waiting'">
                {{ o.status === 'partially_filled' ? 'частично' : 'ожидает' }}
              </span>
            </span>
          </div>
          <button class="vm-order-cancel" :disabled="!!cancelId" @click="cancelOrder('sell', o.id)">
            {{ cancelId === o.id ? '…' : 'Отменить' }}
          </button>
        </div>
      </div>

      <div class="vm-orders-col">
        <div class="vm-orders-title buy">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 12V2M2 7.5L6.5 12 11 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Мои покупки <span class="vm-orders-count">{{ myBuy.length }}</span>
        </div>
        <div v-if="!myBuy.length" class="vm-orders-empty">Нет активных ордеров на покупку</div>
        <div v-for="o in myBuy" :key="o.id" class="vm-order">
          <span class="vm-order-ico"><ItemIcon :item-key="o.item_key" :size="26" /></span>
          <div class="vm-order-info">
            <span class="vm-order-name">{{ label(o.item_key) }}</span>
            <span class="vm-order-key">{{ o.item_key }}</span>
          </div>
          <div class="vm-order-meta">
            <span class="vm-order-price buy">{{ money(o.unit_price) }} ₽/шт.</span>
            <span class="vm-order-qty">
              {{ o.remaining_amount }}/{{ o.total_amount }} шт.
              <span class="vm-order-status" :class="o.status === 'partially_filled' ? 'partial' : 'waiting'">
                {{ o.status === 'partially_filled' ? 'частично' : 'ожидает' }}
              </span>
            </span>
          </div>
          <button class="vm-order-cancel" :disabled="!!cancelId" @click="cancelOrder('buy', o.id)">
            {{ cancelId === o.id ? '…' : 'Отменить' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════ HISTORY TAB ═══════════════════════════ -->
  <div v-else-if="tab === 'history'" class="vm-page">
    <div v-if="!myTrades.length" class="vm-empty-state">
      <div class="vm-empty-ico">📊</div>
      <div class="vm-empty-title">Сделок пока нет</div>
      <div class="vm-empty-sub">Здесь появится история ваших покупок и продаж</div>
    </div>
    <div v-else class="vm-table-card">
      <table class="vm-table">
        <thead><tr>
          <th>Предмет</th>
          <th class="ar">Цена/шт.</th>
          <th class="ar">Кол-во</th>
          <th class="ar">Итого</th>
        </tr></thead>
        <tbody>
          <tr v-for="tr in myTrades" :key="tr.id">
            <td>
              <div class="vm-td-item">
                <span class="vm-td-ico"><ItemIcon :item-key="tr.item_key" :size="20" /></span>
                <span>{{ label(tr.item_key) }}</span>
              </div>
            </td>
            <td class="ar mono">{{ money(tr.unit_price) }} ₽</td>
            <td class="ar muted">{{ tr.amount }}</td>
            <td class="ar mono accent">{{ money(tr.gross_total) }} ₽</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ═══════════════════ PICKUP TAB ════════════════════════════ -->
  <div v-else-if="tab === 'pickup'" class="vm-page vm-pickup-wrap">
    <div class="vm-pickup-card">
      <div class="vm-pickup-ring" :class="{ active: pickupCnt > 0 }">
        <span class="vm-pickup-num" :class="{ zero: pickupCnt === 0 }">{{ pickupCnt }}</span>
      </div>
      <div class="vm-pickup-label">{{ pickupCnt > 0 ? 'позиций ждут выдачи' : 'Нечего забирать' }}</div>
      <transition name="vm-fade">
        <div v-if="pickupRes" class="vm-pickup-res" :class="pickupRes.ok ? 'ok' : 'err'">
          {{ pickupRes.ok ? '✓ Запрос отправлен — предметы появятся в инвентаре' : (pickupRes.msg || 'Ошибка') }}
        </div>
      </transition>
      <button class="vm-pickup-btn" :disabled="pickupBusy || pickupCnt === 0" @click="requestPickup">
        {{ pickupBusy ? 'Отправка…' : 'Получить всё' }}
      </button>
      <div class="vm-pickup-hint">Предметы и деньги появятся в инвентаре в течение 1–2 секунд</div>
    </div>
  </div>

  </template>

  <!-- ═══════════════════ HAND SELL MODAL ═══════════════════════ -->
  <transition name="vm-modal">
    <div v-if="handForm.show" class="vm-modal-backdrop" @click.self="handForm.show = false">
      <div class="vm-modal">
        <div class="vm-modal-head">
          <div class="vm-modal-title">
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M6 3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h1V3z" stroke="currentColor" stroke-width="1.3"/></svg>
            Продать предмет из руки
          </div>
          <button class="vm-modal-close" @click="handForm.show = false">✕</button>
        </div>
        <div class="vm-modal-info">
          Будет продан предмет в вашей <strong>основной руке</strong>. Убедитесь, что держите нужный предмет перед подтверждением.
        </div>
        <div class="vm-form-grid">
          <label class="vm-field">
            <span class="vm-field-label">Цена за шт. <i>₽</i></span>
            <input v-model="handForm.price" type="number" min="1" class="vm-input" placeholder="0" autofocus />
          </label>
          <label class="vm-field">
            <span class="vm-field-label">Количество</span>
            <input v-model.number="handForm.amount" type="number" min="1" class="vm-input" />
          </label>
        </div>
        <div v-if="handForm.price && handForm.amount" class="vm-form-total">
          <span>Выручка <i>−2%</i></span>
          <strong>{{ money(parsePrice(handForm.price) * handForm.amount * 0.98) }} ₽</strong>
        </div>
        <transition name="vm-fade">
          <div v-if="handForm.res" class="vm-form-res" :class="handForm.res.ok ? 'ok' : 'err'">{{ handForm.res.msg }}</div>
        </transition>
        <div class="vm-modal-actions">
          <button class="vm-modal-cancel" @click="handForm.show = false">Отмена</button>
          <button class="vm-submit sell" :disabled="handForm.busy || !handForm.price || handForm.amount < 1" @click="submitHandSell">
            {{ handForm.busy ? 'Отправка…' : 'Продать из руки' }}
          </button>
        </div>
      </div>
    </div>
  </transition>

</div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   VOIDRP MARKET — professional in-game trading terminal
   ═══════════════════════════════════════════════════════════════ */
.vm-root {
  --bg-0:    #05060f;
  --bg-1:    #080a18;
  --panel:   rgba(13, 17, 34, 0.72);
  --panel-2: rgba(18, 23, 44, 0.6);
  --card:    rgba(20, 26, 48, 0.55);
  --card-h:  rgba(28, 36, 64, 0.7);
  --line:    rgba(150, 170, 255, 0.08);
  --line-2:  rgba(150, 170, 255, 0.14);
  --text:    #e6edff;
  --muted:   #8493b8;
  --dim:     #4a5878;
  --sell:    #fb6f84;
  --sell-2:  #ff8a9b;
  --buy:     #2fd9a0;
  --buy-2:   #4fe8b6;
  --accent:  #a78bfa;
  --accent-2:#c4b1ff;
  --gold:    #fbbf24;

  position: relative;
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  font-size: 13px;
  color: var(--text);
  background: var(--bg-0);
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  -webkit-font-smoothing: antialiased;
}
.vm-root * { box-sizing: border-box; }

/* ── ambient background ─────────────────────────────────────── */
.vm-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.vm-glow { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.5; }
.vm-glow-a { width: 480px; height: 480px; top: -160px; left: -120px;
  background: radial-gradient(circle, rgba(124,92,255,0.45), transparent 70%); animation: vm-float-a 18s ease-in-out infinite; }
.vm-glow-b { width: 420px; height: 420px; bottom: -160px; right: -100px;
  background: radial-gradient(circle, rgba(47,217,160,0.28), transparent 70%); animation: vm-float-b 22s ease-in-out infinite; }
.vm-grid { position: absolute; inset: 0;
  background-image: linear-gradient(rgba(150,170,255,0.025) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(150,170,255,0.025) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 40%, transparent 100%); }
@keyframes vm-float-a { 0%,100% { transform: translate(0,0); } 50% { transform: translate(40px, 30px); } }
@keyframes vm-float-b { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-30px, -40px); } }

.vm-root > *:not(.vm-bg) { position: relative; z-index: 1; }

/* ═══ HEADER ═════════════════════════════════════════════════ */
.vm-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 58px;
  padding: 0 18px;
  background: linear-gradient(180deg, rgba(13,17,34,0.92), rgba(10,13,28,0.78));
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--line-2);
  flex-shrink: 0;
}
.vm-brand { display: flex; align-items: center; gap: 11px; }
.vm-brand-mark {
  width: 34px; height: 34px; border-radius: 10px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, rgba(167,139,250,0.25), rgba(124,92,255,0.1));
  border: 1px solid rgba(167,139,250,0.35);
  box-shadow: 0 0 20px rgba(124,92,255,0.25), inset 0 0 12px rgba(167,139,250,0.15);
}
.vm-brand-dot {
  width: 11px; height: 11px; border-radius: 50%;
  background: var(--accent-2);
  box-shadow: 0 0 14px var(--accent), 0 0 4px #fff;
  animation: vm-pulse 2.6s ease-in-out infinite;
}
@keyframes vm-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.82); } }
.vm-brand-text { display: flex; flex-direction: column; line-height: 1.15; }
.vm-brand-name { font-weight: 900; font-size: 15px; letter-spacing: 0.06em; color: #fff; }
.vm-brand-accent { color: var(--accent-2); }
.vm-brand-sub { font-size: 10.5px; color: var(--muted); letter-spacing: 0.04em; }

/* nav */
.vm-nav {
  display: flex; gap: 3px;
  padding: 4px;
  background: rgba(8, 11, 24, 0.6);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.vm-nav-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 16px; border: none; border-radius: 9px;
  background: transparent; color: var(--muted);
  font-size: 12.5px; font-weight: 600; font-family: inherit;
  cursor: pointer; position: relative;
  transition: color 0.2s, background 0.2s;
}
.vm-nav-btn svg { opacity: 0.7; transition: opacity 0.2s; }
.vm-nav-btn:hover { color: var(--text); background: rgba(150,170,255,0.06); }
.vm-nav-btn:hover svg { opacity: 1; }
.vm-nav-btn.active {
  color: #fff;
  background: linear-gradient(135deg, rgba(167,139,250,0.28), rgba(124,92,255,0.16));
  box-shadow: 0 2px 12px rgba(124,92,255,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
}
.vm-nav-btn.active svg { opacity: 1; color: var(--accent-2); }
.vm-nav-badge {
  display: inline-grid; place-items: center;
  min-width: 17px; height: 17px; padding: 0 5px;
  border-radius: 9px; background: var(--gold); color: #1a1200;
  font-size: 10px; font-weight: 800;
  box-shadow: 0 0 10px rgba(251,191,36,0.5);
}

.vm-header-actions { display: flex; align-items: center; gap: 9px; justify-self: end; }
.vm-hand-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 15px; border-radius: 10px;
  background: linear-gradient(135deg, rgba(251,111,132,0.16), rgba(251,111,132,0.06));
  border: 1px solid rgba(251,111,132,0.28);
  color: var(--sell-2); font-size: 12px; font-weight: 600;
  cursor: pointer; font-family: inherit;
  transition: all 0.18s;
}
.vm-hand-btn:hover { background: rgba(251,111,132,0.24); border-color: rgba(251,111,132,0.5); box-shadow: 0 0 18px rgba(251,111,132,0.2); }
.vm-icon-btn {
  display: grid; place-items: center;
  width: 36px; height: 36px; border-radius: 10px;
  background: rgba(150,170,255,0.06); border: 1px solid var(--line-2);
  color: var(--muted); cursor: pointer;
  transition: all 0.18s;
}
.vm-icon-btn:hover { color: var(--text); background: rgba(150,170,255,0.12); border-color: var(--accent); }
.vm-icon-btn.spin svg { animation: vm-spin 0.8s linear infinite; }
@keyframes vm-spin { to { transform: rotate(360deg); } }

/* ═══ ERROR + LOADING ════════════════════════════════════════ */
.vm-global-err {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  background: rgba(251,111,132,0.12);
  border-bottom: 1px solid rgba(251,111,132,0.25);
  color: var(--sell-2); font-size: 12.5px; font-weight: 500;
}
.vm-loadbar { height: 2px; background: rgba(167,139,250,0.1); overflow: hidden; flex-shrink: 0; }
.vm-loadbar span {
  display: block; height: 100%; width: 40%;
  background: linear-gradient(90deg, transparent, var(--accent), var(--buy), transparent);
  animation: vm-load 1.1s ease-in-out infinite;
}
@keyframes vm-load { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }

/* ═══ MARKET LAYOUT ══════════════════════════════════════════ */
.vm-market { flex: 1; display: grid; grid-template-columns: 312px 1fr; overflow: hidden; min-height: 0; }

/* ── left list panel ───────────────────────────────────────── */
.vm-list-panel {
  display: flex; flex-direction: column;
  background: var(--panel); backdrop-filter: blur(14px);
  border-right: 1px solid var(--line-2);
  overflow: hidden;
}
.vm-search-wrap { position: relative; padding: 14px 14px 10px; flex-shrink: 0; }
.vm-search-ico { position: absolute; left: 26px; top: 50%; transform: translateY(-30%); color: var(--dim); pointer-events: none; }
.vm-search {
  width: 100%; padding: 10px 32px 10px 36px;
  background: rgba(8,11,24,0.7); border: 1px solid var(--line-2);
  border-radius: 11px; color: var(--text); font-size: 13px; font-family: inherit;
  outline: none; transition: border-color 0.2s, box-shadow 0.2s;
}
.vm-search::placeholder { color: var(--dim); }
.vm-search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(167,139,250,0.12); }
.vm-search-clear {
  position: absolute; right: 26px; top: 50%; transform: translateY(-30%);
  color: var(--dim); cursor: pointer; font-size: 12px; padding: 2px;
}
.vm-search-clear:hover { color: var(--text); }

.vm-list-head {
  display: grid; grid-template-columns: 1fr 70px 70px;
  padding: 8px 16px; flex-shrink: 0;
  font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--dim); border-bottom: 1px solid var(--line);
}
.vm-list-head .ar { text-align: right; }

.vm-list-scroll { flex: 1; overflow-y: auto; padding: 6px 8px; }
.vm-list-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 50px 16px; color: var(--dim); font-size: 12.5px; text-align: center;
}
.vm-list-empty-ico { font-size: 26px; opacity: 0.5; }

.vm-list-row {
  display: grid; grid-template-columns: 1fr 70px 70px; align-items: center;
  width: 100%; padding: 9px 8px; border: 1px solid transparent; border-radius: 10px;
  background: transparent; cursor: pointer; font-family: inherit; text-align: left;
  transition: background 0.14s, border-color 0.14s;
}
.vm-list-row:hover { background: rgba(150,170,255,0.05); }
.vm-list-row.active {
  background: linear-gradient(135deg, rgba(167,139,250,0.16), rgba(124,92,255,0.06));
  border-color: rgba(167,139,250,0.3);
}
.vm-list-item { display: flex; align-items: center; gap: 9px; min-width: 0; }
.vm-list-ico {
  width: 32px; height: 32px; flex-shrink: 0; display: grid; place-items: center;
  background: rgba(8,11,24,0.5); border: 1px solid var(--line); border-radius: 8px;
}
.vm-list-name { font-size: 12.5px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vm-list-price { text-align: right; font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.vm-list-price.sell { color: var(--sell); }
.vm-list-price.buy  { color: var(--buy); }

/* ── right detail panel ────────────────────────────────────── */
.vm-detail { display: flex; flex-direction: column; overflow-y: auto; min-height: 0; }

.vm-placeholder {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; padding: 60px 24px; text-align: center;
}
.vm-ph-orb {
  width: 88px; height: 88px; border-radius: 24px; display: grid; place-items: center;
  background: linear-gradient(135deg, rgba(167,139,250,0.16), rgba(124,92,255,0.04));
  border: 1px solid rgba(167,139,250,0.22); color: var(--accent-2);
  box-shadow: 0 0 40px rgba(124,92,255,0.18), inset 0 0 20px rgba(167,139,250,0.08);
  animation: vm-breathe 4s ease-in-out infinite;
}
@keyframes vm-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
.vm-ph-title { font-size: 18px; font-weight: 700; color: var(--text); }
.vm-ph-sub { font-size: 13px; color: var(--muted); max-width: 320px; line-height: 1.65; }

/* item header */
.vm-item-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 18px 22px; flex-shrink: 0;
  background: linear-gradient(180deg, rgba(18,23,44,0.55), transparent);
  border-bottom: 1px solid var(--line);
}
.vm-item-id { display: flex; align-items: center; gap: 14px; min-width: 0; }
.vm-item-ico {
  width: 56px; height: 56px; flex-shrink: 0; display: grid; place-items: center;
  background: rgba(8,11,24,0.6); border: 1px solid var(--line-2); border-radius: 14px;
  box-shadow: inset 0 0 18px rgba(124,92,255,0.06);
}
.vm-item-titles { min-width: 0; }
.vm-item-name { font-size: 19px; font-weight: 800; color: #fff; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vm-item-key { font-size: 11px; color: var(--dim); font-family: ui-monospace, monospace; margin-top: 2px; }

.vm-item-quotes { display: flex; gap: 10px; flex-shrink: 0; }
.vm-quote {
  display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
  padding: 9px 15px; border-radius: 12px; border: 1px solid var(--line-2);
  background: var(--card);
}
.vm-quote.sell { border-color: rgba(251,111,132,0.22); background: rgba(251,111,132,0.06); }
.vm-quote.buy  { border-color: rgba(47,217,160,0.22);  background: rgba(47,217,160,0.06); }
.vm-quote.vol  { border-color: rgba(167,139,250,0.2);   background: rgba(167,139,250,0.06); }
.vm-quote-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--dim); }
.vm-quote-val { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
.vm-quote.sell .vm-quote-val { color: var(--sell-2); }
.vm-quote.buy  .vm-quote-val { color: var(--buy-2); }
.vm-quote.vol  .vm-quote-val { color: var(--accent-2); }

/* loading / spinner */
.vm-ob-loading { display: grid; place-items: center; padding: 60px; }
.vm-spinner {
  width: 30px; height: 30px; border-radius: 50%;
  border: 2.5px solid rgba(167,139,250,0.15); border-top-color: var(--accent);
  animation: vm-spin 0.7s linear infinite;
}
.vm-ob-error { margin: 20px; padding: 14px 16px; border-radius: 12px; background: rgba(251,111,132,0.1); border: 1px solid rgba(251,111,132,0.25); color: var(--sell-2); font-size: 13px; }

/* ── trade panel ───────────────────────────────────────────── */
.vm-trade { padding: 16px 22px 0; flex-shrink: 0; }
.vm-trade-tabs {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  padding: 5px; background: rgba(8,11,24,0.55); border: 1px solid var(--line);
  border-radius: 13px;
}
.vm-trade-tab {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 11px; border: none; border-radius: 9px;
  background: transparent; font-size: 13.5px; font-weight: 700; font-family: inherit;
  cursor: pointer; transition: all 0.18s;
}
.vm-trade-tab.buy  { color: var(--buy); }
.vm-trade-tab.sell { color: var(--sell); }
.vm-trade-tab.buy.active  { background: linear-gradient(135deg, rgba(47,217,160,0.26), rgba(47,217,160,0.1)); color: var(--buy-2); box-shadow: 0 3px 14px rgba(47,217,160,0.22), inset 0 1px 0 rgba(255,255,255,0.08); }
.vm-trade-tab.sell.active { background: linear-gradient(135deg, rgba(251,111,132,0.26), rgba(251,111,132,0.1)); color: var(--sell-2); box-shadow: 0 3px 14px rgba(251,111,132,0.22), inset 0 1px 0 rgba(255,255,255,0.08); }
.vm-trade-tab:not(.active):hover { background: rgba(150,170,255,0.05); }

.vm-form {
  margin-top: 12px; padding: 16px; border-radius: 14px;
  border: 1px solid var(--line-2); overflow: hidden;
}
.vm-form.buy  { background: rgba(47,217,160,0.04); border-color: rgba(47,217,160,0.18); }
.vm-form.sell { background: rgba(251,111,132,0.04); border-color: rgba(251,111,132,0.18); }
.vm-form-mode { margin-bottom: 12px; }
.vm-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 11px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
}
.vm-chip.instant-buy  { background: rgba(47,217,160,0.18); color: var(--buy-2); }
.vm-chip.instant-sell { background: rgba(251,111,132,0.18); color: var(--sell-2); }
.vm-chip.wait { background: rgba(132,147,184,0.14); color: var(--muted); }

.vm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.vm-field { display: flex; flex-direction: column; gap: 6px; }
.vm-field-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
}
.vm-field-label i { color: var(--dim); font-style: normal; }
.vm-field-label em { margin-left: auto; font-style: normal; text-transform: none; letter-spacing: 0; font-size: 10px; font-weight: 500; color: var(--dim); }
.vm-input {
  width: 100%; padding: 11px 13px;
  background: rgba(5,6,15,0.65); border: 1px solid var(--line-2); border-radius: 10px;
  color: #fff; font-size: 15px; font-weight: 600; font-family: inherit; font-variant-numeric: tabular-nums;
  outline: none; transition: border-color 0.18s, box-shadow 0.18s;
}
.vm-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(167,139,250,0.12); }

.vm-form-total {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 13px; padding: 11px 14px; border-radius: 10px;
  background: rgba(5,6,15,0.4); border: 1px solid var(--line);
  font-size: 12.5px; color: var(--muted);
}
.vm-form-total i { font-style: normal; color: var(--dim); }
.vm-form-total strong { font-size: 16px; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }

.vm-form-res { margin-top: 11px; padding: 9px 13px; border-radius: 10px; font-size: 12.5px; font-weight: 500; }
.vm-form-res.ok  { background: rgba(47,217,160,0.12); color: var(--buy-2); border: 1px solid rgba(47,217,160,0.25); }
.vm-form-res.err { background: rgba(251,111,132,0.12); color: var(--sell-2); border: 1px solid rgba(251,111,132,0.25); }

.vm-submit {
  width: 100%; margin-top: 13px; padding: 13px; border: none; border-radius: 11px;
  font-size: 13.5px; font-weight: 800; font-family: inherit; color: #fff; cursor: pointer;
  letter-spacing: 0.01em; transition: transform 0.12s, box-shadow 0.18s, opacity 0.18s;
}
.vm-submit.buy  { background: linear-gradient(135deg, #2fd9a0, #16a877); box-shadow: 0 6px 20px rgba(47,217,160,0.3); }
.vm-submit.sell { background: linear-gradient(135deg, #fb6f84, #e2455f); box-shadow: 0 6px 20px rgba(251,111,132,0.3); }
.vm-submit:hover:not(:disabled) { transform: translateY(-1px); }
.vm-submit.buy:hover:not(:disabled)  { box-shadow: 0 8px 26px rgba(47,217,160,0.42); }
.vm-submit.sell:hover:not(:disabled) { box-shadow: 0 8px 26px rgba(251,111,132,0.42); }
.vm-submit:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }

.vm-form-note { margin: 9px 0 0; font-size: 11px; line-height: 1.5; color: var(--dim); }

/* ── order book ────────────────────────────────────────────── */
.vm-book { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0; padding: 18px 22px 0; min-height: 0; }
.vm-book-col { display: flex; flex-direction: column; min-width: 0; }
.vm-book-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px 9px;
}
.vm-book-title { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
.vm-book-head.sell .vm-book-title { color: var(--sell); }
.vm-book-head.buy  .vm-book-title { color: var(--buy); }
.vm-dot { width: 7px; height: 7px; border-radius: 50%; }
.vm-dot.sell { background: var(--sell); box-shadow: 0 0 8px var(--sell); }
.vm-dot.buy  { background: var(--buy);  box-shadow: 0 0 8px var(--buy); }
.vm-book-cols { display: flex; gap: 16px; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--dim); }
.vm-book-cols span:last-child { width: 60px; text-align: right; }

.vm-book-rows { display: flex; flex-direction: column; gap: 2px; }
.vm-book-empty { padding: 24px 8px; text-align: center; color: var(--dim); font-size: 12px; }

.vm-book-row {
  position: relative; display: grid; grid-template-columns: 1fr 60px; align-items: center;
  width: 100%; padding: 8px 12px; border: none; border-radius: 8px;
  background: transparent; cursor: pointer; font-family: inherit; overflow: hidden;
  transition: background 0.12s;
}
.vm-book-row:hover { background: rgba(150,170,255,0.06); }
.vm-book-row.best { background: rgba(150,170,255,0.04); }
.vm-depth {
  position: absolute; top: 0; bottom: 0; z-index: 0;
  opacity: 0.13; transition: width 0.4s cubic-bezier(0.16,1,0.3,1);
}
.vm-depth.sell { right: 0; background: linear-gradient(90deg, transparent, var(--sell)); }
.vm-depth.buy  { left: 0;  background: linear-gradient(90deg, var(--buy), transparent); }
.vm-book-price { position: relative; z-index: 1; font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.vm-book-price.sell { color: var(--sell-2); }
.vm-book-price.buy  { color: var(--buy-2); }
.vm-book-qty { position: relative; z-index: 1; text-align: right; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.vm-book-cta {
  position: absolute; z-index: 2; right: 12px; top: 50%; transform: translateY(-50%);
  font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 7px;
  opacity: 0; transition: opacity 0.15s; pointer-events: none;
}
.vm-book-cta.sell { background: rgba(47,217,160,0.9); color: #04130d; }
.vm-book-cta.buy  { background: rgba(251,111,132,0.9); color: #1a0509; }
.vm-book-row:hover .vm-book-cta { opacity: 1; }
.vm-book-row:hover .vm-book-qty { opacity: 0; }

/* spread divider */
.vm-book-mid { display: flex; align-items: flex-start; justify-content: center; padding: 30px 18px 0; }
.vm-spread {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 10px 16px; border-radius: 12px;
  background: rgba(8,11,24,0.6); border: 1px solid var(--line-2);
  min-width: 96px;
}
.vm-spread-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); }
.vm-spread-val { font-size: 15px; font-weight: 800; color: var(--accent-2); font-variant-numeric: tabular-nums; }
.vm-spread-last { font-size: 10px; color: var(--muted); white-space: nowrap; }

.vm-book-hint {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  margin-top: auto; padding: 16px; color: var(--dim); font-size: 11.5px;
}

/* ═══ PAGE WRAPPER (orders / history / pickup) ═══════════════ */
.vm-page { flex: 1; overflow-y: auto; padding: 22px; min-height: 0; }

/* my orders */
.vm-orders-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 1100px; margin: 0 auto; }
.vm-orders-col { display: flex; flex-direction: column; }
.vm-orders-title {
  display: flex; align-items: center; gap: 8px;
  padding-bottom: 12px; margin-bottom: 12px;
  font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
  border-bottom: 1px solid var(--line-2);
}
.vm-orders-title.sell { color: var(--sell); }
.vm-orders-title.buy  { color: var(--buy); }
.vm-orders-count {
  margin-left: auto; padding: 2px 9px; border-radius: 8px;
  background: rgba(150,170,255,0.08); color: var(--muted); font-size: 11px; font-weight: 700;
}
.vm-orders-empty { padding: 28px 4px; color: var(--dim); font-size: 12.5px; }

.vm-order {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; margin-bottom: 8px; border-radius: 13px;
  background: var(--card); border: 1px solid var(--line);
  transition: border-color 0.16s, background 0.16s;
}
.vm-order:hover { background: var(--card-h); border-color: var(--line-2); }
.vm-order-ico {
  width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center;
  background: rgba(8,11,24,0.5); border: 1px solid var(--line); border-radius: 9px;
}
.vm-order-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.vm-order-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vm-order-key { font-size: 10px; color: var(--dim); font-family: ui-monospace, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vm-order-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
.vm-order-price { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.vm-order-price.sell { color: var(--sell-2); }
.vm-order-price.buy  { color: var(--buy-2); }
.vm-order-qty { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.vm-order-status { font-size: 8.5px; font-weight: 800; padding: 2px 6px; border-radius: 5px; text-transform: uppercase; letter-spacing: 0.04em; }
.vm-order-status.waiting { background: rgba(132,147,184,0.15); color: var(--muted); }
.vm-order-status.partial { background: rgba(251,191,36,0.16); color: var(--gold); }
.vm-order-cancel {
  flex-shrink: 0; padding: 7px 14px; border-radius: 9px;
  background: rgba(251,111,132,0.1); border: 1px solid rgba(251,111,132,0.22);
  color: var(--sell-2); font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit;
  transition: background 0.16s;
}
.vm-order-cancel:hover:not(:disabled) { background: rgba(251,111,132,0.22); }
.vm-order-cancel:disabled { opacity: 0.4; cursor: not-allowed; }

/* history table */
.vm-empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 90px 0; }
.vm-empty-ico { font-size: 46px; opacity: 0.6; }
.vm-empty-title { font-size: 16px; font-weight: 700; }
.vm-empty-sub { font-size: 12.5px; color: var(--muted); }

.vm-table-card { max-width: 900px; margin: 0 auto; background: var(--panel); border: 1px solid var(--line-2); border-radius: 16px; overflow: hidden; }
.vm-table { width: 100%; border-collapse: collapse; }
.vm-table thead tr { background: rgba(8,11,24,0.5); }
.vm-table th { padding: 12px 18px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); text-align: left; }
.vm-table th.ar { text-align: right; }
.vm-table tbody tr { border-top: 1px solid var(--line); transition: background 0.12s; }
.vm-table tbody tr:hover { background: rgba(150,170,255,0.04); }
.vm-table td { padding: 12px 18px; font-size: 13px; }
.vm-td-item { display: flex; align-items: center; gap: 10px; }
.vm-td-ico { width: 28px; height: 28px; display: grid; place-items: center; background: rgba(8,11,24,0.5); border: 1px solid var(--line); border-radius: 7px; }
.ar { text-align: right; }
.mono { font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); }
.accent { color: var(--accent-2); font-weight: 700; }

/* pickup */
.vm-pickup-wrap { display: flex; align-items: center; justify-content: center; }
.vm-pickup-card {
  display: flex; flex-direction: column; align-items: center; gap: 18px;
  padding: 44px 40px; max-width: 380px; width: 100%; text-align: center;
  background: var(--panel); border: 1px solid var(--line-2); border-radius: 22px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5);
}
.vm-pickup-ring {
  width: 120px; height: 120px; border-radius: 50%; display: grid; place-items: center;
  border: 2px solid var(--line-2); transition: all 0.3s;
}
.vm-pickup-ring.active {
  border-color: rgba(47,217,160,0.4);
  box-shadow: 0 0 50px rgba(47,217,160,0.25), inset 0 0 30px rgba(47,217,160,0.08);
  animation: vm-breathe 2.4s ease-in-out infinite;
}
.vm-pickup-num { font-size: 58px; font-weight: 900; line-height: 1; color: var(--buy-2); text-shadow: 0 0 40px rgba(47,217,160,0.4); }
.vm-pickup-num.zero { color: var(--dim); text-shadow: none; }
.vm-pickup-label { font-size: 14px; color: var(--muted); margin-top: -4px; }
.vm-pickup-res { width: 100%; padding: 11px 14px; border-radius: 11px; font-size: 12.5px; }
.vm-pickup-res.ok  { background: rgba(47,217,160,0.12); color: var(--buy-2); }
.vm-pickup-res.err { background: rgba(251,111,132,0.12); color: var(--sell-2); }
.vm-pickup-btn {
  width: 100%; padding: 15px; border: none; border-radius: 13px;
  background: linear-gradient(135deg, #a78bfa, #7c5cff); color: #fff;
  font-size: 14.5px; font-weight: 800; font-family: inherit; cursor: pointer;
  box-shadow: 0 8px 26px rgba(124,92,255,0.35);
  transition: transform 0.12s, box-shadow 0.18s, opacity 0.18s;
}
.vm-pickup-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 32px rgba(124,92,255,0.5); }
.vm-pickup-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
.vm-pickup-hint { font-size: 11.5px; color: var(--dim); line-height: 1.5; }

/* ═══ HAND SELL MODAL ════════════════════════════════════════ */
.vm-modal-backdrop {
  position: fixed; inset: 0; z-index: 100;
  display: grid; place-items: center; padding: 20px;
  background: rgba(3,4,10,0.7); backdrop-filter: blur(8px);
}
.vm-modal {
  width: 100%; max-width: 400px; padding: 24px;
  background: linear-gradient(180deg, rgba(18,23,44,0.96), rgba(13,17,34,0.96));
  border: 1px solid var(--line-2); border-radius: 20px;
  box-shadow: 0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
  display: flex; flex-direction: column; gap: 16px;
}
.vm-modal-head { display: flex; align-items: center; justify-content: space-between; }
.vm-modal-title { display: flex; align-items: center; gap: 9px; font-size: 16px; font-weight: 800; color: #fff; }
.vm-modal-title svg { color: var(--sell-2); }
.vm-modal-close {
  display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
  background: rgba(150,170,255,0.06); border: 1px solid var(--line); color: var(--muted);
  font-size: 14px; cursor: pointer; transition: all 0.16s;
}
.vm-modal-close:hover { color: var(--text); background: rgba(150,170,255,0.12); }
.vm-modal-info {
  padding: 12px 14px; border-radius: 12px;
  background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.18);
  font-size: 12.5px; line-height: 1.6; color: var(--muted);
}
.vm-modal-info strong { color: var(--text); }
.vm-modal-actions { display: flex; gap: 10px; margin-top: 2px; }
.vm-modal-cancel {
  flex: 1; padding: 13px; border-radius: 11px;
  background: rgba(150,170,255,0.06); border: 1px solid var(--line-2);
  color: var(--muted); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
  transition: all 0.16s;
}
.vm-modal-cancel:hover { color: var(--text); background: rgba(150,170,255,0.12); }
.vm-modal-actions .vm-submit { flex: 1.6; margin-top: 0; }

/* ═══ FATAL ══════════════════════════════════════════════════ */
.vm-fatal {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; min-height: 100vh;
}
.vm-fatal-icon { font-size: 52px; }
.vm-fatal-title { font-size: 22px; font-weight: 800; color: var(--sell-2); }
.vm-fatal-sub { font-size: 13.5px; color: var(--muted); }
.vm-fatal-sub code { padding: 2px 8px; border-radius: 6px; background: rgba(150,170,255,0.1); color: var(--accent-2); font-family: ui-monospace, monospace; }

/* ═══ TRANSITIONS ════════════════════════════════════════════ */
.vm-fade-enter-active, .vm-fade-leave-active { transition: opacity 0.22s; }
.vm-fade-enter-from, .vm-fade-leave-to { opacity: 0; }
.vm-slide-enter-active { transition: opacity 0.25s, transform 0.25s cubic-bezier(0.16,1,0.3,1); }
.vm-slide-leave-active { transition: opacity 0.18s, transform 0.18s; }
.vm-slide-enter-from, .vm-slide-leave-to { opacity: 0; transform: translateY(-8px); }
.vm-modal-enter-active { transition: opacity 0.25s; }
.vm-modal-leave-active { transition: opacity 0.2s; }
.vm-modal-enter-from, .vm-modal-leave-to { opacity: 0; }
.vm-modal-enter-active .vm-modal { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
.vm-modal-enter-from .vm-modal { transform: scale(0.94) translateY(12px); }

/* scrollbars */
.vm-list-scroll::-webkit-scrollbar, .vm-detail::-webkit-scrollbar, .vm-page::-webkit-scrollbar { width: 8px; }
.vm-list-scroll::-webkit-scrollbar-thumb, .vm-detail::-webkit-scrollbar-thumb, .vm-page::-webkit-scrollbar-thumb {
  background: rgba(150,170,255,0.12); border-radius: 4px;
}
.vm-list-scroll::-webkit-scrollbar-thumb:hover, .vm-detail::-webkit-scrollbar-thumb:hover, .vm-page::-webkit-scrollbar-thumb:hover {
  background: rgba(150,170,255,0.22);
}
</style>
