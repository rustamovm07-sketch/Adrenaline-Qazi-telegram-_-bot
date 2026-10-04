import { apiFetch } from './telegram'

const API_URL = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, '')

export type HamyonPayment = {
  payment_id: string
  order_id: number
  order_amount: number
  payment_amount: number
  currency: 'UZS'
  card: string | null
  status: 'CREATING' | 'PENDING' | 'PROCESSING' | 'PAID' | 'PAID_REVIEW' | 'CANCELLED' | 'FAILED'
  expires_at: string | null
  paid_at?: string | null
}

async function readPayment(response: Response): Promise<HamyonPayment> {
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { detail?: unknown } | null
    throw new Error(typeof data?.detail === 'string' ? data.detail : 'To‘lov ma’lumotini olishda xatolik.')
  }
  return response.json() as Promise<HamyonPayment>
}

export async function createHamyonPayment(orderId: number): Promise<HamyonPayment> {
  return readPayment(await apiFetch(`${API_URL}/payments/orders/${orderId}/hamyon`, { method: 'POST' }))
}

export async function getHamyonPayment(paymentId: string): Promise<HamyonPayment> {
  return readPayment(await apiFetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`))
}
