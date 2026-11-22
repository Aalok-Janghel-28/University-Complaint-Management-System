import axios from 'axios'

export const tokenStorage = {
  accessToken: null,
  getAccessToken: () => tokenStorage.accessToken,
  setTokens: ({ access }) => {
    if (access) tokenStorage.accessToken = access
  },
  clear: () => {
    tokenStorage.accessToken = null
  },
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const accessToken = tokenStorage.getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const { data } = await axios.post('/api/auth/token/refresh/', {}, { withCredentials: true })
      tokenStorage.setTokens(data)
      originalRequest.headers.Authorization = `Bearer ${data.access}`
      return api(originalRequest)
    } catch (refreshError) {
      tokenStorage.clear()
      return Promise.reject(refreshError)
    }
  },
)

export const authApi = {
  register: (payload) => api.post('/auth/register/', payload),
  login: (payload) => api.post('/auth/login/', payload),
  refreshSession: () => api.post('/auth/token/refresh/', {}),
  logout: () => api.post('/auth/logout/', {}),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (payload) => api.patch('/auth/profile/', payload),
  changePassword: (payload) => api.post('/auth/change-password/', payload),
}
