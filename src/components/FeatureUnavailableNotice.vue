<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { activeServer } from '../stores/serverStore'

const { t } = useI18n()

const serverName = computed(() => activeServer.value?.name || 'VoidRP')
</script>

<template>
  <section class="fgate">
    <div class="container-shell">
      <div class="fgate__card">
        <div class="fgate__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/>
          </svg>
        </div>
        <h1 class="fgate__title">{{ t('featureGate.title') }}</h1>
        <p class="fgate__text">{{ t('featureGate.text', { name: serverName }) }}</p>
        <div class="fgate__actions">
          <RouterLink to="/" class="fgate__btn fgate__btn--primary">{{ t('featureGate.home') }}</RouterLink>
          <RouterLink to="/servers" class="fgate__btn">{{ t('featureGate.switch') }}</RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fgate { padding: 5rem 0 6rem; }
.fgate__card {
  max-width: 480px;
  margin: 0 auto;
  text-align: center;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 24px;
  background: rgba(10, 14, 27, 0.7);
  backdrop-filter: blur(18px);
  padding: 2.6rem 2rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}
.fgate__icon {
  width: 3.4rem; height: 3.4rem;
  margin: 0 auto 1.1rem;
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  color: rgba(148, 163, 184, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(148, 163, 184, 0.07);
}
.fgate__title {
  margin: 0;
  font-size: 1.35rem; font-weight: 900; letter-spacing: -0.02em;
  color: #f1f5ff;
}
.fgate__text {
  margin: 0.7rem 0 0;
  font-size: 0.92rem; line-height: 1.65;
  color: #93a1c0;
}
.fgate__actions {
  margin-top: 1.6rem;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 0.6rem;
}
.fgate__btn {
  display: inline-flex; align-items: center;
  padding: 0.65rem 1.25rem; border-radius: 12px;
  font-size: 0.88rem; font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #cdd8ef;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.fgate__btn:hover { border-color: rgba(139, 92, 246, 0.4); background: rgba(139, 92, 246, 0.12); color: #fff; }
.fgate__btn--primary {
  border: none;
  background: linear-gradient(135deg, #7c3aed, #6366f1);
  color: #fff;
}
.fgate__btn--primary:hover { background: linear-gradient(135deg, #6d28d9, #4f46e5); }
</style>
