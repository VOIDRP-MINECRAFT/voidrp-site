<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getKillfeed } from '../services/killfeedApi'
import { toastError } from '../services/toast'

const { t, locale } = useI18n()
const loading = ref(true)
const events = ref([])
let timer = null

function headUrl(nickname) {
  return `/api/v1/public/player-head/${encodeURIComponent(nickname)}`
}

function onHeadError(e, nickname) {
  e.currentTarget.onerror = null
  e.currentTarget.src = `https://mc-heads.net/avatar/${encodeURIComponent(nickname)}/32`
}

function weaponName(weapon) {
  if (!weapon) return t('killfeed.fists')
  const id = weapon.includes(':') ? weapon.split(':')[1] : weapon
  return id.replace(/_/g, ' ')
}

function timeAgo(iso) {
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return t('killfeed.now')
  const mins = Math.floor(secs / 60)
  if (mins < 60) return t('killfeed.minsAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('killfeed.hoursAgo', { n: hours })
  return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short' }).format(then)
}

async function load(silent = false) {
  if (!silent) loading.value = true
  try {
    const result = await getKillfeed()
    events.value = result?.events || []
  } catch (e) {
    if (!silent) toastError(e.message || t('killfeed.loadError'))
  } finally {
    loading.value = false
  }
}

const isEmpty = computed(() => !loading.value && events.value.length === 0)

onMounted(() => {
  load()
  timer = setInterval(() => load(true), 15000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <section class="py-8 md:py-10 auth-page">
    <div class="container-shell">

      <div class="mb-6 page-entry">
        <div class="section-kicker !mb-2">{{ t('killfeed.kicker') }}</div>
        <h1 class="text-3xl font-black tracking-tight text-slate-50 md:text-4xl">{{ t('killfeed.title') }}</h1>
        <p class="mt-2 text-sm text-slate-400">{{ t('killfeed.desc') }}</p>
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 6" :key="i" class="skeleton h-14 rounded-2xl"></div>
      </div>

      <div v-else-if="isEmpty" class="surface-card p-8 text-center text-sm text-slate-500">
        {{ t('killfeed.empty') }}
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="(e, i) in events"
          :key="i"
          class="surface-card flex items-center gap-3 px-4 py-3"
        >
          <img
            :src="headUrl(e.killer_nick)" :alt="e.killer_nick"
            class="h-8 w-8 shrink-0 rounded-sm" loading="lazy"
            @error="ev => onHeadError(ev, e.killer_nick)"
          />
          <div class="min-w-0 flex-1 text-sm">
            <router-link :to="`/u/${e.killer_nick}`" class="font-semibold text-red-300 hover:text-red-200">{{ e.killer_nick }}</router-link>
            <span class="text-slate-500"> ☠ </span>
            <router-link :to="`/u/${e.victim_nick}`" class="font-semibold text-slate-300 hover:text-slate-100">{{ e.victim_nick }}</router-link>
            <span class="ml-2 text-xs text-slate-500">· {{ weaponName(e.weapon) }}</span>
          </div>
          <img
            :src="headUrl(e.victim_nick)" :alt="e.victim_nick"
            class="h-8 w-8 shrink-0 rounded-sm opacity-70 grayscale" loading="lazy"
            @error="ev => onHeadError(ev, e.victim_nick)"
          />
          <span class="w-16 shrink-0 text-right text-xs text-slate-500">{{ timeAgo(e.created_at) }}</span>
        </div>
      </div>

    </div>
  </section>
</template>
