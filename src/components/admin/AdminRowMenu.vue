<script setup>
// Меню «⋯» для строки: редкие и опасные действия, чтобы в строке осталась одна главная кнопка.
// items: [{ label, onClick, danger?, disabled?, hidden? }]
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({ items: { type: Array, required: true }, label: { type: String, default: 'Ещё действия' } })
const open = ref(false)
const root = ref(null)
const shown = computed(() => props.items.filter((i) => i && !i.hidden))
function outside(e) { if (open.value && root.value && !root.value.contains(e.target)) open.value = false }
function key(e) { if (e.key === 'Escape') open.value = false }
onMounted(() => { document.addEventListener('click', outside); document.addEventListener('keydown', key) })
onBeforeUnmount(() => { document.removeEventListener('click', outside); document.removeEventListener('keydown', key) })
function pick(item) { open.value = false; item.onClick?.() }
</script>

<template>
  <div v-if="shown.length" ref="root" class="arm">
    <button type="button" class="adm-btn adm-btn--sm adm-btn--ghost arm__btn" :aria-label="label" :title="label" aria-haspopup="menu" :aria-expanded="open" @click.stop="open = !open">⋯</button>
    <div v-if="open" class="arm__menu" role="menu">
      <button v-for="i in shown" :key="i.label" type="button" role="menuitem" class="arm__item" :class="{ 'arm__item--danger': i.danger }" :disabled="i.disabled" @click="pick(i)">{{ i.label }}</button>
    </div>
  </div>
</template>

<style scoped>
.arm { position: relative; display: inline-flex; }
.arm__btn { font-weight: 900; letter-spacing: 0.05em; }
.arm__menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 30; min-width: 190px; display: flex; flex-direction: column; padding: 0.3rem; border-radius: var(--adm-r-sm); background: var(--adm-card-2); border: 1px solid var(--adm-line-strong); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45); }
.arm__item { text-align: left; padding: 0.45rem 0.6rem; border-radius: 6px; font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--adm-text); background: none; border: 0; cursor: pointer; white-space: nowrap; }
.arm__item:hover:not(:disabled) { background: rgba(148, 163, 184, 0.1); }
.arm__item:disabled { opacity: 0.5; cursor: not-allowed; }
.arm__item--danger { color: var(--adm-err); }
</style>
