import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  MapPin,
  Phone,
  ShoppingBag,
  User,
} from 'lucide-react'

import {
  createOrder,
  uploadOrderDeliveryImage,
} from '../api/orders'
import { createHamyonPayment, type HamyonPayment } from '../api/payments'
import { getPublicStoreSettings } from '../api/storeSettings'
import type { CustomerProfile } from '../api/customers'

import LocationPicker from './LocationPicker'
import PaymentScreen from './PaymentScreen'
import type { LocationValue } from './LocationPicker'

const YANDEX_GO_TRACKING_ID = '1178268795219780156'

function yandexGoRouteUrl(
  destination: LocationValue,
  origin: { latitude: number; longitude: number },
) {
  const params = new URLSearchParams({
    'end-lat': String(destination.latitude),
    'end-lon': String(destination.longitude),
    app_code: '3',
    tariffClass: 'econom',
    ref: 'adrenalinqazi',
    appmetrica_tracking_id: YANDEX_GO_TRACKING_ID,
    lang: 'uz',
  })
  params.set('start-lat', String(origin.latitude))
  params.set('start-lon', String(origin.longitude))
  return `https://3.redirect.appmetrica.yandex.com/route?${params.toString()}`
}

type CheckoutItem = {
  id: number
  name: string
  price: number
  quantity: number
  unitType?: 'kg' | 'dona'
  weightPerUnit?: number
}

type CheckoutProps = {
  items: CheckoutItem[]
  profile: CustomerProfile
  onClose: () => void
  onSuccess?: () => void
}

export default function Checkout({
  items,
  profile,
  onClose,
  onSuccess,
}: CheckoutProps) {
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [address, setAddress] = useState(profile.address ?? '')
  const [landmark, setLandmark] = useState(profile.landmark ?? '')
  const [comment, setComment] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [deliveryPhoto, setDeliveryPhoto] = useState<File | null>(null)
  const [deliveryPhotoPreview, setDeliveryPhotoPreview] = useState<string | null>(null)
  const deliveryPhotoUrl = useRef<string | null>(null)
  useEffect(() => {
    return () => {
      if (deliveryPhotoUrl.current) URL.revokeObjectURL(deliveryPhotoUrl.current)
    }
  }, [])

  const [location, setLocation] =
    useState<LocationValue | null>(
      profile.latitude !== null && profile.longitude !== null
        ? {
            latitude: profile.latitude,
            longitude: profile.longitude,
            accuracy: profile.accuracy,
          }
        : null,
    )

  const [showLocationPicker, setShowLocationPicker] =
    useState(false)
  const [showDeliveryFields, setShowDeliveryFields] = useState(
    !(
      profile.phone.trim() &&
      profile.latitude !== null &&
      profile.longitude !== null &&
      (profile.address?.trim() || profile.landmark?.trim())
    ),
  )

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [successOrderId, setSuccessOrderId] =
    useState<number | null>(null)
  const [successReservationExpiresAt, setSuccessReservationExpiresAt] =
    useState<string | null>(null)
  const [storeLocation, setStoreLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [payment, setPayment] = useState<HamyonPayment | null>(null)
  const [paymentSetupError, setPaymentSetupError] = useState('')

  useEffect(() => {
    let active = true
    void getPublicStoreSettings()
      .then((settings) => {
        if (active && settings.latitude !== null && settings.longitude !== null) {
          setStoreLocation({ latitude: settings.latitude, longitude: settings.longitude })
        }
      })
      .catch(() => { if (active) setStoreLocation(null) })
    return () => { active = false }
  }, [])

  const getItemSubtotal = (
    item: CheckoutItem,
  ): number => {
    if (
      item.unitType === 'dona' &&
      item.weightPerUnit &&
      item.weightPerUnit > 0
    ) {
      return (
        item.price *
        item.weightPerUnit *
        item.quantity
      )
    }

    return item.price * item.quantity
  }

  const getItemWeight = (
    item: CheckoutItem,
  ): number => {
    if (
      item.unitType === 'dona' &&
      item.weightPerUnit &&
      item.weightPerUnit > 0
    ) {
      return (
        item.weightPerUnit *
        item.quantity
      )
    }

    return item.quantity
  }

  const total = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum + getItemSubtotal(item),
      0,
    )
  }, [items])

  const totalWeight = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum + getItemWeight(item),
      0,
    )
  }, [items])

  const formatPrice = (
    value: number,
  ): string => {
    return new Intl.NumberFormat(
      'uz-UZ',
    ).format(Math.round(value))
  }

  const validatePhone = (
    value: string,
  ): boolean => {
    const digits = value.replace(
      /\D/g,
      '',
    )

    return digits.length >= 9
  }

  const handleSubmit = async () => {
    setError(null)

    if (items.length === 0) {
      setError(
        'Savatcha bo‘sh. Avval mahsulot tanlang.',
      )
      return
    }

    if (!name.trim()) {
      setError(
        'Ismingizni kiriting.',
      )
      return
    }

    if (name.trim().length < 2) {
      setError(
        'Ism kamida 2 ta belgidan iborat bo‘lsin.',
      )
      return
    }

    if (!phone.trim()) {
      setError(
        'Telefon raqamingizni kiriting.',
      )
      return
    }

    if (!validatePhone(phone)) {
      setError(
        'Telefon raqamini to‘g‘ri kiriting.',
      )
      return
    }

    if (!location) {
      setError(
        'Yetkazib berish joyini xaritadan tanlang.',
      )
      return
    }
    if (!deliveryPhoto) {
      setError('Yetkazib berish manzili rasmini biriktiring.')
      return
    }

    for (const item of items) {
      if (
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0
      ) {
        setError(
          `"${item.name}" mahsulotining miqdori noto‘g‘ri.`,
        )
        return
      }

      if (
        item.unitType === 'dona' &&
        (
          !item.weightPerUnit ||
          !Number.isFinite(item.weightPerUnit) ||
          item.weightPerUnit <= 0
        )
      ) {
        setError(
          `"${item.name}" mahsulotining dona og‘irligi aniqlanmadi.`,
        )
        return
      }

      if (
        item.unitType !== 'dona' &&
        item.unitType !== 'kg'
      ) {
        setError(
          `"${item.name}" mahsulotining o‘lchov birligi noto‘g‘ri.`,
        )
        return
      }
    }

    setIsSubmitting(true)

    try {
      const deliveryImageUrl = await uploadOrderDeliveryImage(deliveryPhoto)
      const order = await createOrder({
        name: name.trim(),

        phone: phone.trim(),

        // Server Telegram initData imzosini apiFetch orqali tekshiradi.
        telegram_id: profile.telegram_id,

        latitude: location.latitude,

        longitude: location.longitude,

        accuracy:
          location.accuracy ?? null,

        address:
          address.trim() || null,

        landmark:
          landmark.trim() || null,

        delivery_image_url: deliveryImageUrl,

        comment:
          comment.trim() || null,

        delivery_date: deliveryDate || null,

        delivery_time: deliveryTime || null,
        items: items.map((item) => ({
          product_id: item.id,

          quantity: item.quantity,

          quantity_unit:
            item.unitType ?? 'kg',
        })),
      })

      setSuccessOrderId(order.id)
      setSuccessReservationExpiresAt(order.reservation_expires_at)
      try {
        setPayment(await createHamyonPayment(order.id))
      } catch (cause) {
        setPaymentSetupError(cause instanceof Error ? cause.message : 'Hamyon to‘lovini yaratib bo‘lmadi.')
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Buyurtma yuborishda xatolik yuz berdi.'

      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successOrderId !== null && payment) {
    return <PaymentScreen orderId={successOrderId} initialPayment={payment} onClose={() => { onSuccess?.(); onClose() }} />
  }

  if (successOrderId !== null) {
    const handleSuccessClose = () => {
      /*
       * App.tsx cartni tozalashi uchun callback.
       */
      onClose()
    }

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2
              size={42}
              className="text-emerald-600"
            />
          </div>

          <h2 className="mt-5 text-2xl font-black text-stone-900">
            Buyurtma qabul qilindi!
          </h2>

          <p className="mt-3 text-stone-600">
            Buyurtmangiz muvaffaqiyatli yaratildi.
          </p>

          <div className="mt-5 rounded-2xl bg-stone-50 p-4">
            <p className="text-sm text-stone-500">
              Buyurtma raqami
            </p>

            <p className="mt-1 text-2xl font-black text-amber-700">
              #{successOrderId}
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-600">
                Jami
              </span>

              <span className="font-black text-amber-700">
                {formatPrice(total)} so‘m
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-stone-600">
                Og‘irlik
              </span>

              <span className="font-bold text-stone-800">
                {totalWeight.toFixed(3)} kg
              </span>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-stone-500">
            Buyurtmangiz yaratildi. Hamyon to‘lovini ochish uchun qayta urinib ko‘ring.
          </p>
          {paymentSetupError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{paymentSetupError}</p>}
          <button type="button" onClick={async () => { try { setPayment(await createHamyonPayment(successOrderId)) } catch (cause) { setPaymentSetupError(cause instanceof Error ? cause.message : 'To‘lov yaratilmadi.') } }} className="mt-4 min-h-12 w-full rounded-2xl bg-[#7a1028] px-5 py-3 font-bold text-white">Hamyon orqali to‘lash</button>

          {successReservationExpiresAt && (
            <p className="mt-2 text-xs text-stone-500">
              Mahsulotlar {new Intl.DateTimeFormat('uz-UZ', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(successReservationExpiresAt))} gacha band qilinadi.
              To‘lov shu vaqtgacha tasdiqlanmasa, buyurtma bekor bo‘ladi.
            </p>
          )}

          <button
            type="button"
            onClick={handleSuccessClose}
            className="mt-6 min-h-12 w-full rounded-2xl bg-amber-600 px-5 py-3 font-bold text-white transition hover:bg-amber-700"
          >
            Yopish
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
        <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
          {/* HEADER */}
          <div className="border-b border-stone-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100">
                <ShoppingBag
                  size={23}
                  className="text-amber-700"
                />
              </div>

              <div>
                <h2 className="text-xl font-black text-stone-900">
                  Buyurtma berish
                </h2>

                <p className="text-sm text-stone-500">
                  Ma’lumotlaringizni kiriting
                </p>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="overflow-y-auto px-5 py-5">
            {/* ERROR */}
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-red-700">
                <AlertCircle
                  size={21}
                  className="mt-0.5 shrink-0"
                />

                <p className="text-sm font-medium leading-5">
                  {error}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {showDeliveryFields ? (
                <>
              {/* NAME */}
              <div>
                <label className="mb-2 block text-sm font-bold text-stone-700">
                  Ism
                </label>

                <div className="relative">
                  <User
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                  />

                  <input
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)

                      if (error) {
                        setError(null)
                      }
                    }}
                    placeholder="Ismingiz"
                    autoComplete="name"
                    className="min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 pl-12 pr-4 outline-none transition focus:border-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* PHONE */}
              <div>
                <label className="mb-2 block text-sm font-bold text-stone-700">
                  Telefon raqami
                </label>

                <div className="relative">
                  <Phone
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                  />

                  <input
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value)

                      if (error) {
                        setError(null)
                      }
                    }}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+998 90 123 45 67"
                    className="min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 pl-12 pr-4 outline-none transition focus:border-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* LOCATION */}
              <div>
                <label className="mb-2 block text-sm font-bold text-stone-700">
                  Yetkazib berish joyi
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setShowLocationPicker(true)
                  }}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left transition ${
                    location
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-stone-200 bg-stone-50'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      location
                        ? 'bg-emerald-100'
                        : 'bg-amber-100'
                    }`}
                  >
                    <MapPin
                      size={21}
                      className={
                        location
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-stone-800">
                      {location
                        ? 'Joylashuv tanlangan'
                        : 'Xaritadan joy tanlash'}
                    </p>

                    <p className="truncate text-xs text-stone-500">
                      {location
                        ? `${location.latitude.toFixed(
                            5,
                          )}, ${location.longitude.toFixed(
                            5,
                          )}`
                        : 'GPS yoki xarita orqali belgilang'}
                    </p>
                  </div>
                </button>
              </div>

              {/* ADDRESS */}
              <div>
                <label className="mb-2 block text-sm font-bold text-stone-700">
                  Manzil / orientir
                </label>

                <input
                  value={address}
                  onChange={(event) =>
                    setAddress(event.target.value)
                  }
                  placeholder="Masalan: Chilonzor 12-kvartal, 24-uy"
                  autoComplete="street-address"
                  className="min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 outline-none transition focus:border-amber-500 focus:bg-white"
                />
              </div>

              {/* LANDMARK */}
              <div>
                <label className="mb-2 block text-sm font-bold text-stone-700">
                  Yetkazib berish uchun orientir
                </label>

                <input
                  value={landmark}
                  onChange={(event) =>
                    setLandmark(event.target.value)
                  }
                  placeholder="Masalan: Makro yonidagi oq darvoza"
                  className="min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 outline-none transition focus:border-amber-500 focus:bg-white"
                />
              </div>
                </>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-stone-800">Yetkazib berish ma’lumoti</p>
                      <p className="mt-1 text-sm text-stone-600">{name} · {phone}</p>
                      {(address || landmark) && (
                        <p className="mt-1 text-sm text-stone-600">{[address, landmark].filter(Boolean).join(' · ')}</p>
                      )}
                      <p className="mt-1 text-xs text-stone-500">
                        Manzil xaritada belgilangan
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeliveryFields(true)}
                      className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-800 shadow-sm"
                    >
                      O‘zgartirish
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <Camera size={21} className="mt-0.5 shrink-0 text-amber-700" />
                  <div>
                    <p className="font-bold text-stone-800">Manzil rasmini biriktiring <span className="text-red-600">*</span></p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">Kirish joyi, darvoza yoki uyni topishga yordam beradigan rasm. JPG, PNG yoki WEBP, 5 MB gacha.</p>
                  </div>
                </div>
                <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white">
                  {deliveryPhoto ? 'Boshqa rasm tanlash' : 'Rasmga olish yoki fayl tanlash'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                        setError('Faqat JPG, PNG yoki WEBP rasm tanlang.')
                        event.target.value = ''
                        return
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setError('Rasm hajmi 5 MB dan oshmasligi kerak.')
                        event.target.value = ''
                        return
                      }
                      if (deliveryPhotoUrl.current) URL.revokeObjectURL(deliveryPhotoUrl.current)
                      const previewUrl = URL.createObjectURL(file)
                      deliveryPhotoUrl.current = previewUrl
                      setDeliveryPhotoPreview(previewUrl)
                      setDeliveryPhoto(file)
                      setError(null)
                    }}
                  />
                </label>
                {deliveryPhotoPreview && (
                  <img
                    src={deliveryPhotoPreview}
                    alt="Yetkazib berish manzili"
                    className="mt-3 max-h-56 w-full rounded-xl object-cover"
                  />
                )}
              </div>

              {/* COMMENT */}
              <details className="rounded-2xl border border-stone-200 bg-white p-4">
                <summary className="cursor-pointer font-bold text-stone-700">Yetkazish vaqtini yoki izohni qo‘shish (ixtiyoriy)</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-700">Yetkazish sanasi (ixtiyoriy)</label>
                  <input type="date" min={new Date().toISOString().slice(0, 10)} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-700">Yetkazish vaqti (ixtiyoriy)</label>
                  <select value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} className="min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 outline-none focus:border-amber-500">
                    <option value="">Vaqtni tanlang</option>
                    <option value="09:00-12:00">09:00–12:00</option>
                    <option value="12:00-15:00">12:00–15:00</option>
                    <option value="15:00-18:00">15:00–18:00</option>
                    <option value="18:00-21:00">18:00–21:00</option>
                  </select>
                </div>
                </div>

              {/* COMMENT */}
              <div className="mt-4">
                <label className="mb-2 block text-sm font-bold text-stone-700">
                  Qo‘shimcha izoh
                </label>

                <textarea
                  value={comment}
                  onChange={(event) =>
                    setComment(event.target.value)
                  }
                  placeholder="Masalan: darvozadan qo‘ng‘iroq qiling"
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-500 focus:bg-white"
                />
              </div>
              </details>
            </div>

            {/* ORDER SUMMARY */}
            <div className="mt-6 rounded-3xl bg-stone-50 p-4">
              <h3 className="font-black text-stone-900">
                Buyurtma
              </h3>

              <div className="mt-3 space-y-3">
                {items.map((item) => {
                  const subtotal =
                    getItemSubtotal(item)

                  const weight =
                    getItemWeight(item)

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-stone-800">
                          {item.name}
                        </p>

                        <p className="text-sm text-stone-500">
                          {item.quantity}{' '}
                          {item.unitType === 'dona'
                            ? 'dona'
                            : 'kg'}

                          {item.unitType === 'dona' &&
                            item.weightPerUnit && (
                              <>
                                {' '}
                                ×{' '}
                                {item.weightPerUnit}{' '}
                                kg
                              </>
                            )}
                        </p>

                        {item.unitType === 'dona' &&
                          item.weightPerUnit && (
                            <p className="mt-0.5 text-xs text-stone-400">
                              Jami:{' '}
                              {weight.toFixed(3)} kg
                            </p>
                          )}
                      </div>

                      <p className="shrink-0 font-bold text-stone-900">
                        {formatPrice(subtotal)} so‘m
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* TOTAL WEIGHT */}
              <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-4">
                <span className="text-sm text-stone-500">
                  Jami og‘irlik
                </span>

                <span className="font-bold text-stone-800">
                  {totalWeight.toFixed(3)} kg
                </span>
              </div>

              {/* TOTAL PRICE */}
              {location && (storeLocation ? <a href={yandexGoRouteUrl(location, storeLocation)} className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#7a1028]/20 bg-[#7a1028]/[.05] px-4 py-3 text-center text-sm font-black text-[#7a1028]">
                <MapPin size={18} /> Yandex Go’da yo‘nalish va narxni ko‘rish
              </a> : <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">Do‘kon lokatsiyasi admin sozlamalarida kiritilmagan.</p>)}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-lg font-bold text-stone-700">Jami</span>
                <span className="text-2xl font-black text-amber-700">{formatPrice(total)} so‘m</span>
              </div>
            </div>

            {/* PAYMENT INFO */}
            <div className="mt-4 rounded-2xl bg-blue-50 p-4">
              <p className="text-sm leading-5 text-blue-800">
                Yetkazish narxi buyurtma summasiga kirmaydi. Yandex Go tugmasi manzilni ilovada ochadi; narxni Yandex Go o‘zi ko‘rsatadi. To‘lov Hamyon API orqali UZCARD bilan amalga oshadi.
              </p>
            </div>
          </div>

          {/* FOOTER */}
          <div className="border-t border-stone-200 bg-white p-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-h-12 flex-1 rounded-2xl bg-stone-100 px-4 py-3 font-bold text-stone-700 transition hover:bg-stone-200 disabled:opacity-50"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  items.length === 0
                }
                className="min-h-12 flex-[1.5] rounded-2xl bg-amber-600 px-4 py-3 font-black text-white shadow-lg shadow-amber-600/20 transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Yuborilmoqda...'
                  : `Hamyon bilan to‘lash · ${formatPrice(total)} so‘m`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LOCATION PICKER */}
      {showLocationPicker && (
        <LocationPicker
          initialLocation={location ?? undefined}
          onConfirm={(selectedLocation) => {
            setLocation(selectedLocation)
            setShowLocationPicker(false)
          }}
          onCancel={() =>
            setShowLocationPicker(false)
          }
        />
      )}
    </>
  )
}
