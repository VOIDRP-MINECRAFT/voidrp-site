// «Скачать лаунчер»: отмечаем клик для «Воронки новичка» (аккаунт — если вошёл). Не мешает скачиванию.
import { apiRequest, buildAuthHeaders } from './apiBase'
import { authState } from '../stores/authStore'

function platform() {
  const ua = (navigator.userAgent || '').toLowerCase()
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'mac'
  if (ua.includes('linux')) return 'linux'
  return 'other'
}

export function trackLauncherDownload() {
  try {
    apiRequest('/launcher/download-event', {
      method: 'POST',
      headers: { ...(authState.accessToken ? buildAuthHeaders(authState.accessToken) : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: platform() }),
      toast: false,
      serverScope: false,
    }).catch(() => {})
  } catch { /* never block the download */ }
}
