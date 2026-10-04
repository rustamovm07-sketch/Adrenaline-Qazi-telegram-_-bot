import { useEffect, useState } from 'react'
import {
  Check,
  Edit3,
  FolderTree,
  Image as ImageIcon,
  Loader2,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from 'lucide-react'

import {
  createCategory,
  deleteCategory,
  getCategories,
  type Category,
  type CategoryCreate,
  updateCategory,
} from '../api/categories'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

function getImageUrl(image: string | null) {
  if (!image) {
    return null
  }

  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image
  }

  const apiUrl =
    import.meta.env.VITE_API_URL ||
    window.location.origin

  return `${apiUrl.replace(/\/$/, '')}/${image.replace(/^\//, '')}`
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Noma’lum xatolik yuz berdi.'
}

function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] =
    useState<Category | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  async function loadCategories() {
    try {
      setLoading(true)
      setError(null)

      const data = await getCategories()
      setCategories(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial data is loaded asynchronously from the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCategories()
  }, [])

  function resetForm() {
    setName('')
    setDescription('')
    setSortOrder('0')
    setIsActive(true)
    setImage(null)
    setImagePreview(null)
    setEditingCategory(null)
  }

  function openCreateForm() {
    resetForm()
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  function openEditForm(category: Category) {
    setEditingCategory(category)
    setName(category.name)
    setDescription(category.description ?? '')
    setSortOrder(String(category.sort_order))
    setIsActive(category.is_active)
    setImage(null)
    setImagePreview(getImageUrl(category.image))
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  function closeForm() {
    if (saving) {
      return
    }

    setShowForm(false)
    resetForm()
  }

  function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      return
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError(
        'Rasm faqat JPG, PNG yoki WEBP formatida bo‘lishi kerak.',
      )
      event.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError('Rasm hajmi 5 MB dan oshmasligi kerak.')
      event.target.value = ''
      return
    }

    setError(null)
    setImage(file)

    const previewUrl = URL.createObjectURL(file)
    setImagePreview(previewUrl)
  }

  function removeSelectedImage() {
    setImage(null)

    if (imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }

    setImagePreview(
      editingCategory
        ? getImageUrl(editingCategory.image)
        : null,
    )
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Kategoriya nomini kiriting.')
      return
    }

    const parsedSortOrder = Number.parseInt(sortOrder, 10)

    if (
      Number.isNaN(parsedSortOrder) ||
      parsedSortOrder < 0
    ) {
      setError('Tartib raqami 0 yoki undan katta bo‘lishi kerak.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: trimmedName,
          description: description.trim() || null,
          image,
          sortOrder: parsedSortOrder,
          isActive,
        })

        setSuccess('Kategoriya muvaffaqiyatli yangilandi.')
      } else {
        const payload: CategoryCreate = {
          name: trimmedName,
          description: description.trim() || undefined,
          image,
          sortOrder: parsedSortOrder,
          isActive,
        }

        await createCategory(payload)

        setSuccess('Kategoriya muvaffaqiyatli yaratildi.')
      }

      setShowForm(false)
      resetForm()
      await loadCategories()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(category: Category) {
    const confirmed = window.confirm(
      `"${category.name}" kategoriyasini o‘chirishni xohlaysizmi?`,
    )

    if (!confirmed) {
      return
    }

    try {
      setDeletingId(category.id)
      setError(null)
      setSuccess(null)

      await deleteCategory(category.id)

      setSuccess('Kategoriya muvaffaqiyatli o‘chirildi.')
      await loadCategories()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleActive(category: Category) {
    try {
      setError(null)
      setSuccess(null)

      await updateCategory(category.id, {
        isActive: !category.is_active,
      })

      setSuccess(
        category.is_active
          ? 'Kategoriya deaktiv qilindi.'
          : 'Kategoriya aktiv qilindi.',
      )

      await loadCategories()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const filteredCategories = categories
    .filter((category) => {
      const query = search.trim().toLowerCase()

      if (!query) {
        return true
      }

      return (
        category.name.toLowerCase().includes(query) ||
        category.slug.toLowerCase().includes(query) ||
        (category.description ?? '')
          .toLowerCase()
          .includes(query)
      )
    })
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order
      }

      return a.name.localeCompare(b.name, 'uz')
    })

  const activeCount = categories.filter(
    (category) => category.is_active,
  ).length

  const inactiveCount =
    categories.length - activeCount

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#a77a2d]">
            MAHSULOTLAR TUZILMASI
          </p>

          <h1 className="mt-1 text-3xl font-black">
            Kategoriyalar
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Mahsulot kategoriyalarini qo‘shing, tahrirlang,
            tartiblang va boshqaring.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#a77a2d] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#8f6725]"
        >
          <Plus size={19} />
          Kategoriya qo‘shish
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <X size={18} className="mt-0.5 shrink-0" />

          <p className="flex-1">{error}</p>

          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
          <Check size={18} />
          <p className="flex-1">{success}</p>

          <button
            type="button"
            onClick={() => setSuccess(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">
            Jami kategoriyalar
          </p>

          <p className="mt-2 text-3xl font-black">
            {categories.length}
          </p>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">
            Aktiv
          </p>

          <p className="mt-2 text-3xl font-black text-green-600">
            {activeCount}
          </p>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">
            Deaktiv
          </p>

          <p className="mt-2 text-3xl font-black text-gray-400">
            {inactiveCount}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-black/5 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-black/5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black">
              Barcha kategoriyalar
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Do‘konda ko‘rinadigan kategoriyalar shu yerda
              boshqariladi.
            </p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Kategoriya qidirish..."
              className="h-11 w-full rounded-2xl border border-black/10 bg-[#faf8f3] pl-11 pr-4 text-sm outline-none transition focus:border-[#a77a2d]"
            />
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <Loader2
                  size={34}
                  className="mx-auto animate-spin text-[#a77a2d]"
                />

                <p className="mt-3 text-sm font-semibold text-gray-500">
                  Kategoriyalar yuklanmoqda...
                </p>
              </div>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl bg-[#faf8f3]">
              <div className="max-w-sm text-center">
                <FolderTree
                  size={44}
                  className="mx-auto text-gray-300"
                />

                <h3 className="mt-4 text-lg font-black">
                  {search
                    ? 'Kategoriya topilmadi'
                    : 'Hozircha kategoriya yo‘q'}
                </h3>

                <p className="mt-2 text-sm text-gray-400">
                  {search
                    ? 'Qidiruv so‘rovini o‘zgartirib ko‘ring.'
                    : 'Birinchi kategoriyani qo‘shishdan boshlang.'}
                </p>

                {!search && (
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#a77a2d] px-4 py-2.5 text-sm font-bold text-white"
                  >
                    <Plus size={17} />
                    Kategoriya qo‘shish
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCategories.map((category) => {
                const imageUrl = getImageUrl(category.image)

                return (
                  <div
                    key={category.id}
                    className="overflow-hidden rounded-3xl border border-black/5 bg-[#faf8f3]"
                  >
                    <div className="relative h-44 overflow-hidden bg-[#f1e5cf]">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={category.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <FolderTree
                            size={48}
                            className="text-[#b99a61]"
                          />
                        </div>
                      )}

                      <div className="absolute left-4 top-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-black ${
                            category.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {category.is_active
                            ? 'AKTIV'
                            : 'DEAKTIV'}
                        </span>
                      </div>

                      <div className="absolute right-4 top-4">
                        <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-black text-gray-600 backdrop-blur">
                          #{category.sort_order}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black">
                            {category.name}
                          </h3>

                          <p className="mt-1 truncate text-xs font-medium text-gray-400">
                            /{category.slug}
                          </p>
                        </div>

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white">
                          <FolderTree
                            size={17}
                            className="text-[#a77a2d]"
                          />
                        </div>
                      </div>

                      <p className="mt-4 min-h-[40px] text-sm leading-5 text-gray-500">
                        {category.description ||
                          'Kategoriya tavsifi kiritilmagan.'}
                      </p>

                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEditForm(category)
                          }
                          className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-bold text-gray-600 transition hover:bg-[#f1e5cf] hover:text-[#8f6725]"
                        >
                          <Edit3 size={15} />
                          Tahrir
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleToggleActive(
                              category,
                            )
                          }
                          className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-bold text-gray-600 transition hover:bg-[#f1e5cf] hover:text-[#8f6725]"
                        >
                          <Power size={15} />
                          {category.is_active
                            ? 'O‘chir'
                            : 'Yoq'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDelete(category)
                          }
                          disabled={
                            deletingId === category.id
                          }
                          className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-bold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === category.id ? (
                            <Loader2
                              size={15}
                              className="animate-spin"
                            />
                          ) : (
                            <Trash2 size={15} />
                          )}

                          O‘chir
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-xl font-black">
                  {editingCategory
                    ? 'Kategoriyani tahrirlash'
                    : 'Yangi kategoriya'}
                </h2>

                <p className="mt-1 text-xs text-gray-400">
                  Kategoriya ma’lumotlarini kiriting.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-5 sm:p-6"
            >
              <div>
                <label className="mb-2 block text-sm font-bold">
                  Kategoriya nomi
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Masalan: Qazi"
                  maxLength={100}
                  className="h-12 w-full rounded-2xl border border-black/10 bg-[#faf8f3] px-4 text-sm outline-none transition focus:border-[#a77a2d]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Tavsif
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Kategoriya haqida qisqacha ma’lumot..."
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-black/10 bg-[#faf8f3] px-4 py-3 text-sm outline-none transition focus:border-[#a77a2d]"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Tartib raqami
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={sortOrder}
                    onChange={(event) =>
                      setSortOrder(event.target.value)
                    }
                    className="h-12 w-full rounded-2xl border border-black/10 bg-[#faf8f3] px-4 text-sm outline-none transition focus:border-[#a77a2d]"
                  />

                  <p className="mt-2 text-xs text-gray-400">
                    Kategoriyalar shu raqam bo‘yicha
                    tartiblanadi.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Holati
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setIsActive((value) => !value)
                    }
                    className={`flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-bold transition ${
                      isActive
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500'
                    }`}
                  >
                    <span>
                      {isActive ? 'Aktiv' : 'Deaktiv'}
                    </span>

                    <span
                      className={`relative h-6 w-11 rounded-full transition ${
                        isActive
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                          isActive
                            ? 'left-6'
                            : 'left-1'
                        }`}
                      />
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Kategoriya rasmi
                </label>

                <div className="overflow-hidden rounded-2xl border border-dashed border-black/15 bg-[#faf8f3]">
                  {imagePreview ? (
                    <div className="relative h-52">
                      <img
                        src={imagePreview}
                        alt="Kategoriya preview"
                        className="h-full w-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={removeSelectedImage}
                        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-red-500 shadow-sm backdrop-blur"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center px-5 text-center">
                      <ImageIcon
                        size={36}
                        className="text-gray-300"
                      />

                      <p className="mt-3 text-sm font-bold text-gray-600">
                        Kategoriya rasmini tanlang
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        JPG, PNG yoki WEBP — maksimal 5 MB
                      </p>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-black/5 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="h-12 rounded-2xl bg-gray-100 px-5 text-sm font-bold text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
                >
                  Bekor qilish
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#a77a2d] px-6 text-sm font-black text-white transition hover:bg-[#8f6725] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                      Saqlanmoqda...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      {editingCategory
                        ? 'Saqlash'
                        : 'Kategoriya yaratish'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Categories
