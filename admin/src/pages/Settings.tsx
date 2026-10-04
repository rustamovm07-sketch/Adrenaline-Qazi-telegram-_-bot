import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, MapPin, RefreshCw, Save, Upload } from 'lucide-react'
import {
  getStoreImageUrl,
  getStoreSettings,
  updateStoreSettings,
  uploadStoreImage,
  type StoreSettings,
  type StoreSettingsUpdate,
} from '../api/storeSettings'

const API_URL = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, '')
type Health = { status: string; service: string }

const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#a77a2d] focus:ring-4 focus:ring-[#a77a2d]/10'
const labelClass = 'block text-sm font-bold text-gray-700'

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    void getStoreSettings()
      .then(setSettings)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Sozlamalarni yuklab bo‘lmadi.'))
  }, [])

  function update<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current)
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Do‘kon rasmi JPG, PNG yoki WEBP bo‘lishi kerak.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Rasm hajmi 5 MB dan oshmasligi kerak.')
      event.target.value = ''
      return
    }
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError('')
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settings) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      let shopImageUrl = settings.shop_image_url
      if (imageFile) {
        const uploaded = await uploadStoreImage(imageFile)
        shopImageUrl = uploaded.shop_image_url
      }
      const payload: StoreSettingsUpdate = {
        shop_name: settings.shop_name,
        support_phone: settings.support_phone,
        support_telegram: settings.support_telegram,
        store_address: settings.store_address,
        latitude: settings.latitude,
        longitude: settings.longitude,
        shop_image_url: shopImageUrl,
        guide_text: settings.guide_text,
        terms_text: settings.terms_text,
        updates_text: settings.updates_text,
      }
      const saved = await updateStoreSettings(payload)
      setSettings(saved)
      setImageFile(null)
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
      setSuccess('Do‘kon sozlamalari saqlandi.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sozlamalarni saqlashda xatolik.')
    } finally {
      setSaving(false)
    }
  }

  async function checkApi() {
    setChecking(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/health`)
      if (!response.ok) throw new Error(`API xato javob qaytardi: ${response.status}`)
      setHealth(await response.json() as Health)
    } catch (cause) {
      setHealth(null)
      setError(cause instanceof Error ? cause.message : 'API bilan aloqa yo‘q.')
    } finally {
      setChecking(false)
    }
  }

  const settingsHelp = [
    ['BOT_TOKEN', 'BotFather bergan maxfiy token. Uni frontendga yozmang.'],
    ['ADMIN_TELEGRAM_ID', 'Do‘kon egasining musbat raqamli Telegram ID si.'],
    ['MINI_APP_URL', 'Mijozlar uchun HTTPS do‘kon manzili.'],
    ['ADMIN_PANEL_URL', 'Admin panel uchun HTTPS manzili.'],
    ['CORS_ORIGINS', 'Frontend manzillarining origin qiymati.'],
    ['ORDER_RESERVATION_HOURS', 'To‘lov kutiladigan vaqt. Standart qiymati: 12 soat.'],
  ]

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a77a2d]">DO‘KON BOSHQARUVI</p>
        <h1 className="mt-1 text-3xl font-black">Sozlamalar</h1>
        <p className="mt-2 text-sm text-gray-500">Do‘kon ko‘rinishi, mijozlar bilan aloqa va ilova matnlarini boshqaring.</p>
      </header>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={18} />{error}</p>}
      {success && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={18} />{success}</p>}

      {!settings ? (
        <div className="rounded-2xl bg-white p-6 text-sm text-gray-500">Sozlamalar yuklanmoqda...</div>
      ) : (
        <form onSubmit={(event) => void saveSettings(event)} className="space-y-6">
          <article className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-black">Do‘kon va manzil</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>Do‘kon nomi<input className={inputClass} required maxLength={160} value={settings.shop_name} onChange={(event) => update('shop_name', event.target.value)} /></label>
                <label className={labelClass}>Aloqa telefoni<input className={inputClass} type="tel" value={settings.support_phone ?? ''} onChange={(event) => update('support_phone', event.target.value || null)} placeholder="+998 90 123 45 67" /></label>
                <label className={labelClass}>Telegram username<input className={inputClass} value={settings.support_telegram ?? ''} onChange={(event) => update('support_telegram', event.target.value || null)} placeholder="@adrenalin_qazi" /></label>
                <label className={labelClass}>Do‘kon manzili<input className={inputClass} value={settings.store_address ?? ''} onChange={(event) => update('store_address', event.target.value || null)} placeholder="Shahar, ko‘cha, mo‘ljal" /></label>
                <label className={labelClass}>Kenglik (latitude)<input className={inputClass} type="number" step="any" value={settings.latitude ?? ''} onChange={(event) => update('latitude', event.target.value === '' ? null : Number(event.target.value))} /></label>
                <label className={labelClass}>Uzunlik (longitude)<input className={inputClass} type="number" step="any" value={settings.longitude ?? ''} onChange={(event) => update('longitude', event.target.value === '' ? null : Number(event.target.value))} /></label>
              </div>
              <div>
                <p className={labelClass}>Do‘kon rasmi</p>
                <div className="mt-1.5 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[#f7f3ea]">
                  {(imagePreview || getStoreImageUrl(settings.shop_image_url)) ? <img src={imagePreview ?? getStoreImageUrl(settings.shop_image_url) ?? ''} alt="Do‘kon ko‘rinishi" className="h-full w-full object-cover" /> : <MapPin size={36} className="text-[#a77a2d]" />}
                </div>
                <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#a77a2d]/30 bg-[#faf8f3] px-3 text-sm font-bold text-[#79571d]">
                  <Upload size={16} /> Rasm tanlash
                  <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
                </label>
                <p className="mt-2 text-xs leading-5 text-gray-400">Do‘kon tashqi ko‘rinishi yoki peshlavha rasmi. JPG, PNG, WEBP, 5 MB gacha.</p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-black">Mijozga ko‘rinadigan ma’lumotlar</h2>
            <p className="mt-1 text-sm text-gray-500">Qo‘llanma, foydalanish shartlari va yangiliklar mijoz ilovasidagi Profil bo‘limida chiqadi.</p>
            <div className="mt-5 space-y-4">
              <label className={labelClass}>Foydalanish qo‘llanmasi<textarea className={`${inputClass} min-h-24`} value={settings.guide_text} onChange={(event) => update('guide_text', event.target.value)} /></label>
              <label className={labelClass}>Foydalanish shartlari<textarea className={`${inputClass} min-h-32`} value={settings.terms_text} onChange={(event) => update('terms_text', event.target.value)} /></label>
              <label className={labelClass}>Kutilayotgan yangilanishlar<textarea className={`${inputClass} min-h-24`} value={settings.updates_text} onChange={(event) => update('updates_text', event.target.value)} /></label>
            </div>
          </article>

          <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#241d13] px-5 py-3 text-sm font-black text-[#f5e7c7] shadow-lg disabled:opacity-50">
            <Save size={17} />{saving ? 'Saqlanmoqda...' : 'Sozlamalarni saqlash'}
          </button>
        </form>
      )}

      <article className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-black">Backend API</h2><p className="mt-1 break-all text-sm text-gray-500">{API_URL}</p></div>
          <button type="button" onClick={() => void checkApi()} disabled={checking} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={checking ? 'animate-spin' : ''} />Aloqani tekshirish</button>
        </div>
        {health && <p className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800"><CheckCircle2 size={18} />API ishlayapti: {health.service}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{settingsHelp.map(([key, description]) => <div key={key} className="rounded-xl bg-[#faf8f3] p-4"><code className="font-bold text-[#8f6725]">{key}</code><p className="mt-1 text-sm text-gray-600">{description}</p></div>)}</div>
        <a href="https://core.telegram.org/bots/webapps" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#8f6725]">Telegram Mini App hujjatlari <ExternalLink size={15} /></a>
      </article>
      <article className="rounded-3xl border border-[#7a1028]/15 bg-[#7a1028]/[.04] p-5"><h2 className="font-black text-[#7a1028]">Hamyon API · UZCARD</h2><p className="mt-2 text-sm leading-6 text-gray-700">Mini ilovada Hamyon to‘lov oqimi tayyor. Backend muhitida HAMYON_SHOP_ID, HAMYON_SHOP_KEY va HAMYON_CARD_ENCRYPTION_KEY sozlang; Hamyon kabinetida prepare_url va complete_url callback manzillarini ko‘rsating.</p></article>
    </section>
  )
}
