import { reactive, computed } from 'vue'
import { getServers } from '../services/serversApi'

// Active-server selection for the multi-server system.
// The chosen slug is mirrored into localStorage under ACTIVE_SLUG_KEY so the
// central HTTP layer (apiBase.js) can attach `X-Server-Slug` without importing
// this store (avoids a circular import).
export const ACTIVE_SLUG_KEY = 'voidrp_active_server'
const LIST_CACHE_KEY = 'voidrp_server_list_v1'

function readCachedList() {
  try {
    const raw = localStorage.getItem(LIST_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const serverState = reactive({
  list: readCachedList(),
  activeSlug: localStorage.getItem(ACTIVE_SLUG_KEY) || null,
  loading: false,
  loaded: false,
  error: null,
})

export const activeServer = computed(() =>
  serverState.list.find((s) => s.slug === serverState.activeSlug) || null,
)

export function getActiveServerSlug() {
  return serverState.activeSlug
}

function persistSlug(slug) {
  if (slug) {
    localStorage.setItem(ACTIVE_SLUG_KEY, slug)
  } else {
    localStorage.removeItem(ACTIVE_SLUG_KEY)
  }
}

export function setActiveServer(slug) {
  if (slug === serverState.activeSlug) return
  serverState.activeSlug = slug || null
  persistSlug(serverState.activeSlug)
}

function pickDefaultSlug(list) {
  if (!list.length) return null
  // Prefer the currently selected one if it still exists, else first in list.
  if (serverState.activeSlug && list.some((s) => s.slug === serverState.activeSlug)) {
    return serverState.activeSlug
  }
  return list[0].slug
}

export async function fetchServers({ force = false } = {}) {
  if (serverState.loading) return serverState.list
  if (serverState.loaded && !force) return serverState.list
  serverState.loading = true
  serverState.error = null
  try {
    const list = await getServers()
    serverState.list = Array.isArray(list) ? list : []
    try {
      localStorage.setItem(LIST_CACHE_KEY, JSON.stringify(serverState.list))
    } catch {
      // storage may be full / unavailable — non-fatal
    }
    const nextSlug = pickDefaultSlug(serverState.list)
    if (nextSlug && nextSlug !== serverState.activeSlug) {
      setActiveServer(nextSlug)
    }
    serverState.loaded = true
  } catch (err) {
    serverState.error = err
  } finally {
    serverState.loading = false
  }
  return serverState.list
}

let bootstrapPromise = null
export function bootstrapServers() {
  if (!bootstrapPromise) {
    bootstrapPromise = fetchServers()
  }
  return bootstrapPromise
}