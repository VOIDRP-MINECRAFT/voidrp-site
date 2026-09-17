<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getMyConsents, updateMyConsents } from '../services/consentApi'
import { toastError } from '../services/toast'
import { logoutCurrentSession, useAuthStore } from '../stores/authStore'

// Accounts created before the separate consents existed (or after a new edition of the documents)
// are asked on whatever page they open first. Reading the documents stays possible: they open in
// a new tab, and the legal pages themselves are not covered by the window.
const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()

const LEGAL_ROUTES = ['/offer', '/privacy', '/consent', '/distribution', '/paid-terms']
const CHANGES = [0, 1, 2, 3, 4, 5]
const CATEGORIES = ['profile', 'map', 'purchases']
const DOCS = [
  { to: '/offer', key: 'footer.offer' },
  { to: '/paid-terms', key: 'footer.paidTerms' },
  { to: '/privacy', key: 'footer.privacy' },
  { to: '/consent', key: 'consentGate.docConsent' },
  { to: '/distribution', key: 'consentGate.docDistribution' },
]

const status = ref(null)
const offer = ref(false)
const personal = ref(false)
const distribution = reactive({ profile: false, map: false, purchases: false })
const saving = ref(false)
const triedSubmit = ref(false)

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
  triedSubmit.value = true
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
    <div v-if="open" class="cg" role="dialog" aria-modal="true" aria-labelledby="cg-title">
      <div class="cg__panel">
        <template v-if="needsRequired">
          <p class="cg__kicker">{{ t('consentGate.kicker') }}</p>
          <h2 id="cg-title" class="cg__title">{{ t('consentGate.title') }}</h2>
          <p class="cg__text">{{ t('consentGate.text') }}</p>

          <div class="cg__changes">
            <h3 class="cg__h">{{ t('consentGate.changesTitle') }}</h3>
            <ul>
              <li v-for="i in CHANGES" :key="i">{{ t(`consentGate.changes.${i}`) }}</li>
            </ul>
            <p class="cg__docs">
              <span class="cg__docs-label">{{ t('consentGate.docsTitle') }}:</span>
              <RouterLink v-for="doc in DOCS" :key="doc.to" :to="doc.to" target="_blank">{{ t(doc.key) }}</RouterLink>
            </p>
          </div>

          <fieldset class="cg__group" :class="{ 'cg__group--error': triedSubmit && !canSubmit }">
            <legend>{{ t('consentGate.requiredTitle') }}</legend>
            <label class="cg__check">
              <input v-model="offer" type="checkbox" />
              <span>{{ t('register.agreeOfferPre') }} <RouterLink to="/offer" target="_blank">{{ t('register.offerGen') }}</RouterLink></span>
            </label>
            <label class="cg__check">
              <input v-model="personal" type="checkbox" />
              <span>{{ t('register.agreeConsentPre') }} <RouterLink to="/consent" target="_blank">{{ t('register.consentDoc') }}</RouterLink> {{ t('register.agreeConsentMid') }} <RouterLink to="/privacy" target="_blank">{{ t('register.privacy') }}</RouterLink></span>
            </label>
            <p v-if="triedSubmit && !canSubmit" class="cg__error" role="alert">{{ t('consentGate.needBoth') }}</p>
          </fieldset>
        </template>

        <template v-else>
          <h2 id="cg-title" class="cg__title">{{ t('consentGate.titleDistribution') }}</h2>
          <p class="cg__text">{{ t('consentGate.textDistribution') }}</p>
        </template>

        <fieldset class="cg__group">
          <legend>{{ needsRequired ? t('consentGate.distributionTitle') : t('register.distributionDoc') }}</legend>
          <label v-for="key in CATEGORIES" :key="key" class="cg__opt">
            <input v-model="distribution[key]" type="checkbox" />
            <span class="cg__opt-body">
              <b>{{ t(`editProfile.distribution.${key}.title`) }}</b>
              <span>{{ t(`editProfile.distribution.${key}.desc`) }}</span>
            </span>
          </label>
          <p class="cg__hint"><template v-if="needsRequired">{{ t('register.distributionHint') }} </template><RouterLink to="/distribution" target="_blank">{{ t('register.distributionDoc') }}</RouterLink></p>
        </fieldset>

        <div class="cg__actions">
          <button type="button" class="cg__btn cg__btn--primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="spinner"></span>{{ needsRequired ? t('consentGate.confirm') : t('consentGate.confirmDistribution') }}
          </button>
          <button v-if="needsRequired" type="button" class="cg__btn" @click="logoutCurrentSession()">{{ t('consentGate.logout') }}</button>
        </div>
        <p v-if="needsRequired" class="cg__fine">{{ t('consentGate.fine') }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cg { position: fixed; inset: 0; z-index: 250; display: grid; place-items: center; padding: 16px; background: rgba(4, 3, 10, 0.8); backdrop-filter: blur(4px); color: #eeecf7; }
.cg__panel { width: min(600px, 100%); max-height: 92dvh; overflow-y: auto; padding: 24px; border-radius: 20px; background: #15122a; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6); }
.cg__kicker { margin: 0 0 4px; font-size: 0.85rem; font-weight: 700; color: #c4b5fd; }
.cg__title { margin: 0; font-size: 1.4rem; font-weight: 900; line-height: 1.2; letter-spacing: -0.01em; }
.cg__text { margin: 8px 0 0; font-size: 0.95rem; line-height: 1.55; color: #cfcbe3; }

.cg__changes { margin-top: 16px; padding: 14px 16px; border-radius: 14px; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(167, 139, 250, 0.25); }
.cg__h { margin: 0 0 6px; font-size: 0.92rem; font-weight: 800; color: #f6f4fc; }
.cg__changes ul { margin: 0; padding-left: 1.1rem; list-style: disc; }
.cg__changes li { margin: 4px 0; font-size: 0.88rem; line-height: 1.5; color: #d6d2ea; }
.cg__changes li::marker { color: #a78bfa; }
.cg__docs { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 10px 0 0; font-size: 0.84rem; line-height: 1.5; }
.cg__docs-label { color: #9d99b6; }

.cg__group { margin: 14px 0 0; padding: 10px 14px 14px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.1); }
.cg__group--error { border-color: rgba(248, 113, 113, 0.6); }
.cg__group legend { padding: 0 6px; font-size: 0.86rem; font-weight: 800; }
.cg__check { display: flex; gap: 10px; align-items: flex-start; margin-top: 8px; font-size: 0.9rem; line-height: 1.5; color: #d6d2ea; cursor: pointer; }
.cg__opt { display: flex; gap: 10px; align-items: flex-start; margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); cursor: pointer; }
.cg__opt:has(input:checked) { background: rgba(139, 92, 246, 0.1); border-color: rgba(167, 139, 250, 0.35); }
.cg__opt-body { display: flex; flex-direction: column; gap: 2px; }
.cg__opt-body b { font-size: 0.92rem; color: #f6f4fc; }
.cg__opt-body span { font-size: 0.84rem; line-height: 1.45; color: #aeaac4; }
.cg__check input, .cg__opt input { width: 18px; height: 18px; margin-top: 2px; flex: none; accent-color: #8b5cf6; cursor: pointer; }
.cg a { color: #c4b5fd; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.cg__hint { margin: 10px 0 0; font-size: 0.82rem; line-height: 1.5; color: #9d99b6; }
.cg__error { margin: 8px 0 0; font-size: 0.85rem; color: #fca5a5; }

.cg__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.cg__btn { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 12px; font: inherit; font-size: 0.95rem; font-weight: 700; color: #eeecf7; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); cursor: pointer; }
.cg__btn:disabled { opacity: 0.6; cursor: default; }
.cg__btn--primary { color: #fff; background: #8b5cf6; border-color: transparent; }
.cg__btn--primary:hover:not(:disabled) { background: #7c4ff0; }
.cg__btn:focus-visible, .cg input:focus-visible, .cg a:focus-visible { outline: 2px solid #c4b5fd; outline-offset: 2px; }
.cg__fine { margin: 12px 0 0; font-size: 0.8rem; line-height: 1.5; color: #9d99b6; }
@media (max-width: 480px) {
  .cg { padding: 8px; }
  .cg__panel { padding: 18px 16px; }
  .cg__btn { flex: 1 1 100%; justify-content: center; }
}
</style>
