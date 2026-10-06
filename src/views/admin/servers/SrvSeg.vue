<script setup>
// Сегментированный выбор из нескольких вариантов: [value, label, title?].
defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
  small: { type: Boolean, default: false },
  label: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="seg" :class="{ 'seg--sm': small }" role="radiogroup" :aria-label="label">
    <button v-for="o in options" :key="o[0]" type="button" role="radio" class="seg__btn" :class="{ 'seg__btn--on': modelValue === o[0] }"
            :aria-checked="modelValue === o[0]" :title="o[2] || ''" :disabled="disabled" @click="emit('update:modelValue', o[0])">{{ o[1] }}</button>
  </div>
</template>

<style scoped>
.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 10px; background: #080c16; border: 1px solid var(--adm-line-strong); flex-wrap: wrap; }
.seg__btn { border: 0; background: transparent; color: var(--adm-mut); font: inherit; font-size: 0.8rem; font-weight: 700; padding: 0.38rem 0.75rem; border-radius: 7px; cursor: pointer; transition: background 0.14s, color 0.14s; }
.seg--sm .seg__btn { font-size: 0.72rem; padding: 0.28rem 0.55rem; }
.seg__btn:hover:not(:disabled) { color: var(--adm-text); }
.seg__btn--on { background: var(--adm-acc); color: #fff; }
.seg__btn--on:hover:not(:disabled) { color: #fff; }
.seg__btn:disabled { cursor: not-allowed; opacity: 0.6; }
.seg__btn:focus-visible { outline: 2px solid var(--adm-acc-line); outline-offset: 1px; }
</style>
