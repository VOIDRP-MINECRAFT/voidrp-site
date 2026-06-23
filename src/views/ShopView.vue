<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { createPayment, getDonateProducts, getLastPayments } from '../services/donateApi'
import { apiRequest } from '../services/apiBase'
import { toastError, toastSuccess } from '../services/toast'
import { useAuthStore } from '../stores/authStore'

const { t } = useI18n()
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
const serverOnline = ref(null)
const expandedProduct = ref(null)
const selectedCategory = ref('all')

const categories = computed(() => {
  const cats = [...new Set(products.value.map((p) => p.category).filter(Boolean))]
  return cats
})

const filteredProducts = computed(() => {
  if (selectedCategory.value === 'all' || !categories.value.length) return products.value
  return products.value.filter((p) => p.category === selectedCategory.value)
})

const cartItems = computed(() => products.value.filter((p) => cart.value[p.id] > 0))
const cartCount = computed(() => Object.values(cart.value).reduce((s, n) => s + n, 0))
const cartTotal = computed(() =>
  products.value.reduce((sum, p) => sum + (cart.value[p.id] || 0) * Number(p.price || 0), 0),
)

function discountPct(product) {
  const old = Number(product.old_price)
  const cur = Number(product.price)
  if (!old || old <= cur) return null
  return Math.round((1 - cur / old) * 100)
}

function addToCart(id) {
  cart.value = { ...cart.value, [id]: (cart.value[id] || 0) + 1 }
}

function removeFromCart(id) {
  const n = cart.value[id] || 0
  if (n <= 1) {
    const c = { ...cart.value }
    delete c[id]
    cart.value = c
  } else {
    cart.value = { ...cart.value, [id]: n - 1 }
  }
}

function clearCart() {
  cart.value = {}
  coupon.value = ''
}

function openDetails(product) {
  expandedProduct.value = product
  document.body.style.overflow = 'hidden'
}

function closeDetails() {
  expandedProduct.value = null
  document.body.style.overflow = ''
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr.replace(' ', 'T') + 'Z')
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return Math.floor(diff / 60) + ' мин назад'
  if (diff < 86400) return Math.floor(diff / 3600) + ' ч назад'
  return Math.floor(diff / 86400) + ' дн назад'
}

function pmLabel(type) {
  return { sbp: 'СБП', card: 'Карта', qiwi: 'QIWI', yoomoney: 'ЮMoney' }[type] || (type || '').toUpperCase()
}

function pmClass(type) {
  return {
    sbp: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    card: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    yoomoney: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  }[type] || 'bg-slate-700/50 text-slate-400 border-slate-600/30'
}

async function checkout() {
  if (!auth.isAuthenticated.value) {
    router.push({ path: '/login', query: { redirect: '/shop' } })
    return
  }
  if (!cartCount.value) return
  paying.value = true
  try {
    const result = await createPayment(auth.accessToken, cart.value, coupon.value || null)
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
    const statusRes = await apiRequest('/server/status').catch(() => ({ online: false }))
    serverOnline.value = !!statusRes?.online
    if (!serverOnline.value) return

    const [prods, pays] = await Promise.all([
      getDonateProducts(),
      getLastPayments().catch(() => []),
    ])
    products.value = Array.isArray(prods) ? prods : []
    const paysArr = Array.isArray(pays) ? pays : (pays?.data ?? [])
    lastPayments.value = paysArr.slice(0, 10)
  } catch (err) {
    error.value = err.message || t('shop.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadPage()
  if (route.query.success) {
    toastSuccess(t('shop.paySuccess'))
    router.replace({ path: '/shop' })
  }
})
</script>

<template>
  <section class="py-8 md:py-10 auth-page">
    <div class="container-shell space-y-6 page-entry">

      <!-- Hero header -->
      <div class="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 md:p-8 ring-1 ring-slate-700/50">
        <div class="pointer-events-none absolute -top-10 -right-10 h-56 w-56 rounded-full bg-violet-600/10 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-8 left-8 h-40 w-40 rounded-full bg-indigo-600/8 blur-2xl" />
        <div class="relative">
          <div class="section-kicker mb-2">{{ t('shop.kicker') }}</div>
          <h1 class="text-3xl font-black tracking-tight text-slate-50 md:text-4xl">{{ t('shop.title') }}</h1>
          <p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">{{ t('shop.desc') }}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <span class="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-700/60">
              <svg class="h-3 w-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd"/></svg>
              Безопасная оплата
            </span>
            <span class="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-700/60">
              <svg class="h-3 w-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Мгновенная выдача
            </span>
            <span class="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-700/60">
              <svg class="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              Реальные привилегии
            </span>
          </div>
        </div>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <!-- Server offline -->
      <div v-if="serverOnline === false" class="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 ring-1 ring-slate-700/50 p-8 flex flex-col items-center gap-5 text-center">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.06)_0%,transparent_70%)]" />
        <div class="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800 ring-1 ring-red-500/20">
          <svg class="h-10 w-10 text-red-500/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
            <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
            <line x1="17" y1="5" x2="7" y2="19"/>
          </svg>
        </div>
        <div class="relative space-y-1.5">
          <p class="text-xl font-black text-slate-100">{{ t('shop.serverOfflineTitle') }}</p>
          <p class="max-w-sm text-sm leading-relaxed text-slate-500">{{ t('shop.serverOfflineDesc') }}</p>
        </div>
        <button class="relative flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-slate-300 ring-1 ring-slate-700 transition hover:bg-slate-700 hover:text-slate-100 active:scale-95" :disabled="loading" @click="loadPage">
          <svg class="h-4 w-4" :class="loading ? 'animate-spin' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          {{ t('shop.serverOfflineRetry') }}
        </button>
      </div>

      <!-- Main layout -->
      <div v-if="serverOnline !== false" class="flex flex-col gap-5 lg:flex-row lg:items-start">

        <!-- Product section -->
        <div class="min-w-0 flex-1">

          <!-- Skeleton -->
          <div v-if="loading" class="grid gap-4 sm:grid-cols-2">
            <div v-for="i in 2" :key="i" class="skeleton h-72 rounded-[20px]" />
          </div>

          <!-- Empty -->
          <div v-else-if="!products.length" class="surface-card flex flex-col items-center gap-3 p-12 text-center">
            <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 ring-1 ring-slate-700">
              <svg class="h-8 w-8 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" /></svg>
            </div>
            <p class="text-base font-bold text-slate-200">{{ t('shop.comingSoon') }}</p>
            <p class="text-sm text-slate-500">{{ t('shop.comingSoonDesc') }}</p>
          </div>

          <template v-else>
            <!-- Category tabs -->
            <div v-if="categories.length > 1" class="mb-4 flex flex-wrap gap-2">
              <button
                class="rounded-full px-4 py-1.5 text-xs font-bold transition"
                :class="selectedCategory === 'all'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                  : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700 hover:text-slate-200 hover:bg-slate-700'"
                @click="selectedCategory = 'all'"
              >{{ t('shop.categoryAll') }}</button>
              <button
                v-for="cat in categories"
                :key="cat"
                class="rounded-full px-4 py-1.5 text-xs font-bold transition"
                :class="selectedCategory === cat
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                  : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700 hover:text-slate-200 hover:bg-slate-700'"
                @click="selectedCategory = cat"
              >{{ cat }}</button>
            </div>

            <!-- Featured card (single product) -->
            <template v-if="filteredProducts.length === 1">
              <article
                v-for="product in filteredProducts"
                :key="product.id"
                class="group relative overflow-hidden rounded-[20px] bg-gradient-to-br from-slate-800 to-slate-900 ring-1 transition-all duration-300"
                :class="cart[product.id] ? 'ring-violet-500/60 shadow-lg shadow-violet-500/10' : 'ring-slate-700/50 hover:ring-slate-600/70'"
              >
                <div class="flex flex-col md:flex-row">
                  <!-- Image -->
                  <div class="relative w-full overflow-hidden md:w-64 md:shrink-0">
                    <div class="aspect-square md:aspect-auto md:h-full">
                      <img v-if="product.image" :src="product.image" :alt="product.name" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div v-else class="flex h-full w-full min-h-[200px] items-center justify-center bg-slate-900">
                        <svg class="h-16 w-16 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>
                      </div>
                    </div>
                    <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-slate-900/30" />
                    <div v-if="discountPct(product)" class="absolute left-3 top-3">
                      <span class="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-amber-950 shadow-lg shadow-amber-400/20">{{ t('shop.off', { n: discountPct(product) }) }}</span>
                    </div>
                    <span v-if="cart[product.id]" class="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white shadow-lg">{{ cart[product.id] }}</span>
                  </div>

                  <!-- Info -->
                  <div class="flex flex-1 flex-col justify-between gap-4 p-5 md:p-6">
                    <div class="space-y-2">
                      <div class="flex items-start justify-between gap-3">
                        <p class="text-xl font-black leading-tight text-slate-50 md:text-2xl">{{ product.name }}</p>
                        <span v-if="product.category" class="shrink-0 rounded-full bg-violet-600/15 px-2.5 py-0.5 text-xs font-bold text-violet-400 ring-1 ring-violet-500/20">{{ product.category }}</span>
                      </div>
                      <p v-if="product.description" class="text-sm leading-relaxed text-slate-400 line-clamp-3">{{ product.description }}</p>
                      <button
                        v-if="product.description"
                        class="flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition"
                        @click="openDetails(product)"
                      >
                        {{ t('shop.details') }}
                        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                      </button>
                    </div>

                    <div class="flex flex-wrap items-end justify-between gap-4">
                      <div class="space-y-0.5">
                        <div v-if="discountPct(product)" class="flex items-center gap-2">
                          <span class="text-sm text-slate-600 line-through">{{ Number(product.old_price).toLocaleString('ru') }} ₽</span>
                          <span class="rounded bg-amber-400/10 px-1.5 py-0.5 text-xs font-bold text-amber-400">{{ t('shop.discountBadge') }}</span>
                        </div>
                        <div class="text-3xl font-black tracking-tight text-slate-50">{{ Number(product.price).toLocaleString('ru') }} <span class="text-xl text-slate-400">₽</span></div>
                      </div>
                      <div class="flex items-center gap-2">
                        <button v-if="cart[product.id]" class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700 text-lg font-bold text-slate-200 transition hover:bg-slate-600 active:scale-95" @click="removeFromCart(product.id)">−</button>
                        <span v-if="cart[product.id]" class="w-8 text-center text-sm font-black text-slate-100">{{ cart[product.id] }}</span>
                        <button class="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition active:scale-95" :class="cart[product.id] ? 'bg-violet-700 hover:bg-violet-600' : 'bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/20'" @click="addToCart(product.id)">
                          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                          {{ t('shop.buyBtn') }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </template>

            <!-- Grid (multiple products) -->
            <div v-else class="grid gap-4 grid-cols-2 sm:grid-cols-3">
              <article
                v-for="product in filteredProducts"
                :key="product.id"
                class="group relative flex flex-col overflow-hidden rounded-[20px] bg-slate-800/60 ring-1 transition-all duration-200"
                :class="cart[product.id] ? 'ring-violet-500/60 shadow-lg shadow-violet-500/10' : 'ring-slate-700/50 hover:ring-slate-600/60 hover:-translate-y-0.5'"
              >
                <!-- Image -->
                <div class="relative aspect-square w-full overflow-hidden bg-slate-900">
                  <img v-if="product.image" :src="product.image" :alt="product.name" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div v-else class="flex h-full items-center justify-center">
                    <svg class="h-10 w-10 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>
                  </div>
                  <div v-if="discountPct(product)" class="absolute left-2 top-2">
                    <span class="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-amber-950">{{ t('shop.off', { n: discountPct(product) }) }}</span>
                  </div>
                  <span v-if="cart[product.id]" class="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white">{{ cart[product.id] }}</span>
                  <span v-if="product.category" class="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-violet-300 backdrop-blur-sm">{{ product.category }}</span>
                </div>

                <!-- Info -->
                <div class="flex flex-1 flex-col gap-2 p-3">
                  <p class="flex-1 text-sm font-bold leading-snug text-slate-100">{{ product.name }}</p>
                  <p v-if="product.description" class="text-xs leading-relaxed text-slate-500 line-clamp-2">{{ product.description }}</p>
                  <button
                    v-if="product.description"
                    class="self-start text-xs font-semibold text-violet-400 hover:text-violet-300 transition"
                    @click="openDetails(product)"
                  >{{ t('shop.details') }} →</button>
                  <div class="flex items-end justify-between gap-2 border-t border-slate-700/40 pt-2">
                    <div>
                      <div v-if="discountPct(product)" class="text-xs text-slate-600 line-through">{{ Number(product.old_price).toLocaleString('ru') }} ₽</div>
                      <span class="text-sm font-black text-slate-100">{{ Number(product.price).toLocaleString('ru') }} ₽</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <button v-if="cart[product.id]" class="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-700 text-sm font-bold text-slate-200 transition hover:bg-slate-600" @click="removeFromCart(product.id)">−</button>
                      <button class="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-violet-500 active:scale-95" @click="addToCart(product.id)">{{ cart[product.id] ? '+' : t('shop.buyBtn') }}</button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </template>
        </div>

        <!-- Cart sidebar -->
        <div v-if="products.length" class="w-full shrink-0 lg:w-72">
          <div class="sticky top-20 overflow-hidden rounded-[20px] bg-slate-800/60 ring-1 ring-slate-700/50">
            <div class="flex items-center gap-2 border-b border-slate-700/40 px-4 py-3.5">
              <svg class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
              <h2 class="text-sm font-black text-slate-100">{{ t('shop.cartTitle') }}</h2>
              <span v-if="cartCount" class="ml-auto rounded-full bg-violet-600 px-2 py-0.5 text-xs font-black text-white">{{ cartCount }}</span>
            </div>
            <div class="p-4 space-y-4">
              <p v-if="!cartCount" class="py-4 text-center text-xs text-slate-500">{{ t('shop.cartEmpty') }}</p>
              <div v-else class="space-y-0 divide-y divide-slate-700/30">
                <div v-for="product in cartItems" :key="product.id" class="flex flex-col gap-1.5 py-2.5">
                  <p class="text-xs font-semibold leading-snug text-slate-200">{{ product.name }}</p>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <button class="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold text-slate-300 transition hover:bg-slate-600" @click="removeFromCart(product.id)">−</button>
                      <span class="w-5 text-center text-xs font-black text-slate-100">{{ cart[product.id] }}</span>
                      <button class="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold text-slate-300 transition hover:bg-slate-600" @click="addToCart(product.id)">+</button>
                    </div>
                    <span class="text-xs font-bold text-slate-100">{{ (cart[product.id] * Number(product.price)).toLocaleString('ru') }} ₽</span>
                  </div>
                </div>
              </div>
              <input v-if="cartCount" v-model="coupon" class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-500 transition" :placeholder="t('shop.couponPlaceholder')" />
              <div v-if="cartCount" class="flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-2.5">
                <span class="text-xs font-medium text-slate-400">{{ t('shop.total') }}</span>
                <span class="text-lg font-black text-slate-50">{{ cartTotal.toLocaleString('ru') }} ₽</span>
              </div>
              <button v-if="!auth.isAuthenticated.value" class="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500 shadow-lg shadow-violet-600/20 active:scale-[.98]" @click="router.push({ path: '/login', query: { redirect: '/shop' } })">{{ t('shop.loginToBuy') }}</button>
              <button v-else class="w-full rounded-xl py-2.5 text-sm font-bold text-white transition active:scale-[.98]" :class="cartCount && !paying ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-600/20' : 'bg-slate-700 opacity-50 cursor-default'" :disabled="!cartCount || paying" @click="checkout">
                <span v-if="paying" class="flex items-center justify-center gap-2">
                  <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  {{ t('shop.paying') }}
                </span>
                <span v-else-if="!cartCount">{{ t('shop.cartEmpty') }}</span>
                <span v-else>{{ t('shop.payFor', { n: cartTotal.toLocaleString('ru') }) }}</span>
              </button>
              <button v-if="cartCount" class="w-full text-xs text-slate-600 transition hover:text-slate-400" @click="clearCart">{{ t('shop.clearCart') }}</button>
              <div v-if="auth.isAuthenticated.value" class="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3 text-xs space-y-1.5">
                <p class="font-medium text-slate-400">{{ t('shop.deliverTo') }}</p>
                <div class="flex items-center gap-2">
                  <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-xs font-black text-violet-300">{{ (auth.state.playerAccount?.minecraft_nickname || '?')[0].toUpperCase() }}</div>
                  <span class="font-bold text-slate-200">{{ auth.state.playerAccount?.minecraft_nickname || '—' }}</span>
                </div>
                <p class="text-slate-600">Квитанция: {{ auth.state.user?.email || '—' }}</p>
              </div>
              <p class="border-t border-slate-700/40 pt-3 text-xs leading-relaxed text-slate-600">
                Нажимая «Оплатить», вы соглашаетесь с <RouterLink to="/offer" class="prose-link">офертой</RouterLink>. Цифровые товары не подлежат возврату.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Last payments -->
      <div v-if="lastPayments.length">
        <h2 class="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
          <span class="h-px flex-1 bg-slate-800" />{{ t('shop.recentTitle') }}<span class="h-px flex-1 bg-slate-800" />
        </h2>
        <div class="surface-card overflow-hidden p-0">
          <div class="divide-y divide-slate-700/30">
            <div v-for="pay in lastPayments" :key="pay.id" class="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-800/40">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/30 to-indigo-600/20 ring-1 ring-slate-700 text-xs font-black text-violet-300">{{ (pay.customer || '?')[0].toUpperCase() }}</div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold text-slate-100">{{ pay.customer }}</p>
                <p class="truncate text-xs text-slate-500">{{ (pay.products || []).map((p) => p.name).join(', ') }}</p>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-1">
                <span class="text-sm font-black text-violet-400">{{ Number(pay.cost).toLocaleString('ru') }} ₽</span>
                <div class="flex items-center gap-1.5">
                  <span v-if="pay.payment_type" class="rounded-full border px-1.5 py-0.5 text-xs font-bold" :class="pmClass(pay.payment_type)">{{ pmLabel(pay.payment_type) }}</span>
                  <span class="text-xs text-slate-600">{{ timeAgo(pay.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Legal footer -->
      <div class="surface-card flex items-start gap-3 p-4 text-xs leading-relaxed text-slate-500">
        <svg class="mt-px h-4 w-4 shrink-0 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>
        <p>Все товары — виртуальные игровые объекты без реальной стоимости. Покупка не даёт преимуществ над другими игроками в плане геймплея. Платежи обрабатываются сервисом <a href="https://easydonate.ru" target="_blank" rel="noreferrer" class="prose-link">EasyDonate</a>. Подробнее — <RouterLink to="/offer" class="prose-link">договор оферты</RouterLink>.</p>
      </div>

    </div>
  </section>

  <!-- Product details modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="expandedProduct" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" @keydown.esc="closeDetails">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeDetails" />

        <!-- Modal -->
        <div class="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-[20px] bg-slate-900 ring-1 ring-slate-700/60 shadow-2xl">

          <!-- Image header -->
          <div v-if="expandedProduct.image" class="relative h-48 w-full overflow-hidden rounded-t-3xl sm:rounded-t-[20px]">
            <img :src="expandedProduct.image" :alt="expandedProduct.name" class="h-full w-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
            <button class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition" @click="closeDetails">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="p-5 sm:p-6 space-y-4">
            <!-- Close if no image -->
            <div v-if="!expandedProduct.image" class="flex items-center justify-between">
              <span />
              <button class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition" @click="closeDetails">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <!-- Title + category -->
            <div class="flex items-start gap-3">
              <h2 class="flex-1 text-xl font-black text-slate-50">{{ expandedProduct.name }}</h2>
              <span v-if="expandedProduct.category" class="shrink-0 rounded-full bg-violet-600/15 px-2.5 py-0.5 text-xs font-bold text-violet-400 ring-1 ring-violet-500/20">{{ expandedProduct.category }}</span>
            </div>

            <!-- Full description -->
            <div v-if="expandedProduct.description" class="text-sm leading-relaxed text-slate-300 whitespace-pre-line">{{ expandedProduct.description }}</div>

            <!-- Price + buy -->
            <div class="flex items-center justify-between border-t border-slate-700/40 pt-4">
              <div>
                <div v-if="discountPct(expandedProduct)" class="flex items-center gap-2 mb-0.5">
                  <span class="text-sm text-slate-600 line-through">{{ Number(expandedProduct.old_price).toLocaleString('ru') }} ₽</span>
                  <span class="rounded bg-amber-400/10 px-1.5 py-0.5 text-xs font-bold text-amber-400">{{ t('shop.discountBadge') }}</span>
                </div>
                <span class="text-2xl font-black text-slate-50">{{ Number(expandedProduct.price).toLocaleString('ru') }} <span class="text-base text-slate-400">₽</span></span>
              </div>
              <div class="flex items-center gap-2">
                <button v-if="cart[expandedProduct.id]" class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700 text-lg font-bold text-slate-200 transition hover:bg-slate-600" @click="removeFromCart(expandedProduct.id)">−</button>
                <span v-if="cart[expandedProduct.id]" class="w-7 text-center text-sm font-black text-slate-100">{{ cart[expandedProduct.id] }}</span>
                <button
                  class="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition active:scale-95"
                  :class="cart[expandedProduct.id] ? 'bg-violet-700 hover:bg-violet-600' : 'bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/20'"
                  @click="addToCart(expandedProduct.id)"
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                  {{ t('shop.buyBtn') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative {
  transform: translateY(40px);
}
@media (min-width: 640px) {
  .modal-enter-from .relative {
    transform: scale(0.96) translateY(10px);
  }
}
</style>
