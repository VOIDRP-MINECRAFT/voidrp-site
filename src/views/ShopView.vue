<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { createPayment, getDonateProducts, getLastPayments } from '../services/donateApi'
import { toastError, toastSuccess } from '../services/toast'
import { useAuthStore } from '../stores/authStore'
import { activeServer, fetchServers } from '../stores/serverStore'
import { usePageAccent } from '../composables/usePageAccent'

const { t, locale } = useI18n()
const { accentVars } = usePageAccent()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const loading = ref(true)
const paying = ref(false)
const error = ref('')
const products = ref([])
const lastPayments = ref([])
const cart = ref({})
const coupon = ref('')
const couponOpen = ref(false)
const serverOnline = ref(null)
const expandedProduct = ref(null)
const brokenImages = ref(new Set())
const cartEl = ref(null)

const activeServerName = computed(() => activeServer.value?.name || t('shop.serverFallback'))
const nick = computed(() => auth.state.playerAccount?.minecraft_nickname || '')
const numLocale = computed(() => (String(locale.value).startsWith('en') ? 'en-US' : 'ru-RU'))
const rub = (v) => `${Number(v || 0).toLocaleString(numLocale.value)} ₽`

// "Хит" → the priciest product, the closest thing to a flagship offer.
const topProductId = computed(() => {
  let best = null
  let max = -1
  for (const p of products.value) {
    const price = Number(p.price || 0)
    if (price > max) { max = price; best = p.id }
  }
  return products.value.length > 1 ? best : null
})

const cartItems = computed(() => products.value.filter((p) => cart.value[p.id] > 0))
const cartCount = computed(() => Object.values(cart.value).reduce((s, n) => s + n, 0))
const cartTotal = computed(() => products.value.reduce((sum, p) => sum + (cart.value[p.id] || 0) * Number(p.price || 0), 0))
const cartSaving = computed(() => products.value.reduce((sum, p) => {
  const old = Number(p.old_price)
  const cur = Number(p.price)
  return old > cur ? sum + (cart.value[p.id] || 0) * (old - cur) : sum
}, 0))

function discountPct(product) {
  const old = Number(product?.old_price)
  const cur = Number(product?.price)
  if (!old || old <= cur) return null
  return Math.round((1 - cur / old) * 100)
}

// EasyDonate descriptions are plain text decorated with "▎" bars and often start by repeating
// the product name; keep the full text for the details view and a clean first sentence for cards.
function cleanDescription(text) {
  return String(text || '').replace(/\r/g, '').replace(/^[ \t]*▎[ \t]?/gm, '').replace(/\n{3,}/g, '\n\n').trim()
}
function shortDescription(product) {
  const lines = cleanDescription(product.description).split('\n').map((l) => l.trim()).filter(Boolean)
  const name = String(product.name || '').toLowerCase()
  const firstWord = name.split(/[\s—(-]/)[0]
  const useful = lines.filter((l) => !(firstWord && l.toLowerCase().startsWith(firstWord)) && !/^[•\-]/.test(l))
  return (useful[0] || lines[0] || '').replace(/^[^\p{L}\p{N}]+/u, '')
}
const imageOk = (product) => Boolean(product?.image) && !brokenImages.value.has(product.id)
function onImageError(product) {
  brokenImages.value = new Set([...brokenImages.value, product.id])
}

function addToCart(id) {
  cart.value = { ...cart.value, [id]: (cart.value[id] || 0) + 1 }
}
function removeFromCart(id) {
  const n = cart.value[id] || 0
  const next = { ...cart.value }
  if (n <= 1) delete next[id]
  else next[id] = n - 1
  cart.value = next
}
function clearCart() {
  cart.value = {}
  coupon.value = ''
  couponOpen.value = false
}

function openDetails(product) {
  expandedProduct.value = product
  document.body.style.overflow = 'hidden'
}
function closeDetails() {
  expandedProduct.value = null
  document.body.style.overflow = ''
}
function onKey(e) {
  if (e.key === 'Escape' && expandedProduct.value) closeDetails()
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(String(dateStr).replace(' ', 'T') + 'Z')
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return t('shop.agoNow')
  if (diff < 3600) return `${Math.floor(diff / 60)} ${t('shop.agoMin')}`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('shop.agoHour')}`
  return `${Math.floor(diff / 86400)} ${t('shop.agoDay')}`
}
function pmLabel(type) {
  return { sbp: 'СБП', card: t('shop.payCard'), qiwi: 'QIWI', yoomoney: 'ЮMoney' }[type] || String(type || '').toUpperCase()
}

function scrollToCart() {
  cartEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function checkout() {
  if (!auth.isAuthenticated.value) {
    router.push({ path: '/login', query: { redirect: '/shop' } })
    return
  }
  if (!cartCount.value) return
  paying.value = true
  try {
    const result = await createPayment(auth.accessToken, cart.value, coupon.value.trim() || null)
    if (result?.url) {
      clearCart()
      window.location.href = result.url
    }
  } catch (err) {
    toastError(err.message || t('shop.checkoutError'))
  } finally {
    paying.value = false
  }
}

async function loadPage() {
  loading.value = true
  error.value = ''
  try {
    // The shop sells for the active server only while it is online and not under maintenance.
    await fetchServers()
    const srv = activeServer.value
    serverOnline.value = srv ? (!!srv.status?.online && !srv.maintenance) : true
    if (!serverOnline.value) return
    const [prods, pays] = await Promise.all([getDonateProducts(), getLastPayments().catch(() => [])])
    products.value = Array.isArray(prods) ? prods : []
    const paysArr = Array.isArray(pays) ? pays : (pays?.data ?? [])
    lastPayments.value = paysArr.slice(0, 8)
  } catch (err) {
    error.value = err.message || t('shop.loadError')
  } finally {
    loading.value = false
  }
}

// Keep the cart across a page reload or a trip to the login page.
const CART_KEY = 'voidrp_shop_cart_v1'
watch(cart, (value) => {
  try { sessionStorage.setItem(CART_KEY, JSON.stringify(value)) } catch { /* storage unavailable */ }
}, { deep: true })

onMounted(() => {
  try { cart.value = JSON.parse(sessionStorage.getItem(CART_KEY) || '{}') || {} } catch { cart.value = {} }
  window.addEventListener('keydown', onKey)
  loadPage()
  if (route.query.success) {
    toastSuccess(t('shop.paySuccess'))
    clearCart()
    router.replace({ path: '/shop' })
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <section class="sh-page" :style="accentVars">
    <div class="container-shell sh">
      <header class="sh-head">
        <div>
          <h1 class="sh-title">{{ t('shop.title') }}</h1>
          <p class="sh-sub">{{ t('shop.subtitle', { server: activeServerName }) }}</p>
          <ul class="sh-trust">
            <li><svg viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd"/></svg>{{ t('shop.trustSafe') }}</li>
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>{{ t('shop.trustInstant') }}</li>
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 11c0 5.65-7 10-7 10z"/></svg>{{ t('shop.trustSupport') }}</li>
          </ul>
        </div>
        <div v-if="nick" class="sh-deliver">
          <img :src="`/api/v1/public/player-head/${encodeURIComponent(nick)}`" alt="" class="sh-deliver__head" @error="(e) => { e.currentTarget.style.visibility = 'hidden' }" />
          <span>
            <span class="sh-deliver__label">{{ t('shop.deliverTo') }}</span>
            <b>{{ nick }}</b>
          </span>
        </div>
      </header>

      <div v-if="error" class="sh-note sh-note--err">
        <p>{{ error }}</p>
        <button type="button" class="sh-btn" @click="loadPage">{{ t('shop.serverOfflineRetry') }}</button>
      </div>

      <div v-if="serverOnline === false" class="sh-note">
        <p class="sh-note__title">{{ t('shop.serverMaintenanceNamed', { server: activeServerName }) }}</p>
        <p>{{ t('shop.serverOfflineDesc') }}</p>
        <button type="button" class="sh-btn" :disabled="loading" @click="loadPage">{{ t('shop.serverOfflineRetry') }}</button>
      </div>

      <div v-else class="sh-layout">
        <div class="sh-main">
          <div v-if="loading" class="sh-grid">
            <div v-for="i in 3" :key="i" class="skeleton sh-skel"></div>
          </div>

          <div v-else-if="!products.length && !error" class="sh-note">
            <p class="sh-note__title">{{ t('shop.comingSoon') }}</p>
            <p>{{ t('shop.comingSoonDesc') }}</p>
          </div>

          <div v-else class="sh-grid">
            <article v-for="product in products" :key="product.id" class="sh-card" :class="{ 'in-cart': cart[product.id] }">
              <button type="button" class="sh-card__media" :aria-label="t('shop.details')" @click="openDetails(product)">
                <img v-if="imageOk(product)" :src="product.image" alt="" loading="lazy" @error="onImageError(product)" />
                <span v-else class="sh-card__ph" aria-hidden="true">{{ product.name.slice(0, 1) }}</span>
                <span class="sh-badges">
                  <span v-if="product.id === topProductId" class="sh-badge sh-badge--hit">{{ t('shop.hit') }}</span>
                  <span v-if="discountPct(product)" class="sh-badge sh-badge--sale">−{{ discountPct(product) }}%</span>
                </span>
              </button>
              <div class="sh-card__body">
                <h2 class="sh-card__name">{{ product.name }}</h2>
                <p v-if="shortDescription(product)" class="sh-card__desc">{{ shortDescription(product) }}</p>
                <button v-if="product.description" type="button" class="sh-link" @click="openDetails(product)">{{ t('shop.whatsInside') }}</button>
                <div class="sh-card__foot">
                  <span class="sh-price">
                    <s v-if="discountPct(product)">{{ rub(product.old_price) }}</s>
                    <b>{{ rub(product.price) }}</b>
                  </span>
                  <span v-if="cart[product.id]" class="sh-stepper">
                    <button type="button" :aria-label="t('shop.decrease')" @click="removeFromCart(product.id)">−</button>
                    <span>{{ cart[product.id] }}</span>
                    <button type="button" :aria-label="t('shop.increase')" @click="addToCart(product.id)">+</button>
                  </span>
                  <button v-else type="button" class="sh-btn sh-btn--primary sh-btn--sm" @click="addToCart(product.id)">{{ t('shop.addToCart') }}</button>
                </div>
              </div>
            </article>
          </div>

        </div>

        <!-- cart -->
        <aside v-if="products.length" ref="cartEl" class="sh-cart-wrap">
          <div class="sh-cart">
            <div class="sh-cart__head">
              <h2 class="sh-h">{{ t('shop.cartTitle') }}</h2>
              <span v-if="cartCount" class="sh-count">{{ cartCount }}</span>
            </div>

            <div v-if="!cartCount" class="sh-cart__empty">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
              <p>{{ t('shop.cartEmptyHint') }}</p>
            </div>

            <template v-else>
              <ul class="sh-cart__items">
                <li v-for="product in cartItems" :key="product.id">
                  <span class="sh-cart__thumb">
                    <img v-if="imageOk(product)" :src="product.image" alt="" @error="onImageError(product)" />
                    <template v-else>{{ product.name.slice(0, 1) }}</template>
                  </span>
                  <span class="sh-cart__info">
                    <b>{{ product.name }}</b>
                    <span class="sh-stepper sh-stepper--sm">
                      <button type="button" :aria-label="t('shop.decrease')" @click="removeFromCart(product.id)">−</button>
                      <span>{{ cart[product.id] }}</span>
                      <button type="button" :aria-label="t('shop.increase')" @click="addToCart(product.id)">+</button>
                    </span>
                  </span>
                  <span class="sh-cart__sum">{{ rub(cart[product.id] * Number(product.price)) }}</span>
                </li>
              </ul>

              <button v-if="!couponOpen && !coupon" type="button" class="sh-link sh-link--small" @click="couponOpen = true">{{ t('shop.haveCoupon') }}</button>
              <input v-else v-model="coupon" class="sh-input" :placeholder="t('shop.couponPlaceholder')" autocapitalize="characters" spellcheck="false" />

              <div class="sh-total">
                <span>{{ t('shop.total') }}</span>
                <b>{{ rub(cartTotal) }}</b>
              </div>
              <p v-if="cartSaving" class="sh-saving">{{ t('shop.youSave', { n: rub(cartSaving) }) }}</p>
            </template>

            <button v-if="!auth.isAuthenticated.value" type="button" class="sh-btn sh-btn--primary sh-btn--wide" @click="router.push({ path: '/login', query: { redirect: '/shop' } })">{{ t('shop.loginToBuy') }}</button>
            <button v-else-if="cartCount" type="button" class="sh-btn sh-btn--primary sh-btn--wide" :disabled="paying" @click="checkout">
              <span v-if="paying" class="spinner"></span>
              {{ paying ? t('shop.paying') : t('shop.payFor', { n: cartTotal.toLocaleString(numLocale) }) }}
            </button>
            <button v-if="cartCount" type="button" class="sh-link sh-link--muted" @click="clearCart">{{ t('shop.clearCart') }}</button>

            <p v-if="auth.isAuthenticated.value && cartCount" class="sh-cart__fine">
              {{ t('shop.receiptTo', { email: auth.state.user?.email || '—' }) }}
            </p>
            <p class="sh-cart__fine">
              {{ t('shop.payAgreePre') }}<RouterLink to="/offer">{{ t('shop.payAgreeOffer') }}</RouterLink>{{ t('shop.payAgreePost') }}
            </p>
          </div>
        </aside>

        <div class="sh-after">
          <section v-if="lastPayments.length" class="sh-recent">
            <h2 class="sh-h">{{ t('shop.recentTitle') }}</h2>
            <ul class="sh-recent__list">
              <li v-for="pay in lastPayments" :key="pay.id">
                <img v-if="pay.customer" :src="`/api/v1/public/player-head/${encodeURIComponent(pay.customer)}`" alt="" class="sh-recent__head" loading="lazy" @error="(e) => { e.currentTarget.style.visibility = 'hidden' }" />
                <span v-else class="sh-recent__head sh-recent__head--anon" aria-hidden="true">?</span>
                <span class="sh-recent__text">
                  <b :class="{ 'sh-anon': !pay.customer }">{{ pay.customer || t('shop.hiddenBuyer') }}</b>
                  <span>{{ (pay.products || []).map((p) => p.name).join(', ') }}</span>
                </span>
                <span class="sh-recent__meta">
                  <b>{{ rub(pay.cost) }}</b>
                  <span>{{ pmLabel(pay.payment_type) }} · {{ timeAgo(pay.created_at) }}</span>
                </span>
              </li>
            </ul>
          </section>

          <p class="sh-legal">
            {{ t('shop.legalPre') }} <a href="https://easydonate.ru" target="_blank" rel="noreferrer">EasyDonate</a>{{ t('shop.legalMid') }} <RouterLink to="/offer">{{ t('shop.legalOffer') }}</RouterLink>.
          </p>
        </div>
      </div>
    </div>

    <!-- phone: the cart is below the products, so keep the total and the way to it in reach -->
    <Transition name="sh-bar">
      <div v-if="cartCount && !expandedProduct" class="sh-mobilebar">
        <button type="button" class="sh-mobilebar__inner" @click="scrollToCart">
          <span>{{ t('shop.itemsInCart', { n: cartCount }) }}</span>
          <b>{{ rub(cartTotal) }}</b>
          <span class="sh-mobilebar__go">{{ t('shop.toCart') }}</span>
        </button>
      </div>
    </Transition>

    <Teleport to="body">
      <Transition name="sh-modal">
        <div v-if="expandedProduct" class="sh-modal" role="dialog" aria-modal="true" :aria-label="expandedProduct.name" :style="accentVars">
          <div class="sh-modal__backdrop" @click="closeDetails"></div>
          <div class="sh-modal__panel">
            <button type="button" class="sh-modal__close" :aria-label="t('shop.close')" @click="closeDetails">×</button>
            <div class="sh-modal__top">
              <span class="sh-modal__img">
                <img v-if="imageOk(expandedProduct)" :src="expandedProduct.image" alt="" @error="onImageError(expandedProduct)" />
                <template v-else>{{ expandedProduct.name.slice(0, 1) }}</template>
              </span>
              <div>
                <h2 class="sh-modal__title">{{ expandedProduct.name }}</h2>
                <span class="sh-price sh-price--big">
                  <s v-if="discountPct(expandedProduct)">{{ rub(expandedProduct.old_price) }}</s>
                  <b>{{ rub(expandedProduct.price) }}</b>
                  <span v-if="discountPct(expandedProduct)" class="sh-badge sh-badge--sale">−{{ discountPct(expandedProduct) }}%</span>
                </span>
              </div>
            </div>
            <div class="sh-modal__desc">{{ cleanDescription(expandedProduct.description) }}</div>
            <div class="sh-modal__foot">
              <span v-if="cart[expandedProduct.id]" class="sh-stepper">
                <button type="button" :aria-label="t('shop.decrease')" @click="removeFromCart(expandedProduct.id)">−</button>
                <span>{{ cart[expandedProduct.id] }}</span>
                <button type="button" :aria-label="t('shop.increase')" @click="addToCart(expandedProduct.id)">+</button>
              </span>
              <button v-else type="button" class="sh-btn sh-btn--primary" @click="addToCart(expandedProduct.id)">{{ t('shop.addToCart') }}</button>
              <button v-if="cart[expandedProduct.id]" type="button" class="sh-btn" @click="closeDetails(); scrollToCart()">{{ t('shop.toCart') }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.sh-page { padding-block: 28px 96px; }
.sh { --s-surface: rgba(19, 16, 33, 0.8); --s-line: rgba(255, 255, 255, 0.08); --s-line-2: rgba(255, 255, 255, 0.14); --s-text: #eeecf7; --s-muted: #9d99b6; color: var(--s-text); display: flex; flex-direction: column; gap: 20px; }

.sh-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; }
.sh-title { margin: 0; font-size: clamp(1.9rem, 1.3rem + 1.5vw, 2.7rem); font-weight: 900; letter-spacing: -0.025em; line-height: 1.05; }
.sh-sub { margin: 8px 0 0; max-width: 60ch; font-size: 1rem; line-height: 1.5; color: var(--s-muted); }
.sh-trust { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; }
.sh-trust li { display: inline-flex; align-items: center; gap: 6px; font-size: 0.86rem; color: #cfcbe3; }
.sh-trust svg { width: 15px; height: 15px; fill: var(--acc-pale, #c4b5fd); }
.sh-trust li:nth-child(2) svg { fill: none; stroke: var(--acc-pale, #c4b5fd); stroke-width: 2; stroke-linejoin: round; }
.sh-trust li:nth-child(3) svg { fill: none; stroke: var(--acc-pale, #c4b5fd); stroke-width: 2; stroke-linejoin: round; }
.sh-deliver { display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; border-radius: 14px; border: 1px solid var(--s-line); background: var(--s-surface); }
.sh-deliver__head { width: 36px; height: 36px; border-radius: 9px; image-rendering: pixelated; background: #1a1530; }
.sh-deliver > span { display: flex; flex-direction: column; }
.sh-deliver__label { font-size: 0.78rem; color: var(--s-muted); }

.sh-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; grid-template-areas: 'main cart' 'after cart'; gap: 24px 20px; align-items: start; }
.sh-main { grid-area: main; }
.sh-cart-wrap { grid-area: cart; align-self: start; }
.sh-after { grid-area: after; display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.sh-main { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.sh-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 14px; }
.sh-skel { height: 420px; border-radius: 18px; }

.sh-card { display: flex; flex-direction: column; border-radius: 18px; overflow: hidden; border: 1px solid var(--s-line); background: var(--s-surface); transition: border-color 0.2s, box-shadow 0.2s; }
.sh-card:hover { border-color: var(--s-line-2); }
.sh-card.in-cart { border-color: rgba(var(--acc-rgb, 139, 92, 246), 0.55); box-shadow: 0 16px 40px -24px rgba(var(--acc-rgb, 139, 92, 246), 0.8); }
.sh-card__media { position: relative; aspect-ratio: 1 / 1; padding: 0; border: 0; cursor: pointer; overflow: hidden; background: radial-gradient(90% 90% at 30% 20%, rgba(var(--acc-rgb, 139, 92, 246), 0.3), transparent 70%), #120f22; display: grid; place-items: center; }
.sh-card__media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s; }
.sh-card:hover .sh-card__media img { transform: scale(1.04); }
.sh-card__ph { font-size: 4rem; font-weight: 900; color: rgba(255, 255, 255, 0.14); }
.sh-badges { position: absolute; top: 10px; left: 10px; display: flex; gap: 6px; }
.sh-badge { display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 999px; font-size: 0.78rem; font-weight: 800; }
.sh-badge--hit { color: var(--acc-contrast, #fff); background: var(--acc, #8b5cf6); }
.sh-badge--sale { color: #1b1405; background: #f2c14e; }
.sh-card__body { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px 16px; flex: 1; }
.sh-card__name { margin: 0; font-size: 1.04rem; font-weight: 800; line-height: 1.3; }
.sh-card__desc { margin: 0; font-size: 0.88rem; line-height: 1.5; color: var(--s-muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.sh-card__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--s-line); }

.sh-price { display: inline-flex; align-items: baseline; flex-wrap: wrap; gap: 2px 8px; }
.sh-price s { font-size: 0.84rem; color: var(--s-muted); }
.sh-price b { font-size: 1.25rem; font-weight: 900; font-variant-numeric: tabular-nums; }
.sh-price--big b { font-size: 1.7rem; }

.sh-link { align-self: flex-start; padding: 0; border: 0; background: none; font: inherit; font-size: 0.86rem; font-weight: 700; color: var(--acc-pale, #c4b5fd); cursor: pointer; }
.sh-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.sh-link--small { font-size: 0.84rem; }
.sh-link--muted { align-self: center; color: var(--s-muted); font-weight: 600; font-size: 0.84rem; }

.sh-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 16px; border-radius: 12px; font: inherit; font-size: 0.92rem; font-weight: 700; color: var(--s-text); background: rgba(255, 255, 255, 0.06); border: 1px solid var(--s-line-2); cursor: pointer; white-space: nowrap; transition: background-color 0.15s, filter 0.15s; }
.sh-btn:hover { background: rgba(255, 255, 255, 0.1); }
.sh-btn:disabled { opacity: 0.55; cursor: default; }
.sh-btn--primary { color: var(--acc-contrast, #fff); background: linear-gradient(135deg, var(--acc, #8b5cf6), var(--acc-deep, #6d28d9)); border-color: transparent; box-shadow: 0 8px 24px -10px rgba(var(--acc-rgb, 139, 92, 246), 0.7); }
.sh-btn--primary:hover { background: linear-gradient(135deg, var(--acc, #8b5cf6), var(--acc-deep, #6d28d9)); filter: brightness(1.08); }
.sh-btn--sm { height: 36px; padding: 0 14px; font-size: 0.86rem; border-radius: 10px; }
.sh-btn--wide { width: 100%; height: 48px; font-size: 1rem; }
.sh-btn:focus-visible, .sh-link:focus-visible, .sh-card__media:focus-visible, .sh-stepper button:focus-visible, .sh-modal__close:focus-visible, .sh-mobilebar__inner:focus-visible { outline: 2px solid var(--acc-pale, #c4b5fd); outline-offset: 2px; }

.sh-stepper { display: inline-flex; align-items: center; height: 36px; border-radius: 10px; border: 1px solid rgba(var(--acc-rgb, 139, 92, 246), 0.5); background: rgba(var(--acc-rgb, 139, 92, 246), 0.12); overflow: hidden; }
.sh-stepper button { width: 34px; height: 100%; border: 0; background: transparent; font: inherit; font-size: 1.1rem; font-weight: 800; color: var(--s-text); cursor: pointer; }
.sh-stepper button:hover { background: rgba(255, 255, 255, 0.08); }
.sh-stepper > span { min-width: 22px; text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; }
.sh-stepper--sm { height: 28px; border-radius: 8px; }
.sh-stepper--sm button { width: 26px; font-size: 0.95rem; }

.sh-h { margin: 0; font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em; }

/* cart */
.sh-cart-wrap { position: sticky; top: 96px; min-width: 0; }
.sh-cart { display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 18px; border: 1px solid var(--s-line); background: var(--s-surface); backdrop-filter: blur(18px); }
.sh-cart__head { display: flex; align-items: center; justify-content: space-between; }
.sh-count { min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px; display: grid; place-items: center; font-size: 0.8rem; font-weight: 800; color: var(--acc-contrast, #fff); background: var(--acc, #8b5cf6); }
.sh-cart__empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 8px; text-align: center; }
.sh-cart__empty svg { width: 34px; height: 34px; fill: none; stroke: var(--s-muted); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; opacity: 0.7; }
.sh-cart__empty p { margin: 0; font-size: 0.9rem; line-height: 1.5; color: var(--s-muted); }
.sh-cart__items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.sh-cart__items li { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 0; border-top: 1px solid var(--s-line); }
.sh-cart__items li:first-child { border-top: 0; padding-top: 0; }
.sh-cart__thumb { width: 44px; height: 44px; border-radius: 10px; overflow: hidden; display: grid; place-items: center; font-weight: 900; color: rgba(255, 255, 255, 0.3); background: #120f22; }
.sh-cart__thumb img { width: 100%; height: 100%; object-fit: cover; }
.sh-cart__info { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-width: 0; }
.sh-cart__info b { font-size: 0.88rem; line-height: 1.3; }
.sh-cart__sum { font-size: 0.92rem; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }
.sh-input { width: 100%; height: 40px; padding: 0 12px; border-radius: 10px; font: inherit; font-size: 0.9rem; color: var(--s-text); background: rgba(0, 0, 0, 0.28); border: 1px solid var(--s-line-2); outline: none; text-transform: uppercase; }
.sh-input::placeholder { text-transform: none; color: rgba(157, 153, 182, 0.6); }
.sh-input:focus { border-color: rgba(var(--acc-rgb, 139, 92, 246), 0.6); }
.sh-total { display: flex; align-items: baseline; justify-content: space-between; padding-top: 12px; border-top: 1px solid var(--s-line); }
.sh-total span { color: var(--s-muted); font-size: 0.92rem; }
.sh-total b { font-size: 1.5rem; font-weight: 900; font-variant-numeric: tabular-nums; }
.sh-saving { margin: -6px 0 0; text-align: right; font-size: 0.84rem; font-weight: 700; color: #f2c14e; }
.sh-cart__fine { margin: 0; font-size: 0.78rem; line-height: 1.5; color: var(--s-muted); }
.sh-cart__fine a { color: var(--acc-pale, #c4b5fd); text-decoration: underline; text-underline-offset: 2px; }

/* recent purchases */
.sh-recent { display: flex; flex-direction: column; gap: 12px; }
.sh-recent__list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.sh-recent__list li { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 14px; border: 1px solid var(--s-line); background: rgba(19, 16, 33, 0.6); }
.sh-recent__head { width: 34px; height: 34px; border-radius: 8px; image-rendering: pixelated; background: #1a1530; }
.sh-recent__head--anon { display: grid; place-items: center; font-weight: 800; color: rgba(255, 255, 255, 0.35); }
.sh-anon { color: var(--s-muted); font-weight: 600; }
.sh-recent__text, .sh-recent__meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sh-recent__text b { font-size: 0.9rem; }
.sh-recent__text span { font-size: 0.8rem; color: var(--s-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-recent__meta { align-items: flex-end; }
.sh-recent__meta b { font-size: 0.9rem; color: var(--acc-pale, #c4b5fd); font-variant-numeric: tabular-nums; }
.sh-recent__meta span { font-size: 0.76rem; color: var(--s-muted); white-space: nowrap; }

.sh-legal { margin: 0; font-size: 0.8rem; line-height: 1.6; color: var(--s-muted); }
.sh-legal a { color: var(--acc-pale, #c4b5fd); text-decoration: underline; text-underline-offset: 2px; }

.sh-note { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 20px; text-align: center; border-radius: 20px; border: 1px solid var(--s-line); background: var(--s-surface); color: var(--s-muted); }
.sh-note p { margin: 0; max-width: 48ch; line-height: 1.5; }
.sh-note__title { font-size: 1.2rem; font-weight: 800; color: var(--s-text); }
.sh-note--err { border-color: rgba(248, 113, 113, 0.3); }

/* phone cart bar */
.sh-mobilebar { display: none; }

/* details */
.sh-modal { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; color: #eeecf7; }
.sh-modal__backdrop { position: absolute; inset: 0; background: rgba(4, 3, 10, 0.72); backdrop-filter: blur(4px); }
.sh-modal__panel { position: relative; width: min(560px, 100%); max-height: min(88dvh, 760px); overflow-y: auto; padding: 24px; border-radius: 22px; background: #15122a; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6); }
.sh-modal__close { position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; border-radius: 999px; border: 0; font-size: 1.5rem; line-height: 1; color: #eeecf7; background: rgba(255, 255, 255, 0.08); cursor: pointer; }
.sh-modal__close:hover { background: rgba(255, 255, 255, 0.14); }
.sh-modal__top { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 16px; align-items: center; padding-right: 36px; }
.sh-modal__img { width: 96px; height: 96px; border-radius: 16px; overflow: hidden; display: grid; place-items: center; font-size: 2.4rem; font-weight: 900; color: rgba(255, 255, 255, 0.2); background: #0e0b1c; }
.sh-modal__img img { width: 100%; height: 100%; object-fit: cover; }
.sh-modal__title { margin: 0 0 6px; font-size: 1.35rem; font-weight: 900; line-height: 1.2; }
.sh-modal__desc { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08); white-space: pre-line; font-size: 0.95rem; line-height: 1.65; color: #d6d2ea; overflow-wrap: anywhere; }
.sh-modal__foot { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.sh-modal-enter-active, .sh-modal-leave-active { transition: opacity 0.18s; }
.sh-modal-enter-active .sh-modal__panel, .sh-modal-leave-active .sh-modal__panel { transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1); }
.sh-modal-enter-from, .sh-modal-leave-to { opacity: 0; }
.sh-modal-enter-from .sh-modal__panel { transform: translateY(16px) scale(0.98); }

@media (max-width: 1024px) {
  .sh-layout { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'main' 'cart' 'after'; }
  .sh-cart-wrap { position: static; scroll-margin-top: 90px; }
  .sh-mobilebar { display: flex; position: fixed; left: 0; right: 0; bottom: 12px; z-index: 40; justify-content: center; padding: 0 12px; pointer-events: none; }
  .sh-mobilebar__inner { pointer-events: auto; display: flex; align-items: center; gap: 12px; width: min(520px, 100%); height: 56px; padding: 0 8px 0 18px; border-radius: 16px; border: 1px solid rgba(var(--acc-rgb, 139, 92, 246), 0.45); background: rgba(22, 18, 40, 0.95); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5); backdrop-filter: blur(12px); font: inherit; color: #eeecf7; cursor: pointer; }
  .sh-mobilebar__inner > span:first-child { font-size: 0.9rem; color: #cfcbe3; }
  .sh-mobilebar__inner b { margin-left: auto; font-size: 1.1rem; font-variant-numeric: tabular-nums; }
  .sh-mobilebar__go { height: 40px; padding: 0 14px; border-radius: 11px; display: grid; place-items: center; font-weight: 800; font-size: 0.9rem; color: var(--acc-contrast, #fff); background: var(--acc, #8b5cf6); }
  .sh-bar-enter-active, .sh-bar-leave-active { transition: opacity 0.2s, transform 0.2s; }
  .sh-bar-enter-from, .sh-bar-leave-to { opacity: 0; transform: translateY(16px); }
}
@media (max-width: 640px) {
  .sh-page { padding-block: 16px 96px; }
  .sh-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .sh-card__body { padding: 10px 12px 12px; gap: 6px; }
  .sh-card__name { font-size: 0.92rem; }
  .sh-card__desc { display: none; }
  .sh-card__foot { flex-direction: column; align-items: stretch; gap: 8px; padding-top: 10px; }
  .sh-card__foot .sh-btn, .sh-card__foot .sh-stepper { width: 100%; justify-content: space-between; }
  .sh-card__foot .sh-btn { justify-content: center; }
  .sh-price b { font-size: 1.1rem; }
  .sh-recent__list { grid-template-columns: minmax(0, 1fr); }
  .sh-deliver { width: 100%; }
  .sh-modal { align-items: flex-end; padding: 0; }
  .sh-modal__panel { width: 100%; border-radius: 22px 22px 0 0; max-height: 90dvh; }
  .sh-modal__top { grid-template-columns: 72px minmax(0, 1fr); }
  .sh-modal__img { width: 72px; height: 72px; }
}
@media (prefers-reduced-motion: reduce) {
  .sh-card__media img, .sh-btn, .sh-card { transition: none; }
}
</style>
