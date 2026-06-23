import { apiRequest, buildAuthHeaders } from './apiBase'

export async function followProfile(accessToken, slug) {
  return await apiRequest(`/social/follow/${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function unfollowProfile(accessToken, slug) {
  return await apiRequest(`/social/follow/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function getMyFollowers(accessToken) {
  return await apiRequest('/social/me/followers', {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function getMyFollowing(accessToken) {
  return await apiRequest('/social/me/following', {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function getMyFriends(accessToken) {
  return await apiRequest('/social/me/friends', {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}
