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
  const accessToken = await getMiniAppAccessToken()
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const response = await fetch(input, {
    ...init,
    headers,
  })
  if (response.status !== 401 || !accessToken) return response

  invalidateMiniAppAccessToken(accessToken)
  const renewedToken = await getMiniAppAccessToken()
  if (!renewedToken || renewedToken === accessToken) return response
  headers.set('Authorization', `Bearer ${renewedToken}`)
  return fetch(input, { ...init, headers })
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, '')
let cachedAccessToken = ''
let cachedAccessTokenExpiresAt = 0
let sessionRequest: Promise<string> | null = null

async function getMiniAppAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 30_000) return cachedAccessToken
  const initData = window.Telegram?.WebApp?.initData ?? ''
  if (!initData) return ''
  if (!sessionRequest) {
    sessionRequest = fetch(`${API_BASE_URL}/auth/session`, {
      method: 'POST',
      headers: { Authorization: `tma ${initData}`, Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) return ''
        const session = (await response.json()) as { access_token?: string; expires_in?: number }
        if (!session.access_token) return ''
        cachedAccessToken = session.access_token
        cachedAccessTokenExpiresAt = Date.now() + Math.max(0, Number(session.expires_in ?? 0)) * 1000
        return cachedAccessToken
      })
      .catch(() => '')
      .finally(() => { sessionRequest = null })
  }
  return sessionRequest
}

function invalidateMiniAppAccessToken(token: string) {
  if (cachedAccessToken !== token) return
  cachedAccessToken = ''
  cachedAccessTokenExpiresAt = 0
}
