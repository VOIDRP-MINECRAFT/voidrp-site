import { apiRequest } from './apiBase.js'

export async function getBattlePassProfileByNick(nickname) {
  return apiRequest(`/battlepass/profile-by-nick/${encodeURIComponent(nickname)}`)
}

export async function getBattlePassProfile(minecraftUuid) {
  return apiRequest(`/battlepass/profile/${minecraftUuid}`)
}

export async function getBattlePassLeaderboard() {
  return apiRequest('/battlepass/leaderboard')
}
