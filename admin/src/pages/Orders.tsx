import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Truck,
  X,
  CreditCard,
  AlertCircle,
} from 'lucide-react'

import {
  fetchOrderDeliveryImage,
  getOrders,
  updateOrderDelivery,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from '../api/orders'

function formatPrice(
  value: number,
) {
  return new Intl.NumberFormat(
    'uz-UZ',
  ).format(
    Math.round(value),
  )
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'uz-UZ',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(
    new Date(value),
  )
}

function getStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    NEW: 'Yangi', PAYMENT_PENDING: "To'lov kutilmoqda", PAID: "To'langan",
    CONFIRMED: 'Tasdiqlangan', PREPARING: 'Tayyorlanmoqda', READY: 'Tayyor',
    DELIVERING: 'Yetkazilmoqda', DELIVERED: 'Yetkazildi', CANCELLED: 'Bekor qilindi',
  }
  return labels[status]
}

function getStatusClass(status: OrderStatus) {
  const classes: Record<OrderStatus, string> = {
    NEW: 'bg-blue-50 text-blue-700', PAYMENT_PENDING: 'bg-amber-50 text-amber-700',
    PAID: 'bg-emerald-50 text-emerald-700', CONFIRMED: 'bg-cyan-50 text-cyan-700',
    PREPARING: 'bg-orange-50 text-orange-700', READY: 'bg-purple-50 text-purple-700',
    DELIVERING: 'bg-orange-50 text-orange-700', DELIVERED: 'bg-green-50 text-green-700',
    CANCELLED: 'bg-red-50 text-red-700',
  }
  return classes[status]
}

function getStatusIcon(status: OrderStatus): ReactNode {
  if (status === 'CANCELLED') return <X size={15} />
  if (status === 'PAYMENT_PENDING') return <CreditCard size={15} />
  if (status === 'DELIVERING') return <Truck size={15} />
  if (status === 'NEW') return <Package size={15} />
  return <CheckCircle2 size={15} />
}

function getPaymentLabel(
  order: Order,
) {
  if (
    order.payment_confirmed
  ) {
    return order.payment_method
      ? `To‘langan • ${order.payment_method}`
      : 'To‘lov tasdiqlangan'
  }

  return 'To‘lov kutilmoqda'
}

function getPaymentClass(
  order: Order,
) {
  if (
    order.payment_confirmed
  ) {
    return 'text-emerald-700 bg-emerald-50'
  }

  return 'text-amber-700 bg-amber-50'
}

function getDeliveryDateInput(
  value: string | null,
) {
  if (!value) {
    return ''
  }

  return value.slice(
    0,
    10,
  )
}

function getDeliveryTimeInput(
  value: string | null,
) {
  if (!value) {
    return ''
  }

  return value.slice(
    0,
    5,
  )
}

function Orders() {
  const [
    orders,
    setOrders,
  ] = useState<Order[]>([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState('')

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    'ALL' | OrderStatus
  >('ALL')

  const [
    selectedOrder,
    setSelectedOrder,
  ] = useState<Order | null>(
    null,
  )

  const [deliveryImage, setDeliveryImage] = useState<{
    source: string
    url: string | null
    error: boolean
  } | null>(null)

  useEffect(() => {
    const source = selectedOrder?.delivery_image_url
    if (!source) return
    let disposed = false
    let objectUrl: string | null = null
    void fetchOrderDeliveryImage(source)
      .then((url) => {
        objectUrl = url
        if (disposed) {
          URL.revokeObjectURL(url)
          return
        }
        setDeliveryImage({ source, url, error: false })
      })
      .catch(() => {
        if (!disposed) setDeliveryImage({ source, url: null, error: true })
      })
    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedOrder?.delivery_image_url])

  const [
    updatingStatusId,
    setUpdatingStatusId,
  ] = useState<
    number | null
  >(null)

  const [
    savingDelivery,
    setSavingDelivery,
  ] = useState(false)

  const [
    deliveryDate,
    setDeliveryDate,
  ] = useState('')

  const [
    deliveryTime,
    setDeliveryTime,
  ] = useState('')

  async function loadOrders() {
    try {
      setLoading(true)
      setError('')

      const data =
        await getOrders()

      setOrders(data)
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Buyurtmalarni yuklashda xatolik',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial data is loaded asynchronously from the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders()
  }, [])

  const filteredOrders =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      return orders.filter(
        (order) => {
          const matchesStatus =
            statusFilter ===
              'ALL' ||
            order.status ===
              statusFilter

          if (!matchesStatus) {
            return false
          }

          if (!query) {
            return true
          }

          const searchable =
            [
              String(order.id),
              String(
                order.customer_id,
              ),
              order.address ??
                '',
              order.comment ??
                '',
              order.payment_method ??
                '',
              ...order.items.map(
                (item) =>
                  String(
                    item.product_id,
                  ),
              ),
            ]
              .join(' ')
              .toLowerCase()

          return searchable.includes(
            query,
          )
        },
      )
    }, [
      orders,
      search,
      statusFilter,
    ])

  const statistics =
    useMemo(() => {
      const total =
        orders.length

      const newOrders =
        orders.filter(
          (order) =>
            ['NEW', 'PAYMENT_PENDING'].includes(order.status),
        ).length

      const paidOrders =
        orders.filter(
          (order) =>
            order.status ===
            'PAID',
        ).length

      const delivering =
        orders.filter(
          (order) =>
            order.status ===
            'DELIVERING',
        ).length

      const delivered =
        orders.filter(
          (order) =>
            order.status ===
            'DELIVERED',
        ).length

      const paidRevenue =
        orders
          .filter(
            (order) =>
              order.payment_confirmed,
          )
          .reduce(
            (sum, order) =>
              sum +
              Number(
                order.total,
              ),
            0,
          )

      return {
        total,
        newOrders,
        paidOrders,
        delivering,
        delivered,
        paidRevenue,
      }
    }, [orders])

  async function handleStatusChange(
    order: Order,
    status: OrderStatus,
  ) {
    if (
      order.status === status
    ) {
      return
    }

    /*
     * PAID faqat payment_confirmed
     * bo'lsa backend tomonidan
     * qabul qilinadi.
     */
    if (
      status === 'PAID' &&
      !order.payment_confirmed
    ) {
      alert(
        'Bu buyurtma uchun haqiqiy to‘lov hali tasdiqlanmagan.',
      )
      return
    }

    try {
      setUpdatingStatusId(
        order.id,
      )

      const updated =
        await updateOrderStatus(
          order.id,
          status,
        )

      setOrders(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              updated.id
                ? updated
                : item,
          ),
      )

      if (
        selectedOrder?.id ===
        updated.id
      ) {
        setSelectedOrder(
          updated,
        )
      }
    } catch (err) {
      console.error(err)

      alert(
        err instanceof Error
          ? err.message
          : 'Statusni o‘zgartirishda xatolik',
      )
    } finally {
      setUpdatingStatusId(
        null,
      )
    }
  }

  async function handleSaveDelivery() {
    if (!selectedOrder) {
      return
    }

    try {
      setSavingDelivery(true)

      const updated =
        await updateOrderDelivery(
          selectedOrder.id,
          deliveryDate || null,
          deliveryTime || null,
        )

      setOrders(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              updated.id
                ? updated
                : item,
          ),
      )

      setSelectedOrder(
        updated,
      )

      alert(
        'Yetkazib berish ma’lumotlari saqlandi.',
      )
    } catch (err) {
      console.error(err)

      alert(
        err instanceof Error
          ? err.message
          : 'Saqlashda xatolik',
      )
    } finally {
      setSavingDelivery(false)
    }
  }

  function openOrder(
    order: Order,
  ) {
    setDeliveryDate(
      getDeliveryDateInput(order.delivery_date),
    )
    setDeliveryTime(
      getDeliveryTimeInput(order.delivery_time),
    )
    setSelectedOrder(order)
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <h1 className="text-3xl font-black text-gray-900">
            Buyurtmalar
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Barcha mijoz buyurtmalarini boshqaring.
          </p>
        </div>

        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? 'animate-spin'
                : ''
            }
          />

          Yangilash
        </button>

      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">

        <StatCard
          title="Jami"
          value={
            statistics.total
          }
          icon={
            <Package
              size={20}
            />
          }
        />

        <StatCard
          title="Yangi"
          value={
            statistics.newOrders
          }
          icon={
            <Clock3
              size={20}
            />
          }
        />

        <StatCard
          title="To‘langan"
          value={
            statistics.paidOrders
          }
          icon={
            <CreditCard
              size={20}
            />
          }
        />

        <StatCard
          title="Yetkazilmoqda"
          value={
            statistics.delivering
          }
          icon={
            <Truck
              size={20}
            />
          }
        />

        <StatCard
          title="Yetkazildi"
          value={
            statistics.delivered
          }
          icon={
            <CheckCircle2
              size={20}
            />
          }
        />

        <StatCard
          title="Tasdiqlangan tushum"
          value={`${formatPrice(
            statistics.paidRevenue,
          )} so‘m`}
          icon={
            <CreditCard
              size={20}
            />
          }
        />

      </div>

      {/* FILTERS */}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">

        <div className="flex flex-col gap-4 lg:flex-row">

          <div className="relative flex-1">

            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder="Buyurtma ID, mijoz ID, manzil..."
              className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-gray-400"
            />

          </div>

          <div className="relative">

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as
                    | 'ALL'
                    | OrderStatus,
                )
              }
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold outline-none lg:w-52"
            >
              <option value="ALL">
                Barcha statuslar
              </option>

              <option value="NEW">
                Yangi
              </option>

              <option value="PAYMENT_PENDING">To'lov kutilmoqda</option>

              <option value="PAID">
                To‘langan
              </option>

              <option value="DELIVERING">
                Yetkazilmoqda
              </option>

              <option value="DELIVERED">
                Yetkazildi
              </option>

              <option value="CANCELLED">
                Bekor qilindi
              </option>
            </select>

            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

          </div>

        </div>

      </div>

      {/* ERROR */}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">

          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="font-bold">
              Xatolik
            </p>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>

        </div>
      )}

      {/* LOADING */}

      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">

          <RefreshCw
            size={28}
            className="mx-auto animate-spin text-gray-400"
          />

          <p className="mt-4 text-sm font-semibold text-gray-500">
            Buyurtmalar yuklanmoqda...
          </p>

        </div>
      )}

      {/* EMPTY */}

      {!loading &&
        !error &&
        filteredOrders.length ===
          0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">

            <Package
              size={36}
              className="mx-auto text-gray-300"
            />

            <h3 className="mt-4 font-bold text-gray-800">
              Buyurtmalar topilmadi
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Tanlangan filter bo‘yicha
              buyurtma mavjud emas.
            </p>

          </div>
        )}

      {/* ORDERS */}

      {!loading &&
        filteredOrders.length >
          0 && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

            <div className="overflow-x-auto">

              <table className="min-w-[1050px] w-full">

                <thead className="border-b border-gray-200 bg-gray-50">

                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-gray-500">

                    <th className="px-5 py-4">
                      Buyurtma
                    </th>

                    <th className="px-5 py-4">
                      Mijoz
                    </th>

                    <th className="px-5 py-4">
                      Mahsulotlar
                    </th>

                    <th className="px-5 py-4">
                      Summa
                    </th>

                    <th className="px-5 py-4">
                      To‘lov
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>

                    <th className="px-5 py-4">
                      Sana
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {filteredOrders.map(
                    (order) => (
                      <tr
                        key={
                          order.id
                        }
                        onClick={() =>
                          openOrder(
                            order,
                          )
                        }
                        className="cursor-pointer transition hover:bg-gray-50"
                      >

                        <td className="px-5 py-4">

                          <p className="font-black text-gray-900">
                            #
                            {
                              order.id
                            }
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            {order.items.length}{' '}
                            xil mahsulot
                          </p>

                        </td>

                        <td className="px-5 py-4">

                          <p className="font-semibold text-gray-800">
                            Mijoz #
                            {
                              order.customer_id
                            }
                          </p>

                          {order.address && (
                            <p className="mt-1 max-w-[220px] truncate text-xs text-gray-400">
                              {
                                order.address
                              }
                            </p>
                          )}

                        </td>

                        <td className="px-5 py-4">

                          <div className="space-y-1">

                            {order.items
                              .slice(
                                0,
                                2,
                              )
                              .map(
                                (
                                  item,
                                ) => (
                                  <p
                                    key={
                                      item.id
                                    }
                                    className="text-sm text-gray-700"
                                  >
                                    #
                                    {
                                      item.product_id
                                    }{' '}
                                    •{' '}
                                    {
                                      item.quantity
                                    }{' '}
                                    {
                                      item.quantity_unit
                                    }
                                  </p>
                                ),
                              )}

                            {order.items
                              .length >
                              2 && (
                              <p className="text-xs text-gray-400">
                                +
                                {order.items.length -
                                  2}{' '}
                                ta
                              </p>
                            )}

                          </div>

                        </td>

                        <td className="px-5 py-4">

                          <p className="font-black text-gray-900">
                            {formatPrice(
                              Number(
                                order.total,
                              ),
                            )}{' '}
                            so‘m
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            {order.items
                              .reduce(
                                (
                                  sum,
                                  item,
                                ) =>
                                  sum +
                                  Number(
                                    item.weight_kg,
                                  ),
                                0,
                              )
                              .toFixed(
                                2,
                              )}{' '}
                            kg
                          </p>

                        </td>

                        <td className="px-5 py-4">

                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${getPaymentClass(
                              order,
                            )}`}
                          >
                            {
                              getPaymentLabel(
                                order,
                              )
                            }
                          </span>

                        </td>

                        <td className="px-5 py-4">

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${getStatusClass(
                              order.status,
                            )}`}
                          >
                            {getStatusIcon(
                              order.status,
                            )}

                            {
                              getStatusLabel(
                                order.status,
                              )
                            }
                          </span>

                        </td>

                        <td className="px-5 py-4 text-sm text-gray-500">
                          {formatDate(
                            order.created_at,
                          )}
                        </td>

                      </tr>
                    ),
                  )}

                </tbody>

              </table>

            </div>

          </div>
        )}

      {/* ORDER DETAIL MODAL */}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">

          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">

              <div>

                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Buyurtma
                </p>

                <h2 className="mt-1 text-2xl font-black text-gray-900">
                  #
                  {
                    selectedOrder.id
                  }
                </h2>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedOrder(
                    null,
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
              >
                <X
                  size={20}
                />
              </button>

            </div>

            {/* MODAL BODY */}

            <div className="overflow-y-auto p-6">

              {/* STATUS */}

              <div className="rounded-2xl border border-gray-200 p-4">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                      Buyurtma statusi
                    </p>

                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${getStatusClass(
                          selectedOrder.status,
                        )}`}
                      >
                        {getStatusIcon(
                          selectedOrder.status,
                        )}

                        {
                          getStatusLabel(
                            selectedOrder.status,
                          )
                        }
                      </span>
                    </div>

                  </div>

                  <select
                    value={
                      selectedOrder.status
                    }
                    disabled={
                      updatingStatusId ===
                      selectedOrder.id
                    }
                    onChange={(
                      event,
                    ) =>
                      handleStatusChange(
                        selectedOrder,
                        event
                          .target
                          .value as OrderStatus,
                      )
                    }
                    className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none disabled:opacity-50"
                  >

                    <option value={selectedOrder.status}>{getStatusLabel(selectedOrder.status)}</option>
                    {( {
                      NEW: ['CANCELLED'], PAYMENT_PENDING: ['CANCELLED'], PAID: ['CONFIRMED'],
                      CONFIRMED: ['PREPARING'], PREPARING: ['READY'], READY: ['DELIVERING'],
                      DELIVERING: ['DELIVERED'], DELIVERED: [], CANCELLED: [],
                    }[selectedOrder.status] as OrderStatus[]).map((nextStatus) => (
                      <option key={nextStatus} value={nextStatus}>{getStatusLabel(nextStatus)}</option>
                    ))}
                  </select>

                </div>

                <section className="mt-5 rounded-2xl bg-gray-50 p-4">
                  <h3 className="font-bold">Holatlar tarixi</h3>
                  <ol className="mt-3 space-y-3">
                    {(selectedOrder.status_history ?? []).map((event) => (
                      <li key={event.id} className="flex gap-3 text-sm">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-600" />
                        <div>
                          <p className="font-semibold">{getStatusLabel(event.new_status)}</p>
                          <p className="text-xs text-gray-500">{formatDate(event.created_at)}</p>
                          {event.note && <p className="mt-1 text-xs text-gray-600">{event.note}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                {!selectedOrder.payment_confirmed && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">

                    <AlertCircle
                      size={18}
                      className="mt-0.5 shrink-0"
                    />

                    <p>
                      To‘lov hali tasdiqlanmagan.
                      `PAID` statusini hozir
                      qo‘yib bo‘lmaydi.
                    </p>

                  </div>
                )}

              </div>

              {/* CUSTOMER / ORDER INFO */}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">

                <InfoCard
                  title="Mijoz"
                  icon={
                    <Package
                      size={18}
                    />
                  }
                >

                  <p className="font-bold text-gray-900">
                    Mijoz #
                    {
                      selectedOrder.customer_id
                    }
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Buyurtma ID: #
                    {
                      selectedOrder.id
                    }
                  </p>

                  {selectedOrder.delivery_phone && (
                    <p className="mt-1 text-sm font-semibold text-gray-700">
                      Telefon: {selectedOrder.delivery_phone}
                    </p>
                  )}

                </InfoCard>

                <InfoCard
                  title="To‘lov"
                  icon={
                    <CreditCard
                      size={18}
                    />
                  }
                >

                  <p
                    className={`font-bold ${
                      selectedOrder.payment_confirmed
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {getPaymentLabel(
                      selectedOrder,
                    )}
                  </p>

                  {selectedOrder.payment_transaction_id && (
                    <p className="mt-1 break-all text-xs text-gray-500">
                      TX:
                      {
                        selectedOrder.payment_transaction_id
                      }
                    </p>
                  )}

                </InfoCard>

              </div>

              {/* ITEMS */}

              <div className="mt-6">

                <h3 className="text-lg font-black text-gray-900">
                  Mahsulotlar
                </h3>

                <div className="mt-3 space-y-2">

                  {selectedOrder.items.map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                        className="flex items-center justify-between rounded-xl bg-gray-50 p-4"
                      >

                        <div>

                          <p className="font-bold text-gray-900">
                            Mahsulot #
                            {
                              item.product_id
                            }
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {
                              item.quantity
                            }{' '}
                            {
                              item.quantity_unit
                            }

                            {' • '}

                            {Number(
                              item.weight_kg,
                            ).toFixed(
                              2,
                            )}{' '}
                            kg
                          </p>

                          {item.quantity_unit ===
                            'dona' && (
                            <p className="mt-1 text-xs text-gray-400">
                              1 dona ={' '}
                              {
                                item.weight_per_unit
                              }{' '}
                              kg
                            </p>
                          )}

                        </div>

                        <div className="text-right">

                          <p className="font-black text-gray-900">
                            {formatPrice(
                              Number(
                                item.subtotal,
                              ),
                            )}{' '}
                            so‘m
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            {formatPrice(
                              Number(
                                item.price,
                              ),
                            )}{' '}
                            so‘m / kg
                          </p>

                        </div>

                      </div>
                    ),
                  )}

                </div>

                <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-900 px-4 py-4 text-white">

                  <span className="font-bold">
                    Jami
                  </span>

                  <span className="text-xl font-black">
                    {formatPrice(
                      Number(
                        selectedOrder.total,
                      ),
                    )}{' '}
                    so‘m
                  </span>

                </div>

              </div>

              {/* DELIVERY */}

              <div className="mt-6">

                <div className="flex items-center gap-2">

                  <Truck
                    size={20}
                    className="text-gray-700"
                  />

                  <h3 className="text-lg font-black text-gray-900">
                    Yetkazib berish
                  </h3>

                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">

                  <label className="block">

                    <span className="mb-1.5 block text-xs font-bold text-gray-500">
                      Sana
                    </span>

                    <div className="relative">

                      <CalendarDays
                        size={17}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="date"
                        value={
                          deliveryDate
                        }
                        onChange={(
                          event,
                        ) =>
                          setDeliveryDate(
                            event
                              .target
                              .value,
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-gray-400"
                      />

                    </div>

                  </label>

                  <label className="block">

                    <span className="mb-1.5 block text-xs font-bold text-gray-500">
                      Vaqt
                    </span>

                    <div className="relative">

                      <Clock3
                        size={17}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="time"
                        value={
                          deliveryTime
                        }
                        onChange={(
                          event,
                        ) =>
                          setDeliveryTime(
                            event
                              .target
                              .value,
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-gray-400"
                      />

                    </div>

                  </label>

                </div>

                <button
                  type="button"
                  onClick={
                    handleSaveDelivery
                  }
                  disabled={
                    savingDelivery
                  }
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >

                  {savingDelivery ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle2
                      size={16}
                    />
                  )}

                  Saqlash

                </button>

              </div>

              {/* LOCATION */}

              <div className="mt-6">

                <h3 className="text-lg font-black text-gray-900">
                  Yetkazib berish joyi
                </h3>

                <div className="mt-3 rounded-2xl bg-gray-50 p-4">

                  {selectedOrder.address && (
                    <div className="flex items-start gap-3">

                      <MapPin
                        size={20}
                        className="mt-0.5 shrink-0 text-red-500"
                      />

                      <div>

                        <p className="font-semibold text-gray-800">
                          {
                            selectedOrder.address
                          }
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          Lat:{' '}
                          {
                            selectedOrder.latitude
                          }
                          {' • '}
                          Lng:{' '}
                          {
                            selectedOrder.longitude
                          }
                        </p>

                      </div>

                    </div>
                  )}

                  {selectedOrder.landmark && (
                    <p className="mt-3 text-sm text-gray-600">
                      Orientir: {selectedOrder.landmark}
                    </p>
                  )}

                  {!selectedOrder.address && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">

                      <MapPin
                        size={18}
                      />

                      Manzil izohi
                      kiritilmagan.

                    </div>
                  )}

                  <a
                    href={`https://www.openstreetmap.org/?mlat=${selectedOrder.latitude}&mlon=${selectedOrder.longitude}#map=17/${selectedOrder.latitude}/${selectedOrder.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-gray-800 shadow-sm ring-1 ring-gray-200"
                  >
                    <MapPin
                      size={17}
                    />

                    Xaritada ko‘rish

                    <ExternalLink
                      size={15}
                    />
                  </a>

                  {selectedOrder.delivery_image_url && (
                    deliveryImage?.source === selectedOrder.delivery_image_url
                      ? deliveryImage.url ? (
                        <a href={deliveryImage.url} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
                          <img src={deliveryImage.url} alt="Yetkazib berish manzili rasmi" className="max-h-80 w-full object-contain" />
                          <span className="block px-4 py-3 text-sm font-bold text-gray-800">Manzil rasmi</span>
                        </a>
                      ) : <p role="status" className="mt-4 text-sm text-gray-500">{deliveryImage.error ? 'Manzil rasmini yuklab bo‘lmadi.' : 'Manzil rasmi yuklanmoqda…'}</p>
                      : <p role="status" className="mt-4 text-sm text-gray-500">Manzil rasmi yuklanmoqda…</p>
                  )}

                </div>

              </div>

              {/* COMMENT */}

              {selectedOrder.comment && (
                <div className="mt-6">

                  <h3 className="text-lg font-black text-gray-900">
                    Mijoz izohi
                  </h3>

                  <div className="mt-3 rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                    {
                      selectedOrder.comment
                    }
                  </div>

                </div>
              )}

              {/* CREATED */}

              <div className="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-400">

                Buyurtma berilgan:
                {' '}
                {formatDate(
                  selectedOrder.created_at,
                )}

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}

/* =========================
   STAT CARD
========================= */

function StatCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string | number
  icon: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">

      <div className="flex items-center justify-between">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
          {icon}
        </div>

      </div>

      <p className="mt-4 text-xs font-semibold text-gray-500">
        {title}
      </p>

      <p className="mt-1 text-xl font-black text-gray-900">
        {value}
      </p>

    </div>
  )
}

/* =========================
   INFO CARD
========================= */

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4">

      <div className="flex items-center gap-2 text-gray-500">

        {icon}

        <span className="text-xs font-bold uppercase tracking-wide">
          {title}
        </span>

      </div>

      <div className="mt-3">
        {children}
      </div>

    </div>
  )
}

export default Orders
