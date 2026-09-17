<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getTraderState, getTraderTransaction, setWebguiToken, traderTrade } from '../services/gameUiApi.js'
import { useWebGuiToken } from '../composables/useWebGui.js'
import { currency, setBalance } from '../composables/useCurrency.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'
import ItemIcon from '../components/ItemIcon.vue'

// Travelling trader stall. The backend only answers when the player has just right-clicked the
// NPC at spawn (a trade session), so this page cannot be used from anywhere else.
const { t, locale } = useI18n()
const token = useWebGuiToken()
setWebguiToken(token)

const state = ref(null)
const loading = ref(true)
const errorStatus = ref(0)
const errorText = ref('')
const side = ref('buy')
const selectedId = ref(null)
const qty = ref(1)
const busy = ref(false)
const toast = ref(null)
const clockSkew = ref(0)
const nowTick = ref(Date.now())

let pollTimer = null
let clockTimer = null
let toastTimer = null

const numLocale = computed(() => ((locale.value || 'ru').startsWith('en') ? 'en-US' : 'ru-RU'))
const fmt = (v) => Number(v || 0).toLocaleString(numLocale.value, { maximumFractionDigits: 2 })

async function load(silent = false) {
  try {
    const data = await getTraderState()
    state.value = data
    errorStatus.value = 0
    clockSkew.value = new Date(data.now).getTime() - Date.now()
    if (typeof data.balance === 'number' && currency.balance == null) setBalance(data.balance)
  } catch (e) {
    if (!silent || e.status === 403 || e.status === 404) {
      errorStatus.value = e.status || 500
      errorText.value = e.message || ''
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  pollTimer = setInterval(() => load(true), 5000)
  clockTimer = setInterval(() => { nowTick.value = Date.now() }, 1000)
})
onUnmounted(() => {
  clearInterval(pollTimer)
  clearInterval(clockTimer)
  clearTimeout(toastTimer)
})

const kind = computed(() => state.value?.visit?.kind || 'normal')
const secondsLeft = computed(() => {
  if (!state.value) return 0
  const end = new Date(state.value.visit.ends_at).getTime()
  return Math.max(0, Math.floor((end - (nowTick.value + clockSkew.value)) / 1000))
})
const countdown = computed(() => {
  const s = secondsLeft.value
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})
watch(secondsLeft, (s, prev) => { if (prev > 0 && s === 0) load(true) })

const lots = computed(() => (state.value?.stock || []).filter((s) => s.side === side.value))
const counts = computed(() => {
  const all = state.value?.stock || []
  return { buy: all.filter((s) => s.side === 'buy').length, sell: all.filter((s) => s.side === 'sell').length }
})
const selected = computed(() => (state.value?.stock || []).find((s) => s.id === selectedId.value) || null)
const myLeft = computed(() => (selected.value ? Math.max(0, selected.value.my_cap - selected.value.my_used) : 0))
const maxQty = computed(() => {
  if (!selected.value) return 0
  let m = Math.min(myLeft.value, selected.value.qty_left)
  if (selected.value.side === 'sell') {
    const bal = currency.balance != null ? currency.balance : state.value?.balance || 0
    m = Math.min(m, Math.floor(bal / selected.value.unit_price))
  }
  return Math.max(0, m)
})
const total = computed(() => (selected.value ? Math.round(qty.value * selected.value.unit_price * 100) / 100 : 0))

watch(side, () => { selectedId.value = null })
watch(selectedId, () => { qty.value = Math.min(Math.max(1, maxQty.value), selected.value?.rarity === 1 ? 64 : 1) || 1 })

function pick(lot) {
  if (busy.value) return
  selectedId.value = lot.id
}
function setQty(v) {
  const n = Math.floor(Number(v) || 0)
  qty.value = Math.max(1, Math.min(n, Math.max(1, maxQty.value)))
}
function stars(r) {
  return '★'.repeat(r)
}

function showToast(kindName, text) {
  toast.value = { kind: kindName, text }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 5000)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function submit() {
  const lot = selected.value
  if (!lot || busy.value || maxQty.value < 1) return
  busy.value = true
  try {
    let tx = await traderTrade(lot.id, Math.min(qty.value, maxQty.value))
    for (let i = 0; i < 40 && tx.status === 'pending'; i++) {
      await sleep(750)
      tx = await getTraderTransaction(tx.id)
    }
    if (tx.status === 'done') {
      const sum = fmt(tx.total)
      const text = lot.side === 'buy' ? t('gameUiTrader.doneSell', { n: tx.qty_done, sum }) : t('gameUiTrader.doneBuy', { n: tx.qty_done, sum })
      showToast('ok', tx.error ? `${text}. ${tx.error}` : text)
      if (currency.balance != null || state.value) {
        const base = currency.balance != null ? currency.balance : state.value.balance
        setBalance(base + (lot.side === 'buy' ? tx.total : -tx.total))
      }
    } else if (tx.status === 'expired') {
      showToast('err', t('gameUiTrader.expired'))
    } else if (tx.status === 'pending') {
      showToast('err', t('gameUiTrader.processing'))
    } else {
      showToast('err', t('gameUiTrader.failed', { reason: tx.error || '—' }))
    }
  } catch (e) {
    showToast('err', e.message || t('gameUiTrader.failed', { reason: '—' }))
    if (e.status === 403 || e.status === 404) {
      errorStatus.value = e.status
      errorText.value = e.message
    }
  } finally {
    busy.value = false
    load(true)
  }
}

const itemName = (key) => (state.value?.stock || []).find((s) => s.item_key === key)?.display_name || key
</script>

<template>
  <section class="gp-shell tr" :class="`tr--${kind}`">
    <GameUiStarfield />
    <GameUiSidebar current="" />
    <GameUiTopBar :title="t('gameUiTrader.title')" />

    <div class="gp-wrap gp-wrap--wide gp-wrap--app">
      <div v-if="loading" class="gp-center"><span class="gp-spinner"></span></div>

      <div v-else-if="errorStatus" class="gp-center">
        <div class="gp-card tr-gate">
          <span class="tr-gate__ico"><GuiIcon :name="errorStatus === 403 ? 'market' : 'clock'" :size="34" /></span>
          <h1 class="tr-gate__title">{{ errorStatus === 403 ? t('gameUiTrader.needNpc') : errorStatus === 404 ? t('gameUiTrader.gone') : t('gameUiTrader.failed', { reason: '' }) }}</h1>
          <p class="tr-gate__text">{{ errorStatus === 403 ? t('gameUiTrader.needNpcText') : errorStatus === 404 ? t('gameUiTrader.goneText') : errorText }}</p>
        </div>
      </div>

      <template v-else-if="state">
        <header class="tr-sign">
          <div class="tr-sign__main">
            <p class="tr-sign__kind">{{ t(`gameUiTrader.kind.${kind}`) }}</p>
            <p class="tr-sign__note">{{ t(`gameUiTrader.kindNote.${kind}`) }} {{ t('gameUiTrader.shareRule', { pct: fmt(state.player_share_pct) }) }}</p>
          </div>
          <div class="tr-clock" :class="{ low: secondsLeft < 300 }" role="timer" :aria-label="t('gameUiTrader.leaves')">
            <span class="tr-clock__lbl">{{ secondsLeft > 0 ? t('gameUiTrader.leaves') : t('gameUiTrader.left') }}</span>
            <span class="tr-clock__val">{{ countdown }}</span>
          </div>
        </header>

        <div class="tr-layout">
          <div class="tr-left">
            <div class="gp-seg tr-seg" role="tablist">
              <button type="button" role="tab" class="gp-seg-btn" :class="{ active: side === 'buy' }" :aria-selected="side === 'buy'" @click="side = 'buy'">
                {{ t('gameUiTrader.tabBuy') }} <span class="count">{{ counts.buy }}</span>
              </button>
              <button type="button" role="tab" class="gp-seg-btn" :class="{ active: side === 'sell' }" :aria-selected="side === 'sell'" @click="side = 'sell'">
                {{ t('gameUiTrader.tabSell') }} <span class="count">{{ counts.sell }}</span>
              </button>
              <span class="tr-seg__hint">{{ side === 'buy' ? t('gameUiTrader.tabBuyHint') : t('gameUiTrader.tabSellHint') }}</span>
            </div>

            <div class="tr-grid" role="listbox">
              <button
                v-for="lot in lots"
                :key="lot.id"
                type="button"
                role="option"
                class="tr-slot"
                :class="[`r${lot.rarity}`, { sel: lot.id === selectedId, out: lot.qty_left <= 0, mine: lot.my_used >= lot.my_cap }]"
                :aria-selected="lot.id === selectedId"
                :title="lot.display_name"
                @click="pick(lot)"
              >
                <span class="tr-slot__stars">{{ stars(lot.rarity) }}</span>
                <ItemIcon :itemKey="lot.item_key" :size="40" />
                <span class="tr-slot__qty">{{ lot.qty_left > 0 ? fmt(lot.qty_left) : t('gameUiTrader.soldOut') }}</span>
                <span class="tr-slot__bar"><span :style="{ width: Math.round((lot.qty_left / lot.qty_total) * 100) + '%' }"></span></span>
              </button>
            </div>

            <section class="gp-panel tr-recent">
              <p class="tr-recent__title">{{ t('gameUiTrader.recent') }}</p>
              <p v-if="!state.transactions.length" class="tr-recent__empty">{{ t('gameUiTrader.noRecent') }}</p>
              <ul v-else>
                <li v-for="tx in state.transactions" :key="tx.id" :class="tx.status">
                  <ItemIcon :itemKey="tx.item_key" :size="22" />
                  <span class="tr-recent__name">{{ itemName(tx.item_key) }}</span>
                  <span class="tr-recent__qty">{{ tx.status === 'done' ? tx.qty_done : tx.qty_requested }} ×</span>
                  <span class="tr-recent__sum" :class="tx.side">{{ tx.status === 'done' ? (tx.side === 'buy' ? '+' : '−') + fmt(tx.total) : t(`gameUiTrader.status.${tx.status}`) }}</span>
                </li>
              </ul>
            </section>
          </div>

          <aside class="gp-panel tr-panel" :class="selected ? `r${selected.rarity}` : ''">
            <div v-if="!selected" class="tr-panel__empty">
              <GuiIcon name="market" :size="28" />
              <p>{{ t('gameUiTrader.pick') }}</p>
            </div>
            <template v-else>
              <div class="tr-panel__head">
                <span class="tr-panel__icon"><ItemIcon :itemKey="selected.item_key" :size="56" /></span>
                <div>
                  <p class="tr-panel__rar">{{ stars(selected.rarity) }} {{ t(`gameUiTrader.rarity.${selected.rarity}`) }}</p>
                  <h2 class="tr-panel__name">{{ selected.display_name }}</h2>
                </div>
              </div>

              <dl class="tr-facts">
                <div><dt>{{ t('gameUiTrader.pricePer') }}</dt><dd>{{ fmt(selected.unit_price) }} {{ t('gameUiTrader.coins') }}</dd></div>
                <div><dt>{{ t('gameUiTrader.lot') }}</dt><dd>{{ fmt(selected.qty_left) }} / {{ fmt(selected.qty_total) }}</dd></div>
                <div><dt>{{ t('gameUiTrader.myLimit') }}</dt><dd>{{ fmt(myLeft) }}</dd></div>
              </dl>

              <p v-if="myLeft <= 0" class="tr-warn">{{ t('gameUiTrader.limitReached') }}</p>
              <p v-else-if="selected.qty_left <= 0" class="tr-warn">{{ t('gameUiTrader.soldOut') }}</p>

              <template v-else>
                <label class="tr-qty">
                  <span>{{ t('gameUiTrader.qty') }}</span>
                  <span class="tr-qty__row">
                    <button type="button" class="gp-btn gp-btn--ghost gp-btn--sm" :disabled="busy || qty <= 1" @click="setQty(qty - 1)">−</button>
                    <input class="gp-input tr-qty__input" type="number" min="1" :max="maxQty" :value="qty" :disabled="busy" @input="setQty($event.target.value)" />
                    <button type="button" class="gp-btn gp-btn--ghost gp-btn--sm" :disabled="busy || qty >= maxQty" @click="setQty(qty + 1)">+</button>
                  </span>
                  <span class="tr-qty__presets">
                    <button v-for="n in [16, 64, 256]" :key="n" type="button" class="gp-btn gp-btn--ghost gp-btn--sm" :disabled="busy || maxQty < 1" @click="setQty(n)">{{ n }}</button>
                    <button type="button" class="gp-btn gp-btn--ghost gp-btn--sm" :disabled="busy || maxQty < 1" @click="setQty(maxQty)">{{ t('gameUiTrader.max') }} {{ fmt(maxQty) }}</button>
                  </span>
                </label>

                <p class="tr-total">{{ t('gameUiTrader.total') }} <b :class="selected.side">{{ selected.side === 'buy' ? '+' : '−' }}{{ fmt(total) }}</b> {{ t('gameUiTrader.coins') }}</p>

                <button type="button" class="gp-btn gp-btn--primary gp-btn--full tr-go" :disabled="busy || maxQty < 1 || secondsLeft <= 0" @click="submit">
                  <span v-if="busy" class="gp-spinner tr-go__spin"></span>
                  {{ busy ? t('gameUiTrader.processing') : selected.side === 'buy' ? t('gameUiTrader.sellBtn', { sum: fmt(total) }) : t('gameUiTrader.buyBtn', { sum: fmt(total) }) }}
                </button>
                <p class="tr-note">{{ selected.side === 'buy' ? t('gameUiTrader.cleanNote') : t('gameUiTrader.buyNote') }}</p>
              </template>
            </template>
          </aside>
        </div>
      </template>
    </div>

    <Transition name="gp-toast">
      <div v-if="toast" class="gp-toast" :class="toast.kind === 'ok' ? 'gp-toast--ok' : 'gp-toast--err'" role="status">{{ toast.text }}</div>
    </Transition>
  </section>
</template>

<style scoped>
.tr { --tr-accent: #fbbf24; --tr-accent-rgb: 251, 191, 36; }
.tr--weekend { --tr-accent: #fb923c; --tr-accent-rgb: 251, 146, 60; }
.tr--elite { --tr-accent: #e879f9; --tr-accent-rgb: 232, 121, 249; }

/* Sign over the stall: which trader and how long he stays. */
.tr-sign {
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  margin-bottom: 16px; padding: 18px 22px; border-radius: var(--gp-r-xl);
  border: 1px solid rgba(var(--tr-accent-rgb), 0.35);
  background: linear-gradient(115deg, rgba(var(--tr-accent-rgb), 0.16), rgba(var(--tr-accent-rgb), 0.03) 55%, rgba(0, 0, 0, 0.2));
}
.tr-sign__kind { margin: 0; font-size: 1.7rem; font-weight: 900; letter-spacing: -0.02em; color: var(--tr-accent); }
.tr-sign__note { margin: 4px 0 0; max-width: 64ch; font-size: 0.86rem; line-height: 1.5; color: var(--gp-ink-soft); }
.tr-clock { display: flex; flex-direction: column; align-items: flex-end; flex: none; }
.tr-clock__lbl { font-size: 0.72rem; font-weight: 700; color: var(--gp-ink-dim); }
.tr-clock__val { font-family: 'JetBrains Mono', monospace; font-size: 2.2rem; font-weight: 700; line-height: 1; color: var(--gp-ink); font-variant-numeric: tabular-nums; }
.tr-clock.low .tr-clock__val { color: var(--gp-red); }

.tr-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
.tr-left { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

.tr-seg { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tr-seg__hint { margin-left: 8px; font-size: 0.8rem; color: var(--gp-ink-dim); }

/* The stall: nine columns like a chest. */
.tr-grid { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 8px; }
.tr-slot {
  --rar: 148, 163, 184;
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  aspect-ratio: 1 / 1.12; padding: 8px 4px 10px; border-radius: 12px; cursor: pointer;
  border: 1px solid rgba(var(--rar), 0.28);
  background: radial-gradient(circle at 50% 38%, rgba(var(--rar), 0.14), rgba(8, 10, 20, 0.85) 70%);
  color: var(--gp-ink); font: inherit;
  transition: transform 0.1s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.tr-slot.r2 { --rar: 96, 165, 250; }
.tr-slot.r3 { --rar: 251, 191, 36; box-shadow: 0 0 18px -6px rgba(251, 191, 36, 0.55); }
.tr-slot:hover { border-color: rgba(var(--rar), 0.6); transform: translateY(-1px); }
.tr-slot.sel { border-color: var(--tr-accent); box-shadow: 0 0 0 2px rgba(var(--tr-accent-rgb), 0.45); }
.tr-slot.out, .tr-slot.mine { opacity: 0.42; }
.tr-slot:focus-visible { outline: 2px solid var(--tr-accent); outline-offset: 2px; }
.tr-slot__stars { position: absolute; top: 4px; left: 6px; font-size: 0.6rem; letter-spacing: -0.05em; color: rgb(var(--rar)); }
.tr-slot__qty { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; font-weight: 700; color: var(--gp-ink-soft); white-space: nowrap; }
.tr-slot__bar { position: absolute; left: 8px; right: 8px; bottom: 5px; height: 3px; border-radius: 3px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.tr-slot__bar span { display: block; height: 100%; background: rgb(var(--rar)); }

.tr-recent { padding: 14px 16px; }
.tr-recent__title { margin: 0 0 8px; font-size: 0.82rem; font-weight: 800; color: var(--gp-ink-soft); }
.tr-recent__empty { margin: 0; font-size: 0.82rem; color: var(--gp-ink-dim); }
.tr-recent ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.tr-recent li { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; }
.tr-recent li.failed, .tr-recent li.expired { opacity: 0.6; }
.tr-recent__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tr-recent__qty { color: var(--gp-ink-dim); font-variant-numeric: tabular-nums; }
.tr-recent__sum { font-weight: 800; font-variant-numeric: tabular-nums; }
.tr-recent__sum.buy { color: var(--gp-green); }
.tr-recent__sum.sell { color: var(--gp-red); }

/* Selected lot. */
.tr-panel { position: sticky; top: 12px; padding: 18px; border-top: 3px solid var(--tr-accent); }
.tr-panel.r3 { border-top-color: #fbbf24; }
.tr-panel__empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 10px; text-align: center; color: var(--gp-ink-dim); }
.tr-panel__empty p { margin: 0; font-size: 0.86rem; }
.tr-panel__head { display: flex; gap: 12px; align-items: center; }
.tr-panel__icon { display: grid; place-items: center; width: 72px; height: 72px; flex: none; border-radius: 14px; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--gp-line); }
.tr-panel__rar { margin: 0; font-size: 0.74rem; font-weight: 800; color: var(--tr-accent); }
.tr-panel.r2 .tr-panel__rar { color: #60a5fa; }
.tr-panel.r3 .tr-panel__rar { color: #fbbf24; }
.tr-panel__name { margin: 2px 0 0; font-size: 1.1rem; font-weight: 800; line-height: 1.25; }

.tr-facts { margin: 14px 0 0; display: grid; gap: 6px; }
.tr-facts div { display: flex; justify-content: space-between; gap: 10px; font-size: 0.84rem; }
.tr-facts dt { color: var(--gp-ink-dim); }
.tr-facts dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }

.tr-warn { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 0.84rem; color: var(--gp-red); background: rgba(251, 113, 133, 0.08); border: 1px solid rgba(251, 113, 133, 0.25); }

.tr-qty { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; font-size: 0.8rem; font-weight: 700; color: var(--gp-ink-dim); }
.tr-qty__row { display: flex; gap: 6px; }
.tr-qty__input { text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; }
.tr-qty__presets { display: flex; flex-wrap: wrap; gap: 6px; }

.tr-total { margin: 14px 0 10px; font-size: 0.9rem; color: var(--gp-ink-soft); }
.tr-total b { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.tr-total b.buy { color: var(--gp-green); }
.tr-total b.sell { color: var(--gp-red); }
.tr-go { padding: 13px 16px; font-size: 0.95rem; }
.tr-go__spin { width: 16px; height: 16px; }
.tr-note { margin: 10px 0 0; font-size: 0.76rem; line-height: 1.5; color: var(--gp-ink-dim); }

.tr-gate { max-width: 460px; padding: 28px; text-align: center; }
.tr-gate__ico { display: inline-grid; place-items: center; width: 64px; height: 64px; border-radius: 18px; color: #fbbf24; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); }
.tr-gate__title { margin: 14px 0 6px; font-size: 1.3rem; font-weight: 900; }
.tr-gate__text { margin: 0; font-size: 0.9rem; line-height: 1.55; color: var(--gp-ink-soft); }

@media (max-width: 1100px) {
  .tr-layout { grid-template-columns: minmax(0, 1fr); }
  .tr-panel { position: static; }
  .tr-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .tr-slot { transition: none; }
}
</style>
