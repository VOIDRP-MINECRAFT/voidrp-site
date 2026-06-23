import { apiRequest, buildAuthHeaders } from './apiBase'

export async function getServerStats() {
  return apiRequest('/server/stats', { method: 'GET' })
}

export async function getNationRankings(accessToken = null) {
  return await apiRequest('/nation-stats/rankings', {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function getNationStatsBySlug(slug, accessToken = null) {
  return await apiRequest(`/nation-stats/nations/${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function depositNationTreasury(accessToken, slug, payload) {
  return await apiRequest(`/nation-stats/nations/${encodeURIComponent(slug)}/deposit`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function withdrawNationTreasury(accessToken, slug, payload) {
  return await apiRequest(`/nation-stats/nations/${encodeURIComponent(slug)}/withdraw`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function getNationTreasuryTransactions(slug, accessToken = null) {
  return await apiRequest(`/nation-stats/nations/${encodeURIComponent(slug)}/transactions`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function getNationTopDonors(slug, accessToken = null) {
  return await apiRequest(`/nation-stats/nations/${encodeURIComponent(slug)}/donors`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}
