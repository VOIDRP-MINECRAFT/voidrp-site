import { apiRequest, buildAuthHeaders } from './apiBase'

const opts = (token, extra = {}) => ({ headers: buildAuthHeaders(token), serverScope: false, ...extra })
const post = (token, path, body) => apiRequest(path, opts(token, { method: 'POST', body: body ? JSON.stringify(body) : undefined }))

export const getMfaStatus = (token) => apiRequest('/auth/mfa', opts(token, { toast: false }))
export const startTotp = (token) => post(token, '/auth/mfa/totp/start')
export const confirmTotp = (token, code) => post(token, '/auth/mfa/totp/confirm', { code })
export const sendTelegramCode = (token) => post(token, '/auth/mfa/telegram/send')
export const confirmTelegram = (token, code) => post(token, '/auth/mfa/telegram/confirm', { code })
export const verifyMfa = (token, code) => post(token, '/auth/mfa/verify', { code })
export const newBackupCodes = (token) => post(token, '/auth/mfa/backup-codes')
export const disableMfa = (token, method) => post(token, '/auth/mfa/disable', { method })
export const reauth = (token, password) => apiRequest('/auth/reauth', opts(token, { method: 'POST', body: JSON.stringify({ password }), toast: false }))
export const listDevices = (token) => apiRequest('/auth/devices', opts(token))
export const endDevice = (token, id) => apiRequest(`/auth/devices/${id}`, opts(token, { method: 'DELETE' }))
export const endOtherDevices = (token) => post(token, '/auth/devices/end-others')

// Staff (admin panel)
export const staffDevices = (token, userId) => apiRequest(`/admin/moderators/${userId}/devices`, opts(token))
export const staffEndSessions = (token, userId) => post(token, `/admin/moderators/${userId}/end-sessions`)
export const staffMfaReset = (token, userId) => post(token, `/admin/moderators/${userId}/mfa-reset`)

// Passkeys (WebAuthn): the browser part is @simplewebauthn/browser.
export const passkeyRegisterOptions = (token) => post(token, '/auth/mfa/passkey/register/options')
export const passkeyRegisterVerify = (token, credential, name = null) => post(token, '/auth/mfa/passkey/register/verify', { credential, name })
export const passkeyAuthOptions = (token) => post(token, '/auth/mfa/passkey/auth/options')
export const passkeyAuthVerify = (token, credential) => post(token, '/auth/mfa/passkey/auth/verify', { credential })
export const deletePasskey = (token, id) => apiRequest(`/auth/mfa/passkeys/${id}`, opts(token, { method: 'DELETE' }))
export const renamePasskey = (token, id, name) => apiRequest(`/auth/mfa/passkeys/${id}`, opts(token, { method: 'PATCH', body: JSON.stringify({ name }) }))
