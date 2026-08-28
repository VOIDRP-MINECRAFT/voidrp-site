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
