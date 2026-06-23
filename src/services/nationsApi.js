import { apiRequest, buildAuthHeaders } from './apiBase'

export async function getNationsList(accessToken = null) {
  return await apiRequest('/nations', {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function getMyNation(accessToken) {
  return await apiRequest('/nations/me', {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function getNationBySlug(slug, accessToken = null) {
  return await apiRequest(`/nations/${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function createNation(accessToken, payload) {
  return await apiRequest('/nations', {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function updateMyNation(accessToken, payload) {
  return await apiRequest('/nations/me', {
    method: 'PATCH',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function leaveMyNation(accessToken) {
  return await apiRequest('/nations/me/leave', {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function disbandMyNation(accessToken) {
  return await apiRequest('/nations/me', {
    method: 'DELETE',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function joinNation(accessToken, slug, payload = {}) {
  return await apiRequest(`/nations/${encodeURIComponent(slug)}/join`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function approveNationRequest(accessToken, slug, requestId) {
  return await apiRequest(
    `/nations/${encodeURIComponent(slug)}/requests/${encodeURIComponent(requestId)}/approve`,
    {
      method: 'POST',
      headers: buildAuthHeaders(accessToken),
    },
  )
}

export async function rejectNationRequest(accessToken, slug, requestId) {
  return await apiRequest(
    `/nations/${encodeURIComponent(slug)}/requests/${encodeURIComponent(requestId)}/reject`,
    {
      method: 'POST',
      headers: buildAuthHeaders(accessToken),
    },
  )
}

export async function updateNationMemberRole(accessToken, slug, userId, role) {
  return await apiRequest(
    `/nations/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}/role`,
    {
      method: 'PATCH',
      headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ role }),
    },
  )
}

export async function updateNationMemberPrefix(accessToken, slug, userId, customPrefix) {
  return await apiRequest(
    `/nations/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}/prefix`,
    {
      method: 'PATCH',
      headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ custom_prefix: customPrefix }),
    },
  )
}

export async function removeNationMember(accessToken, slug, userId) {
  return await apiRequest(`/nations/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function transferNationLeadership(accessToken, slug, targetUserId) {
  return await apiRequest(`/nations/${encodeURIComponent(slug)}/transfer-leadership`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ target_user_id: targetUserId }),
  })
}

async function uploadNationAsset(accessToken, slot, file) {
  const formData = new FormData()
  formData.append('file', file)

  return await apiRequest(`/nations/me/assets/${encodeURIComponent(slot)}`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
    body: formData,
  })
}

async function deleteNationAsset(accessToken, slot) {
  return await apiRequest(`/nations/me/assets/${encodeURIComponent(slot)}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(accessToken),
  })
}

export const uploadNationIcon = (accessToken, file) =>
  uploadNationAsset(accessToken, 'icon', file)

export const uploadNationBanner = (accessToken, file) =>
  uploadNationAsset(accessToken, 'banner', file)

export const uploadNationBackground = (accessToken, file) =>
  uploadNationAsset(accessToken, 'background', file)

export const deleteNationIcon = (accessToken) =>
  deleteNationAsset(accessToken, 'icon')

export const deleteNationBanner = (accessToken) =>
  deleteNationAsset(accessToken, 'banner')

export const deleteNationBackground = (accessToken) =>
  deleteNationAsset(accessToken, 'background')