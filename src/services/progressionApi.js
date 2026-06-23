import { apiRequest } from './apiBase.js'

export async function getPlayerProgression(minecraftNickname) {
  return apiRequest(`/progression/player/${encodeURIComponent(minecraftNickname)}`)
}

export async function getProgressionLeaderboard() {
  return apiRequest('/progression/leaderboard')
}
