// 2FA screen in the admin panel and the password dialog before dangerous actions.
import { reactive } from 'vue'

export const securityState = reactive({
  // null | 'setup' (2FA not set up) | 'verify' (enter a code on this device)
  gate: null,
  // pending password dialog: { resolve } — resolved true when the password was accepted
  reauth: null,
})

export function requestReauth() {
  if (securityState.reauth) securityState.reauth.resolve(false)
  return new Promise((resolve) => {
    securityState.reauth = { resolve }
  })
}

export function finishReauth(ok) {
  const pending = securityState.reauth
  securityState.reauth = null
  pending?.resolve(!!ok)
}

export function showMfaGate(code) {
  securityState.gate = code === 'mfa_setup_required' ? 'setup' : 'verify'
}

export function clearMfaGate() {
  securityState.gate = null
}
