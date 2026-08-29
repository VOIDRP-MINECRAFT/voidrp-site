<script setup>
import { computed } from 'vue'

// Tiny dependency-free price sparkline. Draws sell (green) and buy (violet) series
// normalised into a fixed viewBox; the parent scales it with CSS width/height.
const props = defineProps({
  points: { type: Array, default: () => [] }, // [{ t, buy, sell }]
  width: { type: Number, default: 220 },
  height: { type: Number, default: 44 },
})

const W = props.width
const H = props.height
const PAD = 3

function series(key) {
  const pts = props.points
  if (!pts || pts.length < 2) return ''
  const vals = pts.map((p) => Number(p[key]) || 0)
  const all = pts.flatMap((p) => [Number(p.buy) || 0, Number(p.sell) || 0])
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min || 1
  const stepX = (W - PAD * 2) / (pts.length - 1)
  return vals
    .map((v, i) => {
      const x = PAD + i * stepX
      const y = H - PAD - ((v - min) / span) * (H - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

const sellLine = computed(() => series('sell'))
const buyLine = computed(() => series('buy'))
const hasData = computed(() => (props.points?.length || 0) >= 2)
const trend = computed(() => {
  const pts = props.points
  if (!hasData.value) return 0
  const a = Number(pts[0].sell) || 0
  const b = Number(pts[pts.length - 1].sell) || 0
  return b === a ? 0 : b > a ? 1 : -1
})
</script>

<template>
  <div v-if="hasData" class="spark" :class="{ up: trend > 0, down: trend < 0 }">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="spark-svg">
      <polyline :points="buyLine" class="spark-buy" />
      <polyline :points="sellLine" class="spark-sell" />
    </svg>
  </div>
</template>

<style scoped>
.spark { width: 100%; height: 100%; }
.spark-svg { width: 100%; height: 100%; display: block; overflow: visible; }
.spark-svg polyline { fill: none; stroke-width: 1.8; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
.spark-sell { stroke: #34d399; filter: drop-shadow(0 0 3px rgba(52, 211, 153, 0.5)); }
.spark-buy { stroke: rgba(139, 123, 255, 0.55); stroke-dasharray: 3 3; }
</style>
