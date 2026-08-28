<script setup>
// Animated number that counts up to `value` once on mount (and on change).
// Cheap: a single rAF loop with cubic ease-out, ends exactly on the target.
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  duration: { type: Number, default: 850 },
  format: { type: Function, default: null },
})

const display = ref(0)
let raf = 0

function fmt(n) {
  return props.format ? props.format(n) : Math.round(n).toLocaleString('ru-RU')
}

function animate(to) {
  const from = display.value
  const start = performance.now()
  cancelAnimationFrame(raf)
  if (Math.abs(to - from) < 1) { display.value = to; return }
  const step = (now) => {
    const t = Math.min(1, (now - start) / props.duration)
    const eased = 1 - Math.pow(1 - t, 3)
    display.value = from + (to - from) * eased
    if (t < 1) raf = requestAnimationFrame(step)
    else display.value = to
  }
  raf = requestAnimationFrame(step)
}

onMounted(() => animate(Number(props.value) || 0))
watch(() => props.value, (v) => animate(Number(v) || 0))
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template><span>{{ fmt(display) }}</span></template>
