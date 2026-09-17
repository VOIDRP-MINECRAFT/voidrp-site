<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// Shared frame for the legal documents (offer, privacy policy): header, a table of contents that
// follows the reader, a collapsible contents list on phones, and the typography of the sections.
const props = defineProps({
  kicker: { type: String, required: true },
  title: { type: String, required: true },
  lead: { type: String, default: '' },
  updatedAt: { type: String, required: true },
  effectiveFrom: { type: String, default: '' },
  email: { type: String, required: true },
  toc: { type: Array, required: true },            // [{ id, label, num? }]; num overrides the position number
  otherDoc: { type: Object, required: true },      // { to, label }
})

const active = ref(props.toc[0]?.id || '')

// Unnumbered entries (like a short summary) don't shift the numbers of the sections after them.
const numbered = computed(() => {
  let n = 0
  return props.toc.map((item) => ({ ...item, num: item.num ?? String(++n) }))
})
let observer = null

onMounted(() => {
  // The section whose top most recently crossed the upper third of the screen is the current one.
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) active.value = visible[0].target.id
    },
    { rootMargin: '-20% 0px -70% 0px' },
  )
  for (const item of props.toc) {
    const el = document.getElementById(item.id)
    if (el) observer.observe(el)
  }
})
onBeforeUnmount(() => observer?.disconnect())

function print() {
  window.print()
}
</script>

<template>
  <div id="top" class="lg-page">
    <div class="container-shell lg">
      <header class="lg-head">
        <p class="lg-kicker">{{ kicker }}</p>
        <h1 class="lg-title">{{ title }}</h1>
        <p v-if="lead" class="lg-lead">{{ lead }}</p>
        <dl class="lg-meta">
          <div><dt>Редакция от</dt><dd>{{ updatedAt }}</dd></div>
          <div v-if="effectiveFrom"><dt>Действует с</dt><dd>{{ effectiveFrom }}</dd></div>
          <div><dt>Связь</dt><dd><a :href="`mailto:${email}`">{{ email }}</a></dd></div>
          <div class="lg-meta__actions">
            <RouterLink :to="otherDoc.to" class="lg-btn">{{ otherDoc.label }}</RouterLink>
            <button type="button" class="lg-btn lg-btn--ghost" @click="print">Распечатать</button>
          </div>
        </dl>
      </header>

      <details class="lg-toc-mobile">
        <summary>Содержание</summary>
        <ol>
          <li v-for="item in numbered" :key="item.id"><a :href="`#${item.id}`">{{ item.num ? `${item.num}. ` : '' }}{{ item.label }}</a></li>
        </ol>
      </details>

      <div class="lg-layout">
        <nav class="lg-toc" aria-label="Содержание">
          <p class="lg-toc__title">Содержание</p>
          <ol>
            <li v-for="item in numbered" :key="item.id">
              <a :href="`#${item.id}`" :class="{ on: active === item.id }" :aria-current="active === item.id ? 'true' : undefined">
                <span class="lg-toc__num">{{ item.num }}</span>{{ item.label }}
              </a>
            </li>
          </ol>
          <a href="#top" class="lg-toc__top">Наверх</a>
        </nav>

        <article class="lg-doc">
          <slot />
          <footer class="lg-foot">
            <RouterLink to="/" class="lg-btn lg-btn--ghost">На главную</RouterLink>
            <RouterLink :to="otherDoc.to" class="lg-btn">{{ otherDoc.label }}</RouterLink>
          </footer>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lg-page { padding-block: 28px 64px; }
.lg { max-width: 1100px; color: #e4e1f0; }

.lg-head { padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.lg-kicker { margin: 0; font-size: 0.92rem; font-weight: 700; color: #a78bfa; }
.lg-title { margin: 6px 0 0; max-width: 24ch; font-size: clamp(1.8rem, 1.2rem + 1.8vw, 2.6rem); font-weight: 900; line-height: 1.12; letter-spacing: -0.025em; color: #f6f4fc; }
.lg-lead { margin: 12px 0 0; max-width: 68ch; font-size: 1.02rem; line-height: 1.65; color: #b9b5cc; }
.lg-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 28px; margin: 18px 0 0; }
.lg-meta > div { display: flex; flex-direction: column; gap: 2px; }
.lg-meta dt { font-size: 0.8rem; color: #8f8ba6; }
.lg-meta dd { margin: 0; font-size: 0.95rem; font-weight: 700; color: #eeecf7; }
.lg-meta dd a { color: inherit; text-decoration: underline; text-decoration-color: rgba(167, 139, 250, 0.5); text-underline-offset: 3px; }
.lg-meta__actions { flex-direction: row !important; gap: 8px !important; margin-left: auto; }

.lg-btn { display: inline-flex; align-items: center; height: 38px; padding: 0 14px; border-radius: 10px; font: inherit; font-size: 0.88rem; font-weight: 700; color: #eeecf7; text-decoration: none; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); cursor: pointer; }
.lg-btn:hover { background: rgba(255, 255, 255, 0.1); }
.lg-btn--ghost { background: transparent; }
.lg-btn:focus-visible, .lg-toc a:focus-visible, .lg-toc-mobile summary:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }

.lg-layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 40px; align-items: start; }
.lg-toc { position: sticky; top: 96px; max-height: calc(100vh - 120px); overflow-y: auto; padding-right: 4px; }
.lg-toc__title { margin: 0 0 8px; font-size: 0.86rem; font-weight: 800; color: #8f8ba6; }
.lg-toc ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
.lg-toc a { display: flex; gap: 10px; align-items: baseline; padding: 6px 10px; border-radius: 8px; border-left: 2px solid transparent; font-size: 0.87rem; line-height: 1.35; color: #9d99b6; text-decoration: none; }
.lg-toc a:hover { color: #eeecf7; background: rgba(255, 255, 255, 0.04); }
.lg-toc a.on { color: #f6f4fc; background: rgba(139, 92, 246, 0.12); border-left-color: #a78bfa; }
.lg-toc__num { min-width: 16px; font-size: 0.78rem; font-weight: 800; color: #7c7894; font-variant-numeric: tabular-nums; }
.lg-toc a.on .lg-toc__num { color: #c4b5fd; }
.lg-toc__top { margin-top: 12px; border-left: 0 !important; font-weight: 700; }

.lg-toc-mobile { display: none; margin-bottom: 20px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(19, 16, 33, 0.8); }
.lg-toc-mobile summary { padding: 14px 16px; font-weight: 800; cursor: pointer; }
.lg-toc-mobile ol { list-style: none; margin: 0; padding: 0 8px 12px; }
.lg-toc-mobile a { display: block; padding: 8px 10px; border-radius: 8px; font-size: 0.92rem; color: #cfcbe3; text-decoration: none; }
.lg-toc-mobile a:hover { background: rgba(255, 255, 255, 0.05); }

.lg-doc { min-width: 0; max-width: 76ch; }
.lg-foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.08); }

/* Document typography for the slotted sections. */
.lg-doc :slotted(section) { scroll-margin-top: 96px; padding: 28px 0; border-top: 1px solid rgba(255, 255, 255, 0.07); }
.lg-doc :slotted(section:first-child) { border-top: 0; padding-top: 0; }
.lg-doc :slotted(h2) { margin: 0 0 14px; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.015em; color: #f6f4fc; }
.lg-doc :slotted(p) { margin: 0 0 12px; font-size: 1rem; line-height: 1.75; color: #d2cee3; }
.lg-doc :slotted(ul) { margin: 4px 0 14px; padding-left: 1.3rem; list-style: disc; }
.lg-doc :slotted(li) { margin: 6px 0; padding-left: 4px; font-size: 1rem; line-height: 1.65; color: #d2cee3; }
.lg-doc :slotted(li::marker) { color: #a78bfa; }
.lg-doc :slotted(a) { color: #c4b5fd; text-decoration: underline; text-decoration-color: rgba(196, 181, 253, 0.45); text-underline-offset: 3px; }
.lg-doc :slotted(a:hover) { color: #ddd6fe; }
.lg-doc :slotted(strong) { color: #f6f4fc; }
.lg-doc :slotted(section.lg-summary) { margin-bottom: 8px; padding: 18px 20px !important; border-radius: 16px; border: 1px solid rgba(167, 139, 250, 0.3); background: rgba(139, 92, 246, 0.08); }
.lg-doc :slotted(.lg-summary h2) { font-size: 1.1rem; margin-bottom: 10px; }
.lg-doc :slotted(.lg-note) { font-size: 0.9rem; color: #9d99b6; }

@media (max-width: 1000px) {
  .lg-layout { grid-template-columns: minmax(0, 1fr); }
  .lg-toc { display: none; }
  .lg-toc-mobile { display: block; }
  .lg-doc { max-width: none; }
  .lg-meta__actions { margin-left: 0; }
}
@media print {
  .lg-toc, .lg-toc-mobile, .lg-meta__actions, .lg-foot { display: none !important; }
  .lg-layout { grid-template-columns: 1fr; }
  .lg, .lg-title, .lg-doc :slotted(h2), .lg-doc :slotted(p), .lg-doc :slotted(li), .lg-lead, .lg-meta dd { color: #000 !important; }
}
</style>
