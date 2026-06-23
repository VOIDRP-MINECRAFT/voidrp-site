import { apiRequest, buildAuthHeaders } from './apiBase'

export async function getNationActivity(slug, accessToken = null) {
  return await apiRequest(`/nations/${encodeURIComponent(slug)}/activity`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function getMyNationActivity(accessToken) {
  return await apiRequest('/nations/me/activity', {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}
