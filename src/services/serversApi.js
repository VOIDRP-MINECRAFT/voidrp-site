import { apiRequest, buildAuthHeaders } from './apiBase'

// Public server catalogue (showcase + live status). No secret.
// The token is optional: sending it lets the backend include servers marked
// "только для админов" (staff_only) when the caller is an admin or holds
// `servers.hidden.view`. Anonymous callers just get the public list.
export async function getServers(token = null) {
  return await apiRequest('/servers', {
    method: 'GET',
    headers: buildAuthHeaders(token),
    toast: false,
  })
}

export async function getServer(slug, token = null) {
  return await apiRequest(`/servers/${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers: buildAuthHeaders(token),
    toast: false,
  })
}
