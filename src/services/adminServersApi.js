import { apiRequest, buildAuthHeaders } from './apiBase'

function ah(token, extra = {}) {
  return { headers: buildAuthHeaders(token, extra) }
}

export function listServers(token) {
  return apiRequest('/admin/servers', ah(token))
}

export function getServer(token, serverId) {
  return apiRequest(`/admin/servers/${serverId}`, ah(token))
}

export function createServer(token, payload) {
  return apiRequest('/admin/servers', {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateServer(token, serverId, payload) {
  return apiRequest(`/admin/servers/${serverId}`, {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteServer(token, serverId) {
  return apiRequest(`/admin/servers/${serverId}`, {
    ...ah(token),
    method: 'DELETE',
  })
}

export function regenerateSecret(token, serverId) {
  return apiRequest(`/admin/servers/${serverId}/regenerate-secret`, {
    ...ah(token),
    method: 'POST',
  })
}

export function uploadServerImage(token, serverId, kind, file) {
  const formData = new FormData()
  formData.append('file', file)
  return apiRequest(`/admin/servers/${serverId}/image?kind=${encodeURIComponent(kind)}`, {
    ...ah(token),
    method: 'POST',
    body: formData,
  })
}
