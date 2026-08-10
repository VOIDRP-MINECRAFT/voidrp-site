import { apiRequest, buildAuthHeaders } from './apiBase'

// ── Public ──────────────────────────────────────────────────────────────────
// Server scope is attached automatically (X-Server-Slug from serverStore).
// `serverSlug` overrides it for shared links (?server=slug wins on the backend).

export async function getNews({ limit = 12, offset = 0, serverSlug = null, category = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (serverSlug) params.set('server', serverSlug)
  if (category) params.set('category', category)
  return await apiRequest(`/news?${params.toString()}`, { method: 'GET' })
}

export async function getNewsItem(slug, serverSlug = null) {
  const q = serverSlug ? `?server=${encodeURIComponent(serverSlug)}` : ''
  return await apiRequest(`/news/${encodeURIComponent(slug)}${q}`, { method: 'GET' })
}

// ── Admin (JWT bearer, is_admin) ────────────────────────────────────────────

// Lightweight server list for the news editor dropdown (perm: any news.*.view/manage).
export async function adminListNewsServers(token) {
  return await apiRequest('/admin/news/servers', {
    method: 'GET',
    headers: buildAuthHeaders(token),
    serverScope: false,
  })
}

export async function adminListNews(token, serverId, { limit = 50, offset = 0, category = 'update' } = {}) {
  const params = new URLSearchParams({ server_id: serverId, category, limit: String(limit), offset: String(offset) })
  return await apiRequest(`/admin/news?${params.toString()}`, {
    method: 'GET',
    headers: buildAuthHeaders(token),
    serverScope: false,
  })
}

export async function adminGetNews(token, serverId, postId) {
  return await apiRequest(`/admin/news/${postId}?server_id=${serverId}`, {
    method: 'GET',
    headers: buildAuthHeaders(token),
    serverScope: false,
  })
}

export async function adminCreateNews(token, serverId, payload) {
  return await apiRequest(`/admin/news?server_id=${serverId}`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
    serverScope: false,
  })
}

export async function adminUpdateNews(token, serverId, postId, payload) {
  return await apiRequest(`/admin/news/${postId}?server_id=${serverId}`, {
    method: 'PATCH',
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
    serverScope: false,
  })
}

export async function adminDeleteNews(token, serverId, postId) {
  return await apiRequest(`/admin/news/${postId}?server_id=${serverId}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
    serverScope: false,
  })
}

export async function adminUploadNewsCover(token, file) {
  const formData = new FormData()
  formData.append('file', file)
  return await apiRequest('/admin/news/upload-image', {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: formData,
    serverScope: false,
  })
}

export async function adminBroadcastNews(token, serverId, postId, payload) {
  return await apiRequest(`/admin/news/${postId}/broadcast?server_id=${serverId}`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
    serverScope: false,
  })
}
