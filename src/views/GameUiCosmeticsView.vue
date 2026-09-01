<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getCosmetics, promoteCosmetic, buyCosmetic, equipCosmetic, unequipCosmetic, deleteCosmetic, setWebguiToken } from '../services/gameUiApi.js'
import { toastSuccess, toastError } from '../services/toast'
import { useWebGuiToken } from '../composables/useWebGui.js'
import { setVoidCoins } from '../composables/useCurrency.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'

const { t } = useI18n()
setWebguiToken(useWebGuiToken())

const SLOTS = ['full', 'head', 'body', 'wings', 'accessory']
const slotColor = { full: '#a78bfa', head: '#fbbf24', body: '#38bdf8', wings: '#f472d0', accessory: '#34d399' }

const loading = ref(true)
const error = ref(null)
const catalog = ref([])
const myAvatars = ref([])
const voidCoins = ref(0)
const busy = ref('')
const form = ref({})   // avatarId -> { name, slot, price }

async function load() {
  loading.value = true
  try {
    const d = await getCosmetics()
    catalog.value = d.catalog || []
    myAvatars.value = d.my_avatars || []
    voidCoins.value = d.void_coins || 0
    error.value = null
  } catch (e) { error.value = e?.message || 'error' } finally { loading.value = false }
}
async function doBuy(c) {
  if (busy.value) return
  busy.value = c.slug
  try {
    const r = await buyCosmetic(c.slug)
    if (typeof r.new_void_coins === 'number') { voidCoins.value = r.new_void_coins; setVoidCoins(r.new_void_coins) }
    c.owned = true
    toastSuccess(t('gameUiCosmetics.bought', { n: c.name }))
  } catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
async function doEquip(c) {
  if (busy.value) return
  busy.value = c.slug
  try { await equipCosmetic(c.slug); catalog.value.forEach((x) => { x.equipped = x.slug === c.slug }); toastSuccess(t('gameUiCosmetics.equipped', { n: c.name })) }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
async function doUnequip(c) {
  if (busy.value) return
  busy.value = c.slug
  try { await unequipCosmetic(); catalog.value.forEach((x) => { x.equipped = false }); toastSuccess(t('gameUiCosmetics.unequipped')) }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
async function doDelete(c) {
  if (busy.value) return
  busy.value = c.slug
  try { await deleteCosmetic(c.slug); catalog.value = catalog.value.filter((x) => x.slug !== c.slug) }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
function f(id) { return form.value[id] || (form.value[id] = { name: '', slot: 'full', price: 0 }) }
async function doPromote(a) {
  const d = f(a.id)
  if (!d.name.trim()) { toastError(t('gameUiCosmetics.needName')); return }
  if (busy.value) return
  busy.value = a.id
  try { await promoteCosmetic(a.id, d.name.trim(), d.slot, Number(d.price) || 0); d.name = ''; toastSuccess(t('gameUiCosmetics.promoted', { n: d.name })); await load() }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
function kb(n) { return `${Math.max(1, Math.round(n / 1024))} KB` }
function money(v) { return Number(v || 0).toLocaleString('ru-RU') }

onMounted(load)
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="cosmetics" />
    <GameUiTopBar :title="t('gameUiCosmetics.title')" />

    <div class="gp-wrap gp-wrap--app">
      <div v-if="loading" class="gp-center"><span class="gp-spinner"></span></div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <template v-else>
        <div class="gp-panel co-intro">
          <span class="co-badge">ADMIN</span>
          <span class="co-intro-tx">{{ t('gameUiCosmetics.intro') }}</span>
          <span class="co-vc"><GuiIcon name="voidcoin" :size="14" />{{ money(voidCoins) }}</span>
        </div>

        <!-- catalog / shop -->
        <div class="gp-panel">
          <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="star" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiCosmetics.catalog') }}</span><span class="gp-phead-sp"></span><span class="co-count">{{ catalog.length }}</span></div>
          <div v-if="!catalog.length" class="co-empty">{{ t('gameUiCosmetics.emptyCatalog') }}</div>
          <div v-else class="co-grid">
            <div v-for="c in catalog" :key="c.slug" class="co-card" :class="{ on: c.equipped, off: !c.enabled }">
              <div class="co-card-ic" :style="{ '--sc': slotColor[c.slot] || '#a78bfa' }"><GuiIcon name="user" :size="26" /></div>
              <div class="co-card-info">
                <div class="co-card-name">{{ c.name }}</div>
                <div class="co-card-meta">
                  <span class="co-slot" :style="{ color: slotColor[c.slot] || '#a78bfa' }">{{ t('gameUiCosmetics.slot.' + c.slot) }}</span>
                  <span v-if="c.price > 0" class="co-price"><GuiIcon name="voidcoin" :size="10" />{{ money(c.price) }}</span>
                  <span v-else class="co-free">{{ t('gameUiCosmetics.free') }}</span>
                </div>
              </div>
              <div class="co-card-btns">
                <button v-if="!c.owned" class="co-buy" :disabled="busy === c.slug" @click="doBuy(c)"><GuiIcon name="voidcoin" :size="11" />{{ c.price > 0 ? t('gameUiCosmetics.buy') : t('gameUiCosmetics.claim') }}</button>
                <button v-else-if="!c.equipped" class="co-eq" :disabled="busy === c.slug" @click="doEquip(c)">{{ t('gameUiCosmetics.equip') }}</button>
                <button v-else class="co-uneq" :disabled="busy === c.slug" @click="doUnequip(c)">{{ t('gameUiCosmetics.unequip') }}</button>
                <button class="co-del" :disabled="busy === c.slug" :title="t('gameUiCosmetics.delete')" @click="doDelete(c)">✕</button>
              </div>
            </div>
          </div>
        </div>

        <!-- my figura avatars → add to catalog -->
        <div class="gp-panel">
          <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="package" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiCosmetics.mine') }}</span></div>
          <p class="co-hint">{{ t('gameUiCosmetics.mineHint') }}</p>
          <div v-if="!myAvatars.length" class="co-empty">{{ t('gameUiCosmetics.emptyMine') }}</div>
          <div v-else class="co-mine">
            <div v-for="a in myAvatars" :key="a.id" class="co-mine-row">
              <div class="co-mine-ic"><GuiIcon name="user" :size="20" /></div>
              <div class="co-mine-name">{{ a.id }} <span class="co-mine-sub">{{ kb(a.size_bytes) }}</span></div>
              <input v-model="f(a.id).name" class="co-in co-in-name" :placeholder="t('gameUiCosmetics.namePh')" maxlength="48" />
              <select v-model="f(a.id).slot" class="co-in co-in-slot">
                <option v-for="s in SLOTS" :key="s" :value="s">{{ t('gameUiCosmetics.slot.' + s) }}</option>
              </select>
              <input v-model.number="f(a.id).price" type="number" min="0" class="co-in co-in-price" :placeholder="t('gameUiCosmetics.pricePh')" />
              <button class="co-promote" :disabled="busy === a.id" @click="doPromote(a)"><GuiIcon name="plus" :size="13" />{{ t('gameUiCosmetics.promote') }}</button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.gp-wrap--app { display: flex; flex-direction: column; gap: 16px; }
.co-intro { display: flex; align-items: center; gap: 12px; }
.co-badge { font-size: 0.62rem; font-weight: 900; letter-spacing: 0.08em; color: #fbbf24; background: rgba(251,191,36,0.14); border: 1px solid rgba(251,191,36,0.4); padding: 3px 8px; border-radius: 7px; }
.co-intro-tx { flex: 1; font-size: 0.82rem; color: #aeb9d6; }
.co-vc { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; color: #d8ccff; }
.co-count { font-size: 0.72rem; font-weight: 800; color: #c4b5fd; }
.co-empty { padding: 20px; text-align: center; font-size: 0.82rem; color: #8a90a8; }
.co-hint { font-size: 0.74rem; color: #9aa3bf; margin: 8px 0 4px; line-height: 1.4; }

.co-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; margin-top: 10px; }
.co-card { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--gp-line); }
.co-card.on { border-color: rgba(52,211,153,0.5); background: rgba(52,211,153,0.06); }
.co-card.off { opacity: 0.55; }
.co-card-ic { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; background: color-mix(in srgb, var(--sc) 16%, transparent); color: var(--sc); border: 1px solid color-mix(in srgb, var(--sc) 40%, transparent); flex-shrink: 0; }
.co-card-info { flex: 1; min-width: 0; }
.co-card-name { font-size: 0.86rem; font-weight: 800; color: #eef2ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.co-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.co-slot { font-size: 0.62rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
.co-price { display: inline-flex; align-items: center; gap: 3px; font-size: 0.68rem; font-weight: 800; color: #c4b5fd; }
.co-free { font-size: 0.64rem; font-weight: 800; color: #34d399; }
.co-card-btns { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.co-buy { display: inline-flex; align-items: center; gap: 3px; padding: 6px 11px; border-radius: 9px; border: 1px solid rgba(167,139,250,0.5); background: linear-gradient(135deg, rgba(139,123,255,0.24), rgba(180,92,240,0.18)); color: #e4dcff; font-weight: 800; font-size: 0.72rem; cursor: pointer; }
.co-eq { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(139,123,255,0.5); background: rgba(139,123,255,0.14); color: #d8ccff; font-weight: 800; font-size: 0.74rem; cursor: pointer; }
.co-uneq { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(52,211,153,0.45); background: rgba(52,211,153,0.12); color: #6ee7b7; font-weight: 800; font-size: 0.74rem; cursor: pointer; }
.co-del { width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.03); color: #aeb9d6; cursor: pointer; font-weight: 800; }
.co-del:hover { background: rgba(251,113,133,0.14); color: #fb7185; }
.co-buy:disabled, .co-eq:disabled, .co-uneq:disabled, .co-del:disabled, .co-promote:disabled { opacity: 0.5; cursor: default; }

.co-mine { display: flex; flex-direction: column; gap: 7px; margin-top: 8px; }
.co-mine-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--gp-line); flex-wrap: wrap; }
.co-mine-ic { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; background: rgba(0,0,0,0.3); color: #aeb9d6; flex-shrink: 0; }
.co-mine-name { flex: 1; min-width: 120px; font-size: 0.8rem; font-weight: 700; color: #d5dcf0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.co-mine-sub { font-size: 0.62rem; color: #8a90a8; font-weight: 500; }
.co-in { padding: 7px 9px; border-radius: 9px; background: rgba(0,0,0,0.32); border: 1px solid rgba(167,139,250,0.35); color: #eef2ff; font-size: 0.78rem; outline: none; }
.co-in:focus { border-color: rgba(167,139,250,0.7); }
.co-in-name { width: 130px; }
.co-in-slot { width: 92px; }
.co-in-price { width: 78px; }
.co-promote { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border-radius: 9px; border: none; background: linear-gradient(135deg, #6d5cf0, #b45cf0); color: #fff; font-weight: 800; font-size: 0.76rem; cursor: pointer; }
</style>
