<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { authState } from '../stores/authStore'
import { getMyPlayerMarketSellOrders, getMyPlayerMarketBuyOrders, getMyPlayerMarketTrades } from '../services/marketApi'
import ItemIcon from '../components/ItemIcon.vue'
import { useItemNames } from '../composables/useItemNames'

const itemNames = useItemNames()
const tab = ref('sells')
const loading = ref(true)
const sellOrders = ref([])
const buyOrders = ref([])
const myTrades = ref([])
const showInactiveSells = ref(false)
const showInactiveBuys = ref(false)

const activeSellCount = computed(() => sellOrders.value.filter((o) => ['active', 'partially_filled'].includes(o.status)).length)
const activeBuyCount = computed(() => buyOrders.value.filter((o) => ['active', 'partially_filled'].includes(o.status)).length)

const totalSellValue = computed(() =>
  sellOrders.value
    .filter(o => ['active', 'partially_filled'].includes(o.status))
    .reduce((s, o) => s + (o.remaining_amount * o.unit_price), 0)
)
const totalBuyReserved = computed(() =>
  buyOrders.value
    .filter(o => ['active', 'partially_filled'].includes(o.status))
    .reduce((s, o) => s + (o.reserved_funds || 0), 0)
)

const myNick = computed(() => authState.user?.player_account?.minecraft_nickname || '')

onMounted(async () => {
  try {
    await Promise.all([loadSellOrders(), loadBuyOrders(), loadTrades()])
  } finally {
    loading.value = false
  }
})

async function loadSellOrders() {
  try {
    const res = await getMyPlayerMarketSellOrders({ include_inactive: showInactiveSells.value, limit: 100 })
    sellOrders.value = res.items || []
  } catch { sellOrders.value = [] }
}

async function loadBuyOrders() {
  try {
    const res = await getMyPlayerMarketBuyOrders({ include_inactive: showInactiveBuys.value, limit: 100 })
    buyOrders.value = res.items || []
  } catch { buyOrders.value = [] }
}

async function loadTrades() {
  try {
    const res = await getMyPlayerMarketTrades({ limit: 100 })
    myTrades.value = res.items || []
  } catch { myTrades.value = [] }
}

function tradeRole(trade) {
  if (!myNick.value) return '—'
  return trade.seller_player_name.toLowerCase() === myNick.value.toLowerCase() ? 'Продавец' : 'Покупатель'
}

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

function fillPct(o) {
  if (!o.total_amount) return 0
  return Math.round(((o.total_amount - o.remaining_amount) / o.total_amount) * 100)
}

function statusLabel(s) {
  const map = { active: 'Активен', partially_filled: 'Частично', filled: 'Исполнен', cancelled: 'Отменён', expired: 'Истёк' }
  return map[s] || s
}

function statusColor(s) {
  const map = {
    active: 'mo-status--active',
    partially_filled: 'mo-status--partial',
    filled: 'mo-status--filled',
    cancelled: 'mo-status--dead',
    expired: 'mo-status--dead',
  }
  return map[s] || 'mo-status--dead'
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return `${Math.floor(diff / 86400)} д назад`
}
</script>

<template>
  <div class="mo">
    <div class="mo__ambient" aria-hidden="true" />

    <div class="container-shell mo__shell page-entry">

      <!-- ── Header ── -->
      <header class="mo-header">
        <div class="mo-header__glow" />
        <div class="mo-header__inner">
          <div class="mo-header__left">
            <RouterLink to="/market" class="mo-back">
              <svg class="mo-back__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Рынок игроков
            </RouterLink>
            <h1 class="mo-title">Мои <span class="mo-title__accent">ордера</span></h1>
            <p class="mo-subtitle">Активные заявки и история сделок на рынке игроков VoidRP</p>
          </div>

          <!-- Summary chips -->
          <div v-if="!loading" class="mo-summary">
            <div class="mo-chip mo-chip--ask">
              <span class="mo-chip__label">Продажи</span>
              <span class="mo-chip__val">{{ activeSellCount }}</span>
              <span class="mo-chip__sub">{{ fmt(totalSellValue) }} ₽</span>
            </div>
            <div class="mo-chip mo-chip--bid">
              <span class="mo-chip__label">Покупки</span>
              <span class="mo-chip__val">{{ activeBuyCount }}</span>
              <span class="mo-chip__sub">{{ fmt(totalBuyReserved) }} ₽</span>
            </div>
            <div class="mo-chip">
              <span class="mo-chip__label">Сделок</span>
              <span class="mo-chip__val">{{ myTrades.length }}</span>
              <span class="mo-chip__sub">история</span>
            </div>
          </div>
        </div>
      </header>

      <!-- ── Loader ── -->
      <div v-if="loading" class="mo-loader">
        <span class="loading loading-spinner loading-md text-violet-500" />
        <span class="mo-loader__label">Загрузка ордеров…</span>
      </div>

      <template v-else>

        <!-- ── Tabs ── -->
        <div class="mo-tabs">
          <button class="mo-tab" :class="{ 'mo-tab--active': tab === 'sells' }" @click="tab = 'sells'">
            <svg class="mo-tab__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
            Продажи
            <span v-if="activeSellCount > 0" class="mo-tab__badge mo-tab__badge--ask">{{ activeSellCount }}</span>
          </button>
          <button class="mo-tab" :class="{ 'mo-tab--active': tab === 'buys' }" @click="tab = 'buys'">
            <svg class="mo-tab__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
            Покупки
            <span v-if="activeBuyCount > 0" class="mo-tab__badge mo-tab__badge--bid">{{ activeBuyCount }}</span>
          </button>
          <button class="mo-tab" :class="{ 'mo-tab--active': tab === 'trades' }" @click="tab = 'trades'">
            <svg class="mo-tab__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            История сделок
            <span v-if="myTrades.length > 0" class="mo-tab__badge mo-tab__badge--neutral">{{ myTrades.length }}</span>
          </button>
        </div>

        <!-- ── SELL ORDERS ── -->
        <div v-if="tab === 'sells'" class="mo-section">
          <div class="mo-section__bar">
            <label class="mo-toggle">
              <input v-model="showInactiveSells" type="checkbox" class="mo-toggle__input" @change="loadSellOrders" />
              <span class="mo-toggle__track"><span class="mo-toggle__thumb" /></span>
              <span class="mo-toggle__label">Показать завершённые</span>
            </label>
            <span class="mo-section__hint">Для отмены: <code class="mo-code">/pm cancel sell &lt;id&gt;</code></span>
          </div>

          <div v-if="sellOrders.length === 0" class="mo-empty">
            <div class="mo-empty__icon mo-empty__icon--ask">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
            </div>
            <p class="mo-empty__title">Нет ордеров на продажу</p>
            <p class="mo-empty__hint">Разместите ордер командой <code class="mo-code">/pm sell</code> в игре</p>
          </div>

          <div v-else class="surface-card mo-table-card">
            <div class="mo-table-scroll">
              <table class="mo-table">
                <thead>
                  <tr class="mo-thead-row">
                    <th class="mo-th mo-th--left">Предмет</th>
                    <th class="mo-th mo-th--center">Исполнение</th>
                    <th class="mo-th mo-th--right">Цена</th>
                    <th class="mo-th mo-th--right">Остаток</th>
                    <th class="mo-th mo-th--center">Статус</th>
                    <th class="mo-th mo-th--right hidden md:table-cell">Истекает</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="o in sellOrders" :key="o.id" class="mo-row">
                    <td class="mo-td mo-td--item">
                      <div class="mo-item">
                        <div class="mo-item__icon mo-item__icon--ask">
                          <ItemIcon :item-key="o.item_key" :size="28" />
                        </div>
                        <div class="mo-item__body">
                          <span class="mo-item__name">{{ o.display_name || formatKey(o.item_key) }}</span>
                          <span class="mo-item__key">{{ o.item_key }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="mo-td">
                      <div class="mo-fill">
                        <div class="mo-fill__bar-wrap">
                          <div class="mo-fill__bar mo-fill__bar--ask" :style="{ width: fillPct(o) + '%' }" />
                        </div>
                        <span class="mo-fill__label">{{ fillPct(o) }}%</span>
                        <span class="mo-fill__counts">{{ (o.total_amount - o.remaining_amount).toLocaleString() }}/{{ o.total_amount.toLocaleString() }}</span>
                      </div>
                    </td>
                    <td class="mo-td mo-td--right">
                      <span class="mo-price mo-price--ask">{{ fmt(o.unit_price) }} ₽</span>
                    </td>
                    <td class="mo-td mo-td--right">
                      <span class="mo-value">{{ fmt(o.remaining_amount * o.unit_price) }} ₽</span>
                    </td>
                    <td class="mo-td mo-td--center">
                      <span class="mo-status" :class="statusColor(o.status)">{{ statusLabel(o.status) }}</span>
                    </td>
                    <td class="mo-td mo-td--right hidden md:table-cell">
                      <span class="mo-date">{{ formatDate(o.expires_at) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ── BUY ORDERS ── -->
        <div v-else-if="tab === 'buys'" class="mo-section">
          <div class="mo-section__bar">
            <label class="mo-toggle">
              <input v-model="showInactiveBuys" type="checkbox" class="mo-toggle__input" @change="loadBuyOrders" />
              <span class="mo-toggle__track"><span class="mo-toggle__thumb" /></span>
              <span class="mo-toggle__label">Показать завершённые</span>
            </label>
            <span class="mo-section__hint">Для отмены: <code class="mo-code">/pm cancel buy &lt;id&gt;</code></span>
          </div>

          <div v-if="buyOrders.length === 0" class="mo-empty">
            <div class="mo-empty__icon mo-empty__icon--bid">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
            </div>
            <p class="mo-empty__title">Нет ордеров на покупку</p>
            <p class="mo-empty__hint">Разместите ордер командой <code class="mo-code">/pm buy</code> в игре</p>
          </div>

          <div v-else class="surface-card mo-table-card">
            <div class="mo-table-scroll">
              <table class="mo-table">
                <thead>
                  <tr class="mo-thead-row">
                    <th class="mo-th mo-th--left">Предмет</th>
                    <th class="mo-th mo-th--center">Исполнение</th>
                    <th class="mo-th mo-th--right">Цена</th>
                    <th class="mo-th mo-th--right">Зарезервировано</th>
                    <th class="mo-th mo-th--center">Статус</th>
                    <th class="mo-th mo-th--right hidden md:table-cell">Истекает</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="o in buyOrders" :key="o.id" class="mo-row">
                    <td class="mo-td mo-td--item">
                      <div class="mo-item">
                        <div class="mo-item__icon mo-item__icon--bid">
                          <ItemIcon :item-key="o.item_key" :size="28" />
                        </div>
                        <div class="mo-item__body">
                          <span class="mo-item__name">{{ o.display_name || formatKey(o.item_key) }}</span>
                          <span class="mo-item__key">{{ o.item_key }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="mo-td">
                      <div class="mo-fill">
                        <div class="mo-fill__bar-wrap">
                          <div class="mo-fill__bar mo-fill__bar--bid" :style="{ width: fillPct(o) + '%' }" />
                        </div>
                        <span class="mo-fill__label">{{ fillPct(o) }}%</span>
                        <span class="mo-fill__counts">{{ (o.total_amount - o.remaining_amount).toLocaleString() }}/{{ o.total_amount.toLocaleString() }}</span>
                      </div>
                    </td>
                    <td class="mo-td mo-td--right">
                      <span class="mo-price mo-price--bid">{{ fmt(o.unit_price) }} ₽</span>
                    </td>
                    <td class="mo-td mo-td--right">
                      <span class="mo-value">{{ fmt(o.reserved_funds) }} ₽</span>
                    </td>
                    <td class="mo-td mo-td--center">
                      <span class="mo-status" :class="statusColor(o.status)">{{ statusLabel(o.status) }}</span>
                    </td>
                    <td class="mo-td mo-td--right hidden md:table-cell">
                      <span class="mo-date">{{ formatDate(o.expires_at) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ── TRADES ── -->
        <div v-else-if="tab === 'trades'" class="mo-section">
          <div v-if="myTrades.length === 0" class="mo-empty">
            <div class="mo-empty__icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            </div>
            <p class="mo-empty__title">История сделок пуста</p>
            <p class="mo-empty__hint">Завершённые сделки появятся здесь</p>
          </div>

          <div v-else class="surface-card mo-table-card">
            <div class="mo-table-scroll">
              <table class="mo-table">
                <thead>
                  <tr class="mo-thead-row">
                    <th class="mo-th mo-th--left">Предмет</th>
                    <th class="mo-th mo-th--right">Кол-во</th>
                    <th class="mo-th mo-th--right">Цена</th>
                    <th class="mo-th mo-th--right">Сумма</th>
                    <th class="mo-th mo-th--center">Роль</th>
                    <th class="mo-th mo-th--left hidden md:table-cell">Контрагент</th>
                    <th class="mo-th mo-th--right hidden sm:table-cell">Время</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in myTrades" :key="t.id" class="mo-row">
                    <td class="mo-td mo-td--item">
                      <div class="mo-item">
                        <div class="mo-item__icon" :class="tradeRole(t) === 'Продавец' ? 'mo-item__icon--ask' : 'mo-item__icon--bid'">
                          <ItemIcon :item-key="t.item_key" :size="28" />
                        </div>
                        <div class="mo-item__body">
                          <span class="mo-item__name">{{ t.display_name || formatKey(t.item_key) }}</span>
                          <span class="mo-item__key">{{ t.item_key }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="mo-td mo-td--right">
                      <span class="mo-value">{{ t.amount.toLocaleString() }}</span>
                    </td>
                    <td class="mo-td mo-td--right">
                      <span class="mo-price" :class="tradeRole(t) === 'Продавец' ? 'mo-price--ask' : 'mo-price--bid'">
                        {{ fmt(t.unit_price) }} ₽
                      </span>
                    </td>
                    <td class="mo-td mo-td--right">
                      <span class="mo-value mo-value--bright">{{ fmt(t.gross_total) }} ₽</span>
                    </td>
                    <td class="mo-td mo-td--center">
                      <span class="mo-role" :class="tradeRole(t) === 'Продавец' ? 'mo-role--ask' : 'mo-role--bid'">
                        {{ tradeRole(t) }}
                      </span>
                    </td>
                    <td class="mo-td hidden md:table-cell">
                      <span class="mo-counterparty">{{ tradeRole(t) === 'Продавец' ? t.buyer_player_name : t.seller_player_name }}</span>
                    </td>
                    <td class="mo-td mo-td--right hidden sm:table-cell">
                      <span class="mo-date">{{ timeAgo(t.created_at) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<style scoped>
/* ── Root ── */
.mo {
  position: relative;
  min-height: 60vh;
  padding: 1.5rem 0 3rem;
}

.mo__ambient {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse 50% 35% at 75% 8%, rgba(139,92,246,.06) 0%, transparent 60%),
    radial-gradient(ellipse 35% 25% at 8% 85%, rgba(16,185,129,.04) 0%, transparent 60%);
}

.mo__shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Header ── */
.mo-header {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  padding: 1.85rem 2rem;
  background: linear-gradient(135deg, rgba(18,24,48,.99) 0%, rgba(10,15,28,1) 55%, rgba(7,10,20,1) 100%);
  border: 1px solid rgba(139,92,246,.18);
  box-shadow: 0 0 0 1px rgba(255,255,255,.025), 0 24px 80px rgba(0,0,0,.5);
}

.mo-header__glow {
  position: absolute;
  top: -80px; right: -60px;
  width: 320px; height: 320px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(139,92,246,.14) 0%, transparent 65%);
  filter: blur(50px);
  pointer-events: none;
}

.mo-header__inner {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}

/* Back link */
.mo-back {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  font-size: .78rem;
  font-weight: 600;
  color: rgb(100 116 139);
  text-decoration: none;
  margin-bottom: .55rem;
  transition: color .12s;
}
.mo-back:hover { color: rgb(100 116 139); }
.mo-back__icon { width: .9rem; height: .9rem; flex-shrink: 0; }

.mo-title {
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  font-weight: 900;
  letter-spacing: -.04em;
  color: #f1f5f9;
  margin: 0 0 .35rem;
  line-height: 1.05;
}
.mo-title__accent {
  background: linear-gradient(90deg, #c4b5fd, #818cf8);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.mo-subtitle { font-size: .8rem; color: rgb(100 116 139); margin: 0; line-height: 1.5; }

/* Summary chips */
.mo-summary {
  display: flex;
  gap: .55rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.mo-chip {
  display: flex;
  flex-direction: column;
  gap: .18rem;
  padding: .7rem .9rem;
  border-radius: 14px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.07);
  min-width: 96px;
}
.mo-chip--ask { background: rgba(244,63,94,.06); border-color: rgba(244,63,94,.18); }
.mo-chip--bid { background: rgba(16,185,129,.06); border-color: rgba(16,185,129,.18); }

.mo-chip__label {
  font-size: .6rem;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgb(100 116 139);
}
.mo-chip__val {
  font-size: 1.15rem;
  font-weight: 900;
  letter-spacing: -.03em;
  color: #f1f5f9;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.mo-chip--ask .mo-chip__val { color: rgb(251 113 133); }
.mo-chip--bid .mo-chip__val { color: rgb(52 211 153); }
.mo-chip__sub { font-size: .65rem; color: rgb(100 116 139); font-variant-numeric: tabular-nums; }

/* ── Loader ── */
.mo-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .85rem;
  padding: 5rem 0;
}
.mo-loader__label { font-size: .82rem; color: rgb(100 116 139); }

/* ── Tabs ── */
.mo-tabs {
  display: flex;
  gap: .35rem;
  flex-wrap: wrap;
}

.mo-tab {
  display: flex;
  align-items: center;
  gap: .45rem;
  padding: .6rem 1.15rem;
  border-radius: 12px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.07);
  color: rgb(100 116 139);
  font-size: .82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all .12s;
}
.mo-tab:hover { color: rgb(148 163 184); background: rgba(255,255,255,.06); }
.mo-tab--active {
  background: rgba(139,92,246,.12);
  border-color: rgba(139,92,246,.3);
  color: rgb(196 181 253);
}

.mo-tab__icon { width: .85rem; height: .85rem; flex-shrink: 0; }

.mo-tab__badge {
  font-size: .63rem;
  font-weight: 900;
  padding: .08rem .42rem;
  border-radius: 999px;
  border: 1px solid;
}
.mo-tab__badge--ask { color: rgb(251 113 133); background: rgba(244,63,94,.12); border-color: rgba(244,63,94,.25); }
.mo-tab__badge--bid { color: rgb(52 211 153); background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.25); }
.mo-tab__badge--neutral { color: rgb(100 116 139); background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.08); }

/* ── Section ── */
.mo-section { display: flex; flex-direction: column; gap: .75rem; }

.mo-section__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: .75rem;
}
.mo-section__hint { font-size: .72rem; color: rgb(100 116 139); }

/* Toggle */
.mo-toggle {
  display: flex;
  align-items: center;
  gap: .6rem;
  cursor: pointer;
}
.mo-toggle__input { display: none; }
.mo-toggle__track {
  width: 32px; height: 18px;
  border-radius: 999px;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.1);
  position: relative;
  transition: background .15s, border-color .15s;
  flex-shrink: 0;
}
.mo-toggle__thumb {
  position: absolute;
  top: 2px; left: 2px;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: rgb(71 85 105);
  transition: transform .15s, background .15s;
}
.mo-toggle__input:checked ~ .mo-toggle__track {
  background: rgba(139,92,246,.3);
  border-color: rgba(139,92,246,.5);
}
.mo-toggle__input:checked ~ .mo-toggle__track .mo-toggle__thumb {
  transform: translateX(14px);
  background: rgb(167 139 250);
}
.mo-toggle__label { font-size: .8rem; color: rgb(100 116 139); user-select: none; }

/* ── Empty state ── */
.mo-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .85rem;
  padding: 4rem 1rem;
  text-align: center;
  border: 1px solid rgba(255,255,255,.05);
  border-radius: 20px;
  background: rgba(255,255,255,.015);
}
.mo-empty__icon {
  width: 54px; height: 54px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 15px;
  color: rgb(100 116 139);
}
.mo-empty__icon--ask { border-color: rgba(244,63,94,.15); background: rgba(244,63,94,.05); color: rgba(251,113,133,.4); }
.mo-empty__icon--bid { border-color: rgba(16,185,129,.15); background: rgba(16,185,129,.05); color: rgba(52,211,153,.4); }
.mo-empty__icon svg { width: 26px; height: 26px; }
.mo-empty__title { font-size: 1rem; font-weight: 800; color: rgb(100 116 139); margin: 0; }
.mo-empty__hint { font-size: .8rem; color: rgb(100 116 139); margin: 0; }

/* ── Table ── */
.mo-table-card { border-radius: 20px; overflow: hidden; }
.mo-table-scroll { overflow-x: auto; }

.mo-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 500px;
}

.mo-thead-row { border-bottom: 1px solid rgba(255,255,255,.06); }

.mo-th {
  padding: .65rem 1rem;
  font-size: .67rem;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  background: rgba(255,255,255,.012);
  white-space: nowrap;
}
.mo-th--left { text-align: left; }
.mo-th--right { text-align: right; }
.mo-th--center { text-align: center; }

.mo-row {
  border-bottom: 1px solid rgba(255,255,255,.03);
  transition: background .1s;
}
.mo-row:last-child { border-bottom: none; }
.mo-row:hover { background: rgba(139,92,246,.04); }

.mo-td {
  padding: .65rem 1rem;
  vertical-align: middle;
}
.mo-td--right { text-align: right; }
.mo-td--center { text-align: center; }
.mo-td--item { min-width: 180px; }

/* Item cell */
.mo-item { display: flex; align-items: center; gap: .65rem; }

.mo-item__icon {
  flex-shrink: 0;
  width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 10px;
  transition: border-color .12s;
}
.mo-item__icon--ask { background: rgba(244,63,94,.05); border-color: rgba(244,63,94,.15); }
.mo-item__icon--bid { background: rgba(16,185,129,.05); border-color: rgba(16,185,129,.15); }

.mo-item__body {
  display: flex;
  flex-direction: column;
  gap: .1rem;
  min-width: 0;
}
.mo-item__name {
  font-size: .82rem;
  font-weight: 700;
  color: rgb(203 213 225);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mo-item__key {
  font-size: .66rem;
  font-family: 'Courier New', monospace;
  color: rgb(100 116 139);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Fill progress */
.mo-fill {
  display: flex;
  align-items: center;
  gap: .5rem;
}
.mo-fill__bar-wrap {
  flex: 1;
  min-width: 60px;
  height: 4px;
  background: rgba(255,255,255,.05);
  border-radius: 999px;
  overflow: hidden;
}
.mo-fill__bar {
  height: 100%;
  border-radius: 999px;
  transition: width .4s ease;
}
.mo-fill__bar--ask { background: linear-gradient(90deg, rgba(244,63,94,.4), rgba(244,63,94,.7)); }
.mo-fill__bar--bid { background: linear-gradient(90deg, rgba(16,185,129,.4), rgba(16,185,129,.7)); }
.mo-fill__label { font-size: .72rem; font-weight: 700; color: rgb(100 116 139); white-space: nowrap; }
.mo-fill__counts { font-size: .65rem; color: rgb(100 116 139); white-space: nowrap; font-variant-numeric: tabular-nums; }

/* Prices */
.mo-price {
  font-size: .82rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.mo-price--ask { color: rgb(251 113 133); }
.mo-price--bid { color: rgb(52 211 153); }

.mo-value { font-size: .78rem; color: rgb(100 116 139); font-variant-numeric: tabular-nums; }
.mo-value--bright { color: rgb(148 163 184); font-weight: 600; }

/* Status chip */
.mo-status {
  display: inline-block;
  font-size: .66rem;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
  padding: .22rem .55rem;
  border-radius: 6px;
  border: 1px solid;
  white-space: nowrap;
}
.mo-status--active { color: rgb(167 139 250); background: rgba(139,92,246,.1); border-color: rgba(139,92,246,.25); }
.mo-status--partial { color: rgb(251 191 36); background: rgba(245,158,11,.1); border-color: rgba(245,158,11,.25); }
.mo-status--filled { color: rgb(52 211 153); background: rgba(16,185,129,.1); border-color: rgba(16,185,129,.25); }
.mo-status--dead { color: rgb(100 116 139); background: rgba(255,255,255,.03); border-color: rgba(255,255,255,.07); }

/* Role chip */
.mo-role {
  display: inline-block;
  font-size: .66rem;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
  padding: .22rem .55rem;
  border-radius: 6px;
  border: 1px solid;
  white-space: nowrap;
}
.mo-role--ask { color: rgb(251 113 133); background: rgba(244,63,94,.1); border-color: rgba(244,63,94,.22); }
.mo-role--bid { color: rgb(52 211 153); background: rgba(16,185,129,.1); border-color: rgba(16,185,129,.22); }

.mo-counterparty { font-size: .78rem; color: rgb(100 116 139); }
.mo-date { font-size: .72rem; color: rgb(100 116 139); white-space: nowrap; }

/* Inline code */
.mo-code {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 5px;
  padding: .07rem .38rem;
  font-family: 'Courier New', monospace;
  font-size: .77rem;
  color: rgb(196 181 253);
}
</style>
