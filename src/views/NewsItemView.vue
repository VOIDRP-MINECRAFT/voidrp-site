<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, RouterLink } from 'vue-router'
import { marked } from 'marked'
import { getNews, getNewsItem } from '../services/newsApi'
import { usePageMeta } from '../composables/usePageMeta.js'

const { t, locale } = useI18n()
const route = useRoute()

const post = ref(null)
const more = ref([])
const loading = ref(true)
const notFound = ref(false)
const copied = ref(false)

marked.setOptions({ gfm: true, breaks: true })

const renderedBody = computed(() => (post.value?.body ? marked.parse(post.value.body) : ''))
// ~180 words a minute for Russian text read on screen.
const readMinutes = computed(() => {
  const words = String(post.value?.body || '').replace(/[#*>`\[\]()!_-]/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 180))
})
const catLabel = (c) => (c === 'media' ? t('news.tabMedia') : t('news.tabUpdates'))

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(String(locale.value).startsWith('en') ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1800)
  } catch { /* clipboard unavailable */ }
}

async function load() {
  loading.value = true
  notFound.value = false
  post.value = null
  more.value = []
  try {
    post.value = await getNewsItem(route.params.slug, route.query.server || null)
    usePageMeta({
      title: post.value.title,
      description: post.value.summary || undefined,
      ...(post.value.cover_image_url ? { image: post.value.cover_image_url } : {}),
      url: `https://void-rp.ru/news/${post.value.slug}`,
      breadcrumbs: [
        { name: t('nav.home'), url: '/' },
        { name: t('news.title'), url: '/news' },
        { name: post.value.title },
      ],
    })
    // A few other recent posts so a reader has somewhere to go next.
    getNews({ limit: 4 })
      .then((res) => { more.value = (res.items || []).filter((i) => i.slug !== post.value?.slug).slice(0, 3) })
      .catch(() => { more.value = [] })
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.slug, () => { load(); window.scrollTo({ top: 0 }) })
</script>

<template>
  <section class="ni-page">
    <div class="container-shell ni-shell">
      <RouterLink to="/news" class="ni-back">{{ t('news.backToList') }}</RouterLink>

      <div v-if="loading" class="ni-skel">
        <div class="skeleton" style="height:40px;width:75%;border-radius:10px"></div>
        <div class="skeleton" style="aspect-ratio:16/6;border-radius:18px;margin:24px 0"></div>
        <div v-for="i in 5" :key="i" class="skeleton" style="height:14px;border-radius:6px;margin:12px 0"></div>
      </div>

      <div v-else-if="notFound" class="ni-note">
        <p>{{ t('news.notFound') }}</p>
        <RouterLink to="/news" class="ni-btn">{{ t('news.backToList') }}</RouterLink>
      </div>

      <article v-else-if="post" class="ni">
        <div class="ni-meta">
          <span class="ni-tag" :class="`ni-tag--${post.category}`">{{ catLabel(post.category) }}</span>
          <time :datetime="post.published_at">{{ fmtDate(post.published_at) }}</time>
          <span>{{ t('news.readTime', { n: readMinutes }) }}</span>
        </div>
        <h1 class="ni-title">{{ post.title }}</h1>
        <p v-if="post.summary" class="ni-lead">{{ post.summary }}</p>
        <div class="ni-byline">
          <span v-if="post.author_name">{{ t('news.by') }} <b>{{ post.author_name }}</b></span>
          <button type="button" class="ni-copy" @click="copyLink">{{ copied ? t('news.linkCopied') : t('news.copyLink') }}</button>
        </div>

        <img v-if="post.cover_image_url" :src="post.cover_image_url" alt="" class="ni-cover" />

        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="ni-body markdown-body" v-html="renderedBody"></div>
      </article>

      <aside v-if="more.length" class="ni-more">
        <h2 class="ni-more__title">{{ t('news.moreNews') }}</h2>
        <div class="ni-more__grid">
          <RouterLink v-for="m in more" :key="m.id" :to="`/news/${m.slug}`" class="ni-more__card">
            <span class="ni-more__cover"><img v-if="m.cover_image_url" :src="m.cover_image_url" alt="" loading="lazy" /></span>
            <span class="ni-more__date">{{ fmtDate(m.published_at) }}</span>
            <b>{{ m.title }}</b>
          </RouterLink>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.ni-page { padding-block: 24px 72px; }
.ni-shell { max-width: 860px; color: #eeecf7; }
.ni-back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 22px; font-size: 0.92rem; font-weight: 700; color: #9d99b6; text-decoration: none; }
.ni-back::before { content: '←'; }
.ni-back:hover { color: #c4b5fd; }
.ni-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font-size: 0.88rem; color: #9d99b6; }
.ni-tag { font-size: 0.78rem; font-weight: 800; padding: 3px 10px; border-radius: 999px; }
.ni-tag--update { color: #ddd6fe; background: rgba(139, 92, 246, 0.18); }
.ni-tag--media { color: #a7f3d0; background: rgba(34, 197, 94, 0.14); }
.ni-title { margin: 12px 0 0; font-size: clamp(1.8rem, 1.2rem + 1.8vw, 2.6rem); font-weight: 900; line-height: 1.12; letter-spacing: -0.025em; }
.ni-lead { margin: 14px 0 0; font-size: 1.12rem; line-height: 1.6; color: #cfcbe3; }
.ni-byline { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 18px; padding-bottom: 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.92rem; color: #9d99b6; }
.ni-byline b { color: #eeecf7; }
.ni-copy { height: 34px; padding: 0 14px; border-radius: 10px; font: inherit; font-size: 0.86rem; font-weight: 700; color: #eeecf7; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); cursor: pointer; }
.ni-copy:hover { background: rgba(255, 255, 255, 0.1); }
.ni-cover { display: block; width: 100%; aspect-ratio: 16 / 6; object-fit: cover; border-radius: 18px; margin: 24px 0 28px; border: 1px solid rgba(255, 255, 255, 0.08); }
.ni-body { font-size: 1.04rem; }
.ni-note { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 64px 20px; text-align: center; color: #9d99b6; }
.ni-note p { margin: 0; }
.ni-btn { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 12px; font-weight: 700; color: #eeecf7; text-decoration: none; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); }

.ni-more { margin-top: 48px; padding-top: 28px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.ni-more__title { margin: 0 0 16px; font-size: 1.2rem; font-weight: 800; }
.ni-more__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.ni-more__card { display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: inherit; }
.ni-more__cover { display: block; aspect-ratio: 16 / 6; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(13, 11, 23, 0.8)); border: 1px solid rgba(255, 255, 255, 0.08); }
.ni-more__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ni-more__date { margin-top: 4px; font-size: 0.8rem; color: #9d99b6; }
.ni-more__card b { font-size: 0.95rem; line-height: 1.3; }
.ni-more__card:hover b { color: #c4b5fd; }
.ni-back:focus-visible, .ni-copy:focus-visible, .ni-more__card:focus-visible, .ni-btn:focus-visible { outline: 2px solid #a78bfa; outline-offset: 3px; border-radius: 8px; }

@media (max-width: 640px) {
  .ni-page { padding-block: 16px 48px; }
  .ni-more__grid { grid-template-columns: minmax(0, 1fr); }
  .ni-lead { font-size: 1.02rem; }
}
</style>

<style>
/* Rendered markdown (unscoped so it styles v-html output) */
.markdown-body { color: #d9d6ea; line-height: 1.75; font-size: 1rem; overflow-wrap: anywhere; }
.markdown-body > :first-child { margin-top: 0; }
.markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #f4f2fb; font-weight: 800; margin: 2rem 0 0.7rem; line-height: 1.3; letter-spacing: -0.01em; }
.markdown-body h1 { font-size: 1.6rem; }
.markdown-body h2 { font-size: 1.38rem; }
.markdown-body h3 { font-size: 1.15rem; }
.markdown-body p { margin: 0.85rem 0; }
.markdown-body strong { color: #f4f2fb; }
.markdown-body a { color: #c4b5fd; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: rgba(196, 181, 253, 0.45); }
.markdown-body a:hover { color: #ddd6fe; text-decoration-color: currentColor; }
/* Tailwind's preflight strips list markers; articles need them back. */
.markdown-body ul, .markdown-body ol { margin: 0.85rem 0; padding-left: 1.5rem; }
.markdown-body ul { list-style: disc; }
.markdown-body ol { list-style: decimal; }
.markdown-body li { margin: 0.4rem 0; padding-left: 0.2rem; }
.markdown-body li::marker { color: #a78bfa; }
.markdown-body img { max-width: 100%; height: auto; border-radius: 14px; margin: 1.2rem 0; border: 1px solid rgba(255, 255, 255, 0.08); }
.markdown-body blockquote { border-left: 3px solid #8b5cf6; padding: 0.5rem 0 0.5rem 1rem; margin: 1.2rem 0; color: #c9c5dc; background: rgba(139, 92, 246, 0.07); border-radius: 0 10px 10px 0; }
.markdown-body blockquote p { margin: 0.35rem 0; }
.markdown-body code { background: rgba(255, 255, 255, 0.08); padding: 0.12rem 0.4rem; border-radius: 6px; font-size: 0.9em; color: #e9d5ff; }
.markdown-body pre { background: rgba(10, 7, 20, 0.7); padding: 1rem; border-radius: 12px; overflow-x: auto; border: 1px solid rgba(255, 255, 255, 0.08); margin: 1rem 0; }
.markdown-body pre code { background: none; padding: 0; }
.markdown-body hr { border: none; border-top: 1px solid rgba(255, 255, 255, 0.1); margin: 2rem 0; }
.markdown-body table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.95rem; }
.markdown-body th, .markdown-body td { padding: 0.5rem 0.7rem; border: 1px solid rgba(255, 255, 255, 0.1); text-align: left; }
.markdown-body th { background: rgba(255, 255, 255, 0.05); color: #f4f2fb; }
</style>
