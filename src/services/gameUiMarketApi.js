import { API_BASE_URL } from './apiBase'

let _token = null

export function setWebguiToken(token) {
  _token = token || null
}

export function getWebguiToken() {
  return _token
}

function tokenParam() {
  return _token ? `?webgui_token=${encodeURIComponent(_token)}` : ''
}

function tokenSep(base) {
  return base.includes('?') ? '&' : '?'
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
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return body
}

export function getItems() {
  return req('/game-ui/market/items')
}

export function getOrderBook(itemKey) {
  return req(`/game-ui/market/order-book/${encodeURIComponent(itemKey)}`)
}

export function getMySellOrders() {
  return req('/game-ui/market/my-sell-orders')
}

export function getMyBuyOrders() {
  return req('/game-ui/market/my-buy-orders')
}

export function getMyTrades() {
  return req('/game-ui/market/my-trades')
}

export function getPickupReady() {
  return req('/game-ui/market/pickup-ready')
}

export function createPendingAction(actionType, payload = {}) {
  return req('/game-ui/market/pending-action', {
    method: 'POST',
    body: JSON.stringify({ action_type: actionType, payload }),
  })
}
