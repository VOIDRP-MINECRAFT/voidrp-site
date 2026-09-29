<script setup>
// Экран перед админкой: подключить 2FA или ввести код на этом устройстве.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { authState, logoutCurrentSession } from '../../stores/authStore'
import { getMfaStatus, sendTelegramCode, verifyMfa } from '../../services/securityApi'
import MfaSetup from './MfaSetup.vue'

const props = defineProps({ mode: { type: String, required: true } }) // 'setup' | 'verify'
const emit = defineEmits(['done'])
const { t } = useI18n()
const token = () => authState.accessToken

const status = ref(null)
const code = ref('')
const busy = ref(false)
const error = ref('')
const sent = ref(false)

onMounted(async () => {
  try { status.value = await getMfaStatus(token()) } catch { status.value = null }
})

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await verifyMfa(token(), code.value)
    emit('done')
  } catch (e) {
    error.value = e.message
    code.value = ''
  } finally {
    busy.value = false
  }
}

async function sendTg() {
  busy.value = true
  error.value = ''
  try {
    await sendTelegramCode(token())
    sent.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function logout() {
  await logoutCurrentSession()
  window.location.href = '/login'
}
</script>

<template>
  <div class="mg">
    <div class="mg__card">
      <div class="mg__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
      </div>
      <h1 class="mg__title">{{ mode === 'setup' ? t('security.gate.setupTitle') : t('security.gate.verifyTitle') }}</h1>
      <p class="mg__sub">{{ mode === 'setup' ? t('security.gate.setupSub') : t('security.gate.verifySub') }}</p>

      <MfaSetup v-if="mode === 'setup'" @done="emit('done')" />

      <template v-else>
        <form class="mg__form" @submit.prevent="submit">
          <input
            v-model="code" class="mg__input" autocomplete="one-time-code" maxlength="12" autofocus
            :placeholder="t('security.gate.codePh')" spellcheck="false"
          />
          <button class="mg__btn" :disabled="busy || code.trim().length < 6">{{ t('security.mfa.confirm') }}</button>
        </form>
        <p v-if="error" class="mg__err">{{ error }}</p>
        <div class="mg__alt">
          <button v-if="status?.telegram" type="button" class="mg__tg" :disabled="busy" @click="sendTg">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.3 2.9 11.5c-1 .4-1 1.8.1 2.1l4.6 1.4 1.7 5.4c.2.7 1.1.9 1.6.4l2.6-2.4 4.7 3.4c.6.4 1.4.1 1.6-.6L22.9 5.6c.2-.9-.6-1.6-1.4-1.3Z"/></svg>
            {{ sent ? t('security.mfa.sent') : t('security.mfa.sendTg') }}
          </button>
          <span class="mg__hint">{{ t('security.gate.useBackup') }}</span>
        </div>
      </template>

      <div class="mg__foot">
        <RouterLink to="/profile" class="mg__link">{{ t('security.gate.toSite') }}</RouterLink>
        <button type="button" class="mg__link" @click="logout">{{ t('security.gate.logout') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mg { min-height: 100%; display: flex; align-items: flex-start; justify-content: center; padding-block: clamp(1.5rem, 8vh, 5rem); }
.mg__card {
  width: min(560px, 100%); padding: 2rem 1.8rem 1.4rem; border-radius: 18px;
  background: var(--adm-card, #0c1220); border: 1px solid var(--adm-line-strong, rgba(148, 163, 184, 0.18));
  box-shadow: 0 30px 80px -40px rgba(var(--adm-acc-rgb, 124, 58, 237), 0.55);
}
.mg__icon { width: 3rem; height: 3rem; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; background: var(--adm-acc-soft, rgba(124, 58, 237, 0.13)); color: var(--adm-acc-text, #a78bfa); }
.mg__icon svg { width: 1.5rem; height: 1.5rem; }
.mg__title { margin: 0 0 0.4rem; font-size: 1.3rem; font-weight: 800; color: var(--adm-text, #e8ecf4); text-wrap: balance; }
.mg__sub { margin: 0 0 1.3rem; font-size: 0.86rem; line-height: 1.55; color: var(--adm-mut, #94a0b8); }
.mg__form { display: flex; gap: 0.5rem; }
.mg__input { flex: 1; min-width: 0; padding: 0.75rem 0.9rem; border-radius: 10px; border: 1px solid var(--adm-line-strong, rgba(148, 163, 184, 0.18)); background: rgba(0, 0, 0, 0.35); color: var(--adm-text, #e8ecf4); font-size: 1.1rem; letter-spacing: 0.14em; text-align: center; }
.mg__input:focus { outline: none; border-color: var(--adm-acc, #7c3aed); }
.mg__btn { padding: 0.75rem 1.1rem; border-radius: 10px; border: none; background: var(--adm-acc, #7c3aed); color: #fff; font-weight: 800; cursor: pointer; }
.mg__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mg__err { margin: 0.6rem 0 0; font-size: 0.82rem; color: var(--adm-err, #f87171); }
.mg__alt { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; margin-top: 1rem; }
.mg__tg { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.5rem 0.8rem; border-radius: 9px; border: 1px solid rgba(42, 171, 238, 0.35); background: rgba(42, 171, 238, 0.12); color: #7cd0f7; font-weight: 700; font-size: 0.8rem; cursor: pointer; }
.mg__tg svg { width: 1rem; height: 1rem; }
.mg__hint { font-size: 0.76rem; color: var(--adm-dim, #55617a); }
.mg__foot { display: flex; justify-content: space-between; margin-top: 1.6rem; padding-top: 0.9rem; border-top: 1px solid var(--adm-line, rgba(148, 163, 184, 0.1)); }
.mg__link { background: none; border: none; padding: 0; font-size: 0.8rem; font-weight: 700; color: var(--adm-dim, #55617a); cursor: pointer; text-decoration: none; }
.mg__link:hover { color: var(--adm-mut, #94a0b8); }
</style>
