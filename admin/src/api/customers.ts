import { apiFetch } from './http'

const API_URL =
  import.meta.env.VITE_API_URL ||
  window.location.origin

export type CustomerOrderItem = {
  id: number
  product_id: number
  quantity: number
  quantity_unit: 'kg' | 'dona'
  weight_kg: number
  price: number
  subtotal: number
}

export type CustomerOrder = {
  id: number
  total: number
  status:
    | 'NEW'
    | 'PAYMENT_PENDING'
    | 'PAID'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'READY'
    | 'DELIVERING'
    | 'DELIVERED'
    | 'CANCELLED'
  payment_confirmed: boolean
  payment_method: string | null
  created_at: string
  delivery_phone: string | null
  latitude: number
  longitude: number
  accuracy: number | null
  address: string | null
  landmark: string | null
  comment: string | null
  items: CustomerOrderItem[]
}

export type Customer = {
  id: number
  telegram_id: number | null
  name: string
  surname: string | null
  phone: string
  profile_image: string | null
  latitude: number | null
  longitude: number | null
  accuracy?: number | null
  address: string | null
  landmark: string | null
  profile_completed: boolean

  created_at: string
  updated_at: string

  order_count: number
  total_purchases: number

  last_order_id: number | null
  last_order_at: string | null

  debt_balance: number
}

export type CustomerDetails =
  Customer & {
    orders: CustomerOrder[]
  }

function getErrorMessage(
  data: unknown,
  fallback: string,
) {
  if (
    typeof data === 'object' &&
    data !== null &&
    'detail' in data
  ) {
    const detail = (
      data as {
        detail?: unknown
      }
    ).detail

    if (
      typeof detail === 'string'
    ) {
      return detail
    }
  }

  return fallback
}


export async function getCustomers(): Promise<
  Customer[]
> {
  const response =
    await apiFetch(
      `${API_URL}/customers/`,
    )

  if (!response.ok) {
    let message =
      'Mijozlarni olishda xatolik'

    try {
      const data =
        await response.json()

      message =
        getErrorMessage(
          data,
          message,
        )
    } catch {
      // Default message.
    }

    throw new Error(message)
  }

  return response.json()
}


export async function getCustomer(
  customerId: number,
): Promise<CustomerDetails> {
  const response =
    await apiFetch(
      `${API_URL}/customers/${customerId}`,
    )

  if (!response.ok) {
    let message =
      'Mijozni olishda xatolik'

    try {
      const data =
        await response.json()

      message =
        getErrorMessage(
          data,
          message,
        )
    } catch {
      // Default message.
    }

    throw new Error(message)
  }

  return response.json()
}
