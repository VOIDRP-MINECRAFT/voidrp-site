<script setup>
import {computed, reactive, ref, watch} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { loginWithPassword } from '../stores/authStore'
import { toastError, toastSuccess } from '../services/toast'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()

const form = reactive({
  login: '',
  password: '',
  device_name: 'VoidRP Site',
})

const isSubmitting = ref(false)
const errorMessage = ref('')
const showPassword = ref(false)

const redirectTarget = computed(() =>
  typeof route.query.redirect === 'string' && route.query.redirect.length > 0
    ? route.query.redirect
    : '/profile',
)

async function submit() {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await loginWithPassword(form)
    toastSuccess('Вход выполнен. Аккаунт готов к игре.', 'С возвращением')
    await router.push(redirectTarget.value)
  } catch (error) {
    errorMessage.value = error?.message || 'Не удалось войти в аккаунт.'
  } finally {
    isSubmitting.value = false
  }
}
watch(errorMessage, (value) => { if (value) toastError(value) })
</script>

<template>
  <section class="py-10 md:py-16 auth-page">
    <div class="container-shell max-w-6xl">
      <div class="grid gap-6 page-entry lg:grid-cols-[0.92fr_1.08fr]">
        <aside class="gradient-panel order-last p-6 md:p-8 lg:order-first">
          <div class="section-kicker section-kicker--light">{{ t('login.kicker') }}</div>
          <h1 class="text-3xl font-black tracking-tight text-white md:text-5xl">
            {{ t('login.headline') }}
          </h1>
          <p class="mt-4 text-base leading-8 text-white/78">
            {{ t('login.subtext') }}
          </p>

          <div class="mt-8 grid gap-3">
            <div class="dark-list-card">
              <p class="text-sm font-black text-white">{{ t('login.tip1title') }}</p>
              <p class="mt-1.5 text-sm leading-6 text-white/74">{{ t('login.tip1desc') }}</p>
            </div>
            <div class="dark-list-card">
              <p class="text-sm font-black text-white">{{ t('login.tip2title') }}</p>
              <p class="mt-1.5 text-sm leading-6 text-white/74">{{ t('login.tip2desc') }}</p>
            </div>
            <div class="dark-list-card">
              <p class="text-sm font-black text-white">{{ t('login.tip3title') }}</p>
              <p class="mt-1.5 text-sm leading-6 text-white/74">{{ t('login.tip3desc') }}</p>
            </div>
          </div>
        </aside>

        <div class="surface-card p-6 md:p-8 lg:p-10">
          <div class="section-kicker">{{ t('login.formKicker') }}</div>
          <h2 class="section-title">{{ t('login.formTitle') }}</h2>
          <p class="section-subtitle">{{ t('login.formSubtitle') }}</p>

          <div v-if="route.query.redirect" class="alert alert-info mt-6">
            {{ t('login.redirectHint') }}
          </div>

          <form class="mt-8 grid gap-4" @submit.prevent="submit">
            <label>
              <span class="field-label">{{ t('login.loginLabel') }}</span>
              <input v-model="form.login" class="input" autocomplete="username" required />
            </label>

            <label>
              <span class="field-label">{{ t('login.passwordLabel') }}</span>
              <div class="relative">
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  class="input"
                  style="padding-right: 2.75rem;"
                  autocomplete="current-password"
                  required
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; padding: 0; color: rgb(100 116 139);"
                  @mouseenter="$event.currentTarget.style.color = 'rgb(203 213 225)'"
                  @mouseleave="$event.currentTarget.style.color = 'rgb(100 116 139)'"
                >
                  <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
              </div>
            </label>

            
            <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
              <span v-if="isSubmitting" class="spinner"></span>
              <span>{{ isSubmitting ? t('login.submitting') : t('login.submit') }}</span>
            </button>
          </form>

          <div class="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <RouterLink to="/forgot-password" class="text-slate-300 transition hover:text-white">
              {{ t('login.forgotPassword') }}
            </RouterLink>
            <RouterLink to="/register" class="text-slate-300 transition hover:text-white">
              {{ t('login.noAccount') }}
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>


