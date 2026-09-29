<script setup>
// Поле ника с подсказками: логин на сайте или игровой ник, от 2 символов, запрос через
// 200 мс после последнего нажатия, ответы кэшируются, устаревшие отбрасываются.
import { onBeforeUnmount, ref, watch } from 'vue'
import { authState } from '../../stores/authStore'
import { suggestPeople } from '../../services/adminModeratorsApi'

const props = defineProps({
  modelValue: { type: String, default: '' },
  roleId: { type: String, default: null },
  staffOnly: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Ник на сайте или в игре' },
  autofocus: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'pick', 'submit'])

const items = ref([])
const open = ref(false)
const active = ref(-1)
const loading = ref(false)
const cache = new Map()
let timer = null
let seq = 0
let justPicked = false

function key(q) { return `${props.roleId || ''}|${props.staffOnly ? 1 : 0}|${q}` }

async function lookup(q) {
  const k = key(q)
  if (cache.has(k)) { show(cache.get(k)); return }
  const my = ++seq
  loading.value = true
  try {
    const res = await suggestPeople(authState.accessToken, q, { roleId: props.roleId, staffOnly: props.staffOnly })
    cache.set(k, res)
    if (cache.size > 200) cache.delete(cache.keys().next().value)
    if (my === seq) show(res)
  } catch {
    if (my === seq) show([])
  } finally {
    if (my === seq) loading.value = false
  }
}
function show(list) {
  items.value = list
  active.value = list.length ? 0 : -1
  open.value = true
}

watch(() => props.modelValue, (v) => {
  clearTimeout(timer)
  if (justPicked) { justPicked = false; return }
  const q = (v || '').trim()
  if (q.length < 2) { open.value = false; items.value = []; seq++; return }
  timer = setTimeout(() => lookup(q), 200)
})
// Другой роль/значок — старые подсказки не годятся.
watch(() => [props.roleId, props.staffOnly], () => { items.value = []; open.value = false })
onBeforeUnmount(() => { clearTimeout(timer); clearTimeout(blurTimer) })

function pick(it) {
  justPicked = true
  emit('update:modelValue', it.site_login)
  emit('pick', it)
  open.value = false
}
let blurTimer = null
function onBlur() { blurTimer = setTimeout(() => { open.value = false }, 120) }
function onFocus() {
  clearTimeout(blurTimer)
  if (items.value.length && (props.modelValue || '').trim().length >= 2) open.value = true
}
function onKey(e) {
  if (open.value && items.value.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); active.value = (active.value + 1) % items.value.length; return }
    if (e.key === 'ArrowUp') { e.preventDefault(); active.value = (active.value - 1 + items.value.length) % items.value.length; return }
    if (e.key === 'Enter' && active.value >= 0) { e.preventDefault(); pick(items.value[active.value]); return }
  }
  if (e.key === 'Escape') { open.value = false; return }
  if (e.key === 'Enter') { e.preventDefault(); emit('submit') }
}
</script>

<template>
  <div class="ns">
    <input
      :value="modelValue"
      class="adm-input"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
      :autofocus="autofocus"
      role="combobox"
      :aria-expanded="open"
      @input="emit('update:modelValue', $event.target.value)"
      @keydown="onKey"
      @focus="onFocus"
      @blur="onBlur"
    />
    <span v-if="loading" class="ns__spin" aria-hidden="true" />
    <ul v-if="open" class="ns__menu" role="listbox">
      <li v-if="!items.length" class="ns__empty">Никого не нашлось{{ roleId ? ' — или этому человеку её не выдать' : '' }}</li>
      <li
        v-for="(it, i) in items" :key="it.id" role="option" :aria-selected="i === active"
        class="ns__item" :class="{ 'ns__item--on': i === active }"
        @mousedown.prevent="pick(it)" @mouseenter="active = i"
      >
        <span class="adm-avatar ns__ava">{{ it.site_login.charAt(0).toUpperCase() }}</span>
        <span class="ns__names">
          <b>{{ it.site_login }}</b>
          <small v-if="it.nickname && it.nickname.toLowerCase() !== it.site_login.toLowerCase()">в игре: {{ it.nickname }}</small>
        </span>
        <span v-if="it.staff" class="ns__tag">сотрудник</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ns { position: relative; flex: 1; min-width: 0; }
.ns .adm-input { width: 100%; }
.ns__spin { position: absolute; right: 0.7rem; top: 50%; width: 0.8rem; height: 0.8rem; margin-top: -0.4rem; border-radius: 50%; border: 2px solid var(--adm-line-strong); border-top-color: var(--adm-acc); animation: ns-spin 0.7s linear infinite; }
@keyframes ns-spin { to { transform: rotate(360deg); } }
.ns__menu {
  position: absolute; left: 0; right: 0; top: calc(100% + 5px); z-index: 40; padding: 0.3rem; max-height: 18rem; overflow-y: auto;
  border-radius: 10px; background: var(--adm-card); border: 1px solid var(--adm-line-strong); box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.75);
}
.ns__item { display: flex; align-items: center; gap: 0.55rem; padding: 0.4rem 0.5rem; border-radius: 7px; cursor: pointer; }
.ns__item--on { background: var(--adm-acc-soft); }
.ns__ava { width: 1.6rem; height: 1.6rem; font-size: 0.68rem; flex-shrink: 0; }
.ns__names { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ns__names b { font-size: 0.82rem; color: var(--adm-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ns__names small { font-size: 0.68rem; color: var(--adm-dim); }
.ns__tag { font-size: 0.62rem; font-weight: 700; padding: 0.05rem 0.4rem; border-radius: 999px; color: var(--adm-info); background: rgba(56, 189, 248, 0.1); flex-shrink: 0; }
.ns__empty { padding: 0.55rem 0.6rem; font-size: 0.76rem; color: var(--adm-dim); }
@media (prefers-reduced-motion: reduce) { .ns__spin { animation: none; } }
</style>
