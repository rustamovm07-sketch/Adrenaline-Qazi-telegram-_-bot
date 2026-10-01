import {
  useEffect,
  useState,
} from 'react'
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import {
  Check,
  LocateFixed,
  MapPin,
  X,
} from 'lucide-react'

import 'leaflet/dist/leaflet.css'

export type LocationValue = {
  latitude: number
  longitude: number
  accuracy?: number | null
  address?: string | null
}

type LocationPickerProps = {
  initialLocation?: LocationValue
  onConfirm: (location: LocationValue) => void
  onCancel: () => void
}

const DEFAULT_POSITION: [number, number] = [
  41.2995,
  69.2401,
]

function MapClickHandler({
  onSelect,
}: {
  onSelect: (location: LocationValue) => void
}) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        accuracy: null,
      })
    },
  })

  return null
}

function MapViewSync({
  location,
}: {
  location: LocationValue | null
}) {
  const map = useMap()

  useEffect(() => {
    if (location) {
      map.setView(
        [location.latitude, location.longitude],
        Math.max(map.getZoom(), 16),
      )
    }
  }, [location, map])

  return null
}

export default function LocationPicker({
  initialLocation,
  onConfirm,
  onCancel,
}: LocationPickerProps) {
  const [selectedLocation, setSelectedLocation] =
    useState<LocationValue | null>(
      initialLocation
        ? {
            latitude: initialLocation.latitude,
            longitude: initialLocation.longitude,
            accuracy: initialLocation.accuracy ?? null,
          }
        : null,
    )

  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState('')

  const mapCenter: [number, number] = selectedLocation
    ? [
        selectedLocation.latitude,
        selectedLocation.longitude,
      ]
    : DEFAULT_POSITION

  function locateMe() {
    if (!navigator.geolocation) {
      setError('Ushbu qurilmada GPS lokatsiyasi mavjud emas.')
      return
    }

    setIsLocating(true)
    setError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelectedLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
        setIsLocating(false)
      },
      (locationError) => {
        const message =
          locationError.code === locationError.PERMISSION_DENIED
            ? 'Lokatsiyaga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering yoki xaritadan joy tanlang.'
            : locationError.code === locationError.POSITION_UNAVAILABLE
              ? 'Qurilma lokatsiyani aniqlay olmadi. Xaritadan joy tanlang.'
              : 'Lokatsiyani aniqlash vaqti tugadi. Qayta urinib ko‘ring yoki xaritadan joy tanlang.'

        setError(message)
        setIsLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    )
  }

  function handleConfirm() {
    if (!selectedLocation) {
      return
    }

    onConfirm({
      ...selectedLocation,
      address: null,
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              Yetkazib berish joyi
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              OpenStreetMap xaritasidan joy tanlang
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-700 transition hover:bg-stone-200"
            aria-label="Yopish"
          >
            <X size={22} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <MapContainer
            center={mapCenter}
            zoom={selectedLocation ? 16 : 12}
            scrollWheelZoom
            className="absolute inset-0 h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler onSelect={setSelectedLocation} />
            <MapViewSync location={selectedLocation} />

            {selectedLocation && (
              <CircleMarker
                center={[
                  selectedLocation.latitude,
                  selectedLocation.longitude,
                ]}
                radius={10}
                pathOptions={{
                  color: '#ffffff',
                  weight: 3,
                  fillColor: '#dc2626',
                  fillOpacity: 1,
                }}
              />
            )}
          </MapContainer>

          <button
            type="button"
            onClick={locateMe}
            disabled={isLocating}
            className="absolute right-4 top-4 z-[1000] flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-stone-800 shadow-lg transition hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60"
          >
            <LocateFixed size={18} />
            {isLocating ? 'Aniqlanmoqda...' : 'Mening joylashuvim'}
          </button>

          <div className="pointer-events-none absolute left-4 top-4 z-[1000] max-w-xs rounded-2xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="flex items-start gap-2">
              <MapPin
                size={20}
                className="mt-0.5 shrink-0 text-red-600"
              />
              <p className="text-sm font-medium leading-5 text-stone-700">
                Xaritani bosib yetkazib berish joyini belgilang. Manzilni keyingi maydonga yozasiz.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-stone-200 bg-white p-4">
          {error && (
            <div
              role="alert"
              className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {selectedLocation ? (
            <div className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-800">
                Joylashuv tanlandi
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {selectedLocation.latitude.toFixed(6)},{' '}
                {selectedLocation.longitude.toFixed(6)}
                {selectedLocation.accuracy != null &&
                  ` · aniqlik ±${Math.round(selectedLocation.accuracy)} m`}
              </p>
            </div>
          ) : (
            <div className="mb-3 rounded-2xl bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">
                Hali joylashuv tanlanmagan
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-stone-100 px-4 py-3 font-semibold text-stone-700"
            >
              <X size={20} />
              Bekor qilish
            </button>

            <button
              type="button"
              disabled={!selectedLocation}
              onClick={handleConfirm}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={20} />
              Joyni tasdiqlash
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
