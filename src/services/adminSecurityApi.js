import { apiRequest, buildAuthHeaders } from './apiBase'

// Audit log, punishments and the player-360 overview. Server-scoped endpoints
// (punishments, player-overview) pick up X-Server-Slug automatically from the
// active server via apiBase; the audit log is global.

function ah(token, extra = {}) {
  return { headers: buildAuthHeaders(token, extra) }
}

// ── Audit log (global) ──────────────────────────────────────────────────────
export function getAuditLog(token, { q = '', category = '', days = 30, limit = 50, offset = 0 } = {}) {
  const qs = new URLSearchParams({ days: String(days), limit: String(limit), offset: String(offset) })
  if (q) qs.set('q', q)
  if (category) qs.set('category', category)
  return apiRequest(`/admin/audit?${qs.toString()}`, ah(token))
}

// ── Punishments (server + global) ───────────────────────────────────────────
export function getPunishments(token, { q = '', type = '', status = 'active', limit = 50, offset = 0 } = {}) {
  const qs = new URLSearchParams({ status, limit: String(limit), offset: String(offset) })
  if (q) qs.set('q', q)
  if (type) qs.set('type', type)
  return apiRequest(`/admin/punishments?${qs.toString()}`, ah(token))
}

export function createPunishment(token, body) {
  return apiRequest('/admin/punishments', {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function revokePunishment(token, id, body = {}) {
  return apiRequest(`/admin/punishments/${id}/revoke`, {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ── Player 360 overview ─────────────────────────────────────────────────────
export function getPlayerOverview(token, nickname) {
  return apiRequest(`/admin/player-overview/${encodeURIComponent(nickname)}`, ah(token))
}
