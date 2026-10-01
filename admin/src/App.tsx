import { useEffect, useState } from 'react'
import {
  BarChart3,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Settings,
  Sun,
  Users,
  X,
  Warehouse,
} from 'lucide-react'

import Categories from './pages/Categories'
import Customers from './pages/Customers'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Orders from './pages/Orders'
import Products from './pages/Products'
import Reports from './pages/Reports'
import SettingsPage from './pages/Settings'

type Page = 'dashboard' | 'orders' | 'products' | 'categories' | 'inventory' | 'customers' | 'reports' | 'settings'

const menuItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Boshqaruv paneli', icon: LayoutDashboard },
  { id: 'orders', label: 'Buyurtmalar', icon: ClipboardList },
  { id: 'products', label: 'Mahsulotlar', icon: Package },
  { id: 'categories', label: 'Kategoriyalar', icon: FolderTree },
  { id: 'inventory', label: 'Ombor', icon: Warehouse },
  { id: 'customers', label: 'Mijozlar', icon: Users },
  { id: 'reports', label: 'Hisobotlar', icon: BarChart3 },
  { id: 'settings', label: 'Sozlamalar', icon: Settings },
]

const pages = {
  dashboard: <Dashboard />,
  orders: <Orders />,
  products: <Products />,
  categories: <Categories />,
  inventory: <Inventory />,
  customers: <Customers />,
  reports: <Reports />,
  settings: <SettingsPage />,
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('adrenalin-qazi-admin-theme') === 'dark' } catch { return false }
  })
  const currentPage = menuItems.find((item) => item.id === page)?.label ?? 'Boshqaruv paneli'

  useEffect(() => {
    try { localStorage.setItem('adrenalin-qazi-admin-theme', darkMode ? 'dark' : 'light') } catch { /* storage unavailable */ }
  }, [darkMode])

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className="min-h-screen bg-[#f6f3ed] text-[#17130e]">
      {mobileMenu && <button type="button" aria-label="Menyuni yopish" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileMenu(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[270px] border-r border-black/5 bg-white transition-transform duration-300 ${mobileMenu ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center justify-between border-b border-black/5 px-6">
            <div><p className="text-xl font-black tracking-tight">ADRENALIN</p><p className="text-xs font-bold tracking-[0.3em] text-[#a77a2d]">QAZI</p></div>
            <button type="button" aria-label="Menyuni yopish" onClick={() => setMobileMenu(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 lg:hidden"><X size={18} /></button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
            <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Boshqaruv</p>
            {menuItems.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => { setPage(id); setMobileMenu(false) }} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition ${page === id ? 'bg-[#f1e5cf] text-[#8f6725]' : 'text-gray-500 hover:bg-gray-50 hover:text-[#17130e]'}`}><Icon size={19} />{label}</button>)}
          </nav>
          <div className="border-t border-black/5 p-4"><div className="mb-3 rounded-2xl bg-[#faf8f3] p-4"><p className="text-xs text-gray-400">Admin</p><p className="mt-1 truncate text-sm font-black">Telegram egasi</p></div><p className="flex items-center gap-3 px-4 py-3 text-xs text-gray-400"><LogOut size={16} />Chiqish uchun Telegram oynasini yoping</p></div>
        </div>
      </aside>
      <main className="lg:pl-[270px]">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-black/5 bg-[#f6f3ed]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button type="button" aria-label="Menyuni ochish" onClick={() => setMobileMenu(true)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm lg:hidden"><Menu size={20} /></button>
          <div className="min-w-0 flex-1"><p className="text-xs text-gray-400">Adrenalin Qazi</p><h2 className="font-black">{currentPage}</h2></div>
          <button type="button" aria-label={darkMode ? 'Yorug‘ rejimga o‘tish' : 'Qorong‘i rejimga o‘tish'} onClick={() => setDarkMode((value) => !value)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            {darkMode ? <Moon size={18} className="text-[#a77a2d]" /> : <Sun size={18} className="text-[#a77a2d]" />}
          </button>
        </header>
        <div className="p-4 sm:p-6 lg:p-8">{pages[page]}</div>
      </main>
    </div>
  )
}
