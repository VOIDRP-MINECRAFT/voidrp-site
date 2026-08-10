<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, RouterLink } from 'vue-router'
import { marked } from 'marked'
import { getNewsItem } from '../services/newsApi'

const { t, locale } = useI18n()
const route = useRoute()

const post = ref(null)
const loading = ref(true)
const notFound = ref(false)

marked.setOptions({ gfm: true, breaks: true })

const renderedBody = computed(() => (post.value?.body ? marked.parse(post.value.body) : ''))

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
  notFound.value = false
  post.value = null
  try {
    post.value = await getNewsItem(route.params.slug, route.query.server || null)
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.slug, load)
</script>

<template>
  <section class="news-item-page">
    <div class="container-shell container-shell--narrow">
      <RouterLink to="/news" class="news-back">← {{ t('news.backToList') }}</RouterLink>

      <div v-if="loading" class="news-item-loading">
        <div class="skeleton" style="height:32px;width:70%;border-radius:8px"></div>
        <div class="skeleton" style="height:280px;border-radius:16px;margin:1.5rem 0"></div>
        <div class="skeleton" style="height:14px;border-radius:6px;margin:.6rem 0"></div>
        <div class="skeleton" style="height:14px;border-radius:6px;margin:.6rem 0"></div>
      </div>

      <div v-else-if="notFound" class="news-empty">
        <svg class="news-empty__icon" xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <p>{{ t('news.notFound') }}</p>
        <RouterLink to="/news" class="news-back">← {{ t('news.backToList') }}</RouterLink>
      </div>

      <article v-else-if="post" class="news-article">
        <div class="news-article__meta">
          <span class="news-article__cat" :class="post.category === 'media' ? 'news-article__cat--media' : 'news-article__cat--update'">
            {{ post.category === 'media' ? t('news.tabMedia') : t('news.tabUpdates') }}
          </span>
          <time class="news-article__date">{{ fmtDate(post.published_at) }}</time>
        </div>
        <h1 class="news-article__title">{{ post.title }}</h1>
        <p v-if="post.author_name" class="news-article__author">{{ t('news.by') }} {{ post.author_name }}</p>

        <img v-if="post.cover_image_url" :src="post.cover_image_url" alt="" class="news-article__cover" />

        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="news-article__body markdown-body" v-html="renderedBody"></div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.news-item-page { padding: 2rem 0 5rem; }
.container-shell--narrow { max-width: 820px; }
.news-back {
  display: inline-flex; align-items: center; margin-bottom: 1.5rem;
  color: #9aa8c4; font-weight: 600; font-size: .9rem;
  transition: color .18s ease;
}
.news-back:hover { color: #c4b5fd; }
.news-article__meta { display: flex; align-items: center; gap: .65rem; margin-bottom: .55rem; }
.news-article__cat {
  font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em;
  padding: .18rem .6rem; border-radius: 999px;
}
.news-article__cat--update { color: #c9b8ff; background: rgba(139, 92, 246, .14); border: 1px solid rgba(139, 92, 246, .28); }
.news-article__cat--media { color: #86efac; background: rgba(34, 197, 94, .12); border: 1px solid rgba(34, 197, 94, .28); }
.news-article__date { font-size: .8rem; color: #6f7c99; letter-spacing: .02em; }
.news-article__title { font-size: clamp(1.6rem, 3vw, 2.1rem); font-weight: 900; color: #f1f5ff; line-height: 1.18; margin: .35rem 0; letter-spacing: -.02em; }
.news-article__author { font-size: .88rem; color: #8896b5; margin-bottom: 1.25rem; }
.news-article__cover {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 6;
  object-fit: cover;
  border-radius: 16px;
  margin: 1rem 0 1.75rem;
  border: 1px solid rgba(255,255,255,.08);
}
.news-empty { text-align: center; padding: 4rem 1rem; color: #8896b5; }
.news-empty__icon { color: #7c6bd6; margin-bottom: .85rem; opacity: .85; }
</style>

<style>
/* Rendered markdown (unscoped so it styles v-html output) */
.markdown-body { color: #d6d2e6; line-height: 1.7; font-size: 1rem; }
.markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #f4f2fb; font-weight: 700; margin: 1.4rem 0 .6rem; line-height: 1.3; }
.markdown-body h1 { font-size: 1.6rem; }
.markdown-body h2 { font-size: 1.35rem; }
.markdown-body h3 { font-size: 1.15rem; }
.markdown-body p { margin: .7rem 0; }
.markdown-body a { color: #a78bfa; text-decoration: underline; text-underline-offset: 2px; }
.markdown-body a:hover { color: #c4b5fd; }
.markdown-body ul, .markdown-body ol { margin: .7rem 0; padding-left: 1.4rem; }
.markdown-body li { margin: .3rem 0; }
.markdown-body img { max-width: 100%; border-radius: 12px; margin: 1rem 0; }
.markdown-body blockquote {
  border-left: 3px solid #7c3aed; padding: .3rem 0 .3rem 1rem; margin: 1rem 0;
  color: #b8b2cf; background: rgba(124,58,237,.06); border-radius: 0 8px 8px 0;
}
.markdown-body code {
  background: rgba(255,255,255,.08); padding: .12rem .4rem; border-radius: 6px;
  font-size: .9em; color: #e9d5ff;
}
.markdown-body pre {
  background: rgba(10,7,20,.7); padding: 1rem; border-radius: 12px; overflow-x: auto;
  border: 1px solid rgba(255,255,255,.08); margin: 1rem 0;
}
.markdown-body pre code { background: none; padding: 0; }
.markdown-body hr { border: none; border-top: 1px solid rgba(255,255,255,.1); margin: 1.5rem 0; }
</style>
