<script setup>
import {computed, reactive, ref, watch} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { resetPassword } from '../services/authApi'
import { toastError, toastSuccess } from '../services/toast'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const form = reactive({
  token: typeof route.query.token === 'string' ? route.query.token : '',
  new_password: '',
  new_password_repeat: '',
})

const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const hasTokenFromLink = computed(
  () => typeof form.token === 'string' && form.token.trim().length > 0,
)

async function submit() {
  errorMessage.value = ''
  successMessage.value = ''
  isSubmitting.value = true

  try {
    await resetPassword({
      token: form.token.trim(),
      new_password: form.new_password,
      new_password_repeat: form.new_password_repeat,
    })

    successMessage.value = t('resetPassword.success')

    setTimeout(() => {
      router.push('/login')
    }, 1200)
  } catch (error) {
    errorMessage.value = error.message || t('resetPassword.error')
  } finally {
    isSubmitting.value = false
  }
}
watch(errorMessage, (value) => { if (value) toastError(value) })
watch(successMessage, (value) => { if (value) toastSuccess(value, t('resetPassword.successTitle')) })
</script>

<template>
  <section class="py-12 md:py-20 auth-page">
    <div class="container-shell max-w-4xl">
      <div class="surface-card page-entry p-6 md:p-8 lg:p-10">
        <div class="section-kicker">{{ t('resetPassword.kicker') }}</div>
        <h1 class="section-title">{{ t('resetPassword.title') }}</h1>
        <p class="section-subtitle">
          {{ t('resetPassword.subtitle') }}
        </p>

        <div v-if="hasTokenFromLink" class="alert alert-info mt-6">
          {{ t('resetPassword.tokenDetected') }}
        </div>

        <form class="mt-8 grid gap-4" @submit.prevent="submit">
          <label v-if="!hasTokenFromLink">
            <span class="field-label">{{ t('resetPassword.tokenLabel') }}</span>
            <input v-model="form.token" class="input" required />
          </label>

          <label>
            <span class="field-label">{{ t('resetPassword.newPasswordLabel') }}</span>
            <input v-model="form.new_password" type="password" class="input" required />
          </label>

          <label>
            <span class="field-label">{{ t('resetPassword.newPasswordRepeatLabel') }}</span>
            <input v-model="form.new_password_repeat" type="password" class="input" required />
          </label>

          <p v-if="errorMessage" class="alert alert-error">{{ errorMessage }}</p>
          <p v-if="successMessage" class="alert alert-success">{{ successMessage }}</p>

          <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
            <span v-if="isSubmitting" class="spinner"></span>
            <span>{{ isSubmitting ? t('resetPassword.submitting') : t('resetPassword.submit') }}</span>
          </button>
        </form>
      </div>
    </div>
  </section>
</template>
