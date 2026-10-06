<script setup>
// Общая панель «Сохранить» админки: всплывает снизу, когда в форме есть изменения.
// Ctrl+S (Cmd+S) сохраняет. Предупреждение при уходе — useUnsavedGuard().
import { onBeforeUnmount, onMounted } from 'vue'

const props = defineProps({
  dirty: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  blocked: { type: String, default: '' }, // текст причины, почему сохранить нельзя (ошибки в полях)
  text: { type: String, default: '' }, // что изменено; пусто — общая фраза
  saveLabel: { type: String, default: 'Сохранить' },
})
const emit = defineEmits(['save', 'reset'])

function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && props.dirty) {
    e.preventDefault()
    if (!props.saving && !props.blocked) emit('save')
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="asb">
    <div v-if="dirty" class="asb" role="region" aria-label="Несохранённые изменения">
      <span class="asb__text">
        <template v-if="blocked"><b class="asb__err">Нельзя сохранить:</b> {{ blocked }}</template>
        <template v-else-if="text"><b>Изменено:</b> {{ text }}</template>
        <template v-else><b>Есть несохранённые изменения</b></template>
      </span>
      <span class="asb__acts">
        <button type="button" class="adm-btn adm-btn--sm adm-btn--ghost" :disabled="saving" @click="emit('reset')">Отменить</button>
        <button type="button" class="adm-btn adm-btn--acc" :disabled="saving || !!blocked" @click="emit('save')">{{ saving ? 'Сохраняю…' : saveLabel }}<kbd>Ctrl+S</kbd></button>
      </span>
    </div>
  </Transition>
</template>

<style scoped>
.asb { position: fixed; left: 50%; bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 45; width: min(760px, calc(100vw - 2rem)); display: flex; gap: 0.8rem; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 0.65rem 0.75rem 0.65rem 1rem; border-radius: 14px; background: var(--adm-card-2); border: 1px solid var(--adm-acc-line); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5); }
@media (min-width: 900px) { .asb { left: calc(50% + 118px); width: min(760px, calc(100vw - 236px - 2rem)); } }
.asb__text { font-size: 0.82rem; color: var(--adm-mut); min-width: 0; flex: 1; }
.asb__text b { color: var(--adm-text); }
.asb__text .asb__err { color: var(--adm-err); }
.asb__acts { display: flex; gap: 0.4rem; }
.asb kbd { font-family: var(--adm-mono); font-size: 0.62rem; padding: 0.05rem 0.3rem; border-radius: 4px; background: rgba(255, 255, 255, 0.18); margin-left: 0.2rem; }
@media (max-width: 560px) { .asb kbd { display: none; } }
.asb-enter-active, .asb-leave-active { transition: transform 0.2s, opacity 0.2s; }
.asb-enter-from, .asb-leave-to { opacity: 0; transform: translate(-50%, 1rem); }
@media (prefers-reduced-motion: reduce) { .asb-enter-active, .asb-leave-active { transition: none; } }
</style>
