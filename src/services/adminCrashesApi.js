import { apiRequest, buildAuthHeaders } from './apiBase.js'

function ah(token) { return { headers: buildAuthHeaders(token) } }

export async function adminListCrashes(token, { player = '', version = '', recognized = '', limit = 50, offset = 0 } = {}) {
  const qs = new URLSearchParams()
  if (player) qs.set('player', player)
  if (version) qs.set('version', version)
  // 'yes' | 'no' — whether the launcher recognized the crash with a rule
  if (recognized) qs.set('recognized', recognized)
  qs.set('limit', limit)
  qs.set('offset', offset)
  return apiRequest(`/admin/launcher-crashes?${qs}`, { method: 'GET', ...ah(token) })
}

export async function adminDeleteCrash(token, id) {
  return apiRequest(`/admin/launcher-crashes/${encodeURIComponent(id)}`, { method: 'DELETE', ...ah(token) })
}

export async function adminDeleteCrashes(token, ids) {
  return apiRequest('/admin/launcher-crashes/delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
    ...ah(token),
  })
}
