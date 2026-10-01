import { apiFetch } from './http'

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000'


export type DashboardRecentOrder = {
  id: number
  customer_name: string
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
  created_at: string
}


export type DashboardTopProduct = {
  id: number
  name: string
  sold_kg: number
  revenue: number
}


export type DashboardLowStockProduct = {
  id: number
  name: string
  unit_type: 'kg' | 'dona'
  stock_units: number
  weight_per_unit: number
}


export type DashboardData = {
  period: {
    today: string
    month: string
  }

  orders: {
    total: number
    today: number
    month: number
    new: number
    paid: number
    delivering: number
    delivered: number
  }

  revenue: {
    total: number
    today: number
    month: number
  }

  customers: {
    total: number
  }

  products: {
    total: number
    available: number
    low_stock: number
    out_of_stock: number
  }

  sales: {
    total_sold_kg: number
    today_sold_kg: number
    month_sold_kg: number
  }

  recent_orders: DashboardRecentOrder[]

  top_products: DashboardTopProduct[]

  low_stock_products:
    DashboardLowStockProduct[]
}


export async function getDashboard(): Promise<DashboardData> {
  const response = await apiFetch(
    `${API_URL}/dashboard/`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  )

  if (!response.ok) {
    let message =
      'Dashboard maʼlumotlarini olishda xatolik'

    try {
      const data = await response.json()

      if (
        typeof data?.detail === 'string'
      ) {
        message = data.detail
      }
    } catch {
      // Standart xabar ishlatiladi.
    }

    throw new Error(message)
  }

  return response.json()
}
