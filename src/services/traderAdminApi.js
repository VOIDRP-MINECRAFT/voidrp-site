import { apiRequest, buildAuthHeaders } from './apiBase.js'

function ah(token) { return { headers: buildAuthHeaders(token) } }
function qs(params) {
  const q = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v) })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const traderStatus = (token) => apiRequest('/admin/trader/status', { method: 'GET', ...ah(token) })
export const traderSaveSettings = (token, config, phases) =>
  apiRequest('/admin/trader/settings', { method: 'PUT', body: JSON.stringify({ config, phases }), ...ah(token) })
export const traderCatalog = (token, params) => apiRequest(`/admin/trader/catalog${qs(params)}`, { method: 'GET', ...ah(token) })
export const traderCatalogCreate = (token, data) => apiRequest('/admin/trader/catalog', { method: 'POST', body: JSON.stringify(data), ...ah(token) })
export const traderCatalogUpdate = (token, id, data) => apiRequest(`/admin/trader/catalog/${id}`, { method: 'PATCH', body: JSON.stringify(data), ...ah(token) })
export const traderCatalogDelete = (token, id) => apiRequest(`/admin/trader/catalog/${id}`, { method: 'DELETE', ...ah(token) })
export const traderCatalogBulk = (token, data) => apiRequest('/admin/trader/catalog/bulk', { method: 'POST', body: JSON.stringify(data), ...ah(token) })
export const traderForceVisit = (token, kind) => apiRequest('/admin/trader/visits/force', { method: 'POST', body: JSON.stringify({ kind }), ...ah(token) })
export const traderEndVisit = (token, id) => apiRequest(`/admin/trader/visits/${id}/end`, { method: 'POST', ...ah(token) })
export const traderPreview = (token, kind) => apiRequest('/admin/trader/preview', { method: 'POST', body: JSON.stringify({ kind }), ...ah(token) })
export const traderVisits = (token, params) => apiRequest(`/admin/trader/visits${qs(params)}`, { method: 'GET', ...ah(token) })
export const traderVisit = (token, id) => apiRequest(`/admin/trader/visits/${id}`, { method: 'GET', ...ah(token) })
export const traderTransactions = (token, params) => apiRequest(`/admin/trader/transactions${qs(params)}`, { method: 'GET', ...ah(token) })
