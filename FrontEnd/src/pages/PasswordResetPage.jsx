import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { api } from '../api/authApi'

const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'

const PasswordResetPage = () => {
  const [params] = useSearchParams()
  const uid = params.get('uid')
  const token = params.get('token')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      if (uid && token) {
        const { data } = await api.post('/auth/password-reset/confirm/', { uid, token, new_password: password, new_password_confirm: confirm })
        setMessage(data.message || 'Password reset complete. You can sign in now.')
      } else {
        const { data } = await api.post('/auth/password-reset/', { email })
        setMessage(data.message || 'If this email exists, a reset link has been sent.')
      }
    } catch (apiError) {
      const detail = apiError.response?.data
      const first = detail && Object.values(detail)[0]
      setError(Array.isArray(first) ? first[0] : first || 'We could not complete that request.')
    } finally { setBusy(false) }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/70"><p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-700">Account recovery</p><h1 className="mt-2 text-2xl font-black text-slate-950">{uid && token ? 'Choose a new password' : 'Reset your password'}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{uid && token ? 'Create a new password for your university account.' : 'Enter your account email and we’ll send a secure reset link.'}</p>
    <form onSubmit={submit} className="mt-6 space-y-4">{uid && token ? <><label className="block text-sm font-medium text-slate-700">New password<input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></label><label className="block text-sm font-medium text-slate-700">Confirm new password<input className={inputClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" /></label></> : <label className="block text-sm font-medium text-slate-700">Email<input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>}
    {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? 'Please wait…' : uid && token ? 'Update password' : 'Send reset link'}</button></form><p className="mt-5 text-center text-sm text-slate-600"><Link className="font-semibold text-emerald-700 hover:text-emerald-900" to="/login">Back to sign in</Link></p></section></main>
}

export default PasswordResetPage
