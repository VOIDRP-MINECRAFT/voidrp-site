<script setup>
// Доступность за 30 дней: столбик на день, цвет — состояние (≥99,5% — норма, ≥95% — перебои,
// ниже — сбой), у каждого подсказка с датой и процентом; серый — данных нет.
import { computed, ref } from 'vue'

const props = defineProps({ status: { type: Object, required: true } })
const bars = computed(() => props.status?.bars_30d || [])
const cls = (u) => (u == null ? 'ub--none' : u >= 99.5 ? 'ub--ok' : u >= 95 ? 'ub--warn' : 'ub--err')
const hover = ref(null)
const fmt = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
</script>

<template>
  <div class="ub">
    <div class="ub-head">
      <span class="ub-title">Доступность за 30 дней</span>
      <span class="ub-nums">
        <span>24 ч: <b>{{ status.uptime_24h ?? '—' }}{{ status.uptime_24h != null ? '%' : '' }}</b></span>
        <span>7 дн: <b>{{ status.uptime_7d ?? '—' }}{{ status.uptime_7d != null ? '%' : '' }}</b></span>
        <span>30 дн: <b>{{ status.uptime_30d ?? '—' }}{{ status.uptime_30d != null ? '%' : '' }}</b></span>
      </span>
    </div>
    <div class="ub-bars" @mouseleave="hover = null">
      <span v-for="(b, i) in bars" :key="b.day" class="ub-bar" :class="cls(b.uptime)" @mouseenter="hover = i" />
    </div>
    <div class="ub-foot">
      <span v-if="hover != null">{{ fmt(bars[hover].day) }} — {{ bars[hover].uptime == null ? 'нет данных' : `${bars[hover].uptime}% на связи` }}</span>
      <template v-else><span>30 дней назад</span><span>сегодня</span></template>
    </div>
  </div>
</template>

<style scoped>
.ub { display: flex; flex-direction: column; gap: 0.45rem; }
.ub-head { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.4rem; align-items: baseline; }
.ub-title { font-size: 0.8rem; font-weight: 700; color: var(--adm-text); }
.ub-nums { display: flex; gap: 0.9rem; font-size: 0.78rem; color: var(--adm-dim); }
.ub-nums b { color: var(--adm-text); font-family: var(--adm-mono); }
.ub-bars { display: grid; grid-template-columns: repeat(30, minmax(0, 1fr)); gap: 2px; height: 34px; }
.ub-bar { border-radius: 3px; background: var(--adm-line); transition: transform 0.1s; }
.ub-bar:hover { transform: scaleY(1.12); }
.ub--ok { background: var(--adm-ok); }
.ub--warn { background: var(--adm-warn); }
.ub--err { background: var(--adm-err); }
.ub--none { background: var(--adm-line); }
.ub-foot { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--adm-faint); min-height: 1rem; }
</style>
