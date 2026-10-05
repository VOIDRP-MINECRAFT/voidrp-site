<script setup>
// «Живая схема подключения»: сервер ↔ VoidRP. Каждая линия — модуль; горит, когда он работает,
// и по ней бежит импульс, пока отчёты свежие. Оборванная линия — модуль молчит.
import { computed } from 'vue'

const props = defineProps({
  data: { type: Object, required: true },
  now: { type: Number, required: true },
})

const LINKS = [
  { key: 'auth', label: 'Вход', required: true },
  { key: 'monitoring', label: 'Мониторинг', required: true },
  { key: 'perms', label: 'Права' },
  { key: 'console', label: 'Консоль и лог' },
  { key: 'punishments', label: 'Наказания' },
  { key: 'anticheat', label: 'Античит' },
  { key: 'updates', label: 'Обновления' },
]

const reports = computed(() => props.data.reports || [])
const lastAt = computed(() => reports.value.map((r) => r.reported_at).sort().pop())
const live = computed(() => !!lastAt.value && props.now - new Date(lastAt.value).getTime() < 45000)

function state(key) {
  for (const r of reports.value) {
    const m = r.modules?.[key]
    if (r.fresh && m?.ok) return 'on'
  }
  for (const r of reports.value) if (r.modules?.[key]) return 'off'
  return 'none'
}
const links = computed(() => LINKS.map((l, i) => ({ ...l, state: state(l.key), y: 34 + i * 30 })))
const H = computed(() => 34 + (LINKS.length - 1) * 30 + 34)
const server = computed(() => props.data.server || {})
const reach = computed(() => props.data.reach)
</script>

<template>
  <div class="cm">
    <svg :viewBox="`0 0 640 ${H}`" class="cm-svg" role="img" :aria-label="`Схема подключения: ${links.filter((l) => l.state === 'on').length} из ${links.length} модулей работают`">
      <defs>
        <linearGradient id="cm-on" x1="0" x2="1">
          <stop offset="0%" stop-color="var(--adm-acc)" stop-opacity="0.35" />
          <stop offset="50%" stop-color="var(--adm-acc)" stop-opacity="0.9" />
          <stop offset="100%" stop-color="var(--adm-acc)" stop-opacity="0.35" />
        </linearGradient>
      </defs>

      <!-- узлы -->
      <g class="cm-node">
        <rect x="8" :y="H / 2 - 44" width="150" height="88" rx="14" />
        <text x="83" :y="H / 2 - 10" text-anchor="middle" class="cm-node__title">{{ (server.name || 'Сервер').slice(0, 18) }}</text>
        <text x="83" :y="H / 2 + 10" text-anchor="middle" class="cm-node__sub">{{ server.core_label || 'сервер' }}</text>
        <text x="83" :y="H / 2 + 28" text-anchor="middle" class="cm-node__sub" :class="reach ? (reach.ok ? 'cm-ok' : 'cm-err') : ''">
          {{ reach ? (reach.ok ? `снаружи ✓ ${reach.latency_ms} мс` : 'снаружи недоступен') : (live ? 'на связи' : 'молчит') }}
        </text>
      </g>
      <g class="cm-node cm-node--voidrp">
        <rect x="482" :y="H / 2 - 44" width="150" height="88" rx="14" />
        <text x="557" :y="H / 2 - 6" text-anchor="middle" class="cm-node__title">VoidRP</text>
        <text x="557" :y="H / 2 + 14" text-anchor="middle" class="cm-node__sub">панель · лаунчер · сайт</text>
      </g>

      <!-- линии модулей -->
      <g v-for="l in links" :key="l.key" :class="`cm-link cm-link--${l.state}`">
        <path :id="`cm-p-${l.key}`" :d="`M158 ${H / 2} C 260 ${H / 2}, 250 ${l.y}, 320 ${l.y} S 380 ${H / 2}, 482 ${H / 2}`" class="cm-line" />
        <rect x="262" :y="l.y - 11" width="116" height="22" rx="11" class="cm-pill" />
        <text x="320" :y="l.y + 4" text-anchor="middle" class="cm-label">{{ l.label }}{{ l.required ? ' *' : '' }}</text>
        <circle v-if="l.state === 'on' && live" r="3.5" class="cm-pulse">
          <animateMotion :dur="`${2.4 + (l.y % 7) / 5}s`" repeatCount="indefinite" :begin="`${(l.y % 5) / 5}s`">
            <mpath :href="`#cm-p-${l.key}`" />
          </animateMotion>
        </circle>
        <text v-if="l.state === 'off'" x="320" :y="l.y - 15" text-anchor="middle" class="cm-break">✕</text>
      </g>
    </svg>
    <div class="cm-legend">
      <span><i class="cm-dot cm-dot--on" />работает</span>
      <span><i class="cm-dot cm-dot--off" />выключен / молчит</span>
      <span><i class="cm-dot cm-dot--none" />не установлен</span>
      <span class="cm-muted">* обязательный · импульсы — свежие отчёты</span>
    </div>
  </div>
</template>

<style scoped>
.cm { display: flex; flex-direction: column; gap: 0.4rem; }
.cm-svg { width: 100%; height: auto; max-height: 300px; }
.cm-node rect { fill: var(--adm-card-2); stroke: var(--adm-line-strong); stroke-width: 1.5; }
.cm-node--voidrp rect { stroke: var(--adm-acc-line); fill: var(--adm-acc-soft); }
.cm-node__title { fill: var(--adm-text); font-size: 15px; font-weight: 800; }
.cm-node__sub { fill: var(--adm-dim); font-size: 11px; }
.cm-ok { fill: var(--adm-ok); }
.cm-err { fill: var(--adm-err); }
.cm-line { fill: none; stroke-width: 2; stroke: var(--adm-line); }
.cm-link--on .cm-line { stroke: url(#cm-on); stroke-width: 2.5; }
.cm-link--off .cm-line { stroke: var(--adm-err); stroke-dasharray: 5 6; opacity: 0.8; }
.cm-link--none .cm-line { stroke-dasharray: 2 6; opacity: 0.5; }
.cm-pill { fill: var(--adm-card); stroke: var(--adm-line); }
.cm-link--on .cm-pill { stroke: var(--adm-acc-line); }
.cm-link--off .cm-pill { stroke: color-mix(in srgb, var(--adm-err) 60%, transparent); }
.cm-label { fill: var(--adm-text); font-size: 11px; font-weight: 600; }
.cm-link--none .cm-label { fill: var(--adm-faint); }
.cm-pulse { fill: var(--adm-acc); filter: drop-shadow(0 0 4px var(--adm-acc)); }
.cm-break { fill: var(--adm-err); font-size: 11px; font-weight: 800; }
.cm-legend { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; font-size: 0.74rem; color: var(--adm-dim); justify-content: center; }
.cm-legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
.cm-dot { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
.cm-dot--on { background: var(--adm-acc); }
.cm-dot--off { background: var(--adm-err); }
.cm-dot--none { background: var(--adm-line-strong); }
.cm-muted { color: var(--adm-faint); }
@media (prefers-reduced-motion: reduce) { .cm-pulse { display: none; } }
</style>
