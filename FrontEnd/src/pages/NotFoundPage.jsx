import { Link } from 'react-router-dom'

const NotFoundPage = () => (
  <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
      <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-700">404</p>
      <h1 className="mt-3 text-3xl font-black text-slate-950">Page not found</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        The page you requested does not exist or may have been moved.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-flex rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Back to dashboard
      </Link>
    </section>
  </main>
)

export default NotFoundPage
