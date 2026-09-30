import { apiRequest, buildAuthHeaders } from './apiBase'

// «Права в игре» (LuckPerms). The server comes from X-Server-Slug (the admin switcher) unless given.
const opts = (token, extra = {}, server = null) => ({
  headers: buildAuthHeaders(token, server ? { 'X-Server-Slug': server } : {}),
  ...(server ? { serverScope: false } : {}),
  ...extra,
})
const post = (token, path, body, server = null) => apiRequest(`/admin/game-perms${path}`, opts(token, { method: 'POST', body: JSON.stringify(body) }, server))

export const getGamePerms = (token, server = null, extra = {}) => apiRequest('/admin/game-perms', opts(token, extra, server))
export const getGameOps = (token) => apiRequest('/admin/game-perms/ops', opts(token))
export const createGameGroup = (token, name) => post(token, '/groups', { name })
export const deleteGameGroup = (token, name) => apiRequest(`/admin/game-perms/groups/${encodeURIComponent(name)}`, opts(token, { method: 'DELETE' }))
export const changeGroupNode = (token, name, node) => post(token, `/groups/${encodeURIComponent(name)}/nodes`, node)
export const changeGroupMeta = (token, name, meta) => apiRequest(`/admin/game-perms/groups/${encodeURIComponent(name)}/meta`, opts(token, { method: 'PATCH', body: JSON.stringify(meta) }))
export const changeGroupParent = (token, name, parent, remove = false) => post(token, `/groups/${encodeURIComponent(name)}/parents`, { parent, remove })
export const setGroupOwnerOnly = (token, name, ownerOnly) => apiRequest(`/admin/game-perms/groups/${encodeURIComponent(name)}/owner-only`, opts(token, { method: 'PUT', body: JSON.stringify({ owner_only: ownerOnly }) }))
export const addGroupMember = (token, name, username) => post(token, `/groups/${encodeURIComponent(name)}/members`, { username })
export const removeGroupMember = (token, name, username) => post(token, `/groups/${encodeURIComponent(name)}/members/remove`, { username })
