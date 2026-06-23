import { apiRequest, buildAuthHeaders } from './apiBase'

export async function getMyPublicProfile(accessToken) {
  return await apiRequest('/profiles/me', {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function updateMyPublicProfile(accessToken, payload) {
  return await apiRequest('/profiles/me', {
    method: 'PATCH',
    headers: buildAuthHeaders(accessToken, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  })
}

export async function getPublicProfileBySlug(slug, accessToken = null) {
  return await apiRequest(`/profiles/${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

async function uploadProfileAsset(accessToken, slot, file) {
  const formData = new FormData()
  formData.append('file', file)

  return await apiRequest(`/profiles/me/${slot}`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
    body: formData,
  })
}

export async function uploadAvatar(accessToken, file) {
  return await uploadProfileAsset(accessToken, 'avatar', file)
}

export async function uploadBanner(accessToken, file) {
  return await uploadProfileAsset(accessToken, 'banner', file)
}

export async function uploadBackground(accessToken, file) {
  return await uploadProfileAsset(accessToken, 'background', file)
}

async function deleteProfileAsset(accessToken, slot) {
  return await apiRequest(`/profiles/me/${slot}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function deleteAvatar(accessToken) {
  return await deleteProfileAsset(accessToken, 'avatar')
}

export async function deleteBanner(accessToken) {
  return await deleteProfileAsset(accessToken, 'banner')
}

export async function deleteBackground(accessToken) {
  return await deleteProfileAsset(accessToken, 'background')
}
