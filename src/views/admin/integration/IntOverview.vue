<script setup>
// «Обзор»: что сделать (по важности), модули сервера плитками, последние события.
import { computed } from 'vue'
import { ago, moduleTiles } from './util'

const props = defineProps({
  data: { type: Object, required: true },
  todo: { type: Array, required: true },
  now: { type: Number, required: true },
})
const emit = defineEmits(['go'])

const tiles = computed(() => moduleTiles(props.data))
const history = computed(() => (props.data.history || []).slice(0, 8))
const ICON = { module_on: '▲', module_off: '▼', version: '↑', plugin_new: '+', quiet: '!', back: '✓', secret: '🔑' }
</script>

<template>
  <div class="ov">
    <!-- Что сделать -->
    <section class="adm-card ov-todo">
      <div class="adm-card__head"><div class="adm-card__title">Что сделать</div></div>
      <div v-if="!todo.length" class="ov-done">
        <span class="ov-done__icon">✓</span>
        <div>
          <div class="ov-done__title">Всё в порядке</div>
          <div class="ov-muted">Обязательные модули работают, конфликтов и устаревших плагинов нет.</div>
        </div>
      </div>
      <ul v-else class="ov-list">
        <li v-for="(t, i) in todo" :key="i" class="ov-item" :class="`ov-item--${t.level}`">
          <span class="ov-item__mark" />
          <div class="ov-item__body">
            <div class="ov-item__title">{{ t.title }}</div>
            <div v-if="t.text" class="ov-muted">{{ t.text }}</div>
          </div>
          <button v-if="t.tab" class="adm-btn adm-btn--sm" @click="emit('go', t.tab)">{{ t.action || 'Открыть' }}</button>
        </li>
      </ul>
    </section>

    <!-- Модули -->
    <section class="ov-tiles">
      <div v-for="m in tiles" :key="m.key" class="ov-tile" :class="`ov-tile--${m.state}`">
        <div class="ov-tile__head">
          <span class="adm-dot" :class="{ 'adm-dot--ok': m.state === 'ok', 'adm-dot--warn': m.state === 'warn', 'adm-dot--err': m.state === 'err' }" />
          <span class="ov-tile__title">{{ m.title }}</span>
          <span v-if="m.required" class="adm-badge" :class="m.state === 'ok' ? 'adm-badge--ok' : 'adm-badge--err'">обязательно</span>
        </div>
        <div class="ov-tile__text">{{ m.text }}</div>
      </div>
    </section>

    <!-- События -->
    <section class="adm-card ov-hist">
      <div class="adm-card__head">
        <div class="adm-card__title">Последние события</div>
        <button v-if="(data.history || []).length > 8" class="adm-btn adm-btn--sm adm-btn--ghost" @click="emit('go', 'server')">Вся история</button>
      </div>
      <div v-if="!history.length" class="ov-muted ov-pad">Событий пока нет — они появятся, когда плагины начнут отчитываться.</div>
      <ul v-else class="ov-events">
        <li v-for="(e, i) in history" :key="i" class="ov-event" :class="`ov-event--${e.kind}`">
          <span class="ov-event__icon">{{ ICON[e.kind] || '•' }}</span>
          <span class="ov-event__what"><b v-if="e.plugin">{{ e.plugin }}</b> {{ e.label }}<template v-if="e.detail">: {{ e.detail }}</template></span>
          <span class="ov-event__at">{{ ago(e.at, now) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.ov { display: flex; flex-direction: column; gap: 1rem; }
.ov-muted { color: var(--adm-dim); font-size: 0.82rem; line-height: 1.45; }
.ov-pad { padding: 0 1rem 1rem; }

.ov-done { display: flex; gap: 0.9rem; align-items: center; padding: 0.4rem 1rem 1.1rem; }
.ov-done__icon { width: 2.4rem; height: 2.4rem; border-radius: 999px; display: grid; place-items: center; font-weight: 800; color: var(--adm-ok); background: color-mix(in srgb, var(--adm-ok) 16%, transparent); border: 1px solid color-mix(in srgb, var(--adm-ok) 40%, transparent); }
.ov-done__title { font-weight: 700; color: var(--adm-text); }

.ov-list { list-style: none; margin: 0; padding: 0 0.6rem 0.6rem; display: flex; flex-direction: column; gap: 0.35rem; }
.ov-item { display: flex; gap: 0.75rem; align-items: center; padding: 0.6rem 0.6rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); }
.ov-item__mark { flex-shrink: 0; width: 4px; align-self: stretch; border-radius: 4px; background: var(--adm-line-strong); }
.ov-item--err .ov-item__mark { background: var(--adm-err); }
.ov-item--warn .ov-item__mark { background: var(--adm-warn); }
.ov-item--info .ov-item__mark { background: var(--adm-info); }
.ov-item__body { flex: 1; min-width: 0; }
.ov-item__title { font-weight: 600; color: var(--adm-text); font-size: 0.88rem; }

.ov-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 0.7rem; }
.ov-tile { padding: 0.8rem 0.9rem; border-radius: var(--adm-r); background: var(--adm-card); border: 1px solid var(--adm-line); display: flex; flex-direction: column; gap: 0.35rem; }
.ov-tile--ok { border-color: color-mix(in srgb, var(--adm-ok) 35%, var(--adm-line)); }
.ov-tile--warn { border-color: color-mix(in srgb, var(--adm-warn) 45%, var(--adm-line)); }
.ov-tile--err { border-color: color-mix(in srgb, var(--adm-err) 50%, var(--adm-line)); }
.ov-tile--idle { opacity: 0.8; }
.ov-tile__head { display: flex; align-items: center; gap: 0.45rem; }
.ov-tile__title { font-weight: 700; font-size: 0.86rem; color: var(--adm-text); flex: 1; min-width: 0; }
.ov-tile__text { font-size: 0.78rem; color: var(--adm-dim); line-height: 1.4; }

.ov-events { list-style: none; margin: 0; padding: 0 1rem 0.9rem; display: flex; flex-direction: column; }
.ov-event { display: flex; gap: 0.6rem; align-items: baseline; padding: 0.4rem 0; border-bottom: 1px solid var(--adm-line); font-size: 0.83rem; color: var(--adm-text); }
.ov-event:last-child { border-bottom: 0; }
.ov-event__icon { width: 1.2rem; text-align: center; color: var(--adm-dim); font-weight: 800; }
.ov-event--module_off .ov-event__icon, .ov-event--quiet .ov-event__icon { color: var(--adm-err); }
.ov-event--module_on .ov-event__icon, .ov-event--back .ov-event__icon { color: var(--adm-ok); }
.ov-event--version .ov-event__icon, .ov-event--plugin_new .ov-event__icon { color: var(--adm-acc-text); }
.ov-event__what { flex: 1; min-width: 0; }
.ov-event__at { color: var(--adm-faint); font-size: 0.75rem; white-space: nowrap; }
</style>
