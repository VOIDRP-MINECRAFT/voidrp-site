import { apiRequest, buildAuthHeaders } from './apiBase'

// «Бан предметов» выбранного сервера (X-Server-Slug ставит apiBase).
const opts = (token, extra = {}) => ({ headers: buildAuthHeaders(token), ...extra })
const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const getItemBans = (token) => apiRequest('/admin/item-bans', opts(token))
export const searchBanItems = (token, q, limit = 60) =>
  apiRequest(`/admin/item-bans/search?q=${encodeURIComponent(q)}&limit=${limit}`, opts(token))
export const addItemBans = (token, itemIds, reason) =>
  apiRequest('/admin/item-bans', opts(token, json('POST', { item_ids: itemIds, reason: reason || null })))
export const updateItemBan = (token, id, patch) =>
  apiRequest(`/admin/item-bans/${id}`, opts(token, json('PATCH', patch)))
export const deleteItemBan = (token, id) => apiRequest(`/admin/item-bans/${id}`, opts(token, { method: 'DELETE' }))
export const saveItemBanSettings = (token, settings) =>
  apiRequest('/admin/item-bans/settings', opts(token, json('PUT', settings)))
