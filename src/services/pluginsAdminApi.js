import { apiRequest, buildAuthHeaders, API_BASE_URL } from './apiBase'
import { getActiveServerSlug } from '../stores/serverStore'

// Plugins of the server chosen in the admin top bar, and the queue of mod/plugin jar
// changes it shares with the mods section (plugins.view / plugins.manage, mods.*).
function ah(token, extra = {}) {
  return { headers: buildAuthHeaders(token), ...extra }
}

export const getPlugins = (token) => apiRequest('/admin/plugins', ah(token))
export const applyPlugins = (token, tokenId, filenames) =>
  apiRequest('/admin/plugins/apply', ah(token, { method: 'POST', body: JSON.stringify({ token: tokenId, filenames }) }))
export const changePlugin = (token, filename, op) =>
  apiRequest(`/admin/plugins/${encodeURIComponent(filename)}/change`, ah(token, { method: 'POST', body: JSON.stringify({ op }) }))

export const getServerChanges = (token) => apiRequest('/admin/server-changes', ah(token))
export const cancelServerChange = (token, id) => apiRequest(`/admin/server-changes/${id}`, ah(token, { method: 'DELETE' }))
export const applyServerChangesNow = (token, warnSeconds = 30) =>
  apiRequest('/admin/server-changes/apply-now', ah(token, { method: 'POST', body: JSON.stringify({ warn_seconds: warnSeconds }) }))

// Upload plugin jars to staging (XHR for progress). Returns { token, files: [...] }.
export function uploadPlugins(token, fileList, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    for (const f of fileList) form.append('files', f, f.name)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/admin/plugins/upload`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    const slug = getActiveServerSlug()
    if (slug) xhr.setRequestHeader('X-Server-Slug', slug)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) } catch { resolve(null) }
      } else {
        let msg = `Ошибка ${xhr.status}`
        try { msg = JSON.parse(xhr.responseText).detail || msg } catch { /* keep */ }
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Не удалось связаться с сервером во время загрузки'))
    xhr.send(form)
  })
}
export const applyPluginsViaPlugman = (token) =>
  apiRequest('/admin/server-changes/apply-plugman', ah(token, { method: 'POST' }))
