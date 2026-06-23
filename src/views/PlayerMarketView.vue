<template>
  <div class="min-h-screen bg-base-100">
    <div class="max-w-7xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-bold text-base-content">Рынок игроков</h1>
          <p class="text-base-content/60 mt-1">Торговля между игроками · Любые предметы · Живая экономика</p>
        </div>
        <div class="flex gap-2">
          <RouterLink
            v-if="isAuthenticated"
            to="/player-market/me/orders"
            class="btn btn-outline btn-sm"
          >
            Мои ордера
          </RouterLink>
          <div class="badge badge-outline badge-lg self-center">Ордера размещаются через <code class="ml-1">/pm</code></div>
        </div>
      </div>

      <!-- Search -->
      <div class="mb-6">
        <input
          v-model="search"
          type="text"
          placeholder="Поиск предмета (например, minecraft:diamond)"
          class="input input-bordered w-full max-w-xl"
        />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-20">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="alert alert-error">
        <span>{{ error }}</span>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredItems.length === 0" class="text-center py-20 text-base-content/40">
        <div class="text-5xl mb-4">📦</div>
        <p class="text-lg">{{ search ? 'Нет предметов по запросу' : 'Ещё нет активных ордеров' }}</p>
        <p class="text-sm mt-2">Разместите первый ордер командой <code>/pm sell</code> или <code>/pm buy</code> в игре</p>
      </div>

      <!-- Items table -->
      <div v-else class="overflow-x-auto rounded-xl border border-base-300">
        <table class="table table-zebra w-full">
          <thead>
            <tr class="bg-base-200">
              <th class="cursor-pointer" @click="setSort('item_key')">
                Предмет <span class="text-xs opacity-50">{{ sortIcon('item_key') }}</span>
              </th>
              <th class="cursor-pointer text-right" @click="setSort('best_sell_price')">
                Лучшая цена продажи <span class="text-xs opacity-50">{{ sortIcon('best_sell_price') }}</span>
              </th>
              <th class="cursor-pointer text-right" @click="setSort('best_buy_price')">
                Лучшая цена покупки <span class="text-xs opacity-50">{{ sortIcon('best_buy_price') }}</span>
              </th>
              <th class="text-right">Спред</th>
              <th class="cursor-pointer text-right" @click="setSort('volume_24h')">
                Объём 24ч <span class="text-xs opacity-50">{{ sortIcon('volume_24h') }}</span>
              </th>
              <th class="text-right">Ордера</th>
              <th class="cursor-pointer text-right" @click="setSort('last_trade_price')">
                Последняя цена <span class="text-xs opacity-50">{{ sortIcon('last_trade_price') }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in sortedItems"
              :key="item.item_key"
              class="hover:bg-base-200 cursor-pointer transition-colors"
              @click="$router.push({ name: 'player-market-item', params: { itemKey: item.item_key } })"
            >
              <td>
                <div class="flex items-center gap-3">
                  <ItemIcon :item-key="item.item_key" :size="32" />
                  <div>
                    <div class="font-medium text-sm">{{ item.display_name || formatKey(item.item_key) }}</div>
                    <div class="text-xs text-base-content/40 font-mono">{{ item.item_key }}</div>
                  </div>
                </div>
              </td>
              <td class="text-right">
                <span v-if="item.best_sell_price != null" class="text-rose-400 font-medium">
                  {{ fmt(item.best_sell_price) }} ₽
                </span>
                <span v-else class="text-base-content/30">—</span>
              </td>
              <td class="text-right">
                <span v-if="item.best_buy_price != null" class="text-emerald-400 font-medium">
                  {{ fmt(item.best_buy_price) }} ₽
                </span>
                <span v-else class="text-base-content/30">—</span>
              </td>
              <td class="text-right text-base-content/60 text-sm">
                <span v-if="item.best_sell_price != null && item.best_buy_price != null">
                  {{ fmt(item.best_sell_price - item.best_buy_price) }} ₽
                </span>
                <span v-else>—</span>
              </td>
              <td class="text-right text-sm">
                <span v-if="item.volume_24h > 0" class="text-base-content/80">{{ item.volume_24h.toLocaleString() }}</span>
                <span v-else class="text-base-content/30">—</span>
              </td>
              <td class="text-right text-sm">
                <span class="text-rose-400/80">{{ item.active_sell_orders }}↑</span>
                <span class="text-base-content/30 mx-1">/</span>
                <span class="text-emerald-400/80">{{ item.active_buy_orders }}↓</span>
              </td>
              <td class="text-right text-sm font-mono">
                <span v-if="item.last_trade_price != null">{{ fmt(item.last_trade_price) }} ₽</span>
                <span v-else class="text-base-content/30">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Recent trades sidebar below -->
      <div class="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card bg-base-200 rounded-xl p-4">
          <h3 class="font-semibold mb-3 text-base-content/80">Последние сделки</h3>
          <div v-if="recentTrades.length === 0" class="text-sm text-base-content/40 py-4 text-center">Сделок пока нет</div>
          <div v-else class="space-y-2">
            <div
              v-for="trade in recentTrades"
              :key="trade.id"
              class="flex items-center justify-between text-sm py-1 border-b border-base-300 last:border-0"
            >
              <div class="flex items-center gap-2 min-w-0">
                <ItemIcon :item-key="trade.item_key" :size="20" />
                <span class="truncate text-base-content/70">{{ trade.display_name || formatKey(trade.item_key) }}</span>
                <span class="text-base-content/40 text-xs">×{{ trade.amount }}</span>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span class="font-medium">{{ fmt(trade.unit_price) }} ₽</span>
                <span class="text-base-content/40 text-xs">{{ timeAgo(trade.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-200 rounded-xl p-4">
          <h3 class="font-semibold mb-3 text-base-content/80">Как разместить ордер</h3>
          <div class="space-y-3 text-sm text-base-content/70">
            <div class="bg-base-300 rounded-lg p-3">
              <div class="font-mono text-base-content mb-1">/pm sell &lt;количество&gt; &lt;цена&gt;</div>
              <div class="text-xs">Держите предмет в руке. Предметы сразу изымаются из инвентаря.</div>
            </div>
            <div class="bg-base-300 rounded-lg p-3">
              <div class="font-mono text-base-content mb-1">/pm buy &lt;item_key&gt; &lt;количество&gt; &lt;цена&gt;</div>
              <div class="text-xs">Деньги резервируются. Предметы придут автоматически при совпадении.</div>
            </div>
            <div class="bg-base-300 rounded-lg p-3">
              <div class="font-mono text-base-content mb-1">/pm cancel sell &lt;id&gt;</div>
              <div class="font-mono text-base-content mb-1">/pm cancel buy &lt;id&gt;</div>
              <div class="text-xs">Отмена ордера. Предметы/деньги возвращаются при входе в игру.</div>
            </div>
            <div class="text-xs text-base-content/50">
              Комиссия системы: 2% от суммы сделки. Ордера действуют 30 дней.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { getIsAuthenticated } from '../stores/authStore'
import { getPlayerMarketItems, getPlayerMarketTrades } from '../services/marketApi'
import ItemIcon from '../components/ItemIcon.vue'

const items = ref([])
const recentTrades = ref([])
const loading = ref(true)
const error = ref(null)
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
  if (!search.value.trim()) return items.value
  const q = search.value.trim().toLowerCase()
  return items.value.filter(
    (i) =>
      i.item_key.includes(q) ||
      (i.display_name && i.display_name.toLowerCase().includes(q))
  )
})

const sortedItems = computed(() => {
  const arr = [...filteredItems.value]
  arr.sort((a, b) => {
    let va = a[sortBy.value] ?? -Infinity
    let vb = b[sortBy.value] ?? -Infinity
    if (typeof va === 'string') return sortDir.value === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    return sortDir.value === 'asc' ? va - vb : vb - va
  })
  return arr
})

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
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return `${Math.floor(diff / 86400)} д назад`
}
</script>
