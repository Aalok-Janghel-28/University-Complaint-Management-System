import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { complaintsApi } from '../api/complaintsApi'
import LoadingSpinner from '../components/LoadingSpinner'
import { formatDate, formatLabel, getPriorityColor, getStatusColor } from '../utils/formatters'

const ComplaintDashboardPage = () => {
  const [stats, setStats] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const [analyticsRes, complaintsRes] = await Promise.all([complaintsApi.getAnalytics(), complaintsApi.list()])
        setStats(analyticsRes.data)
        const items = Array.isArray(complaintsRes.data) ? complaintsRes.data : complaintsRes.data.results || []
        setComplaints(items.slice(0, 5))
      } catch {
        setStats(null)
        setComplaints([])
      } finally {
        setIsLoading(false)
      }
    }

    loadAnalytics()
  }, [])

  const dashboardStats = stats
    ? [
        { label: 'Open complaints', value: String(stats.open_count ?? 0), accent: 'bg-emerald-100 text-emerald-800' },
        { label: 'Resolved', value: String(stats.resolved_count ?? 0), accent: 'bg-sky-100 text-sky-800' },
        { label: 'Total complaints', value: String(stats.total_complaints ?? 0), accent: 'bg-amber-100 text-amber-800' },
        {
          label: 'Avg resolution',
          value: stats.average_resolution_hours ? `${stats.average_resolution_hours}h` : '—',
          accent: 'bg-violet-100 text-violet-800',
        },
      ]
    : [
        { label: 'Open complaints', value: '—', accent: 'bg-emerald-100 text-emerald-800' },
        { label: 'Resolved', value: '—', accent: 'bg-sky-100 text-sky-800' },
        { label: 'Total complaints', value: '—', accent: 'bg-amber-100 text-amber-800' },
        { label: 'Avg resolution', value: '—', accent: 'bg-violet-100 text-violet-800' },
      ]

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#eef7f4_100%)] px-4 py-6 sm:py-8 text-slate-800">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] bg-slate-950 p-5 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)] sm:p-7 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300 sm:text-sm">
                University complaint desk
              </p>
              <h1 className="mt-3 text-2xl font-black sm:text-3xl md:text-5xl">
                University Complaint Management System
              </h1>
            </div>
            <nav className="flex flex-wrap gap-2 text-sm sm:gap-3">
              <Link className="rounded-full bg-white/10 px-3 py-2 font-medium text-white transition hover:bg-white/20" to="/complaints">
                Complaint Queue
              </Link>
              <Link className="rounded-full bg-white/10 px-3 py-2 font-medium text-white transition hover:bg-white/20" to="/complaints/new">
                Submit Complaint
              </Link>
              <Link className="rounded-full bg-white/10 px-3 py-2 font-medium text-white transition hover:bg-white/20" to="/chatbot">
                AI Assistant
              </Link>
            </nav>
          </div>
        </header>

        {isLoading ? (
          <LoadingSpinner label="Loading dashboard..." />
        ) : (
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dashboardStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.04)] backdrop-blur-sm">
                <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stat.accent}`}>
                  {stat.label}
                </div>
                <div className="mt-4 text-3xl font-black text-slate-900">{stat.value}</div>
              </div>
            ))}
          </section>
        )}

        {!isLoading && <section className="mb-8 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-slate-500">Recent reports</p><h2 className="mt-1 text-xl font-black text-slate-950">Your complaint progress</h2></div><Link to="/complaints" className="text-sm font-bold text-emerald-700 hover:text-emerald-900">Open complaint board →</Link></div>{complaints.length ? <div className="mt-4 divide-y divide-slate-100">{complaints.map((item) => <Link key={item.id} to={`/complaints/${item.id}`} className="flex flex-col gap-3 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{item.ticket_id} · {formatDate(item.created_at)}</p><p className="mt-1 truncate font-bold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.department_name || 'Awaiting department'}{item.sla_deadline ? ` · Due ${formatDate(item.sla_deadline)}` : ''}</p></div><div className="flex gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getStatusColor(item.status)}`}>{formatLabel(item.status)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getPriorityColor(item.priority)}`}>{formatLabel(item.priority)}</span></div></Link>)}</div> : <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center"><p className="font-semibold text-slate-800">No reports yet</p><p className="mt-1 text-sm text-slate-500">Submit your first campus issue to start tracking updates here.</p><Link to="/complaints/new" className="mt-4 inline-flex rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Report an issue</Link></div>}</section>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link
            to="/complaints"
            className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_20px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_50px_rgba(15,23,42,0.08)] sm:p-6"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Queue</p>
            <h2 className="mt-3 text-xl font-black text-slate-900 sm:text-2xl">Live complaints</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Monitor escalations, priority issues, and departmental progress across campus support.
            </p>
          </Link>

          <Link
            to="/complaints/new"
            className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_20px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_50px_rgba(15,23,42,0.08)] sm:p-6"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Submit</p>
            <h2 className="mt-3 text-xl font-black text-slate-900 sm:text-2xl">New report</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              File issues for water, facilities, electricity, sanitation, or campus safety concerns.
            </p>
          </Link>

          <Link
            to="/chatbot"
            className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_20px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_50px_rgba(15,23,42,0.08)] sm:p-6 md:col-span-2 xl:col-span-1"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Support</p>
            <h2 className="mt-3 text-xl font-black text-slate-900 sm:text-2xl">AI guidance</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Get fast complaint triage and routing recommendations before escalation.
            </p>
          </Link>
        </section>
      </div>
    </main>
  )
}

export default ComplaintDashboardPage
