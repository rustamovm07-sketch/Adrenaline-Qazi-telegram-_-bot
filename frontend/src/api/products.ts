/*
 * ============================================================
 * ADRENALIN QAZI
 * Customer Frontend — Products API
 * ============================================================
 *
 * Bu file faqat frontendning backend Products API
 * bilan ishlash qatlamidir.
 *
 * Arxitektura:
 *
 * React/Vite
 *     ↓
 * api/products.ts
 *     ↓
 * FastAPI
 *     ↓
 * PostgreSQL
 *
 * Category endi Product ichidagi oddiy string emas.
 *
 * Product:
 *   category_id
 *   category: Category
 *
 * Category:
 *   id
 *   name
 *   slug
 *   description
 *   image
 *   sort_order
 *   is_active
 *
 * Kelajakda:
 * - Telegram Mini App
 * - authentication
 * - promo/discount
 * - payment
 * - recommendations
 *
 * qo'shilganda ushbu API qatlamini qayta buzmaslik
 * uchun type'lar shu yerda markazlashtirilgan.
 * ============================================================
 */

/*
 * ============================================================
 * API BASE URL
 * ============================================================
 *
 * Development:
 *   http://127.0.0.1:8000
 *
 * Productionda VITE_API_URL orqali o'zgartirish mumkin:
 *
 * VITE_API_URL=https://api.example.com
 *
 * Shunda frontend kodini o'zgartirish shart emas.
 */

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000'

/*
 * ============================================================
 * CATEGORY TYPE
 * ============================================================
 *
 * Backend:
 * GET /categories/
 *
 * va Product response ichidagi:
 *
 * category: Category
 *
 * uchun ishlatiladi.
 */

export type Category = {
  id: number
  name: string
  slug: string
  description: string | null
  image: string | null
  sort_order: number
  is_active: boolean
}

/*
 * ============================================================
 * PRODUCT UNIT TYPE
 * ============================================================
 */

export type ProductUnitType =
  | 'kg'
  | 'dona'

/*
 * ============================================================
 * PRODUCT
 * ============================================================
 *
 * Backend Product model bilan mos:
 *
 * id
 * name
 * description
 * price
 * category_id
 * category
 * image
 * unit_type
 * weight_per_unit
 * stock_units
 * is_available
 *
 * price:
 *   1 kg narxi
 *
 * Agar unit_type = dona:
 *
 *   1 dona narxi =
 *   price × weight_per_unit
 *
 * stock_units:
 *
 * dona mahsulot:
 *   dona soni
 *
 * kg mahsulot:
 *   kg miqdori
 */

export type Product = {
  id: number

  name: string

  description: string | null

  price: number

  category_id: number

  category: Category

  image: string | null

  unit_type: ProductUnitType

  weight_per_unit: number

  stock_units: number

  reserved_stock_units: number

  available_stock_units: number

  is_available: boolean
}

/*
 * ============================================================
 * API ERROR
 * ============================================================
 *
 * Backenddan keladigan xatolarni frontendda
 * bir xil formatda boshqarish uchun.
 */

type ApiErrorResponse = {
  detail?:
    | string
    | Array<{
        msg?: string
        loc?: Array<
          string | number
        >
        type?: string
      }>
}

/*
 * ============================================================
 * API ERROR PARSER
 * ============================================================
 *
 * FastAPI validation error:
 *
 * {
 *   "detail": [
 *      {
 *        "loc": [...],
 *        "msg": "...",
 *        "type": "..."
 *      }
 *   ]
 * }
 *
 * yoki oddiy:
 *
 * {
 *   "detail": "..."
 * }
 *
 * ikkalasini ham tushunadi.
 */

async function getApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data =
      (await response.json()) as ApiErrorResponse

    if (
      typeof data.detail ===
      'string'
    ) {
      return data.detail
    }

    if (
      Array.isArray(data.detail)
    ) {
      const messages =
        data.detail
          .map(
            (item) =>
              item.msg,
          )
          .filter(
            (
              message,
            ): message is string =>
              Boolean(message),
          )

      if (
        messages.length > 0
      ) {
        return messages.join(
          ', ',
        )
      }
    }
  } catch {
    /*
     * Backend JSON qaytarmasa
     * fallback ishlatiladi.
     */
  }

  return fallback
}

/*
 * ============================================================
 * API REQUEST HELPER
 * ============================================================
 *
 * GET requestlar uchun markazlashtirilgan helper.
 *
 * Keyinchalik authentication qo'shilganda
 * kerak bo'lsa shu qatlamda:
 *
 * Authorization
 * Telegram initData
 * request headers
 *
 * boshqarilishi mumkin.
 */

async function apiGet<T>(
  path: string,
  fallbackMessage: string,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(
      `${API_URL}${path}`,
      {
        method: 'GET',
        headers: {
          Accept:
            'application/json',
        },
      },
    )
  } catch (error) {
    console.error(
      'API network error:',
      error,
    )

    // The request failed before receiving a response; keep the original cause for diagnostics.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(
      'Server bilan bog‘lanib bo‘lmadi.',
    )
  }

  if (!response.ok) {
    const message =
      await getApiErrorMessage(
        response,
        fallbackMessage,
      )

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

/*
 * ============================================================
 * GET PRODUCTS
 * ============================================================
 *
 * Barcha mahsulotlarni oladi.
 *
 * Backend:
 * GET /products/
 *
 * Backend faqat mavjud / available mahsulotlarni
 * filtrlashi shart emas.
 *
 * Chunki admin panelga ham keyinchalik
 * barcha mahsulotlar kerak bo'ladi.
 *
 * Customer frontend esa:
 *
 * - is_available
 * - stock_units
 *
 * orqali mahsulotni ko'rsatadi.
 */

export async function getProducts(): Promise<
  Product[]
> {
  return apiGet<Product[]>(
    '/products/',
    'Mahsulotlarni olishda xatolik',
  )
}

/*
 * ============================================================
 * GET PRODUCT
 * ============================================================
 *
 * Bitta mahsulot.
 *
 * Backend endpoint:
 *
 * GET /products/{product_id}
 *
 * Agar backendda hozircha ushbu endpoint bo'lmasa,
 * keyingi backend Products file yakunlanganda
 * endpoint ham umumiy arxitekturaga mos ravishda
 * mavjud bo'ladi.
 */

export async function getProduct(
  productId: number,
): Promise<Product> {
  return apiGet<Product>(
    `/products/${productId}`,
    'Mahsulotni olishda xatolik',
  )
}

/*
 * ============================================================
 * GET ACTIVE CATEGORIES
 * ============================================================
 *
 * Customer frontendga faqat:
 *
 * is_active = true
 *
 * kategoriyalar kerak.
 *
 * Backend:
 *
 * GET /categories/active
 *
 * Bu App.tsx ichida Product.category dan
 * kategoriya yasashga qaraganda to'g'riroq
 * arxitektura.
 *
 * Sababi:
 *
 * Kategoriya mahsulotsiz ham mavjud bo'lishi mumkin.
 *
 * Masalan:
 *
 * Qazi
 * Kolbasa
 * Ot go'shti
 * Maxsus mahsulotlar
 *
 * hali mahsulot bo'lmasa ham kategoriya
 * admin panelda mavjud bo'lishi mumkin.
 */

export async function getActiveCategories(): Promise<
  Category[]
> {
  return apiGet<Category[]>(
    '/categories/active',
    'Kategoriyalarni olishda xatolik',
  )
}

/*
 * ============================================================
 * GET ALL CATEGORIES
 * ============================================================
 *
 * Hozir customer frontend uchun shart emas.
 *
 * Lekin API qatlamida saqlanadi.
 *
 * Keyinchalik:
 *
 * - search
 * - category page
 * - category analytics
 * - recommendations
 *
 * uchun ishlatilishi mumkin.
 *
 * Backend:
 *
 * GET /categories/
 */

export async function getCategories(): Promise<
  Category[]
> {
  return apiGet<Category[]>(
    '/categories/',
    'Kategoriyalarni olishda xatolik',
  )
}

/*
 * ============================================================
 * PRODUCT IMAGE URL
 * ============================================================
 *
 * Backend image qiymati:
 *
 * /uploads/products/file.webp
 *
 * bo'lishi mumkin.
 *
 * Yoki kelajakda CDN:
 *
 * https://cdn.example.com/file.webp
 *
 * bo'lishi mumkin.
 *
 * Shu sababli absolute URL'ni qayta
 * backend URL bilan birlashtirmaymiz.
 */

export function getProductImageUrl(
  image: string | null,
): string | null {
  if (!image) {
    return null
  }

  const normalizedImage =
    image.trim()

  if (
    !normalizedImage
  ) {
    return null
  }

  /*
   * Absolute URL.
   */
  if (
    normalizedImage.startsWith(
      'http://',
    ) ||
    normalizedImage.startsWith(
      'https://',
    )
  ) {
    return normalizedImage
  }

  /*
   * Protocol-relative URL.
   *
   * Masalan:
   *
   * //cdn.example.com/image.webp
   */
  if (
    normalizedImage.startsWith(
      '//',
    )
  ) {
    return `${
      window.location.protocol
    }${normalizedImage}`
  }

  /*
   * Relative backend path.
   *
   * /uploads/products/...
   */
  if (
    normalizedImage.startsWith(
      '/',
    )
  ) {
    return `${API_URL}${normalizedImage}`
  }

  /*
   * Agar backend:
   *
   * uploads/products/file.webp
   *
   * ko'rinishida qaytarsa.
   */
  return `${API_URL}/${normalizedImage}`
}

/*
 * ============================================================
 * CATEGORY IMAGE URL
 * ============================================================
 *
 * Category ham keyinchalik rasmga ega bo'ladi.
 *
 * Masalan:
 *
 * /uploads/categories/qazi.webp
 *
 * Shu helper category kartochkalari yoki
 * category page uchun ishlatiladi.
 */

export function getCategoryImageUrl(
  image: string | null,
): string | null {
  if (!image) {
    return null
  }

  const normalizedImage =
    image.trim()

  if (
    !normalizedImage
  ) {
    return null
  }

  if (
    normalizedImage.startsWith(
      'http://',
    ) ||
    normalizedImage.startsWith(
      'https://',
    )
  ) {
    return normalizedImage
  }

  if (
    normalizedImage.startsWith(
      '//',
    )
  ) {
    return `${
      window.location.protocol
    }${normalizedImage}`
  }

  if (
    normalizedImage.startsWith(
      '/',
    )
  ) {
    return `${API_URL}${normalizedImage}`
  }

  return `${API_URL}/${normalizedImage}`
}

/*
 * ============================================================
 * PRODUCT PRICE HELPERS
 * ============================================================
 *
 * Bu hisob-kitob faqat UI uchun.
 *
 * Muhim:
 *
 * Backend checkout paytida narxni qayta hisoblaydi.
 *
 * Frontenddagi qiymatga hech qachon
 * moliyaviy ishonch berilmaydi.
 *
 * Bu security uchun juda muhim.
 */

/*
 * 1 dona mahsulotning UI narxi.
 *
 * price = 1 kg narxi
 *
 * weight_per_unit = 1 dona kg
 *
 * 1 dona:
 *
 * price × weight_per_unit
 */

export function getProductUnitPrice(
  product: Product,
): number {
  if (
    product.unit_type ===
    'dona'
  ) {
    return (
      product.price *
      product.weight_per_unit
    )
  }

  return product.price
}

/*
 * Mahsulotning 1 birlikdagi label'i.
 */

export function getProductUnitLabel(
  product: Product,
): string {
  return product.unit_type ===
    'dona'
    ? 'dona'
    : 'kg'
}

/*
 * Mahsulot narxini UI uchun
 * tayyor stringga aylantiradi.
 */

export function getProductPriceLabel(
  product: Product,
): string {
  const price =
    getProductUnitPrice(
      product,
    )

  const formatted =
    new Intl.NumberFormat(
      'uz-UZ',
    ).format(
      Math.round(price),
    )

  return `${formatted} so‘m / ${getProductUnitLabel(
    product,
  )}`
}

/*
 * Stock label.
 */

export function getProductStockLabel(
  product: Product,
): string {
  const formatted =
    new Intl.NumberFormat(
      'uz-UZ',
    ).format(
      product.available_stock_units,
    )

  return `${formatted} ${getProductUnitLabel(
    product,
  )}`
}

/*
 * Mahsulot mavjud yoki yo'qligi.
 *
 * Customer frontenddagi buttonlar
 * uchun ishlatilishi mumkin.
 */

export function isProductAvailable(
  product: Product,
): boolean {
  return (
    product.is_available &&
    product.available_stock_units > 0
  )
}

/*
 * ============================================================
 * PRODUCT CATEGORY HELPERS
 * ============================================================
 *
 * App ichida:
 *
 * product.category.name
 *
 * ishlatiladi.
 *
 * Bu helper fallback sifatida ishlaydi.
 */

export function getProductCategoryName(
  product: Product,
): string {
  return (
    product.category?.name ||
    'Boshqa'
  )
}

/*
 * Category slug.
 *
 * URL routing keyinchalik kerak bo'lsa:
 *
 * /category/qazi
 *
 * kabi ishlatish mumkin.
 */

export function getProductCategorySlug(
  product: Product,
): string {
  return (
    product.category?.slug ||
    ''
  )
}

/*
 * ============================================================
 * PRODUCT SEARCH HELPER
 * ============================================================
 *
 * Frontend local search uchun.
 *
 * Qidiruv:
 *
 * product name
 * description
 * category name
 * category slug
 *
 * bo'yicha ishlaydi.
 *
 * Keyinchalik katta katalog bo'lganda
 * backend search endpointga o'tish mumkin.
 */

export function productMatchesSearch(
  product: Product,
  search: string,
): boolean {
  const normalizedSearch =
    search
      .trim()
      .toLowerCase()

  if (
    !normalizedSearch
  ) {
    return true
  }

  const name =
    product.name
      .toLowerCase()

  const description =
    (
      product.description ||
      ''
    ).toLowerCase()

  const categoryName =
    (
      product.category
        ?.name || ''
    ).toLowerCase()

  const categorySlug =
    (
      product.category
        ?.slug || ''
    ).toLowerCase()

  return (
    name.includes(
      normalizedSearch,
    ) ||
    description.includes(
      normalizedSearch,
    ) ||
    categoryName.includes(
      normalizedSearch,
    ) ||
    categorySlug.includes(
      normalizedSearch,
    )
  )
}

/*
 * ============================================================
 * PRODUCT CATEGORY FILTER
 * ============================================================
 *
 * Category ID asosida filter.
 *
 * "Barchasi" holati uchun null ishlatiladi.
 */

export function productMatchesCategory(
  product: Product,
  categoryId:
    | number
    | null,
): boolean {
  if (
    categoryId === null
  ) {
    return true
  }

  return (
    product.category_id ===
    categoryId
  )
}

/*
 * ============================================================
 * FILTER PRODUCTS
 * ============================================================
 *
 * Search + Category filter.
 *
 * App.tsx ichida filter logikasini
 * qayta-qayta yozmaslik uchun markazlashtirildi.
 */

export function filterProducts(
  products: Product[],
  options?: {
    search?: string
    categoryId?: number | null
    onlyAvailable?: boolean
  },
): Product[] {
  const search =
    options?.search || ''

  const categoryId =
    options?.categoryId ??
    null

  const onlyAvailable =
    options?.onlyAvailable ??
    false

  return products.filter(
    (product) => {
      const matchesSearch =
        productMatchesSearch(
          product,
          search,
        )

      const matchesCategory =
        productMatchesCategory(
          product,
          categoryId,
        )

      const matchesAvailability =
        !onlyAvailable ||
        isProductAvailable(
          product,
        )

      return (
        matchesSearch &&
        matchesCategory &&
        matchesAvailability
      )
    },
  )
}

/*
 * ============================================================
 * API URL EXPORT
 * ============================================================
 *
 * Boshqa API filelar ham bir xil
 * backend URL ishlatishi uchun.
 *
 * Masalan keyinchalik:
 *
 * orders.ts
 * categories.ts
 * auth.ts
 * payments.ts
 *
 * shu qiymatdan foydalanishi mumkin.
 */

export { API_URL }
