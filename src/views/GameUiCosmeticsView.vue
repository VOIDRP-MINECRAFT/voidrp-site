<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getCosmetics, buyCosmetic, giftCosmetic, equipCosmetic, unequipCosmetic, setWebguiToken } from '../services/gameUiApi.js'
import { toastSuccess, toastError } from '../services/toast'
import { useWebGuiToken } from '../composables/useWebGui.js'
import { setVoidCoins } from '../composables/useCurrency.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'

const { t } = useI18n()
setWebguiToken(useWebGuiToken())

const slotColor = { full: '#a78bfa', head: '#fbbf24', body: '#38bdf8', wings: '#f472d0', accessory: '#34d399' }

// rarity by price → drives the card accent colour + label
function rarityOf(price) {
  const p = Number(price) || 0
  if (p >= 50000) return { key: 'legendary', label: t('gameUiCosmetics.rare.legendary'), color: '#f5a623' }
  if (p >= 10000) return { key: 'epic', label: t('gameUiCosmetics.rare.epic'), color: '#a855f7' }
  if (p >= 2000) return { key: 'rare', label: t('gameUiCosmetics.rare.rare'), color: '#38bdf8' }
  return { key: 'common', label: t('gameUiCosmetics.rare.common'), color: '#94a3b8' }
}

const loading = ref(true)
const error = ref(null)
const catalog = ref([])
const voidCoins = ref(0)
const busy = ref('')

// filters / sort
const SLOTS = ['full', 'head', 'body', 'wings', 'accessory']
const search = ref('')
const slotFilter = ref('all')
const ownedFilter = ref('all')   // all | owned | shop | fav
const rarityFilter = ref('all')  // all | common | rare | epic | legendary
const sortBy = ref('default')    // default | price-asc | price-desc | name

// favorites (per-device, localStorage)
const FAV_KEY = 'voidrp_cos_favs'
const favs = ref(new Set())
try { favs.value = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')) } catch { /* ignore */ }
function isFav(slug) { return favs.value.has(slug) }
function toggleFav(c) {
  const s = new Set(favs.value)
  s.has(c.slug) ? s.delete(c.slug) : s.add(c.slug)
  favs.value = s
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...s])) } catch { /* ignore */ }
}

const ownedCount = computed(() => catalog.value.filter((c) => c.owned).length)
const equippedItems = computed(() => catalog.value.filter((c) => c.equipped))
const equippedLabel = computed(() => {
  const e = equippedItems.value
  if (!e.length) return '—'
  return e.length === 1 ? e[0].name : `${e.length} шт`
})

const filtered = computed(() => {
  let list = catalog.value.slice()
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((c) => c.name.toLowerCase().includes(q))
  if (slotFilter.value !== 'all') list = list.filter((c) => c.slot === slotFilter.value)
  if (rarityFilter.value !== 'all') list = list.filter((c) => rarityOf(c.price).key === rarityFilter.value)
  if (ownedFilter.value === 'owned') list = list.filter((c) => c.owned)
  else if (ownedFilter.value === 'shop') list = list.filter((c) => !c.owned)
  else if (ownedFilter.value === 'fav') list = list.filter((c) => favs.value.has(c.slug))
  if (sortBy.value === 'price-asc') list.sort((a, b) => a.price - b.price)
  else if (sortBy.value === 'price-desc') list.sort((a, b) => b.price - a.price)
  else if (sortBy.value === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
  return list
})
const hasFilters = computed(() => !!search.value.trim() || slotFilter.value !== 'all' || ownedFilter.value !== 'all' || rarityFilter.value !== 'all' || sortBy.value !== 'default')
function resetFilters() { search.value = ''; slotFilter.value = 'all'; ownedFilter.value = 'all'; rarityFilter.value = 'all'; sortBy.value = 'default' }

// gift
const giftItem = ref(null)
const giftNick = ref('')
function askGift(c) { giftItem.value = c; giftNick.value = '' }
async function doGift() {
  const c = giftItem.value
  if (!giftNick.value.trim()) { toastError(t('gameUiCosmetics.giftNeedNick')); return }
  if (busy.value) return
  busy.value = 'gift'
  try {
    const r = await giftCosmetic(giftNick.value.trim(), c.slug)
    if (typeof r.new_void_coins === 'number') { voidCoins.value = r.new_void_coins; setVoidCoins(r.new_void_coins) }
    toastSuccess(t('gameUiCosmetics.gifted', { p: r.nickname, n: r.name }))
    giftItem.value = null
  } catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}

async function load() {
  loading.value = true
  try {
    const d = await getCosmetics()
    catalog.value = d.catalog || []
    voidCoins.value = d.void_coins || 0
    error.value = null
  } catch (e) { error.value = e?.message || 'error' } finally { loading.value = false }
}
// purchase confirmation
const confirmItem = ref(null)
function askBuy(c) { confirmItem.value = c }
async function doBuy(c) {
  confirmItem.value = null
  if (busy.value) return
  busy.value = c.slug
  try {
    const r = await buyCosmetic(c.slug)
    if (typeof r.new_void_coins === 'number') { voidCoins.value = r.new_void_coins; setVoidCoins(r.new_void_coins) }
    c.owned = true
    toastSuccess(t('gameUiCosmetics.bought', { n: c.name }))
  } catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}

// large preview modal
const previewItem = ref(null)
async function doEquip(c) {
  if (busy.value) return
  busy.value = c.slug
  try { await equipCosmetic(c.slug); await load(); toastSuccess(t('gameUiCosmetics.equipped', { n: c.name })) }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
async function doUnequip(c) {
  if (busy.value) return
  busy.value = c.slug
  try { await unequipCosmetic(c.slug); await load(); toastSuccess(t('gameUiCosmetics.unequipped')) }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
async function doUnequipAll() {
  if (busy.value) return
  busy.value = 'all'
  try { await unequipCosmetic(); await load(); toastSuccess(t('gameUiCosmetics.unequipped')) }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
function money(v) { return Number(v || 0).toLocaleString('ru-RU') }

// ── premium 3D tilt + cursor spotlight ──
function onTilt(e) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width - 0.5
  const y = (e.clientY - r.top) / r.height - 0.5
  el.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg')
  el.style.setProperty('--rx', (-y * 9).toFixed(2) + 'deg')
  el.style.setProperty('--mx', (e.clientX - r.left) + 'px')
  el.style.setProperty('--my', (e.clientY - r.top) + 'px')
  el.style.setProperty('--px', (x * 14).toFixed(1) + 'px')
  el.style.setProperty('--py', (y * 14).toFixed(1) + 'px')
  el.classList.add('lit')
}
function offTilt(e) {
  const el = e.currentTarget
  el.style.setProperty('--ry', '0deg')
  el.style.setProperty('--rx', '0deg')
  el.style.setProperty('--px', '0px')
  el.style.setProperty('--py', '0px')
  el.classList.remove('lit')
}

onMounted(load)
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="cosmetics" />
    <GameUiTopBar :title="t('gameUiCosmetics.title')" />

    <div class="gp-wrap gp-wrap--app">
      <div v-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <template v-else>
        <!-- premium hero -->
        <div class="co-hero">
          <div class="co-hero__aura"></div>
          <div class="co-hero__l">
            <div class="co-hero__kicker">✦ FIGURA · {{ t('gameUiCosmetics.title') }}</div>
            <h1 class="co-hero__title">{{ t('gameUiCosmetics.heroTitle') }}</h1>
            <p class="co-hero__sub">{{ t('gameUiCosmetics.intro') }}</p>
            <div class="co-stats">
              <div class="co-stat"><span class="co-stat__n">{{ catalog.length }}</span><span class="co-stat__l">{{ t('gameUiCosmetics.statAll') }}</span></div>
              <div class="co-stat"><span class="co-stat__n">{{ ownedCount }}</span><span class="co-stat__l">{{ t('gameUiCosmetics.statOwned') }}</span></div>
              <div class="co-stat co-stat--eq"><span class="co-stat__n">{{ equippedLabel }}</span><span class="co-stat__l">{{ t('gameUiCosmetics.statEquipped') }}</span></div>
            </div>
          </div>
          <div class="co-hero__bal">
            <div class="co-hero__bal-ic"><GuiIcon name="voidcoin" :size="26" /></div>
            <div class="co-hero__bal-n">{{ money(voidCoins) }}</div>
            <div class="co-hero__bal-l">Void Coins</div>
          </div>
        </div>

        <!-- my look (equipped set) -->
        <div v-if="equippedItems.length" class="co-look">
          <div class="co-look__lbl">✦ {{ t('gameUiCosmetics.myLook') }}</div>
          <div class="co-look__items">
            <div v-for="c in equippedItems" :key="c.slug" class="co-look__item" :style="{ '--sc': slotColor[c.slot] || '#a78bfa' }" @click="c.preview_url && (previewItem = c)">
              <img v-if="c.preview_url" :src="c.preview_url" alt="" />
              <GuiIcon v-else name="user" :size="20" />
              <span class="co-look__name">{{ c.name }}</span>
              <button class="co-look__x" :title="t('gameUiCosmetics.unequip')" :disabled="busy === c.slug" @click.stop="doUnequip(c)">✕</button>
            </div>
          </div>
          <button class="co-look__all" :disabled="busy" @click="doUnequipAll">{{ t('gameUiCosmetics.unequipAll') }}</button>
        </div>

        <!-- toolbar -->
        <div class="co-tools">
          <div class="co-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input v-model="search" :placeholder="t('gameUiCosmetics.searchPh')" />
          </div>
          <div class="co-chips">
            <button class="co-chip" :class="{ on: slotFilter === 'all' }" @click="slotFilter = 'all'">{{ t('gameUiCosmetics.allSlots') }}</button>
            <button v-for="s in SLOTS" :key="s" class="co-chip" :class="{ on: slotFilter === s }" :style="{ '--sc': slotColor[s] }" @click="slotFilter = s">{{ t('gameUiCosmetics.slot.' + s) }}</button>
          </div>
          <select v-model="ownedFilter" class="co-sel">
            <option value="all">{{ t('gameUiCosmetics.fAll') }}</option>
            <option value="owned">{{ t('gameUiCosmetics.fOwned') }}</option>
            <option value="shop">{{ t('gameUiCosmetics.fShop') }}</option>
            <option value="fav">★ {{ t('gameUiCosmetics.fFav') }}</option>
          </select>
          <select v-model="rarityFilter" class="co-sel">
            <option value="all">{{ t('gameUiCosmetics.rAll') }}</option>
            <option value="common">{{ t('gameUiCosmetics.rare.common') }}</option>
            <option value="rare">{{ t('gameUiCosmetics.rare.rare') }}</option>
            <option value="epic">{{ t('gameUiCosmetics.rare.epic') }}</option>
            <option value="legendary">{{ t('gameUiCosmetics.rare.legendary') }}</option>
          </select>
          <select v-model="sortBy" class="co-sel">
            <option value="default">{{ t('gameUiCosmetics.sortDefault') }}</option>
            <option value="price-asc">{{ t('gameUiCosmetics.sortPriceAsc') }}</option>
            <option value="price-desc">{{ t('gameUiCosmetics.sortPriceDesc') }}</option>
            <option value="name">{{ t('gameUiCosmetics.sortName') }}</option>
          </select>
        </div>

        <!-- skeletons -->
        <div v-if="loading" class="co-grid">
          <div v-for="n in 8" :key="n" class="co-skel"><div class="co-skel__img"></div><div class="co-skel__l1"></div><div class="co-skel__l2"></div></div>
        </div>

        <!-- empty -->
        <div v-else-if="!catalog.length" class="co-empty-box">
          <div class="co-empty-ic"><GuiIcon name="star" :size="34" /></div>
          <div class="co-empty-t">{{ t('gameUiCosmetics.emptyCatalog') }}</div>
        </div>
        <div v-else-if="!filtered.length" class="co-empty-box">
          <div class="co-empty-t">{{ t('gameUiCosmetics.nothingFound') }}</div>
          <button v-if="hasFilters" class="co-reset" @click="resetFilters">{{ t('gameUiCosmetics.reset') }}</button>
        </div>

        <div v-else class="co-grid">
          <div v-for="(c, i) in filtered" :key="c.slug" class="co-cell" :style="{ animationDelay: Math.min(i * 55, 600) + 'ms' }">
            <div
              class="co-card" :class="{ on: c.equipped, owned: c.owned, featured: c.featured }"
              :style="{ '--sc': (c.equipped ? '#34d399' : rarityOf(c.price).color), '--slotc': slotColor[c.slot] || '#a78bfa' }"
              @mousemove="onTilt" @mouseleave="offTilt"
            >
              <div class="co-card__border"></div>
              <div class="co-card__glow"></div>
              <span v-if="c.featured" class="co-badge-feat">★ {{ t('gameUiCosmetics.featured') }}</span>
              <span v-else-if="c.is_new" class="co-badge-new">NEW</span>
              <span v-if="c.equipped" class="co-badge-eq">✦ {{ t('gameUiCosmetics.equippedTag') }}</span>

              <div class="co-art" :class="{ 'co-art--zoom': c.preview_url }" @click="c.preview_url && (previewItem = c)">
                <div class="co-art__bg"></div>
                <div class="co-art__grid"></div>
                <div class="co-art__pedestal"></div>
                <div class="co-art__shine"></div>
                <div class="co-art__model">
                  <img v-if="c.preview_url" :src="c.preview_url" class="co-art__img" alt="" />
                  <div v-else class="co-art__ph"><GuiIcon name="user" :size="64" /></div>
                </div>
                <div class="co-art__gloss"></div>
                <span class="co-art__slot" :style="{ color: slotColor[c.slot], borderColor: slotColor[c.slot] + '66' }">{{ t('gameUiCosmetics.slot.' + c.slot) }}</span>
                <span class="co-art__rarity">{{ rarityOf(c.price).label }}</span>
                <button class="co-fav" :class="{ on: isFav(c.slug) }" :title="t('gameUiCosmetics.fav')" @click.stop="toggleFav(c)">♥</button>
              </div>

              <div class="co-body">
                <div class="co-name">{{ c.name }}</div>
                <div class="co-foot">
                  <div class="co-priceline">
                    <template v-if="c.owned"><span class="co-owned">✓ {{ t('gameUiCosmetics.ownedTag') }}</span></template>
                    <template v-else-if="c.price > 0"><span class="co-price"><GuiIcon name="voidcoin" :size="14" />{{ money(c.price) }}</span></template>
                    <template v-else><span class="co-free">{{ t('gameUiCosmetics.free') }}</span></template>
                  </div>
                  <div class="co-actions">
                    <button class="co-gift" :title="t('gameUiCosmetics.gift')" :disabled="busy === c.slug" @click="askGift(c)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                    </button>
                    <button v-if="!c.owned" class="co-act co-act--buy" :disabled="busy === c.slug" @click="c.price > 0 ? askBuy(c) : doBuy(c)">
                      <GuiIcon name="voidcoin" :size="12" />{{ c.price > 0 ? t('gameUiCosmetics.buy') : t('gameUiCosmetics.claim') }}
                    </button>
                    <button v-else-if="!c.equipped" class="co-act co-act--eq" :disabled="busy === c.slug" @click="doEquip(c)">{{ t('gameUiCosmetics.equip') }}</button>
                    <button v-else class="co-act co-act--uneq" :disabled="busy === c.slug" @click="doUnequip(c)">{{ t('gameUiCosmetics.unequip') }}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- purchase confirm -->
    <transition name="co-fade">
      <div v-if="confirmItem" class="co-modal" @click.self="confirmItem = null">
        <div class="co-modal__box" :style="{ '--sc': rarityOf(confirmItem.price).color }">
          <div class="co-modal__title">{{ t('gameUiCosmetics.confirmTitle') }}</div>
          <div class="co-modal__name">{{ confirmItem.name }}</div>
          <div class="co-modal__price"><GuiIcon name="voidcoin" :size="18" />{{ money(confirmItem.price) }}</div>
          <div class="co-modal__bal">{{ t('gameUiCosmetics.balAfter') }}: <b>{{ money(Math.max(0, voidCoins - confirmItem.price)) }}</b></div>
          <div class="co-modal__row">
            <button class="co-mbtn co-mbtn--ghost" @click="confirmItem = null">{{ t('gameUiCosmetics.cancel') }}</button>
            <button class="co-mbtn co-mbtn--ok" :disabled="voidCoins < confirmItem.price" @click="doBuy(confirmItem)">{{ t('gameUiCosmetics.buy') }}</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- gift -->
    <transition name="co-fade">
      <div v-if="giftItem" class="co-modal" @click.self="giftItem = null">
        <div class="co-modal__box" :style="{ '--sc': rarityOf(giftItem.price).color }">
          <div class="co-modal__title">{{ t('gameUiCosmetics.giftTitle') }}</div>
          <div class="co-modal__name">{{ giftItem.name }}</div>
          <div class="co-modal__price"><GuiIcon name="voidcoin" :size="18" />{{ money(giftItem.price) }}</div>
          <input v-model="giftNick" class="co-giftin" :placeholder="t('gameUiCosmetics.giftNick')" maxlength="32" />
          <div class="co-modal__row">
            <button class="co-mbtn co-mbtn--ghost" @click="giftItem = null">{{ t('gameUiCosmetics.cancel') }}</button>
            <button class="co-mbtn co-mbtn--ok" :disabled="busy === 'gift' || voidCoins < giftItem.price" @click="doGift">{{ t('gameUiCosmetics.giftBtn') }}</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- large preview -->
    <transition name="co-fade">
      <div v-if="previewItem" class="co-modal" @click.self="previewItem = null">
        <div class="co-preview" :style="{ '--sc': rarityOf(previewItem.price).color }">
          <button class="co-preview__x" @click="previewItem = null">✕</button>
          <div class="co-preview__stage" @mousemove="onTilt" @mouseleave="offTilt">
            <div class="co-art__bg"></div>
            <div class="co-art__grid"></div>
            <div class="co-art__pedestal"></div>
            <img :src="previewItem.preview_url" class="co-preview__img" alt="" />
          </div>
          <div class="co-preview__name">{{ previewItem.name }}
            <span class="co-preview__rar">{{ rarityOf(previewItem.price).label }}</span>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.gp-wrap--app { display: flex; flex-direction: column; gap: 16px; }

/* ── hero ── */
.co-hero {
  position: relative; overflow: hidden; display: flex; gap: 18px; align-items: center; justify-content: space-between;
  padding: 22px 24px; border-radius: 20px;
  background: linear-gradient(120deg, rgba(139,123,255,.14), rgba(180,92,240,.06) 40%, rgba(56,189,248,.06));
  border: 1px solid rgba(167,139,250,.22);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 18px 44px -26px rgba(139,123,255,.6);
}
.co-hero__aura { position: absolute; inset: -40% -10% auto auto; width: 340px; height: 340px; border-radius: 50%;
  background: radial-gradient(circle, rgba(180,92,240,.35), transparent 62%); filter: blur(8px); pointer-events: none; animation: co-float 9s ease-in-out infinite; }
@keyframes co-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(20px) } }
.co-hero__l { position: relative; z-index: 1; min-width: 0; }
.co-hero__kicker { font-size: .62rem; font-weight: 900; letter-spacing: .16em; color: #c9beff; text-transform: uppercase; }
.co-hero__title { font-size: 1.7rem; font-weight: 900; margin: 6px 0 4px; color: #f6f3ff; letter-spacing: -.01em;
  background: linear-gradient(92deg, #fff, #c9beff); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.co-hero__sub { font-size: .84rem; color: #aeb9d6; max-width: 540px; line-height: 1.4; }
.co-stats { display: flex; gap: 22px; margin-top: 14px; flex-wrap: wrap; }
.co-stat { display: flex; flex-direction: column; }
.co-stat__n { font-size: 1.15rem; font-weight: 900; color: #eae6ff; line-height: 1; }
.co-stat--eq .co-stat__n { font-size: .95rem; color: #6ee7b7; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.co-stat__l { font-size: .58rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #8a90a8; margin-top: 4px; }
.co-hero__bal { position: relative; z-index: 1; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 16px 24px; border-radius: 16px; background: rgba(10,8,22,.5); border: 1px solid rgba(167,139,250,.3); }
.co-hero__bal-ic { color: #c9beff; margin-bottom: 4px; }
.co-hero__bal-n { font-size: 1.5rem; font-weight: 900; color: #efe9ff; line-height: 1; }
.co-hero__bal-l { font-size: .58rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #9a86e6; }

/* ── toolbar ── */
.co-tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.co-search { display: flex; align-items: center; gap: 7px; padding: 0 12px; height: 38px; border-radius: 11px;
  background: rgba(255,255,255,.03); border: 1px solid var(--gp-line); flex: 1; min-width: 180px; }
.co-search:focus-within { border-color: rgba(167,139,250,.55); box-shadow: 0 0 0 3px rgba(139,123,255,.12); }
.co-search svg { width: 15px; height: 15px; color: #8a90a8; flex-shrink: 0; }
.co-search input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: #eef2ff; font-size: .82rem; }
.co-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.co-chip { --sc: #a78bfa; padding: 8px 13px; border-radius: 10px; font-size: .72rem; font-weight: 800; cursor: pointer;
  color: #b7c0d8; background: rgba(255,255,255,.03); border: 1px solid var(--gp-line); transition: all .15s; }
.co-chip:hover { color: #eef2ff; border-color: color-mix(in srgb, var(--sc) 40%, transparent); }
.co-chip.on { color: #fff; background: color-mix(in srgb, var(--sc) 22%, transparent); border-color: color-mix(in srgb, var(--sc) 55%, transparent); box-shadow: 0 4px 14px -6px var(--sc); }
.co-sel { height: 38px; padding: 0 10px; border-radius: 11px; background: rgba(10,8,22,.6); border: 1px solid var(--gp-line); color: #d5dcf0; font-size: .78rem; font-weight: 700; cursor: pointer; }

/* ── skeletons ── */
.co-skel { height: 268px; border-radius: 18px; padding: 16px; background: rgba(255,255,255,.02); border: 1px solid var(--gp-line); overflow: hidden; position: relative; }
.co-skel::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, transparent, rgba(255,255,255,.06), transparent); transform: translateX(-100%); animation: co-sk 1.3s infinite; }
@keyframes co-sk { to { transform: translateX(100%); } }
.co-skel__img { height: 150px; border-radius: 12px; background: rgba(255,255,255,.04); margin-bottom: 14px; }
.co-skel__l1 { height: 14px; width: 70%; margin: 0 auto 8px; border-radius: 6px; background: rgba(255,255,255,.05); }
.co-skel__l2 { height: 10px; width: 40%; margin: 0 auto; border-radius: 6px; background: rgba(255,255,255,.04); }

/* ── empty ── */
.co-empty-box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 20px; }
.co-empty-ic { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; color: #a78bfa; background: rgba(139,123,255,.1); border: 1px solid rgba(139,123,255,.25); }
.co-empty-t { font-size: .9rem; font-weight: 700; color: #aeb9d6; }
.co-reset { padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(167,139,250,.4); background: rgba(139,123,255,.14); color: #d8ccff; font-weight: 800; font-size: .78rem; cursor: pointer; }

/* ── premium display-case cards ── */
.co-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(238px, 1fr)); gap: 18px; margin-top: 12px; perspective: 1400px; }
.co-cell { opacity: 0; transform: translateY(16px); animation: co-in .5s cubic-bezier(.2,.7,.2,1) forwards; }
@keyframes co-in { to { opacity: 1; transform: translateY(0); } }

.co-card {
  --sc: #a78bfa; --rx: 0deg; --ry: 0deg; --px: 0px; --py: 0px;
  position: relative; display: flex; flex-direction: column; isolation: isolate; cursor: default;
  border-radius: 20px; padding: 12px;
  background: linear-gradient(180deg, rgba(22,20,38,.92), rgba(12,11,22,.96));
  border: 1px solid color-mix(in srgb, var(--sc) 22%, rgba(255,255,255,.06));
  box-shadow: 0 14px 34px -18px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.05);
  transform: rotateX(var(--rx)) rotateY(var(--ry)); transform-style: preserve-3d;
  transition: transform .3s cubic-bezier(.2,.7,.2,1), box-shadow .3s, border-color .3s;
}
.co-card.lit {
  transition: transform .06s linear, box-shadow .3s, border-color .3s;
  box-shadow: 0 34px 70px -26px color-mix(in srgb, var(--sc) 60%, #000), inset 0 1px 0 rgba(255,255,255,.12);
  border-color: color-mix(in srgb, var(--sc) 55%, transparent);
}
/* animated gradient edge that lights up on hover */
.co-card__border {
  position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none; z-index: 2; opacity: 0; transition: opacity .3s;
  background: conic-gradient(from 120deg, transparent, color-mix(in srgb, var(--sc) 90%, #fff) 20%, transparent 40%, transparent 60%, color-mix(in srgb, var(--sc) 70%, #fff) 80%, transparent);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
.co-card.lit .co-card__border { opacity: 1; }
/* cursor spotlight over whole card */
.co-card__glow {
  position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 5; opacity: 0; transition: opacity .3s; mix-blend-mode: screen;
  background: radial-gradient(260px 260px at var(--mx) var(--my), color-mix(in srgb, var(--sc) 26%, transparent), transparent 62%);
}
.co-card.lit .co-card__glow { opacity: 1; }
.co-card.on { --sc: #34d399; }

.co-badge-eq {
  position: absolute; top: 20px; right: 20px; z-index: 6; padding: 4px 10px; border-radius: 999px;
  font-size: .56rem; font-weight: 900; letter-spacing: .07em; color: #052e22;
  background: linear-gradient(135deg, #6ee7b7, #34d399); box-shadow: 0 5px 16px -4px #34d399;
}

/* ── art frame (the display case) ── */
.co-art {
  position: relative; height: 200px; border-radius: 14px; overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--sc) 30%, rgba(255,255,255,.06));
  transform: translateZ(30px); transform-style: preserve-3d;
}
.co-art__bg { position: absolute; inset: 0; background:
  radial-gradient(58% 46% at 50% 32%, color-mix(in srgb, var(--sc) 55%, transparent), transparent 72%),
  radial-gradient(120% 80% at 50% 120%, color-mix(in srgb, var(--sc) 30%, transparent), transparent 60%),
  linear-gradient(180deg, #171331, #07060f 92%); }
.co-art__grid { position: absolute; inset: 0; opacity: .7; background-image:
  linear-gradient(color-mix(in srgb, var(--sc) 18%, transparent) 1px, transparent 1px),
  linear-gradient(90deg, color-mix(in srgb, var(--sc) 18%, transparent) 1px, transparent 1px);
  background-size: 24px 24px; -webkit-mask: radial-gradient(75% 65% at 50% 42%, #000, transparent 78%); mask: radial-gradient(75% 65% at 50% 42%, #000, transparent 78%); }
/* glowing platform the model stands on */
.co-art__pedestal { position: absolute; left: 50%; bottom: 12px; width: 158px; height: 30px; transform: translateX(-50%); z-index: 1; }
.co-art__pedestal::before { content: ""; position: absolute; inset: 0; border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--sc) 95%, #fff), color-mix(in srgb, var(--sc) 55%, transparent) 48%, transparent 74%);
  filter: blur(2px); opacity: .9; animation: co-pulse 3.4s ease-in-out infinite; }
.co-art__pedestal::after { content: ""; position: absolute; left: 12%; right: 12%; bottom: 44%; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--sc) 92%, #fff), transparent); opacity: .85; }
@keyframes co-pulse { 0%,100% { opacity: .6; transform: scaleX(.9) } 50% { opacity: 1; transform: scaleX(1.06) } }
.co-art__model {
  position: absolute; left: 50%; bottom: 18px; z-index: 2; width: 88%; height: 80%;
  display: grid; place-items: end center; pointer-events: none;
  transform: translateX(-50%) translate3d(calc(var(--px) * -1), calc(var(--py) * -1), 46px);
  transition: transform .1s linear;
}
.co-art__img {
  max-width: 100%; max-height: 100%; object-fit: contain;
  filter: drop-shadow(0 12px 16px rgba(0,0,0,.55));
  animation: co-float 5.5s ease-in-out infinite;
}
@keyframes co-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
.co-art__ph { display: grid; place-items: center; color: color-mix(in srgb, var(--sc) 85%, #fff); opacity: .55; }
.co-art__gloss { position: absolute; inset: 0; z-index: 3; pointer-events: none; background: linear-gradient(180deg, rgba(255,255,255,.14), transparent 30%); }
/* shine sweep only inside the art */
.co-art__shine { position: absolute; inset: 0; z-index: 4; pointer-events: none; overflow: hidden; opacity: 0; }
.co-art__shine::before { content: ""; position: absolute; top: -60%; left: -30%; width: 45%; height: 220%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.4), transparent); transform: rotate(18deg) translateX(-140%); }
.co-card.lit .co-art__shine { opacity: 1; }
.co-card.lit .co-art__shine::before { animation: co-shine 1s ease; }
@keyframes co-shine { to { transform: rotate(18deg) translateX(360%); } }
.co-art__slot { position: absolute; top: 10px; left: 10px; z-index: 5; padding: 3px 9px; border-radius: 999px;
  font-size: .54rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em;
  background: rgba(8,7,16,.6); border: 1px solid rgba(255,255,255,.12); backdrop-filter: blur(4px); }
.co-art__rarity { position: absolute; top: 10px; right: 10px; z-index: 5; padding: 3px 9px; border-radius: 999px;
  font-size: .54rem; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: color-mix(in srgb, var(--sc) 92%, #fff);
  background: color-mix(in srgb, var(--sc) 18%, rgba(8,7,16,.55)); border: 1px solid color-mix(in srgb, var(--sc) 50%, transparent); backdrop-filter: blur(4px);
  box-shadow: 0 2px 10px -3px color-mix(in srgb, var(--sc) 70%, transparent); }

/* ── body / footer ── */
.co-body { padding: 13px 6px 6px; transform: translateZ(16px); }
.co-name { font-size: 1rem; font-weight: 900; color: #f5f2ff; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.co-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
.co-priceline { min-width: 0; }
.co-price { display: inline-flex; align-items: center; gap: 5px; font-size: 1.02rem; font-weight: 900; color: #efe7ff; }
.co-free { font-size: .82rem; font-weight: 900; color: #34d399; }
.co-owned { font-size: .72rem; font-weight: 900; color: #8fe9c4; text-transform: uppercase; letter-spacing: .05em; }

.co-act {
  display: inline-flex; align-items: center; gap: 5px; padding: 9px 17px; border-radius: 12px; cursor: pointer;
  font-weight: 900; font-size: .8rem; color: #fff; border: none; white-space: nowrap;
  transition: transform .15s, box-shadow .15s, filter .15s;
}
.co-act:hover { transform: translateY(-2px); filter: brightness(1.1); }
.co-act:active { transform: translateY(0); }
.co-act--buy { background: linear-gradient(135deg, #7c5cff, #b45cf0); box-shadow: 0 10px 22px -8px #8b5cf6; }
.co-act--eq { background: linear-gradient(135deg, #6d7bff, #8b5cff); box-shadow: 0 10px 22px -8px #6d7bff; }
.co-act--uneq { background: rgba(52,211,153,.16); color: #6ee7b7; border: 1px solid rgba(52,211,153,.4); }
.co-act:disabled { opacity: .5; cursor: default; transform: none; filter: none; }

/* featured card: gold-tinted always-on glow */
.co-card.featured { border-color: color-mix(in srgb, #f5a623 45%, transparent); box-shadow: 0 14px 34px -18px rgba(0,0,0,.85), 0 0 0 1px rgba(245,166,35,.2), inset 0 1px 0 rgba(255,255,255,.06); }
.co-badge-feat { position: absolute; top: 20px; left: 20px; z-index: 6; padding: 4px 10px; border-radius: 999px;
  font-size: .56rem; font-weight: 900; letter-spacing: .07em; color: #3a2600;
  background: linear-gradient(135deg, #ffd76a, #f5a623); box-shadow: 0 5px 16px -4px #f5a623; }
.co-badge-new { position: absolute; top: 20px; left: 20px; z-index: 6; padding: 4px 10px; border-radius: 999px;
  font-size: .56rem; font-weight: 900; letter-spacing: .08em; color: #062b2b;
  background: linear-gradient(135deg, #67e8f9, #22d3ee); box-shadow: 0 5px 16px -4px #22d3ee; }
.co-art--zoom { cursor: zoom-in; }

.co-unall { height: 38px; padding: 0 14px; border-radius: 11px; cursor: pointer; font-weight: 800; font-size: .78rem;
  color: #fca5a5; background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.3); }
.co-unall:hover { background: rgba(248,113,113,.18); }

/* favorite heart + gift button */
.co-fav { position: absolute; bottom: 8px; right: 8px; z-index: 5; width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
  display: grid; place-items: center; font-size: .9rem; color: #8a90a8; background: rgba(8,7,16,.6); border: 1px solid rgba(255,255,255,.12); backdrop-filter: blur(4px); transition: all .15s; }
.co-fav:hover { color: #fca5a5; }
.co-fav.on { color: #fb7185; border-color: rgba(251,113,133,.5); background: rgba(251,113,133,.14); }
.co-actions { display: flex; align-items: center; gap: 6px; }
.co-gift { width: 36px; height: 36px; border-radius: 11px; cursor: pointer; display: grid; place-items: center; color: #c4b5fd; background: rgba(255,255,255,.05); border: 1px solid var(--gp-line); transition: all .15s; }
.co-gift svg { width: 17px; height: 17px; }
.co-gift:hover { background: rgba(139,123,255,.16); color: #e4dcff; border-color: rgba(167,139,250,.4); }
.co-gift:disabled { opacity: .5; cursor: default; }
.co-giftin { width: 100%; margin-top: 14px; padding: 11px 12px; border-radius: 11px; background: rgba(0,0,0,.32);
  border: 1px solid color-mix(in srgb, var(--sc) 40%, transparent); color: #eef2ff; font-size: .85rem; outline: none; text-align: center; }

/* my look strip */
.co-look { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 16px;
  background: linear-gradient(120deg, rgba(52,211,153,.1), rgba(139,123,255,.06)); border: 1px solid rgba(52,211,153,.22); }
.co-look__lbl { font-size: .7rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #6ee7b7; }
.co-look__items { display: flex; flex-wrap: wrap; gap: 8px; flex: 1; }
.co-look__item { --sc: #a78bfa; display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 5px; border-radius: 12px; cursor: pointer;
  background: rgba(0,0,0,.28); border: 1px solid color-mix(in srgb, var(--sc) 35%, transparent); }
.co-look__item img { width: 34px; height: 34px; object-fit: contain; border-radius: 8px; background: color-mix(in srgb, var(--sc) 14%, transparent); }
.co-look__name { font-size: .8rem; font-weight: 800; color: #eef2ff; }
.co-look__x { width: 22px; height: 22px; border-radius: 7px; cursor: pointer; color: #fca5a5; background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.3); font-size: .7rem; }
.co-look__all { padding: 8px 14px; border-radius: 11px; cursor: pointer; font-weight: 800; font-size: .76rem; color: #fca5a5; background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.3); }

/* modals */
.co-modal { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 20px;
  background: rgba(4,3,10,.72); backdrop-filter: blur(6px); }
.co-fade-enter-active, .co-fade-leave-active { transition: opacity .2s; }
.co-fade-enter-from, .co-fade-leave-to { opacity: 0; }
.co-modal__box { --sc: #a78bfa; width: 100%; max-width: 340px; padding: 22px; border-radius: 18px; text-align: center;
  background: linear-gradient(180deg, rgba(24,21,42,.98), rgba(12,11,22,.99));
  border: 1px solid color-mix(in srgb, var(--sc) 45%, transparent); box-shadow: 0 30px 70px -24px #000; }
.co-modal__title { font-size: .74rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #9aa3bf; }
.co-modal__name { font-size: 1.2rem; font-weight: 900; color: #f5f2ff; margin: 8px 0; }
.co-modal__price { display: inline-flex; align-items: center; gap: 6px; font-size: 1.4rem; font-weight: 900; color: color-mix(in srgb, var(--sc) 80%, #fff); }
.co-modal__bal { font-size: .8rem; color: #aeb9d6; margin-top: 6px; }
.co-modal__bal b { color: #e6ddff; }
.co-modal__row { display: flex; gap: 10px; margin-top: 18px; }
.co-mbtn { flex: 1; padding: 11px; border-radius: 12px; font-weight: 900; font-size: .84rem; cursor: pointer; border: none; }
.co-mbtn--ghost { background: rgba(255,255,255,.05); color: #c7cee0; border: 1px solid var(--gp-line); }
.co-mbtn--ok { background: linear-gradient(135deg, #7c5cff, #b45cf0); color: #fff; box-shadow: 0 10px 22px -8px #8b5cf6; }
.co-mbtn:disabled { opacity: .45; cursor: default; }

/* large preview */
.co-preview { --sc: #a78bfa; position: relative; width: 100%; max-width: 460px; border-radius: 22px; padding: 16px;
  background: linear-gradient(180deg, rgba(24,21,42,.98), rgba(10,9,20,.99)); border: 1px solid color-mix(in srgb, var(--sc) 40%, transparent);
  box-shadow: 0 40px 90px -30px #000; }
.co-preview__x { position: absolute; top: 14px; right: 14px; z-index: 5; width: 32px; height: 32px; border-radius: 9px; cursor: pointer;
  background: rgba(255,255,255,.06); border: 1px solid var(--gp-line); color: #c7cee0; font-weight: 800; }
.co-preview__stage { position: relative; height: 360px; border-radius: 16px; overflow: hidden; perspective: 1000px;
  border: 1px solid color-mix(in srgb, var(--sc) 25%, transparent); }
.co-preview__img { position: absolute; left: 50%; bottom: 26px; z-index: 2; max-width: 82%; max-height: 84%; object-fit: contain;
  transform: translateX(-50%) translate3d(calc(var(--px,0px) * -1), calc(var(--py,0px) * -1), 40px);
  filter: drop-shadow(0 16px 20px rgba(0,0,0,.6)); animation: co-float 5.5s ease-in-out infinite; }
.co-preview__name { text-align: center; font-size: 1.15rem; font-weight: 900; color: #f5f2ff; margin-top: 12px; }
.co-preview__rar { display: inline-block; margin-left: 8px; padding: 3px 10px; border-radius: 999px; font-size: .6rem; font-weight: 900;
  text-transform: uppercase; letter-spacing: .08em; color: color-mix(in srgb, var(--sc) 90%, #fff);
  background: color-mix(in srgb, var(--sc) 18%, transparent); border: 1px solid color-mix(in srgb, var(--sc) 45%, transparent); }

@media (prefers-reduced-motion: reduce) {
  .co-card, .co-art__model { transform: none !important; transition: none; }
  .co-cell { opacity: 1; transform: none; animation: none; }
  .co-art__img, .co-art__pedestal::before, .co-card.lit .co-art__shine::before, .co-preview__img { animation: none; }
}
</style>
