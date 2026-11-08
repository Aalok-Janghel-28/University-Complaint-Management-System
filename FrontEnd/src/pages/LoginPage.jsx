import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

const LoginPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(form)
      navigate('/dashboard')
    } catch (apiError) {
      setError(apiError.response?.data?.detail || 'Login failed. Check your email and password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-lg font-black text-white shadow-lg shadow-emerald-600/30">
            U
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-700">University</p>
            <h1 className="text-2xl font-black text-slate-950">Welcome back</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">Sign in to the University Complaint Management System to track issues, updates, and resolution progress.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </label>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            className="w-full rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          New user?{' '}
          <Link className="font-semibold text-emerald-700 hover:text-emerald-800" to="/register">
            Create account
          </Link>
        </p>
      </section>
    </main>
  )
}

export default LoginPage
