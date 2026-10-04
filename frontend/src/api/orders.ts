import { apiFetch } from './telegram'

const API_URL =
  import.meta.env.VITE_API_URL ||
  window.location.origin

/* ============================================================
   TYPES
   ============================================================ */

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

export type OrderItemCreate = {
  product_id: number
  quantity: number
  quantity_unit: 'kg' | 'dona'
}

export type OrderCreate = {
  name: string
  phone: string
  telegram_id?: number | null

  latitude: number
  longitude: number
  accuracy?: number | null

  address?: string | null
  landmark?: string | null
  delivery_image_url: string
  comment?: string | null
  delivery_date?: string | null
  delivery_time?: string | null

  items: OrderItemCreate[]
}

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

  items: OrderItem[]
}

/* ============================================================
   API ERROR TYPES
   ============================================================ */

type FastAPIValidationError = {
  msg?: string
  loc?: Array<string | number>
}

type FastAPIErrorResponse = {
  detail?:
    | string
    | FastAPIValidationError[]
    | unknown
}

/* ============================================================
   ERROR PARSER
   ============================================================ */

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data =
      (await response.json()) as FastAPIErrorResponse

    if (typeof data.detail === 'string') {
      return data.detail
    }

    if (Array.isArray(data.detail)) {
      const messages = data.detail
        .map((item) => {
          if (
            item &&
            typeof item === 'object' &&
            'msg' in item &&
            typeof item.msg === 'string'
          ) {
            return item.msg
          }

          return null
        })
        .filter(
          (message): message is string =>
            Boolean(message),
        )

      if (messages.length > 0) {
        return messages.join(', ')
      }
    }
  } catch {
    // Response JSON bo'lmasa fallback ishlatiladi.
  }

  return fallback
}

/* ============================================================
   CREATE ORDER
   ============================================================ */

export async function createOrder(
  order: OrderCreate,
): Promise<Order> {
  const response = await apiFetch(
    `${API_URL}/orders/`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(order),
    },
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Buyurtma yaratishda xatolik',
    )

    throw new Error(message)
  }

  return (await response.json()) as Order
}

/* ============================================================
   GET ALL ORDERS
   ============================================================ */

export async function getOrders(): Promise<Order[]> {
  const response = await apiFetch(
    `${API_URL}/orders/`,
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Buyurtmalarni olishda xatolik',
    )

    throw new Error(message)
  }

  return (await response.json()) as Order[]
}

/* ============================================================
   GET SINGLE ORDER
   ============================================================ */

export async function getOrder(
  orderId: number,
): Promise<Order> {
  const response = await apiFetch(
    `${API_URL}/orders/${orderId}`,
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Buyurtmani olishda xatolik',
    )

    throw new Error(message)
  }

  return (await response.json()) as Order
}

/* ============================================================
   UPDATE ORDER STATUS
   ============================================================ */

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
): Promise<Order> {
  const response = await apiFetch(
    `${API_URL}/orders/${orderId}/status`,
    {
      method: 'PATCH',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        status,
      }),
    },
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Buyurtma statusini o‘zgartirishda xatolik',
    )

    throw new Error(message)
  }

  return (await response.json()) as Order
}

/* ============================================================
   UPDATE DELIVERY
   ============================================================ */

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
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        delivery_date: deliveryDate,
        delivery_time: deliveryTime,
      }),
    },
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Yetkazib berish ma’lumotlarini saqlashda xatolik',
    )

    throw new Error(message)
  }

  return (await response.json()) as Order
}

export async function uploadOrderDeliveryImage(
  image: File,
): Promise<string> {
  const formData = new FormData()
  formData.append('image', image)

  const response = await apiFetch(
    `${API_URL}/orders/delivery-image`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Manzil rasmini yuklashda xatolik',
    )
    throw new Error(message)
  }

  const result = (await response.json()) as { image_url: string }
  return result.image_url
}

export async function getMyOrders(): Promise<Order[]> {
  const response = await apiFetch(
    `${API_URL}/orders/mine`,
  )

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        'Buyurtmalarni olishda xatolik yuz berdi.',
      ),
    )
  }

  return response.json() as Promise<Order[]>
}
