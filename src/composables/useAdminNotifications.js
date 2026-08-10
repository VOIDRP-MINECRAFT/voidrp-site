import { computed, reactive, ref } from 'vue'
import { authState } from '../stores/authStore'
import { adminListNotifications } from '../services/adminNotificationsApi'

// Shared admin notification center.
//
// Two sources feed one banner:
//  • server items  — permission-scoped, fetched from /admin/notifications
//    (pending feedback, launcher crashes, unreviewed anticheat, maintenance…).
//    The backend already filters by permission, so moderators never receive
//    alerts for areas they can't access.
//  • client alerts — transient, pushed locally (e.g. a news broadcast that
//    failed to reach Telegram/Discord). Persisted to sessionStorage so the
//    sender still sees it after navigating within the admin.
//
// Dismissals are remembered per id. Server items carry a `count`; if the count
// later changes the item resurfaces (new events happened), otherwise it stays
// hidden. Client alerts stay dismissed for the session.

const LEVEL_RANK = { error: 0, warning: 1, info: 2, success: 3 }
const CLIENT_KEY = 'voidrp_admin_client_alerts_v1'
const DISMISS_KEY = 'voidrp_admin_dismissed_v1'

function loadJson(store, key, fallback) {
  try { return JSON.parse(store.getItem(key)) ?? fallback } catch { return fallback }
}

const serverItems = ref([])
const clientItems = ref(loadJson(sessionStorage, CLIENT_KEY, []))
const dismissed = reactive(loadJson(localStorage, DISMISS_KEY, {}))

let pollTimer = null
let started = false

function persistClient() { sessionStorage.setItem(CLIENT_KEY, JSON.stringify(clientItems.value)) }
function persistDismissed() { localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed)) }

function signature(item) {
  return item.count != null ? String(item.count) : '1'
}

const notifications = computed(() => {
  const merged = [...clientItems.value, ...serverItems.value]
  return merged
    .filter((it) => dismissed[it.id] !== signature(it))
    .sort((a, b) => (LEVEL_RANK[a.level] ?? 2) - (LEVEL_RANK[b.level] ?? 2))
})

/** Push a transient client-side alert (deduped by id). */
export function pushAdminAlert({ id, level = 'error', title, message, link = null }) {
  const key = id || `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const next = clientItems.value.filter((a) => a.id !== key)
  next.unshift({ id: key, level, title, message, link, client: true })
  clientItems.value = next.slice(0, 20)
  persistClient()
  // A fresh push of an id should override a previous dismissal.
  if (dismissed[key]) { delete dismissed[key]; persistDismissed() }
}

export function dismissAdminNotification(item) {
  dismissed[item.id] = signature(item)
  persistDismissed()
  if (item.client) {
    clientItems.value = clientItems.value.filter((a) => a.id !== item.id)
    persistClient()
  }
}

async function refresh() {
  const token = authState.accessToken
  if (!token) return
  try {
    const res = await adminListNotifications(token)
    serverItems.value = Array.isArray(res?.items) ? res.items : []
  } catch {
    /* silent — a failed poll shouldn't spam the banner */
  }
}

function onVisibility() {
  if (document.hidden) {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  } else {
    refresh()
    if (!pollTimer) pollTimer = setInterval(refresh, 90_000)
  }
}

export function useAdminNotifications() {
  function start() {
    if (started) return
    started = true
    refresh()
    pollTimer = setInterval(refresh, 90_000)
    document.addEventListener('visibilitychange', onVisibility)
  }
  function stop() {
    started = false
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
    document.removeEventListener('visibilitychange', onVisibility)
  }
  return { notifications, refresh, start, stop, dismiss: dismissAdminNotification }
}
