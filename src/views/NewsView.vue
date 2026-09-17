<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { getNews } from '../services/newsApi'
import { activeServer } from '../stores/serverStore'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const PAGE = 12
const CATEGORIES = ['all', 'update', 'media']

const items = ref([])
const total = ref(0)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')

// The tab lives in the URL (?category=update) so a filtered list can be shared and survives reload.
const category = computed(() => (CATEGORIES.includes(route.query.category) ? route.query.category : 'all'))
function setCategory(c) {
  if (c === category.value) return
  router.replace({ query: { ...route.query, category: c === 'all' ? undefined : c } })
}

const featured = computed(() => items.value[0] || null)
const rest = computed(() => items.value.slice(1))
const hasMore = computed(() => items.value.length < total.value)

const catLabel = (c) => (c === 'media' ? t('news.tabMedia') : t('news.tabUpdates'))
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(String(locale.value).startsWith('en') ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}
// "New" for the first three days: people coming back see at a glance what they missed.
const isFresh = (iso) => Boolean(iso) && Date.now() - new Date(iso).getTime() < 3 * 24 * 3600 * 1000

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getNews({ limit: PAGE, category: category.value === 'all' ? null : category.value })
    items.value = res.items || []
    total.value = res.total ?? items.value.length
  } catch (e) {
    error.value = e?.message || 'error'
    items.value = []
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  loadingMore.value = true
  try {
    const res = await getNews({ limit: PAGE, offset: items.value.length, category: category.value === 'all' ? null : category.value })
    const seen = new Set(items.value.map((i) => i.id))
    items.value = [...items.value, ...(res.items || []).filter((i) => !seen.has(i.id))]
    total.value = res.total ?? total.value
  } catch {
    /* keep what is shown; the button stays for another try */
  } finally {
    loadingMore.value = false
  }
}

watch(category, load)
onMounted(load)
</script>

<template>
  <section class="nw-page">
    <div class="container-shell nw">
      <header class="nw-head">
        <div>
          <h1 class="nw-title">{{ t('news.title') }}</h1>
          <p class="nw-sub">{{ t('news.subtitle', { server: activeServer?.name || 'VoidRP' }) }}</p>
        </div>
        <nav class="nw-tabs" role="tablist" :aria-label="t('news.title')">
          <button v-for="c in CATEGORIES" :key="c" type="button" role="tab" class="nw-tab" :class="[{ on: category === c }, `nw-tab--${c}`]" :aria-selected="category === c" @click="setCategory(c)">
            {{ c === 'all' ? t('news.tabAll') : catLabel(c) }}
          </button>
        </nav>
      </header>

      <div v-if="loading" class="nw-skel">
        <div class="skeleton nw-skel__feat"></div>
        <div class="nw-grid">
          <div v-for="i in 3" :key="i" class="skeleton nw-skel__card"></div>
        </div>
      </div>

      <div v-else-if="error" class="nw-note">
        <p>{{ t('news.loadError') }}</p>
        <button type="button" class="nw-btn" @click="load">{{ t('news.retry') }}</button>
      </div>

      <div v-else-if="!items.length" class="nw-note">
        <p>{{ t('news.empty') }}</p>
        <button v-if="category !== 'all'" type="button" class="nw-btn" @click="setCategory('all')">{{ t('news.showAll') }}</button>
      </div>

      <template v-else>
        <RouterLink :to="`/news/${featured.slug}`" class="nw-feat">
          <div class="nw-feat__cover">
            <img v-if="featured.cover_image_url" :src="featured.cover_image_url" alt="" decoding="async" />
            <span v-else class="nw-ph">VoidRP</span>
          </div>
          <div class="nw-feat__body">
            <div class="nw-meta">
              <span class="nw-tag" :class="`nw-tag--${featured.category}`">{{ catLabel(featured.category) }}</span>
              <span v-if="isFresh(featured.published_at)" class="nw-new">{{ t('news.fresh') }}</span>
              <time class="nw-date" :datetime="featured.published_at">{{ fmtDate(featured.published_at) }}</time>
            </div>
            <h2 class="nw-feat__title">{{ featured.title }}</h2>
            <p v-if="featured.summary" class="nw-feat__summary">{{ featured.summary }}</p>
            <span class="nw-read">{{ t('news.readMore') }}</span>
          </div>
        </RouterLink>

        <div v-if="rest.length" class="nw-grid">
          <RouterLink v-for="post in rest" :key="post.id" :to="`/news/${post.slug}`" class="nw-card">
            <div class="nw-card__cover">
              <img v-if="post.cover_image_url" :src="post.cover_image_url" alt="" loading="lazy" decoding="async" />
              <span v-else class="nw-ph nw-ph--sm">VoidRP</span>
            </div>
            <div class="nw-card__body">
              <div class="nw-meta">
                <span class="nw-tag" :class="`nw-tag--${post.category}`">{{ catLabel(post.category) }}</span>
                <span v-if="isFresh(post.published_at)" class="nw-new">{{ t('news.fresh') }}</span>
                <time class="nw-date" :datetime="post.published_at">{{ fmtDate(post.published_at) }}</time>
              </div>
              <h3 class="nw-card__title">{{ post.title }}</h3>
              <p v-if="post.summary" class="nw-card__summary">{{ post.summary }}</p>
            </div>
          </RouterLink>
        </div>

        <div v-if="hasMore" class="nw-more">
          <button type="button" class="nw-btn" :disabled="loadingMore" @click="loadMore">
            <span v-if="loadingMore" class="spinner"></span>
            {{ t('news.loadMore', { n: total - items.length }) }}
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.nw-page { padding-block: 28px 64px; min-height: 68vh; }
.nw { --w-surface: rgba(19, 16, 33, 0.8); --w-line: rgba(255, 255, 255, 0.08); --w-line-2: rgba(255, 255, 255, 0.14); --w-text: #eeecf7; --w-muted: #9d99b6; color: var(--w-text); }

.nw-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; margin-bottom: 20px; }
.nw-title { margin: 0; font-size: clamp(1.8rem, 1.3rem + 1.4vw, 2.6rem); font-weight: 900; letter-spacing: -0.025em; line-height: 1.05; }
.nw-sub { margin: 8px 0 0; font-size: 1rem; line-height: 1.5; color: var(--w-muted); }
.nw-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 14px; border: 1px solid var(--w-line); background: rgba(255, 255, 255, 0.04); }
.nw-tab { height: 38px; padding: 0 16px; border: 0; border-radius: 10px; background: transparent; font: inherit; font-size: 0.92rem; font-weight: 700; color: var(--w-muted); cursor: pointer; white-space: nowrap; transition: background-color 0.15s, color 0.15s; }
.nw-tab:hover { color: var(--w-text); background: rgba(255, 255, 255, 0.05); }
.nw-tab.on { color: #fff; background: rgba(255, 255, 255, 0.1); }
.nw-tab--update.on { background: rgba(139, 92, 246, 0.3); }
.nw-tab--media.on { background: rgba(34, 197, 94, 0.22); }
.nw-tab:focus-visible, .nw-btn:focus-visible, .nw-feat:focus-visible, .nw-card:focus-visible { outline: 2px solid #a78bfa; outline-offset: 3px; }

/* News covers are uploaded as 1600×600 (16:6): keep that ratio so text on them is never cut. */
.nw-feat { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); border-radius: 22px; overflow: hidden; border: 1px solid var(--w-line); background: var(--w-surface); text-decoration: none; color: inherit; transition: border-color 0.2s, transform 0.2s; }
.nw-feat:hover { border-color: rgba(167, 139, 250, 0.4); transform: translateY(-2px); }
.nw-feat__cover { position: relative; aspect-ratio: 16 / 6; align-self: center; background: linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(13, 11, 23, 0.8)); display: grid; place-items: center; overflow: hidden; }
.nw-feat__cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.nw-feat__body { display: flex; flex-direction: column; justify-content: center; gap: 12px; padding: 26px 30px; }
.nw-feat__title { margin: 0; font-size: clamp(1.3rem, 1rem + 0.9vw, 1.75rem); font-weight: 900; line-height: 1.2; letter-spacing: -0.015em; }
.nw-feat__summary { margin: 0; font-size: 0.98rem; line-height: 1.6; color: #c9c5dc; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.nw-read { align-self: flex-start; margin-top: 4px; font-size: 0.92rem; font-weight: 800; color: #c4b5fd; }
.nw-feat:hover .nw-read { color: #ddd6fe; }

.nw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 16px; margin-top: 16px; }
.nw-card { display: flex; flex-direction: column; border-radius: 18px; overflow: hidden; border: 1px solid var(--w-line); background: var(--w-surface); text-decoration: none; color: inherit; transition: border-color 0.2s, transform 0.2s; }
.nw-card:hover { border-color: rgba(167, 139, 250, 0.4); transform: translateY(-2px); }
.nw-card__cover { position: relative; aspect-ratio: 16 / 6; background: linear-gradient(135deg, rgba(139, 92, 246, 0.16), rgba(13, 11, 23, 0.8)); display: grid; place-items: center; overflow: hidden; }
.nw-card__cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.nw-card__body { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px 18px; }
.nw-card__title { margin: 0; font-size: 1.06rem; font-weight: 800; line-height: 1.3; }
.nw-card__summary { margin: 0; font-size: 0.88rem; line-height: 1.5; color: var(--w-muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.nw-ph { font-weight: 900; font-size: 1.6rem; letter-spacing: 0.12em; color: rgba(255, 255, 255, 0.16); }
.nw-ph--sm { font-size: 1.1rem; }

.nw-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; }
.nw-tag { font-size: 0.76rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; }
.nw-tag--update { color: #ddd6fe; background: rgba(139, 92, 246, 0.18); }
.nw-tag--media { color: #a7f3d0; background: rgba(34, 197, 94, 0.14); }
.nw-new { font-size: 0.74rem; font-weight: 800; padding: 3px 8px; border-radius: 999px; color: #1b1405; background: #f2c14e; }
.nw-date { font-size: 0.84rem; color: var(--w-muted); }

.nw-more { display: flex; justify-content: center; margin-top: 24px; }
.nw-btn { display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 18px; border-radius: 12px; font: inherit; font-size: 0.92rem; font-weight: 700; color: var(--w-text); background: rgba(255, 255, 255, 0.06); border: 1px solid var(--w-line-2); cursor: pointer; }
.nw-btn:hover { background: rgba(255, 255, 255, 0.1); }
.nw-btn:disabled { opacity: 0.6; cursor: default; }
.nw-note { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 56px 20px; border-radius: 20px; border: 1px solid var(--w-line); background: var(--w-surface); color: var(--w-muted); text-align: center; }
.nw-note p { margin: 0; }

.nw-skel__feat { height: 300px; border-radius: 22px; }
.nw-skel__card { height: 280px; border-radius: 18px; }
.nw-skel .nw-grid { margin-top: 16px; }

@media (max-width: 900px) {
  .nw-feat { grid-template-columns: minmax(0, 1fr); }
  .nw-feat__body { padding: 18px 20px 22px; }
}
@media (max-width: 560px) {
  .nw-page { padding-block: 16px 48px; }
  .nw-tabs { width: 100%; }
  .nw-tab { flex: 1; padding: 0 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .nw-feat, .nw-card { transition: none; }
  .nw-feat:hover, .nw-card:hover { transform: none; }
}
</style>
