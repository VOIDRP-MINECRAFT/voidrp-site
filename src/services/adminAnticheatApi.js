import { apiRequest, buildAuthHeaders } from './apiBase.js'

function ah(token) { return { headers: buildAuthHeaders(token) } }

export async function anticheatListPlayers(token, params = {}) {
  const q = new URLSearchParams()
  if (params.skip !== undefined) q.set('skip', params.skip)
  if (params.limit !== undefined) q.set('limit', params.limit)
  if (params.only_suspicious) q.set('only_suspicious', 'true')
  const qs = q.toString()
  return apiRequest(`/admin/anticheat/players${qs ? '?' + qs : ''}`, { method: 'GET', ...ah(token) })
}

export async function anticheatGetPlayer(token, playerUuid) {
  return apiRequest(`/admin/anticheat/player/${encodeURIComponent(playerUuid)}`, { method: 'GET', ...ah(token) })
}

export async function anticheatPlayerAction(token, playerUuid, action, reason = '', reviewedBy = 'admin') {
  return apiRequest(`/admin/anticheat/player/${encodeURIComponent(playerUuid)}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, reason, reviewed_by: reviewedBy }),
    ...ah(token),
  })
}

export async function anticheatListModVerdicts(token) {
  return apiRequest('/admin/anticheat/mod-verdicts', { method: 'GET', ...ah(token) })
}

export async function anticheatSetModVerdict(token, modId, verdict, reviewedBy = 'admin', notes = '') {
  return apiRequest('/admin/anticheat/mod-verdicts', {
    method: 'POST',
    body: JSON.stringify({ mod_id: modId, verdict, reviewed_by: reviewedBy, notes }),
    ...ah(token),
  })
}

export async function anticheatDeleteModVerdict(token, modId) {
  return apiRequest(`/admin/anticheat/mod-verdicts/${encodeURIComponent(modId)}`, {
    method: 'DELETE',
    ...ah(token),
  })
}

export async function anticheatGetConfig(token) {
  return apiRequest('/admin/anticheat/config', { method: 'GET', ...ah(token) })
}

export async function anticheatUpdateConfig(token, updates, updatedBy = 'admin') {
  return apiRequest('/admin/anticheat/config', {
    method: 'PUT',
    body: JSON.stringify({ updates, updated_by: updatedBy }),
    ...ah(token),
  })
}

export async function anticheatGetStats(token) {
  return apiRequest('/admin/anticheat/stats', { method: 'GET', ...ah(token) })
}
