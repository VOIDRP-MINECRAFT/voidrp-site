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

// permissions: on every server (and the platform-wide ones); serverPermissions:
// { slug: [keys] } for keys given on some servers only.
export function assignModerator(token, username, permissions, serverPermissions = {}) {
  return apiRequest('/admin/moderators', opts(token, {
    method: 'POST',
    body: JSON.stringify({ username, permissions, server_permissions: serverPermissions }),
  }))
}

export function updateModerator(token, userId, permissions, serverPermissions = {}) {
  return apiRequest(`/admin/moderators/${userId}`, opts(token, {
    method: 'PATCH',
    body: JSON.stringify({ permissions, server_permissions: serverPermissions }),
  }))
}

export function revokeModerator(token, userId) {
  return apiRequest(`/admin/moderators/${userId}`, opts(token, { method: 'DELETE' }))
}

// Full admins — only the owner may appoint or remove them (the backend enforces it).
export function appointAdmin(token, username) {
  return apiRequest('/admin/moderators/admins', opts(token, {
    method: 'POST',
    body: JSON.stringify({ username }),
  }))
}

export function removeAdmin(token, userId) {
  return apiRequest(`/admin/moderators/admins/${userId}`, opts(token, { method: 'DELETE' }))
}
