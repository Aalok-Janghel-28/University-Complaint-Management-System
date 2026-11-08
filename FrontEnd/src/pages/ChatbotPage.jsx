import { useEffect, useMemo, useState } from 'react'

import { complaintsApi } from '../api/complaintsApi'
import AlertMessage from '../components/AlertMessage'

const initialMessages = [
  {
    role: 'assistant',
    text: 'Hello! I am the UCMS AI assistant powered by machine learning. I can help with complaint triage, department routing, SLA guidance, and status tracking.',
  },
]

const ChatbotPage = () => {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [aiStatus, setAiStatus] = useState(null)
  const [error, setError] = useState('')

  const quickQuestions = useMemo(
    () => ['Water issue', 'Road problem', 'SLA escalation', 'Complaint status'],
    [],
  )

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const { data } = await complaintsApi.getAIStatus()
        setAiStatus(data)
      } catch {
        setAiStatus(null)
      }
    }
    loadStatus()
  }, [])

  const handleSend = async (messageText = input) => {
    const trimmed = messageText.trim()
    if (!trimmed || isSending) return

    setError('')
    setIsSending(true)
    setMessages((current) => [...current, { role: 'user', text: trimmed }])
    setInput('')

    try {
      const { data } = await complaintsApi.chat(trimmed)
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: data.reply,
          meta: `Intent: ${data.intent?.replaceAll('_', ' ')} • Confidence: ${Math.round((data.confidence || 0) * 100)}%`,
        },
      ])
    } catch {
      setError('AI assistant is temporarily unavailable. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:py-8 text-slate-800">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-700">AI assistant</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">ML-powered support chatbot</h1>
          </div>
          {aiStatus && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
              <p className="font-semibold">{aiStatus.ready ? 'Model active' : 'Fallback mode'}</p>
              {aiStatus.registry?.samples_trained ? (
                <p>{Number(aiStatus.registry.samples_trained).toLocaleString()} samples trained</p>
              ) : (
                <p>Train models for higher accuracy</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {quickQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => handleSend(question)}
              disabled={isSending}
              className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60"
            >
              {question}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4">
            <AlertMessage type="error" message={error} onDismiss={() => setError('')} />
          </div>
        )}

        <div className="mt-6 max-h-[50vh] space-y-4 overflow-y-auto rounded-2xl bg-slate-50 p-4 sm:max-h-[420px]">
          {messages.map((entry, index) => (
            <div key={`${entry.role}-${index}`} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[80%] ${
                  entry.role === 'user' ? 'bg-violet-600 text-white' : 'bg-white text-slate-700 shadow-sm'
                }`}
              >
                <p>{entry.text}</p>
                {entry.meta && <p className="mt-2 text-xs opacity-70">{entry.meta}</p>}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">Thinking...</div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSend()
            }}
            placeholder="Ask the AI assistant..."
            disabled={isSending}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isSending}
            className="rounded-xl bg-violet-600 px-4 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:bg-slate-400"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </main>
  )
}

export default ChatbotPage
