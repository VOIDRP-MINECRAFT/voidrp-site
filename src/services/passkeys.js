// Ключи доступа: Windows Hello, Face ID / Touch ID, Android, ключи безопасности,
// менеджеры паролей. Браузерная часть WebAuthn — @simplewebauthn/browser.
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { authState } from '../stores/authStore'
import { passkeyAuthOptions, passkeyAuthVerify, passkeyRegisterOptions, passkeyRegisterVerify } from './securityApi'

export const passkeysSupported = () => browserSupportsWebAuthn()

// Отмена пользователем — не ошибка, а просто «ничего не произошло».
function cancelled(e) {
  return e?.name === 'NotAllowedError' || e?.name === 'AbortError'
}

export async function registerPasskey() {
  const optionsJSON = await passkeyRegisterOptions(authState.accessToken)
  let credential
  try {
    credential = await startRegistration({ optionsJSON })
  } catch (e) {
    if (cancelled(e)) return null
    if (e?.name === 'InvalidStateError') throw new Error('Этот ключ уже добавлен')
    throw e
  }
  return await passkeyRegisterVerify(authState.accessToken, credential)
}

export async function signInWithPasskey() {
  const optionsJSON = await passkeyAuthOptions(authState.accessToken)
  let credential
  try {
    credential = await startAuthentication({ optionsJSON })
  } catch (e) {
    if (cancelled(e)) return null
    throw e
  }
  return await passkeyAuthVerify(authState.accessToken, credential)
}
