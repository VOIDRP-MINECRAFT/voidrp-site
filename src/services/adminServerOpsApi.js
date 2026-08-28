import { apiRequest, buildAuthHeaders } from './apiBase'

// All endpoints resolve the target server from the X-Server-Slug header, which
// apiBase attaches automatically from the active server. So these calls always
// act on the server currently selected in the admin topbar switcher.

function ah(token, extra = {}) {
  return { headers: buildAuthHeaders(token, extra) }
}

// Host CPU/RAM/load/uptime + server-process CPU/RAM + disk of the data drive.
export function getServerMetrics(token) {
  return apiRequest('/admin/server-ops/metrics', ah(token))
}

// RCON-derived: online players (+ names) and TPS/MSPT.
export function getServerLive(token) {
  return apiRequest('/admin/server-ops/live', ah(token))
}

export function runRconCommand(token, command) {
  return apiRequest('/admin/server-ops/rcon', {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'POST',
    body: JSON.stringify({ command }),
  })
}

// Kick/ban/op an online player (permission: players.online.moderate).
export function moderatePlayer(token, action, player) {
  return apiRequest('/admin/server-ops/moderate', {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'POST',
    body: JSON.stringify({ action, player }),
  })
}

// Start / restart / stop the server's systemd unit (permission: monitoring.restart).
export function serverPowerAction(token, action) {
  return apiRequest('/admin/server-ops/power', {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'POST',
    body: JSON.stringify({ action }),
  })
}

export function getServerLogs(token, { source = 'server', lines = 250 } = {}) {
  const qs = new URLSearchParams({ source, lines: String(lines) })
  return apiRequest(`/admin/server-ops/logs?${qs.toString()}`, ah(token))
}

// Recent watchdog/HUNG_TICK stalls parsed out of the server log (summary lines).
export function getServerHangs(token, { limit = 50 } = {}) {
  const qs = new URLSearchParams({ limit: String(limit) })
  return apiRequest(`/admin/server-ops/hangs?${qs.toString()}`, ah(token))
}

// In-game chat feed (player chat + join/leave/death) parsed out of the log.
export function getServerChat(token, { limit = 200 } = {}) {
  const qs = new URLSearchParams({ limit: String(limit) })
  return apiRequest(`/admin/server-ops/chat?${qs.toString()}`, ah(token))
}
