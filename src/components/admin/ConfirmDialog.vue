<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { confirmState, resolveConfirm } from '../../composables/useConfirm'

function onKey(e) {
  if (!confirmState.open) return
  if (e.key === 'Escape') resolveConfirm(false)
  if (e.key === 'Enter') resolveConfirm(true)
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="cfm-fade">
    <div v-if="confirmState.open" class="adm-modal-backdrop" @click.self="resolveConfirm(false)">
      <div class="adm-modal cfm" role="alertdialog" aria-modal="true">
        <div class="cfm__icon" :class="confirmState.danger ? 'cfm__icon--danger' : ''">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3 class="cfm__title">{{ confirmState.title }}</h3>
        <p v-if="confirmState.message" class="cfm__msg">{{ confirmState.message }}</p>
        <div class="cfm__actions">
          <button class="adm-btn" @click="resolveConfirm(false)">{{ confirmState.cancelLabel }}</button>
          <button
            class="adm-btn"
            :class="confirmState.danger ? 'adm-btn--danger' : 'adm-btn--acc'"
            autofocus
            @click="resolveConfirm(true)"
          >
            {{ confirmState.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cfm { max-width: 420px; text-align: center; }
.cfm__icon {
  width: 3rem; height: 3rem; margin: 0 auto 0.9rem;
  border-radius: 14px; display: flex; align-items: center; justify-content: center;
  background: var(--adm-acc-soft); color: var(--adm-acc-text);
}
.cfm__icon svg { width: 1.4rem; height: 1.4rem; }
.cfm__icon--danger { background: rgba(248, 113, 113, 0.12); color: #fca5a5; }
.cfm__title { font-size: 1.02rem; font-weight: 800; color: var(--adm-text); margin: 0 0 0.4rem; }
.cfm__msg { font-size: 0.85rem; line-height: 1.5; color: var(--adm-mut); margin: 0 0 1.3rem; }
.cfm__actions { display: flex; gap: 0.6rem; justify-content: center; }
.cfm__actions .adm-btn { min-width: 120px; }

.cfm-fade-enter-active, .cfm-fade-leave-active { transition: opacity 0.16s ease; }
.cfm-fade-enter-from, .cfm-fade-leave-to { opacity: 0; }
</style>
