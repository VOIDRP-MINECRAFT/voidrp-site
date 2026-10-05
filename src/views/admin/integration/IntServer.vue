<script setup>
// «Сервер»: что на нём стоит (по описи VoidRpPerms 0.6+), проверка сервера, история подключения.
import { computed, ref } from 'vue'
import { ago, copyText, fmtDateTime } from './util'

const props = defineProps({
  data: { type: Object, required: true },
  now: { type: Number, required: true },
})

const inv = computed(() => props.data.inventory || null)
const filter = ref('')
const plugins = computed(() => {
  const f = filter.value.trim().toLowerCase()
  return (inv.value?.plugins || []).filter((p) => !f || p.name.toLowerCase().includes(f))
})
const history = computed(() => props.data.history || [])
const ICON = { module_on: '▲', module_off: '▼', version: '↑', plugin_new: '+', quiet: '!', back: '✓', secret: '🔑' }
</script>

<template>
  <div class="sv">
    <section class="adm-card">
      <div class="adm-card__head">
        <div class="adm-card__title">Что стоит на сервере</div>
        <span v-if="inv" class="sv-muted">по отчёту VoidRpPerms · {{ ago(inv.at, now) }} · Java {{ inv.java }}</span>
      </div>
      <div v-if="!inv" class="sv-pad sv-muted">Опись присылает VoidRpPerms 0.6.0 и новее раз в 10 минут — обновите его, и здесь появятся все плагины сервера, конфликты и недостающие зависимости.</div>
      <div v-else class="sv-pad sv-col">
        <div v-if="!inv.issues.length" class="sv-ok"><span class="adm-dot adm-dot--ok" /> Конфликтов, недостающих плагинов и проблем с конфигами не видно.</div>
        <div v-for="(x, i) in inv.issues" :key="i" class="sv-issue" :class="`sv-issue--${x.level}`">
          <span class="adm-dot" :class="x.level === 'err' ? 'adm-dot--err' : x.level === 'warn' ? 'adm-dot--warn' : ''" /><span>{{ x.text }}</span>
        </div>
        <div class="sv-plhead">
          <span class="sv-label">Плагины ({{ inv.plugins.length }})</span>
          <input v-model="filter" class="adm-input sv-filter" placeholder="Найти плагин" />
        </div>
        <div class="sv-plugins">
          <span v-for="p in plugins" :key="p.name" class="sv-plugin" :class="{ 'sv-plugin--off': !p.enabled }" :title="p.file + (p.enabled ? '' : ' — выключен')">{{ p.name }} <b>{{ p.version }}</b></span>
        </div>
      </div>
    </section>

    <section class="adm-card">
      <div class="adm-card__head"><div class="adm-card__title">Проверка сервера</div></div>
      <div class="sv-pad sv-col">
        <p class="sv-muted">Java, DNS, связь с API, часы, открытый наружу RCON, версии плагинов и мешающие плагины (AuthMe, SkinsRestorer…). Выполните в папке сервера; с <code>--send</code> отчёт появится здесь.</p>
        <div class="sv-cmd"><code>{{ data.scripts?.doctor }} -s -- --send</code><button class="adm-btn adm-btn--sm" @click="copyText(`${data.scripts?.doctor} -s -- --send`)">Копировать</button></div>
        <details v-if="data.doctor" class="sv-doctor" open>
          <summary>Последний отчёт · {{ ago(data.doctor.at, now) }}</summary>
          <pre>{{ data.doctor.text }}</pre>
        </details>
      </div>
    </section>

    <section class="adm-card">
      <div class="adm-card__head"><div class="adm-card__title">История подключения</div><span class="sv-muted">последние {{ history.length }}</span></div>
      <div v-if="!history.length" class="sv-pad sv-muted">Событий пока нет.</div>
      <ul v-else class="sv-events">
        <li v-for="(e, i) in history" :key="i" class="sv-event" :class="`sv-event--${e.kind}`">
          <span class="sv-event__at">{{ fmtDateTime(e.at) }}</span>
          <span class="sv-event__icon">{{ ICON[e.kind] || '•' }}</span>
          <span class="sv-event__what"><b v-if="e.plugin">{{ e.plugin }}</b> {{ e.label }}<template v-if="e.detail">: {{ e.detail }}</template></span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.sv { display: flex; flex-direction: column; gap: 1rem; }
.sv-pad { padding: 0 1rem 1rem; }
.sv-col { display: flex; flex-direction: column; gap: 0.55rem; }
.sv-muted { color: var(--adm-dim); font-size: 0.82rem; line-height: 1.45; margin: 0; }
.sv code { font-family: var(--adm-mono); font-size: 0.8em; }
.sv-ok, .sv-issue { display: flex; gap: 0.5rem; align-items: baseline; font-size: 0.86rem; color: var(--adm-text); line-height: 1.45; }
.sv-issue { padding: 0.45rem 0.6rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); }
.sv-issue--err { border-color: color-mix(in srgb, var(--adm-err) 45%, var(--adm-line)); }
.sv-issue--warn { border-color: color-mix(in srgb, var(--adm-warn) 45%, var(--adm-line)); }
.sv-plhead { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.4rem; }
.sv-label { font-weight: 700; font-size: 0.86rem; color: var(--adm-text); }
.sv-filter { max-width: 220px; margin-left: auto; }
.sv-plugins { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.sv-plugin { font-size: 0.76rem; padding: 0.18rem 0.55rem; border-radius: 999px; border: 1px solid var(--adm-line); background: var(--adm-card-2); color: var(--adm-text); }
.sv-plugin b { font-family: var(--adm-mono); font-weight: 600; color: var(--adm-dim); }
.sv-plugin--off { opacity: 0.5; text-decoration: line-through; }
.sv-cmd { display: flex; gap: 0.5rem; align-items: center; }
.sv-cmd code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; padding: 0.5rem 0.65rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line); color: var(--adm-text); font-size: 0.78rem; }
.sv-doctor summary { cursor: pointer; font-size: 0.82rem; color: var(--adm-acc-text); }
.sv-doctor pre { margin: 0.4rem 0 0; padding: 0.65rem; max-height: 26rem; overflow: auto; font-family: var(--adm-mono); font-size: 0.74rem; background: var(--adm-card-2); border-radius: var(--adm-r-sm); color: var(--adm-text); white-space: pre-wrap; }
.sv-events { list-style: none; margin: 0; padding: 0 1rem 0.9rem; max-height: 32rem; overflow: auto; }
.sv-event { display: flex; gap: 0.6rem; align-items: baseline; padding: 0.35rem 0; border-bottom: 1px solid var(--adm-line); font-size: 0.82rem; color: var(--adm-text); }
.sv-event:last-child { border-bottom: 0; }
.sv-event__at { color: var(--adm-faint); font-size: 0.74rem; white-space: nowrap; width: 6.5rem; flex-shrink: 0; font-family: var(--adm-mono); }
.sv-event__icon { width: 1.1rem; text-align: center; font-weight: 800; color: var(--adm-dim); }
.sv-event--module_off .sv-event__icon, .sv-event--quiet .sv-event__icon { color: var(--adm-err); }
.sv-event--module_on .sv-event__icon, .sv-event--back .sv-event__icon { color: var(--adm-ok); }
.sv-event--version .sv-event__icon, .sv-event--plugin_new .sv-event__icon { color: var(--adm-acc-text); }
.sv-event__what { flex: 1; min-width: 0; }
</style>
