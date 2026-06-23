import { apiRequest } from './api'

export function registerAccount(payload, requestOptions = {}) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...requestOptions,
  })
}

export function loginAccount(payload, requestOptions = {}) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...requestOptions,
  })
}

export function refreshSession(payload, requestOptions = {}) {
  return apiRequest('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...requestOptions,
  })
}

export function logoutSession(payload, requestOptions = {}) {
  return apiRequest('/auth/logout', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...requestOptions,
  })
}

export function getMe(accessToken, requestOptions = {}) {
  return apiRequest('/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    ...requestOptions,
  })
}

export function revokeOtherSessions(accessToken, payload, requestOptions = {}) {
  return apiRequest('/account/revoke-other-sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
    ...requestOptions,
  })
}

export function verifyEmail(payload, requestOptions = {}) {
  return apiRequest('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...requestOptions,
  })
}

export function resendVerification(payload, requestOptions = {}) {
  return apiRequest('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...requestOptions,
  })
}

export function requestPasswordReset(payload, requestOptions = {}) {
  return apiRequest('/auth/request-password-reset', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...requestOptions,
  })
}

export function resetPassword(payload, requestOptions = {}) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...requestOptions,
  })
}
