import { apiRequest, buildAuthHeaders, API_BASE_URL } from './apiBase.js'
import { serverState } from '../stores/serverStore.js'

// Battle royale results of the admin's active server (apiBase sends X-Server-Slug).
function ah(token) { return { headers: buildAuthHeaders(token) } }

export const royaleMatches = (token, includeAborted = true) =>
  apiRequest(`/admin/royale?include_aborted=${includeAborted}`, { method: 'GET', ...ah(token) })

export const royaleMatch = (token, id) => apiRequest(`/admin/royale/${id}`, { method: 'GET', ...ah(token) })

/** Game settings set here (the team size) and what the server runs now; the plugin takes them within ~2 s. */
export const royaleSettings = (token) => apiRequest('/admin/royale/settings', { method: 'GET', ...ah(token) })
export const royaleSaveSettings = (token, body) =>
  apiRequest('/admin/royale/settings', { method: 'PUT', body: JSON.stringify(body), ...ah(token) })

export const royaleDelete = (token, id) => apiRequest(`/admin/royale/${id}`, { method: 'DELETE', ...ah(token) })

/** The day's standings: every finished match of that date (YYYY-MM-DD, Moscow), points added up. */
export const royaleDay = (token, date) =>
  apiRequest(`/admin/royale/standings/day?date=${encodeURIComponent(date)}`, { method: 'GET', ...ah(token) })

/** Downloads a CSV (opens in Excel): one match, or every finished match. */
export const royaleExport = (token, id = null) =>
  download(token, id ? `/admin/royale/${id}/export.csv` : '/admin/royale/export/all.csv')

/** The day's standings as a CSV. */
export const royaleExportDay = (token, date) =>
  download(token, `/admin/royale/standings/day.csv?date=${encodeURIComponent(date)}`)

async function download(token, path) {
  const slug = serverState.activeSlug
  const headers = buildAuthHeaders(token, slug ? { 'X-Server-Slug': slug } : {})
  const res = await fetch(`${API_BASE_URL}${path}`, { headers })
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`
    try { msg = (await res.json()).detail || msg } catch { /* keep */ }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const m = /filename="?([^";]+)"?/i.exec(cd)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = m ? m[1] : 'royale.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
