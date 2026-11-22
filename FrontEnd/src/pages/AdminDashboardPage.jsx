import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { complaintsApi } from '../api/complaintsApi'
import AlertMessage from '../components/AlertMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../contexts/useAuth'
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
  const [slaConfigs, setSlaConfigs] = useState([])
  const [slaForm, setSlaForm] = useState({ department: '', response_hours: 24, resolution_hours: 96, auto_escalate: true })
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '', description: '' })
  const [operationsMessage, setOperationsMessage] = useState('')
  const [operationsError, setOperationsError] = useState('')
  const [staff, setStaff] = useState([])
  const [officerForm, setOfficerForm] = useState({ full_name: '', email: '', password: '', department: '' })
  const canTrainAI = ['admin', 'super_admin'].includes(user?.role)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [analyticsRes, complaintsRes, departmentsRes, aiStatusRes, slaRes, staffRes] = await Promise.all([
          complaintsApi.getAnalytics(),
          complaintsApi.list(),
          complaintsApi.listDepartments(),
          complaintsApi.getAIStatus().catch(() => ({ data: null })),
          complaintsApi.getSlaConfigs().catch(() => ({ data: [] })),
          complaintsApi.getStaffDirectory().catch(() => ({ data: { officers: [] } })),
        ])
        setAnalytics(analyticsRes.data)
        setComplaints(Array.isArray(complaintsRes.data) ? complaintsRes.data : complaintsRes.data.results || [])
        setDepartments(Array.isArray(departmentsRes.data) ? departmentsRes.data : departmentsRes.data.results || [])
        setAiStatus(aiStatusRes.data)
        setSlaConfigs(Array.isArray(slaRes.data) ? slaRes.data : [])
        setStaff(staffRes.data.officers || [])
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

  const saveSla = async (event) => {
    event.preventDefault(); setOperationsMessage(''); setOperationsError('')
    try {
      const { data } = await complaintsApi.saveSlaConfig({ ...slaForm, department: Number(slaForm.department), response_hours: Number(slaForm.response_hours), resolution_hours: Number(slaForm.resolution_hours) })
      setSlaConfigs((current) => [...current.filter((item) => item.department !== data.department), data])
      setOperationsMessage(`SLA updated for ${data.department_name}.`)
    } catch (error) { setOperationsError(error.response?.data?.detail || 'Unable to update SLA configuration.') }
  }

  const createDepartment = async (event) => {
    event.preventDefault(); setOperationsMessage(''); setOperationsError('')
    try {
      const { data } = await complaintsApi.createDepartment(departmentForm)
      setDepartments((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)))
      setDepartmentForm({ name: '', code: '', description: '' })
      setOperationsMessage(`${data.name} department created.`)
    } catch (error) { setOperationsError(error.response?.data?.detail || 'Unable to create department. Check that its code and name are unique.') }
  }

  const createOfficer = async (event) => {
    event.preventDefault(); setOperationsMessage(''); setOperationsError('')
    try {
      const { data } = await complaintsApi.createOfficer({ ...officerForm, department: Number(officerForm.department) })
      setStaff((current) => [...current, data].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setOfficerForm({ full_name: '', email: '', password: '', department: '' })
      setOperationsMessage(`Officer account created for ${data.full_name}.`)
    } catch (error) { setOperationsError(error.response?.data?.detail || 'Unable to create this officer account. Check the email and password requirements.') }
  }

  const exportCsv = () => {
    const columns = ['ticket_id', 'title', 'category', 'priority', 'status', 'department_name', 'assigned_name', 'location', 'created_at']
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [columns.join(','), ...complaints.map((row) => columns.map((key) => quote(row[key])).join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'ucms-complaints.csv'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
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

        <section className="mb-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Reporting</p><h2 className="mt-1 text-lg font-bold text-slate-950">Operational breakdown</h2></div><button onClick={exportCsv} type="button" className="rounded-full border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Export CSV</button></div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">By status</p><div className="mt-3 space-y-2">{Object.entries(analytics?.status_breakdown || {}).map(([name,count]) => <div key={name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{formatLabel(name)}</span><b>{count}</b></div>)}</div></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">By category</p><div className="mt-3 space-y-2">{Object.entries(analytics?.category_breakdown || {}).map(([name,count]) => <div key={name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{formatLabel(name)}</span><b>{count}</b></div>)}</div></div></div>
            <p className="mt-4 text-xs text-slate-500">SLA breaches: <b className="text-rose-700">{analytics?.sla_breached_count ?? 0}</b> · Average citizen rating: <b>{analytics?.average_feedback_rating ? `${analytics.average_feedback_rating}/5` : 'No ratings yet'}</b></p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Complaint volume</p><h2 className="mt-1 text-lg font-bold text-slate-950">Monthly trend</h2><div className="mt-6 flex h-40 items-end gap-2 border-b border-slate-200 pb-2">{(analytics?.monthly_breakdown || []).slice(-8).map((item) => { const peak = Math.max(...(analytics?.monthly_breakdown || []).map((row) => row.count), 1); return <div key={item.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${item.month}: ${item.count}`}><span className="text-[10px] font-semibold text-slate-500">{item.count}</span><div className="w-full max-w-8 rounded-t-lg bg-emerald-500 transition-all" style={{ height: `${Math.max(8, (item.count / peak) * 100)}%` }} /><span className="text-[10px] text-slate-500">{item.month.slice(5)}</span></div>})}</div>{!analytics?.monthly_breakdown?.length && <p className="mt-4 text-sm text-slate-500">Complaint trends will appear as reports are submitted.</p>}</div>
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

        {canTrainAI && <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <form onSubmit={saveSla} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Service levels</p><h2 className="mt-1 text-lg font-bold text-slate-950">Configure department SLA</h2><div className="mt-4 space-y-3"><select required className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={slaForm.department} onChange={(e) => { const department = e.target.value; const existing = slaConfigs.find((item) => item.department === Number(department)); setSlaForm(existing ? { ...existing, department } : { department, response_hours: 24, resolution_hours: 96, auto_escalate: true }) }}><option value="">Choose department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Response target (hours)<input type="number" min="1" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={slaForm.response_hours} onChange={(e) => setSlaForm((v) => ({ ...v, response_hours: e.target.value }))}/></label><label className="text-xs font-semibold text-slate-600">Resolution target (hours)<input type="number" min="1" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={slaForm.resolution_hours} onChange={(e) => setSlaForm((v) => ({ ...v, resolution_hours: e.target.value }))}/></label></div><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={slaForm.auto_escalate} onChange={(e) => setSlaForm((v) => ({ ...v, auto_escalate: e.target.checked }))}/>Automatically escalate overdue tickets</label><button disabled={!slaForm.department} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">Save service level</button></div></form>
          <form onSubmit={createDepartment} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-widest text-sky-700">Organization</p><h2 className="mt-1 text-lg font-bold text-slate-950">Add a department</h2><div className="mt-4 space-y-3"><input required maxLength="120" placeholder="Department name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={departmentForm.name} onChange={(e) => setDepartmentForm((v) => ({ ...v, name: e.target.value }))}/><input required maxLength="30" placeholder="Short code, e.g. FAC" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={departmentForm.code} onChange={(e) => setDepartmentForm((v) => ({ ...v, code: e.target.value.toUpperCase() }))}/><textarea placeholder="What this department handles" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={departmentForm.description} onChange={(e) => setDepartmentForm((v) => ({ ...v, description: e.target.value }))}/><button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50">Create department</button></div></form>
          {operationsMessage && <p role="status" className="lg:col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{operationsMessage}</p>}{operationsError && <p role="alert" className="lg:col-span-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{operationsError}</p>}
        </section>}
        {canTrainAI && <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]"><form onSubmit={createOfficer} className="space-y-3"><p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Access management</p><h2 className="text-lg font-bold text-slate-950">Create department officer</h2><input required maxLength="150" placeholder="Full name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={officerForm.full_name} onChange={(e) => setOfficerForm((v) => ({ ...v, full_name: e.target.value }))}/><input required type="email" placeholder="University email" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={officerForm.email} onChange={(e) => setOfficerForm((v) => ({ ...v, email: e.target.value }))}/><input required type="password" autoComplete="new-password" placeholder="Temporary password" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={officerForm.password} onChange={(e) => setOfficerForm((v) => ({ ...v, password: e.target.value }))}/><select required className="w-full rounded-xl border border-slate-300 px-3 py-2.5" value={officerForm.department} onChange={(e) => setOfficerForm((v) => ({ ...v, department: e.target.value }))}><option value="">Assign department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><button className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-800">Create officer</button></form><div><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Team directory</p><h2 className="mt-1 text-lg font-bold text-slate-950">Department officers</h2></div><span className="text-sm text-slate-500">{staff.length} active</span></div><div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">{staff.length ? staff.map((person) => <div key={person.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">{person.full_name}</p><p className="text-xs text-slate-500">{person.email}</p></div><p className="text-xs font-medium text-emerald-800">{person.department_ids.map((departmentId) => departments.find((d) => d.id === departmentId)?.name).filter(Boolean).join(', ') || 'No department'}</p></div>) : <p className="px-4 py-6 text-sm text-slate-500">No officers yet. Create the first department account here.</p>}</div><p className="mt-3 text-xs text-slate-500">Officers only see and update tickets assigned to them or owned by their department.</p></div></div></section>}
      </div>
    </main>
  )
}

export default AdminDashboardPage
