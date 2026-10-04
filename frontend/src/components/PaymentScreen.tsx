import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, Copy, CreditCard, LoaderCircle, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { createHamyonPayment, getHamyonPayment, type HamyonPayment } from '../api/payments'

type Props = {
  orderId: number
  initialPayment: HamyonPayment
  onClose: () => void
}

function money(value: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(value))
}

function secondsLeft(expiresAt: string | null) {
  if (!expiresAt) return 0
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

export default function PaymentScreen({ orderId, initialPayment, onClose }: Props) {
  const [payment, setPayment] = useState(initialPayment)
  const [remaining, setRemaining] = useState(() => secondsLeft(initialPayment.expires_at))
  const [checking, setChecking] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(secondsLeft(payment.expires_at)), 1000)
    return () => window.clearInterval(timer)
  }, [payment.expires_at])

  const countdown = useMemo(() => `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`, [remaining])
  const isPaid = payment.status === 'PAID'
  const isReview = payment.status === 'PAID_REVIEW'
  const isClosed = ['CANCELLED', 'FAILED'].includes(payment.status) || remaining === 0

  async function copyCard() {
    if (!payment.card) return
    try {
      await navigator.clipboard.writeText(payment.card)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Karta raqamini nusxalab bo‘lmadi. Qo‘lda belgilang.')
    }
  }

  async function checkStatus() {
    setChecking(true)
    setError('')
    try {
      const current = await getHamyonPayment(payment.payment_id)
      setPayment(current)
      setRemaining(secondsLeft(current.expires_at))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Holatni tekshirib bo‘lmadi.')
    } finally {
      setChecking(false)
    }
  }

  async function retryPayment() {
    setRetrying(true)
    setError('')
    try {
      const next = await createHamyonPayment(orderId)
      setPayment(next)
      setRemaining(secondsLeft(next.expires_at))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yangi to‘lov yaratilmadi.')
    } finally {
      setRetrying(false)
    }
  }

  const statusText = isPaid
    ? 'To‘lov muvaffaqiyatli amalga oshdi'
    : isReview
      ? 'To‘lovni admin tekshiryapti'
      : isClosed
        ? 'To‘lov muddati tugadi'
        : payment.status === 'PROCESSING'
          ? 'To‘lov tekshirilmoqda'
          : 'To‘lov kutilmoqda'

  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center bg-[#160c0f]/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="payment-title">
      <section className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#f7ebdd] text-[#211116] shadow-[0_30px_100px_rgba(22,12,15,.45)] sm:rounded-[2rem]">
        <header className="sticky top-0 flex items-center justify-between border-b border-[#7a1028]/10 bg-[#f7ebdd]/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#7a1028]">Adrenalin Qazi · UZCARD</p>
            <h2 id="payment-title" className="mt-1 text-xl font-black">Buyurtma #{orderId} to‘lovi</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#7a1028]/[.07]" aria-label="Yopish"><X size={20} /></button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          <div className={`rounded-2xl border p-4 ${isPaid ? 'border-emerald-300 bg-emerald-50' : isReview ? 'border-amber-300 bg-amber-50' : 'border-[#7a1028]/15 bg-white/75'}`}>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7a1028] text-white">
                {isPaid ? <Check size={22} /> : isReview ? <ShieldCheck size={22} /> : <Clock3 size={22} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-black">{statusText}</p>
                <p className="text-sm text-[#604951]">Payment ID: <span className="break-all font-mono">{payment.payment_id}</span></p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] bg-gradient-to-br from-[#32151f] via-[#211116] to-[#120b0d] p-5 text-[#f7ebdd] shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_18px_35px_rgba(44,18,28,.28)]">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[.18em] text-[#c9a227]">
              <span>Adrenalin Qazi</span><CreditCard size={22} />
            </div>
            <p className="mt-8 text-xs uppercase tracking-[.16em] text-white/60">UZCARD · qabul qiluvchi karta</p>
            <div className="mt-2 flex items-center gap-3">
              <p className="flex-1 break-all font-mono text-xl font-bold tracking-[.12em] sm:text-2xl">{payment.card ?? 'Karta ma’lumoti yo‘q'}</p>
              <button type="button" onClick={() => void copyCard()} disabled={!payment.card} className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-bold disabled:opacity-40" aria-label="Karta raqamini nusxalash">
                {copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Nusxalandi' : 'Nusxalash'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#7a1028]/10 bg-white/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#725c61]">Buyurtma jami</p>
              <p className="mt-1 text-xl font-black">{money(payment.order_amount)} so‘m</p>
            </div>
            <div className="rounded-2xl border border-[#c9a227]/40 bg-[#c9a227]/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#725c61]">Kartaga aynan yuboring</p>
              <p className="mt-1 text-xl font-black">{money(payment.payment_amount)} so‘m</p>
            </div>
          </div>
          {payment.payment_amount !== payment.order_amount && (
            <p className="-mt-3 text-xs leading-5 text-[#725c61]">To‘lovlar bir-biridan ajralishi uchun Hamyon summani bir necha so‘mga farqlashi mumkin. Buyurtma narxi o‘zgarmaydi; kartaga yuqoridagi aniq summani yuboring.</p>
          )}

          {!isPaid && !isReview && !isClosed && (
            <div className="flex items-center justify-between rounded-2xl bg-[#7a1028]/[.06] px-4 py-3">
              <span className="text-sm font-semibold">To‘lovni yakunlash vaqti</span>
              <span className="font-mono text-xl font-black text-[#7a1028]">{countdown}</span>
            </div>
          )}

          <p className="text-center text-sm leading-6 text-[#604951]">Pul o‘tkazilgach Hamyon to‘lovni odatda 5–30 soniyada aniqlaydi. Holat avtomatik callback bilan yangilanadi; istasangiz quyidagi tugma bilan bir marta tekshiring.</p>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

          {isClosed ? (
            <button type="button" onClick={() => void retryPayment()} disabled={retrying} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#7a1028] px-5 py-3 font-black text-white shadow-lg disabled:opacity-50">
              {retrying ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />} Yangi to‘lov yaratish
            </button>
          ) : isPaid ? (
            <button type="button" onClick={onClose} className="min-h-12 w-full rounded-2xl bg-[#7a1028] px-5 py-3 font-black text-white">Davom etish</button>
          ) : (
            <button type="button" onClick={() => void checkStatus()} disabled={checking} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#7a1028] px-5 py-3 font-black text-white shadow-lg disabled:opacity-50">
              {checking ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />} To‘lov holatini tekshirish
            </button>
          )}
          {isReview && <p className="text-center text-sm text-amber-800">Mablag‘ni qayta yubormang. Buyurtma egasi to‘lovni tekshirib siz bilan bog‘lanadi.</p>}
        </div>
      </section>
    </div>
  )
}
