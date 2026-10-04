import { apiFetch } from './http'

const API_URL = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '')

export type InventoryMovement = {
  id: number
  product_id: number
  product_name: string
  unit_type: 'kg' | 'dona'
  order_id: number | null
  kind: 'RECEIPT' | 'RETURN' | 'ADJUSTMENT' | 'SALE'
  quantity_delta: number
  note: string | null
  actor_telegram_id: number | null
  created_at: string
}

export async function getInventoryMovements(): Promise<InventoryMovement[]> {
  const response = await apiFetch(`${API_URL}/inventory/movements`)
  if (!response.ok) throw new Error(`Ombor tarixi yuklanmadi (${response.status}).`)
  return response.json()
}

export async function createInventoryMovement(input: {
  product_id: number
  kind: 'RECEIPT' | 'RETURN' | 'ADJUSTMENT'
  quantity_delta: number
  note: string
}): Promise<InventoryMovement> {
  const response = await apiFetch(`${API_URL}/inventory/movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { detail?: string }
    throw new Error(data.detail || `Ombor harakati saqlanmadi (${response.status}).`)
  }
  return response.json()
}
