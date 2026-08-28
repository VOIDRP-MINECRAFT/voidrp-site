<script setup>
defineProps({
  art: { type: String, default: '' },        // item id, e.g. 'enchanting_table'
  deco: { type: Array, default: () => [] },   // small floating item ids
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  accent: { type: String, default: '#8b7bff' },
})
function icon(id) { return `/item-icons/minecraft/${id}.png` }
</script>

<template>
  <aside class="hero-panel" :style="{ '--accent': accent }">
    <!-- floating decorative item textures -->
    <div class="deco-layer" aria-hidden="true">
      <img v-for="(d, i) in deco" :key="d + i" :src="icon(d)" class="deco" :class="`d${i % 4}`" alt="" @error="$event.target.style.display='none'" />
    </div>

    <div class="art-stage">
      <img v-if="art" :src="icon(art)" class="art" alt="" @error="$event.target.style.display='none'" />
    </div>

    <div class="hero-txt">
      <div v-if="eyebrow" class="hero-eyebrow">{{ eyebrow }}</div>
      <h1 class="hero-title">{{ title }}</h1>
      <p v-if="desc" class="hero-desc">{{ desc }}</p>
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.hero-panel {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  padding: 24px 22px;
  border: 1px solid var(--gp-line, rgba(150,168,220,0.12));
  background:
    radial-gradient(340px 260px at 50% -10%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 62%),
    linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012));
  box-shadow: 0 22px 50px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
}

/* big item art */
.art-stage {
  position: relative;
  display: grid; place-items: center;
  height: 150px; margin-bottom: 8px;
}
.art-stage::before {
  content: ''; position: absolute; width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 40%, transparent), transparent 65%);
  filter: blur(22px);
}
.art {
  position: relative;
  width: 112px; height: 112px; image-rendering: pixelated;
  filter: drop-shadow(0 10px 16px rgba(0,0,0,0.55)) drop-shadow(0 0 18px color-mix(in srgb, var(--accent) 55%, transparent)) saturate(1.15) brightness(1.08);
  animation: hero-float 4s ease-in-out infinite;
}
@keyframes hero-float { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-9px) rotate(2deg); } }

/* small floating deco items */
.deco-layer { position: absolute; inset: 0; pointer-events: none; }
.deco { position: absolute; width: 30px; height: 30px; image-rendering: pixelated; opacity: 0.5; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); }
.deco.d0 { top: 14px; right: 16px; animation: hero-float 5s ease-in-out infinite; }
.deco.d1 { top: 60px; left: 12px; width: 24px; height: 24px; opacity: 0.4; animation: hero-float 6s ease-in-out 0.5s infinite; }
.deco.d2 { top: 118px; right: 22px; width: 26px; height: 26px; opacity: 0.42; animation: hero-float 5.5s ease-in-out 1s infinite; }
.deco.d3 { top: 30px; left: 30px; width: 20px; height: 20px; opacity: 0.35; animation: hero-float 7s ease-in-out 0.2s infinite; }

.hero-txt { position: relative; }
.hero-eyebrow { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: color-mix(in srgb, var(--accent) 72%, #ffffff); opacity: 0.92; }
.hero-title { margin-top: 5px; font-size: 1.85rem; font-weight: 900; letter-spacing: -0.02em; line-height: 1.03; color: #f4f7ff; }
.hero-desc { margin-top: 12px; font-size: 0.85rem; line-height: 1.6; color: var(--gp-ink-soft, #aeb9d6); }
</style>
