import { apiRequest, buildAuthHeaders } from './apiBase.js'

function ah(token) { return { headers: buildAuthHeaders(token) } }

export async function adminGetDonateOverview(token) {
  return apiRequest('/admin/donate/overview', { method: 'GET', ...ah(token) })
}

export async function adminGetDonatePayments(token, params = {}) {
  const q = new URLSearchParams()
  if (params.page !== undefined) q.set('page', params.page)
  if (params.per_page !== undefined) q.set('per_page', params.per_page)
  const qs = q.toString()
  return apiRequest(`/admin/donate/payments${qs ? '?' + qs : ''}`, { method: 'GET', ...ah(token) })
}
