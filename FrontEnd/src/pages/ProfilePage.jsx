import { useState } from 'react'

import { authApi } from '../api/authApi'
import { useAuth } from '../contexts/useAuth'

const ProfilePage = () => {
  const { user, logout, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone_number: user?.phone_number || '',
    profile: {
      city: user?.profile?.city || '',
      state: user?.profile?.state || '',
      pincode: user?.profile?.pincode || '',
      address: user?.profile?.address || '',
    },
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', new_password_confirm: '' })
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target
    if (name.startsWith('profile.')) {
      const profileField = name.replace('profile.', '')
      setForm((current) => ({
        ...current,
        profile: { ...current.profile, [profileField]: value },
      }))
      return
    }

    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      await authApi.updateProfile(form)
      await refreshProfile()
      setMessage('Profile updated successfully.')
    } catch {
      setError('Profile update failed.')
    }
  }

  const changePassword = async (event) => {
    event.preventDefault(); setPasswordError(''); setPasswordMessage('')
    try {
      const { data } = await authApi.changePassword(passwordForm)
      setPasswordMessage(data.message || 'Password changed successfully.')
      setPasswordForm({ old_password: '', new_password: '', new_password_confirm: '' })
    } catch (apiError) {
      const values = apiError.response?.data
      const first = values && Object.values(values)[0]
      setPasswordError(Array.isArray(first) ? first[0] : first || 'Password could not be changed.')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-8">
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Account settings</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">My profile</h1>
          </div>
          <button
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-100 sm:w-auto"
            type="button"
            onClick={logout}
          >
            Logout
          </button>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
            <h2 className="text-xl font-semibold text-slate-950">Account details</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Full name</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Phone number</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">City</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  name="profile.city"
                  value={form.profile.city}
                  onChange={handleChange}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">State</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  name="profile.state"
                  value={form.profile.state}
                  onChange={handleChange}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Pincode</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  name="profile.pincode"
                  value={form.profile.pincode}
                  onChange={handleChange}
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Address</span>
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                name="profile.address"
                value={form.profile.address}
                onChange={handleChange}
              />
            </label>

            {message && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
            {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button
              className="mt-5 rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800"
              type="submit"
            >
              Save profile
            </button>
          </form>

          <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Session user</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Email</dt>
                <dd className="break-all text-slate-950">{user.email}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Role</dt>
                <dd className="capitalize text-slate-950">{user.role.replaceAll('_', ' ')}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Verified</dt>
                <dd className="text-slate-950">{user.is_verified ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </aside>
        </div>

        <form className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={changePassword}>
          <h2 className="text-xl font-semibold text-slate-950">Change password</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">{[['old_password','Current password'],['new_password','New password'],['new_password_confirm','Confirm new password']].map(([name,label]) => <label key={name} className="block text-sm font-medium text-slate-700">{label}<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" type="password" autoComplete="new-password" value={passwordForm[name]} onChange={(event) => setPasswordForm((current) => ({ ...current, [name]: event.target.value }))} required /></label>)}</div>
          {passwordMessage && <p role="status" className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{passwordMessage}</p>}{passwordError && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{passwordError}</p>}
          <button className="mt-5 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50" type="submit">Update password</button>
        </form>
      </section>
    </main>
  )
}

export default ProfilePage
