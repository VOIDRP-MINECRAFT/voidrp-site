<script setup>
import {computed, onMounted, reactive, ref, watch} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { previewReferralCode } from '../services/referralApi'
import { registerAndOptionallyStay } from '../stores/authStore'
import { toastError, toastInfo } from '../services/toast'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const form = reactive({
  site_login: '',
  minecraft_nickname: '',
  email: '',
  password: '',
  password_repeat: '',
  referral_code: '',
})

const isSubmitting = ref(false)
const agreedToTerms = ref(false)
const isCheckingReferral = ref(false)
const showPassword = ref(false)
const showPasswordRepeat = ref(false)
const errorMessage = ref('')
const referralMessage = ref('')
const referralError = ref('')
const referralPreview = ref(null)

const referralPreviewLabel = computed(() => {
  const payload = referralPreview.value
  if (!payload) return ''

  return (
    payload.display_name ||
    payload.inviter_display_name ||
    payload.minecraft_nickname ||
    payload.site_login ||
    payload.code ||
    ''
  )
})

async function resolveReferralCode(code) {
  const normalized = (code || '').trim()
  referralPreview.value = null
  referralMessage.value = ''
  referralError.value = ''

  if (!normalized) {
    return
  }

  isCheckingReferral.value = true
  try {
    const payload = await previewReferralCode(normalized)
    referralPreview.value = payload
    referralMessage.value = referralPreviewLabel.value
      ? t('register.referralFound', { name: referralPreviewLabel.value })
      : t('register.referralFoundGeneric')
  } catch (error) {
    referralError.value = error.message || t('register.referralError')
  } finally {
    isCheckingReferral.value = false
  }
}

async function submit() {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await registerAndOptionallyStay({
      site_login: form.site_login,
      minecraft_nickname: form.minecraft_nickname,
      email: form.email,
      password: form.password,
      password_repeat: form.password_repeat,
      referral_code: form.referral_code.trim() || null,
    })

    await router.push({
      path: '/verify-email',
      query: {
        email: form.email,
        sent: '1',
        redirect: typeof route.query.redirect === 'string' ? route.query.redirect : '',
      },
    })
  } catch (error) {
    errorMessage.value = error.message || t('register.createError')
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => form.referral_code,
  () => {
    referralPreview.value = null
    referralMessage.value = ''
    referralError.value = ''
  },
)

onMounted(async () => {
  const refFromQuery =
    typeof route.query.ref === 'string' && route.query.ref.trim().length > 0
      ? route.query.ref.trim()
      : ''

  if (refFromQuery) {
    form.referral_code = refFromQuery
    await resolveReferralCode(refFromQuery)
  }
})
watch(errorMessage, (value) => { if (value) toastError(value) })
watch(referralError, (value) => { if (value) toastError(value, t('register.referralTitle')) })
watch(referralMessage, (value) => { if (value) toastInfo(value, t('register.referralTitle')) })
</script>

<template>
  <section class="py-12 md:py-20 auth-page">
    <div class="container-shell max-w-6xl">
      <div class="grid gap-6 page-entry lg:grid-cols-[1.08fr_0.92fr]">
        <div class="surface-card p-6 md:p-8 lg:p-10">
          <div class="section-kicker">{{ t('register.kicker') }}</div>
          <h1 class="section-title">{{ t('register.title') }}</h1>
          <p class="section-subtitle max-w-3xl">
            {{ t('register.subtitle') }}
          </p>

          <form class="mt-8 grid gap-4 md:grid-cols-2" @submit.prevent="submit">
            <label>
              <span class="field-label">{{ t('register.loginLabel') }}</span>
              <input v-model="form.site_login" class="input" required />
            </label>

            <label>
              <span class="field-label">{{ t('register.nicknameLabel') }}</span>
              <input v-model="form.minecraft_nickname" class="input" required />
            </label>

            <label class="md:col-span-2">
              <span class="field-label">{{ t('register.emailLabel') }}</span>
              <input v-model="form.email" type="email" class="input" required />
            </label>

            <label>
              <span class="field-label">{{ t('register.passwordLabel') }}</span>
              <div class="relative">
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  class="input"
                  style="padding-right: 2.75rem;"
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

            <label>
              <span class="field-label">{{ t('register.passwordRepeatLabel') }}</span>
              <div class="relative">
                <input
                  v-model="form.password_repeat"
                  :type="showPasswordRepeat ? 'text' : 'password'"
                  class="input"
                  style="padding-right: 2.75rem;"
                  required
                />
                <button
                  type="button"
                  @click="showPasswordRepeat = !showPasswordRepeat"
                  style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; padding: 0; color: rgb(100 116 139);"
                  @mouseenter="$event.currentTarget.style.color = 'rgb(203 213 225)'"
                  @mouseleave="$event.currentTarget.style.color = 'rgb(100 116 139)'"
                >
                  <svg v-if="!showPasswordRepeat" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
              </div>
            </label>

            <div class="md:col-span-2 rounded-[1.5rem] border border-white/10 bg-slate-950/65 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div class="flex flex-col gap-3 md:flex-row md:items-end">
                <label class="flex-1">
                  <span class="field-label">{{ t('register.referralLabel') }}</span>
                  <input
                    v-model="form.referral_code"
                    class="input"
                    :placeholder="t('register.referralPlaceholder')"
                  />
                </label>

                <button
                  type="button"
                  class="btn btn-outline md:min-w-[12.5rem]"
                  :disabled="isCheckingReferral || !form.referral_code.trim()"
                  @click="resolveReferralCode(form.referral_code)"
                >
                  <span v-if="isCheckingReferral" class="spinner"></span>
                  <span>{{ isCheckingReferral ? t('register.checkingReferral') : t('register.checkReferral') }}</span>
                </button>
              </div>

              <p class="helper-text mt-3">
                {{ t('register.referralHelper') }}
              </p>
            </div>

            <label class="md:col-span-2 flex cursor-pointer items-start gap-3 rounded-[1.1rem] border border-white/10 bg-slate-950/45 px-4 py-3">
              <input
                v-model="agreedToTerms"
                type="checkbox"
                class="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-violet-500"
              />
              <span class="text-xs leading-5 text-slate-400">
                {{ t('register.agreeText') }}
                <RouterLink
                  to="/privacy"
                  target="_blank"
                  class="font-bold text-violet-300 transition hover:text-violet-200"
                >
                  {{ t('register.privacy') }}
                </RouterLink>
                {{ t('footer.offer') !== t('register.offer') ? '' : '' }}
                <RouterLink
                  to="/offer"
                  target="_blank"
                  class="font-bold text-violet-300 transition hover:text-violet-200"
                >
                  {{ t('register.offer') }}
                </RouterLink>.
              </span>
            </label>

            <div class="md:col-span-2 flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <button type="submit" class="btn btn-primary" :disabled="isSubmitting || !agreedToTerms">
                <span v-if="isSubmitting" class="spinner"></span>
                <span>{{ isSubmitting ? t('register.submitting') : t('register.submit') }}</span>
              </button>
              <RouterLink to="/login" class="text-sm font-semibold text-violet-300 transition hover:text-violet-200">
                {{ t('register.alreadyRegistered') }}
              </RouterLink>
            </div>
          </form>
        </div>

        <aside class="gradient-panel p-6 md:p-8">
          <div class="section-kicker section-kicker--light">{{ t('register.asideKicker') }}</div>
          <h2 class="text-3xl font-black tracking-tight text-white md:text-4xl">{{ t('register.asideTitle') }}</h2>
          <p class="mt-4 text-base leading-8 text-white/78">
            {{ t('register.asideDesc') }}
          </p>

          <div class="mt-8 grid gap-3">
            <div class="dark-list-card">
              <p class="text-sm font-black text-white">{{ t('register.benefit1title') }}</p>
              <p class="mt-1.5 text-sm leading-6 text-white/74">
                {{ t('register.benefit1desc') }}
              </p>
            </div>
            <div class="dark-list-card">
              <p class="text-sm font-black text-white">{{ t('register.benefit2title') }}</p>
              <p class="mt-1.5 text-sm leading-6 text-white/74">
                {{ t('register.benefit2desc') }}
              </p>
            </div>
            <div class="dark-list-card">
              <p class="text-sm font-black text-white">{{ t('register.benefit3title') }}</p>
              <p class="mt-1.5 text-sm leading-6 text-white/74">
                {{ t('register.benefit3desc') }}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </section>
</template>
