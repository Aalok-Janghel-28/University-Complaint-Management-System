export const moduleCatalog = [
  {
    id: 1,
    title: 'Authentication & User Management',
    status: 'Implemented',
    description: 'Citizen, officer, and admin login, registration, password recovery, and profile management.',
  },
  {
    id: 2,
    title: 'Role & Permission Management',
    status: 'Implemented',
    description: 'Role-based access rules for citizen, department officer, admin, and super admin actors.',
  },
  {
    id: 3,
    title: 'Complaint Submission',
    status: 'Implemented',
    description: 'Complaint intake with title, category, location, upload support, and source tracking.',
  },
  {
    id: 4,
    title: 'Complaint Categorization',
    status: 'Implemented',
    description: 'Rule-based grouping for sanitation, water, electricity, roads, public safety, and more.',
  },
  {
    id: 5,
    title: 'AI Complaint Analysis',
    status: 'Implemented',
    description: 'AI-generated summary, sentiment signal, risk scoring, and confidence insights.',
  },
  {
    id: 6,
    title: 'Complaint Assignment',
    status: 'Implemented',
    description: 'Department and officer assignment with reassignment history and ownership visibility.',
  },
  {
    id: 7,
    title: 'Complaint Tracking',
    status: 'Implemented',
    description: 'Live ticket status tracking from submission through resolution and closure.',
  },
  {
    id: 8,
    title: 'SLA & Auto Escalation',
    status: 'Implemented',
    description: 'Service levels, escalation triggers, and deadlines for each department workflow.',
  },
  {
    id: 9,
    title: 'Notification & Communication',
    status: 'Implemented',
    description: 'Citizen, staff, and admin notifications for updates, assignments, and reminders.',
  },
  {
    id: 10,
    title: 'Complaint Resolution & Feedback',
    status: 'Implemented',
    description: 'Resolution summaries, closure notes, citizen feedback, and satisfaction tracking.',
  },
  {
    id: 11,
    title: 'Complaint History & Audit',
    status: 'Implemented',
    description: 'Immutable timeline of actions, status changes, notes, and operational audit entries.',
  },
  {
    id: 12,
    title: 'Admin & Department Dashboard',
    status: 'Implemented',
    description: 'Operational queue, department analytics, team workload, and resolution overview.',
  },
  {
    id: 13,
    title: 'Analytics & Reporting',
    status: 'Implemented',
    description: 'Granular reporting on categories, resolution times, complaint volume, and trends.',
  },
  {
    id: 14,
    title: 'AI Assistant / Chatbot',
    status: 'Implemented',
    description: 'Guided responses, complaint triage suggestions, and conversational support agent flow.',
  },
  {
    id: 15,
    title: 'Security & Data Management',
    status: 'Implemented',
    description: 'JWT auth, permission enforcement, password validation, audit visibility, and secure storage patterns.',
  },
]

export const dashboardStats = [
  { label: 'Open complaints', value: '184', accent: 'bg-emerald-100 text-emerald-800' },
  { label: 'Resolved today', value: '48', accent: 'bg-sky-100 text-sky-800' },
  { label: 'SLA breaches', value: '9', accent: 'bg-amber-100 text-amber-800' },
  { label: 'AI confidence', value: '92%', accent: 'bg-violet-100 text-violet-800' },
]

export const complaintSamples = [
  {
    id: 'CMP-20260901-0124',
    title: 'Water supply interrupted in Main Avenue',
    category: 'Water Supply',
    status: 'Assigned',
    priority: 'High',
    department: 'Water Supply',
    location: 'Main Avenue Block 4',
    assignee: 'A. Shah',
  },
  {
    id: 'CMP-20260901-0741',
    title: 'Street light not working on Public Road',
    category: 'Electricity',
    status: 'In Progress',
    priority: 'Medium',
    department: 'Electricity',
    location: 'Hill Street',
    assignee: 'J. Firoz',
  },
  {
    id: 'CMP-20260901-1438',
    title: 'Garbage overflow near school gate',
    category: 'Waste Management',
    status: 'Pending',
    priority: 'High',
    department: 'Sanitation',
    location: 'Garden Road',
    assignee: 'N. Ali',
  },
]

export const adminMetrics = [
  { label: 'Department workload', value: '68%' },
  { label: 'Average resolution time', value: '3.2 days' },
  { label: 'Citizen satisfaction', value: '4.7/5' },
  { label: 'Escalations triggered', value: '12' },
]

export const chatbotResponses = [
  {
    role: 'assistant',
    text: 'I reviewed the complaint and recommend routing it to the Water Supply team with a high-priority SLA.',
  },
  {
    role: 'user',
    text: 'What if the service is still down after 24 hours?',
  },
  {
    role: 'assistant',
    text: 'The system should trigger auto-escalation to the department supervisor and notify the citizen for a status update.',
  },
]
