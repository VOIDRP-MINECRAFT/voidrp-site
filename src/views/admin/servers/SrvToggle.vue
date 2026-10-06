<script setup>
// Переключатель вкл/выкл с подписью и пояснением.
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
  hint: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <label class="tg" :class="{ 'tg--off': disabled }">
    <input type="checkbox" class="tg__input" :checked="modelValue" :disabled="disabled" @change="emit('update:modelValue', $event.target.checked)" />
    <span class="tg__track" aria-hidden="true"><span class="tg__knob" /></span>
    <span class="tg__text">
      <span class="tg__label">{{ label }}</span>
      <span v-if="hint" class="tg__hint">{{ hint }}</span>
    </span>
  </label>
</template>

<style scoped>
.tg { display: flex; gap: 0.7rem; align-items: flex-start; cursor: pointer; }
.tg--off { cursor: not-allowed; opacity: 0.6; }
.tg__input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.tg__track { flex: none; width: 2.2rem; height: 1.25rem; border-radius: 999px; background: var(--adm-line-strong); position: relative; transition: background 0.16s; margin-top: 0.05rem; }
.tg__knob { position: absolute; top: 0.15rem; left: 0.15rem; width: 0.95rem; height: 0.95rem; border-radius: 50%; background: #cbd5e1; transition: transform 0.16s, background 0.16s; }
.tg__input:checked + .tg__track { background: var(--adm-acc); }
.tg__input:checked + .tg__track .tg__knob { transform: translateX(0.95rem); background: #fff; }
.tg__input:focus-visible + .tg__track { box-shadow: 0 0 0 3px rgba(var(--adm-acc-rgb), 0.35); }
.tg__text { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
.tg__label { font-size: 0.85rem; font-weight: 600; color: var(--adm-text); }
.tg__hint { font-size: 0.75rem; color: var(--adm-dim); line-height: 1.4; }
@media (prefers-reduced-motion: reduce) { .tg__track, .tg__knob { transition: none; } }
</style>
