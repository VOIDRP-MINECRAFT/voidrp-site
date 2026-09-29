import { apiRequest, buildAuthHeaders } from './apiBase.js'

// Pay for playing, for the admin's active server (apiBase sends X-Server-Slug).
function ah(token) { return { headers: buildAuthHeaders(token) } }

export async function salaryOverview(token) {
  return apiRequest('/admin/salary', { method: 'GET', ...ah(token) })
}

export async function salarySaveSettings(token, settings) {
  return apiRequest('/admin/salary/settings', { method: 'PUT', body: JSON.stringify(settings), ...ah(token) })
}
