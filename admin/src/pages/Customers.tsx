import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  User,
  WalletCards,
  X,
} from 'lucide-react'

import {
  getCustomer,
  getCustomers,
  type Customer,
  type CustomerDetails,
} from '../api/customers'
import { getStoreSettings } from '../api/storeSettings'

function yandexGoRouteUrl(
  destination: { latitude: number; longitude: number },
  origin: { latitude: number; longitude: number } | null,
) {
  const query = new URLSearchParams({
    'end-lat': String(destination.latitude),
    'end-lon': String(destination.longitude),
    tariffClass: 'econom',
    lang: 'uz',
    appmetrica_tracking_id: '1178268795219780156',
  })
  if (origin) {
    query.set('start-lat', String(origin.latitude))
    query.set('start-lon', String(origin.longitude))
  }
  return `https://3.redirect.appmetrica.yandex.com/route?${query.toString()}`
}


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
  value: string | null,
) {
  if (!value) {
    return '—'
  }

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


function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NEW: 'Yangi', PAYMENT_PENDING: "To'lov kutilmoqda", PAID: "To'langan",
    CONFIRMED: 'Tasdiqlangan', PREPARING: 'Tayyorlanmoqda', READY: 'Tayyor',
    DELIVERING: 'Yetkazilmoqda', DELIVERED: 'Yetkazildi', CANCELLED: 'Bekor qilindi',
  }
  return labels[status] ?? status
}

function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    NEW: 'bg-blue-50 text-blue-700', PAYMENT_PENDING: 'bg-amber-50 text-amber-700',
    PAID: 'bg-emerald-50 text-emerald-700', CONFIRMED: 'bg-cyan-50 text-cyan-700',
    PREPARING: 'bg-orange-50 text-orange-700', READY: 'bg-purple-50 text-purple-700',
    DELIVERING: 'bg-orange-50 text-orange-700', DELIVERED: 'bg-green-50 text-green-700',
    CANCELLED: 'bg-red-50 text-red-700',
  }
  return classes[status] ?? 'bg-gray-100 text-gray-700'
}


function Customers() {
  const [storeCoordinates, setStoreCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [
    customers,
    setCustomers,
  ] = useState<Customer[]>([])

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
    selectedCustomer,
    setSelectedCustomer,
  ] =
    useState<CustomerDetails | null>(
      null,
    )

  const [
    loadingCustomer,
    setLoadingCustomer,
  ] = useState(false)


  async function loadCustomers() {
    try {
      setLoading(true)
      setError('')

      const data =
        await getCustomers()

      setCustomers(data)
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Mijozlarni yuklashda xatolik',
      )
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    // Initial data is loaded asynchronously from the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCustomers()
    void getStoreSettings().then((settings) => {
      if (settings.latitude !== null && settings.longitude !== null) {
        setStoreCoordinates({ latitude: settings.latitude, longitude: settings.longitude })
      }
    }).catch(() => undefined)
  }, [])


  const filteredCustomers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      if (!query) {
        return customers
      }

      return customers.filter(
        (customer) =>
          [
            customer.name,
            customer.phone,
            String(
              customer.id,
            ),
            customer.telegram_id
              ? String(
                  customer.telegram_id,
                )
              : '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(query),
      )
    }, [
      customers,
      search,
    ])


  async function openCustomer(
    customerId: number,
  ) {
    try {
      setLoadingCustomer(true)

      const data =
        await getCustomer(
          customerId,
        )

      setSelectedCustomer(
        data,
      )
    } catch (err) {
      console.error(err)

      alert(
        err instanceof Error
          ? err.message
          : 'Mijozni ochishda xatolik',
      )
    } finally {
      setLoadingCustomer(false)
    }
  }


  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>

          <h1 className="text-3xl font-black text-gray-900">
            Mijozlar
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Mijozlar, xaridlar va buyurtmalar tarixini boshqaring.
          </p>

        </div>

        <button
          type="button"
          onClick={
            loadCustomers
          }
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
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


      {/* STATS */}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

        <StatCard
          title="Jami mijozlar"
          value={
            customers.length
          }
          icon={
            <User
              size={20}
            />
          }
        />

        <StatCard
          title="Buyurtmali mijozlar"
          value={
            customers.filter(
              (customer) =>
                customer.order_count >
                0,
            ).length
          }
          icon={
            <ShoppingBag
              size={20}
            />
          }
        />

        <StatCard
          title="Umumiy xarid"
          value={`${formatPrice(
            customers.reduce(
              (
                sum,
                customer,
              ) =>
                sum +
                Number(
                  customer.total_purchases,
                ),
              0,
            ),
          )} so‘m`}
          icon={
            <WalletCards
              size={20}
            />
          }
        />

        <StatCard
          title="Nasiya"
          value={`${formatPrice(
            customers.reduce(
              (
                sum,
                customer,
              ) =>
                sum +
                Number(
                  customer.debt_balance,
                ),
              0,
            ),
          )} so‘m`}
          icon={
            <WalletCards
              size={20}
            />
          }
        />

      </div>


      {/* SEARCH */}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">

        <div className="relative">

          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            value={search}
            onChange={(
              event,
            ) =>
              setSearch(
                event.target
                  .value,
              )
            }
            placeholder="Ism, telefon, mijoz ID yoki Telegram ID..."
            className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-gray-400"
          />

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
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">

          <RefreshCw
            size={28}
            className="mx-auto animate-spin text-gray-400"
          />

          <p className="mt-4 text-sm font-semibold text-gray-500">
            Mijozlar yuklanmoqda...
          </p>

        </div>
      )}


      {/* EMPTY */}

      {!loading &&
        filteredCustomers.length ===
          0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">

            <User
              size={36}
              className="mx-auto text-gray-300"
            />

            <h3 className="mt-4 font-bold text-gray-800">
              Mijoz topilmadi
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Qidiruvni o‘zgartirib ko‘ring.
            </p>

          </div>
        )}


      {/* TABLE */}

      {!loading &&
        filteredCustomers.length >
          0 && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

            <div className="overflow-x-auto">

              <table className="min-w-[950px] w-full">

                <thead className="border-b border-gray-200 bg-gray-50">

                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-gray-500">

                    <th className="px-5 py-4">
                      Mijoz
                    </th>

                    <th className="px-5 py-4">
                      Telefon
                    </th>

                    <th className="px-5 py-4">
                      Telegram
                    </th>

                    <th className="px-5 py-4">
                      Buyurtmalar
                    </th>

                    <th className="px-5 py-4">
                      Xaridlar
                    </th>

                    <th className="px-5 py-4">
                      Nasiya
                    </th>

                    <th className="px-5 py-4">
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {filteredCustomers.map(
                    (
                      customer,
                    ) => (
                      <tr
                        key={
                          customer.id
                        }
                        onClick={() =>
                          openCustomer(
                            customer.id,
                          )
                        }
                        className="cursor-pointer transition hover:bg-gray-50"
                      >

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 font-black text-gray-700">
                              {customer.name
                                .charAt(
                                  0,
                                )
                                .toUpperCase()}
                            </div>

                            <div>

                              <p className="font-bold text-gray-900">
                                {
                                  customer.name
                                }
                              </p>

                              <p className="text-xs text-gray-400">
                                Mijoz #
                                {
                                  customer.id
                                }
                              </p>

                            </div>

                          </div>

                        </td>

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-2 text-sm text-gray-700">

                            <Phone
                              size={15}
                              className="text-gray-400"
                            />

                            {
                              customer.phone
                            }

                          </div>

                        </td>

                        <td className="px-5 py-4">

                          {customer.telegram_id ? (
                            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                              {
                                customer.telegram_id
                              }
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">
                              Ulanmagan
                            </span>
                          )}

                        </td>

                        <td className="px-5 py-4">

                          <span className="font-bold text-gray-800">
                            {
                              customer.order_count
                            }
                          </span>

                        </td>

                        <td className="px-5 py-4">

                          <span className="font-black text-gray-900">
                            {formatPrice(
                              Number(
                                customer.total_purchases,
                              ),
                            )}{' '}
                            so‘m
                          </span>

                        </td>

                        <td className="px-5 py-4">

                          <span
                            className={
                              Number(
                                customer.debt_balance,
                              ) >
                              0
                                ? 'font-bold text-red-600'
                                : 'text-gray-400'
                            }
                          >
                            {formatPrice(
                              Number(
                                customer.debt_balance,
                              ),
                            )}{' '}
                            so‘m
                          </span>

                        </td>

                        <td className="px-5 py-4 text-right">

                          <ChevronRight
                            size={19}
                            className="text-gray-400"
                          />

                        </td>

                      </tr>
                    ),
                  )}

                </tbody>

              </table>

            </div>

          </div>
        )}


      {/* CUSTOMER DETAIL */}

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">

          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">

              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-lg font-black text-gray-700">
                  {selectedCustomer.name
                    .charAt(
                      0,
                    )
                    .toUpperCase()}
                </div>

                <div>

                  <h2 className="text-2xl font-black text-gray-900">
                    {
                      selectedCustomer.name
                    }
                  </h2>

                  <p className="text-sm text-gray-500">
                    Mijoz #
                    {
                      selectedCustomer.id
                    }
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedCustomer(
                    null,
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <X
                  size={20}
                />
              </button>

            </div>


            {/* BODY */}

            <div className="overflow-y-auto p-6">

              {/* CUSTOMER INFO */}

              <div className="grid gap-4 md:grid-cols-4">

                <DetailCard
                  title="Familiya"
                  value={selectedCustomer.surname || 'Kiritilmagan'}
                  icon={<User size={18} />}
                />

                <DetailCard
                  title="Telefon"
                  value={
                    selectedCustomer.phone
                  }
                  icon={
                    <Phone
                      size={18}
                    />
                  }
                />

                <DetailCard
                  title="Telegram ID"
                  value={
                    selectedCustomer.telegram_id
                      ? String(
                          selectedCustomer.telegram_id,
                        )
                      : 'Ulanmagan'
                  }
                  icon={
                    <User
                      size={18}
                    />
                  }
                />

                <DetailCard
                  title="Buyurtmalar"
                  value={String(
                    selectedCustomer.order_count,
                  )}
                  icon={
                    <ShoppingBag
                      size={18}
                    />
                  }
                />

                <DetailCard
                  title="Jami xarid"
                  value={`${formatPrice(
                    Number(
                      selectedCustomer.total_purchases,
                    ),
                  )} so‘m`}
                  icon={
                    <WalletCards
                      size={18}
                    />
                  }
                />

              </div>

              <section className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex items-start gap-3">
                  <MapPin size={20} className="mt-0.5 shrink-0 text-rose-700" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-gray-900">Yetkazish manzili</h3>
                    <p className="mt-2 break-words text-sm text-gray-700">
                      {selectedCustomer.address || 'Manzil kiritilmagan'}
                    </p>
                    <p className="mt-1 break-words text-sm text-gray-500">
                      Mo‘ljal: {selectedCustomer.landmark || 'Kiritilmagan'}
                    </p>
                    {selectedCustomer.latitude !== null && selectedCustomer.longitude !== null ? (
                      <>
                        <p className="mt-2 text-xs text-gray-500">
                          {selectedCustomer.latitude.toFixed(6)}, {selectedCustomer.longitude.toFixed(6)}
                          {selectedCustomer.accuracy !== null && selectedCustomer.accuracy !== undefined
                            ? ` · aniqlik ±${Math.round(selectedCustomer.accuracy)} m`
                            : ''}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a
                            href={yandexGoRouteUrl(
                              { latitude: selectedCustomer.latitude, longitude: selectedCustomer.longitude },
                              storeCoordinates,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#7A1028] px-4 py-2 text-sm font-bold text-white hover:bg-[#5d0b1e]"
                          >
                            <ExternalLink size={16} /> Yandex Go’da yo‘nalishni ochish
                          </a>
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${selectedCustomer.latitude}&mlon=${selectedCustomer.longitude}#map=17/${selectedCustomer.latitude}/${selectedCustomer.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800"
                          >
                            <MapPin size={16} /> Xaritada ko‘rish
                          </a>
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-amber-700">Lokatsiya kiritilmagan.</p>
                    )}
                  </div>
                </div>
              </section>


              {/* DEBT */}

              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">

                <div className="flex items-center gap-2">

                  <WalletCards
                    size={20}
                    className="text-gray-600"
                  />

                  <h3 className="font-black text-gray-900">
                    Nasiya
                  </h3>

                </div>

                <p className="mt-3 text-2xl font-black text-gray-900">
                  {formatPrice(
                    Number(
                      selectedCustomer.debt_balance,
                    ),
                  )}{' '}
                  so‘m
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Nasiya moduli keyingi bosqichda
                  to‘liq ulanadi.
                </p>

              </div>


              {/* ORDER HISTORY */}

              <div className="mt-7">

                <div className="flex items-center justify-between">

                  <h3 className="text-xl font-black text-gray-900">
                    Buyurtmalar tarixi
                  </h3>

                  <span className="text-sm text-gray-400">
                    {
                      selectedCustomer.orders.length
                    }{' '}
                    ta
                  </span>

                </div>


                <div className="mt-4 space-y-3">

                  {selectedCustomer.orders
                    .length ===
                    0 && (
                    <div className="rounded-2xl bg-gray-50 p-8 text-center text-sm text-gray-500">
                      Hali buyurtma mavjud emas.
                    </div>
                  )}


                  {selectedCustomer.orders.map(
                    (
                      order,
                    ) => (
                      <div
                        key={
                          order.id
                        }
                        className="rounded-2xl border border-gray-200 p-4"
                      >

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                          <div>

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="font-black text-gray-900">
                                #
                                {
                                  order.id
                                }
                              </span>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                                  order.status,
                                )}`}
                              >
                                {
                                  getStatusLabel(
                                    order.status,
                                  )
                                }
                              </span>

                            </div>

                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">

                              <CalendarDays
                                size={14}
                              />

                              {
                                formatDate(
                                  order.created_at,
                                )
                              }

                            </div>

                          </div>


                          <div className="text-left sm:text-right">

                            <p className="text-lg font-black text-gray-900">
                              {formatPrice(
                                Number(
                                  order.total,
                                ),
                              )}{' '}
                              so‘m
                            </p>

                            <p className="text-xs text-gray-400">
                              {
                                order.items.length
                              }{' '}
                              xil mahsulot
                            </p>

                          </div>

                        </div>


                        {/* ORDER ITEMS */}

                        <div className="mt-4 space-y-2">

                          {order.items.map(
                            (
                              item,
                            ) => (
                              <div
                                key={
                                  item.id
                                }
                                className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"
                              >

                                <span className="text-sm text-gray-700">
                                  Mahsulot #
                                  {
                                    item.product_id
                                  }
                                </span>

                                <span className="text-sm font-bold text-gray-800">
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
                                </span>

                              </div>
                            ),
                          )}

                        </div>

                      </div>
                    ),
                  )}

                </div>

              </div>


              {/* CUSTOMER CREATED */}

              <div className="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-400">

                Mijoz qo‘shilgan:
                {' '}
                {formatDate(
                  selectedCustomer.created_at,
                )}

              </div>

            </div>

          </div>

        </div>
      )}


      {loadingCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">

          <div className="rounded-2xl bg-white px-6 py-5 shadow-xl">

            <div className="flex items-center gap-3">

              <RefreshCw
                size={20}
                className="animate-spin"
              />

              <span className="font-bold">
                Mijoz ma’lumotlari yuklanmoqda...
              </span>

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

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
        {icon}
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
   DETAIL CARD
========================= */

function DetailCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4">

      <div className="flex items-center gap-2 text-gray-400">

        {icon}

        <span className="text-xs font-bold uppercase tracking-wide">
          {title}
        </span>

      </div>

      <p className="mt-3 break-all font-bold text-gray-900">
        {value}
      </p>

    </div>
  )
}


export default Customers
