import { apiRequest } from './apiBase.js'

export async function getPlayersTop() {
  return apiRequest('/players/top')
}
