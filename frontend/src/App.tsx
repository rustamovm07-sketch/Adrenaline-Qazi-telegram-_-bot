import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  
  ChevronRight,
  Clock3,
  Minus,
  Moon,
  Package,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sun,
  User,
  X,
  MapPin,
  Phone,
  CircleUserRound,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Check,
} from 'lucide-react'

import Checkout from './components/Checkoutt'
import ProfileSetup from './components/ProfileSetup'
import {
  getCustomerProfile,
  type CustomerProfile,
} from './api/customers'
import {
  getTelegramInitData,
  getTelegramUser,
  getTelegramWebApp,
  type TelegramUser,
} from './api/telegram'
import { getMyOrders, type Order } from './api/orders'
import { getPublicStoreSettings, getStoreImageUrl, type StoreSettings } from './api/storeSettings'

import {
  filterProducts,
  getActiveCategories,
  getCategoryImageUrl,
  getProductImageUrl,

  getProductUnitPrice,
  getProducts,
  isProductAvailable,
  type Category,
  type Product,
} from './api/products'

/*
 * ============================================================
 * ADRENALIN QAZI
 * CUSTOMER MINI APP
 * ============================================================
 *
 * Asosiy vazifalar:
 *
 * - Dynamic products
 * - Dynamic categories
 * - Search
 * - Category filtering
 * - Cart
 * - LocalStorage
 * - Product detail modal
 * - Checkout
 * - Orders/profile placeholder
 * - Dark/light theme
 *
 * Keyingi bosqichlarda:
 *
 * - Telegram initData
 * - real Telegram user
 * - orders API
 * - payment
 * - promotions
 * - delivery
 *
 * qo'shiladi.
 * ============================================================
 */

type Page =
  | 'home'
  | 'cart'
  | 'orders'
  | 'profile'

type CartItem = {
  id: number
  name: string
  price: number
  quantity: number
  unitType: 'kg' | 'dona'
  weightPerUnit: number
  image: string | null
  category: Category
}

/*
 * ============================================================
 * LOCAL STORAGE
 * ============================================================
 */

const CART_STORAGE_KEY =
  'adrenalin-qazi-cart'

const THEME_STORAGE_KEY =
  'adrenalin-qazi-theme'

/*
 * ============================================================
 * SAFE LOCAL STORAGE
 * ============================================================
 */

function readStoredCart(): CartItem[] {
  try {
    const raw =
      localStorage.getItem(
        CART_STORAGE_KEY,
      )

    if (!raw) {
      return []
    }

    const parsed =
      JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter(
        (item): item is CartItem => {
          return (
            item &&
            typeof item ===
              'object' &&
            typeof item.id ===
              'number' &&
            typeof item.name ===
              'string' &&
            typeof item.price ===
              'number' &&
            typeof item.quantity ===
              'number' &&
            (
              item.unitType ===
                'kg' ||
              item.unitType ===
                'dona'
            ) &&
            typeof item.category ===
              'object'
          )
        },
      )
      .map((item) => ({
        ...item,
        quantity:
          Math.max(
            0,
            item.quantity,
          ),
        image:
          typeof item.image ===
          'string'
            ? item.image
            : null,
        weightPerUnit:
          typeof item.weightPerUnit ===
          'number'
            ? item.weightPerUnit
            : 1,
      }))
      .filter(
        (item) =>
          item.quantity > 0,
      )
  } catch {
    return []
  }
}

/*
 * ============================================================
 * FORMAT HELPERS
 * ============================================================
 */

function formatPrice(
  value: number,
): string {
  return new Intl.NumberFormat(
    'uz-UZ',
  ).format(
    Math.round(value),
  )
}

function getCartItemUnitPrice(
  item: CartItem,
): number {
  if (
    item.unitType ===
      'dona' &&
    item.weightPerUnit > 0
  ) {
    return (
      item.price *
      item.weightPerUnit
    )
  }

  return item.price
}

function getCartItemSubtotal(
  item: CartItem,
): number {
  return (
    getCartItemUnitPrice(
      item,
    ) *
    item.quantity
  )
}

function getCartItemWeight(
  item: CartItem,
): number {
  if (
    item.unitType ===
      'dona' &&
    item.weightPerUnit > 0
  ) {
    return (
      item.quantity *
      item.weightPerUnit
    )
  }

  return item.quantity
}

function getUnitLabel(
  item: Pick<
    CartItem,
    'unitType'
  >,
): string {
  return item.unitType ===
    'dona'
    ? 'dona'
    : 'kg'
}

/*
 * ============================================================
 * IMAGE HELPERS
 * ============================================================
 *
 * products.ts image helper:
 *
 * string | null
 *
 * React img src:
 *
 * string | undefined
 *
 * Shu sababli null bo'lsa
 * undefined qaytaramiz.
 */

function resolveImage(
  image:
    | string
    | null
    | undefined,
): string | undefined {
  if (
    image === null ||
    image === undefined
  ) {
    return undefined
  }

  return (
    getProductImageUrl(
      image,
    ) ?? undefined
  )
}

function resolveCategoryImage(
  image:
    | string
    | null
    | undefined,
): string | undefined {
  if (
    image === null ||
    image === undefined
  ) {
    return undefined
  }

  return (
    getCategoryImageUrl(
      image,
    ) ?? undefined
  )
}

/*
 * ============================================================
 * EMPTY IMAGE
 * ============================================================
 */

function ImagePlaceholder({
  type = 'product',
}: {
  type?: 'product' | 'category'
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 via-orange-50 to-stone-100">
      {type === 'category' ? (
        <Package
          size={34}
          className="text-amber-600"
        />
      ) : (
        <ShoppingBag
          size={38}
          className="text-amber-600"
        />
      )}
    </div>
  )
}

/*
 * ============================================================
 * BOTTOM NAV BUTTON
 * ============================================================
 */

type BottomNavButtonProps = {
  active: boolean
  label: string
  icon: ReactNode
  badge?: number
  onClick: () => void
}

function BottomNavButton({
  active,
  label,
  icon,
  badge,
  onClick,
}: BottomNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 transition ${
        active
          ? 'bg-amber-100 text-amber-700'
          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
      }`}
    >
      <div className="relative">
        {icon}

        {badge !== undefined &&
          badge > 0 && (
            <span className="absolute -right-3 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
              {badge > 99
                ? '99+'
                : badge}
            </span>
          )}
      </div>

      <span className="text-[11px] font-bold">
        {label}
      </span>
    </button>
  )
}

/*
 * ============================================================
 * CATEGORY CARD
 * ============================================================
 */

function CategoryCard({
  category,
  selected,
  onClick,
}: {
  category: Category
  selected: boolean
  onClick: () => void
}) {
  const image =
    resolveCategoryImage(
      category.image,
    )

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl border p-2 text-left transition ${
        selected
          ? 'border-amber-500 bg-amber-50 shadow-md'
          : 'border-stone-200 bg-white hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md'
      }`}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-stone-100">
        {image ? (
          <img
            src={image}
            alt={category.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <ImagePlaceholder type="category" />
        )}

        {selected && (
          <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-white shadow">
            <Check size={16} />
          </div>
        )}
      </div>

      <p className="mt-2 truncate px-1 text-center text-sm font-black text-stone-800">
        {category.name}
      </p>
    </button>
  )
}

/*
 * ============================================================
 * PRODUCT CARD
 * ============================================================
 */

function ProductCard({
  product,
  onOpen,
  onAdd,
}: {
  product: Product
  onOpen: () => void
  onAdd: () => void
}) {
  const image =
    resolveImage(
      product.image,
    )

  const available =
    isProductAvailable(
      product,
    )

  const unitPrice =
    getProductUnitPrice(
      product,
    )

  return (
    <article className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
      >
        <div className="relative aspect-square overflow-hidden bg-stone-100">
          {image ? (
            <img
              src={image}
              alt={product.name}
              className="h-full w-full object-contain transition duration-300 hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <ImagePlaceholder />
          )}

          {!available && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45">
              <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-stone-800">
                Hozir mavjud emas
              </span>
            </div>
          )}

          {product.unit_type ===
            'dona' && (
            <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-stone-700 shadow">
              Dona
            </div>
          )}
        </div>

        <div className="p-3">
          <h3 className="line-clamp-2 min-h-[40px] text-sm font-black text-stone-900">
            {product.name}
          </h3>

          <p className="mt-1 line-clamp-2 min-h-[32px] text-xs leading-4 text-stone-500">
            {product.description ||
              product.category.name}
          </p>

          <div className="mt-3">
            <p className="text-base font-black text-amber-700">
              {formatPrice(
                unitPrice,
              )}{' '}
              so‘m
            </p>

            <p className="mt-0.5 text-[11px] font-semibold text-stone-400">
              {product.unit_type ===
              'dona'
                ? `1 dona • ${product.weight_per_unit} kg`
                : '1 kg'}
            </p>
          </div>
        </div>
      </button>

      <div className="px-3 pb-3">
        <button
          type="button"
          disabled={!available}
          onClick={onAdd}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-amber-600/20 transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none"
        >
          <ShoppingCart size={18} />

          {available
            ? 'Savatchaga qo‘shish'
            : 'Mavjud emas'}
        </button>
      </div>
    </article>
  )
}

/*
 * ============================================================
 * PRODUCT MODAL
 * ============================================================
 */

function ProductModal({
  product,
  onClose,
  onAdd,
}: {
  product: Product
  onClose: () => void
  onAdd: () => void
}) {
  const image =
    resolveImage(
      product.image,
    )

  const available =
    isProductAvailable(
      product,
    )

  const unitPrice =
    getProductUnitPrice(
      product,
    )

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="relative">
          <div className="flex max-h-[52vh] min-h-56 items-center justify-center overflow-auto bg-stone-100 p-2">
            {image ? (
              <a href={image} target="_blank" rel="noreferrer" aria-label="Asl rasmni yangi oynada ochish" className="flex max-h-[50vh] max-w-full items-center justify-center">
                <img
                  src={image}
                  alt={product.name}
                  className="h-auto max-h-[50vh] w-auto max-w-full object-contain"
                />
              </a>
            ) : (
              <ImagePlaceholder />
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-stone-800 shadow-lg backdrop-blur"
            aria-label="Yopish"
          >
            <X size={22} />
          </button>
        </div>

        <div className="max-h-[40vh] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-600">
                {product.category.name}
              </p>

              <h2 className="mt-1 text-2xl font-black text-stone-900">
                {product.name}
              </h2>
            </div>

            <div className="shrink-0 rounded-2xl bg-amber-50 px-3 py-2 text-right">
              <p className="text-lg font-black text-amber-700">
                {formatPrice(
                  unitPrice,
                )}
              </p>

              <p className="text-[10px] font-bold text-stone-500">
                so‘m /{' '}
                {product.unit_type}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-stone-50 p-3">
              <p className="text-xs text-stone-500">
                Birlik
              </p>

              <p className="mt-1 font-black text-stone-800">
                {product.unit_type ===
                'dona'
                  ? 'Dona'
                  : 'Kilogram'}
              </p>
            </div>

            <div className="rounded-2xl bg-stone-50 p-3">
              <p className="text-xs text-stone-500">
                Qoldiq
              </p>

              <p className="mt-1 font-black text-stone-800">
                {product.available_stock_units}{' '}
                {product.unit_type}
              </p>
            </div>
          </div>

          {product.unit_type ===
            'dona' && (
            <div className="mt-3 rounded-2xl bg-amber-50 p-3">
              <p className="text-xs text-stone-500">
                1 dona og‘irligi
              </p>

              <p className="mt-1 font-black text-amber-700">
                {product.weight_per_unit}{' '}
                kg
              </p>
            </div>
          )}

          <div className="mt-5">
            <h3 className="font-black text-stone-900">
              Mahsulot haqida
            </h3>

            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-stone-600">
              {product.description ||
                'Mahsulot haqida ma’lumot mavjud emas.'}
            </p>
          </div>
        </div>

        <div className="border-t border-stone-200 p-4">
          <button
            type="button"
            disabled={!available}
            onClick={onAdd}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
          >
            <ShoppingCart size={19} />

            {available
              ? 'Savatchaga qo‘shish'
              : 'Hozir mavjud emas'}
          </button>
        </div>
      </div>
    </div>
  )
}

/*
 * ============================================================
 * CART ITEM
 * ============================================================
 */

function CartRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: CartItem
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
}) {
  const image =
    resolveImage(
      item.image,
    )

  const subtotal =
    getCartItemSubtotal(
      item,
    )

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-stone-100">
          {image ? (
            <img
              src={image}
              alt={item.name}
              className="h-full w-full object-contain"
            />
          ) : (
            <ImagePlaceholder />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-amber-600">
                {item.category.name}
              </p>

              <h3 className="mt-0.5 line-clamp-2 text-sm font-black text-stone-900">
                {item.name}
              </h3>
            </div>

            <button
              type="button"
              onClick={onRemove}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-stone-400 transition hover:bg-red-50 hover:text-red-500"
              aria-label="O‘chirish"
            >
              <X size={17} />
            </button>
          </div>

          <p className="mt-1 text-xs text-stone-500">
            {formatPrice(
              getCartItemUnitPrice(
                item,
              ),
            )}{' '}
            so‘m /{' '}
            {getUnitLabel(item)}
          </p>

          {item.unitType ===
            'dona' && (
            <p className="text-[11px] text-stone-400">
              1 dona ={' '}
              {item.weightPerUnit}{' '}
              kg
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={onDecrease}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 transition hover:bg-white"
              >
                <Minus size={15} />
              </button>

              <span className="min-w-9 text-center text-sm font-black text-stone-800">
                {item.quantity}
              </span>

              <button
                type="button"
                onClick={onIncrease}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 transition hover:bg-white"
              >
                <Plus size={15} />
              </button>
            </div>

            <p className="text-base font-black text-amber-700">
              {formatPrice(
                subtotal,
              )}{' '}
              so‘m
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/*
 * ============================================================
 * HOME PAGE
 * ============================================================
 */

function HomePage({
  products,
  categories,
  search,
  selectedCategoryId,
  onSearchChange,
  onCategoryChange,
  onProductOpen,
  onProductAdd,
  onRefresh,
  loading,
  error,
}: {
  products: Product[]
  categories: Category[]
  search: string
  selectedCategoryId: number | null
  onSearchChange: (
    value: string,
  ) => void
  onCategoryChange: (
    value: number | null,
  ) => void
  onProductOpen: (
    product: Product,
  ) => void
  onProductAdd: (
    product: Product,
  ) => void
  onRefresh: () => void
  loading: boolean
  error: string | null
}) {
  const filteredProducts =
    useMemo(() => {
      return filterProducts(
        products,
        {
          search,
          categoryId:
            selectedCategoryId,
          onlyAvailable: false,
        },
      )
    }, [
      products,
      search,
      selectedCategoryId,
    ])

  const availableCount =
    filteredProducts.filter(
      isProductAvailable,
    ).length

  return (
    <div className="space-y-6 pb-28">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 p-6 text-white shadow-xl">
        <div className="relative z-10 max-w-xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Adrenalin Qazi
          </div>

          <h1 className="text-3xl font-black leading-tight sm:text-4xl">
            Haqiqiy ta’m.
            <br />
            <span className="text-amber-400">
              Kuchli sifat.
            </span>
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-stone-300">
            Sifatli ot go‘shti mahsulotlarini
            qulay tarzda buyurtma qiling.
          </p>
        </div>

        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-8 h-40 w-40 rounded-full bg-orange-500/20 blur-3xl" />
      </section>

      {/* SEARCH */}
      <section>
        <div className="relative">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
          />

          <input
            value={search}
            onChange={(event) =>
              onSearchChange(
                event.target.value,
              )
            }
            placeholder="Mahsulot qidirish..."
            className="min-h-13 w-full rounded-2xl border border-stone-200 bg-white pl-12 pr-12 text-sm font-medium text-stone-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                onSearchChange('')
              }
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </section>

      {/* CATEGORIES */}
      {categories.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black text-stone-900">
              Kategoriyalar
            </h2>

            {selectedCategoryId !==
              null && (
              <button
                type="button"
                onClick={() =>
                  onCategoryChange(
                    null,
                  )
                }
                className="text-xs font-bold text-amber-700"
              >
                Barchasi
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map(
              (category) => (
                <CategoryCard
                  key={
                    category.id
                  }
                  category={
                    category
                  }
                  selected={
                    selectedCategoryId ===
                    category.id
                  }
                  onClick={() =>
                    onCategoryChange(
                      selectedCategoryId ===
                        category.id
                        ? null
                        : category.id,
                    )
                  }
                />
              ),
            )}
          </div>
        </section>
      )}

      {/* PRODUCTS HEADER */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-stone-900">
              Mahsulotlar
            </h2>

            <p className="mt-0.5 text-xs text-stone-500">
              {availableCount} ta mavjud
              mahsulot
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:opacity-50"
            aria-label="Yangilash"
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? 'animate-spin'
                  : ''
              }
            />
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-red-700">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                Mahsulotlarni yuklashda
                muammo
              </p>

              <p className="mt-1 text-xs leading-5">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading &&
          products.length === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({
                length: 4,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-3xl bg-white"
                  >
                    <div className="aspect-square animate-pulse bg-stone-200" />

                    <div className="space-y-2 p-3">
                      <div className="h-4 animate-pulse rounded bg-stone-200" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200" />
                      <div className="h-10 animate-pulse rounded-2xl bg-stone-200" />
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

        {/* EMPTY */}
        {!loading &&
          filteredProducts.length ===
            0 && (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <ShoppingBag
                size={42}
                className="mx-auto text-stone-300"
              />

              <h3 className="mt-4 font-black text-stone-800">
                Mahsulot topilmadi
              </h3>

              <p className="mt-1 text-sm text-stone-500">
                Qidiruv yoki kategoriya
                filtrini o‘zgartirib
                ko‘ring.
              </p>

              {(search ||
                selectedCategoryId !==
                  null) && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('')
                    onCategoryChange(
                      null,
                    )
                  }}
                  className="mt-4 rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700"
                >
                  Filtrlarni tozalash
                </button>
              )}
            </div>
          )}

        {/* PRODUCT GRID */}
        {filteredProducts.length >
          0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map(
              (product) => (
                <ProductCard
                  key={
                    product.id
                  }
                  product={
                    product
                  }
                  onOpen={() =>
                    onProductOpen(
                      product,
                    )
                  }
                  onAdd={() =>
                    onProductAdd(
                      product,
                    )
                  }
                />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  )
}

/*
 * ============================================================
 * CART PAGE
 * ============================================================
 */

function CartPage({
  cart,
  onIncrease,
  onDecrease,
  onRemove,
  onCheckout,
  onGoHome,
}: {
  cart: CartItem[]
  onIncrease: (
    id: number,
  ) => void
  onDecrease: (
    id: number,
  ) => void
  onRemove: (
    id: number,
  ) => void
  onCheckout: () => void
  onGoHome: () => void
}) {
  const total =
    cart.reduce(
      (sum, item) =>
        sum +
        getCartItemSubtotal(
          item,
        ),
      0,
    )

  const totalWeight =
    cart.reduce(
      (sum, item) =>
        sum +
        getCartItemWeight(
          item,
        ),
      0,
    )

  if (cart.length === 0) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center px-4 pb-28 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-100">
          <ShoppingCart
            size={42}
            className="text-amber-700"
          />
        </div>

        <h1 className="mt-6 text-2xl font-black text-stone-900">
          Savatcha bo‘sh
        </h1>

        <p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">
          Mahsulotlarni tanlang va
          buyurtma berish uchun
          savatchaga qo‘shing.
        </p>

        <button
          type="button"
          onClick={onGoHome}
          className="mt-6 rounded-2xl bg-amber-600 px-6 py-3 font-black text-white shadow-lg shadow-amber-600/20"
        >
          Mahsulotlarni ko‘rish
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-32">
      <div>
        <h1 className="text-2xl font-black text-stone-900">
          Savatcha
        </h1>

        <p className="mt-1 text-sm text-stone-500">
          {cart.length} xil mahsulot
        </p>
      </div>

      <div className="space-y-3">
        {cart.map((item) => (
          <CartRow
            key={item.id}
            item={item}
            onIncrease={() =>
              onIncrease(item.id)
            }
            onDecrease={() =>
              onDecrease(item.id)
            }
            onRemove={() =>
              onRemove(item.id)
            }
          />
        ))}
      </div>

      <div className="sticky bottom-[78px] z-20 rounded-3xl border border-stone-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-500">
            Jami og‘irlik
          </span>

          <span className="font-bold text-stone-800">
            {totalWeight.toFixed(
              3,
            )}{' '}
            kg
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-black text-stone-800">
            Jami
          </span>

          <span className="text-2xl font-black text-amber-700">
            {formatPrice(total)}{' '}
            so‘m
          </span>
        </div>

        <button
          type="button"
          onClick={onCheckout}
          className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 font-black text-white shadow-lg shadow-amber-600/20 transition hover:bg-amber-700"
        >
          <ShoppingBag size={19} />
          Buyurtma berish
        </button>
      </div>
    </div>
  )
}

/*
 * ============================================================
 * ORDERS PAGE
 * ============================================================
 */

function OrdersPage({
  onGoHome,
}: {
  onGoHome: () => void
}) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    void getMyOrders()
      .then(setOrders)
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Buyurtmalarni yuklashda xatolik yuz berdi.',
        )
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="pb-28">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-stone-900">
          Buyurtmalar
        </h1>

        <p className="mt-1 text-sm text-stone-500">
          Buyurtmalaringiz shu yerda
          ko‘rinadi.
        </p>
      </div>

      {loading && (
        <div className="rounded-3xl bg-white p-6 text-center text-sm text-stone-500">
          Buyurtmalar yuklanmoqda...
        </div>
      )}

      {loadError && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((order) => (
            <article key={order.id} className="rounded-3xl border border-stone-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-stone-900">Buyurtma #{order.id}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {new Date(order.created_at).toLocaleString('uz-UZ')}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                  {({ NEW: 'Yangi', PAYMENT_PENDING: "To'lov kutilmoqda", PAID: "To'langan", CONFIRMED: 'Tasdiqlangan', PREPARING: 'Tayyorlanmoqda', READY: 'Tayyor', DELIVERING: 'Yetkazilmoqda', DELIVERED: 'Yetkazildi', CANCELLED: 'Bekor qilindi' } as Record<string, string>)[order.status]}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                <span className="text-sm text-stone-500">{order.items.length} xil mahsulot</span>
                <strong className="text-amber-800">
                  {new Intl.NumberFormat('uz-UZ').format(Number(order.total))} so‘m
                </strong>
              </div>
              {order.address && (
                <p className="mt-2 text-xs text-stone-500">
                  {order.address}{order.landmark ? ` · ${order.landmark}` : ''}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {!loading && !loadError && orders.length === 0 && (
      <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-stone-100">
          <Clock3
            size={34}
            className="text-stone-400"
          />
        </div>

        <h2 className="mt-5 text-lg font-black text-stone-800">
          Hozircha buyurtmalar
          yo‘q
        </h2>

        <p className="mt-2 text-sm leading-6 text-stone-500">
          Buyurtma berganingizdan
          keyin uning holatini shu
          bo‘limdan kuzatishingiz
          mumkin.
        </p>

        <button
          type="button"
          onClick={onGoHome}
          className="mt-5 rounded-2xl bg-amber-100 px-5 py-3 text-sm font-black text-amber-700"
        >
          Mahsulotlarni ko‘rish
        </button>
      </div>
      )}
    </div>
  )
}

/*
 * ============================================================
 * PROFILE PAGE
 * ============================================================
 */

function ProfilePage({
  darkMode,
  profile,
  telegramUser,
  loading,
  storeSettings,
  onEditProfile,
  onToggleTheme,
}: {
  darkMode: boolean
  profile: CustomerProfile | null
  telegramUser: TelegramUser | null
  loading: boolean
  storeSettings: StoreSettings | null
  onEditProfile: () => void
  onToggleTheme: () => void
}) {
  const [infoKey, setInfoKey] = useState<"guide" | "terms" | "updates" | null>(null)
  const [storeImageFailed, setStoreImageFailed] = useState(false)
  const storeImageUrl = getStoreImageUrl(storeSettings?.shop_image_url ?? null)
  const infoContent = {
    guide: { title: "Foydalanish qo'llanmasi", text: storeSettings?.guide_text },
    terms: { title: "Foydalanish shartlari", text: storeSettings?.terms_text },
    updates: { title: "Kutilayotgan yangilanishlar", text: storeSettings?.updates_text },
  }
  const mapUrl = storeSettings?.latitude != null && storeSettings.longitude != null
    ? `https://www.openstreetmap.org/?mlat=${storeSettings.latitude}&mlon=${storeSettings.longitude}#map=17/${storeSettings.latitude}/${storeSettings.longitude}`
    : null
  const telegramName = storeSettings?.support_telegram?.replace(/^@/, "")

  return (
    <div className="space-y-4 pb-28">
      <div>
        <h1 className="text-2xl font-black text-stone-900">Profil va do'kon</h1>
        <p className="mt-1 text-sm text-stone-500">Hisobingiz, do'kon manzili va yordam</p>
      </div>

      <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-stone-900 to-amber-950">
          {storeImageUrl && !storeImageFailed ? (
            <img src={storeImageUrl} alt={storeSettings?.shop_name ?? "Do'kon rasmi"} className="h-full w-full object-cover" onError={() => setStoreImageFailed(true)} />
          ) : (
            <ShoppingBag size={48} className="text-amber-300" />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12 text-white">
            <p className="text-lg font-black">{storeSettings?.shop_name ?? "Adrenalin Qazi"}</p>
            <p className="text-xs text-white/80">Do'kon manzili va aloqa</p>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3">
            <CircleUserRound size={28} className="shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-stone-900">
                {loading ? "Yuklanmoqda..." : profile ? `${profile.name} ${profile.surname ?? ""}`.trim() : telegramUser?.first_name ?? "Telegram foydalanuvchisi"}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">{profile?.phone ?? "Telefon raqami kiritilmagan"}</p>
            </div>
            <button type="button" onClick={onEditProfile} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white">
              {profile ? "Tahrirlash" : "Profil yaratish"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <MapPin size={20} className="mt-0.5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-stone-900">Do'kon lokatsiyasi</h2>
            <p className="mt-1 text-sm leading-5 text-stone-600">{storeSettings?.store_address || "Do'kon manzili hali kiritilmagan."}</p>
            {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800">Xaritada ochish</a>}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5">
        <h2 className="font-black text-stone-900">Aloqa va yordam</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {storeSettings?.support_phone && <a href={`tel:${storeSettings.support_phone}`} className="flex min-h-12 items-center gap-3 rounded-xl bg-stone-50 px-4 text-sm font-bold text-stone-700"><Phone size={18} className="text-amber-700" />{storeSettings.support_phone}</a>}
          {telegramName && <a href={`https://t.me/${telegramName}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-xl bg-stone-50 px-4 text-sm font-bold text-stone-700"><ExternalLink size={18} className="text-amber-700" />Telegram: @{telegramName}</a>}
          {!storeSettings?.support_phone && !telegramName && <p className="text-sm text-stone-500">Aloqa ma'lumotlari tez orada qo'shiladi.</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
        <button type="button" onClick={onToggleTheme} className="flex min-h-14 w-full items-center justify-between px-4 transition hover:bg-stone-50">
          <span className="flex items-center gap-3">
            {darkMode ? <Moon size={19} className="text-amber-600" /> : <Sun size={19} className="text-amber-600" />}
            <span className="text-left"><span className="block text-sm font-black text-stone-800">Ko'rinish</span><span className="block text-xs text-stone-500">{darkMode ? "Luxury dark rejim" : "Luxury light rejim"}</span></span>
          </span>
          <ChevronRight size={19} className="text-stone-400" />
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {([
          ["guide", "Foydalanish qo'llanmasi", "Buyurtma berish tartibi"],
          ["terms", "Foydalanish shartlari", "Buyurtma va yetkazish qoidalari"],
          ["updates", "Yangilanishlar", "Yangi imkoniyatlar rejasi"],
        ] as const).map(([key, title, subtitle]) => (
          <button key={key} type="button" onClick={() => setInfoKey(key)} className="rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-amber-300 hover:shadow-md">
            <p className="font-black text-stone-900">{title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{subtitle}</p>
          </button>
        ))}
      </section>

      {infoKey && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => setInfoKey(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="profile-info-title" onClick={(event) => event.stopPropagation()} className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4"><h2 id="profile-info-title" className="text-xl font-black text-stone-900">{infoContent[infoKey].title}</h2><button type="button" aria-label="Yopish" onClick={() => setInfoKey(null)} className="rounded-xl bg-stone-100 p-2"><X size={19} /></button></div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-600">{infoContent[infoKey].text || "Ma'lumot hozircha kiritilmagan."}</p>
          </section>
        </div>
      )}
    </div>
  )
}

/*
 * ============================================================
 * APP
 * ============================================================
 */

export default function App() {
  const telegramUser: TelegramUser | null = getTelegramUser()
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null)
  const [profile, setProfile] =
    useState<CustomerProfile | null>(null)
  const [profileLoading, setProfileLoading] =
    useState(() => Boolean(getTelegramInitData()))
  const [showProfileSetup, setShowProfileSetup] =
    useState(false)
  const [authMessage, setAuthMessage] =
    useState<string | null>(() =>
      getTelegramInitData()
        ? null
        : 'Profil yaratish va buyurtma berish uchun Telegram bot ichidagi Do‘konni ochish tugmasidan foydalaning.',
    )

  const [
    page,
    setPage,
  ] = useState<Page>('home')

  const [
    products,
    setProducts,
  ] = useState<Product[]>([])

  const [
    categories,
    setCategories,
  ] = useState<Category[]>([])

  const [
    cart,
    setCart,
  ] = useState<CartItem[]>(
    readStoredCart,
  )

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    selectedCategoryId,
    setSelectedCategoryId,
  ] = useState<
    number | null
  >(null)

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState<Product | null>(
    null,
  )

  const [
    showCheckout,
    setShowCheckout,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  )

  const [
    darkMode,
    setDarkMode,
  ] = useState(() => {
    try {
      return (
        localStorage.getItem(
          THEME_STORAGE_KEY,
        ) === 'dark'
      )
    } catch {
      return false
    }
  })

  useEffect(() => {
    const webApp = getTelegramWebApp()
    webApp?.ready()
    webApp?.expand()

    if (!webApp?.initData) {
      setProfileLoading(false)
      return
    }

    void getCustomerProfile()
      .then((customerProfile) => {
        setProfile(customerProfile)
        setShowProfileSetup(!customerProfile?.profile_completed)
      })
      .catch((profileError: unknown) => {
        setAuthMessage(
          profileError instanceof Error
            ? profileError.message
            : 'Telegram profilingizni tekshirib bo‘lmadi.',
        )
      })
      .finally(() => setProfileLoading(false))
  }, [])

  useEffect(() => {
    void getPublicStoreSettings()
      .then(setStoreSettings)
      .catch((settingsError: unknown) => console.error('Store settings unavailable:', settingsError))
  }, [])

  /*
   * ==========================================================
   * SAVE CART
   * ==========================================================
   */

  useEffect(() => {
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart),
      )
    } catch (storageError) {
      console.error(
        'Cart storage error:',
        storageError,
      )
    }
  }, [cart])

  /*
   * ==========================================================
   * SAVE THEME
   * ==========================================================
   */

  useEffect(() => {
    try {
      localStorage.setItem(
        THEME_STORAGE_KEY,
        darkMode
          ? 'dark'
          : 'light',
      )
    } catch {
      // Ignore storage errors.
    }
  }, [darkMode])

  /*
   * ==========================================================
   * LOAD DATA
   * ==========================================================
   */

  const loadData =
    async () => {
      setLoading(true)
      setError(null)

      try {
        const [
          productsResult,
          categoriesResult,
        ] = await Promise.all([
          getProducts(),
          getActiveCategories(),
        ])

        setProducts(
          Array.isArray(
            productsResult,
          )
            ? productsResult
            : [],
        )

        setCategories(
          Array.isArray(
            categoriesResult,
          )
            ? categoriesResult
                .filter(
                  (
                    category,
                  ) =>
                    category.is_active,
                )
                .sort(
                  (
                    a,
                    b,
                  ) =>
                    a.sort_order -
                    b.sort_order,
                )
            : [],
        )
      } catch (loadError) {
        console.error(
          'Frontend data load error:',
          loadError,
        )

        const message =
          loadError instanceof
          Error
            ? loadError.message
            : 'Ma’lumotlarni yuklashda xatolik yuz berdi.'

        setError(message)
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    // Initial catalog fetch; state updates follow asynchronous API requests.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [])

  /*
   * ==========================================================
   * CART COUNT
   * ==========================================================
   */

  const cartCount =
    useMemo(() => {
      return cart.reduce(
        (sum, item) =>
          sum + item.quantity,
        0,
      )
    }, [cart])

  /*
   * ==========================================================
   * CART TOTAL
   * ==========================================================
   */

 
  /*
   * ==========================================================
   * ADD PRODUCT
   * ==========================================================
   */

  const addToCart = (
    product: Product,
  ) => {
    if (
      !isProductAvailable(
        product,
      )
    ) {
      return
    }

    setCart(
      (currentCart) => {
        const existing =
          currentCart.find(
            (item) =>
              item.id ===
              product.id,
          )

        if (existing) {
          /*
           * Frontend qoldiqdan oshirib
           * yubormaslikka harakat qiladi.
           *
           * Yakuniy stock validation
           * baribir backendda bo‘ladi.
           */
          const nextQuantity =
            Math.min(
              existing.quantity +
                1,
              Math.floor(
                product.available_stock_units,
              ),
            )

          return currentCart.map(
            (item) =>
              item.id ===
              product.id
                ? {
                    ...item,
                    quantity:
                      nextQuantity,
                  }
                : item,
          )
        }

        return [
          ...currentCart,
          {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            unitType:
              product.unit_type,
            weightPerUnit:
              product.weight_per_unit,
            image:
              product.image,
            category:
              product.category,
          },
        ]
      },
    )

    setSelectedProduct(
      null,
    )
  }

  /*
   * ==========================================================
   * INCREASE
   * ==========================================================
   */

  const increaseCartItem = (
    productId: number,
  ) => {
    const product =
      products.find(
        (item) =>
          item.id ===
          productId,
      )

    if (!product) {
      return
    }

    if (
      !isProductAvailable(
        product,
      )
    ) {
      return
    }

    setCart(
      (currentCart) =>
        currentCart.map(
          (item) => {
            if (
              item.id !==
              productId
            ) {
              return item
            }

            const nextQuantity =
              Math.min(
                item.quantity +
                  1,
                Math.floor(
                  product.available_stock_units,
                ),
              )

            return {
              ...item,
              quantity:
                nextQuantity,
              price:
                product.price,
              unitType:
                product.unit_type,
              weightPerUnit:
                product.weight_per_unit,
              image:
                product.image,
              category:
                product.category,
            }
          },
        ),
    )
  }

  /*
   * ==========================================================
   * DECREASE
   * ==========================================================
   */

  const decreaseCartItem = (
    productId: number,
  ) => {
    setCart(
      (currentCart) =>
        currentCart
          .map(
            (item) =>
              item.id ===
              productId
                ? {
                    ...item,
                    quantity:
                      item.quantity -
                      1,
                  }
                : item,
          )
          .filter(
            (item) =>
              item.quantity >
              0,
          ),
    )
  }

  /*
   * ==========================================================
   * REMOVE
   * ==========================================================
   */

  const removeCartItem = (
    productId: number,
  ) => {
    setCart(
      (currentCart) =>
        currentCart.filter(
          (item) =>
            item.id !==
            productId,
        ),
    )
  }

  /*
   * ==========================================================
   * CLEAR CART AFTER SUCCESS
   * ==========================================================
   */

  const handleCheckoutSuccess =
    () => {
      setCart([])
      setShowCheckout(false)
      setPage('orders')
    }

  /*
   * ==========================================================
   * NAVIGATION
   * ==========================================================
   */

  const navigateTo = (
    nextPage: Page,
  ) => {
    setPage(nextPage)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  /*
   * ==========================================================
   * CHECKOUT
   * ==========================================================
   */

  const openCheckout = () => {
    if (cart.length === 0) {
      setPage('cart')
      return
    }

    if (!getTelegramInitData()) {
      setAuthMessage(
        'Buyurtma berish uchun Mini App’ni Telegram bot ichidan oching.',
      )
      return
    }

    if (!profile?.profile_completed) {
      setShowProfileSetup(true)
      return
    }

    setShowCheckout(true)
  }

  /*
   * ==========================================================
   * THEME
   * ==========================================================
   *
   * Hozircha darkMode state saqlanadi.
   * To'liq dark design keyingi UI polishing
   * bosqichida qo'shilishi mumkin.
   */

  const toggleTheme =
    () => {
      setDarkMode(
        (current) =>
          !current,
      )
    }

  const storeImageUrl = getStoreImageUrl(storeSettings?.shop_image_url ?? null)

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <div
      data-theme={darkMode ? 'dark' : 'light'}
      className={`min-h-screen ${
        darkMode
          ? 'bg-stone-950'
          : 'bg-[#f8f5ef]'
      }`}
    >
      {/* ====================================================
          TOP HEADER
          ==================================================== */}

      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
          darkMode
            ? 'border-stone-800 bg-stone-950/90'
            : 'border-stone-200 bg-[#f8f5ef]/90'
        }`}
      >
        <div className="mx-auto flex min-h-[68px] max-w-6xl items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={() =>
              navigateTo(
                'home',
              )
            }
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-600/20">
              {storeImageUrl ? <img src={storeImageUrl} alt="Do'kon" className="h-full w-full object-cover" /> : <ShoppingBag size={22} />}
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-black text-stone-900">
                {storeSettings?.shop_name ?? 'ADRENALIN QAZI'}
              </p>

              <p className="truncate text-[10px] font-black tracking-[0.22em] text-amber-700">
                QAZI
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50"
              aria-label="Tema"
            >
              {darkMode ? (
                <Moon size={18} />
              ) : (
                <Sun size={18} />
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                navigateTo(
                  'profile',
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50"
              aria-label="Profil"
            >
              <User size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================
          MAIN
          ==================================================== */}

      <main className="mx-auto w-full max-w-6xl px-4 pt-5">
        {page ===
          'home' && (
          <HomePage
            products={
              products
            }
            categories={
              categories
            }
            search={search}
            selectedCategoryId={
              selectedCategoryId
            }
            onSearchChange={
              setSearch
            }
            onCategoryChange={
              setSelectedCategoryId
            }
            onProductOpen={
              setSelectedProduct
            }
            onProductAdd={
              addToCart
            }
            onRefresh={() =>
              void loadData()
            }
            loading={loading}
            error={error}
          />
        )}

        {page ===
          'cart' && (
          <CartPage
            cart={cart}
            onIncrease={
              increaseCartItem
            }
            onDecrease={
              decreaseCartItem
            }
            onRemove={
              removeCartItem
            }
            onCheckout={
              openCheckout
            }
            onGoHome={() =>
              navigateTo(
                'home',
              )
            }
          />
        )}

        {page ===
          'orders' && (
          <OrdersPage
            onGoHome={() =>
              navigateTo(
                'home',
              )
            }
          />
        )}

        {page ===
          'profile' && (
          <ProfilePage
            darkMode={
              darkMode
            }
            profile={profile}
            telegramUser={telegramUser}
            loading={profileLoading}
            storeSettings={storeSettings}
            onEditProfile={() => setShowProfileSetup(true)}
            onToggleTheme={
              toggleTheme
            }
          />
        )}
      </main>

      {/* ====================================================
          BOTTOM NAV
          ==================================================== */}

      <nav
        className={`fixed bottom-0 left-0 right-0 z-50 border-t px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl ${
          darkMode
            ? 'border-stone-800 bg-stone-950/95'
            : 'border-stone-200 bg-white/95'
        }`}
      >
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <BottomNavButton
            active={
              page === 'home'
            }
            label="Bosh sahifa"
            icon={
              <ShoppingBag
                size={20}
              />
            }
            onClick={() =>
              navigateTo(
                'home',
              )
            }
          />

          <BottomNavButton
            active={
              page === 'cart'
            }
            label="Savatcha"
            icon={
              <ShoppingCart
                size={20}
              />
            }
            badge={cartCount}
            onClick={() =>
              navigateTo(
                'cart',
              )
            }
          />

          <BottomNavButton
            active={
              page === 'orders'
            }
            label="Buyurtmalar"
            icon={
              <Package
                size={20}
              />
            }
            onClick={() =>
              navigateTo(
                'orders',
              )
            }
          />

          <BottomNavButton
            active={
              page === 'profile'
            }
            label="Profil"
            icon={
              <User size={20} />
            }
            onClick={() =>
              navigateTo(
                'profile',
              )
            }
          />
        </div>
      </nav>

      {/* ====================================================
          PRODUCT MODAL
          ==================================================== */}

      {selectedProduct && (
        <ProductModal
          product={
            selectedProduct
          }
          onClose={() =>
            setSelectedProduct(
              null,
            )
          }
          onAdd={() =>
            addToCart(
              selectedProduct,
            )
          }
        />
      )}

      {/* ====================================================
          CHECKOUT
          ==================================================== */}

      {showCheckout && (
        <Checkout
          items={cart}
          profile={profile!}
          onClose={() =>
            setShowCheckout(
              false,
            )
          }
          onSuccess={
            handleCheckoutSuccess
          }
        />
      )}

      {authMessage && (
        <div className="fixed left-4 right-4 top-20 z-[80] mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 shadow-lg">
          {authMessage}
          <button
            type="button"
            className="ml-3 font-black underline"
            onClick={() => setAuthMessage(null)}
          >
            Yopish
          </button>
        </div>
      )}

      {showProfileSetup && getTelegramInitData() && (
        <ProfileSetup
          telegramId={telegramUser?.id}
          initialData={profile ?? undefined}
          onCompleted={(savedProfile) => {
            setProfile(savedProfile)
            setShowProfileSetup(false)
            setAuthMessage(null)
          }}
          onClose={
            profile?.profile_completed
              ? () => setShowProfileSetup(false)
              : undefined
          }
        />
      )}
    </div>
  )
}
