import { apiRequest } from './apiBase'

// Public server catalogue (showcase + live status). No auth, no secret.
export async function getServers() {
  return await apiRequest('/servers', { method: 'GET', toast: false })
}

export async function getServer(slug) {
  return await apiRequest(`/servers/${encodeURIComponent(slug)}`, {
    method: 'GET',
    toast: false,
  })
}
