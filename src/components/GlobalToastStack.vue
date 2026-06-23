<script setup>
import { computed } from 'vue'
import { removeToast, toastState } from '../services/toast'

const toasts = computed(() => toastState.items)

function dismiss(id) {
  removeToast(id)
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      <TransitionGroup name="toast-transition" tag="div" class="toast-stack__inner">
        <article
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-card"
          :class="[
            toast.type === 'success' && 'toast-card--success',
            toast.type === 'error' && 'toast-card--error',
            toast.type === 'info' && 'toast-card--info',
          ]"
          role="status"
        >
          <div class="toast-card__icon">
            <span v-if="toast.type === 'success'">✓</span>
            <span v-else-if="toast.type === 'error'">!</span>
            <span v-else>i</span>
          </div>

          <div class="min-w-0 flex-1">
            <p v-if="toast.title" class="toast-card__title">{{ toast.title }}</p>
            <p class="toast-card__message">{{ toast.message }}</p>
          </div>

          <button
            type="button"
            class="toast-card__close"
            aria-label="Закрыть уведомление"
            @click="dismiss(toast.id)"
          >
            ×
          </button>
        </article>
      </TransitionGroup>
    </div>
  </Teleport>
</template>