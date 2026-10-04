import { useState, type FormEvent } from 'react'
import {
  Check,
  MapPin,
  Phone,
  User,
  X,
} from 'lucide-react'

import LocationPicker from './LocationPicker'
import {
  createCustomerProfile,
  updateCustomerProfile,
  type CustomerProfile,
  type CustomerProfileCreate,
} from '../api/customers'

/* ============================================================
   TYPES
   ============================================================ */

interface ProfileSetupProps {
  telegramId?: number
  initialData?: Partial<CustomerProfile>
  onCompleted: (profile: CustomerProfile) => void
  onClose?: () => void
}

/* ============================================================
   HELPERS
   ============================================================ */

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, '')
}

function validatePhone(value: string): boolean {
  const normalized = normalizePhone(value)

  return /^\+?[0-9]{9,15}$/.test(normalized)
}

/* ============================================================
   COMPONENT
   ============================================================ */

export default function ProfileSetup({
  telegramId,
  initialData,
  onCompleted,
  onClose,
}: ProfileSetupProps) {
  const [name, setName] = useState(
    initialData?.name ?? '',
  )

  const [surname, setSurname] = useState(
    initialData?.surname ?? '',
  )

  const [phone, setPhone] = useState(
    initialData?.phone ?? '',
  )

  const [latitude, setLatitude] = useState<number | null>(
    initialData?.latitude ?? null,
  )

  const [longitude, setLongitude] = useState<number | null>(
    initialData?.longitude ?? null,
  )

  const [accuracy, setAccuracy] = useState<number | null>(
    initialData?.accuracy ?? null,
  )

  const [address, setAddress] = useState(
    initialData?.address ?? '',
  )

  const [landmark, setLandmark] = useState(
    initialData?.landmark ?? '',
  )

  const [showLocationPicker, setShowLocationPicker] =
    useState(false)

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')

  /* ==========================================================
     LOCATION
     ========================================================== */

  function handleLocationConfirm(data: {
    latitude: number
    longitude: number
    accuracy?: number | null
    address?: string | null
  }) {
    setLatitude(data.latitude)
    setLongitude(data.longitude)
    setAccuracy(data.accuracy ?? null)

    if (data.address) {
      setAddress(data.address)
    }

    setShowLocationPicker(false)
    setError('')
  }

  /* ==========================================================
     SUBMIT
     ========================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')

    const cleanName = name.trim()
    const cleanSurname = surname.trim()
    const cleanPhone = normalizePhone(phone)
    const cleanAddress = address.trim()
    const cleanLandmark = landmark.trim()

    if (!cleanName) {
      setError('Ismingizni kiriting.')
      return
    }

    if (!cleanSurname) {
      setError('Familiyangizni kiriting.')
      return
    }

    if (!validatePhone(cleanPhone)) {
      setError('Telefon raqamini to‘g‘ri kiriting.')
      return
    }

    if (
      latitude === null ||
      longitude === null
    ) {
      setError('Yetkazib berish lokatsiyasini tanlang.')
      return
    }

    if (!cleanAddress) {
      setError('Manzilni kiriting.')
      return
    }

    if (!cleanLandmark) {
      setError('Orientirni kiriting.')
      return
    }

    setLoading(true)

    try {
      const payload: CustomerProfileCreate = {
        ...(telegramId ? { telegram_id: telegramId } : {}),

        name: cleanName,
        surname: cleanSurname,

        phone: cleanPhone,

        latitude,
        longitude,
        accuracy,

        address: cleanAddress,
        landmark: cleanLandmark,
      }

      const profile = initialData?.id
        ? await updateCustomerProfile(telegramId ?? initialData.telegram_id ?? undefined, {
            name: cleanName,
            surname: cleanSurname,
            phone: cleanPhone,
            latitude,
            longitude,
            accuracy,
            address: cleanAddress,
            landmark: cleanLandmark,
          })
        : await createCustomerProfile(payload)

      onCompleted(profile)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Profilni saqlashda xatolik yuz berdi.',
      )
    } finally {
      setLoading(false)
    }
  }

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
        <div className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-t-[30px] bg-white shadow-2xl sm:rounded-[30px]">
          {/* HEADER */}

          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white/95 px-5 py-4 backdrop-blur">
            <div>
              <h2 className="text-xl font-black text-[#17130e]">
                Profilingiz
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Buyurtma berish uchun ma’lumotlarni kiriting
              </p>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition active:scale-95"
                aria-label="Yopish"
              >
                <X size={20} />
              </button>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 p-5"
          >
            {/* NAME */}

            <div>
              <label className="mb-2 block text-sm font-bold text-[#17130e]">
                Ism
              </label>

              <div className="relative">
                <User
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Ismingiz"
                  autoComplete="given-name"
                  className="h-13 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-12 pr-4 text-base outline-none transition focus:border-[#a77a2d] focus:bg-white"
                />
              </div>
            </div>

            {/* SURNAME */}

            <div>
              <label className="mb-2 block text-sm font-bold text-[#17130e]">
                Familiya
              </label>

              <input
                type="text"
                value={surname}
                onChange={(event) =>
                  setSurname(event.target.value)
                }
                placeholder="Familiyangiz"
                autoComplete="family-name"
                className="h-13 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-base outline-none transition focus:border-[#a77a2d] focus:bg-white"
              />
            </div>

            {/* PHONE */}

            <div>
              <label className="mb-2 block text-sm font-bold text-[#17130e]">
                Telefon raqam
              </label>

              <div className="relative">
                <Phone
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  placeholder="+998 90 123 45 67"
                  autoComplete="tel"
                  className="h-13 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-12 pr-4 text-base outline-none transition focus:border-[#a77a2d] focus:bg-white"
                />
              </div>
            </div>

            {/* LOCATION */}

            <div>
              <label className="mb-2 block text-sm font-bold text-[#17130e]">
                Yetkazib berish lokatsiyasi
              </label>

              <button
                type="button"
                onClick={() =>
                  setShowLocationPicker(true)
                }
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-left transition active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1e5cf] text-[#a77a2d]">
                  <MapPin size={20} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#17130e]">
                    {latitude !== null &&
                    longitude !== null
                      ? 'Lokatsiya tanlangan'
                      : 'Lokatsiyani tanlash'}
                  </span>

                  <span className="mt-1 block truncate text-xs text-gray-500">
                    {latitude !== null &&
                    longitude !== null
                      ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                      : 'Xaritadan joylashuvingizni belgilang'}
                  </span>
                </span>

                {latitude !== null &&
                  longitude !== null && (
                    <Check
                      size={21}
                      className="shrink-0 text-green-600"
                    />
                  )}
              </button>
            </div>

            {/* ADDRESS */}

            <div>
              <label className="mb-2 block text-sm font-bold text-[#17130e]">
                Manzil
              </label>

              <textarea
                value={address}
                onChange={(event) =>
                  setAddress(event.target.value)
                }
                placeholder="Masalan: Chilonzor 9-mavze, 12-uy"
                rows={3}
                className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none transition focus:border-[#a77a2d] focus:bg-white"
              />
            </div>

            {/* LANDMARK */}

            <div>
              <label className="mb-2 block text-sm font-bold text-[#17130e]">
                Orientir
              </label>

              <input
                type="text"
                value={landmark}
                onChange={(event) =>
                  setLandmark(event.target.value)
                }
                placeholder="Masalan: Makro yonida"
                className="h-13 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-base outline-none transition focus:border-[#a77a2d] focus:bg-white"
              />
            </div>

            {/* ERROR */}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={loading}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#17130e] px-5 text-base font-black text-white shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Saqlanmoqda...'
                : 'Profilni saqlash'}
            </button>

            <p className="text-center text-xs leading-5 text-gray-400">
              Profil ma’lumotlaringiz keyingi buyurtmalarda
              avtomatik ishlatiladi.
            </p>
          </form>
        </div>
      </div>

      {/* LOCATION PICKER */}

      {showLocationPicker && (
        <LocationPicker
          initialLocation={
            latitude !== null &&
            longitude !== null
              ? {
                  latitude,
                  longitude,
                }
              : undefined
          }
          onConfirm={handleLocationConfirm}
          onCancel={() =>
            setShowLocationPicker(false)
          }
        />
      )}
    </>
  )
}
