import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { getOrders, type Order } from '../api/orders'
import { getProducts } from '../api/products'

type Period = 'today' | 'week' | 'month' | 'all'

function money(value: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(value))
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export default function Reports() {
  const [orders, setOrders] = useState<Order[]>([])
  const [productNames, setProductNames] = useState<Record<number, string>>({})
  const [period, setPeriod] = useState<Period>('month')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [orderRows, products] = await Promise.all([getOrders(), getProducts()])
      setOrders(orderRows)
      setProductNames(Object.fromEntries(products.map((product) => [product.id, product.name])))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hisobot yuklanmadi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([getOrders(), getProducts()]).then(([result, products]) => {
      if (active) {
        setOrders(result)
        setProductNames(Object.fromEntries(products.map((product) => [product.id, product.name])))
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Hisobot yuklanmadi.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (period === 'week') start.setDate(start.getDate() - 6)
    if (period === 'month') start.setDate(1)
    return orders.filter((order) => period === 'all' || new Date(order.created_at) >= start)
  }, [orders, period])

  const paid = filtered.filter((order) => order.payment_confirmed)
  const revenue = paid.reduce((sum, order) => sum + Number(order.total), 0)
  const lines = filtered.flatMap((order) => order.items.map((item) => ({ order, item })))
  const productCount = new Set(lines.map(({ item }) => item.product_id)).size
  const salesByProduct = paid.flatMap((order) => order.items.map((item) => ({ order, item }))).reduce((sales, row) => {
    const current = sales.get(row.item.product_id) ?? { quantity: 0, weight: 0, revenue: 0 }
    current.quantity += Number(row.item.quantity)
    current.weight += Number(row.item.weight_kg)
    current.revenue += Number(row.item.subtotal)
    sales.set(row.item.product_id, current)
    return sales
  }, new Map<number, { quantity: number; weight: number; revenue: number }>())
  const salesByCustomer = paid.reduce((sales, order) => {
    const name = order.customer?.name ?? `Mijoz #${order.customer_id}`
    const current = sales.get(order.customer_id) ?? { name, orders: 0, revenue: 0 }
    current.orders += 1
    current.revenue += Number(order.total)
    sales.set(order.customer_id, current)
    return sales
  }, new Map<number, { name: string; orders: number; revenue: number }>())

  function exportCsv() {
    const header = ['Buyurtma ID', 'Sana', 'Mijoz', 'Telefon', 'Mahsulot ID', 'Mahsulot', 'Miqdor', 'Birlik', "Og'irlik (kg)", 'Narx', 'Qator jami', 'Buyurtma jami', 'Holat', "To'lov tasdiqlangan"]
    const rows = lines.map(({ order, item }) => [
      order.id,
      new Date(order.created_at).toLocaleString('uz-UZ'),
      order.customer?.name ?? `Mijoz #${order.customer_id}`,
      order.delivery_phone ?? order.customer?.phone ?? '',
      item.product_id,
      productNames[item.product_id] ?? `Mahsulot #${item.product_id}`,
      item.quantity,
      item.quantity_unit,
      item.weight_kg,
      item.price,
      item.subtotal,
      order.total,
      order.status,
      order.payment_confirmed ? 'Ha' : "Yo'q",
    ])
    const content = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `adrenalin-qazi-hisobot-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-black">Savdo hisobotlari</h1><p className="mt-1 text-sm text-gray-500">Buyurtmalar, to'lovlar va mahsulot qatorlari bo'yicha.</p></div>
        <div className="flex gap-2">
          <select aria-label="Hisobot davri" value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="today">Bugun</option><option value="week">Oxirgi 7 kun</option><option value="month">Shu oy</option><option value="all">Barcha vaqt</option>
          </select>
          <button type="button" onClick={() => void load()} className="rounded-xl border bg-white p-2" aria-label="Yangilash"><RefreshCw size={18} /></button>
          <button type="button" disabled={loading || lines.length === 0} onClick={exportCsv} className="flex items-center gap-2 rounded-xl bg-[#a77a2d] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Download size={17} /> CSV / Excel</button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {loading ? <p className="rounded-2xl bg-white p-8 text-center text-gray-500">Hisobot yuklanmoqda...</p> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[['Buyurtmalar', filtered.length], ["To'langan buyurtmalar", paid.length], ['Tasdiqlangan tushum', `${money(revenue)} so'm`], ['Sotilgan mahsulot turi', productCount]].map(([label, value]) => <article key={String(label)} className="rounded-2xl border bg-white p-5"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>)}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-black">Mahsulotlar bo'yicha sotuv</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Mahsulot</th><th className="px-4 py-3">Kg</th><th className="px-4 py-3">Tushum</th></tr></thead><tbody className="divide-y">{Array.from(salesByProduct, ([id, sale]) => <tr key={id}><td className="px-4 py-3">{productNames[id] ?? `Mahsulot #${id}`}</td><td className="px-4 py-3">{sale.weight.toFixed(3)}</td><td className="px-4 py-3">{money(sale.revenue)} so'm</td></tr>)}</tbody></table>{salesByProduct.size === 0 && <p className="p-5 text-sm text-gray-500">Tasdiqlangan sotuv ma'lumoti yo'q.</p>}</div></div>
          <div className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-black">Mijozlar bo'yicha xarid</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Mijoz</th><th className="px-4 py-3">Buyurtmalar</th><th className="px-4 py-3">Jami</th></tr></thead><tbody className="divide-y">{Array.from(salesByCustomer, ([id, sale]) => <tr key={id}><td className="px-4 py-3">{sale.name}</td><td className="px-4 py-3">{sale.orders}</td><td className="px-4 py-3">{money(sale.revenue)} so'm</td></tr>)}</tbody></table>{salesByCustomer.size === 0 && <p className="p-5 text-sm text-gray-500">Tasdiqlangan xarid ma'lumoti yo'q.</p>}</div></div>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-white">
          <div className="border-b px-5 py-4"><h2 className="font-black">Davr ichidagi buyurtmalar</h2><p className="mt-1 text-xs text-gray-500">Tushumga faqat payment callback bilan tasdiqlangan buyurtmalar qo'shiladi.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Buyurtma</th><th className="px-5 py-3">Mijoz</th><th className="px-5 py-3">Sana</th><th className="px-5 py-3">Holat</th><th className="px-5 py-3">Jami</th></tr></thead><tbody className="divide-y">{filtered.map((order) => <tr key={order.id}><td className="px-5 py-3 font-bold">#{order.id}</td><td className="px-5 py-3">{order.customer?.name ?? `Mijoz #${order.customer_id}`}</td><td className="px-5 py-3">{new Date(order.created_at).toLocaleDateString('uz-UZ')}</td><td className="px-5 py-3">{order.status}{order.payment_confirmed ? " - To'lov tasdiqlangan" : ''}</td><td className="px-5 py-3">{money(Number(order.total))} so'm</td></tr>)}</tbody></table></div>
          {filtered.length === 0 && <p className="p-8 text-center text-gray-500">Tanlangan davrda buyurtma topilmadi.</p>}
        </div>
      </>}
    </section>
  )
}

