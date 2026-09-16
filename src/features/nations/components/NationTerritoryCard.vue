<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatNumber } from '../../../utils/formatters'

// Accent colours come from the parent through the --na-accent-* custom properties.
const props = defineProps({
  slug: { type: String, required: true },
  territory: { type: Object, default: null },
  mainArea: { type: Object, default: null },
  miniMap: { type: Object, default: null },
  mapUrl: { type: String, default: '' },
  mapTarget: { type: Object, default: null },
})
const { t } = useI18n()
const live = ref(false)
watch(() => props.slug, () => { live.value = false })
</script>

<template>
  <section class="ntc">
    <div class="ntc__top">
      <div>
        <h2 class="ntc__h">{{ t('nationPublic.territoryTitle') }}</h2>
        <p class="ntc__muted">{{ territory ? t('nationPublic.territoryAuto') : t('nationPublic.territoryNone') }}</p>
      </div>
      <a :href="mapUrl" target="_blank" rel="noopener" class="ntc__btn">{{ t('nationPublic.openMap') }}</a>
    </div>

    <div v-if="miniMap" class="ntc__body">
      <div class="ntc__mini">
        <iframe v-if="live" :src="mapUrl" class="ntc__frame" :title="t('nationPublic.territoryTitle')" loading="lazy" referrerpolicy="no-referrer"></iframe>
        <template v-else>
          <svg class="ntc__svg" :viewBox="miniMap.viewBox" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="t('nationPublic.territoryTitle')">
            <defs>
              <pattern :id="`ntc-grid-${slug}`" :width="miniMap.grid" :height="miniMap.grid" patternUnits="userSpaceOnUse">
                <path :d="`M${miniMap.grid} 0H0V${miniMap.grid}`" fill="none" stroke="rgba(255,255,255,0.05)" :stroke-width="miniMap.stroke * 0.5" />
              </pattern>
            </defs>
            <rect x="-100000" y="-100000" width="200000" height="200000" :fill="`url(#ntc-grid-${slug})`" />
            <path :d="miniMap.path" fill-rule="evenodd" class="ntc__land" :stroke-width="miniMap.stroke" />
            <circle :cx="miniMap.cx" :cy="miniMap.cz" :r="miniMap.r * 2.2" class="ntc__halo" />
            <circle :cx="miniMap.cx" :cy="miniMap.cz" :r="miniMap.r" class="ntc__dot" />
          </svg>
          <button type="button" class="ntc__live" @click="live = true">{{ t('nationPublic.liveMap') }}</button>
        </template>
      </div>
      <dl v-if="mainArea" class="ntc__facts">
        <div><dt>{{ t('nationPublic.terrSize') }}</dt><dd>{{ t('nationPublic.chunks', { n: formatNumber(territory.chunks) }) }}</dd></div>
        <div><dt>{{ t('nationPublic.terrArea') }}</dt><dd>{{ t('nationPublic.blocks', { n: formatNumber(territory.chunks * 256) }) }}</dd></div>
        <div><dt>{{ t('nationPublic.terrCenter') }}</dt><dd class="ntc__coords"><span>X {{ mainArea.center.x }}</span><span>Z {{ mainArea.center.z }}</span></dd></div>
        <div v-if="mainArea.parts > 1"><dt>{{ t('nationPublic.terrParts') }}</dt><dd>{{ mainArea.parts }}</dd></div>
      </dl>
    </div>
    <p v-else-if="mapTarget" class="ntc__muted">{{ t('nationPublic.capitalAt', { x: mapTarget.x, z: mapTarget.z }) }}</p>
    <slot />
  </section>
</template>

<style scoped>
.ntc { border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(19, 16, 33, 0.8); padding: 22px 24px; backdrop-filter: blur(18px); min-width: 0; color: #eeecf7; }
.ntc__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.ntc__h { margin: 0; font-size: 1.12rem; font-weight: 800; letter-spacing: -0.01em; }
.ntc__muted { margin: 4px 0 0; font-size: 0.9rem; line-height: 1.5; color: #9d99b6; }
.ntc__btn {
  display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 10px; white-space: nowrap;
  font-size: 0.86rem; font-weight: 700; color: #eeecf7; text-decoration: none; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14);
}
.ntc__btn:hover { background: rgba(255, 255, 255, 0.1); }
.ntc__body { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 18px; align-items: stretch; }
.ntc__mini { position: relative; aspect-ratio: 16 / 10; border-radius: 14px; overflow: hidden; background: radial-gradient(120% 100% at 50% 50%, rgba(255, 255, 255, 0.03), transparent 70%), #0b0916; border: 1px solid rgba(255, 255, 255, 0.08); }
.ntc__svg, .ntc__frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
.ntc__land { fill: var(--na-accent-soft, rgba(139, 92, 246, 0.14)); stroke: var(--na-accent-ui, #8b5cf6); stroke-linejoin: round; }
.ntc__halo { fill: var(--na-accent-glow, rgba(139, 92, 246, 0.28)); }
.ntc__dot { fill: var(--na-accent-ui, #8b5cf6); }
.ntc__live { position: absolute; right: 12px; bottom: 12px; height: 34px; padding: 0 12px; border-radius: 10px; cursor: pointer; font: inherit; font-size: 0.84rem; font-weight: 700; color: #fff; background: rgba(10, 8, 18, 0.75); border: 1px solid rgba(255, 255, 255, 0.18); backdrop-filter: blur(8px); }
.ntc__live:hover { background: rgba(10, 8, 18, 0.9); }
.ntc__btn:focus-visible, .ntc__live:focus-visible { outline: 2px solid var(--na-accent-ui, #8b5cf6); outline-offset: 2px; }
.ntc__facts { margin: 0; display: flex; flex-direction: column; justify-content: center; }
.ntc__facts > div { padding: 10px 0; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.ntc__facts > div:first-child { border-top: 0; }
.ntc__facts dt { font-size: 0.84rem; color: #9d99b6; }
.ntc__facts dd { margin: 2px 0 0; font-size: 1.05rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.ntc__coords { display: flex; flex-wrap: wrap; gap: 0 12px; }
.ntc__coords span { white-space: nowrap; }
@media (max-width: 640px) {
  .ntc { padding: 18px; }
  .ntc__top { flex-wrap: wrap; }
  .ntc__body { grid-template-columns: minmax(0, 1fr); }
  .ntc__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
  .ntc__facts > div:nth-child(2) { border-top: 0; }
}
</style>
