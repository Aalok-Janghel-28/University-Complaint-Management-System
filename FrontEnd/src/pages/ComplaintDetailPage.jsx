import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { complaintsApi } from '../api/complaintsApi'
import AlertMessage from '../components/AlertMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../contexts/useAuth'
import { formatDate, formatLabel, getPriorityColor, getStatusColor } from '../utils/formatters'

const panel = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

const ComplaintDetailPage = () => {
  const { id } = useParams()
  const { user } = useAuth()
  const [complaint, setComplaint] = useState(null)
  const [history, setHistory] = useState([])
  const [comments, setComments] = useState([])
  const [directory, setDirectory] = useState({ departments: [], officers: [] })
  const [comment, setComment] = useState('')
  const [resolution, setResolution] = useState('')
  const [rating, setRating] = useState(complaint?.feedback_rating || 5)
  const [feedback, setFeedback] = useState('')
  const [assignment, setAssignment] = useState({ department: '', assigned_to: '' })
  const [nextStatus, setNextStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const isAdmin = ['admin', 'super_admin'].includes(user?.role)
  const canManage = isAdmin || (user?.role === 'department_officer' && complaint?.assigned_to === user?.id)
  const canFeedback = complaint?.citizen === user?.id && ['resolved', 'closed'].includes(complaint?.status)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [complaintRes, historyRes, commentsRes] = await Promise.all([
        complaintsApi.get(id), complaintsApi.getHistory(id), complaintsApi.getComments(id),
      ])
      const item = complaintRes.data
      setComplaint(item)
      setRating(item.feedback_rating || 5)
      setFeedback(item.feedback_comment || '')
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : historyRes.data.results || [])
      setComments(Array.isArray(commentsRes.data) ? commentsRes.data : commentsRes.data.results || [])
      setAssignment({ department: String(item.department || ''), assigned_to: String(item.assigned_to || '') })
      setNextStatus(item.status)
      setStatusNote('')
      setResolution(item.resolution_summary || '')
    } catch {
      setError('This complaint could not be loaded. It may have been removed or you may not have access.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const timer = window.setTimeout(() => { load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (!isAdmin && user?.role !== 'department_officer') return
    complaintsApi.getStaffDirectory().then(({ data }) => setDirectory(data)).catch(() => {})
  }, [isAdmin, user?.role])

  const runAction = async (action, successMessage) => {
    setBusy(true); setError(''); setNotice('')
    try { await action(); await load(); setNotice(successMessage) }
    catch (apiError) { setError(apiError.response?.data?.detail || 'The update could not be saved. Please try again.') }
    finally { setBusy(false) }
  }

  const downloadAttachment = async (file) => {
    try {
      const { data } = await complaintsApi.downloadAttachment(file.id)
      const url = URL.createObjectURL(data)
      const link = document.createElement('a'); link.href = url; link.download = file.name; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('Evidence could not be downloaded. Please refresh and try again.') }
  }

  const addComment = async (event) => {
    event.preventDefault()
    if (!comment.trim()) return
    await runAction(() => complaintsApi.addComment(id, comment.trim()), 'Your update was added to the conversation.')
    setComment('')
  }

  if (loading) return <main className="min-h-[70vh] px-4 py-8"><LoadingSpinner label="Loading complaint workspace..." /></main>
  if (!complaint) return <main className="mx-auto max-w-4xl px-4 py-8"><AlertMessage type="error" message={error || 'Complaint not found.'} /><Link to="/complaints" className="mt-4 inline-flex text-sm font-semibold text-emerald-700">Back to complaints</Link></main>

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 sm:py-9">
      <div className="mx-auto max-w-6xl">
        <Link to="/complaints" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">← Complaint workspace</Link>
        <header className="mt-4 overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-300">{complaint.ticket_id}</p>
              <h1 className="mt-3 max-w-3xl text-2xl font-black sm:text-3xl">{complaint.title}</h1>
              <p className="mt-2 text-sm text-slate-300">Submitted {formatDate(complaint.created_at)} · {complaint.location || 'Location not provided'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${getStatusColor(complaint.status)}`}>{formatLabel(complaint.status)}</span>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${getPriorityColor(complaint.priority)}`}>{formatLabel(complaint.priority)} priority</span>
            </div>
          </div>
          <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
            <div><p className="text-xs uppercase tracking-wider text-slate-400">Department</p><p className="mt-1 font-semibold">{complaint.department_name || 'Unassigned'}</p></div>
            <div><p className="text-xs uppercase tracking-wider text-slate-400">Assigned officer</p><p className="mt-1 font-semibold">{complaint.assigned_name || 'Awaiting assignment'}</p></div>
            <div><p className="text-xs uppercase tracking-wider text-slate-400">Resolution SLA</p><p className="mt-1 font-semibold">{complaint.sla_deadline ? `${formatDate(complaint.sla_deadline)} · ${formatLabel(complaint.sla_status)}` : 'Deadline pending'}</p></div>
          </div>
        </header>

        {error && <div className="mt-4"><AlertMessage type="error" message={error} onDismiss={() => setError('')} /></div>}
        {notice && <div className="mt-4"><AlertMessage type="success" message={notice} onDismiss={() => setNotice('')} /></div>}

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <section className={panel}>
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Issue report</p><h2 className="mt-1 text-lg font-bold text-slate-950">Description</h2></div>
                <button type="button" disabled={busy} onClick={() => runAction(() => complaintsApi.getAIInsight(id), 'AI analysis refreshed.')} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50">Re-analyze with AI</button>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{complaint.description}</p>
              {complaint.attachments?.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Evidence · private to authorized viewers</p><div className="mt-2 flex flex-wrap gap-2">{complaint.attachments.map((file) => <button type="button" key={file.id} onClick={() => downloadAttachment(file)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:border-emerald-300">↓ {file.name}</button>)}</div></div>}
            </section>

            {complaint.ai_summary && <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5"><p className="text-xs font-bold uppercase tracking-widest text-violet-700">AI triage · {Math.round((complaint.ai_confidence || 0) * 100)}% confidence</p><p className="mt-2 text-sm leading-6 text-violet-950">{complaint.ai_summary}</p></section>}

            {complaint.resolution_summary && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Resolution · {complaint.resolved_at ? formatDate(complaint.resolved_at) : 'Completed'}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-950">{complaint.resolution_summary}</p></section>}

            <section className={panel}>
              <h2 className="text-lg font-bold text-slate-950">Conversation</h2>
              <div className="mt-4 space-y-3">{comments.length ? comments.map((entry) => <article key={entry.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><p className="text-sm font-bold text-slate-800">{entry.author_name || 'Team member'}</p><time className="text-xs text-slate-500">{formatDate(entry.created_at)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{entry.message}</p></article>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No updates yet. Use this thread to keep the reporter informed.</p>}</div>
              <form onSubmit={addComment} className="mt-4 flex flex-col gap-2 sm:flex-row"><input className={field} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add an update or question" maxLength={2000} /><button disabled={busy || !comment.trim()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">Post update</button></form>
            </section>

            <section className={panel}>
              <h2 className="text-lg font-bold text-slate-950">Activity history</h2>
              <ol className="mt-5 space-y-4 border-l border-slate-200 pl-5">{history.map((entry) => <li key={entry.id} className="relative"><span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-white"/><p className="text-sm font-bold capitalize text-slate-900">{entry.action.replaceAll('_', ' ')}</p><p className="mt-1 text-sm text-slate-600">{entry.details}</p><p className="mt-1 text-xs text-slate-400">{entry.actor_name || 'System'} · {formatDate(entry.created_at)}</p></li>)}</ol>
            </section>
          </div>

          <aside className="space-y-5">
            {canManage && <section className={panel}>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Staff tools</p><h2 className="mt-1 text-lg font-bold text-slate-950">Manage complaint</h2>
              {(isAdmin || user?.role === 'department_officer') && <div className="mt-4 space-y-3">{isAdmin && <label className="block text-xs font-semibold text-slate-600">Department<select className={`${field} mt-1`} value={assignment.department} onChange={(e) => setAssignment((value) => ({ ...value, department: e.target.value, assigned_to: '' }))}><option value="">Select department</option>{directory.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}<label className="block text-xs font-semibold text-slate-600">Officer<select className={`${field} mt-1`} value={assignment.assigned_to} onChange={(e) => setAssignment((value) => ({ ...value, assigned_to: e.target.value }))}><option value="">Unassigned</option>{directory.officers.filter((officer) => !assignment.department || officer.department_ids.includes(Number(assignment.department))).map((o) => <option key={o.id} value={o.id}>{o.full_name} · {o.email}</option>)}</select></label><button type="button" disabled={busy} onClick={() => runAction(() => complaintsApi.assign(id, { ...(isAdmin ? { department: assignment.department || null } : {}), assigned_to: assignment.assigned_to || null }), 'Assignment updated.')} className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50">Save assignment</button></div>}
              <label className="mt-4 block text-xs font-semibold text-slate-600">Status<select className={`${field} mt-1`} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>{['new','review','assigned','in_progress','pending','escalated'].map((s) => <option value={s} key={s}>{formatLabel(s)}</option>)}</select></label>
              <label className="mt-3 block text-xs font-semibold text-slate-600">Status update note<input className={`${field} mt-1`} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Optional progress note" /></label>
              <button type="button" disabled={busy || nextStatus === complaint.status} onClick={() => runAction(() => complaintsApi.updateStatus(id, { status: nextStatus, note: statusNote }), 'Status updated and reporter notified.')} className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">Update status</button>
              <label className="mt-4 block text-xs font-semibold text-slate-600">Resolution summary<textarea className={`${field} mt-1 min-h-24`} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Describe the work completed and outcome"/></label>
              <button type="button" disabled={busy || !resolution.trim()} onClick={() => runAction(() => complaintsApi.resolve(id, { resolution_summary: resolution }), 'Complaint resolved. The reporter has been notified.')} className="mt-2 w-full rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">Resolve complaint</button>
            </section>}

            {canFeedback && <section className={panel}><p className="text-xs font-bold uppercase tracking-widest text-amber-700">Your feedback</p><h2 className="mt-1 text-lg font-bold text-slate-950">How was this resolved?</h2><div className="mt-4 flex gap-2" role="radiogroup" aria-label="Resolution rating">{[1,2,3,4,5].map((value) => <button type="button" key={value} aria-label={`${value} star${value > 1 ? 's' : ''}`} aria-checked={rating === value} role="radio" onClick={() => setRating(value)} className={`text-2xl ${value <= rating ? 'text-amber-400' : 'text-slate-200'}`}>★</button>)}</div><textarea className={`${field} mt-3 min-h-24`} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Tell us what went well or what could improve"/><button disabled={busy} onClick={() => runAction(() => complaintsApi.feedback(id, { feedback_rating: rating, feedback_comment: feedback }), 'Thank you. Your feedback was saved.')} className="mt-3 w-full rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50">{complaint.feedback_rating ? 'Update feedback' : 'Send feedback'}</button></section>}
            {complaint.citizen === user?.id && complaint.status === 'resolved' && <section className={panel}><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Resolution complete</p><h2 className="mt-1 text-lg font-bold text-slate-950">Close this ticket?</h2><p className="mt-2 text-sm leading-6 text-slate-600">Close the complaint once you’re satisfied with the resolution. You can still review its timeline afterward.</p><button type="button" disabled={busy} onClick={() => runAction(() => complaintsApi.close(id), 'Complaint closed. Thank you for confirming.')} className="mt-4 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50">Confirm and close</button></section>}
            {complaint.feedback_rating && <section className={panel}><p className="text-xs font-bold uppercase tracking-widest text-amber-700">Citizen feedback</p><p className="mt-2 text-xl text-amber-500">{'★'.repeat(complaint.feedback_rating)}<span className="text-slate-200">{'★'.repeat(5 - complaint.feedback_rating)}</span></p>{complaint.feedback_comment && <p className="mt-2 text-sm text-slate-600">{complaint.feedback_comment}</p>}</section>}
            <section className={panel}><h2 className="font-bold text-slate-950">Ticket overview</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Category</dt><dd className="text-right font-semibold">{formatLabel(complaint.category)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Submitted by</dt><dd className="text-right font-semibold">{complaint.citizen_name}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Updated</dt><dd className="text-right font-semibold">{formatDate(complaint.updated_at)}</dd></div>{complaint.response_deadline && <div className="flex justify-between gap-3"><dt className="text-slate-500">Response deadline</dt><dd className="text-right font-semibold">{formatDate(complaint.response_deadline)}</dd></div>}{complaint.sla_deadline && <div className="flex justify-between gap-3"><dt className="text-slate-500">Resolution deadline</dt><dd className="text-right font-semibold">{formatDate(complaint.sla_deadline)}</dd></div>}</dl></section>
          </aside>
        </div>
      </div>
    </main>
  )
}

export default ComplaintDetailPage
