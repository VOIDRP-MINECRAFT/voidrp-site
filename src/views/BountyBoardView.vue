<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getBountyBoard } from '../services/bountyApi'
import { formatNumber } from '../utils/formatters'
import { toastError } from '../services/toast'

const { t } = useI18n()
const loading = ref(true)
const bounties = ref([])

const RANK_MEDALS = ['🥇', '🥈', '🥉']

const totalPledged = computed(() =>
  bounties.value.reduce((sum, b) => sum + (b.total_amount || 0), 0),
)

function headUrl(nickname) {
  return `/api/v1/public/player-head/${encodeURIComponent(nickname)}`
}

function onHeadError(e, nickname) {
  e.currentTarget.onerror = null
  e.currentTarget.src = `https://mc-heads.net/avatar/${encodeURIComponent(nickname)}/32`
}

async function load() {
  loading.value = true
  try {
    const result = await getBountyBoard()
    bounties.value = result?.bounties || []
  } catch (e) {
    toastError(e.message || t('bounties.loadError'))
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
        <div class="section-kicker !mb-2">{{ t('bounties.kicker') }}</div>
        <h1 class="text-3xl font-black tracking-tight text-slate-50 md:text-4xl">{{ t('bounties.title') }}</h1>
        <p class="mt-2 text-sm text-slate-400">{{ t('bounties.desc') }}</p>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-4">
        <div class="skeleton h-12 rounded-2xl"></div>
        <div class="skeleton h-72 rounded-[28px]"></div>
      </div>

      <template v-else>
        <section class="surface-card overflow-hidden p-0">
          <div class="flex items-center gap-3 border-b border-slate-700/50 px-5 py-4">
            <span class="text-2xl leading-none">☠️</span>
            <div class="min-w-0">
              <h2 class="text-base font-black text-slate-50">{{ t('bounties.boardTitle') }}</h2>
              <p class="text-xs text-slate-500">
                {{ t('bounties.summary', { n: bounties.length, total: formatNumber(totalPledged) }) }}
              </p>
            </div>
          </div>

          <div v-if="bounties.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
            {{ t('bounties.empty') }}
          </div>

          <div v-else class="divide-y divide-slate-700/30">
            <div
              v-for="(b, i) in bounties"
              :key="b.target_nick"
              class="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-800/30"
            >
              <span
                class="w-7 shrink-0 text-center text-sm font-black"
                :class="
                  i === 0 ? 'text-yellow-400'
                  : i === 1 ? 'text-slate-300'
                  : i === 2 ? 'text-amber-600'
                  : 'text-slate-600'
                "
              >
                {{ i <= 2 ? RANK_MEDALS[i] : i + 1 }}
              </span>

              <img
                :src="headUrl(b.target_nick)"
                :alt="b.target_nick"
                class="h-8 w-8 shrink-0 rounded-sm"
                loading="lazy"
                @error="e => onHeadError(e, b.target_nick)"
              />

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <router-link
                    :to="`/u/${b.target_nick}`"
                    class="truncate text-sm font-semibold text-slate-100 hover:text-violet-300 transition"
                  >{{ b.target_nick }}</router-link>
                  <span
                    v-if="b.is_wanted"
                    class="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-400 ring-1 ring-red-500/30"
                  >{{ t('bounties.wanted') }}</span>
                </div>
                <p class="text-xs text-slate-500">
                  {{ t('bounties.contributors', { n: b.contributor_count }) }}
                </p>
              </div>

              <span class="shrink-0 text-sm font-bold text-cyan-300">
                💎 {{ formatNumber(b.total_amount) }}
              </span>
            </div>
          </div>
        </section>

        <p class="mt-4 text-center text-xs text-slate-500">{{ t('bounties.hint') }}</p>
      </template>

    </div>
  </section>
</template>
