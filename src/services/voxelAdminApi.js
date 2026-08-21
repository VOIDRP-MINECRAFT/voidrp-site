import { apiRequest, buildAuthHeaders } from './apiBase'

// Voxel Engine — CRUD игр. Все эндпоинты резолвят сервер из X-Server-Slug,
// который apiBase подставляет из активного сервера в топбаре админки.

function ah(token, extra = {}) {
  return { headers: buildAuthHeaders(token, extra) }
}

export function listVoxelGames(token) {
  return apiRequest('/admin/voxel/games', ah(token))
}

export function getVoxelGame(token, id) {
  return apiRequest(`/admin/voxel/games/${id}`, ah(token))
}

export function createVoxelGame(token, payload) {
  return apiRequest('/admin/voxel/games', {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateVoxelGame(token, id, payload) {
  return apiRequest(`/admin/voxel/games/${id}`, {
    ...ah(token, { 'Content-Type': 'application/json' }),
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteVoxelGame(token, id) {
  return apiRequest(`/admin/voxel/games/${id}`, {
    ...ah(token),
    method: 'DELETE',
  })
}

// Сделать игру единственной активной на сервере (диспетчер мода её запустит).
export function activateVoxelGame(token, id) {
  return apiRequest(`/admin/voxel/games/${id}/activate`, {
    ...ah(token),
    method: 'POST',
  })
}
