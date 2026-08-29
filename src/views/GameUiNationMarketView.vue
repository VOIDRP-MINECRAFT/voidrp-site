<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getNationMarketListings, setWebguiToken, runGameCommand } from '../services/gameUiApi.js'
import { useWebGuiToken, useActionToast } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)
const { toast, show } = useActionToast()

const listings = ref([])
const loading = ref(false)
const error = ref(null)
const search = ref('')
const nationFilter = ref('')
const sort = ref('price-asc')
let pollTimer = null

async function load() {
  loading.value = true
  try {
    const res = await getNationMarketListings({ limit: 200 })
    listings.value = res?.items ?? []
    error.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(() => { load(); pollTimer = setInterval(load, 15_000) })
onUnmounted(() => clearInterval(pollTimer))

const nations = computed(() => {
  const map = new Map()
  for (const l of listings.value) {
    if (!l.nation_slug && !l.nation_title) continue
    const key = l.nation_slug || l.nation_title
    if (!map.has(key)) map.set(key, { key, tag: l.nation_tag, title: l.nation_title, count: 0 })
    map.get(key).count++
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  let arr = listings.value.filter(l => {
    if (nationFilter.value && (l.nation_slug || l.nation_title) !== nationFilter.value) return false
    if (!q) return true
    return (l.display_name || l.material || '').toLowerCase().includes(q) || (l.nation_title || '').toLowerCase().includes(q)
  })
  const dir = sort.value.endsWith('asc') ? 1 : -1
  arr = [...arr].sort((a, b) => (Number(a.current_unit_price) - Number(b.current_unit_price)) * dir)
  return arr
})

// Visual rarity derived from the item's PRICE tier within the current listing set
// (cheapest → common, priciest → legendary). No fabricated data — just price rank.
const RARS = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const RAR_LABELS = { common: 'Обычный', uncommon: 'Необычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный' }
const rankedItems = computed(() => {
  const arr = filtered.value
  const sorted = arr.map(x => Number(x.current_unit_price)).sort((a, b) => a - b)
  const n = sorted.length
  return arr.map(l => {
    const idx = sorted.indexOf(Number(l.current_unit_price))
    const pct = n <= 1 ? 0 : idx / (n - 1)
    return { ...l, _rar: RARS[Math.min(4, Math.floor(pct * 4.999))] }
  })
})

// Hover tooltip
const tip = ref(null)
function tipEnter(l, e) { tip.value = { l, x: e.clientX, y: e.clientY } }
function tipMove(e) { if (tip.value) { tip.value.x = e.clientX; tip.value.y = e.clientY } }
function tipLeave() { tip.value = null }
const tipStyle = computed(() => {
  if (!tip.value) return {}
  const x = Math.min(tip.value.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1920) - 260)
  return { left: x + 'px', top: (tip.value.y + 16) + 'px' }
})

async function buyListing(l) {
  try {
    await runGameCommand(`nmarket buy ${l.id} 1`)
    show(t('gameUiNationMarket.buyQueued', { item: l.display_name || l.material }), true)
    setTimeout(load, 2500)
  } catch (e) {
    show(e.message || t('gameUiNationMarket.buyFail'), false)
  }
}

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '0'
  return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}
function iconUrl(l) {
  if (!l.material) return null
  const id = String(l.material).toLowerCase()
  const ns = id.includes(':') ? id.split(':')[0] : 'minecraft'
  const item = id.includes(':') ? id.split(':')[1] : id
  return `/item-icons/${ns}/${item}.png`
}
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="nmarket" />
    <GameUiTopBar :title="t('gameUiNav.nmarket')" />

    <div class="gp-wrap gp-wrap--wide gp-wrap--app">
      <div v-if="!token" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="lock" :size="30" /></span><span class="gp-state-text">{{ t('gameUiNationMarket.tokenError') }}</span></div></div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <div v-else class="mdash gp-grow">
        <!-- filters -->
        <div class="gp-panel filt">
          <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="filter" :size="15" /></span><span class="gp-phead-tt">{{ t('gameUiNationMarket.nations') }}</span></div>
          <div class="gp-side">
            <button class="gp-side-item" :class="{ active: !nationFilter }" @click="nationFilter = ''">
              <GuiIcon name="globe" :size="16" class="c-ico" />{{ t('gameUiNationMarket.allNations') }}<span class="c-count">{{ listings.length }}</span>
            </button>
            <button v-for="n in nations" :key="n.key" class="gp-side-item" :class="{ active: nationFilter === n.key }" @click="nationFilter = n.key">
              <span class="nf-tag">{{ n.tag }}</span>{{ n.title }}<span class="c-count">{{ n.count }}</span>
            </button>
          </div>
        </div>

        <!-- grid -->
        <div class="gp-panel">
          <div class="toolbar">
            <div class="search-wrap">
              <GuiIcon name="search" :size="16" class="search-ic" />
              <input v-model="search" class="gp-input search-in" :placeholder="t('gameUiNationMarket.searchPlaceholder')" />
            </div>
            <div class="gp-seg">
              <button class="gp-seg-btn" :class="{ active: sort==='price-asc' }" @click="sort='price-asc'">{{ t('gameUiNationMarket.cheapFirst') }}</button>
              <button class="gp-seg-btn" :class="{ active: sort==='price-desc' }" @click="sort='price-desc'">{{ t('gameUiNationMarket.expFirst') }}</button>
            </div>
            <button class="gp-btn gp-btn--ghost gp-btn--sm" :disabled="loading" @click="load"><GuiIcon name="refresh" :size="15" /></button>
          </div>

          <div v-if="loading && !listings.length" class="gp-state"><span class="gp-spinner"></span><span class="gp-sub">{{ t('gameUiNationMarket.loading') }}</span></div>
          <div v-else-if="!filtered.length" class="gp-state" style="padding:44px"><span class="gp-state-ico"><GuiIcon name="inbox" :size="30" /></span><span class="gp-state-text">{{ t('gameUiNationMarket.noListings') }}</span></div>

          <div v-else class="igrid gp-scroll gp-stagger">
            <div v-for="l in rankedItems" :key="l.id" class="gp-item" :class="'rar-' + l._rar"
                 @click="buyListing(l)" @mouseenter="tipEnter(l, $event)" @mousemove="tipMove" @mouseleave="tipLeave">
              <div class="gp-item-thumb">
                <span class="gp-item-qty">×{{ l.remaining_amount }}</span>
                <img v-if="iconUrl(l)" :src="iconUrl(l)" alt="" @error="$event.target.style.visibility='hidden'" />
              </div>
              <div class="gp-item-name">{{ l.display_name || l.material }}</div>
              <div class="gp-item-sub"><span class="i-tag">{{ l.nation_tag }}</span>{{ l.nation_title }}</div>
              <div class="i-foot">
                <span class="gp-item-price"><GuiIcon name="coins" :size="14" />{{ money(l.current_unit_price) }}</span>
                <span class="i-buy"><GuiIcon name="market" :size="14" />{{ t('gameUiNationMarket.buyBtn') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- item hover tooltip -->
    <div v-if="tip" class="gp-tip" :class="'rar-' + tip.l._rar" :style="tipStyle">
      <div class="gp-tip-name">{{ tip.l.display_name || tip.l.material }}</div>
      <div class="gp-tip-rar">{{ RAR_LABELS[tip.l._rar] }}</div>
      <div class="gp-tip-sep"></div>
      <div class="gp-tip-row"><span class="k">{{ t('gameUiNationMarket.nations') }}</span><span class="v">{{ tip.l.nation_tag }}</span></div>
      <div class="gp-tip-row"><span class="k">{{ t('gameUiNationMarket.qty') }}</span><span class="v">×{{ tip.l.remaining_amount }}</span></div>
      <div class="gp-tip-row"><span class="k">{{ t('gameUiNationMarket.price') }}</span><span class="v" style="color:#fcd77a">{{ money(tip.l.current_unit_price) }}</span></div>
    </div>

    <transition name="gp-toast">
      <div v-if="toast" class="gp-toast" :class="toast.ok ? 'gp-toast--ok' : 'gp-toast--err'">
        <GuiIcon :name="toast.ok ? 'check' : 'alert'" :size="16" /><span>{{ toast.text }}</span>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.mdash { display: grid; grid-template-columns: 232px minmax(0,1fr); gap: 16px; align-items: start; }
@media (max-width: 820px) { .mdash { grid-template-columns: 1fr; } }
.filt { position: sticky; top: 74px; }
.igrid { max-height: 460px; overflow-y: auto; align-content: start; padding-right: 4px; }
.nf-tag { width: 26px; height: 20px; flex-shrink: 0; display: grid; place-items: center; border-radius: 6px; font-size: 0.52rem; font-weight: 800; color: #c9beff; background: rgba(139,123,255,0.16); }

.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.search-wrap { position: relative; flex: 1; min-width: 180px; }
.search-ic { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--gp-ink-dim); pointer-events: none; }
.search-in { padding-left: 36px; }

.igrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.i-foot { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.i-tag { font-size: 0.54rem; font-weight: 800; color: #c9beff; background: rgba(139,123,255,0.16); border-radius: 5px; padding: 1px 5px; margin-right: 5px; }
.gp-item-sub { color: var(--gp-ink-dim); display: flex; align-items: center; }
.i-buy { display: none; align-items: center; gap: 4px; font-size: 0.66rem; font-weight: 800; color: #d7cffb; }
.gp-item:hover .i-buy { display: inline-flex; }
.gp-item:hover .gp-item-price { display: none; }
</style>
