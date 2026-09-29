<script setup>
// Окно пароля перед опасным действием: открывается само на ответ «reauth_required»,
// после верного пароля запрос повторяется.
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { authState } from '../../stores/authStore'
import { finishReauth, securityState } from '../../stores/securityStore'
import { reauth } from '../../services/securityApi'

const { t } = useI18n()
const password = ref('')
const busy = ref(false)
const error = ref('')
const input = ref(null)

watch(() => securityState.reauth, async (v) => {
  if (v) {
    password.value = ''
    error.value = ''
    await nextTick()
    input.value?.focus()
  }
})

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await reauth(authState.accessToken, password.value)
    finishReauth(true)
  } catch (e) {
    error.value = e.message
    if (e.status === 401) finishReauth(false)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="securityState.reauth" class="ra" @click.self="finishReauth(false)" @keydown.esc="finishReauth(false)">
    <form class="ra__card" @submit.prevent="submit">
      <div class="ra__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
      </div>
      <b class="ra__title">{{ t('security.reauth.title') }}</b>
      <p class="ra__sub">{{ t('security.reauth.sub') }}</p>
      <input ref="input" v-model="password" type="password" class="ra__input" autocomplete="current-password" :placeholder="t('security.reauth.password')" />
      <p v-if="error" class="ra__err">{{ error }}</p>
      <div class="ra__actions">
        <button type="button" class="ra__btn ra__btn--ghost" @click="finishReauth(false)">{{ t('security.reauth.cancel') }}</button>
        <button class="ra__btn" :disabled="busy || !password">{{ t('security.reauth.ok') }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.ra { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(3, 5, 10, 0.72); backdrop-filter: blur(4px); }
.ra__card { width: min(400px, 100%); display: flex; flex-direction: column; gap: 0.6rem; padding: 1.4rem; border-radius: 16px; background: #0c1220; border: 1px solid rgba(148, 163, 184, 0.2); box-shadow: 0 30px 70px -30px rgba(0, 0, 0, 0.9); color: #e8ecf4; }
.ra__icon { width: 2.4rem; height: 2.4rem; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: rgba(251, 191, 36, 0.12); color: #fbbf24; }
.ra__icon svg { width: 1.2rem; height: 1.2rem; }
.ra__title { font-size: 1.05rem; }
.ra__sub { margin: 0; font-size: 0.8rem; line-height: 1.5; color: #94a0b8; }
.ra__input { padding: 0.65rem 0.8rem; border-radius: 9px; border: 1px solid rgba(148, 163, 184, 0.22); background: rgba(0, 0, 0, 0.35); color: inherit; font-size: 0.95rem; }
.ra__input:focus { outline: none; border-color: var(--adm-acc, #7c3aed); }
.ra__err { margin: 0; font-size: 0.8rem; color: #f87171; }
.ra__actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.3rem; }
.ra__btn { padding: 0.55rem 1rem; border-radius: 9px; border: none; background: var(--adm-acc, #7c3aed); color: #fff; font-weight: 700; cursor: pointer; }
.ra__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ra__btn--ghost { background: transparent; color: #cbd2e0; border: 1px solid rgba(148, 163, 184, 0.25); }
</style>
