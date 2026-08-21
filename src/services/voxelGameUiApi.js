/**
 * API-клиент для in-game редактора Voxel Engine (страница открывается модом WebGUI).
 * К каждому запросу добавляет webgui_token (аутентификация игрока) и server (slug).
 */
import { API_BASE_URL } from './apiBase'

let _token = null
let _server = null

export function setVoxelCtx(token, server) {
  _token = token || null
  _server = server || null
}

function withParams(path) {
  const p = new URLSearchParams()
  if (_token) p.set('webgui_token', _token)
  if (_server) p.set('server', _server)
  const qs = p.toString()
  if (!qs) return path
  return path + (path.includes('?') ? '&' : '?') + qs
}

async function req(path, options = {}) {
  const res = await fetch(API_BASE_URL + withParams(path), {
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

export function listGames() {
  return req('/game-ui/voxel/games')
}
export function createGame(payload) {
  return req('/game-ui/voxel/games', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateGame(gameId, payload) {
  return req(`/game-ui/voxel/games/${encodeURIComponent(gameId)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function activateGame(gameId) {
  return req(`/game-ui/voxel/games/${encodeURIComponent(gameId)}/activate`, { method: 'POST' })
}
export function upsertZone(payload) {
  return req('/game-ui/voxel/zone', { method: 'POST', body: JSON.stringify(payload) })
}
