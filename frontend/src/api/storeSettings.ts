const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

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

export async function getPublicStoreSettings(): Promise<StoreSettings> {
  const response = await fetch(`${API_URL}/store-settings/public`)
  if (!response.ok) throw new Error('Do\'kon sozlamalarini yuklab bo\'lmadi.')
  return await response.json() as StoreSettings
}

export function getStoreImageUrl(image: string | null): string | null {
  if (!image?.trim()) return null
  if (/^https?:\/\//i.test(image)) return image
  return `${API_URL}/${image.trim().replace(/^\/+/, '')}`
}
