import {
  useEffect,
  useState,
} from 'react'

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'

import {
  getDashboard,
  type DashboardData,
} from '../api/dashboard'


function formatPrice(
  value: number,
) {
  return new Intl.NumberFormat(
    'uz-UZ',
  ).format(value)
}


function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'uz-UZ',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(new Date(value))
}


function statusLabel(status: string) {
  const labels: Record<string, string> = {
    NEW: 'Yangi', PAYMENT_PENDING: "To'lov kutilmoqda", PAID: "To'langan",
    CONFIRMED: 'Tasdiqlangan', PREPARING: 'Tayyorlanmoqda', READY: 'Tayyor',
    DELIVERING: 'Yetkazilmoqda', DELIVERED: 'Yetkazildi', CANCELLED: 'Bekor qilindi',
  }
  return labels[status] ?? status
}

function statusClass(status: string) {
  const classes: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-700', PAYMENT_PENDING: 'bg-amber-100 text-amber-700',
    PAID: 'bg-green-100 text-green-700', CONFIRMED: 'bg-cyan-100 text-cyan-700',
    PREPARING: 'bg-orange-100 text-orange-700', READY: 'bg-purple-100 text-purple-700',
    DELIVERING: 'bg-orange-100 text-orange-700', DELIVERED: 'bg-purple-100 text-purple-700',
    CANCELLED: 'bg-red-100 text-red-700',
  }
  return classes[status] ?? 'bg-gray-100 text-gray-700'
}


type StatCardProps = {
  title: string
  value: string
  description: string
  icon: React.ReactNode
}


function StatCard({
  title,
  value,
  description,
  icon,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-black text-gray-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#c49a4b]/15 text-[#a87927]">
          {icon}
        </div>
      </div>
    </div>
  )
}


export default function Dashboard() {
  const [data, setData] =
    useState<DashboardData | null>(
      null,
    )

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState('')


  async function loadDashboard(
    initial = false,
  ) {
    try {
      if (initial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError('')

      const result =
        await getDashboard()

      setData(result)
    } catch (err) {
      console.error(err)

      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(
          'Dashboard maʼlumotlarini yuklashda xatolik',
        )
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }


  useEffect(() => {
    // Initial data is loaded asynchronously from the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard(true)
  }, [])


  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2
            size={24}
            className="animate-spin"
          />

          Dashboard yuklanmoqda...
        </div>
      </div>
    )
  }


  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="font-bold text-red-700">
          {error ||
            'Dashboard maʼlumotlari mavjud emas'}
        </p>

        <button
          type="button"
          onClick={() =>
            loadDashboard(true)
          }
          className="mt-4 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white"
        >
          Qayta urinish
        </button>
      </div>
    )
  }


  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Adrenalin Qazi biznesining
            umumiy holati
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            loadDashboard(false)
          }
          disabled={refreshing}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? 'animate-spin'
                : ''
            }
          />

          Yangilash
        </button>
      </div>


      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}


      {/* MAIN STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Bugungi tushum"
          value={`${formatPrice(
            data.revenue.today,
          )} so‘m`}
          description={`${data.orders.today} ta bugungi buyurtma`}
          icon={
            <Wallet size={22} />
          }
        />

        <StatCard
          title="Oylik tushum"
          value={`${formatPrice(
            data.revenue.month,
          )} so‘m`}
          description={`${data.orders.month} ta oylik buyurtma`}
          icon={
            <TrendingUp size={22} />
          }
        />

        <StatCard
          title="Mijozlar"
          value={String(
            data.customers.total,
          )}
          description="Ro‘yxatdan o‘tgan mijozlar"
          icon={
            <Users size={22} />
          }
        />

        <StatCard
          title="Mahsulotlar"
          value={String(
            data.products.total,
          )}
          description={`${data.products.available} ta sotuvda`}
          icon={
            <Package size={22} />
          }
        />
      </div>


      {/* SALES + ORDERS */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* ORDERS */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-gray-900">
                Buyurtmalar
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                Hozirgi holat
              </p>
            </div>

            <ShoppingBag
              size={21}
              className="text-[#b08031]"
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs text-blue-600">
                Yangi
              </p>

              <p className="mt-1 text-2xl font-black text-blue-700">
                {data.orders.new}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs text-green-600">
                To‘langan
              </p>

              <p className="mt-1 text-2xl font-black text-green-700">
                {data.orders.paid}
              </p>
            </div>

            <div className="rounded-xl bg-orange-50 p-4">
              <p className="text-xs text-orange-600">
                Yetkazilmoqda
              </p>

              <p className="mt-1 text-2xl font-black text-orange-700">
                {data.orders.delivering}
              </p>
            </div>

            <div className="rounded-xl bg-purple-50 p-4">
              <p className="text-xs text-purple-600">
                Yetkazildi
              </p>

              <p className="mt-1 text-2xl font-black text-purple-700">
                {data.orders.delivered}
              </p>
            </div>
          </div>
        </div>


        {/* SALES */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-gray-900">
                Sotuv
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                Faqat tasdiqlangan to‘lovlar
              </p>
            </div>

            <BarChart3
              size={21}
              className="text-[#b08031]"
            />
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
              <span className="text-sm text-gray-500">
                Bugun
              </span>

              <span className="font-black">
                {data.sales.today_sold_kg.toFixed(
                  2,
                )}{' '}
                kg
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
              <span className="text-sm text-gray-500">
                Shu oy
              </span>

              <span className="font-black">
                {data.sales.month_sold_kg.toFixed(
                  2,
                )}{' '}
                kg
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-[#c49a4b]/10 p-4">
              <span className="text-sm font-bold">
                Jami sotilgan
              </span>

              <span className="font-black text-[#9a712d]">
                {data.sales.total_sold_kg.toFixed(
                  2,
                )}{' '}
                kg
              </span>
            </div>
          </div>
        </div>
      </div>


      {/* STOCK */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Jami mahsulot"
          value={String(
            data.products.total,
          )}
          description="Barcha mahsulotlar"
          icon={
            <Package size={22} />
          }
        />

        <StatCard
          title="Sotuvda"
          value={String(
            data.products.available,
          )}
          description="Faol mahsulotlar"
          icon={
            <CheckCircle2 size={22} />
          }
        />

        <StatCard
          title="Kam stock"
          value={String(
            data.products.low_stock,
          )}
          description="10 birlikdan kam"
          icon={
            <AlertTriangle
              size={22}
            />
          }
        />

        <StatCard
          title="Stock tugagan"
          value={String(
            data.products.out_of_stock,
          )}
          description="Qayta to‘ldirish kerak"
          icon={
            <Truck size={22} />
          }
        />
      </div>


      {/* BOTTOM */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* RECENT ORDERS */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 p-5">
            <div>
              <h2 className="font-black">
                So‘nggi buyurtmalar
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                Oxirgi 8 ta buyurtma
              </p>
            </div>

            <Clock3
              size={20}
              className="text-[#b08031]"
            />
          </div>

          <div className="divide-y divide-gray-100">
            {data.recent_orders
              .length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                Hozircha buyurtmalar
                mavjud emas.
              </div>
            ) : (
              data.recent_orders.map(
                (order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black">
                          #{order.id}
                        </span>

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(
                            order.status,
                          )}`}
                        >
                          {statusLabel(
                            order.status,
                          )}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm text-gray-600">
                        {order.customer_name}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {formatDate(
                          order.created_at,
                        )}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-black">
                        {formatPrice(
                          order.total,
                        )}{' '}
                        so‘m
                      </p>

                      <p
                        className={`mt-1 text-[11px] font-bold ${
                          order.payment_confirmed
                            ? 'text-green-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {order.payment_confirmed
                          ? 'To‘langan'
                          : 'Kutilmoqda'}
                      </p>
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </div>


        {/* TOP PRODUCTS */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 p-5">
            <div>
              <h2 className="font-black">
                Top mahsulotlar
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                Sotilgan kg bo‘yicha
              </p>
            </div>

            <TrendingUp
              size={20}
              className="text-[#b08031]"
            />
          </div>

          <div className="divide-y divide-gray-100">
            {data.top_products
              .length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                Hali tasdiqlangan
                sotuvlar yo‘q.
              </div>
            ) : (
              data.top_products.map(
                (
                  product,
                  index,
                ) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 p-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c49a4b]/15 text-sm font-black text-[#9a712d]">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">
                        {product.name}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {product.sold_kg.toFixed(
                          2,
                        )}{' '}
                        kg sotilgan
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-black">
                      {formatPrice(
                        product.revenue,
                      )}{' '}
                      so‘m
                    </p>
                  </div>
                ),
              )
            )}
          </div>
        </div>
      </div>


      {/* LOW STOCK */}
      {data.low_stock_products
        .length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 shadow-sm">
          <div className="flex items-center gap-3 border-b border-orange-200 p-5">
            <AlertTriangle
              size={21}
              className="text-orange-600"
            />

            <div>
              <h2 className="font-black text-orange-900">
                Stock nazorati
              </h2>

              <p className="mt-1 text-xs text-orange-700">
                Tez orada tugashi mumkin
                bo‘lgan mahsulotlar
              </p>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.low_stock_products.map(
              (product) => (
                <div
                  key={product.id}
                  className="rounded-xl bg-white p-4"
                >
                  <p className="truncate font-bold">
                    {product.name}
                  </p>

                  <p className="mt-2 text-sm text-orange-700">
                    {product.stock_units}{' '}
                    {product.unit_type}
                  </p>

                  {product.unit_type ===
                    'dona' && (
                    <p className="mt-1 text-xs text-gray-400">
                      ≈{' '}
                      {(
                        product.stock_units *
                        product.weight_per_unit
                      ).toFixed(2)}{' '}
                      kg
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}
