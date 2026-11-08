const labelMap = {
  water_supply: 'Water Supply',
  sanitation: 'Sanitation',
  road: 'Road & Traffic',
  electricity: 'Electricity',
  public_safety: 'Public Safety',
  waste_management: 'Waste Management',
  healthcare: 'Healthcare',
  education: 'Education',
  general: 'General Service',
  new: 'New',
  review: 'Review',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
  escalated: 'Escalated',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  citizen: 'Student / Citizen',
  department_officer: 'Department Officer',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

export const formatLabel = (value) => {
  if (!value) return '—'
  return labelMap[value] || value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const formatDate = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export const statusColors = {
  New: 'bg-slate-100 text-slate-700',
  Review: 'bg-purple-100 text-purple-700',
  Assigned: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Pending: 'bg-rose-100 text-rose-700',
  Resolved: 'bg-emerald-100 text-emerald-700',
  Closed: 'bg-slate-200 text-slate-700',
  Escalated: 'bg-red-100 text-red-700',
}

export const priorityColors = {
  Low: 'bg-slate-200 text-slate-700',
  Medium: 'bg-yellow-200 text-yellow-800',
  High: 'bg-orange-200 text-orange-800',
  Critical: 'bg-red-200 text-red-800',
}

export const getStatusColor = (status) => statusColors[formatLabel(status)] || 'bg-slate-100 text-slate-700'
export const getPriorityColor = (priority) => priorityColors[formatLabel(priority)] || 'bg-slate-200 text-slate-700'

export const ADMIN_ROLES = ['admin', 'super_admin', 'department_officer']
