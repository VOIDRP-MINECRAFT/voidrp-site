<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gameui.css'
import { getNationMarketListings, setWebguiToken } from '../services/gameUiApi.js'
import { useWebGuiToken, runCommand, closeGui, useActionToast } from '../composables/useWebGui.js'
import GameUiNav from '../components/GameUiNav.vue'

const { t } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)
const { toast, show } = useActionToast()

const listings = ref([])
const loading = ref(false)
const error = ref(null)
const search = ref('')
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

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return listings.value
  return listings.value.filter(l =>
    (l.display_name || l.material || '').toLowerCase().includes(q) ||
    (l.nation_title || '').toLowerCase().includes(q),
  )
})

async function buyListing(l) {
  try {
    await runCommand(`/nmarket buy ${l.id} 1`)
    show(t('gameUiNationMarket.buyQueued', { item: l.display_name || l.material }), true)
    setTimeout(load, 1200)
  } catch (e) {
    show(e.message || t('gameUiNationMarket.buyFail'), false)
  }
}

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '0'
  return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
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
  <div class="gui-root">
    <header class="gui-header">
      <span class="gui-title"><span class="gui-title-icon">🏷️</span>{{ t('gameUiNationMarket.title') }}</span>
      <button class="gui-close" @click="closeGui">✕</button>
    </header>

    <GameUiNav current="nmarket" />

    <div class="gui-toolbar">
      <input v-model="search" class="gui-input" :placeholder="t('gameUiNationMarket.searchPlaceholder')" />
      <button class="gui-btn gui-btn-ghost gui-btn-sm" @click="load" :disabled="loading">↻</button>
    </div>

    <div v-if="!token" class="gui-state"><span class="gui-state-icon">🔒</span><span class="gui-state-text">{{ t('gameUiNationMarket.tokenError') }}</span></div>
    <div v-else-if="error" class="gui-state"><span class="gui-state-icon">⚠️</span><span class="gui-state-text">{{ error }}</span></div>
    <div v-else-if="loading && !listings.length" class="gui-state"><span class="gui-spinner" /><span class="gui-state-sub">{{ t('gameUiNationMarket.loading') }}</span></div>
    <div v-else-if="!filtered.length" class="gui-state"><span class="gui-state-icon">📭</span><span class="gui-state-text">{{ t('gameUiNationMarket.noListings') }}</span></div>

    <div v-else class="gui-list">
      <div v-for="l in filtered" :key="l.id" class="gui-row nm-row">
        <div class="nm-icon">
          <img v-if="iconUrl(l)" :src="iconUrl(l)" alt="" @error="$event.target.style.visibility='hidden'" />
        </div>
        <div class="nm-info">
          <span class="nm-name">{{ l.display_name || l.material }}</span>
          <span class="nm-nation"><span class="nm-tag">{{ l.nation_tag }}</span>{{ l.nation_title }}</span>
        </div>
        <div class="nm-meta">
          <span class="nm-price">{{ money(l.current_unit_price) }}</span>
          <span class="nm-stock">×{{ l.remaining_amount }}</span>
        </div>
        <button class="gui-btn gui-btn-primary gui-btn-xs" @click="buyListing(l)">
          {{ t('gameUiNationMarket.buyBtn') }}
        </button>
      </div>
    </div>

    <transition name="gui-toast">
      <div v-if="toast" class="gui-toast" :class="toast.ok ? 'gui-toast-ok' : 'gui-toast-err'">
        <span>{{ toast.ok ? '✅' : '⚠️' }}</span><span>{{ toast.text }}</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.nm-row { gap: 12px; }
.nm-icon {
  width: 38px; height: 38px;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(148, 163, 184, 0.12);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.nm-icon img { width: 28px; height: 28px; image-rendering: pixelated; }
.nm-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.nm-name { font-size: 0.88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nm-nation { display: flex; align-items: center; gap: 6px; font-size: 0.74rem; color: #6b7a9c; }
.nm-tag {
  font-size: 0.62rem; font-weight: 800;
  color: #818cf8;
  background: rgba(129, 140, 248, 0.14);
  border-radius: 5px;
  padding: 1px 5px;
}
.nm-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.nm-price { font-size: 0.86rem; font-weight: 800; color: #fcd34d; }
.nm-stock { font-size: 0.7rem; color: #6b7a9c; }
</style>
