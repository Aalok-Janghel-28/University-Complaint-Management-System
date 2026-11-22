import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { complaintsApi } from '../api/complaintsApi'
import AlertMessage from '../components/AlertMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import { formatLabel, getPriorityColor, getStatusColor } from '../utils/formatters'

const ComplaintBoardPage = () => {
  const [complaints, setComplaints] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  useEffect(() => {
    const loadComplaints = async () => {
      setIsLoading(true)
      setError('')
      try {
        const { data } = await complaintsApi.list()
        setComplaints(Array.isArray(data) ? data : data.results || [])
      } catch {
        setError('Unable to load complaints. Please refresh and try again.')
      } finally {
        setIsLoading(false)
      }
    }

    loadComplaints()
  }, [])

  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const matchesSearch =
        !search ||
        complaint.title.toLowerCase().includes(search.toLowerCase()) ||
        complaint.ticket_id.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || complaint.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || complaint.priority === priorityFilter
      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [complaints, search, statusFilter, priorityFilter])

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:py-8 text-slate-800">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Complaint queue</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Live complaint board</h1>
          </div>
          <Link
            className="inline-flex justify-center rounded-full bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
            to="/complaints/new"
          >
            New complaint
          </Link>
        </header>

        <section className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title or ticket ID"
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:col-span-2"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="escalated">Escalated</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </section>

        {error && (
          <div className="mb-4">
            <AlertMessage type="error" message={error} />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner label="Loading complaints..." />
        ) : filteredComplaints.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-semibold text-slate-900">No complaints found</p>
            <p className="mt-2 text-sm text-slate-600">
              {complaints.length === 0
                ? 'Submit your first complaint to get started.'
                : 'Try adjusting your search or filters.'}
            </p>
            <Link
              to="/complaints/new"
              className="mt-5 inline-flex rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Submit complaint
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredComplaints.map((complaint) => {
              const statusLabel = formatLabel(complaint.status)
              const priorityLabel = formatLabel(complaint.priority)

              return (
                <article key={complaint.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                        {complaint.ticket_id}
                      </p>
                      <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-slate-900">{complaint.title}</h2>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(complaint.status)}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getPriorityColor(complaint.priority)}`}>
                      {priorityLabel}
                    </span>
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
                      {formatLabel(complaint.category)}
                    </span>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between gap-3">
                      <dt>Department</dt>
                      <dd className="text-right font-medium text-slate-900">{complaint.department_name || 'Unassigned'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Location</dt>
                      <dd className="text-right font-medium text-slate-900">{complaint.location || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Assignee</dt>
                      <dd className="text-right font-medium text-slate-900">{complaint.assigned_name || 'Unassigned'}</dd>
                    </div>
                  </dl>

                  <Link
                    className="mt-5 inline-flex rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:border-slate-400"
                    to={`/complaints/${complaint.id}`}
                  >
                    View details
                  </Link>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

export default ComplaintBoardPage
