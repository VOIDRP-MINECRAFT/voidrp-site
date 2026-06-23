<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPlayersTop } from '../services/playerStatsApi'
import { formatNumber } from '../utils/formatters'
import { toastError } from '../services/toast'

const { t } = useI18n()
const loading = ref(true)
const data = ref(null)
const activeKey = ref(null)

const CATEGORY_ICONS = {
  balance: '💰',
  pvp_kills: '⚔️',
  mob_kills: '🗡️',
  playtime: '⏱️',
  blocks_broken: '⛏️',
  blocks_placed: '🏗️',
  completed_quests: '📜',
  deaths: '☠️',
}

const RANK_MEDALS = ['🥇', '🥈', '🥉']

function headUrl(nickname) {
  return `/api/v1/public/player-head/${encodeURIComponent(nickname)}`
}

function onHeadError(e, nickname) {
  e.currentTarget.onerror = null
  e.currentTarget.src = `https://mc-heads.net/avatar/${encodeURIComponent(nickname)}/32`
}

function fmtValue(entry, category) {
  if (category.key === 'balance') {
    return formatNumber(Math.floor(entry.value)) + ' ₽'
  }
  if (category.key === 'playtime') {
    return formatNumber(entry.value) + ' ч'
  }
  return formatNumber(Math.floor(entry.value))
}

function fmtDate(iso) {
  if (!iso) return null
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' }).format(new Date(iso))
}

const activeCategory = computed(() => {
  if (!data.value || !activeKey.value) return null
  return data.value.categories.find((c) => c.key === activeKey.value) || null
})

async function load() {
  loading.value = true
  try {
    const result = await getPlayersTop()
    data.value = result
    if (result?.categories?.length) {
      activeKey.value = result.categories[0].key
    }
  } catch (e) {
    toastError(e.message || t('playersTop.loadError'))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="py-8 md:py-10 auth-page">
    <div class="container-shell">

      <div class="mb-6 page-entry">
        <div class="section-kicker !mb-2">{{ t('playersTop.kicker') }}</div>
        <h1 class="text-3xl font-black tracking-tight text-slate-50 md:text-4xl">{{ t('playersTop.title') }}</h1>
        <p class="mt-2 text-sm text-slate-400">{{ t('playersTop.desc') }}</p>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-4">
        <div class="skeleton h-12 rounded-2xl"></div>
        <div class="skeleton h-72 rounded-[28px]"></div>
      </div>

      <template v-else-if="data">

        <!-- Category tabs -->
        <div class="mb-4 flex flex-wrap gap-2">
          <button
            v-for="cat in data.categories"
            :key="cat.key"
            type="button"
            class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition"
            :class="
              activeKey === cat.key
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
            "
            @click="activeKey = cat.key"
          >
            <span>{{ CATEGORY_ICONS[cat.key] || '🏆' }}</span>
            <span>{{ cat.label }}</span>
          </button>
        </div>

        <!-- Active category board -->
        <section v-if="activeCategory" class="surface-card overflow-hidden p-0">
          <div class="flex items-center gap-3 border-b border-slate-700/50 px-5 py-4">
            <span class="text-2xl leading-none">{{ CATEGORY_ICONS[activeCategory.key] || '🏆' }}</span>
            <div>
              <h2 class="text-base font-black text-slate-50">{{ activeCategory.label }}</h2>
              <p class="text-xs text-slate-500">{{ t('playersTop.topCount', { n: activeCategory.entries.length, unit: activeCategory.unit }) }}</p>
            </div>
          </div>

          <div v-if="activeCategory.entries.length === 0" class="px-5 py-8 text-center text-sm text-slate-500">
            {{ t('playersTop.noData') }}
          </div>

          <div v-else class="divide-y divide-slate-700/30">
            <div
              v-for="entry in activeCategory.entries"
              :key="entry.minecraft_nickname"
              class="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-800/30"
            >
              <!-- Rank -->
              <span
                class="w-7 shrink-0 text-center text-sm font-black"
                :class="
                  entry.rank === 1 ? 'text-yellow-400'
                  : entry.rank === 2 ? 'text-slate-300'
                  : entry.rank === 3 ? 'text-amber-600'
                  : 'text-slate-600'
                "
              >
                {{ entry.rank <= 3 ? RANK_MEDALS[entry.rank - 1] : entry.rank }}
              </span>

              <!-- Head avatar -->
              <img
                :src="headUrl(entry.minecraft_nickname)"
                :alt="entry.minecraft_nickname"
                class="h-8 w-8 shrink-0 rounded-sm"
                loading="lazy"
                @error="e => onHeadError(e, entry.minecraft_nickname)"
              />

              <!-- Name + date -->
              <div class="min-w-0 flex-1">
                <router-link
                  :to="`/u/${entry.minecraft_nickname}`"
                  class="truncate text-sm font-semibold text-slate-100 hover:text-violet-300 transition"
                >{{ entry.minecraft_nickname }}</router-link>
                <p v-if="fmtDate(entry.last_seen_at)" class="text-xs text-slate-500">
                  {{ t('playersTop.lastSeen', { date: fmtDate(entry.last_seen_at) }) }}
                </p>
              </div>

              <!-- Value -->
              <span class="shrink-0 text-sm font-bold" :class="entry.rank <= 3 ? 'text-slate-200' : 'text-slate-400'">
                {{ fmtValue(entry, activeCategory) }}
              </span>
            </div>
          </div>
        </section>

      </template>

      <div v-else class="surface-card p-8 text-center text-sm text-slate-500">
        {{ t('playersTop.noDataEmpty') }}
      </div>

    </div>
  </section>
</template>
