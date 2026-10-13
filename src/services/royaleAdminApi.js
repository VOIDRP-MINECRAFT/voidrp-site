import { apiRequest, buildAuthHeaders, API_BASE_URL } from './apiBase.js'
import { serverState } from '../stores/serverStore.js'

// Battle royale results of the admin's active server (apiBase sends X-Server-Slug).
function ah(token) { return { headers: buildAuthHeaders(token) } }

export const royaleMatches = (token, includeAborted = true) =>
  apiRequest(`/admin/royale?include_aborted=${includeAborted}`, { method: 'GET', ...ah(token) })

export const royaleMatch = (token, id) => apiRequest(`/admin/royale/${id}`, { method: 'GET', ...ah(token) })

export const royaleDelete = (token, id) => apiRequest(`/admin/royale/${id}`, { method: 'DELETE', ...ah(token) })

/** Downloads a CSV (opens in Excel): one match, or every finished match. */
export async function royaleExport(token, id = null) {
  const path = id ? `/admin/royale/${id}/export.csv` : '/admin/royale/export/all.csv'
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
