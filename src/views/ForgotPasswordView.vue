<script setup>
import {reactive, ref, watch} from 'vue'
import { useI18n } from 'vue-i18n'
import { requestPasswordReset } from '../services/authApi'
import { toastError, toastSuccess } from '../services/toast'

const { t } = useI18n()
const form = reactive({ email: '' })
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function submit() {
  errorMessage.value = ''
  successMessage.value = ''
  isSubmitting.value = true

  try {
    await requestPasswordReset(form)
    successMessage.value = t('forgot.success')
  } catch (error) {
    errorMessage.value = error.message || t('forgot.error')
  } finally {
    isSubmitting.value = false
  }
}
watch(errorMessage, (value) => { if (value) toastError(value) })
watch(successMessage, (value) => { if (value) toastSuccess(value, t('forgot.successTitle')) })
</script>

<template>
  <section class="py-12 md:py-20 auth-page">
    <div class="container-shell max-w-4xl">
      <div class="grid gap-6 page-entry lg:grid-cols-[0.9fr_1.1fr]">
        <aside class="gradient-panel p-6 md:p-8">
          <div class="section-kicker section-kicker--light">{{ t('forgot.asideKicker') }}</div>
          <h1 class="text-3xl font-black tracking-tight text-white md:text-4xl">{{ t('forgot.asideTitle') }}</h1>
          <p class="mt-4 text-base leading-8 text-white/78">
            {{ t('forgot.asideDesc') }}
          </p>
        </aside>

        <div class="surface-card p-6 md:p-8 lg:p-10">
          <div class="section-kicker">{{ t('forgot.kicker') }}</div>
          <h2 class="section-title">{{ t('forgot.title') }}</h2>
          <p class="section-subtitle">
            {{ t('forgot.subtitle') }}
          </p>

          <form class="mt-8 grid gap-4" @submit.prevent="submit">
            <label>
              <span class="field-label">{{ t('forgot.emailLabel') }}</span>
              <input v-model="form.email" type="email" class="input" required />
            </label>

            <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
              <span v-if="isSubmitting" class="spinner"></span>
              <span>{{ isSubmitting ? t('forgot.submitting') : t('forgot.submit') }}</span>
            </button>
          </form>

          <div class="alert alert-info mt-6">
            {{ t('forgot.securityNote') }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
