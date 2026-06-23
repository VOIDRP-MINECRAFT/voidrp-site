import { apiRequest, buildAuthHeaders } from './apiBase.js'

function ah(token) { return { headers: buildAuthHeaders(token) } }

export async function adminListCrashes(token, { player = '', limit = 50, offset = 0 } = {}) {
  const qs = new URLSearchParams()
  if (player) qs.set('player', player)
  qs.set('limit', limit)
  qs.set('offset', offset)
  return apiRequest(`/admin/launcher-crashes?${qs}`, { method: 'GET', ...ah(token) })
}

export async function adminDeleteCrash(token, id) {
  return apiRequest(`/admin/launcher-crashes/${encodeURIComponent(id)}`, { method: 'DELETE', ...ah(token) })
}
