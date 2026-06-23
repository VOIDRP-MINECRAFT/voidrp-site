<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProgressionLeaderboard } from '../services/progressionApi'
import { usePageMeta } from '../composables/usePageMeta.js'

usePageMeta({
  title: 'Рейтинг прогрессии',
  description: 'Топ игроков VoidRP по прогрессии — кто дальше всех продвинулся в освоении сборки модов.',
  url: 'https://void-rp.ru/leaderboard',
  breadcrumbs: [
    { name: 'Главная', url: '/' },
    { name: 'Рейтинг прогрессии' },
  ],
})
import { toastError } from '../services/toast'

const { t } = useI18n()
const loading = ref(true)
const leaderboard = ref(null)
const activeTier = ref(null)

const TIER_ICONS = {
  create_age: '⚙️',
  mekanism_age: '🔩',
  ae2_age: '💾',
  reactor_age: '⚛️',
  draconic_age: '🐉',
  quantum_age: '🌌',
  endgame: '♾️',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

function fmtDateShort(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' }).format(new Date(iso))
}

async function load() {
  loading.value = true
  try {
    const data = await getProgressionLeaderboard()
    leaderboard.value = data
    if (data?.tiers?.length) {
      activeTier.value = data.tiers[0].tier_name
    }
  } catch (e) {
    toastError(e.message || t('leaderboard.loadError'))
  } finally {
    loading.value = false
  }
}

const activeTierData = computed(() => {
  if (!leaderboard.value || !activeTier.value) return null
  return leaderboard.value.tiers.find((t) => t.tier_name === activeTier.value) || null
})

import { computed } from 'vue'

onMounted(load)
</script>

<template>
  <section class="py-8 md:py-10">
    <div class="container-shell">

      <div class="mb-6">
        <div class="section-kicker !mb-2">{{ t('leaderboard.kicker') }}</div>
        <h1 class="text-3xl font-black tracking-tight text-slate-50 md:text-4xl">{{ t('leaderboard.title') }}</h1>
        <p class="mt-2 text-sm text-slate-400">{{ t('leaderboard.desc') }}</p>
      </div>

      <div v-if="loading" class="space-y-4">
        <div class="skeleton h-12 rounded-2xl"></div>
        <div class="skeleton h-64 rounded-[28px]"></div>
      </div>

      <template v-else-if="leaderboard">

        <!-- Tier tabs -->
        <div class="mb-4 flex flex-wrap gap-2">
          <button
            v-for="tier in leaderboard.tiers"
            :key="tier.tier_name"
            type="button"
            class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition"
            :class="
              activeTier === tier.tier_name
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
            "
            @click="activeTier = tier.tier_name"
          >
            <span>{{ TIER_ICONS[tier.tier_name] || '🏆' }}</span>
            <span>{{ tier.tier_label }}</span>
            <span class="ml-0.5 opacity-60">{{ tier.entries.length }}</span>
          </button>
        </div>

        <!-- Active tier board -->
        <section v-if="activeTierData" class="surface-card overflow-hidden p-0">
          <div class="flex items-center gap-3 border-b border-slate-700/50 px-5 py-4">
            <span class="text-2xl leading-none">{{ TIER_ICONS[activeTierData.tier_name] || '🏆' }}</span>
            <div>
              <h2 class="text-base font-black text-slate-50">{{ activeTierData.tier_label }}</h2>
              <p class="text-xs text-slate-500">{{ t('leaderboard.topCount', { n: activeTierData.entries.length }) }}</p>
            </div>
          </div>

          <div v-if="activeTierData.entries.length === 0" class="px-5 py-8 text-center text-sm text-slate-500">
            {{ t('leaderboard.noEntries') }}
          </div>

          <div v-else class="divide-y divide-slate-700/30">
            <div
              v-for="entry in activeTierData.entries"
              :key="entry.minecraft_nickname"
              class="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-800/30"
            >
              <span
                class="w-7 shrink-0 text-center text-sm font-black"
                :class="
                  entry.rank === 1
                    ? 'text-yellow-400'
                    : entry.rank === 2
                    ? 'text-slate-300'
                    : entry.rank === 3
                    ? 'text-amber-600'
                    : 'text-slate-600'
                "
              >
                {{ entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank }}
              </span>

              <div class="min-w-0 flex-1">
                <router-link
                  :to="`/u/${entry.minecraft_nickname}`"
                  class="truncate text-sm font-semibold text-slate-100 hover:text-violet-300 transition"
                >{{ entry.minecraft_nickname }}</router-link>
                <p class="text-xs text-slate-500">{{ fmtDate(entry.unlocked_at) }}</p>
              </div>

              <span
                v-if="entry.rank === 1"
                class="hidden shrink-0 text-xs text-slate-500 sm:block"
              >
                {{ t('leaderboard.first') }}
              </span>
            </div>
          </div>
        </section>

      </template>

      <div v-else class="surface-card p-8 text-center text-sm text-slate-500">
        {{ t('leaderboard.noData') }}
      </div>

    </div>
  </section>
</template>
