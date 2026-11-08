import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { complaintsApi } from '../api/complaintsApi'
import AlertMessage from '../components/AlertMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { formatLabel } from '../utils/formatters'

const AdminDashboardPage = () => {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [departments, setDepartments] = useState([])
  const [aiStatus, setAiStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTraining, setIsTraining] = useState(false)
  const [trainMessage, setTrainMessage] = useState('')
  const [trainError, setTrainError] = useState('')
  const canTrainAI = ['admin', 'super_admin'].includes(user?.role)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [analyticsRes, complaintsRes, departmentsRes, aiStatusRes] = await Promise.all([
          complaintsApi.getAnalytics(),
          complaintsApi.list(),
          complaintsApi.listDepartments(),
          complaintsApi.getAIStatus().catch(() => ({ data: null })),
        ])
        setAnalytics(analyticsRes.data)
        setComplaints(Array.isArray(complaintsRes.data) ? complaintsRes.data : complaintsRes.data.results || [])
        setDepartments(Array.isArray(departmentsRes.data) ? departmentsRes.data : departmentsRes.data.results || [])
        setAiStatus(aiStatusRes.data)
      } catch {
        setAnalytics(null)
        setComplaints([])
        setDepartments([])
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const adminMetrics = analytics
    ? [
        { label: 'Open complaints', value: String(analytics.open_count ?? 0) },
        {
          label: 'Average resolution',
          value: analytics.average_resolution_hours ? `${analytics.average_resolution_hours}h` : '—',
        },
        { label: 'Resolved complaints', value: String(analytics.resolved_count ?? 0) },
        { label: 'Total complaints', value: String(analytics.total_complaints ?? 0) },
      ]
    : []

  const departmentStats = useMemo(() => {
    const counts = complaints.reduce((acc, complaint) => {
      const name = complaint.department_name || 'Unassigned'
      acc[name] = (acc[name] || 0) + 1
      return acc
    }, {})

    const maxCount = Math.max(...Object.values(counts), 1)

    return departments.map((department) => ({
      name: department.name,
      count: counts[department.name] || 0,
      width: `${Math.round(((counts[department.name] || 0) / maxCount) * 100)}%`,
    }))
  }, [complaints, departments])

  const priorityQueue = complaints
    .filter((item) => ['high', 'critical', 'escalated'].includes(item.priority) || item.status === 'escalated')
    .slice(0, 6)

  const handleTrainAI = async () => {
    setTrainError('')
    setTrainMessage('')
    setIsTraining(true)
    try {
      const { data } = await complaintsApi.trainAI({ samples: 100_000, generate_if_missing: true })
      setTrainMessage(
        `AI trained on ${Number(data.metadata?.samples_trained || 0).toLocaleString()} samples (v${data.metadata?.version || 'new'}).`,
      )
      const statusRes = await complaintsApi.getAIStatus()
      setAiStatus(statusRes.data)
    } catch {
      setTrainError('AI training failed. Run generate_training_data and train_ai_models from backend terminal for large jobs.')
    } finally {
      setIsTraining(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <LoadingSpinner label="Loading admin dashboard..." />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:py-8 text-slate-800">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-2xl bg-slate-900 p-5 text-white shadow-lg sm:p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Admin dashboard</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Department and operations overview</h1>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {adminMetrics.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{item.label}</p>
              <div className="mt-3 text-3xl font-bold text-slate-900">{item.value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">Priority queue</h2>
              <Link to="/complaints" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                View all
              </Link>
            </div>
            <div className="mt-5 space-y-4">
              {priorityQueue.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-600">No high-priority complaints right now.</p>
              ) : (
                priorityQueue.map((item) => (
                  <Link
                    key={item.id}
                    to={`/complaints/${item.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-emerald-300 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500">
                        {item.department_name || 'Unassigned'} • {item.assigned_name || 'Unassigned'}
                      </p>
                    </div>
                    <span className="shrink-0 self-start rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 sm:self-center">
                      {formatLabel(item.priority)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold text-slate-900">Department workload</h2>
            <ul className="mt-5 space-y-4 text-sm">
              {departmentStats.length === 0 ? (
                <li className="rounded-xl bg-slate-50 px-3 py-4 text-slate-600">No department data available.</li>
              ) : (
                departmentStats.map((item) => (
                  <li key={item.name} className="rounded-xl bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="text-slate-900">{item.count} tasks</span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: item.width }} />
                    </div>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </section>

        <section className="mt-8 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">AI model center</h2>
              <p className="mt-2 text-sm text-slate-600">
                Machine learning models classify complaints, detect priority, analyze sentiment, and power the chatbot.
              </p>
            </div>
            {canTrainAI && (
              <button
                type="button"
                onClick={handleTrainAI}
                disabled={isTraining}
                className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:bg-slate-400"
              >
                {isTraining ? 'Training...' : 'Train AI (100k samples)'}
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-1 font-semibold text-slate-900">{aiStatus?.ready ? 'Active' : 'Fallback rules'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Samples trained</p>
              <p className="mt-1 font-semibold text-slate-900">
                {aiStatus?.registry?.samples_trained
                  ? Number(aiStatus.registry.samples_trained).toLocaleString()
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Category accuracy</p>
              <p className="mt-1 font-semibold text-slate-900">
                {aiStatus?.registry?.category_accuracy
                  ? `${Math.round(aiStatus.registry.category_accuracy * 100)}%`
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Model version</p>
              <p className="mt-1 font-semibold text-slate-900">{aiStatus?.registry?.version || 'Not trained'}</p>
            </div>
          </div>

          {trainMessage && (
            <div className="mt-4">
              <AlertMessage type="success" message={trainMessage} />
            </div>
          )}
          {trainError && (
            <div className="mt-4">
              <AlertMessage type="error" message={trainError} />
            </div>
          )}

          {canTrainAI && (
            <p className="mt-4 text-xs text-slate-500">
              For million-scale training, run:{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">python manage.py generate_training_data --samples 1000000</code>{' '}
              then{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">python manage.py train_ai_models</code>
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

export default AdminDashboardPage
