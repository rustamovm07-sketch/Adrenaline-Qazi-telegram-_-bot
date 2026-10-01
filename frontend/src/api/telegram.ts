export type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

export type TelegramWebApp = {
  initData: string
  initDataUnsafe?: { user?: TelegramUser }
  ready: () => void
  expand: () => void
  close: () => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null
}

export function getTelegramInitData(): string {
  return getTelegramWebApp()?.initData ?? ''
}

export function getTelegramUser(): TelegramUser | null {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  const initData = getTelegramInitData()

  if (initData) {
    headers.set('Authorization', `tma ${initData}`)
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  return fetch(input, {
    ...init,
    headers,
  })
}
