const variants = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
}

const AlertMessage = ({ type = 'info', message, onDismiss }) => {
  if (!message) return null

  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${variants[type]}`}>
      <p>{message}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 font-semibold opacity-70 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  )
}

export default AlertMessage
