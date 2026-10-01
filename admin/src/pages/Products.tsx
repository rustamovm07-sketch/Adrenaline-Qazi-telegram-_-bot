import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  Archive,
  ImagePlus,
  Package,
  Plus,
  Search,
  Trash2,
  Upload,
  RotateCcw,
  X,
} from 'lucide-react'

import {
  createProduct,
  deleteProduct,
  getActiveCategories,
  getProducts,
  setProductAvailability,
  type Category,
  type Product,
} from '../api/products'

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000'

function formatPrice(price: number) {
  return new Intl.NumberFormat(
    'uz-UZ',
  ).format(price)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(
    'uz-UZ',
    {
      maximumFractionDigits: 3,
    },
  ).format(value)
}

export default function Products() {
  const [products, setProducts] =
    useState<Product[]>([])

  const [categories, setCategories] =
    useState<Category[]>([])

  const [loading, setLoading] =
    useState(true)

  const [categoriesLoading, setCategoriesLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [deletingId, setDeletingId] =
    useState<number | null>(null)

  const [showForm, setShowForm] =
    useState(false)

  const [search, setSearch] =
    useState('')

  const [showArchived, setShowArchived] = useState(false)

  const [name, setName] =
    useState('')

  const [price, setPrice] =
    useState('')

  const [categoryId, setCategoryId] =
    useState<number | ''>('')

  const [description, setDescription] =
    useState('')

  const [unitType, setUnitType] =
    useState<'kg' | 'dona'>('kg')

  const [weightPerUnit, setWeightPerUnit] =
    useState('1')

  const [stockUnits, setStockUnits] =
    useState('0')

  const [image, setImage] =
    useState<File | null>(null)

  const [imagePreview, setImagePreview] =
    useState<string | null>(null)

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  async function loadProducts() {
    try {
      setLoading(true)

      const data = await getProducts()

      setProducts(data)
    } catch (error) {
      console.error(error)

      alert(
        error instanceof Error
          ? error.message
          : 'Mahsulotlarni yuklab bo‘lmadi',
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadCategories() {
    try {
      setCategoriesLoading(true)

      const data =
        await getActiveCategories()

      setCategories(data)

      if (data.length > 0) {
        setCategoryId(
          (current) =>
            current === '' ||
            !data.some(
              (category) =>
                category.id === current,
            )
              ? data[0].id
              : current,
        )
      } else {
        setCategoryId('')
      }
    } catch (error) {
      console.error(error)

      alert(
        error instanceof Error
          ? error.message
          : 'Kategoriyalarni yuklab bo‘lmadi',
      )
    } finally {
      setCategoriesLoading(false)
    }
  }

  useEffect(() => {
    // Initial data is loaded asynchronously from API endpoints.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts()
    void loadCategories()
  }, [])

  function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp',
      ].includes(file.type)
    ) {
      alert(
        'Faqat JPG, PNG yoki WEBP rasm tanlang',
      )

      event.target.value = ''

      return
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      alert(
        'Rasm hajmi 5 MB dan oshmasligi kerak',
      )

      event.target.value = ''

      return
    }

    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview,
      )
    }

    setImage(file)

    const previewUrl =
      URL.createObjectURL(file)

    setImagePreview(previewUrl)
  }

  function removeImage() {
    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview,
      )
    }

    setImage(null)

    setImagePreview(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function resetForm() {
    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview,
      )
    }

    setName('')
    setPrice('')

    setCategoryId(
      categories.length > 0
        ? categories[0].id
        : '',
    )

    setDescription('')

    setUnitType('kg')
    setWeightPerUnit('1')
    setStockUnits('0')

    setImage(null)
    setImagePreview(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function closeForm() {
    if (saving) {
      return
    }

    resetForm()
    setShowForm(false)
  }

  async function handleCreateProduct() {
    if (!name.trim()) {
      alert(
        'Mahsulot nomini kiriting',
      )

      return
    }

    if (
      !price ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0
    ) {
      alert(
        'To‘g‘ri narx kiriting',
      )

      return
    }

    if (
      categoryId === '' ||
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      alert(
        'Kategoriyani tanlang',
      )

      return
    }

    if (
      !weightPerUnit ||
      !Number.isFinite(
        Number(weightPerUnit),
      ) ||
      Number(weightPerUnit) <= 0
    ) {
      alert(
        '1 dona og‘irligini to‘g‘ri kiriting',
      )

      return
    }

    if (
      stockUnits === '' ||
      !Number.isFinite(
        Number(stockUnits),
      ) ||
      Number(stockUnits) < 0
    ) {
      alert(
        'Stock miqdorini to‘g‘ri kiriting',
      )

      return
    }

    try {
      setSaving(true)

      await createProduct({
        name: name.trim(),

        price: Number(price),

        categoryId,

        description:
          description.trim(),

        unitType,

        weightPerUnit:
          Number(weightPerUnit),

        stockUnits:
          Number(stockUnits),

        image,
      })

      resetForm()

      setShowForm(false)

      await loadProducts()

      alert(
        'Mahsulot muvaffaqiyatli qo‘shildi',
      )
    } catch (error) {
      console.error(error)

      const message =
        error instanceof Error
          ? error.message
          : 'Noma’lum xatolik'

      alert(
        `Mahsulot qo‘shishda xatolik:\n${message}`,
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProduct(productId: number) {
    const confirmed = window.confirm("Mahsulotni do'kondan olib tashlaysizmi? Tarixli mahsulot arxivlanadi, tarixsiz mahsulot butunlay o'chadi.")
    if (!confirmed) return

    try {
      setDeletingId(productId)
      const result = await deleteProduct(productId)
      if (result.archived) {
        setProducts((current) => current.map((product) =>
          product.id === productId ? { ...product, is_available: false } : product,
        ))
      } else {
        setProducts((current) => current.filter((product) => product.id !== productId))
      }
      alert(result.message)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Mahsulotni olib tashlab bo'lmadi")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRestoreProduct(productId: number) {
    try {
      setDeletingId(productId)
      await setProductAvailability(productId, true)
      setProducts((current) => current.map((product) =>
        product.id === productId ? { ...product, is_available: true } : product,
      ))
    } catch (error) {
      alert(error instanceof Error ? error.message : "Mahsulotni tiklab bo'lmadi")
    } finally {
      setDeletingId(null)
    }
  }

  const filteredProducts =
    products.filter((product) => showArchived || product.is_available).filter((product) => {
      const query =
        search
          .trim()
          .toLowerCase()

      if (!query) {
        return true
      }

      return `${product.name} ${product.category}`
        .toLowerCase()
        .includes(query)
    })

  return (
    <div>
      {/* HEADER */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#a77a2d]">
            KATALOG
          </p>

          <h1 className="mt-1 text-3xl font-black">
            Mahsulotlar
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Do‘koningizdagi barcha
            mahsulotlarni boshqaring.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowForm(true)
          }
          disabled={
            categoriesLoading ||
            categories.length === 0
          }
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#c49a4b] px-5 py-3.5 text-sm font-black text-[#211a10] shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={19} />

          Mahsulot qo‘shish
        </button>
      </div>

      {/* SEARCH */}
      <div className="mt-7 flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 shadow-sm">
        <Search
          size={19}
          className="text-gray-400"
        />

        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value,
            )
          }
          placeholder="Mahsulot qidirish..."
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      <button
        type="button"
        aria-pressed={showArchived}
        onClick={() => setShowArchived((value) => !value)}
        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold text-gray-600"
      >
        <Archive size={16} />
        {showArchived ? 'Arxivlanganlar ko‘rsatilmoqda' : 'Arxivlanganlarni ko‘rsatish'}
      </button>

      {/* CATEGORY EMPTY STATE */}
      {!categoriesLoading &&
        categories.length === 0 && (
          <div className="mt-8 rounded-3xl border border-black/5 bg-white p-8 text-center shadow-sm">
            <Package
              size={44}
              className="mx-auto text-gray-300"
            />

            <h2 className="mt-4 text-xl font-black">
              Kategoriya mavjud emas
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
              Mahsulot qo‘shishdan oldin
              kamida bitta faol kategoriya
              yaratilishi kerak.
            </p>
          </div>
        )}

      {/* PRODUCTS */}
      {loading ? (
        <div className="mt-8 rounded-3xl bg-white p-12 text-center">
          <p className="text-sm font-semibold text-gray-400">
            Mahsulotlar yuklanmoqda...
          </p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-black/5 bg-white p-12 text-center shadow-sm">
          <Package
            size={48}
            className="mx-auto text-gray-300"
          />

          <h2 className="mt-4 text-xl font-black">
            Mahsulot topilmadi
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            Hozircha katalogda
            mahsulot yo‘q.
          </p>

          {categories.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setShowForm(true)
              }
              className="mt-5 rounded-2xl bg-[#c49a4b] px-5 py-3 text-sm font-black"
            >
              Birinchi mahsulotni qo‘shish
            </button>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map(
            (product) => {
              const totalKg =
                Number(
                  product.weight_per_unit ||
                    0,
                ) *
                Number(
                  product.stock_units ||
                    0,
                )

              return (
                <div
                  key={product.id}
                  className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm"
                >
                  {/* IMAGE */}
                  <div className="flex h-48 items-center justify-center bg-[#faf8f3] p-2">
                    {product.image ? (
                      <img
                        src={
                          product.image.startsWith(
                            'http',
                          )
                            ? product.image
                            : `${API_URL}${product.image}`
                        }
                        alt={product.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <ImagePlus
                        size={42}
                        className="text-gray-300"
                      />
                    )}
                  </div>

                  <div className="p-5">
                    {/* NAME */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#a77a2d]">
                          {product.category}
                        </p>

                        <h3 className="mt-1 text-lg font-black">
                          {product.name}
                        </h3>
                      </div>

                      {product.is_available ? (
                        <button type="button" aria-label="Mahsulotni arxivlash" title="Do'kondan olib tashlash" onClick={() => handleDeleteProduct(product.id)} disabled={deletingId === product.id} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 disabled:opacity-50">
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <button type="button" aria-label="Mahsulotni tiklash" title="Mahsulotni qayta faollashtirish" onClick={() => handleRestoreProduct(product.id)} disabled={deletingId === product.id} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 disabled:opacity-50">
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>

                    {/* DESCRIPTION */}
                    {product.description && (
                      <p className="mt-3 line-clamp-2 text-sm leading-5 text-gray-500">
                        {product.description}
                      </p>
                    )}

                    {/* STOCK */}
                    <div className="mt-5 rounded-2xl bg-[#faf8f3] p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#a77a2d]">
                        Ombor
                      </p>

                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-lg font-black">
                            {formatNumber(
                              Number(
                                product.stock_units ||
                                  0,
                              ),
                            )}{' '}
                            {product.unit_type === 'dona' ? 'dona' : 'kg'}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Sotuvga: {formatNumber(product.available_stock_units)}; band: {formatNumber(product.reserved_stock_units)}
                          </p>

                          {product.unit_type === 'dona' && <p className="mt-1 text-sm text-gray-500">
                            1 dona ={' '}
                            {formatNumber(
                              Number(
                                product.weight_per_unit ||
                                  0,
                              ),
                            )}{' '}
                            kg
                          </p>}
                        </div>

                        <div className="text-right">
                          <p className="text-xl font-black text-[#a77a2d]">
                            {formatNumber(
                              totalKg,
                            )}{' '}
                            kg
                          </p>

                          <p className="text-xs text-gray-400">
                            jami
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* PRICE + STATUS */}
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-[#a77a2d]">
                          {formatPrice(
                            product.price,
                          )}{' '}
                          so‘m
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          1 kg uchun
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          product.is_available
                            ? 'bg-green-50 text-green-600'
                            : 'bg-red-50 text-red-500'
                        }`}
                      >
                        {product.is_available
                          ? 'Mavjud'
                          : 'Mavjud emas'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            },
          )}
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-white p-6 sm:rounded-[28px]">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#a77a2d]">
                  KATALOG
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Mahsulot qo‘shish
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-7 space-y-5">
              {/* IMAGE */}
              <div>
                <label className="mb-2 block text-sm font-bold">
                  Mahsulot rasmi
                </label>

                {imagePreview ? (
                  <div className="relative overflow-hidden rounded-2xl border border-black/10">
                    <img
                      src={imagePreview}
                      alt="Tanlangan rasm"
                      className="max-h-80 w-full bg-[#faf8f3] object-contain"
                    />

                    <button
                      type="button"
                      onClick={removeImage}
                      disabled={saving}
                      className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-red-500 shadow disabled:opacity-50"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={saving}
                    className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#c49a4b]/40 bg-[#faf8f3] px-5 py-10 transition hover:border-[#c49a4b] disabled:opacity-50"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c49a4b]/15 text-[#a77a2d]">
                      <Upload size={25} />
                    </div>

                    <p className="mt-4 text-sm font-black">
                      Rasm tanlash
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      JPG, PNG yoki WEBP —
                      maksimal 5 MB
                    </p>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* NAME */}
              <div>
                <label className="mb-2 block text-sm font-bold">
                  Mahsulot nomi
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value,
                    )
                  }
                  placeholder="Masalan: Premium Qazi"
                  className="w-full rounded-2xl border border-black/10 px-4 py-4 text-sm outline-none focus:border-[#c49a4b]"
                />
              </div>

              {/* PRICE + CATEGORY */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Narxi / kg
                  </label>

                  <input
                    value={price}
                    onChange={(event) =>
                      setPrice(
                        event.target.value,
                      )
                    }
                    type="number"
                    min="0"
                    step="1"
                    placeholder="180000"
                    className="w-full rounded-2xl border border-black/10 px-4 py-4 text-sm outline-none focus:border-[#c49a4b]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Kategoriya
                  </label>

                  <select
                    value={categoryId}
                    onChange={(event) =>
                      setCategoryId(
                        event.target.value
                          ? Number(
                              event.target.value,
                            )
                          : '',
                      )
                    }
                    disabled={
                      categoriesLoading ||
                      categories.length === 0
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none focus:border-[#c49a4b] disabled:bg-gray-100"
                  >
                    {categoriesLoading ? (
                      <option value="">
                        Yuklanmoqda...
                      </option>
                    ) : categories.length ===
                      0 ? (
                      <option value="">
                        Kategoriya yo‘q
                      </option>
                    ) : (
                      categories.map(
                        (category) => (
                          <option
                            key={category.id}
                            value={category.id}
                          >
                            {category.name}
                          </option>
                        ),
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* UNIT + WEIGHT */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold">
                    O‘lchov birligi
                  </label>

                  <select
                    value={unitType}
                    onChange={(event) =>
                      setUnitType(
                        event.target.value as
                          | 'kg'
                          | 'dona',
                      )
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none focus:border-[#c49a4b]"
                  >
                    <option value="kg">
                      Kilogramm (kg)
                    </option>

                    <option value="dona">
                      Dona
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    1 dona og‘irligi
                  </label>

                  <div className="relative">
                    <input
                      value={weightPerUnit}
                      onChange={(event) =>
                        setWeightPerUnit(
                          event.target.value,
                        )
                      }
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="1.2"
                      className="w-full rounded-2xl border border-black/10 px-4 py-4 pr-14 text-sm outline-none focus:border-[#c49a4b]"
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                      kg
                    </span>
                  </div>
                </div>
              </div>

              {/* STOCK */}
              <div>
                <label className="mb-2 block text-sm font-bold">
                  Ombordagi stock
                </label>

                <div className="relative">
                  <input
                    value={stockUnits}
                    onChange={(event) =>
                      setStockUnits(
                        event.target.value,
                      )
                    }
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="100"
                    className="w-full rounded-2xl border border-black/10 px-4 py-4 pr-20 text-sm outline-none focus:border-[#c49a4b]"
                  />

                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                    dona
                  </span>
                </div>
              </div>

              {/* AUTO CALCULATION */}
              <div className="rounded-2xl bg-[#faf8f3] p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#a77a2d]">
                  Jami stock
                </p>

                <p className="mt-1 text-3xl font-black text-[#211a10]">
                  {formatNumber(
                    Number(
                      weightPerUnit || 0,
                    ) *
                      Number(
                        stockUnits || 0,
                      ),
                  )}{' '}
                  kg
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {stockUnits || 0} dona ×{' '}
                  {weightPerUnit || 0} kg
                </p>
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="mb-2 block text-sm font-bold">
                  Tavsif
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  rows={4}
                  placeholder="Mahsulot haqida qisqacha..."
                  className="w-full resize-none rounded-2xl border border-black/10 px-4 py-4 text-sm outline-none focus:border-[#c49a4b]"
                />
              </div>

              {/* SAVE */}
              <button
                type="button"
                onClick={handleCreateProduct}
                disabled={
                  saving ||
                  categoriesLoading ||
                  categories.length === 0
                }
                className="w-full rounded-2xl bg-[#c49a4b] py-4 text-sm font-black text-[#211a10] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? 'Saqlanmoqda...'
                  : 'Mahsulotni saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
