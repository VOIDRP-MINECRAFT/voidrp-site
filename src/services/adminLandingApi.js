import { apiRequest, buildAuthHeaders } from './apiBase.js'

function ah(token) { return { headers: buildAuthHeaders(token) } }

export async function landingListScreenshots(token) {
  return apiRequest('/admin/landing/screenshots', { method: 'GET', ...ah(token) })
}

export async function landingUploadScreenshot(token, file) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest('/admin/landing/screenshots', {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: form,
  })
}

export async function landingDeleteScreenshot(token, id) {
  return apiRequest(`/admin/landing/screenshots/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    ...ah(token),
  })
}
