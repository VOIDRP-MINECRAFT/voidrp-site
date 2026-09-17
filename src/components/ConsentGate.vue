<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getMyConsents, updateMyConsents } from '../services/consentApi'
import { toastError } from '../services/toast'
import { logoutCurrentSession, useAuthStore } from '../stores/authStore'

// Accounts created before the separate consents existed (or after a new edition of the documents)
// are asked on the site. Reading the documents themselves stays possible while the window is open.
const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()

const LEGAL_ROUTES = ['/offer', '/privacy', '/consent', '/distribution']

const status = ref(null)
const offer = ref(false)
const personal = ref(false)
const distribution = reactive({ profile: false, map: false, purchases: false })
const saving = ref(false)

const needsRequired = computed(() => Boolean(status.value?.missing?.length))
const needsDistribution = computed(() => Boolean(status.value) && !status.value.distribution_answered)
const open = computed(() => auth.isAuthenticated.value && (needsRequired.value || needsDistribution.value) && !LEGAL_ROUTES.includes(route.path))
const canSubmit = computed(() => !needsRequired.value || (offer.value && personal.value))

async function load() {
  if (!auth.isAuthenticated.value || !auth.accessToken) {
    status.value = null
    return
  }
  try {
    status.value = await getMyConsents(auth.accessToken)
    Object.assign(distribution, status.value.distribution || {})
  } catch {
    status.value = null
  }
}

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  try {
    status.value = await updateMyConsents(auth.accessToken, {
      ...(needsRequired.value ? { accept_offer: true, accept_personal_data: true } : {}),
      distribution: { ...distribution },
    })
  } catch (err) {
    toastError(err.message || t('consentGate.error'))
  } finally {
    saving.value = false
  }
}

watch(() => auth.isAuthenticated.value, load, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cg" role="dialog" aria-modal="true" :aria-label="t('consentGate.title')">
      <div class="cg__panel">
        <h2 class="cg__title">{{ needsRequired ? t('consentGate.title') : t('consentGate.titleDistribution') }}</h2>
        <p class="cg__text">{{ needsRequired ? t('consentGate.text') : t('consentGate.textDistribution') }}</p>

        <template v-if="needsRequired">
          <label class="cg__check">
            <input v-model="offer" type="checkbox" />
            <span>{{ t('register.agreeOfferPre') }} <RouterLink to="/offer" target="_blank">{{ t('register.offerGen') }}</RouterLink></span>
          </label>
          <label class="cg__check">
            <input v-model="personal" type="checkbox" />
            <span>{{ t('register.agreeConsentPre') }} <RouterLink to="/consent" target="_blank">{{ t('register.consentDoc') }}</RouterLink> {{ t('register.agreeConsentMid') }} <RouterLink to="/privacy" target="_blank">{{ t('register.privacy') }}</RouterLink></span>
          </label>
        </template>

        <fieldset class="cg__group">
          <legend>{{ t('register.distributionTitle') }}</legend>
          <p class="cg__hint">{{ t('register.distributionHint') }} <RouterLink to="/distribution" target="_blank">{{ t('register.distributionDoc') }}</RouterLink></p>
          <label v-for="key in ['profile', 'map', 'purchases']" :key="key" class="cg__check">
            <input v-model="distribution[key]" type="checkbox" />
            <span>{{ t(`register.distribution.${key}`) }}</span>
          </label>
        </fieldset>

        <div class="cg__actions">
          <button type="button" class="cg__btn cg__btn--primary" :disabled="!canSubmit || saving" @click="submit">
            <span v-if="saving" class="spinner"></span>{{ t('consentGate.confirm') }}
          </button>
          <button v-if="needsRequired" type="button" class="cg__btn" @click="logoutCurrentSession()">{{ t('consentGate.logout') }}</button>
        </div>
        <p v-if="needsRequired" class="cg__fine">{{ t('consentGate.fine') }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cg { position: fixed; inset: 0; z-index: 250; display: grid; place-items: center; padding: 16px; background: rgba(4, 3, 10, 0.78); backdrop-filter: blur(4px); color: #eeecf7; }
.cg__panel { width: min(560px, 100%); max-height: 92dvh; overflow-y: auto; padding: 24px; border-radius: 20px; background: #15122a; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6); }
.cg__title { margin: 0; font-size: 1.35rem; font-weight: 900; line-height: 1.2; }
.cg__text { margin: 8px 0 16px; font-size: 0.95rem; line-height: 1.55; color: #cfcbe3; }
.cg__check { display: flex; gap: 10px; align-items: flex-start; margin-top: 10px; font-size: 0.9rem; line-height: 1.5; color: #d6d2ea; cursor: pointer; }
.cg__check input { width: 17px; height: 17px; margin-top: 2px; flex: none; accent-color: #8b5cf6; cursor: pointer; }
.cg__check a, .cg__hint a { color: #c4b5fd; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.cg__group { margin: 16px 0 0; padding: 12px 14px 14px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.1); }
.cg__group legend { padding: 0 6px; font-size: 0.86rem; font-weight: 800; }
.cg__hint { margin: 0; font-size: 0.84rem; line-height: 1.5; color: #9d99b6; }
.cg__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
.cg__btn { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 12px; font: inherit; font-size: 0.95rem; font-weight: 700; color: #eeecf7; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); cursor: pointer; }
.cg__btn:disabled { opacity: 0.5; cursor: default; }
.cg__btn--primary { color: #fff; background: #8b5cf6; border-color: transparent; }
.cg__btn:focus-visible, .cg__check input:focus-visible { outline: 2px solid #c4b5fd; outline-offset: 2px; }
.cg__fine { margin: 12px 0 0; font-size: 0.8rem; line-height: 1.5; color: #9d99b6; }
</style>
