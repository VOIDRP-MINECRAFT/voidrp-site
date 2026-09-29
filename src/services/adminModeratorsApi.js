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

// Admins: servers = null → of the whole platform (the owner only); [slugs] → of those
// servers (the owner and platform admins). The backend enforces who may do what.
export function appointAdmin(token, username, servers = null) {
  return apiRequest('/admin/moderators/admins', opts(token, {
    method: 'POST',
    body: JSON.stringify({ username, servers }),
  }))
}

export function setAdminServers(token, userId, servers) {
  return apiRequest(`/admin/moderators/admins/${userId}`, opts(token, {
    method: 'PUT',
    body: JSON.stringify({ servers }),
  }))
}

export function removeAdmin(token, userId) {
  return apiRequest(`/admin/moderators/admins/${userId}`, opts(token, { method: 'DELETE' }))
}

// ── Roles ────────────────────────────────────────────────────────────────────
// A role: { name, color, servers: null | [slugs], permissions: [keys] }.

export function listRoles(token) {
  return apiRequest('/admin/roles', opts(token))
}

export function createRole(token, role) {
  return apiRequest('/admin/roles', opts(token, { method: 'POST', body: JSON.stringify(role) }))
}

export function updateRole(token, roleId, role) {
  return apiRequest(`/admin/roles/${roleId}`, opts(token, { method: 'PATCH', body: JSON.stringify(role) }))
}

export function deleteRole(token, roleId) {
  return apiRequest(`/admin/roles/${roleId}`, opts(token, { method: 'DELETE' }))
}

// ids: every role, most senior first.
export function reorderRoles(token, ids) {
  return apiRequest('/admin/roles/order', opts(token, { method: 'PUT', body: JSON.stringify({ ids }) }))
}

export function addRoleMember(token, roleId, username) {
  return apiRequest(`/admin/roles/${roleId}/members`, opts(token, { method: 'POST', body: JSON.stringify({ username }) }))
}

export function removeRoleMember(token, roleId, userId) {
  return apiRequest(`/admin/roles/${roleId}/members/${userId}`, opts(token, { method: 'DELETE' }))
}
