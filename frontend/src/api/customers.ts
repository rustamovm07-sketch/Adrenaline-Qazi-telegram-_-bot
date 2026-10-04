import { apiFetch } from './telegram'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  window.location.origin

export function getCustomerImageUrl(
  image: string | null,
): string | null {
  if (!image?.trim()) {
    return null
  }

  const normalized = image.trim()
  if (/^(https?:\/\/|data:|blob:)/i.test(normalized)) {
    return normalized
  }
  return `${API_BASE_URL.replace(/\/+$/, '')}/${normalized.replace(/^\/+/, '')}`
}

/* ============================================================
   TYPES
   ============================================================ */

export interface CustomerProfile {
  id: number
  telegram_id: number | null

  name: string
  surname: string | null
  phone: string

  profile_image: string | null

  latitude: number | null
  longitude: number | null
  accuracy: number | null

  address: string | null
  landmark: string | null

  profile_completed: boolean

  created_at?: string
  updated_at?: string
}

export interface CustomerProfileCreate {
  telegram_id?: number

  name: string
  surname: string

  phone: string

  profile_image?: string | null

  latitude?: number | null
  longitude?: number | null
  accuracy?: number | null

  address?: string | null
  landmark?: string | null
}

export interface CustomerProfileUpdate {
  name?: string
  surname?: string

  phone?: string

  profile_image?: string | null

  latitude?: number | null
  longitude?: number | null
  accuracy?: number | null

  address?: string | null
  landmark?: string | null
}

/* ============================================================
   ERROR HANDLER
   ============================================================ */

async function parseResponse<T>(
  response: Response,
): Promise<T> {
  const contentType =
    response.headers.get('content-type') || ''

  const isJson =
    contentType.includes('application/json')

  const data = isJson
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    let message = 'Serverda xatolik yuz berdi.'

    if (typeof data === 'string' && data.trim()) {
      message = data
    }

    if (
      typeof data === 'object' &&
      data !== null
    ) {
      if (
        'detail' in data &&
        typeof data.detail === 'string'
      ) {
        message = data.detail
      }
    }

    throw new Error(message)
  }

  return data as T
}

/* ============================================================
   GET CUSTOMER PROFILE
   ============================================================ */

export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const response = await apiFetch(
    `${API_BASE_URL}/customers/profile/me`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    },
  )

  const result = await parseResponse<{
    exists: boolean
    profile_completed: boolean
    profile: CustomerProfile | null
  }>(response)
  return result.profile
}

/* ============================================================
   CREATE CUSTOMER PROFILE
   ============================================================ */

export async function createCustomerProfile(
  data: CustomerProfileCreate,
): Promise<CustomerProfile> {
  const response = await apiFetch(
    `${API_BASE_URL}/customers/profile`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    },
  )

  const result = await parseResponse<{
    success: boolean
    profile: CustomerProfile
  }>(response)
  return result.profile
}

/* ============================================================
   UPDATE CUSTOMER PROFILE
   ============================================================ */

export async function updateCustomerProfile(
  telegramId: number | undefined,
  data: CustomerProfileUpdate,
): Promise<CustomerProfile> {
  if (telegramId !== undefined && (!Number.isInteger(telegramId) || telegramId <= 0)) {
    throw new Error('Telegram ID noto‘g‘ri.')
  }

  const response = await apiFetch(
    `${API_BASE_URL}/customers/profile/${telegramId ?? 'me'}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    },
  )

  const result = await parseResponse<{
    success: boolean
    profile: CustomerProfile
  }>(response)
  return result.profile
}

export async function uploadCustomerProfileImage(
  file: File,
): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)

  const response = await apiFetch(
    `${API_BASE_URL}/customers/profile/image`,
    {
      method: 'POST',
      body: formData,
    },
  )
  const result = await parseResponse<{ image_url: string }>(response)
  return result.image_url
}
