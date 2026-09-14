import { apiRequest, buildAuthHeaders } from './apiBase.js'

// Launcher crash rules: what the launcher tells a player (and which fix button it offers)
// after a crash. Global endpoint — rules carry their own server_slug, so opt out of scoping.
function ah(token) { return { headers: buildAuthHeaders(token), serverScope: false } }

export function adminListCrashRules(token) {
  return apiRequest('/admin/launcher-crash-rules', { method: 'GET', ...ah(token) })
}

export function adminListBuiltinCrashRules(token) {
  return apiRequest('/admin/launcher-crash-rules/builtin', { method: 'GET', ...ah(token) })
}

export function adminCreateCrashRule(token, body) {
  return apiRequest('/admin/launcher-crash-rules', { method: 'POST', body: JSON.stringify(body), ...ah(token) })
}

export function adminUpdateCrashRule(token, id, body) {
  return apiRequest(`/admin/launcher-crash-rules/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body), ...ah(token) })
}

export function adminDeleteCrashRule(token, id) {
  return apiRequest(`/admin/launcher-crash-rules/${encodeURIComponent(id)}`, { method: 'DELETE', ...ah(token) })
}

export function adminTestCrashRule(token, body) {
  return apiRequest('/admin/launcher-crash-rules/test', { method: 'POST', body: JSON.stringify(body), ...ah(token) })
}

export function adminCrashRuleCoverage(token, days = 14) {
  return apiRequest(`/admin/launcher-crash-rules/coverage?days=${encodeURIComponent(days)}`, { method: 'GET', ...ah(token) })
}

export function adminSetLauncherRam(token, serverSlug, ramMb) {
  return apiRequest('/admin/launcher-crash-rules/settings', {
    method: 'POST',
    body: JSON.stringify({ server_slug: serverSlug, launcher_recommended_ram_mb: ramMb }),
    ...ah(token),
  })
}
