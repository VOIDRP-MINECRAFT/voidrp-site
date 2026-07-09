<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { activeServer } from '../stores/serverStore.js'
import { getServerGuide } from '../data/serverGuides.js'
import { usePageMeta } from '../composables/usePageMeta.js'

const { t, locale } = useI18n()

const guide = computed(() => getServerGuide(activeServer.value?.slug, locale.value))
const serverName = computed(() => activeServer.value?.name || '')

function iconUrl(id) {
  if (!id) return ''
  const [mod, item] = id.split(':')
  return `/item-icons/${(mod || 'minecraft').toLowerCase()}/${(item || '').toLowerCase()}.png`
}
function onImgError(e) {
  e.target.style.visibility = 'hidden'
}

usePageMeta({
  title: t('serverGuide.metaTitle'),
  description: t('serverGuide.metaDesc'),
  url: 'https://void-rp.ru/server-guide',
  breadcrumbs: [
    { name: t('nav.home'), url: '/' },
    { name: t('serverGuide.title') },
  ],
})
</script>

<template>
  <section class="sg py-3 md:py-4">
    <div class="container-shell max-w-[1240px]">
      <!-- Empty state -->
      <div v-if="!guide" class="sg-empty">
        <div class="sg-empty__icon">📖</div>
        <h1 class="sg-empty__title">{{ t('serverGuide.emptyTitle') }}</h1>
        <p class="sg-empty__text">{{ t('serverGuide.emptyText') }}</p>
      </div>

      <template v-else>
        <header class="sg-header">
          <p class="sg-eyebrow">{{ t('serverGuide.eyebrow') }}<span v-if="serverName"> · {{ serverName }}</span></p>
          <h1 class="sg-h1">{{ guide.title }}</h1>
          <p class="sg-subtitle">{{ guide.subtitle }}</p>
        </header>

        <div class="sg-layout">
          <!-- Table of contents -->
          <aside class="sg-toc">
            <nav class="sg-toc__inner">
              <p class="sg-toc__label">{{ t('serverGuide.contents') }}</p>
              <a
                v-for="s in guide.sections"
                :key="s.id"
                :href="`#sg-${s.id}`"
                class="sg-toc__link"
              >
                <span class="sg-toc__ico">{{ s.icon }}</span>
                <span>{{ s.title }}</span>
              </a>
            </nav>
          </aside>

          <!-- Sections -->
          <div class="sg-content">
            <article
              v-for="s in guide.sections"
              :id="`sg-${s.id}`"
              :key="s.id"
              class="sg-card"
            >
              <h2 class="sg-card__title">
                <span class="sg-card__ico">{{ s.icon }}</span>
                {{ s.title }}
              </h2>

              <template v-for="(b, i) in s.blocks" :key="i">
                <p v-if="b.t === 'p'" class="sg-p">{{ b.text }}</p>
                <h3 v-else-if="b.t === 'h'" class="sg-h">{{ b.text }}</h3>
                <ul v-else-if="b.t === 'ul'" class="sg-list">
                  <li v-for="(it, j) in b.items" :key="j">{{ it }}</li>
                </ul>
                <ol v-else-if="b.t === 'ol'" class="sg-list sg-list--num">
                  <li v-for="(it, j) in b.items" :key="j">{{ it }}</li>
                </ol>
                <div v-else-if="b.t === 'note'" class="sg-note">
                  <span class="sg-note__ico">💡</span><span>{{ b.text }}</span>
                </div>
                <div v-else-if="b.t === 'cmd'" class="sg-cmd">
                  <code class="sg-cmd__code">{{ b.text }}</code>
                  <span class="sg-cmd__desc">{{ b.desc }}</span>
                </div>
                <div v-else-if="b.t === 'recipe'" class="sg-recipe">
                  <div class="sg-craft">
                    <div class="sg-grid">
                      <div v-for="(cell, j) in b.grid" :key="j" class="sg-slot">
                        <img
                          v-if="cell"
                          :src="iconUrl(cell)"
                          :alt="cell"
                          class="sg-slot__img"
                          loading="lazy"
                          @error="onImgError"
                        />
                      </div>
                    </div>
                    <div class="sg-arrow">→</div>
                    <div class="sg-craft__out">
                      <div class="sg-slot sg-slot--result">
                        <img :src="iconUrl(b.result)" :alt="b.resultName" class="sg-slot__img" loading="lazy" @error="onImgError" />
                      </div>
                      <span class="sg-result-name">{{ b.resultName }}</span>
                    </div>
                  </div>
                  <ul v-if="b.legend" class="sg-legend">
                    <li v-for="(ing, j) in b.legend" :key="j" class="sg-legend__item">
                      <img :src="iconUrl(ing.id)" :alt="ing.name" class="sg-legend__img" @error="onImgError" />
                      <span class="sg-legend__count">{{ ing.count }}×</span>
                      <span>{{ ing.name }}</span>
                    </li>
                  </ul>
                </div>
              </template>
            </article>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.sg { scroll-behavior: smooth; }

.sg-header { margin-bottom: 1.5rem; }
.sg-eyebrow {
  font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase;
  color: #a78bfa; font-weight: 700; margin-bottom: 0.5rem;
}
.sg-h1 {
  font-size: clamp(1.7rem, 3vw, 2.6rem); font-weight: 800; line-height: 1.05;
  background: linear-gradient(120deg, #fff 0%, #c4b5fd 60%, #a44dff 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.sg-subtitle { color: rgba(255,255,255,0.55); margin-top: 0.5rem; font-size: 0.98rem; }

.sg-layout {
  display: grid; grid-template-columns: 1fr; gap: 1.25rem;
}
@media (min-width: 900px) {
  .sg-layout { grid-template-columns: 232px 1fr; align-items: start; }
}

/* TOC */
.sg-toc { display: none; }
@media (min-width: 900px) {
  .sg-toc { display: block; position: sticky; top: 84px; }
}
.sg-toc__inner {
  border: 1px solid rgba(167,139,250,0.16); border-radius: 16px;
  background: rgba(20,14,32,0.55); padding: 0.85rem; backdrop-filter: blur(8px);
}
.sg-toc__label {
  font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(255,255,255,0.4); font-weight: 700; padding: 0.25rem 0.5rem 0.5rem;
}
.sg-toc__link {
  display: flex; align-items: center; gap: 0.55rem; padding: 0.5rem 0.6rem;
  border-radius: 10px; font-size: 0.86rem; color: rgba(255,255,255,0.72);
  text-decoration: none; transition: background 0.15s, color 0.15s;
}
.sg-toc__link:hover { background: rgba(164,77,255,0.12); color: #fff; }
.sg-toc__ico { font-size: 1rem; width: 1.25rem; text-align: center; }

/* Content */
.sg-content { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
.sg-card {
  border: 1px solid rgba(167,139,250,0.14); border-radius: 18px;
  background: linear-gradient(180deg, rgba(28,20,44,0.6) 0%, rgba(16,11,26,0.6) 100%);
  padding: 1.25rem 1.35rem; scroll-margin-top: 84px;
}
.sg-card__title {
  display: flex; align-items: center; gap: 0.6rem;
  font-size: 1.25rem; font-weight: 800; color: #fff; margin-bottom: 0.75rem;
}
.sg-card__ico {
  font-size: 1.15rem; display: inline-flex; align-items: center; justify-content: center;
  width: 2rem; height: 2rem; border-radius: 10px;
  background: rgba(164,77,255,0.14); border: 1px solid rgba(164,77,255,0.3);
}
.sg-p { color: rgba(255,255,255,0.78); line-height: 1.6; margin: 0.4rem 0; }
.sg-h {
  font-size: 0.82rem; letter-spacing: 0.06em; text-transform: uppercase;
  color: #c4b5fd; font-weight: 700; margin: 1rem 0 0.4rem;
}
.sg-list { margin: 0.3rem 0 0.5rem; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.3rem; }
.sg-list li { color: rgba(255,255,255,0.76); line-height: 1.5; list-style: disc; }
.sg-list--num li { list-style: decimal; }
.sg-note {
  display: flex; gap: 0.6rem; align-items: flex-start; margin: 0.7rem 0;
  padding: 0.75rem 0.9rem; border-radius: 12px;
  background: rgba(164,77,255,0.1); border: 1px solid rgba(164,77,255,0.28);
  color: rgba(255,255,255,0.85); font-size: 0.92rem; line-height: 1.5;
}
.sg-note__ico { flex-shrink: 0; }
.sg-cmd {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem 0.75rem;
  padding: 0.5rem 0; border-bottom: 1px dashed rgba(255,255,255,0.08);
}
.sg-cmd:last-child { border-bottom: none; }
.sg-cmd__code {
  font-family: ui-monospace, monospace; font-size: 0.88rem; color: #7ee7c4;
  background: rgba(0,0,0,0.35); border: 1px solid rgba(126,231,196,0.25);
  padding: 0.15rem 0.5rem; border-radius: 7px; white-space: nowrap;
}
.sg-cmd__desc { color: rgba(255,255,255,0.66); font-size: 0.9rem; }

/* Recipe / crafting grid */
.sg-recipe { margin: 0.9rem 0 0.4rem; }
.sg-craft {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.75rem 1rem;
  padding: 0.9rem; border-radius: 14px;
  background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.08);
}
.sg-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
  padding: 5px; border-radius: 8px; background: rgba(255,255,255,0.05);
}
.sg-slot {
  width: 42px; height: 42px; border-radius: 6px;
  background: #1a1526; border: 1px solid rgba(255,255,255,0.09);
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
}
.sg-slot__img {
  width: 32px; height: 32px; image-rendering: pixelated; object-fit: contain;
}
.sg-slot--result {
  width: 52px; height: 52px;
  border-color: rgba(164,77,255,0.5);
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.45), 0 0 14px rgba(164,77,255,0.35);
}
.sg-slot--result .sg-slot__img { width: 40px; height: 40px; }
.sg-arrow { font-size: 1.6rem; color: rgba(255,255,255,0.5); font-weight: 700; }
.sg-craft__out { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; }
.sg-result-name { font-size: 0.8rem; color: #c4b5fd; font-weight: 700; }
.sg-legend {
  display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; margin: 0.7rem 0 0;
  padding: 0; list-style: none;
}
.sg-legend__item { display: flex; align-items: center; gap: 0.4rem; color: rgba(255,255,255,0.72); font-size: 0.88rem; }
.sg-legend__img { width: 22px; height: 22px; image-rendering: pixelated; }
.sg-legend__count { color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }

/* Empty */
.sg-empty { text-align: center; padding: 4rem 1rem; }
.sg-empty__icon { font-size: 3rem; margin-bottom: 1rem; }
.sg-empty__title { font-size: 1.5rem; font-weight: 800; color: #fff; margin-bottom: 0.5rem; }
.sg-empty__text { color: rgba(255,255,255,0.55); }
</style>
