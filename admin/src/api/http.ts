export type TelegramWebApp = {
  initData: string
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  const initData = window.Telegram?.WebApp?.initData ?? ''

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
