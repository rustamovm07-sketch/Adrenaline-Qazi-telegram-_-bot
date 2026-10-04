import { apiFetch } from './http'

const API_URL = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, '')

export type StoreSettings = {
  id: number
  shop_name: string
  support_phone: string | null
  support_telegram: string | null
  store_address: string | null
  latitude: number | null
  longitude: number | null
  shop_image_url: string | null
  guide_text: string
  terms_text: string
  updates_text: string
}

export type StoreSettingsUpdate = Omit<StoreSettings, 'id'>

async function requestSettings(response: Response): Promise<StoreSettings> {
  if (!response.ok) {
    let message = 'Do\'kon sozlamalarini saqlashda xatolik.'
    try {
      const data = await response.json() as { detail?: unknown }
      if (typeof data.detail === 'string') message = data.detail
    } catch {
      // JSON bo'lmagan xatoga umumiy matn ishlatamiz.
    }
    throw new Error(message)
  }
  return await response.json() as StoreSettings
}

export async function getStoreSettings(): Promise<StoreSettings> {
  return requestSettings(await apiFetch(`${API_URL}/store-settings/`))
}

export async function updateStoreSettings(
  settings: StoreSettingsUpdate,
): Promise<StoreSettings> {
  return requestSettings(await apiFetch(`${API_URL}/store-settings/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  }))
}

export async function uploadStoreImage(image: File): Promise<StoreSettings> {
  const body = new FormData()
  body.append('image', image)
  return requestSettings(await apiFetch(`${API_URL}/store-settings/image`, {
    method: 'POST',
    body,
  }))
}

export function getStoreImageUrl(image: string | null): string | null {
  if (!image) return null
  if (/^https?:\/\//i.test(image)) return image
  return `${API_URL}/${image.replace(/^\/+/, '')}`
}
