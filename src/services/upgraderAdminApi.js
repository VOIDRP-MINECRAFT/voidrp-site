import { apiRequest, buildAuthHeaders } from './apiBase.js'

function ah(token) { return { headers: buildAuthHeaders(token) } }

export function adminGetUpgraderConfig(token) {
  return apiRequest('/admin/upgrader/config', { method: 'GET', ...ah(token) })
}
export function adminListUpgraderRewards(token) {
  return apiRequest('/admin/upgrader/rewards', { method: 'GET', ...ah(token) })
}
export function adminCreateUpgraderReward(token, data) {
  return apiRequest('/admin/upgrader/rewards', { method: 'POST', body: JSON.stringify(data), ...ah(token) })
}
export function adminUpdateUpgraderReward(token, id, data) {
  return apiRequest(`/admin/upgrader/rewards/${id}`, { method: 'PATCH', body: JSON.stringify(data), ...ah(token) })
}
export function adminDeleteUpgraderReward(token, id) {
  return apiRequest(`/admin/upgrader/rewards/${id}`, { method: 'DELETE', ...ah(token) })
}
export function adminImportUpgraderMarket(token) {
  return apiRequest('/admin/upgrader/import-market', { method: 'POST', ...ah(token) })
}
