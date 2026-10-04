import { useEffect, useState } from 'react'
import { CreditCard, RefreshCw } from 'lucide-react'
import { apiFetch } from '../api/http'

type Payment = {
  id: number; order_id: number; provider: string; provider_payment_id: string | null
  amount: number; provider_amount: number; currency: string; status: string
  created_at: string; expires_at: string | null; paid_at: string | null
}
const API_URL = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, '')
const money = (value: number) => `${new Intl.NumberFormat('uz-UZ').format(Math.round(value))} so‘m`

export default function Payments() {
  const [rows, setRows] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load() {
    setLoading(true); setError('')
    try {
      const response = await apiFetch(`${API_URL}/payments/`)
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || 'To‘lovlar yuklanmadi.')
      setRows(await response.json() as Payment[])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'To‘lovlar yuklanmadi.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  return <section className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#7a1028]">HAMYON · UZCARD</p><h1 className="mt-1 text-3xl font-black">To‘lovlar</h1><p className="mt-2 text-sm text-gray-500">Hamyon callback orqali tasdiqlangan to‘lovlar va holatlari.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#7a1028] px-4 font-bold text-white disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Yangilash</button>
    </header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm">
      {loading ? <p className="p-6 text-sm text-gray-500">Yuklanmoqda...</p> : rows.length === 0 ? <div className="p-10 text-center"><CreditCard className="mx-auto text-[#7a1028]"/><p className="mt-3 font-bold">Hozircha to‘lovlar yo‘q</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#f8f3ee] text-xs uppercase tracking-wide text-gray-500"><tr>{['Buyurtma','Provayder / ID','Buyurtma summasi','Kartaga yuborilgan','Holat','Sana'].map(x => <th key={x} className="px-5 py-4">{x}</th>)}</tr></thead><tbody>{rows.map(p => <tr key={p.id} className="border-t border-gray-100"><td className="px-5 py-4 font-black">#{p.order_id}</td><td className="px-5 py-4"><span className="font-bold uppercase">{p.provider}</span><p className="mt-1 max-w-[220px] break-all font-mono text-xs text-gray-500">{p.provider_payment_id ?? '—'}</p></td><td className="px-5 py-4 font-bold">{money(p.amount)}</td><td className="px-5 py-4">{money(p.provider_amount)}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${p.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : p.status === 'PAID_REVIEW' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}>{p.status}</span></td><td className="px-5 py-4 text-gray-600">{new Intl.DateTimeFormat('uz-UZ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(p.paid_at ?? p.created_at))}</td></tr>)}</tbody></table></div>}
    </div>
    <p className="text-xs leading-5 text-gray-500">PAID_REVIEW holati summa yoki buyurtma ma’lumotlari avtomatik mos kelmaganida belgilanadi. Bunday to‘lovni buyurtmani tekshirmaguncha yana qabul qilmang.</p>
  </section>
}
