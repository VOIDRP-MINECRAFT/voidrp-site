import { apiRequest } from './apiBase.js'

// Public PvP killfeed for the active server (X-Server-Slug attached centrally).
export async function getKillfeed() {
  return apiRequest('/killfeed')
}
