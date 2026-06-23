import { computed, reactive } from 'vue'
import { setUnauthorizedHandler } from '../services/apiBase'
import {
  getMe,
  loginAccount,
  logoutSession,
  refreshSession,
  registerAccount,
  revokeOtherSessions,
} from '../services/authApi'
import { getMyPublicProfile } from '../services/profileApi'
import { toastInfo, toastSuccess } from '../services/toast'

const STORAGE_KEY = 'voidrp_auth_v1'

export const authState = reactive({
  accessToken: null,
  refreshToken: null,
  user: null,
  playerAccount: null,
  security: null,
  avatarUrl: null,
  ready: false,
})

let bootstrapPromise = null
let refreshPromise = null
let sessionExpiredToastShown = false

function loadStoredAuth() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw)
    authState.accessToken = parsed.accessToken || null
    authState.refreshToken = parsed.refreshToken || null
    authState.user = parsed.user || null
    authState.playerAccount = parsed.playerAccount || null
    authState.security = parsed.security || null
    authState.avatarUrl = parsed.avatarUrl || null
  } catch {
    clearAuthState()
  }
}

function persistAuth() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accessToken: authState.accessToken,
      refreshToken: authState.refreshToken,
      user: authState.user,
      playerAccount: authState.playerAccount,
      security: authState.security,
      avatarUrl: authState.avatarUrl,
    }),
  )
}

export function clearAuthState() {
  authState.accessToken = null
  authState.refreshToken = null
  authState.user = null
  authState.playerAccount = null
  authState.security = null
  authState.avatarUrl = null
  localStorage.removeItem(STORAGE_KEY)
}

function applyTokenResponse(payload) {
  authState.accessToken = payload.access_token
  authState.refreshToken = payload.refresh_token
  authState.user = payload.user
  authState.playerAccount = payload.player_account
  authState.security = payload.security || null
  persistAuth()
  sessionExpiredToastShown = false
}

export function getIsAuthenticated() {
  return Boolean(authState.accessToken && authState.user)
}

export async function refreshCurrentSessionSilently() {
  if (!authState.refreshToken) {
    return false
  }

  if (refreshPromise) {
    return await refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const response = await refreshSession(
        {
          refresh_token: authState.refreshToken,
          device_name: 'VoidRP Site',
        },
        { handleAuth: false, toast: false },
      )
      applyTokenResponse(response)
      return true
    } catch {
      clearAuthState()
      authState.ready = true
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return await refreshPromise
}

export function installAuthApiHooks() {
  setUnauthorizedHandler(async () => {
    const refreshed = await refreshCurrentSessionSilently()
    if (refreshed) {
      return true
    }

    if (!sessionExpiredToastShown) {
      toastInfo('Сессия истекла. Войди снова, чтобы продолжить.', 'Нужно войти снова')
      sessionExpiredToastShown = true
    }

    return false
  })
}

export async function bootstrapAuth() {
  if (authState.ready) return
  if (bootstrapPromise) return bootstrapPromise

  bootstrapPromise = (async () => {
    loadStoredAuth()

    if (!authState.refreshToken) {
      authState.ready = true
      return
    }

    try {
      const refreshed = await refreshCurrentSessionSilently()
      if (!refreshed) {
        clearAuthState()
      }
    } finally {
      authState.ready = true
    }
  })()

  try {
    await bootstrapPromise
  } finally {
    bootstrapPromise = null
  }
}

export async function registerAndOptionallyStay(payload) {
  return await registerAccount(payload)
}

export async function loginWithPassword(payload) {
  const response = await loginAccount(payload, { handleAuth: false })
  applyTokenResponse(response)
  authState.ready = true
  return response
}

async function _refreshAvatarUrl() {
  if (!authState.accessToken) return
  try {
    const profile = await getMyPublicProfile(authState.accessToken)
    const url = profile?.assets?.avatar_preview_url || profile?.assets?.avatar_url || null
    if (authState.avatarUrl !== url) {
      authState.avatarUrl = url
      persistAuth()
    }
  } catch {
    // non-critical, avatar stays as-is
  }
}

export async function reloadMe() {
  if (!authState.accessToken) {
    clearAuthState()
    return null
  }

  try {
    const response = await getMe(authState.accessToken)
    authState.user = response.user
    authState.playerAccount = response.player_account
    authState.security = response.security || null
    persistAuth()
    _refreshAvatarUrl()
    return response
  } catch (error) {
    if (error?.status === 401) {
      const refreshed = await refreshCurrentSessionSilently()
      if (refreshed && authState.accessToken) {
        const response = await getMe(authState.accessToken)
        authState.user = response.user
        authState.playerAccount = response.player_account
        authState.security = response.security || null
        persistAuth()
        _refreshAvatarUrl()
        return response
      }
    }
    throw error
  }
}

export async function revokeOtherSessionsForCurrentAccount() {
  if (!authState.accessToken || !authState.refreshToken) {
    throw new Error('Нет активной сессии для управления другими входами.')
  }

  const response = await revokeOtherSessions(authState.accessToken, {
    refresh_token: authState.refreshToken,
  })

  await reloadMe()
  return response
}

export async function logoutCurrentSession() {
  const refreshToken = authState.refreshToken
  clearAuthState()
  authState.ready = true

  if (!refreshToken) return

  try {
    await logoutSession({ refresh_token: refreshToken }, { handleAuth: false, toast: false })
  } catch {
    // local state is already cleared
  }
}

export function useAuthStore() {
  return {
    state: authState,

    get accessToken() {
      return authState.accessToken
    },

    get refreshToken() {
      return authState.refreshToken
    },

    ready: computed(() => authState.ready),
    isAuthenticated: computed(() => getIsAuthenticated()),

    displayName: computed(
      () => authState.playerAccount?.minecraft_nickname || authState.user?.site_login || 'Игрок',
    ),

    avatarUrl: computed(() => authState.avatarUrl),
    emailVerified: computed(() => Boolean(authState.user?.email_verified)),
    nicknameLocked: computed(() => Boolean(authState.playerAccount?.nickname_locked)),
    legacyAuthEnabled: computed(() => Boolean(authState.playerAccount?.legacy_auth_enabled)),
    activeSessions: computed(() => Number(authState.security?.active_refresh_sessions || 0)),
    mustUseLauncher: computed(() => Boolean(authState.security?.must_use_launcher)),
    legacyReady: computed(() => Boolean(authState.security?.legacy_ready)),
    legacyHashPresent: computed(() => Boolean(authState.security?.legacy_hash_present)),
    isAdmin: computed(() => Boolean(authState.user?.is_admin)),

    accountModeText: computed(() => {
      if (authState.security?.must_use_launcher) return 'Только официальный лаунчер'
      if (authState.playerAccount?.legacy_auth_enabled) return 'Лаунчер и старый вход'
      return 'Стандартный режим'
    }),
  }
}
