import { apiRequest, buildAuthHeaders } from './apiBase.js'

// Anticheat data (players/violations/stats) is per-server. The active server is set
// by the admin layout's top-bar switcher (public serverStore); apiBase attaches it
// centrally as X-Server-Slug, so these calls need no explicit slug — the backend
// scopes by it. Views must re-fetch when the active server changes.
function ah(token) { return { headers: buildAuthHeaders(token) } }

export async function anticheatListPlayers(token, params = {}) {
  const q = new URLSearchParams()
  if (params.skip !== undefined) q.set('skip', params.skip)
  if (params.limit !== undefined) q.set('limit', params.limit)
  if (params.only_suspicious) q.set('only_suspicious', 'true')
  const qs = q.toString()
  return apiRequest(`/admin/anticheat/players${qs ? '?' + qs : ''}`, { method: 'GET', ...ah(token) })
}

// Permanently delete all anticheat records for the given players (current server).
export async function anticheatDeletePlayers(token, playerUuids) {
  return apiRequest('/admin/anticheat/players/delete', {
    method: 'POST',
    body: JSON.stringify({ player_uuids: playerUuids }),
    ...ah(token),
  })
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

// Values are per server: `updates` set the active server's own values, `reset` puts
// keys back to the default every server gets.
export async function anticheatUpdateConfig(token, updates, reset = [], updatedBy = 'admin') {
  return apiRequest('/admin/anticheat/config', {
    method: 'PUT',
    body: JSON.stringify({ updates, reset, updated_by: updatedBy }),
    ...ah(token),
  })
}

// Rollbacks (and their undo) the server's VoidRP Guard plugin carries out through CoreProtect.
export async function anticheatListActions(token, params = {}) {
  const q = new URLSearchParams()
  if (params.player_uuid) q.set('player_uuid', params.player_uuid)
  if (params.player_nick) q.set('player_nick', params.player_nick)
  if (params.limit) q.set('limit', params.limit)
  const qs = q.toString()
  return apiRequest(`/admin/anticheat/actions${qs ? '?' + qs : ''}`, { method: 'GET', ...ah(token) })
}

export async function anticheatCreateAction(token, body) {
  return apiRequest('/admin/anticheat/actions', {
    method: 'POST',
    body: JSON.stringify(body),
    ...ah(token),
  })
}

export async function anticheatGetStats(token) {
  return apiRequest('/admin/anticheat/stats', { method: 'GET', ...ah(token) })
}
