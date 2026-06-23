<script setup>
import {computed, reactive, ref, watch} from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { resendVerification, verifyEmail } from '../services/authApi'
import { toastError, toastSuccess, toastInfo } from '../services/toast'
import { reloadMe, useAuthStore } from '../stores/authStore'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({
  token: typeof route.query.token === 'string' ? route.query.token : '',
  email: typeof route.query.email === 'string' ? route.query.email : '',
})

const verifyMessage = ref('')
const resendMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)
const isResending = ref(false)

const isAlreadyVerified = computed(() => auth.emailVerified.value)
const sentFromRegister = computed(() => route.query.sent === '1')
const hasEmail = computed(() => typeof form.email === 'string' && form.email.trim().length > 0)
const hasToken = computed(() => typeof form.token === 'string' && form.token.trim().length > 0)

async function submitVerify() {
  if (!hasToken.value) return

  errorMessage.value = ''
  verifyMessage.value = ''
  isSubmitting.value = true

  try {
    await verifyEmail({ token: form.token.trim() })
    verifyMessage.value = t('verifyEmail.verified')

    if (auth.isAuthenticated.value) {
      await reloadMe()
    }
  } catch (error) {
    errorMessage.value = error.message || 'Не удалось подтвердить почту.'
  } finally {
    isSubmitting.value = false
  }
}

async function submitResend() {
  errorMessage.value = ''
  resendMessage.value = ''
  isResending.value = true

  try {
    await resendVerification({ email: form.email.trim() })
    resendMessage.value = t('verifyEmail.resent')
  } catch (error) {
    errorMessage.value = error.message || 'Не удалось отправить письмо повторно.'
  } finally {
    isResending.value = false
  }
}
watch(errorMessage, (value) => { if (value) toastError(value) })
watch(verifyMessage, (value) => { if (value) toastSuccess(value, t('verifyEmail.verifiedTitle')) })
watch(resendMessage, (value) => { if (value) toastInfo(value, t('verifyEmail.sentTitle')) })
</script>

<template>
  <section class="py-12 md:py-20 auth-page">
    <div class="container-shell max-w-6xl">
      <div v-if="isAlreadyVerified" class="alert alert-success mb-6">
        {{ t('verifyEmail.alreadyVerified') }}
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="surface-card p-6 md:p-8 lg:p-10">
          <div class="section-kicker">{{ t('verifyEmail.kicker') }}</div>
          <h1 class="section-title">{{ t('verifyEmail.title') }}</h1>
          <p class="section-subtitle">
            {{ t('verifyEmail.subtitle') }}
          </p>

          <div v-if="sentFromRegister && hasEmail" class="alert alert-info mt-6">
            {{ t('verifyEmail.sentToEmail', { email: form.email }) }}
          </div>

          <div v-else-if="hasEmail" class="alert alert-info mt-6">
            {{ t('verifyEmail.emailHint', { email: form.email }) }}
          </div>

          <form class="mt-8 grid gap-4" @submit.prevent="submitVerify">
            <label>
              <span class="field-label">{{ t('verifyEmail.tokenLabel') }}</span>
              <input v-model="form.token" class="input" :placeholder="t('verifyEmail.tokenPlaceholder')" />
            </label>

            <p v-if="verifyMessage" class="alert alert-success">{{ verifyMessage }}</p>
            <p v-if="errorMessage" class="alert alert-error">{{ errorMessage }}</p>

            <button type="submit" class="btn btn-primary" :disabled="isSubmitting || !hasToken">
              <span v-if="isSubmitting" class="spinner"></span>
              <span>{{ isSubmitting ? t('verifyEmail.submitting') : t('verifyEmail.submit') }}</span>
            </button>
          </form>

          <div class="mt-6 flex flex-wrap gap-3">
            <RouterLink v-if="auth.isAuthenticated.value" to="/profile" class="btn btn-outline">
              {{ t('verifyEmail.backToProfile') }}
            </RouterLink>
            <RouterLink v-else to="/login" class="btn btn-outline">
              {{ t('verifyEmail.toLogin') }}
            </RouterLink>
            <RouterLink to="/download-launcher" class="btn btn-ghost">
              {{ t('verifyEmail.downloadLauncher') }}
            </RouterLink>
          </div>
        </div>

        <div class="gradient-panel p-6 md:p-8 lg:p-10">
          <div class="section-kicker section-kicker--light">{{ t('verifyEmail.resendKicker') }}</div>
          <h2 class="text-3xl font-black tracking-tight text-white md:text-4xl">{{ t('verifyEmail.resendTitle') }}</h2>
          <p class="mt-4 text-base leading-8 text-white/78">
            {{ t('verifyEmail.resendDesc') }}
          </p>

          <form class="mt-8 grid gap-4" @submit.prevent="submitResend">
            <label>
              <span class="field-label !text-white/88">{{ t('verifyEmail.emailLabel') }}</span>
              <input v-model="form.email" type="email" class="input" required />
            </label>

            <p v-if="resendMessage" class="alert alert-success">{{ resendMessage }}</p>

            <button type="submit" class="btn btn-light" :disabled="isResending">
              <span v-if="isResending" class="spinner"></span>
              <span>{{ isResending ? t('verifyEmail.resending') : t('verifyEmail.resendSubmit') }}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
