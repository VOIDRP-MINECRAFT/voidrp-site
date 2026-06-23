<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  getPlayerMarketOrderBook,
  getPlayerMarketTrades,
  getMarketItemHistory,
} from '../services/marketApi'
import ItemIcon from '../components/ItemIcon.vue'
import { useItemNames } from '../composables/useItemNames'

const { t } = useI18n()
const itemNames = useItemNames()
const route = useRoute()

const itemKey = computed(() => String(route.params.material || '').toLowerCase())

const loading = ref(true)
const orderBook = ref(null)
const trades = ref([])
const history = ref([])
const historyDays = ref(30)

// ─── SVG chart constants ──────────────────────────────────────────────────────
const CW = 700
const CH = 220
const PAD = { top: 16, right: 20, bottom: 36, left: 64 }
const PLOT_W = CW - PAD.left - PAD.right
const PLOT_H = CH - PAD.top - PAD.bottom

function groupByDay(points) {
  const byDate = {}
  for (const p of points) {
    const date = String(p.recorded_at || p.date || '').slice(0, 10)
    if (!date || date.length < 10) continue
    if (!byDate[date]) byDate[date] = { buys: [], sells: [] }
    if (p.buy_price != null) byDate[date].buys.push(Number(p.buy_price))
    if (p.sell_price != null) byDate[date].sells.push(Number(p.sell_price))
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      avgBuy: d.buys.length ? d.buys.reduce((a, b) => a + b, 0) / d.buys.length : null,
      avgSell: d.sells.length ? d.sells.reduce((a, b) => a + b, 0) / d.sells.length : null,
    }))
}

function groupTradesByDay(tradeList) {
  const byDate = {}
  for (const tr of tradeList) {
    const date = String(tr.created_at || '').slice(0, 10)
    if (!date) continue
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(Number(tr.unit_price))
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, prices]) => ({
      date,
      avgBuy: prices.reduce((a, b) => a + b, 0) / prices.length,
      avgSell: null,
    }))
}

const chartData = computed(() => {
  let points = []
  if (history.value.length >= 2) {
    points = groupByDay(history.value)
  } else if (trades.value.length >= 2) {
    points = groupTradesByDay(trades.value)
  }
  if (!points.length) return null
  const allPrices = points.flatMap((p) => [p.avgBuy, p.avgSell].filter((v) => v !== null))
  if (!allPrices.length) return null
  const rawMin = Math.min(...allPrices)
  const rawMax = Math.max(...allPrices)
  const pad = (rawMax - rawMin) * 0.1 || rawMax * 0.05 || 1
  return { points, minVal: Math.max(0, rawMin - pad), maxVal: rawMax + pad }
})

function cx(i, total) {
  if (total <= 1) return PAD.left + PLOT_W / 2
  return PAD.left + (i / (total - 1)) * PLOT_W
}
function cy(v, minVal, maxVal) {
  const range = maxVal - minVal || 1
  return PAD.top + (1 - (v - minVal) / range) * PLOT_H
}

const buyPath = computed(() => {
  if (!chartData.value) return ''
  const { points, minVal, maxVal } = chartData.value
  const pts = points.map((p, i) => ({ ...p, i })).filter((p) => p.avgBuy !== null)
  if (pts.length < 2) return ''
  return pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${cx(p.i, points.length).toFixed(1)},${cy(p.avgBuy, minVal, maxVal).toFixed(1)}`).join(' ')
})

const sellPath = computed(() => {
  if (!chartData.value) return ''
  const { points, minVal, maxVal } = chartData.value
  const pts = points.map((p, i) => ({ ...p, i })).filter((p) => p.avgSell !== null)
  if (pts.length < 2) return ''
  return pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${cx(p.i, points.length).toFixed(1)},${cy(p.avgSell, minVal, maxVal).toFixed(1)}`).join(' ')
})

const buyFillPath = computed(() => {
  if (!chartData.value || !buyPath.value) return ''
  const { points, minVal, maxVal } = chartData.value
  const pts = points.map((p, i) => ({ ...p, i })).filter((p) => p.avgBuy !== null)
  if (pts.length < 2) return ''
  const firstX = cx(pts[0].i, points.length).toFixed(1)
  const lastX = cx(pts[pts.length - 1].i, points.length).toFixed(1)
  const bottom = (PAD.top + PLOT_H).toFixed(1)
  return `${buyPath.value} L${lastX},${bottom} L${firstX},${bottom} Z`
})

const sellFillPath = computed(() => {
  if (!chartData.value || !sellPath.value) return ''
  const { points, minVal, maxVal } = chartData.value
  const pts = points.map((p, i) => ({ ...p, i })).filter((p) => p.avgSell !== null)
  if (pts.length < 2) return ''
  const firstX = cx(pts[0].i, points.length).toFixed(1)
  const lastX = cx(pts[pts.length - 1].i, points.length).toFixed(1)
  const bottom = (PAD.top + PLOT_H).toFixed(1)
  return `${sellPath.value} L${lastX},${bottom} L${firstX},${bottom} Z`
})

const yLabels = computed(() => {
  if (!chartData.value) return []
  const { minVal, maxVal } = chartData.value
  return [0, 1, 2, 3, 4].map((i) => {
    const v = minVal + (i / 4) * (maxVal - minVal)
    return { v, y: cy(v, minVal, maxVal) }
  })
})

const xLabels = computed(() => {
  if (!chartData.value) return []
  const { points } = chartData.value
  const total = points.length
  if (!total) return []
  const step = Math.max(1, Math.ceil(total / 7))
  const result = []
  for (let i = 0; i < total; i += step) {
    result.push({ x: cx(i, total), label: points[i].date.slice(5) })
  }
  const last = total - 1
  if (last > 0 && last % step !== 0) result.push({ x: cx(last, total), label: points[last].date.slice(5) })
  return result
})

// ─── Stats ────────────────────────────────────────────────────────────────────
const displayName = computed(() => {
  if (trades.value[0]?.display_name) return trades.value[0].display_name
  return formatKey(itemKey.value)
})

const lastPrice = computed(() => orderBook.value?.last_trade_price ?? null)
const bestAsk = computed(() => orderBook.value?.sell_side?.[0]?.unit_price ?? null)
const bestBid = computed(() => orderBook.value?.buy_side?.[0]?.unit_price ?? null)
const spread = computed(() => (bestAsk.value != null && bestBid.value != null) ? bestAsk.value - bestBid.value : null)

const priceChange = computed(() => {
  if (!chartData.value) return null
  const { points } = chartData.value
  const first = points.find(p => p.avgBuy !== null)?.avgBuy
  const last = [...points].reverse().find(p => p.avgBuy !== null)?.avgBuy
  if (!first || !last || first === last) return null
  const pct = ((last - first) / first) * 100
  return { pct, label: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' }
})

// Depth bar normalization
const maxAskAmt = computed(() => Math.max(1, ...(orderBook.value?.sell_side?.map(r => r.total_amount) ?? [1])))
const maxBidAmt = computed(() => Math.max(1, ...(orderBook.value?.buy_side?.map(r => r.total_amount) ?? [1])))

// ─── Data load ────────────────────────────────────────────────────────────────
async function load() {
  if (!itemKey.value) return
  loading.value = true
  orderBook.value = null
  trades.value = []

  try {
    const [book, tradesRes, historyRes] = await Promise.all([
      getPlayerMarketOrderBook(itemKey.value),
      getPlayerMarketTrades({ item_key: itemKey.value, limit: 100 }),
      getMarketItemHistory(itemKey.value.toUpperCase(), historyDays.value).catch(() => null),
    ])
    orderBook.value = book
    trades.value = tradesRes?.items || []
    history.value = historyRes?.points || []
  } catch (e) {
    // show empty state
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  try {
    const data = await getMarketItemHistory(itemKey.value.toUpperCase(), historyDays.value)
    history.value = data?.points || []
  } catch {
    history.value = []
  }
}

function setHistoryDays(days) {
  historyDays.value = days
  void loadHistory()
}

onMounted(load)
watch(itemKey, load)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val) {
  if (val == null) return '—'
  return Number(val).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatKey(key) {
  if (!key) return key
  if (itemNames.value[key]) return itemNames.value[key]
  const parts = key.split(':')
  return parts[parts.length - 1].replace(/_/g, ' ')
}

function fmtTime(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
</script>

<template>
  <div class="mi">
    <div class="mi__ambient" aria-hidden="true" />

    <div class="container-shell mi__shell page-entry">

      <!-- ── Breadcrumb ── -->
      <RouterLink to="/market" class="mi-back">
        <svg class="mi-back__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
        Рынок игроков
      </RouterLink>

      <!-- ── Loader ── -->
      <div v-if="loading" class="mi-loader">
        <span class="loading loading-spinner loading-md text-violet-500" />
        <span class="mi-loader__label">Загрузка…</span>
      </div>

      <template v-else>

        <!-- ── HERO ── -->
        <header class="mi-hero">
          <div class="mi-hero__glow mi-hero__glow--tl" />
          <div class="mi-hero__glow mi-hero__glow--br" />

          <div class="mi-hero__inner">
            <!-- Icon + Name -->
            <div class="mi-hero__identity">
              <div class="mi-hero__icon-wrap">
                <div class="mi-hero__icon-halo" />
                <ItemIcon :item-key="itemKey" :size="52" />
              </div>
              <div class="mi-hero__name-block">
                <div class="section-kicker" style="margin-bottom:.4rem">Предмет рынка</div>
                <h1 class="mi-hero__title">{{ displayName }}</h1>
                <code class="mi-hero__key">{{ itemKey }}</code>
              </div>
            </div>

            <!-- Stat chips -->
            <div class="mi-stats">
              <div class="mi-stat mi-stat--primary" v-if="lastPrice != null">
                <span class="mi-stat__label">Последняя сделка</span>
                <span class="mi-stat__val">{{ fmt(lastPrice) }} ₽</span>
                <span v-if="priceChange" class="mi-stat__change" :class="priceChange.pct >= 0 ? 'mi-stat__change--up' : 'mi-stat__change--dn'">
                  {{ priceChange.label }} / {{ historyDays }}д
                </span>
              </div>
              <div class="mi-stat mi-stat--ask" v-if="bestAsk != null">
                <span class="mi-stat__label">Лучший ASK</span>
                <span class="mi-stat__val mi-stat__val--ask">{{ fmt(bestAsk) }} ₽</span>
                <span class="mi-stat__sub">продают от</span>
              </div>
              <div class="mi-stat mi-stat--bid" v-if="bestBid != null">
                <span class="mi-stat__label">Лучший BID</span>
                <span class="mi-stat__val mi-stat__val--bid">{{ fmt(bestBid) }} ₽</span>
                <span class="mi-stat__sub">покупают до</span>
              </div>
              <div class="mi-stat" v-if="spread != null">
                <span class="mi-stat__label">Спред</span>
                <span class="mi-stat__val">{{ fmt(spread) }} ₽</span>
                <span class="mi-stat__sub">ASK − BID</span>
              </div>
            </div>
          </div>
        </header>

        <!-- ── MAIN LAYOUT ── -->
        <div class="mi-layout">

          <!-- ORDER BOOK -->
          <div class="mi-ob surface-card">
            <div class="mi-ob__head">
              <span class="mi-ob__title">Стакан заявок</span>
              <span class="mi-ob__hint">цена · объём</span>
            </div>

            <!-- ASK side -->
            <div class="mi-ob__section">
              <div class="mi-ob__section-label mi-ob__section-label--ask">ASK — Продают</div>
              <div v-if="!orderBook?.sell_side?.length" class="mi-ob__empty">Нет предложений</div>
              <div v-else class="mi-ob__rows">
                <div
                  v-for="(row, i) in orderBook.sell_side"
                  :key="'ask-' + i"
                  class="mi-ob__row mi-ob__row--ask"
                  :class="{ 'mi-ob__row--best': i === 0 }"
                >
                  <div
                    class="mi-ob__depth mi-ob__depth--ask"
                    :style="{ width: Math.max(4, Math.round((row.total_amount / maxAskAmt) * 100)) + '%' }"
                  />
                  <span class="mi-ob__price mi-ob__price--ask">{{ fmt(row.unit_price) }}</span>
                  <span class="mi-ob__qty">{{ row.total_amount.toLocaleString('ru-RU') }}</span>
                  <span class="mi-ob__orders">({{ row.order_count }})</span>
                </div>
              </div>
            </div>

            <!-- Spread divider -->
            <div v-if="spread != null" class="mi-ob__spread">
              <div class="mi-ob__spread-line" />
              <span class="mi-ob__spread-val">Спред {{ fmt(spread) }} ₽</span>
              <div class="mi-ob__spread-line" />
            </div>

            <!-- BID side -->
            <div class="mi-ob__section">
              <div class="mi-ob__section-label mi-ob__section-label--bid">BID — Покупают</div>
              <div v-if="!orderBook?.buy_side?.length" class="mi-ob__empty">Нет заявок</div>
              <div v-else class="mi-ob__rows">
                <div
                  v-for="(row, i) in orderBook.buy_side"
                  :key="'bid-' + i"
                  class="mi-ob__row mi-ob__row--bid"
                  :class="{ 'mi-ob__row--best': i === 0 }"
                >
                  <div
                    class="mi-ob__depth mi-ob__depth--bid"
                    :style="{ width: Math.max(4, Math.round((row.total_amount / maxBidAmt) * 100)) + '%' }"
                  />
                  <span class="mi-ob__price mi-ob__price--bid">{{ fmt(row.unit_price) }}</span>
                  <span class="mi-ob__qty">{{ row.total_amount.toLocaleString('ru-RU') }}</span>
                  <span class="mi-ob__orders">({{ row.order_count }})</span>
                </div>
              </div>
            </div>

            <!-- Quick commands -->
            <div class="mi-ob__cmds">
              <code class="mi-ob__cmd">/pm sell &lt;кол-во&gt; &lt;цена&gt;</code>
              <code class="mi-ob__cmd">/pm buy {{ itemKey }} &lt;кол-во&gt; &lt;цена&gt;</code>
            </div>
          </div>

          <!-- RIGHT COLUMN: chart + trades -->
          <div class="mi-right">

            <!-- PRICE CHART -->
            <div class="mi-chart surface-card">
              <div class="mi-chart__head">
                <div>
                  <h3 class="mi-chart__title">История цен</h3>
                  <p class="mi-chart__sub">Средняя цена сделок по дням</p>
                </div>
                <div class="mi-chart__tabs">
                  <button
                    v-for="days in [7, 30, 90]"
                    :key="days"
                    class="mi-chart__tab"
                    :class="{ 'mi-chart__tab--active': historyDays === days }"
                    @click="setHistoryDays(days)"
                  >{{ days }}д</button>
                </div>
              </div>

              <div v-if="!chartData" class="mi-chart__empty">
                Недостаточно данных для графика
              </div>
              <div v-else class="mi-chart__canvas">
                <svg :viewBox="`0 0 ${CW} ${CH}`" class="w-full" style="max-height:220px">
                  <!-- Fill areas -->
                  <defs>
                    <linearGradient id="grad-buy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="rgba(52,211,153,0.18)" />
                      <stop offset="100%" stop-color="rgba(52,211,153,0)" />
                    </linearGradient>
                    <linearGradient id="grad-sell" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="rgba(251,113,133,0.14)" />
                      <stop offset="100%" stop-color="rgba(251,113,133,0)" />
                    </linearGradient>
                  </defs>
                  <path v-if="buyFillPath" :d="buyFillPath" fill="url(#grad-buy)" />
                  <path v-if="sellFillPath" :d="sellFillPath" fill="url(#grad-sell)" />
                  <!-- Lines -->
                  <path v-if="buyPath" :d="buyPath" fill="none" stroke="rgb(52,211,153)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                  <path v-if="sellPath" :d="sellPath" fill="none" stroke="rgb(251,113,133)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                  <!-- Grid -->
                  <line :x1="PAD.left" :y1="PAD.top" :x2="PAD.left" :y2="PAD.top + PLOT_H" stroke="rgba(255,255,255,0.05)" />
                  <line v-for="lbl in yLabels" :key="lbl.v" :x1="PAD.left" :y1="lbl.y.toFixed(1)" :x2="PAD.left + PLOT_W" :y2="lbl.y.toFixed(1)" stroke="rgba(255,255,255,0.03)" stroke-dasharray="3,4" />
                  <text v-for="lbl in yLabels" :key="'y'+lbl.v" :x="PAD.left - 7" :y="lbl.y.toFixed(1)" text-anchor="end" dominant-baseline="middle" fill="rgba(255,255,255,0.22)" font-size="10">
                    {{ Number(lbl.v).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) }}
                  </text>
                  <line :x1="PAD.left" :y1="PAD.top + PLOT_H" :x2="PAD.left + PLOT_W" :y2="PAD.top + PLOT_H" stroke="rgba(255,255,255,0.05)" />
                  <text v-for="lbl in xLabels" :key="lbl.x" :x="lbl.x.toFixed(1)" :y="PAD.top + PLOT_H + 16" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-size="10">{{ lbl.label }}</text>
                </svg>
                <div class="mi-chart__legend">
                  <span class="mi-chart__leg-item">
                    <span class="mi-chart__leg-dot mi-chart__leg-dot--bid" />
                    Покупка
                  </span>
                  <span v-if="sellPath" class="mi-chart__leg-item">
                    <span class="mi-chart__leg-dot mi-chart__leg-dot--ask" />
                    Продажа
                  </span>
                </div>
              </div>
            </div>

            <!-- TRADE HISTORY -->
            <div class="mi-trades surface-card">
              <h3 class="mi-trades__title">История сделок</h3>
              <div v-if="!trades.length" class="mi-trades__empty">Сделок пока нет</div>
              <div v-else class="mi-trades__scroll">
                <table class="mi-trades__table">
                  <thead>
                    <tr class="mi-trades__thead-row">
                      <th class="mi-trades__th">Время</th>
                      <th class="mi-trades__th mi-trades__th--r">Кол-во</th>
                      <th class="mi-trades__th mi-trades__th--r">Цена</th>
                      <th class="mi-trades__th mi-trades__th--r">Сумма</th>
                      <th class="mi-trades__th mi-trades__th--ask">Продавец</th>
                      <th class="mi-trades__th mi-trades__th--bid">Покупатель</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="trade in trades.slice(0, 50)"
                      :key="trade.id"
                      class="mi-trades__row"
                    >
                      <td class="mi-trades__td mi-trades__td--time">{{ fmtTime(trade.created_at) }}</td>
                      <td class="mi-trades__td mi-trades__td--r">{{ trade.amount.toLocaleString('ru-RU') }}</td>
                      <td class="mi-trades__td mi-trades__td--r mi-trades__td--price">{{ fmt(trade.unit_price) }} ₽</td>
                      <td class="mi-trades__td mi-trades__td--r mi-trades__td--total">{{ fmt(trade.gross_total) }} ₽</td>
                      <td class="mi-trades__td mi-trades__td--seller">{{ trade.seller_player_name }}</td>
                      <td class="mi-trades__td mi-trades__td--buyer">{{ trade.buyer_player_name }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ── Root ── */
.mi {
  position: relative;
  min-height: 60vh;
  padding: 1.5rem 0 3rem;
}

.mi__ambient {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse 50% 40% at 80% 5%, rgba(139,92,246,.07) 0%, transparent 60%),
    radial-gradient(ellipse 40% 30% at 5% 90%, rgba(16,185,129,.04) 0%, transparent 60%);
}

.mi__shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Breadcrumb ── */
.mi-back {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  font-size: .8rem;
  font-weight: 600;
  color: rgb(100 116 139);
  text-decoration: none;
  transition: color .12s;
}
.mi-back:hover { color: rgb(148 163 184); }
.mi-back__icon { width: 1rem; height: 1rem; flex-shrink: 0; }

/* ── Loader ── */
.mi-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .85rem;
  padding: 5rem 0;
}
.mi-loader__label { font-size: .82rem; color: rgb(100 116 139); }

/* ── Hero ── */
.mi-hero {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  padding: 1.85rem 2rem;
  background:
    linear-gradient(135deg, rgba(18,24,48,.99) 0%, rgba(10,15,28,1) 55%, rgba(7,10,20,1) 100%);
  border: 1px solid rgba(139,92,246,.18);
  box-shadow: 0 0 0 1px rgba(255,255,255,.025), 0 24px 80px rgba(0,0,0,.5);
}

.mi-hero__glow {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(55px);
}
.mi-hero__glow--tl {
  top: -80px; right: -80px;
  width: 360px; height: 360px;
  background: radial-gradient(circle, rgba(139,92,246,.15) 0%, transparent 65%);
}
.mi-hero__glow--br {
  bottom: -50px; left: 0;
  width: 220px; height: 220px;
  background: radial-gradient(circle, rgba(16,185,129,.08) 0%, transparent 65%);
}

.mi-hero__inner {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 2rem;
  flex-wrap: wrap;
}

.mi-hero__identity {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-shrink: 0;
}

.mi-hero__icon-wrap {
  position: relative;
  width: 76px; height: 76px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 18px;
  flex-shrink: 0;
}

.mi-hero__icon-halo {
  position: absolute;
  inset: -8px;
  border-radius: 24px;
  background: radial-gradient(circle, rgba(139,92,246,.12) 0%, transparent 70%);
  pointer-events: none;
}

.mi-hero__name-block {
  display: flex;
  flex-direction: column;
  gap: .15rem;
}

.mi-hero__title {
  font-size: clamp(1.3rem, 3vw, 2rem);
  font-weight: 900;
  letter-spacing: -.04em;
  color: #f1f5f9;
  margin: 0;
  text-transform: capitalize;
  line-height: 1.1;
}

.mi-hero__key {
  font-family: 'Courier New', monospace;
  font-size: .72rem;
  color: rgb(100 116 139);
  margin-top: .2rem;
}

/* Stat chips */
.mi-stats {
  display: flex;
  flex-wrap: wrap;
  gap: .55rem;
  align-items: flex-start;
  flex: 1;
  justify-content: flex-end;
}

.mi-stat {
  display: flex;
  flex-direction: column;
  gap: .2rem;
  padding: .75rem 1rem;
  border-radius: 14px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.07);
  min-width: 110px;
  transition: border-color .15s;
}
.mi-stat:hover { border-color: rgba(255,255,255,.12); }

.mi-stat--primary {
  background: rgba(139,92,246,.07);
  border-color: rgba(139,92,246,.2);
}
.mi-stat--ask {
  background: rgba(244,63,94,.06);
  border-color: rgba(244,63,94,.18);
}
.mi-stat--bid {
  background: rgba(16,185,129,.06);
  border-color: rgba(16,185,129,.18);
}

.mi-stat__label {
  font-size: .62rem;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgb(100 116 139);
}

.mi-stat__val {
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: -.03em;
  color: #f1f5f9;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}
.mi-stat__val--ask { color: rgb(251 113 133); }
.mi-stat__val--bid { color: rgb(52 211 153); }

.mi-stat__sub {
  font-size: .65rem;
  color: rgb(100 116 139);
}

.mi-stat__change {
  font-size: .75rem;
  font-weight: 700;
}
.mi-stat__change--up { color: rgb(52 211 153); }
.mi-stat__change--dn { color: rgb(251 113 133); }

/* ── Main layout ── */
.mi-layout {
  display: grid;
  gap: .85rem;
  align-items: start;
}
@media (min-width: 1024px) {
  .mi-layout { grid-template-columns: 260px minmax(0, 1fr); }
}

/* ── Order Book ── */
.mi-ob {
  border-radius: 20px;
  overflow: hidden;
  padding: 0;
}

.mi-ob__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .9rem 1.1rem .6rem;
  border-bottom: 1px solid rgba(255,255,255,.05);
}

.mi-ob__title {
  font-size: .7rem;
  font-weight: 800;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: rgb(100 116 139);
}

.mi-ob__hint {
  font-size: .65rem;
  color: rgb(100 116 139);
}

.mi-ob__section { padding: .6rem 0 .35rem; }

.mi-ob__section-label {
  font-size: .63rem;
  font-weight: 800;
  letter-spacing: .18em;
  text-transform: uppercase;
  padding: 0 1.1rem .45rem;
}
.mi-ob__section-label--ask { color: rgba(251,113,133,.5); }
.mi-ob__section-label--bid { color: rgba(52,211,153,.5); }

.mi-ob__empty {
  font-size: .78rem;
  color: rgb(100 116 139);
  text-align: center;
  padding: .8rem 0;
}

.mi-ob__rows { display: flex; flex-direction: column; }

/* Order book row with depth bar */
.mi-ob__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: .35rem;
  padding: .32rem 1.1rem;
  transition: background .1s;
  overflow: hidden;
}
.mi-ob__row:hover { background: rgba(255,255,255,.025); }
.mi-ob__row--best { border-top: 1px solid rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.04); }

.mi-ob__depth {
  position: absolute;
  inset-y: 0;
  right: 0;
  z-index: 0;
  transition: width .35s ease;
  border-radius: 3px 0 0 3px;
}
.mi-ob__depth--ask { background: rgba(251,113,133,.1); }
.mi-ob__depth--bid { background: rgba(52,211,153,.1); }

.mi-ob__price {
  position: relative;
  z-index: 1;
  font-size: .8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex: 1;
}
.mi-ob__price--ask { color: rgb(251 113 133); }
.mi-ob__row--best .mi-ob__price--ask { color: rgb(255 160 170); }
.mi-ob__price--bid { color: rgb(52 211 153); }
.mi-ob__row--best .mi-ob__price--bid { color: rgb(110 240 180); }

.mi-ob__qty {
  position: relative;
  z-index: 1;
  font-size: .76rem;
  color: rgb(100 116 139);
  font-variant-numeric: tabular-nums;
}

.mi-ob__orders {
  position: relative;
  z-index: 1;
  font-size: .66rem;
  color: rgb(100 116 139);
}

/* Spread divider */
.mi-ob__spread {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .45rem 1.1rem;
}
.mi-ob__spread-line {
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,.06);
}
.mi-ob__spread-val {
  font-size: .66rem;
  font-weight: 700;
  color: rgb(100 116 139);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* Quick commands */
.mi-ob__cmds {
  display: flex;
  flex-direction: column;
  gap: .3rem;
  padding: .8rem 1.1rem;
  border-top: 1px solid rgba(255,255,255,.05);
}
.mi-ob__cmd {
  font-family: 'Courier New', monospace;
  font-size: .68rem;
  color: rgb(100 116 139);
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 7px;
  padding: .3rem .6rem;
  display: block;
  word-break: break-all;
}

/* ── Right column ── */
.mi-right { display: flex; flex-direction: column; gap: .85rem; }

/* ── Chart ── */
.mi-chart {
  border-radius: 20px;
  padding: 1.25rem;
}

.mi-chart__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.mi-chart__title {
  font-size: .85rem;
  font-weight: 800;
  color: rgb(203 213 225);
  margin: 0 0 .2rem;
}
.mi-chart__sub { font-size: .72rem; color: rgb(100 116 139); margin: 0; }

.mi-chart__tabs {
  display: flex;
  gap: .3rem;
}

.mi-chart__tab {
  border-radius: 9px;
  padding: .3rem .7rem;
  font-size: .73rem;
  font-weight: 700;
  border: 1px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.03);
  color: rgb(100 116 139);
  cursor: pointer;
  transition: all .12s;
}
.mi-chart__tab:hover { color: rgb(148 163 184); background: rgba(255,255,255,.06); }
.mi-chart__tab--active {
  background: rgba(139,92,246,.14);
  border-color: rgba(139,92,246,.35);
  color: rgb(196 181 253);
}

.mi-chart__empty {
  font-size: .82rem;
  color: rgb(100 116 139);
  text-align: center;
  padding: 2.5rem 0;
}

.mi-chart__canvas { overflow-x: auto; }

.mi-chart__legend {
  display: flex;
  gap: 1.25rem;
  justify-content: flex-end;
  margin-top: .6rem;
}
.mi-chart__leg-item {
  display: flex;
  align-items: center;
  gap: .45rem;
  font-size: .72rem;
  color: rgb(100 116 139);
}
.mi-chart__leg-dot {
  width: 20px;
  height: 2.5px;
  border-radius: 999px;
  flex-shrink: 0;
}
.mi-chart__leg-dot--bid { background: rgb(52 211 153); }
.mi-chart__leg-dot--ask { background: rgb(251 113 133); }

/* ── Trades table ── */
.mi-trades {
  border-radius: 20px;
  padding: 1.25rem;
}

.mi-trades__title {
  font-size: .7rem;
  font-weight: 800;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .9rem;
}

.mi-trades__empty {
  font-size: .82rem;
  color: rgb(100 116 139);
  text-align: center;
  padding: 1.5rem 0;
}

.mi-trades__scroll { overflow-x: auto; }

.mi-trades__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 480px;
}

.mi-trades__thead-row { border-bottom: 1px solid rgba(255,255,255,.06); }

.mi-trades__th {
  padding: .4rem .6rem;
  font-size: .65rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  white-space: nowrap;
}
.mi-trades__th--r { text-align: right; }
.mi-trades__th--ask { color: rgba(251,113,133,.4); }
.mi-trades__th--bid { color: rgba(52,211,153,.4); }

.mi-trades__row {
  border-bottom: 1px solid rgba(255,255,255,.03);
  transition: background .1s;
}
.mi-trades__row:last-child { border-bottom: none; }
.mi-trades__row:hover { background: rgba(255,255,255,.025); }

.mi-trades__td {
  padding: .5rem .6rem;
  font-size: .78rem;
  vertical-align: middle;
}
.mi-trades__td--r { text-align: right; }
.mi-trades__td--time { color: rgb(100 116 139); white-space: nowrap; font-size: .72rem; }
.mi-trades__td--price { font-weight: 700; color: rgb(203 213 225); font-variant-numeric: tabular-nums; }
.mi-trades__td--total { color: rgb(100 116 139); font-variant-numeric: tabular-nums; }
.mi-trades__td--seller { color: rgba(251,113,133,.6); font-size: .72rem; }
.mi-trades__td--buyer { color: rgba(52,211,153,.6); font-size: .72rem; }
</style>
