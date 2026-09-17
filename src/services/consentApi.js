import { apiRequest, buildAuthHeaders } from './apiBase'

// Consents the account has given: offer, personal data, and what may be shown publicly.
export async function getMyConsents(token) {
  return await apiRequest('/me/consents', { method: 'GET', headers: buildAuthHeaders(token), serverScope: false })
}

export async function updateMyConsents(token, payload) {
  return await apiRequest('/me/consents', {
    method: 'POST',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    serverScope: false,
  })
}
