import { apiRequest, buildAuthHeaders } from './apiBase'

const ADMIN_API_BASE = '/internal-admin-api'

async function adminRequest(path, options = {}) {
  const response = await fetch(`${ADMIN_API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    cache: 'no-store',
    credentials: 'same-origin',
    ...options,
  })

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const detail =
      typeof body === 'object' && body?.detail
        ? body.detail
        : typeof body === 'string' && body.trim().length > 0
          ? body
          : 'Admin request failed'

    throw new Error(detail)
  }

  return body
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') {
      continue
    }

    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function getAdminSummary() {
  return adminRequest('/players/summary')
}

export function listAdminPlayers(params = {}) {
  return adminRequest(`/players${buildQuery(params)}`)
}

export function getAdminPlayer(playerAccountId) {
  return adminRequest(`/players/${playerAccountId}`)
}

export function updateAdminLegacy(playerAccountId, payload) {
  return adminRequest(`/players/${playerAccountId}/legacy`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getAdminMarketSummary() {
  return adminRequest('/market/summary')
}

export function listAdminMarketItems(params = {}) {
  return adminRequest(`/market/items${buildQuery(params)}`)
}

export function patchAdminMarketItem(material, payload) {
  return adminRequest(`/market/items/${encodeURIComponent(material)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function enableAdminMarketItem(material) {
  return adminRequest(`/market/items/${encodeURIComponent(material)}/enable`, {
    method: 'POST',
  })
}

export function disableAdminMarketItem(material) {
  return adminRequest(`/market/items/${encodeURIComponent(material)}/disable`, {
    method: 'POST',
  })
}

export function resetAdminMarketItem(material) {
  return adminRequest(`/market/items/${encodeURIComponent(material)}/reset`, {
    method: 'POST',
  })
}

export function recalculateAdminMarket(decayScores = true) {
  return adminRequest(`/market/recalculate${buildQuery({ decay_scores: decayScores })}`, {
    method: 'POST',
  })
}

// ── New JWT-based admin dashboard API ─────────────────────────────────────

function ah(token) {
  return { headers: buildAuthHeaders(token) }
}

export function getDashboardStats(token) {
  return apiRequest('/admin/dashboard/stats', ah(token))
}

export function getServerStatus(token) {
  return apiRequest('/admin/dashboard/server-status', ah(token))
}

export function getRecentUsers(token) {
  return apiRequest('/admin/dashboard/recent-users', ah(token))
}

export function getMetrikaStats(token) {
  return apiRequest('/admin/dashboard/metrika', ah(token))
}

export function getMetrikaFull(token, days = 30) {
  return apiRequest(`/admin/metrika/full?days=${days}`, ah(token))
}

export function adminListPlayers(token, params = {}) {
  return apiRequest(`/admin/players${buildQuery(params)}`, ah(token))
}

export function adminGetPlayer(token, playerAccountId) {
  return apiRequest(`/admin/players/${playerAccountId}`, ah(token))
}

export function adminPatchLegacy(token, playerAccountId, payload) {
  return apiRequest(`/admin/players/${playerAccountId}/legacy`, {
    ...ah(token),
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function adminGetMarketSummary(token) {
  return apiRequest('/admin/market/summary', ah(token))
}

export function adminListMarketItems(token, params = {}) {
  return apiRequest(`/admin/market/items${buildQuery(params)}`, ah(token))
}

export function adminPatchMarketItem(token, material, payload) {
  return apiRequest(`/admin/market/items/${encodeURIComponent(material)}`, {
    ...ah(token),
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function adminEnableMarketItem(token, material) {
  return apiRequest(`/admin/market/items/${encodeURIComponent(material)}/enable`, {
    ...ah(token),
    method: 'POST',
  })
}

export function adminDisableMarketItem(token, material) {
  return apiRequest(`/admin/market/items/${encodeURIComponent(material)}/disable`, {
    ...ah(token),
    method: 'POST',
  })
}

export function adminResetMarketItem(token, material) {
  return apiRequest(`/admin/market/items/${encodeURIComponent(material)}/reset`, {
    ...ah(token),
    method: 'POST',
  })
}

export function adminRecalculateMarket(token, decayScores = true) {
  return apiRequest(`/admin/market/recalculate${buildQuery({ decay_scores: decayScores })}`, {
    ...ah(token),
    method: 'POST',
  })
}

export function adminListModSuggestions(token) {
  return apiRequest('/admin/mod-suggestions/', ah(token))
}

export function adminDeleteModSuggestion(token, id) {
  return apiRequest(`/admin/mod-suggestions/${id}`, {
    ...ah(token),
    method: 'DELETE',
  })
}

export function adminListFeedback(token) {
  return apiRequest('/admin/player-feedback/', ah(token))
}

export function adminDeleteFeedback(token, id) {
  return apiRequest(`/admin/player-feedback/${id}`, {
    ...ah(token),
    method: 'DELETE',
  })
}

// ── Figura cosmetics (site admin: catalogue management) ──────────────────────
export function adminListCosmetics(token) {
  return apiRequest('/admin/cosmetics', { method: 'GET', headers: buildAuthHeaders(token) })
}
export function adminUploadCosmetic(token, file, name, slot, price) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('name', name)
  fd.append('slot', slot)
  fd.append('price', String(price))
  return apiRequest('/admin/cosmetics/upload', { method: 'POST', body: fd, headers: buildAuthHeaders(token) })
}
export function adminPatchCosmetic(token, slug, payload) {
  return apiRequest(`/admin/cosmetics/${encodeURIComponent(slug)}`, { method: 'PATCH', body: JSON.stringify(payload), headers: buildAuthHeaders(token) })
}
export function adminDeleteCosmetic(token, slug) {
  return apiRequest(`/admin/cosmetics/${encodeURIComponent(slug)}`, { method: 'DELETE', headers: buildAuthHeaders(token) })
}
export function adminGrantCosmetic(token, nickname, slug) {
  return apiRequest('/admin/cosmetics/grant', { method: 'POST', body: JSON.stringify({ nickname, slug }), headers: buildAuthHeaders(token) })
}
export function adminListCosmeticUploads(token, nickname) {
  return apiRequest(`/admin/cosmetics/uploads?nickname=${encodeURIComponent(nickname)}`, { method: 'GET', headers: buildAuthHeaders(token) })
}
export function adminPromoteCosmetic(token, payload) {
  return apiRequest('/admin/cosmetics/promote', { method: 'POST', body: JSON.stringify(payload), headers: buildAuthHeaders(token) })
}
export function adminUploadCosmeticPreview(token, slug, file) {
  const fd = new FormData()
  fd.append('file', file)
  return apiRequest(`/admin/cosmetics/${encodeURIComponent(slug)}/preview`, { method: 'POST', body: fd, headers: buildAuthHeaders(token) })
}
export function adminListPlayerCosmetics(token, nickname) {
  return apiRequest(`/admin/cosmetics/player?nickname=${encodeURIComponent(nickname)}`, { method: 'GET', headers: buildAuthHeaders(token) })
}
export function adminRevokeCosmetic(token, nickname, slug) {
  return apiRequest('/admin/cosmetics/revoke', { method: 'POST', body: JSON.stringify({ nickname, slug }), headers: buildAuthHeaders(token) })
}
export function adminListCosmeticOwners(token, slug) {
  return apiRequest(`/admin/cosmetics/${encodeURIComponent(slug)}/owners`, { method: 'GET', headers: buildAuthHeaders(token) })
}
