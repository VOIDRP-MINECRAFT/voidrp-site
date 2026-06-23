import { apiRequest, buildAuthHeaders } from './apiBase'

export async function getMyReferralDashboard(accessToken) {
  return await apiRequest('/referrals/me', {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function regenerateMyReferralCode(accessToken) {
  return await apiRequest('/referrals/me/regenerate-code', {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function previewReferralCode(code) {
  return await apiRequest(`/referrals/${encodeURIComponent(code)}/preview`, {
    method: 'GET',
  })
}
