<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { cookieState, initCookieConsent, setCookieChoice } from '../services/cookieConsent'

const { t } = useI18n()

onMounted(initCookieConsent)

const accept = () => setCookieChoice('accepted')
const decline = () => setCookieChoice('declined')
</script>

<template>
  <Teleport to="body">
    <Transition name="cookie-pop">
      <aside
        v-if="cookieState.visible"
        class="cookie-banner"
        role="dialog"
        aria-live="polite"
        :aria-label="t('cookie.title')"
      >
        <div class="cookie-banner__head">
          <span class="cookie-banner__icon" aria-hidden="true">🍪</span>
          <p class="cookie-banner__title">{{ t('cookie.title') }}</p>
        </div>

        <p class="cookie-banner__text">
          {{ t('cookie.text') }}
          <RouterLink to="/privacy" class="cookie-banner__link">{{ t('cookie.more') }}</RouterLink>
        </p>

        <div class="cookie-banner__actions">
          <button type="button" class="cookie-banner__btn cookie-banner__btn--primary" @click="accept">
            {{ t('cookie.accept') }}
          </button>
          <button type="button" class="cookie-banner__btn cookie-banner__btn--ghost" @click="decline">
            {{ t('cookie.decline') }}
          </button>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cookie-banner {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 190; /* below lightbox (200), above page content */
  width: min(340px, calc(100vw - 2rem));
  padding: 1.1rem 1.15rem 1.15rem;
  border-radius: 18px;
  background: rgba(20, 14, 34, 0.92);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(167, 139, 250, 0.22);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  color: #e9e6f5;
}

.cookie-banner__head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.5rem;
}
.cookie-banner__icon { font-size: 1.15rem; line-height: 1; }
.cookie-banner__title {
  font-weight: 700;
  font-size: 0.98rem;
  color: #fff;
}

.cookie-banner__text {
  font-size: 0.83rem;
  line-height: 1.55;
  color: #c4bfd8;
  margin-bottom: 0.9rem;
}
.cookie-banner__link {
  color: #a78bfa;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.cookie-banner__link:hover { color: #c4b5fd; }

.cookie-banner__actions {
  display: flex;
  gap: 0.5rem;
}
.cookie-banner__btn {
  flex: 1;
  min-height: 2.3rem;
  border-radius: 11px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
}
.cookie-banner__btn:active { transform: translateY(1px); }
.cookie-banner__btn--primary {
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  color: #fff;
  border: 1px solid transparent;
}
.cookie-banner__btn--primary:hover { background: linear-gradient(135deg, #8b4ff0, #7c3aed); }
.cookie-banner__btn--ghost {
  background: rgba(255, 255, 255, 0.06);
  color: #d6d2e6;
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.cookie-banner__btn--ghost:hover { background: rgba(255, 255, 255, 0.12); }

/* enter/leave animation: slide up + fade from bottom-right */
.cookie-pop-enter-active { transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
.cookie-pop-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.cookie-pop-enter-from,
.cookie-pop-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}

@media (max-width: 480px) {
  .cookie-banner { right: 0.75rem; left: 0.75rem; bottom: 0.75rem; width: auto; }
}
</style>
