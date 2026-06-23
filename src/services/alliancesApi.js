import { apiRequest, buildAuthHeaders } from './apiBase'

export async function getAlliances(accessToken = null) {
  return await apiRequest('/alliances', {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function getAllianceBySlug(slug, accessToken = null) {
  return await apiRequest(`/alliances/${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function createAlliance(accessToken, payload) {
  return await apiRequest('/alliances', {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function joinAlliance(accessToken, allianceSlug) {
  return await apiRequest('/alliances/join', {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ alliance_slug: allianceSlug }),
  })
}

export async function applyToAlliance(accessToken, slug) {
  return await apiRequest(`/alliances/${encodeURIComponent(slug)}/apply`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function leaveAlliance(accessToken) {
  return await apiRequest('/alliances/leave', {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function updateAlliancePolicies(accessToken, slug, payload) {
  return await apiRequest(`/alliances/${encodeURIComponent(slug)}/policies`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function getAllianceProposals(slug, accessToken = null) {
  return await apiRequest(`/alliances/${encodeURIComponent(slug)}/proposals`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}

export async function createAllianceProposal(accessToken, slug, payload) {
  return await apiRequest(`/alliances/${encodeURIComponent(slug)}/proposals`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function voteAllianceProposal(accessToken, proposalId, payload) {
  return await apiRequest(`/alliances/proposals/${encodeURIComponent(proposalId)}/vote`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function transferAllianceFunds(accessToken, slug, payload) {
  return await apiRequest(`/alliances/${encodeURIComponent(slug)}/transfer`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function getAllianceTransactions(slug, accessToken = null) {
  return await apiRequest(`/alliances/${encodeURIComponent(slug)}/transactions`, {
    method: 'GET',
    headers: buildAuthHeaders(accessToken),
  })
}
