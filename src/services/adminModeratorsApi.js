import { apiRequest, buildAuthHeaders } from './apiBase'

const opts = (token, extra = {}) => ({
  headers: buildAuthHeaders(token),
  serverScope: false,
  ...extra,
})

export function getPermissionCatalog(token) {
  return apiRequest('/admin/moderators/catalog', opts(token))
}

export function listModerators(token) {
  return apiRequest('/admin/moderators', opts(token))
}

export function assignModerator(token, username, permissions) {
  return apiRequest('/admin/moderators', opts(token, {
    method: 'POST',
    body: JSON.stringify({ username, permissions }),
  }))
}

export function updateModerator(token, userId, permissions) {
  return apiRequest(`/admin/moderators/${userId}`, opts(token, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  }))
}

export function revokeModerator(token, userId) {
  return apiRequest(`/admin/moderators/${userId}`, opts(token, { method: 'DELETE' }))
}
