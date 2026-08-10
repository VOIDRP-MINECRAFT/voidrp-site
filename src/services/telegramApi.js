import { apiRequest, buildAuthHeaders } from './apiBase'

export async function getTelegramStatus(token) {
  return await apiRequest('/profile/telegram', {
    method: 'GET',
    headers: buildAuthHeaders(token),
  })
}

export async function linkTelegram(token, code) {
  return await apiRequest('/profile/telegram/link', {
    method: 'POST',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ token: code }),
  })
}

export async function unlinkTelegram(token) {
  return await apiRequest('/profile/telegram', {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
  })
}
