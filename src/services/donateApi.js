import { apiRequest, buildAuthHeaders } from './apiBase'

export async function getDonateProducts() {
  return await apiRequest('/donate/products', { method: 'GET' })
}

export async function getDonateServers() {
  return await apiRequest('/donate/servers', { method: 'GET' })
}

export async function getLastPayments() {
  return await apiRequest('/donate/payments/last', { method: 'GET' })
}

export async function createPayment(token, products, coupon = null) {
  return await apiRequest('/donate/payment', {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify({ products, ...(coupon ? { coupon } : {}) }),
  })
}
