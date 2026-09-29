import { apiRequest, buildAuthHeaders, API_BASE_URL } from './apiBase'
import { getActiveServerSlug } from '../stores/serverStore'

// The file manager of the server chosen in the admin top bar (X-Server-Slug).
// Permissions per server: files.view / edit / upload / delete / secrets.
function ah(token, extra = {}) {
  return { headers: buildAuthHeaders(token), ...extra }
}
const q = (params) => new URLSearchParams(params).toString()

export const listFolder = (token, path = '') => apiRequest(`/admin/files/list?${q({ path })}`, ah(token))
export const readFile = (token, path) => apiRequest(`/admin/files/read?${q({ path })}`, ah(token))
export const writeFile = (token, body) =>
  apiRequest('/admin/files/write', ah(token, { method: 'PUT', body: JSON.stringify(body) }))
export const listRevisions = (token, path) => apiRequest(`/admin/files/revisions?${q({ path })}`, ah(token))
export const getRevision = (token, id) => apiRequest(`/admin/files/revisions/${id}`, ah(token))
export const revertRevision = (token, id) =>
  apiRequest(`/admin/files/revisions/${id}/revert`, ah(token, { method: 'POST' }))
export const makeFolder = (token, path, name) =>
  apiRequest('/admin/files/mkdir', ah(token, { method: 'POST', body: JSON.stringify({ path, name }) }))
export const renameEntry = (token, path, name) =>
  apiRequest('/admin/files/rename', ah(token, { method: 'POST', body: JSON.stringify({ path, name }) }))
export const deleteEntry = (token, path) => apiRequest(`/admin/files?${q({ path })}`, ah(token, { method: 'DELETE' }))

function serverHeaders(token) {
  const h = {}
  if (token) h.Authorization = `Bearer ${token}`
  const slug = getActiveServerSlug()
  if (slug) h['X-Server-Slug'] = slug
  return h
}

// Upload with progress (XHR): files into the folder `path`.
export function uploadFiles(token, path, fileList, { overwrite = false, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('path', path)
    form.append('overwrite', overwrite ? 'true' : 'false')
    for (const f of fileList) form.append('files', f, f.name)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/admin/files/upload`)
    for (const [k, v] of Object.entries(serverHeaders(token))) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) } catch { resolve(null) }
      } else {
        let msg = `Ошибка ${xhr.status}`
        try { msg = JSON.parse(xhr.responseText).detail || msg } catch { /* keep */ }
        const err = new Error(msg); err.status = xhr.status; reject(err)
      }
    }
    xhr.onerror = () => reject(new Error('Не удалось связаться с сервером во время загрузки'))
    xhr.send(form)
  })
}

// Download a file (or a folder as .zip) with the auth header, then save it.
export async function downloadEntry(token, path, fallbackName) {
  const res = await fetch(`${API_BASE_URL}/admin/files/download?${q({ path })}`, { headers: serverHeaders(token) })
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`
    try { msg = (await res.json()).detail || msg } catch { /* keep */ }
    throw new Error(msg)
  }
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
