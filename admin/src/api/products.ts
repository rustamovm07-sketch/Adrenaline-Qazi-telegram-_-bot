import { apiFetch } from './http'

const API_URL =
  import.meta.env.VITE_API_URL ||
  window.location.origin

/* ============================================================
   TYPES
   ============================================================ */

export type Category = {
  id: number
  name: string
  slug: string
  description: string | null
  image: string | null
  sort_order: number
  is_active: boolean
}

export type Product = {
  id: number
  name: string
  description: string | null
  price: number

  /*
   * Hozirgi Products.tsx bilan vaqtinchalik
   * backward-compatible qoladi.
   *
   * Keyingi Products.tsx bosqichida
   * category_id va Category obyektidan foydalanamiz.
   */
  category: string

  category_id: number

  image: string | null

  unit_type: 'kg' | 'dona'
  weight_per_unit: number
  stock_units: number
  reserved_stock_units: number
  available_stock_units: number

  is_available: boolean
}

export type ProductCreate = {
  name: string
  price: number

  /*
   * Keyingi admin UI categoryId yuboradi.
   *
   * category esa hozirgi Products.tsx buzilmasligi
   * uchun vaqtincha qabul qilinadi.
   */
  categoryId?: number
  category?: string

  description?: string

  unitType: 'kg' | 'dona'
  weightPerUnit: number
  stockUnits: number

  image?: File | null
}

/* ============================================================
   API ERROR
   ============================================================ */

type FastAPIValidationError = {
  msg?: string
}

type FastAPIErrorResponse = {
  detail?:
    | string
    | FastAPIValidationError[]
    | unknown
}

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data =
      (await response.json()) as FastAPIErrorResponse

    if (typeof data.detail === 'string') {
      return data.detail
    }

    if (Array.isArray(data.detail)) {
      const messages = data.detail
        .map((item) => {
          if (
            item &&
            typeof item === 'object' &&
            'msg' in item &&
            typeof item.msg === 'string'
          ) {
            return item.msg
          }

          return null
        })
        .filter(
          (message): message is string =>
            Boolean(message),
        )

      if (messages.length > 0) {
        return messages.join(', ')
      }
    }
  } catch {
    // JSON bo'lmasa fallback ishlatiladi.
  }

  return fallback
}

/* ============================================================
   CATEGORY NORMALIZATION
   ============================================================ */

function normalizeCategory(
  category: unknown,
): Category | null {
  if (
    !category ||
    typeof category !== 'object'
  ) {
    return null
  }

  const value = category as Partial<Category>

  if (
    typeof value.id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.slug !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    description:
      typeof value.description === 'string'
        ? value.description
        : null,
    image:
      typeof value.image === 'string'
        ? value.image
        : null,
    sort_order:
      typeof value.sort_order === 'number'
        ? value.sort_order
        : 0,
    is_active:
      typeof value.is_active === 'boolean'
        ? value.is_active
        : true,
  }
}

/* ============================================================
   PRODUCT NORMALIZATION
   ============================================================ */

function normalizeProduct(
  value: unknown,
): Product {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    throw new Error(
      'Backenddan noto‘g‘ri mahsulot ma’lumoti qaytdi',
    )
  }

  const product =
    value as Record<string, unknown>

  const numericValue = (field: unknown): number | null => {
    if (typeof field !== 'number' && typeof field !== 'string') return null
    if (typeof field === 'string' && !field.trim()) return null
    const parsed = Number(field)
    return Number.isFinite(parsed) ? parsed : null
  }

  const categoryObject =
    normalizeCategory(product.category)

  const categoryName =
    categoryObject?.name ||
    (typeof product.category === 'string'
      ? product.category
      : '')

  const categoryId =
    numericValue(product.category_id) ?? categoryObject?.id
  const id = numericValue(product.id)
  const price = numericValue(product.price)

  if (
    id === null ||
    typeof product.name !== 'string' ||
    price === null ||
    categoryId === undefined ||
    !Number.isInteger(categoryId)
  ) {
    throw new Error(
      'Backenddan mahsulot ma’lumotlari to‘liq kelmadi',
    )
  }

  return {
    id,
    name: product.name,

    description:
      typeof product.description === 'string'
        ? product.description
        : null,

    price,

    /*
     * Hozirgi Products.tsx bilan moslik.
     */
    category: categoryName,

    category_id: categoryId,

    image:
      typeof product.image === 'string'
        ? product.image
        : null,

    unit_type:
      product.unit_type === 'dona'
        ? 'dona'
        : 'kg',

    weight_per_unit:
      numericValue(product.weight_per_unit) ?? 0,

    stock_units:
      numericValue(product.stock_units) ?? 0,

    reserved_stock_units:
      numericValue(product.reserved_stock_units) ?? 0,

    available_stock_units:
      numericValue(product.available_stock_units) ?? 0,

    is_available:
      typeof product.is_available === 'boolean'
        ? product.is_available
        : false,
  }
}

/* ============================================================
   GET CATEGORIES
   ============================================================ */

export async function getCategories(): Promise<Category[]> {
  const response = await apiFetch(
    `${API_URL}/categories/`,
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Kategoriyalarni olishda xatolik',
    )

    throw new Error(message)
  }

  const data =
    (await response.json()) as unknown

  if (!Array.isArray(data)) {
    throw new Error(
      'Backenddan noto‘g‘ri kategoriya ma’lumoti qaytdi',
    )
  }

  return data
    .map(normalizeCategory)
    .filter(
      (category): category is Category =>
        category !== null,
    )
}

/* ============================================================
   GET ACTIVE CATEGORIES
   ============================================================ */

export async function getActiveCategories(): Promise<
  Category[]
> {
  const response = await apiFetch(
    `${API_URL}/categories/active`,
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Faol kategoriyalarni olishda xatolik',
    )

    throw new Error(message)
  }

  const data =
    (await response.json()) as unknown

  if (!Array.isArray(data)) {
    throw new Error(
      'Backenddan noto‘g‘ri kategoriya ma’lumoti qaytdi',
    )
  }

  return data
    .map(normalizeCategory)
    .filter(
      (category): category is Category =>
        category !== null,
    )
}

/* ============================================================
   GET PRODUCTS
   ============================================================ */

export async function getProducts(): Promise<Product[]> {
  const response = await apiFetch(
    `${API_URL}/products/`,
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Mahsulotlarni olishda xatolik',
    )

    throw new Error(message)
  }

  const data =
    (await response.json()) as unknown

  if (!Array.isArray(data)) {
    throw new Error(
      'Backenddan noto‘g‘ri mahsulot ma’lumoti qaytdi',
    )
  }

  return data.map(normalizeProduct)
}

/* ============================================================
   GET SINGLE PRODUCT
   ============================================================ */

export async function getProduct(
  productId: number,
): Promise<Product> {
  const response = await apiFetch(
    `${API_URL}/products/${productId}`,
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Mahsulotni olishda xatolik',
    )

    throw new Error(message)
  }

  const data =
    (await response.json()) as unknown

  return normalizeProduct(data)
}

/* ============================================================
   CREATE PRODUCT
   ============================================================ */

export async function createProduct(
  product: ProductCreate,
): Promise<Product> {
  let categoryId = product.categoryId

  /*
   * Hozirgi Products.tsx hali category nomini
   * yuborayotgan bo‘lsa, API avtomatik ravishda
   * mos kategoriya ID sini topadi.
   *
   * Keyingi Products.tsx bosqichida esa
   * to‘g‘ridan-to‘g‘ri categoryId yuboriladi.
   */
  if (
    categoryId === undefined &&
    product.category?.trim()
  ) {
    const categories =
      await getCategories()

    const normalizedName =
      product.category
        .trim()
        .toLocaleLowerCase('uz-UZ')

    const matchedCategory =
      categories.find(
        (category) =>
          category.name
            .trim()
            .toLocaleLowerCase('uz-UZ') ===
          normalizedName,
      )

    if (!matchedCategory) {
      throw new Error(
        `"${product.category}" kategoriyasi topilmadi`,
      )
    }

    categoryId = matchedCategory.id
  }

  if (
    categoryId === undefined ||
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    throw new Error(
      'Mahsulot uchun kategoriya tanlanmagan',
    )
  }

  const formData = new FormData()

  formData.append(
    'name',
    product.name.trim(),
  )

  formData.append(
    'price',
    String(product.price),
  )

  formData.append(
    'category_id',
    String(categoryId),
  )

  if (product.description?.trim()) {
    formData.append(
      'description',
      product.description.trim(),
    )
  }

  formData.append(
    'unit_type',
    product.unitType,
  )

  formData.append(
    'weight_per_unit',
    String(product.weightPerUnit),
  )

  formData.append(
    'stock_units',
    String(product.stockUnits),
  )

  if (product.image) {
    formData.append(
      'image',
      product.image,
    )
  }

  const response = await apiFetch(
    `${API_URL}/products/`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Mahsulot yaratishda xatolik',
    )

    throw new Error(message)
  }

  const data =
    (await response.json()) as unknown

  return normalizeProduct(data)
}

/* ============================================================
   DELETE PRODUCT
   ============================================================ */

export async function deleteProduct(
  productId: number,
): Promise<{ archived: boolean; message: string }> {
  const response = await apiFetch(
    `${API_URL}/products/${productId}`,
    {
      method: 'DELETE',
    },
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Mahsulotni o‘chirishda xatolik',
    )

    throw new Error(message)
  }

  return (await response.json()) as { archived: boolean; message: string }
}

export async function setProductAvailability(
  productId: number,
  isAvailable: boolean,
): Promise<void> {
  const response = await apiFetch(
    `${API_URL}/products/${productId}/availability?is_available=${isAvailable}`,
    { method: 'PATCH' },
  )
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Mahsulot holatini o\'zgartirib bo\'lmadi'))
  }
}
