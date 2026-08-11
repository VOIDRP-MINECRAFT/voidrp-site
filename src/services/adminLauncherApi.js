import { apiRequest, buildAuthHeaders } from './apiBase.js'

function ah(token) { return { headers: buildAuthHeaders(token) } }

export async function launcherGetStatus(token) {
  return apiRequest('/admin/launcher/status', { method: 'GET', ...ah(token) })
}

export async function launcherGetLog(token) {
  return apiRequest('/admin/launcher/log', { method: 'GET', ...ah(token) })
}

export async function launcherSetVersion(token, { version = null, bump = null } = {}) {
  return apiRequest('/admin/launcher/version', {
    method: 'POST',
    body: JSON.stringify({ version, bump }),
    ...ah(token),
  })
}

export async function launcherDeploy(token) {
  return apiRequest('/admin/launcher/deploy', { method: 'POST', ...ah(token) })
}

export async function launcherCancel(token) {
  return apiRequest('/admin/launcher/cancel', { method: 'POST', ...ah(token) })
}

export async function launcherSetNotes(token, notes) {
  return apiRequest('/admin/launcher/notes', {
    method: 'POST',
    body: JSON.stringify({ notes }),
    ...ah(token),
  })
}

export async function launcherRollback(token) {
  return apiRequest('/admin/launcher/rollback', { method: 'POST', ...ah(token) })
}

export async function launcherGetHistory(token) {
  return apiRequest('/admin/launcher/history', { method: 'GET', ...ah(token) })
}

export async function launcherGetCrashStats(token) {
  return apiRequest('/admin/launcher/crash-stats', { method: 'GET', ...ah(token) })
}
