import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { complaintsApi } from '../api/complaintsApi'
import AlertMessage from '../components/AlertMessage'
import LoadingSpinner from '../components/LoadingSpinner'
import { formatDate, formatLabel, getPriorityColor, getStatusColor } from '../utils/formatters'

const ComplaintDetailPage = () => {
  const { id } = useParams()
  const [complaint, setComplaint] = useState(null)
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReAnalyzing, setIsReAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    const loadComplaint = async () => {
      setIsLoading(true)
      setError('')
      try {
        const [complaintRes, historyRes] = await Promise.all([
          complaintsApi.get(id),
          complaintsApi.getHistory(id).catch(() => ({ data: [] })),
        ])
        setComplaint(complaintRes.data)
        setHistory(Array.isArray(historyRes.data) ? historyRes.data : historyRes.data.results || [])
      } catch {
        setError('Complaint not found or you do not have access to view it.')
      } finally {
        setIsLoading(false)
      }
    }

    loadComplaint()
  }, [id])

  const handleReAnalyze = async () => {
    setIsReAnalyzing(true)
    setInfo('')
    setError('')
    try {
      await complaintsApi.getAIInsight(id)
      const [complaintRes, historyRes] = await Promise.all([
        complaintsApi.get(id),
        complaintsApi.getHistory(id).catch(() => ({ data: [] })),
      ])
      setComplaint(complaintRes.data)
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : historyRes.data.results || [])
      setInfo('AI analysis updated successfully.')
    } catch {
      setError('Failed to run AI analysis.')
    } finally {
      setIsReAnalyzing(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <LoadingSpinner label="Loading complaint details..." />
      </main>
    )
  }

  if (error || !complaint) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <AlertMessage type="error" message={error || 'Complaint not found.'} />
          <Link to="/complaints" className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            ← Back to complaints
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:py-8 text-slate-800">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <Link to="/complaints" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
          ← Back to complaints
        </Link>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Ticket details</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{complaint.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{complaint.ticket_id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(complaint.status)}`}>
              {formatLabel(complaint.status)}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPriorityColor(complaint.priority)}`}>
              {formatLabel(complaint.priority)}
            </span>
            <button
              type="button"
              onClick={handleReAnalyze}
              disabled={isReAnalyzing}
              className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
            >
              {isReAnalyzing ? 'Analyzing...' : 'Re-run AI analysis'}
            </button>
          </div>
        </div>

        {info && <div className="mt-4"><AlertMessage type="success" message={info} /></div>}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Category</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatLabel(complaint.category)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Department</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{complaint.department_name || 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Submitted by</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{complaint.citizen_name || '—'}</p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Assigned officer</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{complaint.assigned_name || 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Location</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{complaint.location || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last updated</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatDate(complaint.updated_at)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 p-4">
          <h2 className="text-lg font-bold text-slate-900">Description</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{complaint.description}</p>
        </div>

        {complaint.ai_summary && (
          <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <h2 className="text-lg font-bold text-violet-900">AI analysis</h2>
            <p className="mt-2 text-sm leading-6 text-violet-800">{complaint.ai_summary}</p>
            {complaint.ai_confidence > 0 && (
              <p className="mt-2 text-xs font-semibold text-violet-700">
                Confidence: {Math.round(complaint.ai_confidence * 100)}%
              </p>
            )}
          </div>
        )}

        {complaint.resolution_summary && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="text-lg font-bold text-emerald-900">Resolution</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">{complaint.resolution_summary}</p>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-slate-200 p-4">
          <h2 className="text-lg font-bold text-slate-900">Activity timeline</h2>
          {history.length === 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>• Complaint submitted and categorized as {formatLabel(complaint.category)}.</li>
              <li>• Status: {formatLabel(complaint.status)}.</li>
              <li>• Created on {formatDate(complaint.created_at)}.</li>
            </ul>
          ) : (
            <ul className="mt-4 space-y-3">
              {history.map((entry) => (
                <li key={entry.id} className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-slate-900">{entry.action.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-slate-600">{entry.details}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.actor_name || 'System'} • {formatDate(entry.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}

export default ComplaintDetailPage
