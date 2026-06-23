<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AccountTabs from '../components/AccountTabs.vue'
import { getMyFollowers, getMyFollowing, getMyFriends } from '../services/socialApi'
import { useAuthStore } from '../stores/authStore'

const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(true)
const error = ref('')
const search = ref('')
const followers = ref({ items: [] })
const following = ref({ items: [] })
const friends = ref({ items: [] })

const counters = computed(() => [
  { label: t('social.followers'), value: followers.value?.items?.length || 0 },
  { label: t('social.following'), value: following.value?.items?.length || 0 },
  { label: t('social.friends'), value: friends.value?.items?.length || 0 },
])

function initialFor(item) {
  const value = item?.display_name || item?.minecraft_nickname || item?.slug || 'U'
  return value.slice(0, 1).toUpperCase()
}

function filterItems(items = []) {
  const q = search.value.trim().toLowerCase()
  if (!q) return items

  return items.filter((item) => {
    const haystack = [item?.display_name, item?.minecraft_nickname, item?.slug]
      .map((value) => String(value || '').toLowerCase())
      .join(' ')
    return haystack.includes(q)
  })
}

const filteredFollowers = computed(() => filterItems(followers.value?.items || []))
const filteredFollowing = computed(() => filterItems(following.value?.items || []))
const filteredFriends = computed(() => filterItems(friends.value?.items || []))

async function loadSocial() {
  loading.value = true
  error.value = ''

  try {
    const [followersResponse, followingResponse, friendsResponse] = await Promise.all([
      getMyFollowers(auth.accessToken),
      getMyFollowing(auth.accessToken),
      getMyFriends(auth.accessToken),
    ])

    followers.value = followersResponse || { items: [] }
    following.value = followingResponse || { items: [] }
    friends.value = friendsResponse || { items: [] }
  } catch (err) {
    error.value = err.message || t('social.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(loadSocial)
</script>

<template>
  <section class="py-8 md:py-10">
    <div class="container-shell space-y-5">
      <section class="surface-card p-5 md:p-7">
        <div class="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <div class="section-kicker !mb-2">{{ t('social.kicker') }}</div>
            <h1 class="text-2xl font-black tracking-tight text-slate-50 md:text-4xl">
              {{ t('social.title') }}
            </h1>
            <p class="mt-3 max-w-3xl text-sm leading-7 text-slate-400 md:text-[15px]">
              {{ t('social.desc') }}
            </p>
          </div>

          <label>
            <span class="field-label">{{ t('social.searchLabel') }}</span>
            <input v-model="search" class="input" :placeholder="t('social.searchPlaceholder')" />
          </label>
        </div>
      </section>

      <AccountTabs />

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <div class="metric-grid metric-grid-3">
        <div v-for="item in counters" :key="item.label" class="metric-card text-center">
          <p class="metric-value">{{ item.value }}</p>
          <p class="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{{ item.label }}</p>
        </div>
      </div>

      <div class="grid gap-5 xl:grid-cols-3">
        <section class="surface-card p-5 md:p-6">
          <div class="flex items-end justify-between gap-3">
            <div>
              <div class="section-kicker !mb-2">{{ t('social.followersKicker') }}</div>
              <h2 class="text-xl font-black text-slate-50">{{ t('social.followersTitle') }}</h2>
            </div>
          </div>

          <div v-if="loading" class="mt-5 space-y-3">
            <div class="skeleton h-18 rounded-2xl"></div>
            <div class="skeleton h-18 rounded-2xl"></div>
          </div>

          <div v-else class="mt-5 space-y-3">
            <RouterLink
              v-for="item in filteredFollowers"
              :key="`followers-${item.slug}`"
              :to="`/u/${item.slug}`"
              class="action-card flex items-center justify-between gap-3 transition hover:-translate-y-[1px]"
            >
              <div class="flex min-w-0 items-center gap-3">
                <div class="preview-avatar h-12 w-12 shrink-0 border border-white/10 text-lg">{{ initialFor(item) }}</div>
                <div class="min-w-0">
                  <div class="truncate font-semibold text-slate-100">{{ item.display_name || item.minecraft_nickname || item.slug }}</div>
                  <div class="truncate text-sm text-slate-400">@{{ item.slug }}</div>
                </div>
              </div>
              <span v-if="item.is_friend" class="badge badge-success">{{ t('social.friend') }}</span>
            </RouterLink>

            <div v-if="!filteredFollowers.length" class="action-card text-sm text-slate-400">{{ t('social.empty') }}</div>
          </div>
        </section>

        <section class="surface-card p-5 md:p-6">
          <div>
            <div class="section-kicker !mb-2">{{ t('social.followingKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50">{{ t('social.followingTitle') }}</h2>
          </div>

          <div v-if="loading" class="mt-5 space-y-3">
            <div class="skeleton h-18 rounded-2xl"></div>
            <div class="skeleton h-18 rounded-2xl"></div>
          </div>

          <div v-else class="mt-5 space-y-3">
            <RouterLink
              v-for="item in filteredFollowing"
              :key="`following-${item.slug}`"
              :to="`/u/${item.slug}`"
              class="action-card flex items-center justify-between gap-3 transition hover:-translate-y-[1px]"
            >
              <div class="flex min-w-0 items-center gap-3">
                <div class="preview-avatar h-12 w-12 shrink-0 border border-white/10 text-lg">{{ initialFor(item) }}</div>
                <div class="min-w-0">
                  <div class="truncate font-semibold text-slate-100">{{ item.display_name || item.minecraft_nickname || item.slug }}</div>
                  <div class="truncate text-sm text-slate-400">@{{ item.slug }}</div>
                </div>
              </div>
              <span v-if="item.is_friend" class="badge badge-success">{{ t('social.friend') }}</span>
            </RouterLink>

            <div v-if="!filteredFollowing.length" class="action-card text-sm text-slate-400">{{ t('social.empty') }}</div>
          </div>
        </section>

        <section class="surface-card p-5 md:p-6">
          <div>
            <div class="section-kicker !mb-2">{{ t('social.friendsKicker') }}</div>
            <h2 class="text-xl font-black text-slate-50">{{ t('social.friendsTitle') }}</h2>
          </div>

          <div v-if="loading" class="mt-5 space-y-3">
            <div class="skeleton h-18 rounded-2xl"></div>
            <div class="skeleton h-18 rounded-2xl"></div>
          </div>

          <div v-else class="mt-5 space-y-3">
            <RouterLink
              v-for="item in filteredFriends"
              :key="`friends-${item.slug}`"
              :to="`/u/${item.slug}`"
              class="action-card flex items-center justify-between gap-3 transition hover:-translate-y-[1px]"
            >
              <div class="flex min-w-0 items-center gap-3">
                <div class="preview-avatar h-12 w-12 shrink-0 border border-white/10 text-lg">{{ initialFor(item) }}</div>
                <div class="min-w-0">
                  <div class="truncate font-semibold text-slate-100">{{ item.display_name || item.minecraft_nickname || item.slug }}</div>
                  <div class="truncate text-sm text-slate-400">@{{ item.slug }}</div>
                </div>
              </div>
              <span class="badge badge-success">{{ t('social.friend') }}</span>
            </RouterLink>

            <div v-if="!filteredFriends.length" class="action-card text-sm text-slate-400">{{ t('social.empty') }}</div>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
