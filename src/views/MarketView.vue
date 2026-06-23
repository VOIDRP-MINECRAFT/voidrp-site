<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { usePageMeta } from '../composables/usePageMeta.js'
import { getIsAuthenticated } from '../stores/authStore'
import { getPlayerMarketItems, getPlayerMarketTrades } from '../services/marketApi'
import ItemIcon from '../components/ItemIcon.vue'
import { useItemNames } from '../composables/useItemNames'

const itemNames = useItemNames()

usePageMeta({
  title: 'Рынок игроков',
  description: 'Биржа предметов VoidRP — ордера на покупку и продажу от игроков в реальном времени.',
  url: 'https://void-rp.ru/market',
  breadcrumbs: [{ name: 'Главная', url: '/' }, { name: 'Рынок' }],
})

const router = useRouter()

const items = ref([])
const recentTrades = ref([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const sortBy = ref('volume_24h')
const sortDir = ref('desc')

const isAuthenticated = computed(() => getIsAuthenticated())

onMounted(async () => {
  try {
    const [itemsRes, tradesRes] = await Promise.all([
      getPlayerMarketItems(),
      getPlayerMarketTrades({ limit: 20 }),
    ])
    items.value = itemsRes.items || []
    recentTrades.value = tradesRes.items || []
  } catch (e) {
    error.value = 'Не удалось загрузить рынок'
  } finally {
    loading.value = false
  }
})

const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((i) => {
    if (i.item_key.includes(q)) return true
    if (i.display_name && i.display_name.toLowerCase().includes(q)) return true
    const ruName = itemNames.value[i.item_key]
    if (ruName && ruName.toLowerCase().includes(q)) return true
    return false
  })
})

const sortedItems = computed(() => {
  const arr = [...filteredItems.value]
  arr.sort((a, b) => {
    let va = a[sortBy.value] ?? (sortDir.value === 'asc' ? Infinity : -Infinity)
    let vb = b[sortBy.value] ?? (sortDir.value === 'asc' ? Infinity : -Infinity)
    if (typeof va === 'string') return sortDir.value === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    return sortDir.value === 'asc' ? va - vb : vb - va
  })
  return arr
})

const maxVolume = computed(() => Math.max(1, ...sortedItems.value.map(i => i.volume_24h || 0)))
const hotKeys = computed(() =>
  new Set(
    [...items.value]
      .sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0))
      .slice(0, 3)
      .map(i => i.item_key)
  )
)

function setSort(col) {
  if (sortBy.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = col
    sortDir.value = col === 'item_key' ? 'asc' : 'desc'
  }
}

function sortIcon(col) {
  if (sortBy.value !== col) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

function openItem(itemKey) {
  router.push({ name: 'market-item', params: { material: itemKey } })
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

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч`
  return `${Math.floor(diff / 86400)} д`
}
</script>

<template>
  <div class="mv">
    <!-- page ambient glow -->
    <div class="mv__ambient" aria-hidden="true" />

    <div class="container-shell mv__shell page-entry">

      <!-- ── HERO ── -->
      <header class="mv-hero">
        <div class="mv-hero__glow mv-hero__glow--tl" />
        <div class="mv-hero__glow mv-hero__glow--br" />
        <div class="mv-hero__inner">
          <div class="mv-hero__left">
            <div class="section-kicker">Торговая площадка</div>
            <h1 class="mv-title">Рынок <span class="mv-title__accent">игроков</span></h1>
            <p class="mv-subtitle">Ордерная биржа VoidRP · Ваниль и моды · Авто-матчинг · Комиссия 2%</p>
            <div class="mv-badges">
              <span class="mv-badge mv-badge--emerald">
                <svg class="mv-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                Авто-матчинг ордеров
              </span>
              <span class="mv-badge mv-badge--amber">
                <svg class="mv-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Комиссия 2% → казна
              </span>
              <code class="mv-badge mv-badge--code">/shop</code>
            </div>
          </div>
          <RouterLink v-if="isAuthenticated" to="/market/me/orders" class="mv-orders-btn">
            <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            Мои ордера
          </RouterLink>
        </div>
      </header>

      <!-- ── SEARCH ── -->
      <div class="mv-controls">
        <div class="mv-search">
          <svg class="mv-search__icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Поиск предмета — алмаз, diamond, зелье…"
            class="mv-search__input"
          />
          <span v-if="search && !loading" class="mv-search__count">{{ filteredItems.length }}</span>
        </div>
        <select class="mv-select" :value="sortBy + ':' + sortDir" @change="e => { const [c,d] = e.target.value.split(':'); sortBy = c; sortDir = d }">
          <option value="volume_24h:desc">Объём ↓</option>
          <option value="volume_24h:asc">Объём ↑</option>
          <option value="best_ask:asc">Цена продажи ↑</option>
          <option value="best_ask:desc">Цена продажи ↓</option>
          <option value="best_bid:desc">Цена покупки ↓</option>
          <option value="item_key:asc">Название А→Я</option>
        </select>
      </div>

      <!-- ── LOADING ── -->
      <div v-if="loading" class="mv-loader">
        <span class="loading loading-spinner loading-md text-violet-500" />
        <span class="mv-loader__label">Загрузка рынка…</span>
      </div>

      <!-- ── ERROR ── -->
      <div v-else-if="error" class="mv-error">{{ error }}</div>

      <template v-else>

        <!-- ── EMPTY ── -->
        <div v-if="sortedItems.length === 0" class="mv-empty">
          <div class="mv-empty__icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          </div>
          <p class="mv-empty__title">{{ search ? 'Нет предметов по запросу' : 'Активных ордеров пока нет' }}</p>
          <p class="mv-empty__hint">Зайди в игру · <code class="mv-code">/shop</code></p>
        </div>

        <!-- ── MAIN LAYOUT ── -->
        <div v-else class="mv-layout">

          <!-- TABLE -->
          <div class="mv-table-card surface-card">
            <div class="mv-table-scroll">
              <table class="mv-table">
                <thead>
                  <tr class="mv-thead-row">
                    <th class="mv-th mv-th--left" @click="setSort('item_key')">
                      Предмет <span class="mv-sort">{{ sortIcon('item_key') }}</span>
                    </th>
                    <th class="mv-th mv-th--ask" @click="setSort('best_sell_price')">
                      ASK <span class="mv-sort">{{ sortIcon('best_sell_price') }}</span>
                    </th>
                    <th class="mv-th mv-th--bid" @click="setSort('best_buy_price')">
                      BID <span class="mv-sort">{{ sortIcon('best_buy_price') }}</span>
                    </th>
                    <th class="mv-th mv-th--muted hidden md:table-cell">Спред</th>
                    <th class="mv-th mv-th--vol hidden lg:table-cell" @click="setSort('volume_24h')">
                      Объём 24ч <span class="mv-sort">{{ sortIcon('volume_24h') }}</span>
                    </th>
                    <th class="mv-th mv-th--orders hidden lg:table-cell">Ордера ↑↓</th>
                    <th class="mv-th mv-th--right" @click="setSort('last_trade_price')">
                      Последняя <span class="mv-sort">{{ sortIcon('last_trade_price') }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in sortedItems"
                    :key="item.item_key"
                    class="mv-row"
                    @click="openItem(item.item_key)"
                  >
                    <!-- Item -->
                    <td class="mv-td mv-td--item">
                      <div class="mv-item">
                        <div class="mv-item__icon">
                          <ItemIcon :item-key="item.item_key" :size="30" />
                        </div>
                        <div class="mv-item__body">
                          <span class="mv-item__name">
                            {{ item.display_name || formatKey(item.item_key) }}
                            <span v-if="hotKeys.has(item.item_key)" class="mv-hot">HOT</span>
                          </span>
                          <span class="mv-item__key">{{ item.item_key }}</span>
                        </div>
                      </div>
                    </td>
                    <!-- ASK -->
                    <td class="mv-td mv-td--right">
                      <span v-if="item.best_sell_price != null" class="mv-price mv-price--ask">{{ fmt(item.best_sell_price) }}</span>
                      <span v-else class="mv-dash">—</span>
                    </td>
                    <!-- BID -->
                    <td class="mv-td mv-td--right">
                      <span v-if="item.best_buy_price != null" class="mv-price mv-price--bid">{{ fmt(item.best_buy_price) }}</span>
                      <span v-else class="mv-dash">—</span>
                    </td>
                    <!-- Spread -->
                    <td class="mv-td mv-td--right hidden md:table-cell">
                      <span v-if="item.best_sell_price != null && item.best_buy_price != null" class="mv-spread">
                        {{ fmt(item.best_sell_price - item.best_buy_price) }}
                      </span>
                      <span v-else class="mv-dash">—</span>
                    </td>
                    <!-- Volume -->
                    <td class="mv-td mv-td--right hidden lg:table-cell">
                      <div v-if="item.volume_24h > 0" class="mv-vol">
                        <div class="mv-vol__track">
                          <div class="mv-vol__fill" :style="{ width: Math.max(5, Math.round((item.volume_24h / maxVolume) * 100)) + '%' }" />
                        </div>
                        <span class="mv-vol__num">{{ item.volume_24h.toLocaleString('ru-RU') }}</span>
                      </div>
                      <span v-else class="mv-dash">—</span>
                    </td>
                    <!-- Orders -->
                    <td class="mv-td mv-td--right hidden lg:table-cell">
                      <div class="mv-orders">
                        <span class="mv-orders__ask">{{ item.active_sell_orders }}</span>
                        <span class="mv-orders__sep">/</span>
                        <span class="mv-orders__bid">{{ item.active_buy_orders }}</span>
                      </div>
                    </td>
                    <!-- Last -->
                    <td class="mv-td mv-td--right">
                      <span v-if="item.last_trade_price != null" class="mv-last">{{ fmt(item.last_trade_price) }}</span>
                      <span v-else class="mv-dash">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="mv-table-footer">
              <span>ASK — лучшая цена продавца · BID — лучшая цена покупателя · все цены в ₽</span>
              <span>{{ sortedItems.length }} {{ sortedItems.length === 1 ? 'предмет' : 'предметов' }}</span>
            </div>
          </div>

          <!-- SIDEBAR -->
          <aside class="mv-sidebar">

            <!-- Recent trades feed -->
            <div class="surface-card mv-scard">
              <h3 class="mv-scard__title">Последние сделки</h3>
              <div v-if="recentTrades.length === 0" class="mv-scard__empty">Сделок пока нет</div>
              <div v-else class="mv-feed">
                <div
                  v-for="trade in recentTrades"
                  :key="trade.id"
                  class="mv-feed-row"
                  @click="openItem(trade.item_key)"
                >
                  <div class="mv-feed-row__icon">
                    <ItemIcon :item-key="trade.item_key" :size="20" />
                  </div>
                  <div class="mv-feed-row__info">
                    <span class="mv-feed-row__name">{{ trade.display_name || formatKey(trade.item_key) }}</span>
                    <span class="mv-feed-row__qty">×{{ trade.amount }}</span>
                  </div>
                  <div class="mv-feed-row__right">
                    <span class="mv-feed-row__price">{{ fmt(trade.unit_price) }} ₽</span>
                    <span class="mv-feed-row__time">{{ timeAgo(trade.created_at) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- How to trade -->
            <div class="surface-card mv-scard">
              <h3 class="mv-scard__title">Как торговать</h3>
              <div class="mv-steps">
                <div class="mv-step">
                  <div class="mv-step__num mv-step__num--v">1</div>
                  <p class="mv-step__text">Зайди на сервер, введи <code class="mv-code">/shop</code> — откроется GUI рынка</p>
                </div>
                <div class="mv-step">
                  <div class="mv-step__num mv-step__num--r">2</div>
                  <p class="mv-step__text"><strong class="text-rose-400">Продать</strong>: предмет в руке → «Выставить» → количество и цена</p>
                </div>
                <div class="mv-step">
                  <div class="mv-step__num mv-step__num--e">3</div>
                  <p class="mv-step__text"><strong class="text-emerald-400">Купить</strong>: кликни по предмету в GUI или размести заявку</p>
                </div>
              </div>
              <div class="mv-meta">
                <div class="mv-meta__item">
                  <span class="mv-meta__label">Комиссия</span>
                  <span class="mv-meta__val">2% (1% Premium)</span>
                </div>
                <div class="mv-meta__item">
                  <span class="mv-meta__label">Срок ордера</span>
                  <span class="mv-meta__val">30 дней</span>
                </div>
                <div class="mv-meta__item">
                  <span class="mv-meta__label">Забрать товар</span>
                  <span class="mv-meta__val">/pm pickup</span>
                </div>
              </div>
            </div>

          </aside>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ── Root ── */
.mv {
  position: relative;
  min-height: 60vh;
  padding: 1.5rem 0 3rem;
}

.mv__ambient {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse 60% 40% at 70% 10%, rgba(139,92,246,.06) 0%, transparent 60%),
    radial-gradient(ellipse 40% 30% at 10% 80%, rgba(16,185,129,.04) 0%, transparent 60%);
}

.mv__shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Hero ── */
.mv-hero {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  padding: 2rem 2rem 1.85rem;
  background:
    linear-gradient(135deg, rgba(18,24,48,.99) 0%, rgba(10,15,28,1) 55%, rgba(7,10,20,1) 100%);
  border: 1px solid rgba(139,92,246,.18);
  box-shadow: 0 0 0 1px rgba(255,255,255,.03), 0 24px 80px rgba(0,0,0,.5);
}

.mv-hero__glow {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(50px);
}
.mv-hero__glow--tl {
  top: -80px; right: -80px;
  width: 380px; height: 380px;
  background: radial-gradient(circle, rgba(139,92,246,.18) 0%, transparent 65%);
}
.mv-hero__glow--br {
  bottom: -60px; left: -20px;
  width: 260px; height: 260px;
  background: radial-gradient(circle, rgba(16,185,129,.1) 0%, transparent 65%);
}

.mv-hero__inner {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.mv-title {
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 900;
  letter-spacing: -.04em;
  color: #f1f5f9;
  margin: .3rem 0 .45rem;
  line-height: 1.05;
}
.mv-title__accent {
  background: linear-gradient(90deg, #c4b5fd, #818cf8);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.mv-subtitle {
  font-size: .8rem;
  color: rgb(100 116 139);
  margin: 0 0 1rem;
  line-height: 1.5;
}

.mv-badges {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
}

.mv-badge {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  border-radius: 999px;
  padding: .28rem .7rem;
  font-size: .71rem;
  font-weight: 700;
  letter-spacing: .05em;
  border: 1px solid;
  line-height: 1;
}
.mv-badge__icon { width: .75rem; height: .75rem; flex-shrink: 0; }
.mv-badge--emerald { color: rgb(52 211 153); background: rgba(16,185,129,.08); border-color: rgba(16,185,129,.22); }
.mv-badge--amber { color: rgb(251 191 36); background: rgba(245,158,11,.08); border-color: rgba(245,158,11,.22); }
.mv-badge--code { font-family: 'Courier New', monospace; color: rgb(148 163 184); background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.08); }

.mv-orders-btn {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .65rem 1.2rem;
  border-radius: 14px;
  background: rgba(139,92,246,.1);
  border: 1px solid rgba(139,92,246,.28);
  color: rgb(196 181 253);
  font-size: .82rem;
  font-weight: 700;
  text-decoration: none;
  transition: background .15s, border-color .15s, color .15s, transform .1s;
  flex-shrink: 0;
  white-space: nowrap;
}
.mv-orders-btn:hover {
  background: rgba(139,92,246,.2);
  border-color: rgba(139,92,246,.5);
  color: #fff;
  transform: translateY(-1px);
}

/* ── Search ── */
.mv-controls {
  display: flex;
  align-items: center;
  gap: .5rem;
  flex-wrap: wrap;
}

.mv-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 200px;
}

.mv-search__icon {
  position: absolute;
  left: .65rem;
  width: 1rem; height: 1rem;
  color: rgb(100 116 139);
  pointer-events: none;
}

.mv-search__input {
  width: 100%;
  min-height: 2.35rem;
  padding: 0 2.2rem 0 2.2rem;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(6,10,19,.7);
  color: #f8fbff;
  font: inherit;
  font-size: .875rem;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.mv-search__input::placeholder { color: rgb(100 116 139); }
.mv-search__input:focus {
  border-color: rgba(139,92,246,.34);
  box-shadow: 0 0 0 3px rgba(139,92,246,.1);
}

.mv-search__count {
  position: absolute;
  right: .55rem;
  font-size: .75rem;
  font-weight: 700;
  color: rgb(139 92 246);
  pointer-events: none;
}

.mv-select {
  min-height: 2.35rem;
  padding: 0 .7rem;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(6,10,19,.7);
  color: #f8fbff;
  font: inherit;
  font-size: .875rem;
  outline: none;
  cursor: pointer;
  transition: border-color .15s;
}
.mv-select:focus {
  border-color: rgba(139,92,246,.34);
  box-shadow: 0 0 0 3px rgba(139,92,246,.1);
}
.mv-select option { background: #0d1117; }

/* ── States ── */
.mv-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .85rem;
  padding: 5rem 0;
}
.mv-loader__label { font-size: .82rem; color: rgb(100 116 139); }

.mv-error {
  background: rgba(239,68,68,.06);
  border: 1px solid rgba(239,68,68,.2);
  border-radius: 16px;
  padding: 1.25rem;
  color: rgb(252 165 165);
  font-size: .85rem;
}

.mv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 5rem 1rem;
  text-align: center;
  border: 1px solid rgba(255,255,255,.05);
  border-radius: 20px;
  background: rgba(255,255,255,.015);
}
.mv-empty__icon {
  width: 58px; height: 58px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px;
  color: rgb(100 116 139);
}
.mv-empty__icon svg { width: 30px; height: 30px; }
.mv-empty__title { font-size: 1.05rem; font-weight: 800; color: rgb(100 116 139); margin: 0; }
.mv-empty__hint { font-size: .8rem; color: rgb(100 116 139); margin: 0; }

/* ── Layout ── */
.mv-layout {
  display: grid;
  gap: .85rem;
  align-items: start;
}
@media (min-width: 1280px) {
  .mv-layout { grid-template-columns: minmax(0, 1fr) 268px; }
}

/* ── Table card ── */
.mv-table-card {
  border-radius: 20px;
  overflow: hidden;
}

.mv-table-scroll { overflow-x: auto; }

.mv-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 540px;
}

/* Thead */
.mv-thead-row { border-bottom: 1px solid rgba(255,255,255,.06); }

.mv-th {
  padding: .7rem 1.1rem;
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
  cursor: pointer;
  user-select: none;
  transition: color .12s;
  white-space: nowrap;
  background: rgba(255,255,255,.012);
}
.mv-th--left { text-align: left; color: rgb(100 116 139); }
.mv-th--left:hover { color: rgb(148 163 184); }
.mv-th--ask { text-align: right; color: rgba(251,113,133,.55); }
.mv-th--ask:hover { color: rgb(251 113 133); }
.mv-th--bid { text-align: right; color: rgba(52,211,153,.55); }
.mv-th--bid:hover { color: rgb(52 211 153); }
.mv-th--vol { text-align: right; color: rgb(100 116 139); }
.mv-th--vol:hover { color: rgb(148 163 184); }
.mv-th--muted { text-align: right; color: rgb(100 116 139); cursor: default; }
.mv-th--orders { text-align: right; color: rgb(100 116 139); cursor: default; }
.mv-th--right { text-align: right; color: rgb(100 116 139); }
.mv-th--right:hover { color: rgb(148 163 184); }

.mv-sort { opacity: .45; font-size: .68rem; margin-left: .2rem; }

/* Rows */
.mv-row {
  border-bottom: 1px solid rgba(255,255,255,.03);
  cursor: pointer;
  transition: background .1s;
  position: relative;
}
.mv-row:last-child { border-bottom: none; }
.mv-row:hover { background: rgba(139,92,246,.05); }
.mv-row:hover .mv-item__name { color: #f1f5f9; }

/* TD */
.mv-td {
  padding: .65rem 1.1rem;
  vertical-align: middle;
}
.mv-td--right { text-align: right; }
.mv-td--item { min-width: 200px; }

/* Item cell */
.mv-item { display: flex; align-items: center; gap: .65rem; }

.mv-item__icon {
  flex-shrink: 0;
  width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.035);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 10px;
  transition: border-color .12s;
}
.mv-row:hover .mv-item__icon { border-color: rgba(139,92,246,.3); }

.mv-item__body {
  display: flex;
  flex-direction: column;
  gap: .1rem;
  min-width: 0;
}
.mv-item__name {
  font-size: .82rem;
  font-weight: 700;
  color: rgb(203 213 225);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color .12s;
  display: flex;
  align-items: center;
  gap: .35rem;
}
.mv-item__key {
  font-size: .67rem;
  font-family: 'Courier New', monospace;
  color: rgb(100 116 139);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mv-hot {
  font-size: .58rem;
  font-weight: 900;
  letter-spacing: .1em;
  color: rgb(251 191 36);
  background: rgba(245,158,11,.12);
  border: 1px solid rgba(245,158,11,.25);
  border-radius: 4px;
  padding: .06rem .35rem;
}

/* Prices */
.mv-price {
  font-size: .82rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.mv-price--ask { color: rgb(251 113 133); }
.mv-price--bid { color: rgb(52 211 153); }
.mv-dash { color: rgb(100 116 139); font-size: .82rem; }
.mv-spread { font-size: .78rem; color: rgb(100 116 139); font-variant-numeric: tabular-nums; }
.mv-last { font-size: .82rem; font-weight: 700; color: rgb(203 213 225); font-variant-numeric: tabular-nums; }

/* Volume bar */
.mv-vol {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: .28rem;
}
.mv-vol__track {
  width: 56px; height: 3px;
  background: rgba(255,255,255,.05);
  border-radius: 999px;
  overflow: hidden;
}
.mv-vol__fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(139,92,246,.35), rgba(139,92,246,.65));
  border-radius: 999px;
  transition: width .4s ease;
}
.mv-vol__num { font-size: .73rem; color: rgb(100 116 139); font-variant-numeric: tabular-nums; }

/* Orders */
.mv-orders {
  display: flex;
  align-items: center;
  gap: .3rem;
  justify-content: flex-end;
  font-size: .78rem;
  font-variant-numeric: tabular-nums;
}
.mv-orders__ask { color: rgba(251,113,133,.75); font-weight: 600; }
.mv-orders__sep { color: rgb(100 116 139); }
.mv-orders__bid { color: rgba(52,211,153,.75); font-weight: 600; }

/* Table footer */
.mv-table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .6rem 1.1rem;
  border-top: 1px solid rgba(255,255,255,.04);
  font-size: .68rem;
  color: rgb(100 116 139);
  flex-wrap: wrap;
  gap: .35rem;
}

/* ── Sidebar ── */
.mv-sidebar { display: flex; flex-direction: column; gap: .75rem; }

.mv-scard {
  padding: 1.15rem;
  border-radius: 20px;
}

.mv-scard__title {
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .9rem;
}

.mv-scard__empty {
  font-size: .8rem;
  color: rgb(100 116 139);
  text-align: center;
  padding: 1rem 0;
}

/* Trade feed */
.mv-feed { display: flex; flex-direction: column; gap: .1rem; }

.mv-feed-row {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .5rem .5rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background .1s;
}
.mv-feed-row:hover { background: rgba(255,255,255,.03); }

.mv-feed-row__icon {
  flex-shrink: 0;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 7px;
}

.mv-feed-row__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: .08rem;
}
.mv-feed-row__name {
  font-size: .75rem;
  font-weight: 600;
  color: rgb(148 163 184);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mv-feed-row__qty { font-size: .68rem; color: rgb(100 116 139); }

.mv-feed-row__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: .08rem;
  flex-shrink: 0;
}
.mv-feed-row__price {
  font-size: .75rem;
  font-weight: 700;
  color: rgb(203 213 225);
  font-variant-numeric: tabular-nums;
}
.mv-feed-row__time { font-size: .66rem; color: rgb(100 116 139); }

/* Steps */
.mv-steps {
  display: flex;
  flex-direction: column;
  gap: .8rem;
  margin-bottom: .9rem;
}
.mv-step { display: flex; align-items: flex-start; gap: .65rem; }

.mv-step__num {
  flex-shrink: 0;
  width: 22px; height: 22px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: .72rem;
  font-weight: 900;
  border: 1px solid;
}
.mv-step__num--v { color: rgb(167 139 250); background: rgba(139,92,246,.12); border-color: rgba(139,92,246,.28); }
.mv-step__num--r { color: rgb(251 113 133); background: rgba(244,63,94,.12); border-color: rgba(244,63,94,.28); }
.mv-step__num--e { color: rgb(52 211 153); background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.28); }

.mv-step__text { font-size: .77rem; color: rgb(100 116 139); line-height: 1.5; }

/* Meta */
.mv-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
  border-top: 1px solid rgba(255,255,255,.05);
  padding-top: .7rem;
}
.mv-meta__item {
  display: flex;
  flex-direction: column;
  gap: .1rem;
  flex: 1;
  min-width: 80px;
}
.mv-meta__label {
  font-size: .63rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
}
.mv-meta__val { font-size: .76rem; font-weight: 600; color: rgb(100 116 139); }

/* Inline code */
.mv-code {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 5px;
  padding: .07rem .38rem;
  font-family: 'Courier New', monospace;
  font-size: .77rem;
  color: rgb(196 181 253);
}
</style>
