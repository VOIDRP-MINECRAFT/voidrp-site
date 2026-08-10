<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { getNews } from '../services/newsApi'
import { activeServer } from '../stores/serverStore'

const { t, locale } = useI18n()

const items = ref([])
const loading = ref(true)
const error = ref('')
const category = ref('update') // 'update' (Обновления) | 'media' (Новости)

const featured = computed(() => (items.value.length ? items.value[0] : null))
const rest = computed(() => (items.value.length > 1 ? items.value.slice(1) : []))

function setCategory(c) {
  if (category.value === c) return
  category.value = c
  load()
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(locale.value === 'en' ? 'en-US' : 'ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return ''
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getNews({ limit: 24, category: category.value })
    items.value = res.items || []
  } catch (e) {
    error.value = e?.message || 'error'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="news-page">
    <div class="container-shell">
      <!-- Hero -->
      <header class="news-hero">
        <div class="news-hero__kicker">{{ t('news.kicker') }}</div>
        <h1 class="news-hero__title">{{ t('news.title') }}</h1>
        <p class="news-hero__sub">{{ t('news.subtitle', { server: activeServer?.name || 'VoidRP' }) }}</p>
      </header>

      <!-- Segmented category switch -->
      <div class="news-seg" role="tablist">
        <span class="news-seg__thumb" :class="category === 'media' ? 'is-media' : 'is-update'" aria-hidden="true"></span>
        <button
          type="button" role="tab" class="news-seg__btn"
          :class="{ 'is-active': category === 'update' }"
          @click="setCategory('update')"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          {{ t('news.tabUpdates') }}
        </button>
        <button
          type="button" role="tab" class="news-seg__btn"
          :class="{ 'is-active': category === 'media' }"
          @click="setCategory('media')"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
          {{ t('news.tabMedia') }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="news-grid">
        <div v-for="i in 6" :key="i" class="ncard ncard--skel">
          <div class="ncard__cover skel-block"></div>
          <div class="ncard__body">
            <div class="skel-line skel-line--sm"></div>
            <div class="skel-line"></div>
            <div class="skel-line skel-line--short"></div>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="news-note">{{ t('news.loadError') }}</div>

      <!-- Empty -->
      <div v-else-if="!items.length" class="news-note news-note--empty">
        <svg class="news-note__icon" xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></svg>
        <p>{{ t('news.empty') }}</p>
      </div>

      <template v-else>
        <!-- Featured -->
        <RouterLink :to="`/news/${featured.slug}`" class="nfeat" :class="'nfeat--' + category">
          <div class="nfeat__cover">
            <img v-if="featured.cover_image_url" :src="featured.cover_image_url" alt="" loading="lazy" decoding="async" />
            <span v-else class="nfeat__ph">VoidRP</span>
          </div>
          <div class="nfeat__body">
            <div class="nmeta">
              <span class="ntag" :class="'ntag--' + category">{{ category === 'media' ? t('news.tabMedia') : t('news.tabUpdates') }}</span>
              <time class="ndate">{{ fmtDate(featured.published_at) }}</time>
            </div>
            <h2 class="nfeat__title">{{ featured.title }}</h2>
            <p v-if="featured.summary" class="nfeat__summary">{{ featured.summary }}</p>
            <span class="nlink">{{ t('news.readMore') }}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
        </RouterLink>

        <!-- Grid -->
        <div v-if="rest.length" class="news-grid">
          <RouterLink v-for="post in rest" :key="post.id" :to="`/news/${post.slug}`" class="ncard">
            <div class="ncard__cover">
              <img v-if="post.cover_image_url" :src="post.cover_image_url" alt="" loading="lazy" decoding="async" />
              <span v-else class="ncard__ph">VoidRP</span>
            </div>
            <div class="ncard__body">
              <div class="nmeta">
                <span class="ntag" :class="'ntag--' + category">{{ category === 'media' ? t('news.tabMedia') : t('news.tabUpdates') }}</span>
                <time class="ndate">{{ fmtDate(post.published_at) }}</time>
              </div>
              <h3 class="ncard__title">{{ post.title }}</h3>
              <p v-if="post.summary" class="ncard__summary">{{ post.summary }}</p>
              <span class="nlink nlink--sm">{{ t('news.readMore') }}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </span>
            </div>
          </RouterLink>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.news-page { padding: 2.5rem 0 4.5rem; min-height: 68vh; }

/* ── Hero ─────────────────────────────────────────────── */
.news-hero { text-align: center; margin-bottom: 1.75rem; }
.news-hero__kicker {
  font-size: 0.72rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: #7c6bd6; margin-bottom: 0.55rem;
}
.news-hero__title { font-size: clamp(1.7rem, 3vw, 2.35rem); font-weight: 900; color: #f1f5ff; margin: 0; letter-spacing: -0.02em; }
.news-hero__sub { margin: 0.65rem auto 0; max-width: 36rem; font-size: 0.95rem; line-height: 1.6; color: #8896b5; }

/* ── Segmented switch ─────────────────────────────────── */
.news-seg {
  position: relative;
  display: inline-flex;
  margin: 0 auto 2rem;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--site-border);
  background: rgba(8, 13, 25, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  gap: 2px;
  left: 50%;
  transform: translateX(-50%);
}
.news-seg__thumb {
  position: absolute; top: 4px; bottom: 4px; left: 4px;
  width: calc(50% - 4px);
  border-radius: 999px;
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), background 0.28s ease, box-shadow 0.28s ease;
}
.news-seg__thumb.is-update {
  transform: translateX(0);
  background: linear-gradient(135deg, #8b5cf6, #6d5cf0);
  box-shadow: 0 6px 18px rgba(139, 92, 246, 0.35);
}
.news-seg__thumb.is-media {
  transform: translateX(100%);
  background: linear-gradient(135deg, #22c55e, #16a34a);
  box-shadow: 0 6px 18px rgba(34, 197, 94, 0.3);
}
.news-seg__btn {
  position: relative; z-index: 1;
  display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
  min-width: 8.5rem;
  padding: 0.55rem 1.2rem;
  border: none; background: transparent; cursor: pointer;
  font-size: 0.88rem; font-weight: 700;
  color: #9aa8c4;
  transition: color 0.2s ease;
}
.news-seg__btn:hover { color: #e5eefc; }
.news-seg__btn.is-active { color: #fff; }
.news-seg__btn svg { opacity: 0.9; }

/* ── Featured card ────────────────────────────────────── */
.nfeat {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 0;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid var(--site-border);
  background: var(--site-surface);
  box-shadow: var(--site-shadow);
  margin-bottom: 1.5rem;
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}
.nfeat:hover { transform: translateY(-3px); border-color: rgba(139, 92, 246, 0.32); box-shadow: 0 26px 70px rgba(0, 0, 0, 0.42); }
.nfeat--media:hover { border-color: rgba(34, 197, 94, 0.3); }
.nfeat__cover {
  position: relative; min-height: 240px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.16), rgba(13, 19, 36, 0.6));
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.nfeat__cover img { width: 100%; height: 100%; object-fit: cover; }
.nfeat__ph { font-weight: 900; font-size: 1.8rem; letter-spacing: 0.12em; color: rgba(255, 255, 255, 0.18); }
.nfeat__body { padding: 1.75rem 1.9rem; display: flex; flex-direction: column; justify-content: center; gap: 0.75rem; }
.nfeat__title { font-size: clamp(1.25rem, 2vw, 1.6rem); font-weight: 800; color: #f1f5ff; line-height: 1.25; margin: 0; }
.nfeat__summary { font-size: 0.96rem; line-height: 1.65; color: #9aa8c4; margin: 0; }

/* ── Grid + cards ─────────────────────────────────────── */
.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  gap: 1.35rem;
  align-items: stretch;
}
.ncard {
  display: flex; flex-direction: column;
  border-radius: 20px; overflow: hidden;
  border: 1px solid var(--site-border);
  background: var(--site-surface);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}
.ncard:hover {
  transform: translateY(-4px);
  border-color: rgba(139, 92, 246, 0.32);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4);
}
.ncard__cover {
  position: relative; height: 172px; overflow: hidden;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.14), rgba(13, 19, 36, 0.6));
  display: flex; align-items: center; justify-content: center;
}
.ncard__cover img { width: 100%; height: 100%; object-fit: cover; }
.ncard__ph { font-weight: 800; font-size: 1.25rem; letter-spacing: 0.12em; color: rgba(255, 255, 255, 0.16); }
.ncard__body { padding: 1.05rem 1.1rem 1.15rem; display: flex; flex-direction: column; gap: 0.55rem; flex: 1; }
.ncard__title { font-size: 1.08rem; font-weight: 700; color: #f1f5ff; line-height: 1.32; margin: 0; }
.ncard__summary {
  font-size: 0.88rem; line-height: 1.55; color: #8896b5; margin: 0; flex: 1;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

/* ── Meta / tags / links ──────────────────────────────── */
.nmeta { display: flex; align-items: center; gap: 0.6rem; }
.ntag {
  font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 0.16rem 0.55rem; border-radius: 999px;
}
.ntag--update { color: #c9b8ff; background: rgba(139, 92, 246, 0.14); border: 1px solid rgba(139, 92, 246, 0.28); }
.ntag--media { color: #86efac; background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.28); }
.ndate { font-size: 0.78rem; color: #6f7c99; letter-spacing: 0.02em; }
.nlink {
  display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.35rem;
  font-size: 0.9rem; font-weight: 700; color: #a78bfa;
  transition: gap 0.2s ease, color 0.2s ease;
}
.nlink--sm { font-size: 0.82rem; }
.ncard:hover .nlink, .nfeat:hover .nlink { gap: 0.6rem; color: #c4b5fd; }

/* ── Empty / error note ───────────────────────────────── */
.news-note {
  text-align: center; padding: 3.5rem 1.5rem; color: #8896b5;
  margin: 0 auto; max-width: 480px;
  border: 1px solid var(--site-border);
  background: var(--site-surface);
  border-radius: 20px;
}
.news-note__icon { color: #7c6bd6; margin-bottom: 0.85rem; opacity: 0.85; }

/* ── Skeletons ────────────────────────────────────────── */
.ncard--skel { pointer-events: none; }
.skel-block, .skel-line {
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 37%, rgba(255,255,255,0.04) 63%);
  background-size: 400% 100%;
  animation: news-shimmer 1.4s ease infinite;
  border-radius: 8px;
}
.skel-block { height: 172px; border-radius: 0; }
.skel-line { height: 13px; margin: 0.55rem 0; }
.skel-line--sm { width: 40%; height: 10px; }
.skel-line--short { width: 62%; }
@keyframes news-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

@media (max-width: 720px) {
  .nfeat { grid-template-columns: 1fr; }
  .nfeat__cover { min-height: 180px; height: 200px; }
  .nfeat__body { padding: 1.25rem 1.25rem 1.4rem; }
  .news-seg__btn { min-width: 7rem; padding: 0.5rem 0.9rem; }
}
</style>
