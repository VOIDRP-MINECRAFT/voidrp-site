<template>
  <div class="min-h-screen bg-base-100">
    <div class="max-w-7xl mx-auto px-4 py-8">
      <!-- Back link -->
      <RouterLink to="/player-market" class="btn btn-ghost btn-sm mb-6 gap-2">
        ← Рынок игроков
      </RouterLink>

      <!-- Header -->
      <div v-if="!loading" class="flex items-center gap-4 mb-6">
        <ItemIcon :item-key="itemKey" :size="48" />
        <div>
          <h1 class="text-2xl font-bold">{{ displayName || formatKey(itemKey) }}</h1>
          <div class="font-mono text-sm text-base-content/40">{{ itemKey }}</div>
        </div>
        <div class="ml-auto flex flex-col items-end gap-1">
          <div v-if="orderBook?.last_trade_price != null" class="text-2xl font-bold">
            {{ fmt(orderBook.last_trade_price) }} ₽
          </div>
          <div v-if="orderBook?.spread != null" class="text-sm text-base-content/50">
            Спред: {{ fmt(orderBook.spread) }} ₽
          </div>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-20">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <div v-else class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <!-- Order book (2/3 width) -->
        <div class="xl:col-span-2 space-y-4">
          <!-- Sells / Buys split -->
          <div class="grid grid-cols-2 gap-4">
            <!-- Sell orders (ASK) -->
            <div class="card bg-base-200 rounded-xl p-4">
              <h3 class="font-semibold mb-3 text-rose-400 flex justify-between">
                <span>Продажи (ASK)</span>
                <span class="text-xs text-base-content/40 font-normal">Цена · Кол-во</span>
              </h3>
              <div v-if="orderBook?.sell_side?.length === 0" class="text-sm text-base-content/40 py-4 text-center">
                Нет предложений
              </div>
              <div v-else class="space-y-0.5">
                <div
                  v-for="(row, i) in orderBook?.sell_side || []"
                  :key="i"
                  class="flex justify-between text-sm py-1 border-b border-base-300/50 last:border-0"
                  :class="i === 0 ? 'text-rose-300 font-semibold' : 'text-rose-400/70'"
                >
                  <span>{{ fmt(row.unit_price) }} ₽</span>
                  <span class="text-base-content/60">
                    {{ row.total_amount.toLocaleString() }}
                    <span class="text-xs opacity-50 ml-1">({{ row.order_count }})</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Buy orders (BID) -->
            <div class="card bg-base-200 rounded-xl p-4">
              <h3 class="font-semibold mb-3 text-emerald-400 flex justify-between">
                <span>Покупки (BID)</span>
                <span class="text-xs text-base-content/40 font-normal">Цена · Кол-во</span>
              </h3>
              <div v-if="orderBook?.buy_side?.length === 0" class="text-sm text-base-content/40 py-4 text-center">
                Нет заявок
              </div>
              <div v-else class="space-y-0.5">
                <div
                  v-for="(row, i) in orderBook?.buy_side || []"
                  :key="i"
                  class="flex justify-between text-sm py-1 border-b border-base-300/50 last:border-0"
                  :class="i === 0 ? 'text-emerald-300 font-semibold' : 'text-emerald-400/70'"
                >
                  <span>{{ fmt(row.unit_price) }} ₽</span>
                  <span class="text-base-content/60">
                    {{ row.total_amount.toLocaleString() }}
                    <span class="text-xs opacity-50 ml-1">({{ row.order_count }})</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Instructions -->
          <div class="alert bg-base-200 text-sm text-base-content/60">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Для размещения ордера используй команду в игре:
            <code class="ml-1 bg-base-300 px-1 rounded">/pm sell &lt;кол-во&gt; &lt;цена&gt;</code> или
            <code class="ml-1 bg-base-300 px-1 rounded">/pm buy {{ itemKey }} &lt;кол-во&gt; &lt;цена&gt;</code>
          </div>
        </div>

        <!-- Recent trades (1/3 width) -->
        <div class="card bg-base-200 rounded-xl p-4">
          <h3 class="font-semibold mb-3 text-base-content/80">История сделок</h3>
          <div v-if="trades.length === 0" class="text-sm text-base-content/40 py-4 text-center">
            Сделок пока нет
          </div>
          <div v-else class="space-y-1">
            <div
              v-for="trade in trades"
              :key="trade.id"
              class="text-sm py-1.5 border-b border-base-300/50 last:border-0"
            >
              <div class="flex justify-between">
                <span class="font-medium">{{ fmt(trade.unit_price) }} ₽</span>
                <span class="text-base-content/50 text-xs">{{ timeAgo(trade.created_at) }}</span>
              </div>
              <div class="text-xs text-base-content/50 flex justify-between mt-0.5">
                <span>×{{ trade.amount }} · {{ trade.seller_player_name }} → {{ trade.buyer_player_name }}</span>
                <span>={{ fmt(trade.gross_total) }} ₽</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { getPlayerMarketOrderBook, getPlayerMarketTrades } from '../services/marketApi'
import ItemIcon from '../components/ItemIcon.vue'

const route = useRoute()
const itemKey = computed(() => route.params.itemKey)

const orderBook = ref(null)
const trades = ref([])
const loading = ref(true)

const displayName = computed(() => {
  if (!trades.value.length) return null
  return trades.value[0]?.display_name || null
})

onMounted(async () => {
  try {
    const [book, tradesRes] = await Promise.all([
      getPlayerMarketOrderBook(itemKey.value),
      getPlayerMarketTrades({ item_key: itemKey.value, limit: 50 }),
    ])
    orderBook.value = book
    trades.value = tradesRes.items || []
  } catch (e) {
    // show empty state
  } finally {
    loading.value = false
  }
})

function fmt(val) {
  if (val == null) return '—'
  return Number(val).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatKey(key) {
  if (!key) return key
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
