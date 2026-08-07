import { reactive } from 'vue'

const STORAGE_KEY = 'voidrp_cookie_consent_v1'

export const cookieState = reactive({
  // banner visibility — driven by CookieConsent.vue
  visible: false,
})

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function write(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* localStorage unavailable (private mode / blocked) — ignore */
  }
}

// Show the banner on first load only if no choice was stored yet.
export function initCookieConsent() {
  if (!read()) cookieState.visible = true
}

// Re-open the banner so the user can change their choice (footer button).
export function openCookieSettings() {
  cookieState.visible = true
}

export function setCookieChoice(value) {
  write(value)
  cookieState.visible = false
}

export function getCookieChoice() {
  return read()
}
