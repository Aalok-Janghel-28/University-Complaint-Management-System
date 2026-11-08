import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { ADMIN_ROLES } from '../utils/formatters'

const baseNavItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/complaints', label: 'Complaints' },
  { to: '/complaints/new', label: 'Submit' },
  { to: '/chatbot', label: 'AI Assistant' },
  { to: '/profile', label: 'Profile' },
]

const adminNavItem = { to: '/admin', label: 'Admin' }

const AppShell = ({ children }) => {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = ADMIN_ROLES.includes(user?.role)
    ? [...baseNavItems.slice(0, 3), adminNavItem, ...baseNavItems.slice(3)]
    : baseNavItems

  const navLinkClass = ({ isActive }) =>
    `block rounded-full px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-emerald-700 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-base font-black text-white shadow-lg shadow-emerald-600/30 sm:h-12 sm:w-12 sm:text-lg">
                U
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-700">University</p>
                <h1 className="truncate text-sm font-black text-slate-900 sm:text-base md:text-lg">
                  Complaint Management System
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden text-right md:block">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Signed in</p>
                <p className="max-w-[140px] truncate text-sm font-semibold text-slate-800">
                  {user?.full_name || 'User'}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="hidden rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 sm:inline-flex"
              >
                Logout
              </button>
              <button
                type="button"
                aria-label="Toggle navigation menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 lg:hidden"
              >
                <span className="text-lg">{menuOpen ? '✕' : '☰'}</span>
              </button>
            </div>
          </div>

          <nav className="mt-3 hidden flex-wrap items-center gap-2 lg:flex">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {menuOpen && (
            <nav className="mt-3 grid gap-2 border-t border-slate-200 pt-3 lg:hidden">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={navLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 sm:hidden"
              >
                Logout
              </button>
            </nav>
          )}
        </div>
      </header>

      <div>{children}</div>
    </div>
  )
}

export default AppShell
