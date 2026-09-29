import { apiRequest, buildAuthHeaders } from './apiBase.js'

// Backups are per server: apiBase attaches the admin's active server (X-Server-Slug), so
// every call here is about the server chosen in the admin top bar.
function ah(token) { return { headers: buildAuthHeaders(token) } }

export async function backupsList(token) {
  return apiRequest('/admin/backups', { method: 'GET', ...ah(token) })
}

export async function backupsCreate(token, note = '') {
  return apiRequest('/admin/backups', { method: 'POST', body: JSON.stringify({ note }), ...ah(token) })
}

export async function backupsRestore(token, backupId, warnSeconds = 30) {
  return apiRequest(`/admin/backups/${encodeURIComponent(backupId)}/restore`, {
    method: 'POST',
    body: JSON.stringify({ warn_seconds: warnSeconds }),
    ...ah(token),
  })
}

export async function backupsDelete(token, backupId) {
  return apiRequest(`/admin/backups/${encodeURIComponent(backupId)}`, { method: 'DELETE', ...ah(token) })
}

export async function backupsSaveSettings(token, settings) {
  return apiRequest('/admin/backups/settings', { method: 'PUT', body: JSON.stringify(settings), ...ah(token) })
}
