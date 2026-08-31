/**
 * Shared API client for game-ui pages (HUD, treasury, battlepass, alliance, nation-market).
 * Token is read once from the URL and stored in module scope.
 */
import { API_BASE_URL } from './apiBase'

let _token = null

export function setWebguiToken(token) {
  _token = token || null
}

export function getWebguiToken() {
  return _token
}

function addToken(path) {
  if (!_token) return path
  return path + (path.includes('?') ? '&' : '?') + `webgui_token=${encodeURIComponent(_token)}`
}

async function req(path, options = {}) {
  const url = API_BASE_URL + addToken(path)
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (res.status === 204) return null
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = body?.detail || body?.message || `HTTP ${res.status}`
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    err.status = res.status
    throw err
  }
  return body
}

// ── HUD ──────────────────────────────────────────────────────────────────────

export function getHudSnapshot() {
  return req('/game-ui/hud/snapshot')
}

// ── Nation Market ─────────────────────────────────────────────────────────────

export function getNationMarketListings({ q, nation_slug, material, limit = 100 } = {}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (nation_slug) params.set('nation_slug', nation_slug)
  if (material) params.set('material', material)
  params.set('limit', limit)
  return req(`/game-ui/nation-market/listings?${params}`)
}

// ── Treasury ─────────────────────────────────────────────────────────────────

export function getTreasurySummary() {
  return req('/game-ui/treasury/summary')
}

// ── Battle Pass reward track ──────────────────────────────────────────────────

export function getBpTrack() {
  return req('/game-ui/battlepass/track')
}

// ── Home / profile dashboard ──────────────────────────────────────────────────

export function getHome() {
  return req('/game-ui/home')
}

export function getTopBar() {
  return req('/game-ui/home/topbar')
}

// ── Daily quests (web view) ───────────────────────────────────────────────────

export function getMyQuests() {
  return req('/game-ui/quests/mine')
}

// ── Server-side command (opens an in-game GUI) ────────────────────────────────
// The client run_command bridge doesn't execute plugin commands on this hybrid
// server, so we queue a whitelisted "command" web action; the plugin polls it and
// runs it server-side for the player (~1s later).
export function runGameCommand(command) {
  return req('/game-ui/market/pending-action', {
    method: 'POST',
    body: JSON.stringify({ action_type: 'command', payload: { command } }),
  })
}

// Open a WEBGUI page in-game (menu|market|nmarket|treasury|research|alliance|battlepass|quests).
// The plugin polls this and opens the page via the WebGUI bridge (unlike a command that may
// open a native GUI). Used by notification actions.
export function runGameOpenPage(page) {
  return req('/game-ui/market/pending-action', {
    method: 'POST',
    body: JSON.stringify({ action_type: 'open_gui', payload: { page } }),
  })
}

// ── Nation research (tech tree) ───────────────────────────────────────────────

export function getResearchOverview() {
  return req('/game-ui/research/overview')
}

export function purchaseResearch(researchKey) {
  return req('/game-ui/research/purchase', {
    method: 'POST',
    body: JSON.stringify({ research_key: researchKey }),
  })
}

// ── Battle Pass ───────────────────────────────────────────────────────────────

export function getBattlepassStatus() {
  return req('/game-ui/battlepass/status')
}

// ── Alliance ──────────────────────────────────────────────────────────────────

export function getMyAlliance() {
  return req('/game-ui/alliance/my')
}

// Vote on an alliance proposal by id (the in-game /alliance vote is index-based &
// stateful, so the browser votes through the backend directly).
export function voteAllianceProposal(proposalId, vote, comment) {
  return req('/game-ui/alliance/vote', {
    method: 'POST',
    body: JSON.stringify({ proposal_id: proposalId, vote, comment: comment || null }),
  })
}

// ── Leaderboards ──────────────────────────────────────────────────────────────
export function getLeaderboards() {
  return req('/game-ui/leaderboards')
}

// Per-server feature toggles (to hide disabled tabs in the WebGUI).
export function getFeatures() {
  return req('/game-ui/home/features')
}

// ── Void Upgrader ─────────────────────────────────────────────────────────────
export function getUpgraderRewards() {
  return req('/game-ui/upgrader/rewards')
}
export function spinUpgrader(rewardId, stake, clientSeed) {
  return req('/game-ui/upgrader/spin', {
    method: 'POST',
    body: JSON.stringify({ reward_id: rewardId, stake, client_seed: clientSeed || null }),
  })
}
export function getUpgraderHistory() {
  return req('/game-ui/upgrader/history')
}
export function getUpgraderRecentWins() {
  return req('/game-ui/upgrader/recent-wins')
}
export function getUpgraderWinnings() {
  return req('/game-ui/upgrader/winnings')
}
export function claimUpgraderWinning(id) {
  return req(`/game-ui/upgrader/winnings/${id}/claim`, { method: 'POST' })
}
export function sellUpgraderWinning(id) {
  return req(`/game-ui/upgrader/winnings/${id}/sell`, { method: 'POST' })
}
export function sellAllUpgraderWinnings() {
  return req('/game-ui/upgrader/winnings/sell-all', { method: 'POST' })
}
export function claimAllUpgraderWinnings() {
  return req('/game-ui/upgrader/winnings/claim-all', { method: 'POST' })
}
export function getUpgraderStats() {
  return req('/game-ui/upgrader/stats')
}
export function dailySpinUpgrader(rewardId, clientSeed) {
  return req('/game-ui/upgrader/daily-spin', {
    method: 'POST',
    body: JSON.stringify({ reward_id: rewardId, client_seed: clientSeed || null }),
  })
}
export function getUpgraderJackpot() {
  return req('/game-ui/upgrader/jackpot')
}
export function getUpgraderLeaderboard() {
  return req('/game-ui/upgrader/leaderboard')
}

// ── Notifications (reactive HUD toasts) ───────────────────────────────────────
// The feed returns UNSEEN notifications and marks them seen on fetch — one-shot.
export function getNotifications() {
  return req('/game-ui/notifications')
}
// Notification center: recent undismissed notifications (does NOT mark them seen).
export function getNotificationHistory() {
  return req('/game-ui/notifications/history')
}
// Daily playtime for the in-game activity chart (last N days, zero-filled).
export function getActivity() {
  return req('/game-ui/activity')
}
// Recent activity of the player's own nation (home feed).
export function getNationActivity() {
  return req('/game-ui/home/nation-activity')
}
// Current week's rotating challenges + progress.
export function getWeekly() {
  return req('/game-ui/weekly')
}
// Account-level (synced) settings.
export function getAccountSettings() {
  return req('/game-ui/settings')
}
export function patchAccountSettings(body) {
  return req('/game-ui/settings', { method: 'PATCH', body: JSON.stringify(body) })
}
export function dismissNotification(id) {
  return req(`/game-ui/notifications/${id}/dismiss`, { method: 'POST' })
}
