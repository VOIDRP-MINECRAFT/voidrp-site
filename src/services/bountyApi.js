import { apiRequest } from './apiBase.js'

// Public bounty board for the active server (X-Server-Slug attached centrally).
export async function getBountyBoard() {
  return apiRequest('/bounties')
}
