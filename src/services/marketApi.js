import { apiRequest } from './apiBase'
import { authState } from '../stores/authStore'

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export async function getMarketSummary() {
  return await apiRequest('/market/summary', { method: 'GET' })
}

export async function getMarketItems(params = {}) {
  return await apiRequest(`/market/items${buildQuery(params)}`, { method: 'GET' })
}

export async function getMarketItem(material) {
  return await apiRequest(`/market/items/${encodeURIComponent(material)}`, { method: 'GET' })
}

export async function getNationMarketListings(params = {}) {
  return await apiRequest(`/market/nation-listings${buildQuery(params)}`, { method: 'GET' })
}

export async function getMarketTransactions(params = {}) {
  return await apiRequest(`/market/transactions${buildQuery(params)}`, { method: 'GET' })
}

export async function getMarketItemHistory(material, days = 30) {
  return await apiRequest(`/market/items/${encodeURIComponent(material)}/history?days=${days}`, { method: 'GET' })
}

// ── Player market API ─────────────────────────────────────────────────────────

export async function getPlayerMarketItems() {
  return await apiRequest('/market/player/items', { method: 'GET' })
}

export async function getPlayerMarketOrderBook(itemKey) {
  return await apiRequest(`/market/player/order-book/${encodeURIComponent(itemKey)}`, { method: 'GET' })
}

export async function getPlayerMarketSellOrders(params = {}) {
  return await apiRequest(`/market/player/sell-orders${buildQuery(params)}`, { method: 'GET' })
}

export async function getPlayerMarketBuyOrders(params = {}) {
  return await apiRequest(`/market/player/buy-orders${buildQuery(params)}`, { method: 'GET' })
}

export async function getPlayerMarketTrades(params = {}) {
  return await apiRequest(`/market/player/trades${buildQuery(params)}`, { method: 'GET' })
}

export async function getMyPlayerMarketSellOrders(params = {}) {
  return await apiRequest(`/market/player/me/sell-orders${buildQuery(params)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${authState.accessToken}` },
  })
}

export async function getMyPlayerMarketBuyOrders(params = {}) {
  return await apiRequest(`/market/player/me/buy-orders${buildQuery(params)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${authState.accessToken}` },
  })
}

export async function getMyPlayerMarketTrades(params = {}) {
  return await apiRequest(`/market/player/me/trades${buildQuery(params)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${authState.accessToken}` },
  })
}
