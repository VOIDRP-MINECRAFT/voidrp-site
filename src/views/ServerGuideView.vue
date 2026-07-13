<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { activeServer } from '../stores/serverStore.js'
import { getServerGuide } from '../data/serverGuides.js'
import { usePageMeta } from '../composables/usePageMeta.js'
import ExpertGuideView from './ExpertGuideView.vue'

const { t, locale } = useI18n()

const guide = computed(() => getServerGuide(activeServer.value?.slug, locale.value))
const serverName = computed(() => activeServer.value?.name || '')

// The main (default) server has no bespoke sections guide — it uses the rich
// modpack/expert guide instead. Rendering it here (rather than at a fixed /guide
// route) makes the guide react to the active-server switcher.
const showExpert = computed(() => !guide.value && !!activeServer.value?.is_default)

function num(i) {
  return String(i + 1).padStart(2, '0')
}
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
  <!-- Main server: delegate to the modpack/expert guide (reacts to server switch). -->
  <ExpertGuideView v-if="showExpert" />

  <section v-else class="gp py-3 md:py-4">
    <div class="container-shell max-w-[1240px] space-y-3">

      <!-- Empty state -->
      <div v-if="!guide" class="surface-card sg-empty">
        <div class="sg-empty__icon">📖</div>
        <h1 class="sg-empty__title">{{ t('serverGuide.emptyTitle') }}</h1>
        <p class="sg-empty__text">{{ t('serverGuide.emptyText') }}</p>
      </div>

      <template v-else>
        <!-- Header -->
        <header class="gp-header">
          <div class="gp-header__left">
            <p class="gp-eyebrow">{{ t('serverGuide.eyebrow') }}<span v-if="serverName"> · {{ serverName }}</span></p>
            <h1 class="gp-h1">{{ guide.title }}</h1>
            <p class="gp-desc">{{ guide.subtitle }}</p>
            <div class="gp-header__actions">
              <RouterLink to="/download-launcher" class="btn btn-primary btn-sm">{{ t('serverGuide.download') }}</RouterLink>
              <RouterLink to="/links" class="btn btn-outline btn-sm">{{ t('serverGuide.links') }}</RouterLink>
            </div>
          </div>
        </header>

        <!-- Layout -->
        <div class="gp-layout">
          <!-- sticky nav -->
          <aside class="gp-nav surface-card">
            <p class="gp-nav__label">{{ t('serverGuide.contents') }}</p>
            <nav class="gp-nav__list">
              <a v-for="(s, i) in guide.sections" :key="s.id" :href="`#sg-${s.id}`" class="gp-nav-link">
                <span class="gp-nav-link__num">{{ num(i) }}</span>
                <span class="gp-nav-link__title">{{ s.title }}</span>
              </a>
            </nav>
          </aside>

          <!-- sections -->
          <div class="gp-stages">
            <article
              v-for="(s, i) in guide.sections"
              :id="`sg-${s.id}`"
              :key="s.id"
              class="surface-card gp-stage"
            >
              <div class="gp-stage__header">
                <div>
                  <div class="gp-stage__num">{{ t('serverGuide.section') }} {{ num(i) }}</div>
                  <h2 class="gp-stage__title">{{ s.title }}</h2>
                </div>
              </div>

              <div class="gp-stage__body">
                <template v-for="(b, j) in s.blocks" :key="j">
                  <p v-if="b.t === 'p'" class="sg-p">{{ b.text }}</p>
                  <p v-else-if="b.t === 'h'" class="gp-list-label">{{ b.text }}</p>
                  <ul v-else-if="b.t === 'ul'" class="gp-unlocks">
                    <li v-for="(it, k) in b.items" :key="k"><span class="gp-diamond">◆</span>{{ it }}</li>
                  </ul>
                  <ol v-else-if="b.t === 'ol'" class="gp-unlocks gp-unlocks--num">
                    <li v-for="(it, k) in b.items" :key="k"><span class="gp-onum">{{ k + 1 }}</span>{{ it }}</li>
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
                        <div v-for="(cell, k) in b.grid" :key="k" class="sg-slot">
                          <img v-if="cell" :src="iconUrl(cell)" :alt="cell" class="sg-slot__img" loading="lazy" @error="onImgError" />
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
                      <li v-for="(ing, k) in b.legend" :key="k" class="sg-legend__item">
                        <img :src="iconUrl(ing.id)" :alt="ing.name" class="sg-legend__img" @error="onImgError" />
                        <span class="sg-legend__count">{{ ing.count }}×</span>
                        <span>{{ ing.name }}</span>
                      </li>
                    </ul>
                  </div>
                </template>
              </div>
            </article>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.gp { scroll-behavior: smooth; }

/* ─── Header ─── */
.gp-header { display: grid; gap: 1rem; align-items: start; }
.gp-eyebrow {
  font-size: .75rem; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
  color: rgb(100 116 139); margin: 0 0 .3rem;
}
.gp-h1 {
  font-size: 1.5rem; font-weight: 900; color: #f8fbff; margin: 0 0 .4rem; letter-spacing: -.03em;
}
.gp-desc {
  font-size: .83rem; line-height: 1.6; color: rgb(100 116 139); margin: 0 0 .75rem; max-width: 560px;
}
.gp-header__actions { display: flex; flex-wrap: wrap; gap: .4rem; }

/* ─── Layout ─── */
.gp-layout { display: grid; gap: .75rem; }
@media (min-width: 1024px) { .gp-layout { grid-template-columns: 220px minmax(0, 1fr); } }

/* ─── Sidebar nav ─── */
.gp-nav {
  padding: .85rem; position: sticky; top: 5rem; height: fit-content;
  max-height: calc(100vh - 7rem); overflow-y: auto;
}
@media (max-width: 1023px) { .gp-nav { position: relative; top: 0; max-height: none; } }
.gp-nav__label {
  font-size: .75rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: rgb(100 116 139); margin: 0 0 .5rem;
}
.gp-nav__list { display: flex; flex-direction: column; gap: .25rem; }
.gp-nav-link {
  display: flex; align-items: center; gap: .5rem; border-radius: 10px; padding: .4rem .5rem;
  transition: background .12s, color .12s; color: rgb(148 163 184);
}
.gp-nav-link:hover { background: rgba(255,255,255,.05); color: #fff; }
.gp-nav-link__num {
  font-size: .75rem; font-weight: 900; width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid rgba(134,239,172,.2); background: rgba(134,239,172,.07);
  display: flex; align-items: center; justify-content: center; color: rgb(134 239 172); flex-shrink: 0;
}
.gp-nav-link__title {
  font-size: .75rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ─── Sections ─── */
.gp-stages { display: flex; flex-direction: column; gap: .65rem; }
.gp-stage { padding: 1rem; scroll-margin-top: 5.5rem; }
.gp-stage__header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem;
  margin-bottom: .6rem; flex-wrap: wrap;
}
.gp-stage__num {
  font-size: .75rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: rgb(100 116 139); margin-bottom: .2rem;
}
.gp-stage__title { font-size: 1rem; font-weight: 900; color: #f0f4ff; margin: 0; letter-spacing: -.02em; }
.gp-stage__body { display: flex; flex-direction: column; gap: .1rem; }

.sg-p { font-size: .83rem; line-height: 1.6; color: rgb(148 163 184); margin: .35rem 0; }
.gp-list-label {
  font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: rgb(100 116 139); margin: .8rem 0 .3rem;
}
.gp-unlocks { list-style: none; margin: .2rem 0 .4rem; padding: 0; display: flex; flex-direction: column; gap: .3rem; }
.gp-unlocks li { display: flex; align-items: flex-start; gap: .5rem; font-size: .82rem; line-height: 1.5; color: rgb(148 163 184); }
.gp-diamond { color: rgb(110 231 183); flex-shrink: 0; font-size: .75rem; margin-top: .15rem; }
.gp-onum {
  flex-shrink: 0; font-size: .68rem; font-weight: 800; color: rgb(134 239 172);
  min-width: 16px; margin-top: .1rem;
}

.sg-note {
  display: flex; gap: .55rem; align-items: flex-start; margin: .6rem 0;
  padding: .65rem .8rem; border-radius: 12px;
  background: rgba(134,239,172,.07); border: 1px solid rgba(134,239,172,.2);
  color: rgb(203 213 225); font-size: .82rem; line-height: 1.5;
}
.sg-note__ico { flex-shrink: 0; }

.sg-cmd {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: .4rem .7rem;
  padding: .4rem 0; border-bottom: 1px dashed rgba(255,255,255,.07);
}
.sg-cmd:last-child { border-bottom: none; }
.sg-cmd__code {
  font-family: ui-monospace, monospace; font-size: .8rem; color: rgb(134 239 172);
  background: rgba(0,0,0,.3); border: 1px solid rgba(134,239,172,.22);
  padding: .12rem .45rem; border-radius: 6px; white-space: nowrap;
}
.sg-cmd__desc { color: rgb(148 163 184); font-size: .82rem; }

/* Recipe / crafting grid */
.sg-recipe { margin: .6rem 0 .3rem; }
.sg-craft {
  display: flex; align-items: center; flex-wrap: wrap; gap: .75rem 1rem;
  padding: .85rem; border-radius: 12px;
  background: rgba(0,0,0,.22); border: 1px solid rgba(255,255,255,.07);
}
.sg-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
  padding: 5px; border-radius: 8px; background: rgba(255,255,255,.04);
}
.sg-slot {
  width: 40px; height: 40px; border-radius: 6px;
  background: #12192c; border: 1px solid rgba(255,255,255,.08);
  box-shadow: inset 0 2px 5px rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
}
.sg-slot__img { width: 30px; height: 30px; image-rendering: pixelated; object-fit: contain; }
.sg-slot--result {
  width: 50px; height: 50px; border-color: rgba(134,239,172,.5);
  box-shadow: inset 0 2px 5px rgba(0,0,0,.45), 0 0 14px rgba(134,239,172,.28);
}
.sg-slot--result .sg-slot__img { width: 38px; height: 38px; }
.sg-arrow { font-size: 1.5rem; color: rgba(255,255,255,.45); font-weight: 700; }
.sg-craft__out { display: flex; flex-direction: column; align-items: center; gap: .3rem; }
.sg-result-name { font-size: .78rem; color: rgb(134 239 172); font-weight: 700; }
.sg-legend { display: flex; flex-wrap: wrap; gap: .45rem 1.2rem; margin: .65rem 0 0; padding: 0; list-style: none; }
.sg-legend__item { display: flex; align-items: center; gap: .4rem; color: rgb(148 163 184); font-size: .82rem; }
.sg-legend__img { width: 20px; height: 20px; image-rendering: pixelated; }
.sg-legend__count { color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }

/* Empty */
.sg-empty { text-align: center; padding: 3.5rem 1rem; }
.sg-empty__icon { font-size: 2.6rem; margin-bottom: .8rem; }
.sg-empty__title { font-size: 1.3rem; font-weight: 900; color: #f0f4ff; margin-bottom: .4rem; }
.sg-empty__text { color: rgb(100 116 139); font-size: .85rem; }
</style>
