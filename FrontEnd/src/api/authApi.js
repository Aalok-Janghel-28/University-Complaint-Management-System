import axios from 'axios'

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: ({ access, refresh }) => {
    if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export const api = axios.create({
  baseURL: '/api',
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

    const refreshToken = tokenStorage.getRefreshToken()
    if (!refreshToken) {
      tokenStorage.clear()
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const { data } = await axios.post('/api/auth/token/refresh/', {
        refresh: refreshToken,
      })
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
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (payload) => api.patch('/auth/profile/', payload),
  changePassword: (payload) => api.post('/auth/change-password/', payload),
}
