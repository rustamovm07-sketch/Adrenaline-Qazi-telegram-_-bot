import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PackagePlus, RefreshCw } from 'lucide-react'
import { createInventoryMovement, getInventoryMovements, type InventoryMovement } from '../api/inventory'
import { getProducts, type Product } from '../api/products'

function amount(value: number) {
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 3 }).format(value)
}

const movementLabels: Record<InventoryMovement['kind'], string> = {
  RECEIPT: 'Kirim', RETURN: 'Qaytarish', ADJUSTMENT: 'Qoldiq tuzatish', SALE: 'Sotuv',
}

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [productId, setProductId] = useState('')
  const [kind, setKind] = useState<'RECEIPT' | 'RETURN' | 'ADJUSTMENT'>('RECEIPT')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getProducts(), getInventoryMovements()]).then(([productRows, movementRows]) => {
      if (!active) return
      setProducts(productRows)
      setMovements(movementRows)
      if (productRows.length) setProductId(String(productRows[0].id))
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Ombor maʼlumotlari yuklanmadi.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const totals = useMemo(() => products.reduce((value, product) => ({
    products: value.products + 1,
    available: value.available + (product.available_stock_units > 0 ? 1 : 0),
    reserved: value.reserved + (product.reserved_stock_units > 0 ? 1 : 0),
  }), { products: 0, available: 0, reserved: 0 }), [products])

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const [productRows, movementRows] = await Promise.all([getProducts(), getInventoryMovements()])
      setProducts(productRows)
      setMovements(movementRows)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ombor maʼlumotlari yuklanmadi.')
    } finally {
      setLoading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const parsed = Number(quantity)
    if (!Number.isFinite(parsed) || parsed === 0) {
      setError('Miqdor noldan farqli son bo‘lishi kerak.')
      return
    }
    if (kind !== 'ADJUSTMENT' && parsed < 0) {
      setError('Kirim va qaytarish miqdori musbat bo‘lishi kerak.')
      return
    }
    setSaving(true)
    try {
      await createInventoryMovement({ product_id: Number(productId), kind, quantity_delta: parsed, note })
      setQuantity('')
      setNote('')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ombor harakati saqlanmadi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black">Ombor va qoldiq</h1><p className="mt-1 text-sm text-gray-500">Kirim, qaytarish, qo‘lda tuzatish va tasdiqlangan sotuvlar tarixi.</p></div><button type="button" onClick={() => void refresh()} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"><RefreshCw size={16} />Yangilash</button></header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-3">{[['Mahsulotlar', totals.products], ['Sotuvga ochiq mahsulotlar', totals.available], ['Band qilingan mahsulotlar', totals.reserved]].map(([label, value]) => <article key={String(label)} className="rounded-2xl border bg-white p-5"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>)}</div>
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-5">
        <label className="text-sm font-semibold">Mahsulot<select required value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Harakat<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="mt-2 min-h-11 w-full rounded-xl border px-3"><option value="RECEIPT">Kirim</option><option value="RETURN">Qaytarilgan</option><option value="ADJUSTMENT">Qoldiqni tuzatish</option></select></label>
        <label className="text-sm font-semibold">Miqdor<input required type="number" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={kind === 'ADJUSTMENT' ? '+/- miqdor' : 'Musbat miqdor'} className="mt-2 min-h-11 w-full rounded-xl border px-3" /></label>
        <label className="text-sm font-semibold md:col-span-1">Izoh<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className="mt-2 min-h-11 w-full rounded-xl border px-3" placeholder="Masalan: yangi partiya" /></label>
        <button disabled={saving || products.length === 0} className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#a77a2d] px-4 font-bold text-white disabled:opacity-50"><PackagePlus size={17} />{saving ? 'Saqlanmoqda...' : 'Harakatni saqlash'}</button>
      </form>
      <div className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-black">Harakatlar tarixi</h2><p className="mt-1 text-xs text-gray-500">Eng so‘nggi 250 yozuv.</p></div>{loading ? <p className="p-8 text-center text-gray-500">Yuklanmoqda...</p> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Sana</th><th className="px-5 py-3">Mahsulot</th><th className="px-5 py-3">Turi</th><th className="px-5 py-3">O‘zgarish</th><th className="px-5 py-3">Izoh</th><th className="px-5 py-3">Buyurtma</th></tr></thead><tbody className="divide-y">{movements.map((movement) => <tr key={movement.id}><td className="px-5 py-3">{new Date(movement.created_at).toLocaleString('uz-UZ')}</td><td className="px-5 py-3 font-semibold">{movement.product_name}</td><td className="px-5 py-3">{movementLabels[movement.kind]}</td><td className={`px-5 py-3 font-bold ${movement.quantity_delta < 0 ? 'text-red-700' : 'text-green-700'}`}>{movement.quantity_delta > 0 ? '+' : ''}{amount(Number(movement.quantity_delta))} {movement.unit_type}</td><td className="px-5 py-3">{movement.note ?? '-'}</td><td className="px-5 py-3">{movement.order_id ? `#${movement.order_id}` : '-'}</td></tr>)}</tbody></table>{movements.length === 0 && <p className="p-8 text-center text-gray-500">Hozircha ombor harakati yo‘q.</p>}</div>}</div>
    </section>
  )
}
