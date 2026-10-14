<script setup>
// Логотип Компьютерной академии TOP: «top» с красным уголком и подпись справа.
// Размер — от font-size родителя (всё в em), цвет — `light` для тёмного фона.
defineProps({ light: { type: Boolean, default: false } })
</script>

<template>
  <div class="al" :class="{ light }" role="img" aria-label="Компьютерная академия TOP">
    <span class="al-top">top<i /></span>
    <span class="al-name">КОМПЬЮТЕРНАЯ<br>АКАДЕМИЯ</span>
  </div>
</template>

<style scoped>
.al { --fg: #111; display: inline-flex; align-items: center; gap: 0.32em; color: var(--fg); font-family: Inter, ui-sans-serif, system-ui, sans-serif; line-height: 1; }
.al.light { --fg: #fff; }
.al-top { position: relative; font-weight: 900; font-size: 1em; letter-spacing: -0.06em; padding-right: 0.32em; }
.al-top i { position: absolute; top: -0.06em; right: -0.04em; width: 0.32em; height: 0.32em; border-top: 0.09em solid #e8344e; border-right: 0.09em solid #e8344e; }
.al-name { font-weight: 800; font-size: 0.24em; letter-spacing: 0.08em; line-height: 1.25; border-left: 0.14em solid var(--fg); padding-left: 1em; }
</style>
