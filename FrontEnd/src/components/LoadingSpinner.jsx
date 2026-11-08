const LoadingSpinner = ({ label = 'Loading...' }) => (
  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-slate-600">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
    <p className="text-sm font-medium">{label}</p>
  </div>
)

export default LoadingSpinner
