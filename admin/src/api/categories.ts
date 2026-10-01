import { apiFetch } from './http'

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000'

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
  created_at?: string
  updated_at?: string
}

export type CategoryCreate = {
  name: string
  description?: string
  image?: File | null
  sortOrder?: number
  isActive?: boolean
}

export type CategoryUpdate = {
  name?: string
  description?: string | null
  image?: File | null
  sortOrder?: number
  isActive?: boolean
}

/* ============================================================
   ERROR TYPES
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

/* ============================================================
   ERROR PARSER
   ============================================================ */

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
   NORMALIZER
   ============================================================ */

function normalizeCategory(
  value: unknown,
): Category {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    throw new Error(
      'Backenddan noto‘g‘ri kategoriya ma’lumoti qaytdi',
    )
  }

  const category =
    value as Record<string, unknown>

  if (
    typeof category.id !== 'number' ||
    typeof category.name !== 'string' ||
    typeof category.slug !== 'string'
  ) {
    throw new Error(
      'Backenddan kategoriya ma’lumotlari to‘liq kelmadi',
    )
  }

  return {
    id: category.id,

    name: category.name,

    slug: category.slug,

    description:
      typeof category.description === 'string'
        ? category.description
        : null,

    image:
      typeof category.image === 'string'
        ? category.image
        : null,

    sort_order:
      typeof category.sort_order === 'number'
        ? category.sort_order
        : 0,

    is_active:
      typeof category.is_active === 'boolean'
        ? category.is_active
        : true,

    created_at:
      typeof category.created_at === 'string'
        ? category.created_at
        : undefined,

    updated_at:
      typeof category.updated_at === 'string'
        ? category.updated_at
        : undefined,
  }
}

/* ============================================================
   GET ALL CATEGORIES
   ============================================================ */

export async function getCategories(): Promise<
  Category[]
> {
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
      'Backenddan noto‘g‘ri kategoriya ro‘yxati qaytdi',
    )
  }

  return data.map(normalizeCategory)
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
      'Backenddan noto‘g‘ri kategoriya ro‘yxati qaytdi',
    )
  }

  return data.map(normalizeCategory)
}

/* ============================================================
   GET SINGLE CATEGORY
   ============================================================ */

export async function getCategory(
  categoryId: number,
): Promise<Category> {
  const response = await apiFetch(
    `${API_URL}/categories/${categoryId}`,
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Kategoriyani olishda xatolik',
    )

    throw new Error(message)
  }

  const data =
    (await response.json()) as unknown

  return normalizeCategory(data)
}

/* ============================================================
   CREATE CATEGORY
   ============================================================ */

export async function createCategory(
  category: CategoryCreate,
): Promise<Category> {
  const formData = new FormData()

  const name = category.name.trim()

  if (!name) {
    throw new Error(
      'Kategoriya nomini kiriting',
    )
  }

  formData.append(
    'name',
    name,
  )

  if (
    category.description?.trim()
  ) {
    formData.append(
      'description',
      category.description.trim(),
    )
  }

  if (
    category.sortOrder !== undefined
  ) {
    formData.append(
      'sort_order',
      String(category.sortOrder),
    )
  }

  if (
    category.isActive !== undefined
  ) {
    formData.append(
      'is_active',
      String(category.isActive),
    )
  }

  if (category.image) {
    formData.append(
      'image',
      category.image,
    )
  }

  const response = await apiFetch(
    `${API_URL}/categories/`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Kategoriya yaratishda xatolik',
    )

    throw new Error(message)
  }

  const data =
    (await response.json()) as unknown

  return normalizeCategory(data)
}

/* ============================================================
   UPDATE CATEGORY
   ============================================================ */

export async function updateCategory(
  categoryId: number,
  category: CategoryUpdate,
): Promise<Category> {
  const formData = new FormData()

  if (
    category.name !== undefined
  ) {
    const name =
      category.name.trim()

    if (!name) {
      throw new Error(
        'Kategoriya nomini kiriting',
      )
    }

    formData.append(
      'name',
      name,
    )
  }

  if (
    category.description !== undefined
  ) {
    formData.append(
      'description',
      category.description?.trim() || '',
    )
  }

  if (
    category.sortOrder !== undefined
  ) {
    formData.append(
      'sort_order',
      String(category.sortOrder),
    )
  }

  if (
    category.isActive !== undefined
  ) {
    formData.append(
      'is_active',
      String(category.isActive),
    )
  }

  if (category.image) {
    formData.append(
      'image',
      category.image,
    )
  }

  const response = await apiFetch(
    `${API_URL}/categories/${categoryId}`,
    {
      method: 'PUT',
      body: formData,
    },
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Kategoriyani yangilashda xatolik',
    )

    throw new Error(message)
  }

  const data =
    (await response.json()) as unknown

  return normalizeCategory(data)
}

/* ============================================================
   DELETE CATEGORY
   ============================================================ */

export async function deleteCategory(
  categoryId: number,
): Promise<void> {
  const response = await apiFetch(
    `${API_URL}/categories/${categoryId}`,
    {
      method: 'DELETE',
    },
  )

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      'Kategoriyani o‘chirishda xatolik',
    )

    throw new Error(message)
  }
}
