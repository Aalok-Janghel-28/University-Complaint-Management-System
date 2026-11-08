import { api } from './authApi'

export const complaintsApi = {
  list: () => api.get('/complaints/'),
  get: (id) => api.get(`/complaints/${id}/`),
  create: (payload) => api.post('/complaints/', payload),
  update: (id, payload) => api.patch(`/complaints/${id}/`, payload),
  updateStatus: (id, payload) => api.post(`/complaints/${id}/status/`, payload),
  resolve: (id, payload) => api.post(`/complaints/${id}/resolve/`, payload),
  getHistory: (id) => api.get(`/complaints/${id}/history/`),
  getComments: (id) => api.get(`/complaints/${id}/comments/`),
  addComment: (id, message) => api.post(`/complaints/${id}/comments/`, { message }),
  getAnalytics: () => api.get('/complaints/analytics/'),
  getAIInsight: (id) => api.post(`/complaints/${id}/ai-insight/`),
  getAIStatus: () => api.get('/complaints/ai/status/'),
  analyzeText: (payload) => api.post('/complaints/ai/analyze/', payload),
  chat: (message) => api.post('/complaints/ai/chat/', { message }),
  trainAI: (payload) => api.post('/complaints/ai/train/', payload),
  listDepartments: () => api.get('/complaints/departments/'),
  listNotifications: () => api.get('/complaints/notifications/'),
  markNotificationRead: (id) => api.post(`/complaints/notifications/${id}/read/`),
}
