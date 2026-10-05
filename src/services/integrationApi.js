import { apiRequest, buildAuthHeaders, API_BASE_URL } from './apiBase'
import { getActiveServerSlug } from '../stores/serverStore'
import { authState } from '../stores/authStore'
import { requestReauth } from '../stores/securityStore'

// «Интеграция» выбранного сервера (X-Server-Slug ставит apiBase).
export const getIntegration = (token) => apiRequest('/admin/integration', { headers: buildAuthHeaders(token) })

function headers() {
  const h = buildAuthHeaders(authState.accessToken)
  const slug = getActiveServerSlug()
  if (slug) h['X-Server-Slug'] = slug
  return h
}

async function save(res, fallbackName) {
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd)
  const name = m ? decodeURIComponent(m[1]) : fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

async function errorOf(res) {
  let detail = null
  try { detail = (await res.json()).detail } catch { /* not json */ }
  return detail
}

/** Скачивает файл с токеном; «нужен пароль» → окно пароля и одна повторная попытка. */
async function download(path, fallbackName) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${API_BASE_URL}${path}`, { headers: headers() })
    if (res.ok) return save(res, fallbackName)
    const detail = await errorOf(res)
    if (res.status === 403 && detail === 'reauth_required' && attempt === 0) {
      if (await requestReauth()) continue
      throw new Error('Скачивание отменено — нужен пароль')
    }
    throw new Error(typeof detail === 'string' ? detail : `Ошибка ${res.status}`)
  }
}

export const downloadRelease = (id, filename) => download(`/admin/integration/releases/${id}/download`, filename)
export const downloadConfig = (key, filename) => download(`/admin/integration/config/${encodeURIComponent(key)}`, filename)

// Мои уведомления в Telegram о серверах, которые я веду.
export const getNotifyPrefs = () => apiRequest('/admin/integration/notify', { headers: headers() })
export const saveNotifyPrefs = (prefs) => apiRequest('/admin/integration/notify', {
  method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(prefs),
})

// Релизы наших плагинов (админы платформы): рекомендовать, отозвать, пометить важным, забрать с GitHub.
export const listReleases = () => apiRequest('/admin/integration/releases', { headers: headers() })
export const patchRelease = (id, patch) => apiRequest(`/admin/integration/releases/${id}`, {
  method: 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
})
export const syncReleases = () => apiRequest('/admin/integration/releases/sync', { method: 'POST', headers: headers() })
