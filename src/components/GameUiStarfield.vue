<script setup>
// Canvas starfield matching the public homepage: rising, twinkling stars in the brand
// palette + occasional meteors. Fixed, behind the page content. Pauses when hidden.
import { ref, onMounted, onBeforeUnmount } from 'vue'

const canvas = ref(null)
let raf = 0, ro = null
let cleanup = () => {}

// brand star colors (violet-white mostly, with gold/fuchsia/green accents)
const COLORS = ['201,190,255', '167,139,250', '251,191,36', '217,70,239', '110,231,183', '230,235,255']

onMounted(() => {
  const cv = canvas.value
  if (!cv) return
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const ctx = cv.getContext('2d')
  let w = 0, h = 0
  const stars = []
  const meteors = []
  let nextMeteor = performance.now() + 3000

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth; h = window.innerHeight
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
    cv.style.width = w + 'px'; cv.style.height = h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    seed()
  }
  function seed() {
    stars.length = 0
    const n = Math.min(150, Math.round((w * h) / 12500))
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: 0.6 + Math.random() * 1.7,
        vy: 0.08 + Math.random() * 0.34,
        vx: (Math.random() - 0.5) * 0.06,
        ph: Math.random() * Math.PI * 2,
        tw: 0.4 + Math.random() * 1.2,
        depth: 0.4 + Math.random() * 0.6,
        c: COLORS[(Math.random() * COLORS.length) | 0],
      })
    }
  }
  function frame(t) {
    ctx.clearRect(0, 0, w, h)
    for (const p of stars) {
      p.y -= p.vy; p.x += p.vx
      if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w }
      if (p.x < -8) p.x = w + 8; else if (p.x > w + 8) p.x = -8
      const a = (0.28 + 0.5 * (0.5 + 0.5 * Math.sin((t / 1000) * p.tw + p.ph))) * p.depth
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832)
      ctx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`; ctx.fill()
    }
    if (t > nextMeteor && meteors.length < 2) {
      meteors.push({ x: w * (0.3 + Math.random() * 0.68), y: -30, vx: -(3 + Math.random() * 3), vy: 2 + Math.random() * 1.9, life: 1 })
      nextMeteor = t + 5000 + Math.random() * 8000
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i]
      m.x += m.vx; m.y += m.vy; m.life -= 0.009
      const tail = 18
      const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * tail, m.y - m.vy * tail)
      g.addColorStop(0, `rgba(255,255,255,${(0.8 * m.life).toFixed(3)})`)
      g.addColorStop(0.25, `rgba(167,139,250,${(0.55 * m.life).toFixed(3)})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.strokeStyle = g; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * tail, m.y - m.vy * tail); ctx.stroke()
      if (m.life <= 0 || m.x < -120 || m.y > h + 120) meteors.splice(i, 1)
    }
    raf = requestAnimationFrame(frame)
  }
  function start() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame) }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0 } }

  resize()
  if (reduce) { frame(0); stop() } else { start() }
  const onVis = () => (document.hidden ? stop() : start())
  ro = new ResizeObserver(resize); ro.observe(document.documentElement)
  document.addEventListener('visibilitychange', onVis)
  cleanup = () => { stop(); ro && ro.disconnect(); document.removeEventListener('visibilitychange', onVis) }
})

onBeforeUnmount(() => cleanup())
</script>

<template>
  <canvas ref="canvas" class="gp-stars" aria-hidden="true"></canvas>
</template>

<style scoped>
.gp-stars { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
</style>
