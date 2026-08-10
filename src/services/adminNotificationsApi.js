import { apiRequest, buildAuthHeaders } from './apiBase'

// Permission-scoped admin notifications for the top banner. The backend only
// returns items the caller has permission to see (feedback / crashes / anticheat
// / maintenance …). Global endpoint — opts out of X-Server-Slug scoping.
export async function adminListNotifications(token) {
  return await apiRequest('/admin/notifications', {
    method: 'GET',
    headers: buildAuthHeaders(token),
    serverScope: false,
  })
}
