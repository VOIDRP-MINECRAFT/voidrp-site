import { apiRequest, buildAuthHeaders } from './apiBase.js'

function ah(token) { return { headers: buildAuthHeaders(token) } }

export function adminBpListSeasons(token) {
  return apiRequest('/admin/battlepass/rewards/seasons', { method: 'GET', ...ah(token) })
}
export function adminBpListRewards(token, season) {
  return apiRequest(`/admin/battlepass/rewards?season=${encodeURIComponent(season)}`, { method: 'GET', ...ah(token) })
}
export function adminBpUpsertReward(token, data) {
  return apiRequest('/admin/battlepass/rewards', { method: 'PUT', body: JSON.stringify(data), ...ah(token) })
}
export function adminBpDeleteReward(token, id) {
  return apiRequest(`/admin/battlepass/rewards/${id}`, { method: 'DELETE', ...ah(token) })
}
export function adminBpCopySeason(token, data) {
  return apiRequest('/admin/battlepass/rewards/copy', { method: 'POST', body: JSON.stringify(data), ...ah(token) })
}

// ── seasons (dates / level cap / active) ──
export function adminBpListSeasonObjs(token) {
  return apiRequest('/admin/battlepass/seasons', { method: 'GET', ...ah(token) })
}
export function adminBpCreateSeason(token, data) {
  return apiRequest('/admin/battlepass/seasons', { method: 'POST', body: JSON.stringify(data), ...ah(token) })
}
export function adminBpUpdateSeason(token, key, data) {
  return apiRequest(`/admin/battlepass/seasons/${encodeURIComponent(key)}`, { method: 'PATCH', body: JSON.stringify(data), ...ah(token) })
}
export function adminBpDeleteSeason(token, key) {
  return apiRequest(`/admin/battlepass/seasons/${encodeURIComponent(key)}`, { method: 'DELETE', ...ah(token) })
}
