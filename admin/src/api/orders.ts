import { apiFetch } from './http'

const API_URL =
  import.meta.env.VITE_API_URL ||
  window.location.origin

export function getOrderDeliveryImageUrl(image: string | null): string | null {
  if (!image) return null
  if (/^https?:\/\//i.test(image)) return image
  return `${API_URL.replace(/\/+$/, '')}/${image.replace(/^\/+/, '')}`
}

export async function fetchOrderDeliveryImage(image: string): Promise<string> {
  const target = getOrderDeliveryImageUrl(image)
  if (!target) throw new Error('Rasm manzili topilmadi')
  const response = target.startsWith(`${API_URL.replace(/\/+$/, '')}/`)
    ? await apiFetch(target)
    : await fetch(target)
  if (!response.ok) throw new Error('Rasmni yuklab bo\u2018lmadi')
  return URL.createObjectURL(await response.blob())
}

export type OrderStatus =
  | 'NEW'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'CANCELLED'

export type OrderItem = {
  id: number
  product_id: number
  quantity: number
  quantity_unit: 'kg' | 'dona'
  weight_per_unit: number
  weight_kg: number
  price: number
  subtotal: number
}

export type Order = {
  id: number
  customer_id: number
  customer?: { id: number; name: string; surname: string | null; phone: string } | null
  total: number
  status: OrderStatus

  payment_method: string | null
  payment_confirmed: boolean
  payment_transaction_id: string | null
  payment_confirmed_at: string | null

  delivery_date: string | null
  delivery_time: string | null
  delivery_phone: string | null
  reservation_expires_at: string | null

  latitude: number
  longitude: number
  accuracy: number | null

  address: string | null
  landmark: string | null
  delivery_image_url: string | null
  comment: string | null

  created_at: string

  status_history: {
    id: number
    previous_status: string | null
    new_status: OrderStatus
    actor_telegram_id: number | null
    note: string | null
    created_at: string
  }[]

  items: OrderItem[]
}

function getErrorMessage(
  data: unknown,
  fallback: string,
): string {
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

    if (
      Array.isArray(detail)
    ) {
      return detail
        .map((item) => {
          if (
            typeof item ===
              'object' &&
            item !== null &&
            'msg' in item
          ) {
            return String(
              (
                item as {
                  msg?: unknown
                }
              ).msg ?? '',
            )
          }

          return ''
        })
        .filter(Boolean)
        .join(', ')
    }
  }

  return fallback
}

/*
 * Barcha buyurtmalar.
 */
export async function getOrders(): Promise<
  Order[]
> {
  const response = await apiFetch(
    `${API_URL}/orders/`,
  )

  if (!response.ok) {
    let message =
      'Buyurtmalarni olishda xatolik'

    try {
      const data =
        await response.json()

      message = getErrorMessage(
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

/*
 * Bitta buyurtma.
 */
export async function getOrder(
  orderId: number,
): Promise<Order> {
  const response = await apiFetch(
    `${API_URL}/orders/${orderId}`,
  )

  if (!response.ok) {
    let message =
      'Buyurtmani olishda xatolik'

    try {
      const data =
        await response.json()

      message = getErrorMessage(
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

/*
 * Buyurtma statusini o'zgartirish.
 *
 * Eslatma:
 * Backend PAID statusini faqat
 * payment_confirmed=true bo'lganda
 * qabul qiladi.
 */
export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
): Promise<Order> {
  const response = await apiFetch(
    `${API_URL}/orders/${orderId}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        status,
      }),
    },
  )

  if (!response.ok) {
    let message =
      'Buyurtma statusini o‘zgartirishda xatolik'

    try {
      const data =
        await response.json()

      message = getErrorMessage(
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

/*
 * Yetkazib berish sanasi va vaqtini
 * saqlash.
 */
export async function updateOrderDelivery(
  orderId: number,
  deliveryDate: string | null,
  deliveryTime: string | null,
): Promise<Order> {
  const response = await apiFetch(
    `${API_URL}/orders/${orderId}/delivery`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        delivery_date:
          deliveryDate,
        delivery_time:
          deliveryTime,
      }),
    },
  )

  if (!response.ok) {
    let message =
      'Yetkazib berish ma’lumotlarini saqlashda xatolik'

    try {
      const data =
        await response.json()

      message = getErrorMessage(
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
