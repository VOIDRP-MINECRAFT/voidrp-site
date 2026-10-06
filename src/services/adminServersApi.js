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

// Derived modpack + monitoring defaults for a new server (slug + core version).
// Used by the create form to prefill blank path/monitoring fields.
export function suggestServerPaths(token, { slug, neoforge_version, mc_version }) {
  const qs = new URLSearchParams({ slug })
  if (neoforge_version) qs.set('neoforge_version', neoforge_version)
  if (mc_version) qs.set('mc_version', mc_version)
  return apiRequest(`/admin/servers/suggest-paths?${qs.toString()}`, ah(token))
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

// mode: 'smooth' — старый секрет действует ещё сутки (VoidRpPerms 0.6.2+ перепишет конфиги сам),
// 'now' — старый перестаёт работать сразу (секрет утёк).
export function regenerateSecret(token, serverId, mode = 'now') {
  return apiRequest(`/admin/servers/${serverId}/regenerate-secret?mode=${mode}`, {
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

// ── Login timeouts ─────────────────────────────────────────────────────────
// Returns { settings, defaults, bounds } — bounds/defaults come from the backend
// so the form never hardcodes limits that could drift from the model.

export function getAuthSettings(token, serverId) {
  return apiRequest(`/admin/servers/${serverId}/auth-settings`, ah(token))
}

export function updateAuthSettings(token, serverId, payload) {
  return apiRequest(`/admin/servers/${serverId}/auth-settings`, {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// Live ping of every server the admin manages (hidden ones too), keyed by server id.
export function getServersStatus(token) {
  return apiRequest('/admin/servers/status', ah(token))
}

// «Проверить пинг» in the editor: a host/port typed in, not saved yet.
export function pingAddress(token, host, port) {
  return apiRequest('/admin/servers/ping', {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'POST',
    body: JSON.stringify({ host, port }),
    toast: false,
  })
}
