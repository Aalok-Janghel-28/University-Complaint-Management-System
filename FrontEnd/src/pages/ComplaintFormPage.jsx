import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { complaintsApi } from '../api/complaintsApi'
import AlertMessage from '../components/AlertMessage'
import { formatLabel } from '../utils/formatters'

const initialForm = {
  title: '',
  category: 'general',
  location: '',
  priority: 'medium',
  description: '',
}

const ComplaintFormPage = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiPreview, setAiPreview] = useState(null)
  const [attachments, setAttachments] = useState([])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleAnalyze = async () => {
    if (!form.title && !form.description) {
      setError('Enter a title or description before running AI analysis.')
      return
    }

    setError('')
    setIsAnalyzing(true)
    try {
      const { data } = await complaintsApi.analyzeText({
        title: form.title,
        description: form.description,
        location: form.location,
      })
      setAiPreview(data)
      setForm((current) => ({
        ...current,
        category: data.category,
        priority: data.priority,
      }))
    } catch {
      setError('AI analysis failed. You can still submit manually.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    try {
      const payload = new FormData()
      Object.entries({ ...form, source: 'web' }).forEach(([key, value]) => payload.append(key, value))
      attachments.forEach((file) => payload.append('attachments', file))
      const { data } = await complaintsApi.create(payload)
      setSuccess(`Complaint submitted successfully. Ticket ID: ${data.ticket_id}`)
      setForm(initialForm)
      setAiPreview(null)
      setAttachments([])
      setTimeout(() => navigate(`/complaints/${data.id}`), 1500)
    } catch (apiError) {
      const detail = apiError.response?.data
      if (typeof detail === 'object' && detail !== null) {
        const firstKey = Object.keys(detail)[0]
        const value = detail[firstKey]
        setError(Array.isArray(value) ? `${firstKey}: ${value[0]}` : `${firstKey}: ${value}`)
      } else {
        setError('Failed to submit complaint. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:py-8 text-slate-800">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Complaint submission</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Report a campus issue</h1>
        <p className="mt-2 text-sm text-slate-600">
          Submit issues related to facilities, utilities, safety, or general university services. AI will auto-classify on submit.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Complaint title</span>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Example: Water not flowing in hostel block"
            />
          </label>

          <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <span className="block text-sm font-semibold text-slate-800">Evidence and attachments</span>
            <span className="mt-1 block text-xs text-slate-500">Add up to 5 photos or PDF files, up to 10 MB each.</span>
            <input
              className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-100 file:px-4 file:py-2 file:font-semibold file:text-emerald-800 hover:file:bg-emerald-200"
              type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
              onChange={(event) => {
                const selected = Array.from(event.target.files || [])
                if (selected.length > 5) setError('Choose up to five files.')
                else if (selected.some((file) => file.size > 10 * 1024 * 1024)) setError('Each attachment must be 10 MB or smaller.')
                else { setError(''); setAttachments(selected) }
              }}
            />
            {attachments.length > 0 && <p className="mt-2 text-xs text-slate-600">{attachments.map((file) => file.name).join(' · ')}</p>}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Category</span>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="water_supply">Water Supply</option>
                <option value="sanitation">Sanitation</option>
                <option value="road">Road & Traffic</option>
                <option value="electricity">Electricity</option>
                <option value="public_safety">Public Safety</option>
                <option value="waste_management">Waste Management</option>
                <option value="education">Education</option>
                <option value="healthcare">Healthcare</option>
                <option value="general">General Service</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Priority</span>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Location</span>
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Hostel Block A, Main Campus"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows="5"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Describe the issue, affected areas, and when it started."
            />
          </label>

          {aiPreview && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm">
              <p className="font-semibold text-violet-900">AI preview</p>
              <p className="mt-2 text-violet-800">{aiPreview.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-violet-700">
                  {formatLabel(aiPreview.category)}
                </span>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-violet-700">
                  {formatLabel(aiPreview.priority)} priority
                </span>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-violet-700">
                  {aiPreview.recommended_department}
                </span>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-violet-700">
                  {Math.round((aiPreview.confidence || 0) * 100)}% confidence
                </span>
              </div>
            </div>
          )}

          {error && <AlertMessage type="error" message={error} onDismiss={() => setError('')} />}
          {success && <AlertMessage type="success" message={success} />}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? 'Submitting...' : 'Submit complaint'}
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="rounded-full border border-violet-300 bg-violet-50 px-5 py-2.5 font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(initialForm)
                setAiPreview(null)
                setAttachments([])
              }}
              className="rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:border-slate-400"
            >
              Clear form
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

export default ComplaintFormPage
