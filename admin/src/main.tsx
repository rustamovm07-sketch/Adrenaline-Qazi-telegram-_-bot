import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const telegramWebApp = window.Telegram?.WebApp
telegramWebApp?.ready()
telegramWebApp?.expand()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {telegramWebApp?.initData ? (
      <App />
    ) : (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f3ed] p-6 text-center text-[#17130e]">
        <section className="max-w-md rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-black">Adrenalin Qazi Admin</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Admin panelga kirish uchun Telegram botdagi Admin panel tugmasidan, loyiha egasi akkaunti bilan foydalaning.
          </p>
        </section>
      </main>
    )}
  </StrictMode>,
)
