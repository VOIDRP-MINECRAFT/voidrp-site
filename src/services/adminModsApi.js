import { apiRequest, buildAuthHeaders, API_BASE_URL } from './apiBase'
import { getActiveServerSlug } from '../stores/serverStore'

// All endpoints act on the server selected in the admin topbar switcher
// (X-Server-Slug attached automatically by apiBase). Permissions: mods.view to
// read, mods.manage to mutate.

function ah(token, extra = {}) {
  return { headers: buildAuthHeaders(token, extra) }
}

// Full mod list for the active server: presence (client/server), effective
// optional/required flags, sizes, and the resolved dirs.
export function getMods(token) {
  return apiRequest('/admin/mods', ah(token))
}

// Upload a batch of .jar files with real upload progress (XHR — fetch can't
// report upload progress). onProgress(percent, loaded, total). Mirrors what
// apiBase does for a normal request: same base URL, bearer token, and the
// active-server X-Server-Slug header. Returns { token, files:[{filename,size}] }.
export function uploadMods(token, fileList, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    for (const f of fileList) form.append('files', f, f.name)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/admin/mods/upload`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    const slug = getActiveServerSlug()
    if (slug) xhr.setRequestHeader('X-Server-Slug', slug)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) } catch { resolve(null) }
      } else {
        let msg = `Ошибка ${xhr.status}`
        if (xhr.status === 413) msg = 'Файлы слишком большие (лимит сервера). Попробуйте меньшую пачку.'
        else { try { msg = JSON.parse(xhr.responseText).detail || msg } catch { /* keep */ } }
        const err = new Error(msg); err.status = xhr.status; reject(err)
      }
    }
    xhr.onerror = () => reject(new Error('Не удалось связаться с сервером во время загрузки'))
    xhr.onabort = () => reject(new Error('Загрузка отменена'))
    xhr.send(form)
  })
}

// Apply staged uploads with per-file targets/flags.
export function applyMods(token, stagingToken, selections) {
  return apiRequest('/admin/mods/apply', {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'POST',
    body: JSON.stringify({ token: stagingToken, selections }),
  })
}

// Update optional/required/name/description metadata for an existing mod.
export function updateModMeta(token, filename, meta) {
  return apiRequest(`/admin/mods/${encodeURIComponent(filename)}/meta`, {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'PATCH',
    body: JSON.stringify(meta),
  })
}

// Toggle client/server presence for an existing mod (copies from the existing
// copy or moves to trash accordingly).
export function setModTargets(token, filename, onClient, onServer) {
  return apiRequest(`/admin/mods/${encodeURIComponent(filename)}/targets`, {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'PATCH',
    body: JSON.stringify({ on_client: onClient, on_server: onServer }),
  })
}

// Soft-delete a mod (to timestamped trash). target: client | server | both.
export function removeMod(token, filename, target = 'both') {
  const qs = new URLSearchParams({ target })
  return apiRequest(`/admin/mods/${encodeURIComponent(filename)}?${qs.toString()}`, {
    ...ah(token),
    method: 'DELETE',
  })
}

// Rebuild the launcher manifest for the active server (dispatches the correct
// per-server generator; never --all).
export function regenerateManifest(token) {
  return apiRequest('/admin/mods/regenerate', {
    ...ah(token),
    method: 'POST',
  })
}
