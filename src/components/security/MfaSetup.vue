<script setup>
// Подключение 2FA: приложение (QR / ключ) или Telegram; в конце — запасные коды.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import { authState } from '../../stores/authStore'
import { confirmTelegram, confirmTotp, getMfaStatus, sendTelegramCode, startTotp } from '../../services/securityApi'
import { toastSuccess } from '../../services/toast'
import BackupCodes from './BackupCodes.vue'

const props = defineProps({ only: { type: String, default: null } }) // 'totp' | 'telegram' | null
const emit = defineEmits(['done', 'cancel'])
const { t } = useI18n()
const token = () => authState.accessToken

const status = ref(null)
const step = ref(props.only || 'choose') // choose | totp | telegram | codes
const secret = ref('')
const qr = ref('')
const code = ref('')
const busy = ref(false)
const error = ref('')
const sent = ref(false)
const codes = ref([])
const copied = ref(false)
const groupedSecret = computed(() => secret.value.replace(/(.{4})/g, '$1 ').trim())

onMounted(async () => {
  try { status.value = await getMfaStatus(token()) } catch { status.value = null }
  if (step.value === 'totp') await beginTotp()
})

async function beginTotp() {
  step.value = 'totp'
  error.value = ''
  busy.value = true
  try {
    const res = await startTotp(token())
    secret.value = res.secret
    qr.value = await QRCode.toDataURL(res.uri, { margin: 1, width: 220, color: { dark: '#0b0b12', light: '#ffffff' } })
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function beginTelegram() {
  step.value = 'telegram'
  error.value = ''
  sent.value = false
}

async function sendCode() {
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

async function confirm() {
  busy.value = true
  error.value = ''
  try {
    const res = step.value === 'totp' ? await confirmTotp(token(), code.value) : await confirmTelegram(token(), code.value)
    toastSuccess(t('security.mfa.enabled'))
    if (res.backup_codes?.length) {
      codes.value = res.backup_codes
      step.value = 'codes'
    } else {
      emit('done')
    }
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function copySecret() {
  try { await navigator.clipboard.writeText(secret.value); copied.value = true; setTimeout(() => (copied.value = false), 1500) } catch { /* ignore */ }
}
</script>

<template>
  <div class="ms">
    <!-- Выбор способа -->
    <div v-if="step === 'choose'" class="ms-choose">
      <button type="button" class="ms-opt" @click="beginTotp">
        <span class="ms-opt__ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>
        </span>
        <span class="ms-opt__txt"><b>{{ t('security.mfa.app') }}</b><small>{{ t('security.mfa.appDesc') }}</small></span>
      </button>
      <button type="button" class="ms-opt" :disabled="status && !status.telegram_linked" @click="beginTelegram">
        <span class="ms-opt__ico ms-opt__ico--tg">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.3 2.9 11.5c-1 .4-1 1.8.1 2.1l4.6 1.4 1.7 5.4c.2.7 1.1.9 1.6.4l2.6-2.4 4.7 3.4c.6.4 1.4.1 1.6-.6L22.9 5.6c.2-.9-.6-1.6-1.4-1.3Zm-3.7 3.9-8.3 7.5-.3 3.3-1.4-4.5 10-6.3Z"/></svg>
        </span>
        <span class="ms-opt__txt"><b>{{ t('security.mfa.telegram') }}</b><small>{{ status && !status.telegram_linked ? t('security.mfa.telegramNotLinked') : t('security.mfa.telegramDesc') }}</small></span>
      </button>
    </div>

    <!-- Приложение -->
    <div v-else-if="step === 'totp'" class="ms-totp">
      <div class="ms-qr">
        <img v-if="qr" :src="qr" alt="QR" width="200" height="200" />
        <div v-else class="ms-qr__ph" />
      </div>
      <div class="ms-totp__side">
        <p class="ms-lead">{{ t('security.mfa.scan') }}</p>
        <p class="ms-dim">{{ t('security.mfa.manual') }}</p>
        <div class="ms-secret">
          <code>{{ groupedSecret }}</code>
          <button type="button" class="ms-link" @click="copySecret">{{ copied ? t('security.mfa.copied') : t('security.mfa.copy') }}</button>
        </div>
        <form class="ms-form" @submit.prevent="confirm">
          <input v-model="code" class="ms-input" inputmode="numeric" autocomplete="one-time-code" maxlength="7" :placeholder="t('security.mfa.enterCode')" autofocus />
          <button class="ms-btn" :disabled="busy || code.replace(/\D/g, '').length !== 6">{{ t('security.mfa.confirm') }}</button>
        </form>
        <p v-if="error" class="ms-err">{{ error }}</p>
        <button v-if="!only" type="button" class="ms-link ms-back" @click="step = 'choose'">← {{ t('security.mfa.cancel') }}</button>
      </div>
    </div>

    <!-- Telegram -->
    <div v-else-if="step === 'telegram'" class="ms-tg">
      <button type="button" class="ms-btn ms-btn--ghost" :disabled="busy" @click="sendCode">{{ t('security.mfa.sendTg') }}</button>
      <p v-if="sent" class="ms-ok">{{ t('security.mfa.sent') }}</p>
      <form v-if="sent" class="ms-form" @submit.prevent="confirm">
        <input v-model="code" class="ms-input" inputmode="numeric" autocomplete="one-time-code" maxlength="7" :placeholder="t('security.mfa.enterTgCode')" autofocus />
        <button class="ms-btn" :disabled="busy || code.replace(/\D/g, '').length !== 6">{{ t('security.mfa.confirm') }}</button>
      </form>
      <p v-if="error" class="ms-err">{{ error }}</p>
      <button v-if="!only" type="button" class="ms-link ms-back" @click="step = 'choose'">← {{ t('security.mfa.cancel') }}</button>
    </div>

    <!-- Запасные коды -->
    <BackupCodes v-else-if="step === 'codes'" :codes="codes" @done="emit('done')" />
  </div>
</template>

<style scoped>
.ms { --ms-line: rgba(148, 163, 184, 0.18); --ms-text: #e8ecf4; --ms-dim: #7d879c; --ms-acc: var(--adm-acc, #7c3aed); color: var(--ms-text); }
.ms-choose { display: grid; gap: 0.6rem; }
.ms-opt { display: flex; align-items: center; gap: 0.85rem; padding: 0.95rem 1rem; border-radius: 12px; border: 1px solid var(--ms-line); background: rgba(255, 255, 255, 0.02); color: inherit; cursor: pointer; text-align: left; transition: border-color 0.15s, background-color 0.15s; }
.ms-opt:hover:not(:disabled) { border-color: color-mix(in srgb, var(--ms-acc) 60%, transparent); background: color-mix(in srgb, var(--ms-acc) 8%, transparent); }
.ms-opt:disabled { opacity: 0.55; cursor: not-allowed; }
.ms-opt__ico { width: 2.4rem; height: 2.4rem; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: color-mix(in srgb, var(--ms-acc) 18%, transparent); color: var(--ms-acc); }
.ms-opt__ico svg { width: 1.2rem; height: 1.2rem; }
.ms-opt__ico--tg { background: rgba(42, 171, 238, 0.15); color: #2aabee; }
.ms-opt__txt { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.ms-opt__txt b { font-size: 0.92rem; }
.ms-opt__txt small { font-size: 0.74rem; color: var(--ms-dim); line-height: 1.4; }
.ms-totp { display: flex; gap: 1.2rem; align-items: flex-start; flex-wrap: wrap; }
.ms-qr { padding: 0.5rem; border-radius: 12px; background: #fff; flex-shrink: 0; }
.ms-qr img, .ms-qr__ph { display: block; width: 200px; height: 200px; max-width: 100%; }
.ms-totp__side { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 0.45rem; }
.ms-lead { margin: 0; font-weight: 700; }
.ms-dim { margin: 0; font-size: 0.78rem; color: var(--ms-dim); }
.ms-secret { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; padding: 0.5rem 0.7rem; border-radius: 9px; background: rgba(0, 0, 0, 0.3); border: 1px dashed var(--ms-line); }
.ms-secret code { font-family: ui-monospace, 'JetBrains Mono', Menlo, monospace; font-size: 0.82rem; letter-spacing: 0.06em; overflow-wrap: anywhere; }
.ms-form { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
.ms-input { flex: 1; min-width: 0; padding: 0.6rem 0.8rem; border-radius: 9px; border: 1px solid var(--ms-line); background: rgba(0, 0, 0, 0.35); color: inherit; font-size: 1rem; letter-spacing: 0.12em; }
.ms-input:focus { outline: none; border-color: var(--ms-acc); }
.ms-btn { padding: 0.6rem 1rem; border-radius: 9px; border: none; background: var(--ms-acc); color: #fff; font-weight: 700; cursor: pointer; white-space: nowrap; }
.ms-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ms-btn--ghost { background: rgba(42, 171, 238, 0.14); color: #7cd0f7; border: 1px solid rgba(42, 171, 238, 0.35); }
.ms-link { background: none; border: none; color: var(--ms-acc); cursor: pointer; font-size: 0.8rem; font-weight: 700; padding: 0; }
.ms-back { align-self: flex-start; margin-top: 0.3rem; color: var(--ms-dim); }
.ms-err { margin: 0; font-size: 0.8rem; color: #f87171; }
.ms-ok { margin: 0.4rem 0 0; font-size: 0.8rem; color: #34d399; }
.ms-tg { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
.ms-tg .ms-form { width: 100%; max-width: 360px; }
</style>
