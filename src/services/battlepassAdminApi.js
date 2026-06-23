import { apiRequest, buildAuthHeaders } from './apiBase.js'

function ah(token) { return { headers: buildAuthHeaders(token) } }

export async function adminGetBattlePassStats(token) {
  return apiRequest('/admin/battlepass/stats', { method: 'GET', ...ah(token) })
}

export async function adminListBattlePassPremium(token, params = {}) {
  const query = new URLSearchParams()
  if (params.skip !== undefined) query.set('skip', params.skip)
  if (params.limit !== undefined) query.set('limit', params.limit)
  if (params.active_only !== undefined) query.set('active_only', params.active_only)
  const qs = query.toString()
  return apiRequest(`/admin/battlepass/premium${qs ? '?' + qs : ''}`, { method: 'GET', ...ah(token) })
}

export async function adminGrantBattlePassPremium(token, data) {
  return apiRequest('/admin/battlepass/premium/grant', { method: 'POST', body: JSON.stringify(data), ...ah(token) })
}

export async function adminRevokeBattlePassPremium(token, minecraft_uuid) {
  return apiRequest(`/admin/battlepass/premium/${minecraft_uuid}`, { method: 'DELETE', ...ah(token) })
}

export async function adminGetBattlePassPlayerByNick(token, nickname) {
  return apiRequest(`/admin/battlepass/player-by-nick/${encodeURIComponent(nickname)}`, { method: 'GET', ...ah(token) })
}

export async function adminRevokeBattlePassPremiumByNick(token, nickname) {
  return apiRequest(`/admin/battlepass/premium/revoke-by-nick/${encodeURIComponent(nickname)}`, { method: 'POST', ...ah(token) })
}
