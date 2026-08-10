<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, RouterLink } from 'vue-router'
import { authState } from '../stores/authStore'
import { linkTelegram } from '../services/telegramApi'

const { t } = useI18n()
const route = useRoute()

const code = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const accountName = computed(
  () => authState.user?.site_login || authState.playerAccount?.minecraft_nickname || '',
)

const state = ref('confirm') // confirm | loading | done | error
const linkedUsername = ref('')
const errorMsg = ref('')

async function confirm() {
  if (!code.value) {
    state.value = 'error'
    errorMsg.value = t('linkTelegram.noCode')
    return
  }
  state.value = 'loading'
  try {
    const res = await linkTelegram(authState.accessToken, code.value)
    linkedUsername.value = res?.telegram_username || ''
    state.value = 'done'
  } catch (e) {
    errorMsg.value = e?.message || t('linkTelegram.failed')
    state.value = 'error'
  }
}

onMounted(() => {
  if (!code.value) {
    state.value = 'error'
    errorMsg.value = t('linkTelegram.noCode')
  }
})
</script>

<template>
  <section class="tg-page">
    <div class="container-shell container-shell--narrow">
      <div class="tg-card">
        <div class="tg-icon" :class="'tg-icon--' + state">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </div>

        <h1 class="tg-title">{{ t('linkTelegram.title') }}</h1>

        <!-- Confirm -->
        <template v-if="state === 'confirm' || state === 'loading'">
          <p class="tg-text">
            {{ t('linkTelegram.confirmText') }}
            <b v-if="accountName">{{ accountName }}</b>?
          </p>
          <p class="tg-hint">{{ t('linkTelegram.confirmHint') }}</p>
          <button class="tg-btn tg-btn--primary" :disabled="state === 'loading'" @click="confirm">
            {{ state === 'loading' ? t('linkTelegram.linking') : t('linkTelegram.confirmBtn') }}
          </button>
          <RouterLink to="/profile" class="tg-btn tg-btn--ghost">{{ t('linkTelegram.cancel') }}</RouterLink>
        </template>

        <!-- Done -->
        <template v-else-if="state === 'done'">
          <p class="tg-text tg-text--ok">
            ✓ {{ t('linkTelegram.doneText') }}
            <b v-if="linkedUsername">@{{ linkedUsername }}</b>
          </p>
          <p class="tg-hint">{{ t('linkTelegram.doneHint') }}</p>
          <RouterLink to="/profile" class="tg-btn tg-btn--primary">{{ t('linkTelegram.toProfile') }}</RouterLink>
        </template>

        <!-- Error -->
        <template v-else>
          <p class="tg-text tg-text--err">{{ errorMsg }}</p>
          <RouterLink to="/profile" class="tg-btn tg-btn--ghost">{{ t('linkTelegram.toProfile') }}</RouterLink>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tg-page { padding: 3.5rem 0 5rem; min-height: 60vh; display: flex; align-items: center; }
.container-shell--narrow { max-width: 520px; }
.tg-card {
  text-align: center;
  border: 1px solid var(--site-border);
  border-radius: var(--site-radius-md, 22px);
  background: var(--site-surface);
  box-shadow: var(--site-shadow);
  padding: 2.25rem 2rem 2rem;
}
.tg-icon {
  width: 60px; height: 60px; margin: 0 auto 1.25rem;
  display: flex; align-items: center; justify-content: center;
  border-radius: 16px; color: #fff;
  background: linear-gradient(135deg, #2aabee, #229ed9);
  box-shadow: 0 10px 30px rgba(34, 158, 217, 0.35);
}
.tg-icon--done { background: linear-gradient(135deg, #22c55e, #16a34a); box-shadow: 0 10px 30px rgba(34, 197, 94, 0.32); }
.tg-icon--error { background: linear-gradient(135deg, #f87171, #ef4444); box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3); }
.tg-title { font-size: 1.5rem; font-weight: 900; color: #f1f5ff; margin: 0 0 0.75rem; letter-spacing: -0.02em; }
.tg-text { font-size: 1rem; color: #cdd6ea; line-height: 1.6; margin: 0 0 0.4rem; }
.tg-text b { color: #f1f5ff; }
.tg-text--ok { color: #86efac; }
.tg-text--err { color: #fca5a5; }
.tg-hint { font-size: 0.86rem; color: #8896b5; line-height: 1.55; margin: 0 0 1.5rem; }
.tg-btn {
  display: block; width: 100%; padding: 0.7rem 1rem; margin-top: 0.6rem;
  border-radius: 12px; font-size: 0.92rem; font-weight: 700; cursor: pointer;
  border: 1px solid transparent; text-decoration: none;
}
.tg-btn--primary { background: linear-gradient(135deg, #8b5cf6, #6d5cf0); color: #fff; }
.tg-btn--primary:hover { filter: brightness(1.08); }
.tg-btn--primary:disabled { opacity: 0.6; cursor: default; }
.tg-btn--ghost { background: transparent; border-color: var(--site-border-strong); color: #9aa8c4; }
.tg-btn--ghost:hover { color: #e5eefc; }
</style>
