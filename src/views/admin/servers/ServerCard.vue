<script setup>
// Карточка сервера в списке: баннер, живой онлайн, адрес, кому виден, техработы, меню.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SrvSeg from './SrvSeg.vue'
import { CORE_LABELS, VISIBILITY, address, visibilityOf } from './shared'

const props = defineProps({
  server: { type: Object, required: true },
  status: { type: Object, default: null },
  platform: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['edit', 'visibility', 'maintenance', 'delete', 'copy'])

const s = computed(() => props.server)
const addr = computed(() => address(s.value))
const state = computed(() => {
  if (s.value.maintenance) return { cls: 'maint', text: 'Техработы' }
  if (!props.status) return { cls: 'unknown', text: 'проверяем…' }
  if (props.status.online) return { cls: 'up', text: `${props.status.players_online}/${props.status.players_max}` }
  return { cls: 'down', text: 'Офлайн' }
})
const menu = ref(false)
const root = ref(null)
function outside(e) { if (menu.value && root.value && !root.value.contains(e.target)) menu.value = false }
onMounted(() => document.addEventListener('click', outside))
onBeforeUnmount(() => document.removeEventListener('click', outside))
</script>

<template>
  <article ref="root" class="sc" :style="s.accent_color ? { '--sc-acc': s.accent_color } : null">
    <div class="sc__banner" :style="s.banner_url ? { backgroundImage: `url(${s.banner_url})` } : null">
      <div class="sc__shade" />
      <span class="sc__state" :class="`sc__state--${state.cls}`"><i />{{ state.text }}</span>
      <div class="sc__id">
        <img v-if="s.icon_url" :src="s.icon_url" alt="" class="sc__icon" />
        <div v-else class="sc__icon sc__icon--ph">{{ s.name.charAt(0) }}</div>
        <div class="sc__names">
          <div class="sc__name">{{ s.name }}</div>
          <div class="sc__slug">{{ s.slug }}</div>
        </div>
      </div>
    </div>

    <div class="sc__body">
      <div class="sc__chips">
        <span v-if="s.is_default" class="sc-chip sc-chip--acc">по умолчанию</span>
        <span v-if="s.is_external" class="sc-chip">внешний</span>
        <span v-if="s.server_core" class="sc-chip">{{ CORE_LABELS[s.server_core] || s.server_core }}</span>
        <span class="sc-chip">MC {{ s.mc_version }}</span>
        <span v-if="s.loader" class="sc-chip sc-chip--dim">клиент: {{ s.loader }}</span>
        <span v-if="s.whitelist_mode !== 'public'" class="sc-chip sc-chip--warn">{{ s.whitelist_mode === 'whitelist' ? 'вайтлист' : 'по приглашению' }}</span>
      </div>

      <button v-if="addr" type="button" class="sc__addr" title="Скопировать адрес" @click="emit('copy', addr)">
        <code>{{ addr }}</code>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      </button>

      <div class="sc__controls">
        <div class="sc__ctl">
          <span class="sc__label">Кому виден</span>
          <SrvSeg small :model-value="visibilityOf(s)" :options="VISIBILITY" :disabled="busy" label="Кому виден сервер" @update:model-value="emit('visibility', $event)" />
        </div>
        <label class="sc__ctl sc__maint">
          <span class="sc__label">Техработы</span>
          <span class="sc-sw">
            <input type="checkbox" :checked="s.maintenance" :disabled="busy" @change="emit('maintenance', $event.target.checked)" />
            <span class="sc-sw__track"><span class="sc-sw__knob" /></span>
          </span>
        </label>
      </div>
    </div>

    <div class="sc__foot">
      <button type="button" class="adm-btn adm-btn--acc adm-btn--sm" @click="emit('edit')">Настроить</button>
      <div class="sc__more">
        <button type="button" class="adm-btn adm-btn--sm adm-btn--ghost" aria-haspopup="menu" :aria-expanded="menu" title="Ещё" @click.stop="menu = !menu">⋯</button>
        <div v-if="menu" class="sc__menu" role="menu">
          <RouterLink role="menuitem" :to="`/admin/monitoring?server=${s.slug}`">Мониторинг</RouterLink>
          <RouterLink v-if="s.is_external" role="menuitem" :to="`/admin/integration?server=${s.slug}`">Интеграция</RouterLink>
          <RouterLink role="menuitem" :to="`/admin/auth?server=${s.slug}`">Авторизация</RouterLink>
          <a role="menuitem" :href="`/status/${s.slug}`" target="_blank" rel="noopener">Страница статуса ↗</a>
          <button v-if="platform && !s.is_default" type="button" role="menuitem" class="sc__menu-danger" @click="menu = false; emit('delete')">Удалить сервер</button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.sc { --sc-acc: var(--adm-acc); display: flex; flex-direction: column; border-radius: var(--adm-r); background: var(--adm-card); border: 1px solid var(--adm-line); transition: border-color 0.16s; min-width: 0; }
.sc:hover { border-color: color-mix(in srgb, var(--sc-acc) 45%, var(--adm-line)); }
.sc__banner { position: relative; height: 112px; border-radius: var(--adm-r) var(--adm-r) 0 0; overflow: hidden; background: linear-gradient(135deg, color-mix(in srgb, var(--sc-acc) 55%, #12152b), #0b0e1c 70%); background-size: cover; background-position: center; display: flex; align-items: flex-end; }
.sc__shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6, 8, 15, 0.05), rgba(6, 8, 15, 0.88)); }
.sc__state { position: absolute; top: 0.6rem; right: 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.72rem; font-weight: 800; background: rgba(6, 9, 17, 0.75); backdrop-filter: blur(6px); border: 1px solid rgba(255, 255, 255, 0.08); color: var(--adm-mut); font-variant-numeric: tabular-nums; }
.sc__state i { width: 7px; height: 7px; border-radius: 50%; background: var(--adm-dim); }
.sc__state--up { color: #86efac; } .sc__state--up i { background: var(--adm-ok); box-shadow: 0 0 8px var(--adm-ok); }
.sc__state--down { color: #fca5a5; } .sc__state--down i { background: var(--adm-err); }
.sc__state--maint { color: #fde68a; } .sc__state--maint i { background: var(--adm-warn); }
.sc__id { position: relative; display: flex; gap: 0.7rem; align-items: center; padding: 0.75rem 0.9rem; min-width: 0; }
.sc__icon { width: 2.8rem; height: 2.8rem; border-radius: 11px; object-fit: cover; flex: none; border: 2px solid rgba(255, 255, 255, 0.12); }
.sc__icon--ph { display: grid; place-items: center; background: color-mix(in srgb, var(--sc-acc) 30%, #0c1220); color: #fff; font-weight: 900; font-size: 1.2rem; }
.sc__names { min-width: 0; }
.sc__name { font-weight: 800; font-size: 1rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc__slug { font-family: var(--adm-mono); font-size: 0.72rem; color: rgba(226, 232, 240, 0.7); }
.sc__body { padding: 0.8rem 0.9rem; display: flex; flex-direction: column; gap: 0.7rem; flex: 1; }
.sc__chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.sc-chip { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; background: var(--adm-card-2); border: 1px solid var(--adm-line); color: var(--adm-mut); }
.sc-chip--acc { color: var(--adm-acc-text); border-color: var(--adm-acc-line); background: var(--adm-acc-soft); }
.sc-chip--warn { color: #fcd34d; border-color: rgba(251, 191, 36, 0.3); }
.sc-chip--dim { color: var(--adm-dim); }
.sc__addr { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.4rem 0.6rem; border-radius: var(--adm-r-sm); border: 1px dashed var(--adm-line-strong); background: transparent; color: var(--adm-mut); cursor: pointer; text-align: left; }
.sc__addr code { flex: 1; min-width: 0; font-family: var(--adm-mono); font-size: 0.78rem; color: var(--adm-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc__addr:hover { border-color: var(--adm-acc-line); color: var(--adm-acc-text); }
.sc__controls { display: flex; gap: 0.8rem; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
.sc__ctl { display: flex; flex-direction: column; gap: 0.3rem; }
.sc__label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--adm-dim); }
.sc__maint { align-items: flex-end; cursor: pointer; }
.sc__maint .sc-sw { margin-top: 0.4rem; }
.sc-sw { position: relative; display: inline-flex; }
.sc-sw input { position: absolute; opacity: 0; inset: 0; cursor: pointer; margin: 0; }
.sc-sw__track { width: 2.2rem; height: 1.25rem; border-radius: 999px; background: var(--adm-line-strong); position: relative; transition: background 0.16s; }
.sc-sw__knob { position: absolute; top: 0.15rem; left: 0.15rem; width: 0.95rem; height: 0.95rem; border-radius: 50%; background: #cbd5e1; transition: transform 0.16s; }
.sc-sw input:checked + .sc-sw__track { background: var(--adm-warn); }
.sc-sw input:checked + .sc-sw__track .sc-sw__knob { transform: translateX(0.95rem); background: #fff; }
.sc-sw input:focus-visible + .sc-sw__track { box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.35); }
.sc__foot { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding: 0.65rem 0.9rem; border-top: 1px solid var(--adm-line); }
.sc__more { position: relative; }
.sc__menu { position: absolute; right: 0; bottom: calc(100% + 6px); z-index: 20; min-width: 190px; display: flex; flex-direction: column; padding: 0.3rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line-strong); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45); }
.sc__menu a, .sc__menu button { text-align: left; padding: 0.45rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; color: var(--adm-text); text-decoration: none; background: none; border: 0; cursor: pointer; font-family: inherit; }
.sc__menu a:hover, .sc__menu button:hover { background: rgba(148, 163, 184, 0.1); }
.sc__menu .sc__menu-danger { color: var(--adm-err); border-top: 1px solid var(--adm-line); border-radius: 0 0 6px 6px; margin-top: 0.2rem; }
@media (prefers-reduced-motion: reduce) { .sc-sw__track, .sc-sw__knob { transition: none; } }
</style>
